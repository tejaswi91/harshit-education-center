import type { Server } from 'node:http';
import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';

/** How long in-flight requests get to finish after a shutdown signal. */
const SHUTDOWN_GRACE_MS = 10_000;

let server: Server | undefined;
let shuttingDown = false;

async function start() {
  await connectDatabase();
  server = app.listen(env.PORT, () => console.log(`Harshit Education Center API listening on ${env.PORT}`));
  /**
   * Keep the idle window slightly longer than the 60s an upstream load balancer
   * typically waits, so the proxy closes idle connections first and a rolling
   * deploy never races an in-flight request.
   */
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

/**
 * Stops accepting connections, lets in-flight requests finish, then closes the
 * database. Orchestrators send SIGTERM on every deploy and restart, so without
 * this the process would drop live requests mid-response.
 */
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, draining connections`);

  // Never hang forever: if a request refuses to finish, give up and let the
  // supervisor restart us. `unref` keeps this timer from holding the loop open.
  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  forceExit.unref();

  try {
    if (server) await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
    await disconnectDatabase();
    clearTimeout(forceExit);
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// An unhandled rejection leaves the process in an unknown state; exiting lets
// the supervisor start a clean one instead of serving from a corrupted heap.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection', reason);
  void shutdown('unhandledRejection');
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception', error);
  void shutdown('uncaughtException');
});

start().catch((error) => { console.error('Unable to start server', error); process.exit(1); });
