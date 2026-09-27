import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/harshit_education'),
  JWT_SECRET: z.string().min(32).default('local-development-only-change-this-secret-123456'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional()
});

export const env = schema.parse(process.env);

if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith('local-development-only')) {
  throw new Error('JWT_SECRET must be replaced in production');
}
if (env.STORAGE_PROVIDER === 's3' && (!env.STORAGE_BUCKET || !env.STORAGE_REGION)) {
  throw new Error('STORAGE_BUCKET and STORAGE_REGION are required when STORAGE_PROVIDER=s3');
}
