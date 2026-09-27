import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { HttpError } from '../utils/httpError.js';
import { removeTempFiles } from './upload.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route ${req.method} ${req.originalUrl} not found`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  // Multer streams uploads to disk before the handler runs, so a request that
  // fails after that point would leak its files unless they are cleaned up here.
  // This is a no-op for successful uploads, which have already been moved into
  // place by the storage adapter.
  void removeTempFiles(req.files);

  if (error instanceof ZodError) {
    res.status(422).json({ error: 'Validation failed', details: error.flatten() });
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'File is too large (maximum 15 MB)' : error.message });
    return;
  }
  if (error?.name === 'ValidationError') {
    res.status(422).json({ error: 'Validation failed', details: Object.values(error.errors ?? {}).map((item: any) => item.message) });
    return;
  }
  if (error?.name === 'CastError') {
    // A malformed id in the URL is a client mistake, so answer 400 rather than
    // letting it surface as a 500 and pollute the server error log.
    res.status(400).json({ error: 'Malformed identifier' });
    return;
  }
  const status = error instanceof HttpError ? error.statusCode : error?.statusCode ?? 500;
  const message = status >= 500 ? 'Something went wrong. Please try again.' : error.message;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: message, ...(error.details ? { details: error.details } : {}) });
};
