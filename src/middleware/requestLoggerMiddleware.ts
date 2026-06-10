/**
 * @file middleware/requestLoggerMiddleware.ts
 * @satisfies [REQ-PAT-011]
 */

import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const traceId =
    (req.headers['x-trace-id'] as string | undefined) ??
    `pat-${Date.now()}-${randomBytes(4).toString('hex')}`;

  res.locals['trace_id'] = traceId;
  res.setHeader('x-trace-id', traceId);

  const startMs = Date.now();

  logger.info('Inbound request received', {
    event: 'inbound_request',
    trace_id: traceId,
    method: req.method,
    path: req.path,
    body_size: req.headers['content-length']
      ? parseInt(req.headers['content-length'], 10)
      : 0,
    ip: req.ip,
  });

  res.on('finish', () => {
    logger.info('Response sent', {
      event: 'response_sent',
      trace_id: traceId,
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration_ms: Date.now() - startMs,
    });
  });

  next();
}
