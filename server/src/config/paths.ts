import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute paths resolved from this module's own location rather than `process.cwd()`.
 *
 * The root `dev` script runs the server via `npm run dev --workspace server`, which sets
 * the working directory to `server/`. Anything built from `process.cwd()` would therefore
 * resolve to `server/server/...` in development but the correct path in production.
 */
const here = path.dirname(fileURLToPath(import.meta.url));

/** Root of the `server` package (`server/src/config` -> `server`). */
export const serverRoot = path.resolve(here, '../..');

/** Repository root, used to serve the built client bundle. */
export const repoRoot = path.resolve(serverRoot, '..');

/** Directory for locally stored material and thumbnail files. */
export const uploadDirectory = path.join(serverRoot, 'uploads');

/** Entry point of the built client, served as an SPA fallback. */
export const clientIndexFile = path.join(repoRoot, 'client', 'dist', 'index.html');