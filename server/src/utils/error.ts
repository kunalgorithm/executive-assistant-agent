import { z } from 'zod';
import type { Request, Response, NextFunction, Handler } from 'express';

import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';

export function asyncRoute(handlerFunction: Handler) {
  return function (req: Request, res: Response, next: NextFunction) {
    Promise.resolve(handlerFunction(req, res, next)).catch(next);
  };
}

export function globalErrorHandlerMiddleware(err: Error, req: Request, res: Response, __: NextFunction) {
  logger.error('GLOBAL_ERROR', {
    request: { method: req.method },
    ...('message' in err ? { message: err.message } : {}),
    ...('stack' in err ? { stack: err.stack } : {}),
  });

  res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
    data: null,
    errors: {
      message: env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message || 'Internal Server Error',
    },
  });
}

export function getZodErrors<T>(zodSchema: z.ZodType<T>, data: unknown) {
  const res = zodSchema.safeParse(data);
  if (res.success) return { errors: null, data: res.data };

  const errors = res.error.issues.reduce((acc, error) => ({ ...acc, [error.path[0] as string]: error.message }), {});

  return { errors, data: null };
}
