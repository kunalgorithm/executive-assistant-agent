import cors from 'cors';
import helmet from 'helmet';
import express from 'express';

import { db } from '@/utils/db';
import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';
import { globalLimiter } from '@/utils/rateLimit';
import { globalErrorHandlerMiddleware } from '@/utils/error';

import { adminRouter } from '@/modules/admin';
import { startCronJobs } from '@/modules/cron';
import { messagingRouter } from '@/modules/messaging';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    credentials: true,
    origin: env.CLIENT_URL.split(',').map((url) => url.trim()),
    preflightContinue: false,
    optionsSuccessStatus: statusCodes.NO_CONTENT,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(globalLimiter);

app.get('/', (_req, res) => {
  res.status(statusCodes.OK).json({ message: 'API is running' });
});

app.use('/api/messaging', messagingRouter);
app.use('/api/admin', adminRouter);

app.use(globalErrorHandlerMiddleware);

async function startServer() {
  try {
    await db.$connect();
    await db.$executeRaw`SELECT 1`;

    logger.info('Database connected');
    startCronJobs();

    app.listen(env.PORT, () => {
      logger.info(`Server running on port: ${env.PORT}`);
    });
  } catch (error) {
    await db.$disconnect().catch(() => {});
    logger.error(`Error starting server: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

startServer();
