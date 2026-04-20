import winston from 'winston';

import { env } from '@/utils/env';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
  }),
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports: new winston.transports.Console({ format: logFormat }),
  exceptionHandlers: new winston.transports.Console({ format: logFormat }),
  rejectionHandlers: new winston.transports.Console({ format: logFormat }),
});
