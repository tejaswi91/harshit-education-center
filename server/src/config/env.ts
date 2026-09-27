import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/harshit_education'),
  JWT_SECRET: z.string().min(32).default('local-development-only-change-this-secret-123456'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional()
});

export const env = schema.parse(process.env);

/**
 * Values that ship in the repository and therefore must never reach production.
 * The check covers the schema default *and* the placeholder written into
 * `.env.example`, so copying that file and setting `NODE_ENV=production` fails
 * fast instead of silently signing tokens with a publicly known secret.
 */
const INSECURE_SECRETS = [
  'local-development-only-change-this-secret-123456',
  'replace-with-a-long-random-secret-at-least-32-characters'
];
if (env.NODE_ENV === 'production' && INSECURE_SECRETS.includes(env.JWT_SECRET)) {
  throw new Error('JWT_SECRET must be replaced with a unique value before running in production');
}
if (env.STORAGE_PROVIDER === 's3' && (!env.STORAGE_BUCKET || !env.STORAGE_REGION)) {
  throw new Error('STORAGE_BUCKET and STORAGE_REGION are required when STORAGE_PROVIDER=s3');
}
