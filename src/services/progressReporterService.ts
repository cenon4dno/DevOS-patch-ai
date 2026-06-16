/**
 * @file services/progressReporterService.ts
 * @satisfies [REQ-PAT-012]
 * @description Sends step-by-step lifecycle updates to Celebrimbor (App Generator Agent)
 *              while executing a patch assignment. Maps each workflow step to a
 *              request_status (received | processing | complete | failed) so Celebrimbor's
 *              Pipeline Status tab can display a simple three-state lifecycle.
 *              Fire-and-forget — a failed POST never blocks patch execution.
 */

import logger from '../utils/logger';

export type PatchProgressStep =
  | 'RECEIVE'
  | 'CLONE'
  | 'BRANCH'
  | 'ANALYZE'
  | 'IMPLEMENT'
  | 'VERIFY'
  | 'COMMIT'
  | 'PUSH'
  | 'PR'
  | 'COMPLETE'
  | 'FAILED';

export type RequestStatus = 'received' | 'processing' | 'complete' | 'failed';

export interface PatchProgressPayload {
  patch_id: string;
  agent: 'patch-agent';
  character: 'Pippin';
  step: PatchProgressStep;
  step_index: number;
  step_total: number;
  message: string;
  request_status: RequestStatus;
  target_agent: string;
  pr_url: string | null;
  timestamp: string;
}

const STEP_TOTAL = 9;
const STEP_INDEX: Record<PatchProgressStep, number> = {
  RECEIVE:   1,
  CLONE:     2,
  BRANCH:    3,
  ANALYZE:   4,
  IMPLEMENT: 5,
  VERIFY:    6,
  COMMIT:    7,
  PUSH:      8,
  PR:        9,
  COMPLETE:  9,
  FAILED:    9,
};

function deriveRequestStatus(step: PatchProgressStep): RequestStatus {
  if (step === 'RECEIVE') return 'received';
  if (step === 'COMPLETE' || step === 'PR') return 'complete';
  if (step === 'FAILED') return 'failed';
  return 'processing';
}

export class PatchProgressReporter {
  private readonly celebrimborUrl: string;
  private readonly apiToken: string;
  private readonly patchId: string;
  private readonly targetAgent: string;

  constructor(patchId: string, targetAgent: string) {
    this.celebrimborUrl =
      process.env['APP_GENERATOR_AGENT_URL'] ?? 'http://localhost:3003';
    this.apiToken = process.env['APP_GENERATOR_API_TOKEN'] ?? '';
    this.patchId = patchId;
    this.targetAgent = targetAgent;
  }

  async report(step: PatchProgressStep, message: string, prUrl: string | null = null): Promise<void> {
    const payload: PatchProgressPayload = {
      patch_id: this.patchId,
      agent: 'patch-agent',
      character: 'Pippin',
      step,
      step_index: STEP_INDEX[step],
      step_total: STEP_TOTAL,
      message,
      request_status: deriveRequestStatus(step),
      target_agent: this.targetAgent,
      pr_url: prUrl,
      timestamp: new Date().toISOString(),
    };

    logger.debug('Reporting patch progress to Celebrimbor', {
      event: 'patch_progress_report',
      patch_id: this.patchId,
      step,
      request_status: payload.request_status,
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);

      await fetch(`${this.celebrimborUrl}/api/v1/patches/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-token': this.apiToken,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);
    } catch (err) {
      logger.warn('Patch progress report to Celebrimbor failed — continuing execution', {
        event: 'patch_progress_report_failed',
        patch_id: this.patchId,
        step,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
