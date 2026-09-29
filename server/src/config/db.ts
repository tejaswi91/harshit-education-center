import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * The connection is cached on `globalThis` rather than in module scope.
 *
 * A serverless runtime reuses one instance for many requests, and a module
 * variable would be re-initialised whenever the module graph is re-evaluated.
 * `globalThis` survives that, so every invocation in the same instance reuses
 * the one open connection instead of opening a new one per request and
 * exhausting the provider's connection limit.
 */
const cache = globalThis as typeof globalThis & { __hecMongoConnection?: Promise<typeof mongoose> };

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  if (mongoose.connection.readyState === 1) return;

  if (!cache.__hecMongoConnection) {
    cache.__hecMongoConnection = mongoose
      .connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10_000,
        // Serverless instances each hold their own pool, so the default of 100
        // would allow a single instance to monopolise the provider's limit.
        maxPoolSize: env.MONGODB_MAX_POOL_SIZE
      })
      .catch((error) => {
        // A rejected attempt must not be cached, or every later request in this
        // instance would fail with the same stale error and never reconnect.
        cache.__hecMongoConnection = undefined;
        throw error;
      });
  }

  await cache.__hecMongoConnection;
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}

export async function disconnectDatabase() {
  cache.__hecMongoConnection = undefined;
  await mongoose.disconnect();
}
