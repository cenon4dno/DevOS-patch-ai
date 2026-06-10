/**
 * @file routes/healthRoutes.ts
 * @satisfies [REQ-PAT-010]
 */

import { Router } from 'express';
import healthController from '../controllers/healthController';

const router = Router();

router.get('/health', (req, res) => healthController.getHealth(req, res));

export default router;
