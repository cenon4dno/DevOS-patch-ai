/**
 * @file utils/logger.ts
 * @satisfies [REQ-PAT-011]
 */

import winston from 'winston';
import fs from 'node:fs';

const logDir = 'logs';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const { combine, timestamp, errors, json } = winston.format;

const logger = winston.createLogger({
  level: (process.env['LOG_LEVEL'] as string | undefined) ?? 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    json(),
  ),
  defaultMeta: { agent: 'patch-agent', service: 'devos-patch-agent' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: `${logDir}/patch-agent.log` }),
  ],
});

export default logger;
