/**
 * Vercel serverless function entry.
 *
 * Vercel treats every file in `api/` as a function whose path mirrors the
 * request URL, so this single catch-all file answers `/api/*`. It re-exports the
 * handler from the server package instead of duplicating the app wiring, so
 * the function and `npm start` always run the same code.
 */
export { default } from '../server/dist/vercel.js';