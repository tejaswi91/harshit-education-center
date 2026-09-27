import multer from 'multer';
import fs from 'node:fs';
import { uploadDirectory } from '../config/paths.js';
import { HttpError } from '../utils/httpError.js';

if (!fs.existsSync(uploadDirectory)) fs.mkdirSync(uploadDirectory, { recursive: true });

export { uploadDirectory };

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
  limits: { fileSize: 15 * 1024 * 1024 },
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
