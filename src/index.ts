/**
 * @file index.ts
 * @satisfies [REQ-PAT-009], [REQ-PAT-010]
 * Pippin — Patch Agent entry point. Port 3014.
 */

import 'dotenv/config';
import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import db from './database/sqlite';
import healthRoutes from './routes/healthRoutes';
import patchRoutes from './routes/patchRoutes';
import { errorMiddleware, notFoundMiddleware } from './middleware/errorMiddleware';
import { requestLogger } from './middleware/requestLoggerMiddleware';
import logger from './utils/logger';

const PORT = process.env.PORT || 3014;
const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

app.use(healthRoutes);
app.use(patchRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

async function start(): Promise<void> {
  try {
    await db.initialize();
    logger.info('Database initialized');

    app.listen(PORT, () => {
      logger.info(`Pippin Patch Agent listening on port ${PORT}`);
      logger.info('Health:   GET  /health');
      logger.info('Patch:    POST /api/v1/patch');
      logger.info('Patches:  GET  /api/v1/patches');
      logger.info('Status:   GET  /api/v1/patches/:patch_id');
    });
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

start();
