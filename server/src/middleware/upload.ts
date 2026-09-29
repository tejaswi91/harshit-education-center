import multer from 'multer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uploadDirectory as preferredUploadDirectory } from '../config/paths.js';
import { uploadMaxBytes } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

/**
 * Directory multer streams uploads into.
 *
 * The default lives inside the repository, which is writable locally and in
 * Docker. Serverless hosts such as Vercel mount the bundle read-only and only
 * allow writes under the temp directory, so creation is attempted first and the
 * temp directory is used as the fallback. The fallback is only safe because a
 * deployed serverless instance is expected to be paired with `STORAGE_PROVIDER=s3`
 * (or another durable store); local disk here is scratch space for the request,
 * not a place the file is meant to survive.
 */
function resolveUploadDirectory() {
  try {
    fs.mkdirSync(preferredUploadDirectory, { recursive: true });
    fs.accessSync(preferredUploadDirectory, fs.constants.W_OK);
    return preferredUploadDirectory;
  } catch {
    const fallback = path.join(os.tmpdir(), 'hec-uploads');
    fs.mkdirSync(fallback, { recursive: true });
    console.warn(`Upload directory is not writable, falling back to ${fallback}`);
    return fallback;
  }
}

export const uploadDirectory = resolveUploadDirectory();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDirectory),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safeName}`);
  }
});

const allowedMimeTypes = new Set([
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain',
  'image/jpeg', 'image/png', 'image/webp'
]);

export const upload = multer({
  storage,
  limits: { fileSize: uploadMaxBytes },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) return cb(new HttpError(400, 'Unsupported file type. Upload PDF, Office documents, text, JPG, PNG, or WebP files.'));
    cb(null, true);
  }
});

/** The three shapes `req.files` can take depending on how multer was invoked. */
export type UploadedFiles = Express.Multer.File[] | Record<string, Express.Multer.File[]> | undefined;

/**
 * Deletes the temporary files multer wrote to disk for a request.
 *
 * `diskStorage` streams each file to disk *before* the route handler runs, so a
 * request that is afterwards rejected (failed payload validation, a role check,
 * a database error) would otherwise leave the file behind forever. Successful
 * uploads are unaffected because `storage.put` has already moved their temporary
 * file to its final location, which makes the unlink a no-op here.
 */
export async function removeTempFiles(files: UploadedFiles): Promise<void> {
  const list = Array.isArray(files) ? files : Object.values(files ?? {}).flat();
  await Promise.all(list.map((file) => fs.promises.unlink(file.path).catch(() => undefined)));
}
