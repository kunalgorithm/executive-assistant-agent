import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.url(),
  NODE_ENV: z.enum(['development', 'production', 'staging']).default('development'),
  DEBUG: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
  PORT: z
    .string()
    .default('8000')
    .transform((val) => parseInt(val, 10)),
  CLIENT_URL: z.url(),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),

  GEMINI_API_KEY: z.string(),

  // SendBlue (for iMessage messaging)
  SENDBLUE_API_KEY: z.string(),
  SENDBLUE_SECRET: z.string(),
  SENDBLUE_FROM_NUMBER: z.string(),
  SENDBLUE_WEBHOOK_BASE_URL: z.string(),
  SENDBLUE_WEBHOOK_SECRET: z.string(),

  JWT_SECRET: z.string().min(32),

  SEED_DEMO_USER_PASSWORD: z.string().optional(), // required only in Development

  HF_CACHE_DIR: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
