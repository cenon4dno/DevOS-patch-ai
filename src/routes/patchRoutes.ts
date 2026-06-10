/**
 * @file routes/patchRoutes.ts
 * @satisfies [REQ-PAT-009]
 */

import { Router } from 'express';
import patchController from '../controllers/patchController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post(
  '/api/v1/patch',
  (req, res, next) => patchController.createPatch(req, res, next),
);
router.get(
  '/api/v1/patches',
  (req, res, next) => patchController.listPatches(req, res, next),
);
router.get(
  '/api/v1/patches/:patch_id',
  (req, res, next) => patchController.getPatch(req, res, next),
);
router.post(
  '/api/v1/patches/:patch_id/retry',
  (req, res, next) => patchController.retryPatch(req, res, next),
);
router.delete(
  '/api/v1/patches/:patch_id/workspace',
  (req, res, next) => patchController.cleanWorkspace(req, res, next),
);

export default router;
