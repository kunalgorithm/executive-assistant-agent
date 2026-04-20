import { PrismaPg } from '@prisma/adapter-pg';

import { env, isProduction } from '@/utils/env';
import { PrismaClient } from '@/generated/prisma/client';

const adapter = new PrismaPg({
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionString: env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

export const db = new PrismaClient({
  adapter,
  log: env.DEBUG ? ['query', 'info', 'warn', 'error'] : [],
});
