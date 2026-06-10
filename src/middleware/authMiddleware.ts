/**
 * @file middleware/authMiddleware.ts
 * @satisfies [REQ-PAT-009]
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      authenticated?: boolean;
    }
  }
}

const API_TOKEN = process.env.API_TOKEN || 'pippin-patch-token';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-api-token'];

  if (!token || token !== API_TOKEN) {
    logger.warn('Unauthorized access attempt', {
      path: req.path,
      token: token ? '***' : 'missing',
    });
    res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid x-api-token',
    });
    return;
  }

  req.authenticated = true;
  next();
}
