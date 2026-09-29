import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { clientDistDirectory, clientIndexFile } from './config/paths.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.js';
import { publicRoutes } from './routes/public.js';
import { materialRoutes } from './routes/materials.js';
import { dashboardRoutes } from './routes/dashboards.js';
import { adminRoutes } from './routes/admin.js';
import { storage } from './services/storage.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { requireAuth } from './middleware/auth.js';

export const app = express();
app.disable('x-powered-by');
/**
 * Number of reverse-proxy hops to trust when deriving the client IP from
 * `X-Forwarded-For`. Rate limiting and HTTPS detection are both keyed off
 * `req.ip`, so this must match the real topology: leave it at 0 when nothing
 * sits in front of the app (a spoofed header would otherwise let callers
 * sidestep the limiter), and set it to 1 behind a single nginx/ALB hop.
 */
app.set('trust proxy', env.TRUST_PROXY);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CLIENT_URL.split(',').map((item) => item.trim()), credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: 'draft-7', legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'hec-api' }));
app.get('/api/files/:key(*)', requireAuth, asyncHandler(async (req, res) => {
  const key = Array.isArray(req.params.key) ? req.params.key.join('/') : String(req.params.key);
  const result = await storage.getDownload(key);
  /**
   * Local storage resolves to a path on disk; S3 resolves to a stream. Only one
   * of the two is populated, so both are checked rather than assuming a
   * provider, which is what previously made this endpoint answer 501 for
   * `STORAGE_PROVIDER=s3` even though the adapter was working.
   */
  if (result.path) {
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.download(result.path);
  }
  if (result.stream) {
    res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
    if (result.size) res.setHeader('Content-Length', String(result.size));
    return result.stream.pipe(res);
  }
  return res.status(404).json({ error: 'File not found' });
}));
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
/**
 * Whether the built client sits next to the compiled server and can be served
 * from here.
 *
 * Locally and in Docker the single Node process serves both halves from one
 * origin, which is why the bundle is looked for on disk. On a split deployment
 * such as Vercel the client is uploaded as static output and served by the CDN,
 * the bundle is not part of the function, and the static/SPA handlers below are
 * skipped. The API routes are unaffected either way.
 */
const servesClientFromDisk = fs.existsSync(clientIndexFile);

if (servesClientFromDisk) {
  /**
   * Serves the built client's real files (JS, CSS, images) before the SPA
   * fallback below gets a chance to answer. Without this the catch-all returns
   * `index.html` for asset requests too, so the browser receives HTML where it
   * expects JavaScript and the app renders blank.
   *
   * Vite emits content-hashed filenames, so these responses can be cached
   * indefinitely. `index.html` is excluded here and sent by the fallback, which
   * marks it `no-cache` so a deploy is picked up immediately.
   */
  app.use(express.static(clientDistDirectory, {
    index: false,
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }
  }));
  /**
   * Serves the built client for browser routes. Requests under `/api` are skipped
   * so unknown endpoints fall through to `notFound` and return a JSON 404 rather
   * than the HTML shell with a 200 status.
   */
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(clientIndexFile);
  });
}
app.use(notFound);
app.use(errorHandler);
