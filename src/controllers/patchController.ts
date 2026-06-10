/**
 * @file controllers/patchController.ts
 * @satisfies [REQ-PAT-001], [REQ-PAT-009]
 */

import { Request, Response, NextFunction } from 'express';
import { PatchInputSchema } from '../schemas/patchSchema';
import { submitPatch, executePatch, buildPatchResult } from '../services/patchService';
import { getPatch, listPatches } from '../repositories/patchRepository';
import { cleanWorkspace } from '../services/gitService';
import logger from '../utils/logger';

export class PatchController {
  async createPatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const traceId = (res.locals['trace_id'] as string | undefined) ?? 'unknown';
      const parsed = PatchInputSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Invalid patch payload',
          details: parsed.error.flatten(),
        });
        return;
      }

      const input = parsed.data;

      // Check for duplicate
      const existing = await getPatch(input.patch_id);
      if (existing) {
        res.status(409).json({
          status: 'error',
          code: 'DUPLICATE_PATCH_ID',
          message: `Patch ${input.patch_id} already exists with status: ${existing.status}`,
        });
        return;
      }

      await submitPatch(input);

      logger.info('Patch accepted', {
        trace_id: traceId,
        patch_id: input.patch_id,
        target_agent: input.target_agent.name,
        type: input.assignment.type,
      });

      res.status(202).json({
        status: 'accepted',
        patch_id: input.patch_id,
        message: `Patch ${input.patch_id} accepted — Pippin is on the case.`,
      });

      // Run asynchronously after responding
      setImmediate(() => {
        executePatch(input).catch((err: Error) => {
          logger.error('Unexpected patch execution error', {
            patch_id: input.patch_id,
            error: err.message,
          });
        });
      });
    } catch (err) {
      next(err);
    }
  }

  async listPatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patches = await listPatches();
      res.status(200).json({ status: 'success', data: patches });
    } catch (err) {
      next(err);
    }
  }

  async getPatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patch_id } = req.params as { patch_id: string };
      const result = await buildPatchResult(patch_id);

      if (!result) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: `Patch ${patch_id} not found`,
        });
        return;
      }

      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async retryPatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patch_id } = req.params as { patch_id: string };
      const record = await getPatch(patch_id);

      if (!record) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: `Patch ${patch_id} not found` });
        return;
      }

      if (record.status !== 'failed' && record.status !== 'clarification_required') {
        res.status(409).json({
          status: 'error',
          code: 'INVALID_STATE',
          message: `Patch ${patch_id} is in status '${record.status}' and cannot be retried`,
        });
        return;
      }

      // Rebuild input from DB — only retries if original body is re-supplied
      res.status(400).json({
        status: 'error',
        code: 'RETRY_REQUIRES_BODY',
        message: 'Re-submit the full patch payload to POST /api/v1/patch with the same patch_id to retry.',
      });
    } catch (err) {
      next(err);
    }
  }

  async cleanWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patch_id } = req.params as { patch_id: string };
      const record = await getPatch(patch_id);

      if (!record) {
        res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: `Patch ${patch_id} not found` });
        return;
      }

      cleanWorkspace(patch_id);
      res.status(200).json({ status: 'success', message: `Workspace for ${patch_id} cleaned.` });
    } catch (err) {
      next(err);
    }
  }
}

export default new PatchController();
