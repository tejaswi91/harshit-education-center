import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from './app.js';
import { connectDatabase } from './config/db.js';

/**
 * Serverless entry point, used by Vercel and any other platform that invokes
 * a handler per request rather than listening on a port.
 *
 * `server.ts` opens the database connection once and holds it for the life of
 * the process. A serverless platform instead starts a Node process, serves a
 * single request, freezes the instance and may reuse it later, so the
 * connection is established on the first request that needs it and then reused
 * (see `config/db.ts`). Connecting here rather than at import time keeps the
 * module side-effect free and lets an unreachable database surface as a 503 on
 * the request that needed it instead of a crash with no response at all.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await connectDatabase();
  } catch (error) {
    console.error('Database connection failed', error);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Service temporarily unavailable' }));
    }
    return;
  }
  return app(req as never, res as never);
}