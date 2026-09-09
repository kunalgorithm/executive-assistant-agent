import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
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

    MESSAGING_PROVIDER: z.enum(['sendblue', 'linq']).default('sendblue'),

    // Only the selected messaging provider needs credentials.
    SENDBLUE_API_KEY: z.string().default(''),
    SENDBLUE_SECRET: z.string().default(''),
    SENDBLUE_FROM_NUMBER: z.string().default(''),
    SENDBLUE_WEBHOOK_BASE_URL: z.string().default(''),
    SENDBLUE_WEBHOOK_SECRET: z.string().default(''),
    LINQ_API_KEY: z.string().default(''),
    LINQ_FROM_NUMBER: z.string().default(''),
    LINQ_WEBHOOK_SECRET: z.string().default(''),

    // Google OAuth (Calendar + Gmail) — planned for MVP tool layer
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),

    // Microsoft OAuth / Graph (Outlook Mail, Calendar, People, To Do)
    MICROSOFT_CLIENT_ID: z.string().optional(),
    MICROSOFT_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_REDIRECT_URI: z.string().optional(),

    // Google Places API (New) — server-side key for restaurant search
    GOOGLE_MAPS_API_KEY: z.string().optional(),

    // Single-owner lock: only this number is allowed to talk to the agent.
    OWNER_PHONE_NUMBER: z.string().optional(),

    JWT_SECRET: z.string().min(32),
  })
  .superRefine((values, ctx) => {
    const required =
      values.MESSAGING_PROVIDER === 'linq'
        ? (['LINQ_API_KEY', 'LINQ_FROM_NUMBER', 'LINQ_WEBHOOK_SECRET'] as const)
        : ([
            'SENDBLUE_API_KEY',
            'SENDBLUE_SECRET',
            'SENDBLUE_FROM_NUMBER',
            'SENDBLUE_WEBHOOK_BASE_URL',
            'SENDBLUE_WEBHOOK_SECRET',
          ] as const);
    for (const key of required) {
      if (!values[key].trim())
        ctx.addIssue({ code: 'custom', path: [key], message: `Required for ${values.MESSAGING_PROVIDER}` });
    }
    if (values.MESSAGING_PROVIDER === 'linq' && !/^\+[1-9]\d{7,14}$/.test(values.LINQ_FROM_NUMBER)) {
      ctx.addIssue({ code: 'custom', path: ['LINQ_FROM_NUMBER'], message: 'Must be a phone number in E.164 format' });
    }
  });

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
