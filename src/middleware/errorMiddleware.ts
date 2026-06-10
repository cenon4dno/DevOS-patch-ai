/**
 * @file middleware/errorMiddleware.ts
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error('Request error', {
    method: req.method,
    path: req.path,
    message: err.message,
    stack: err.stack,
  });

  if (!res.headersSent) {
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    });
  }
}

export function notFoundMiddleware(req: Request, res: Response, _next: NextFunction): void {
  logger.warn('Route not found', { method: req.method, path: req.path });
  res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Route not found' });
}
