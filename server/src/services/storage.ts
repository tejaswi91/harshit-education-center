import fs from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { uploadDirectory } from '../middleware/upload.js';
import type { FileMetadata } from '../models/Material.js';

export interface DownloadFile {
  path?: string;
  stream?: NodeJS.ReadableStream;
  contentType?: string;
  size?: number;
}

export interface StorageAdapter {
  put(file: Express.Multer.File, folder: string): Promise<FileMetadata>;
  getDownload(key: string): Promise<DownloadFile>;
  remove(key: string): Promise<void>;
}

function safeLocalPath(key: string) {
  const rootPath = path.resolve(uploadDirectory);
  const candidate = path.resolve(rootPath, key);
  if (candidate !== rootPath && !candidate.startsWith(`${rootPath}${path.sep}`)) throw new Error('Invalid storage key');
  return candidate;
}

class LocalStorage implements StorageAdapter {
  async put(file: Express.Multer.File, folder: string): Promise<FileMetadata> {
    const key = `${folder}/${file.filename}`;
    const destination = safeLocalPath(key);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    try {
      await fs.rename(file.path, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      await fs.copyFile(file.path, destination);
      await fs.unlink(file.path);
    }
    return { key, originalName: file.originalname, mimeType: file.mimetype, size: file.size };
  }

  async getDownload(key: string) {
    const filePath = safeLocalPath(key);
    const stat = await fs.stat(filePath);
    return { path: filePath, size: stat.size };
  }

  async remove(key: string) {
    await fs.unlink(safeLocalPath(key)).catch(() => undefined);
  }
}

class S3Storage implements StorageAdapter {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: Boolean(env.STORAGE_ENDPOINT),
      credentials: env.STORAGE_ACCESS_KEY && env.STORAGE_SECRET_KEY
        ? { accessKeyId: env.STORAGE_ACCESS_KEY, secretAccessKey: env.STORAGE_SECRET_KEY }
        : undefined
    });
  }

  async put(file: Express.Multer.File, folder: string): Promise<FileMetadata> {
    const key = `${folder}/${file.filename}`;
    await this.client.send(new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
      Body: file.path,
      ContentType: file.mimetype,
      ContentLength: file.size
    }));
    return { key, originalName: file.originalname, mimeType: file.mimetype, size: file.size };
  }

  async getDownload(key: string) {
    const result = await this.client.send(new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
    if (!result.Body) throw new Error('Stored object has no body');
    return { stream: result.Body as NodeJS.ReadableStream, contentType: result.ContentType, size: result.ContentLength };
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
  }
}

export const storage: StorageAdapter = env.STORAGE_PROVIDER === 's3' ? new S3Storage() : new LocalStorage();
export const isLocalStorage = env.STORAGE_PROVIDER !== 's3';
