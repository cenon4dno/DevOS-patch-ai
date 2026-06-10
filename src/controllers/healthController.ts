/**
 * @file controllers/healthController.ts
 * @satisfies [REQ-PAT-010]
 */

import { Request, Response } from 'express';
import fetch from 'node-fetch';
import db from '../database/sqlite';
import logger from '../utils/logger';
import { HealthStatus } from '../types';

const START_TIME = Date.now();
const VERSION = '1.0.0';

const PERSONA_UP =
  "I've got my assignment and the workspace is ready. Tell me what needs fixing and I'll have a PR open before supper.";
const PERSONA_DOWN =
  "I can't get to work — the workspace or database isn't responding. Check port 3014 and try again.";

export class HealthController {
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const uptime_seconds = Math.floor((Date.now() - START_TIME) / 1000);
      const deep = req.query['deep'] === 'true';

      if (deep) {
        const services: HealthStatus['services'] = {};
        let allUp = true;

        try {
          await db.get('SELECT 1');
          services.database = 'CONNECTED';
        } catch {
          services.database = 'DISCONNECTED';
          allUp = false;
        }

        const bridgeUrl = process.env.BRIDGE_AGENT_URL ?? 'http://localhost:3005';
        try {
          const r = await fetch(`${bridgeUrl}/health`, { signal: AbortSignal.timeout(3000) });
          services.bridge_agent = r.ok ? 'REACHABLE' : 'DEGRADED';
          if (!r.ok) allUp = false;
        } catch {
          services.bridge_agent = 'UNREACHABLE';
          allUp = false;
        }

        const status: HealthStatus = {
          status: allUp ? 'UP' : 'DOWN',
          timestamp: new Date().toISOString(),
          version: VERSION,
          uptime_seconds,
          character: 'Pippin',
          persona_message: allUp ? PERSONA_UP : PERSONA_DOWN,
          services,
        };
        res.status(allUp ? 200 : 503).json(status);
      } else {
        const status: HealthStatus = {
          status: 'UP',
          timestamp: new Date().toISOString(),
          version: VERSION,
          uptime_seconds,
          character: 'Pippin',
          persona_message: PERSONA_UP,
        };
        res.status(200).json(status);
      }
    } catch (error) {
      logger.error('Health check error', { error });
      const status: HealthStatus = {
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        version: VERSION,
        character: 'Pippin',
        persona_message: PERSONA_DOWN,
      };
      res.status(503).json(status);
    }
  }
}

export default new HealthController();
