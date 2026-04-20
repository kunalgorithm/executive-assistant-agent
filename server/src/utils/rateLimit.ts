import rateLimit from 'express-rate-limit';

import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';

/**
 * Express rate limit works totally in-memory using a simple Map
 * This is fine for single instance deployment, but it will fail when we scale horizontally
 *
 * TODO: Remember this when scaling
 */

const ONE_MINUTE_MS = 60 * 1000;

export const globalLimiter = rateLimit({
  max: 100,
  windowMs: ONE_MINUTE_MS,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  message: { data: null, errors: { rateLimit: 'Too many requests, please try again later' } },
  handler: (req, res, _next, options) => {
    logger.warn('[rate-limit] Global limit exceeded', { ip: req.ip, path: req.path });
    res.status(options.statusCode).json(options.message);
  },
});

export const adminLimiter = rateLimit({
  max: 30,
  windowMs: ONE_MINUTE_MS,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  message: { data: null, errors: { rateLimit: 'Too many admin requests' } },
  handler: (req, res, _next, options) => {
    logger.warn('[rate-limit] Admin limit exceeded', { ip: req.ip, path: req.path });
    res.status(options.statusCode).json(options.message);
  },
});

export const adminHeavyLimiter = rateLimit({
  max: 5,
  windowMs: ONE_MINUTE_MS,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  message: { data: null, errors: { rateLimit: 'Too many requests for this operation, please slow down' } },
  handler: (req, res, _next, options) => {
    logger.warn('[rate-limit] Heavy admin limit exceeded', { ip: req.ip, path: req.path });
    res.status(options.statusCode).json(options.message);
  },
});
