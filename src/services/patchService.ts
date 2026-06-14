/**
 * @file services/patchService.ts
 * @satisfies [REQ-PAT-003], [REQ-PAT-004], [REQ-PAT-005], [REQ-PAT-006], [REQ-PAT-007], [REQ-PAT-008]
 * Orchestrates the full 10-step patch workflow asynchronously.
 */

import { PatchInputData } from '../schemas/patchSchema';
import {
  createPatch,
  updatePatchStatus,
  savePatchFiles,
  getPatchFiles,
} from '../repositories/patchRepository';
import { cloneOrPull, createBranch, commitAndPush, getBranchName } from './gitService';
import { buildChangePlan } from './changePlanService';
import { applyChangePlan } from './implementationService';
import { runTests } from './testRunnerService';
import { createPullRequest } from './githubService';
import { PatchProgressReporter } from './progressReporterService';
import { PatchResult, PatchFile, TestResult } from '../types';
import logger from '../utils/logger';

const TRACE_PREFIX = 'patch-svc';

export async function submitPatch(input: PatchInputData): Promise<void> {
  await createPatch(input);
}

export async function executePatch(input: PatchInputData): Promise<void> {
  const { patch_id } = input;
  const traceId = `${TRACE_PREFIX}-${patch_id}-${Date.now()}`;
  const targetAgent = input.target_agent.name;
  const progress = new PatchProgressReporter(patch_id, targetAgent);

  logger.info('Patch execution started', { trace_id: traceId, patch_id, type: input.assignment.type });

  // Confirm receipt immediately before any async work begins
  await progress.report('RECEIVE', `Assignment ${patch_id} accepted — queuing patch pipeline`);

  let localPath = '';
  let branchName = '';
  let patchFiles: PatchFile[] = [];
  let testResult: TestResult | null = null;

  try {
    // Step 2-3: Clone + branch
    await updatePatchStatus(patch_id, 'analyzing');
    await progress.report('CLONE', `Cloning ${input.target_agent.github_repo}`);
    localPath = await cloneOrPull(input.target_agent.github_repo, patch_id, traceId);

    await progress.report('BRANCH', `Creating feature branch for ${patch_id}`);
    branchName = getBranchName(patch_id, input.assignment.title);
    await createBranch(localPath, branchName, traceId, patch_id);
    await updatePatchStatus(patch_id, 'analyzing', { branch_name: branchName });

    // Step 4: Change plan
    await progress.report('ANALYZE', `Requesting change plan from Bridge Agent for ${patch_id}`);
    const changePlan = await buildChangePlan(input, localPath, traceId);

    if (changePlan.files.length === 0) {
      throw new Error(`PATCH_MISSING_INFO: Change plan returned no files for ${patch_id}`);
    }

    // Step 5: Implement
    await updatePatchStatus(patch_id, 'implementing');
    await progress.report('IMPLEMENT', `Implementing ${changePlan.files.length} file(s) for ${patch_id}`);
    patchFiles = await applyChangePlan(localPath, changePlan.files, patch_id, traceId);
    await savePatchFiles(patchFiles);

    // Step 6: Test
    await updatePatchStatus(patch_id, 'testing');
    await progress.report('VERIFY', `Running test suite on patched ${targetAgent}`);
    testResult = await runTests(localPath, patch_id, traceId);

    if (!testResult.passed) {
      throw new Error(
        `PATCH_TEST_FAILURE: ${testResult.failed} test(s) failed — ${testResult.output_summary}`,
      );
    }

    // Step 7-8: Commit + push
    await progress.report('COMMIT', `Committing ${patchFiles.length} changed file(s)`);
    const commitMsg = buildCommitMessage(input, patchFiles);
    await commitAndPush(localPath, branchName, commitMsg, traceId, patch_id);
    await progress.report('PUSH', `Pushing branch ${branchName} to remote`);

    // Step 9: Create PR
    await progress.report('PR', `Creating Pull Request on ${input.target_agent.github_repo}`);
    const pr = await createPullRequest(input, branchName, patchFiles, testResult, traceId);
    await updatePatchStatus(patch_id, 'pr_created', {
      pr_url: pr.url,
      pr_number: pr.number,
    });

    // Step 10: Complete
    await updatePatchStatus(patch_id, 'completed');
    await progress.report('COMPLETE', `${patch_id} complete — PR #${pr.number} opened on ${input.target_agent.github_repo}`, pr.url);
    logger.info('Patch execution completed', {
      trace_id: traceId,
      patch_id,
      pr_url: pr.url,
      files_changed: patchFiles.length,
    });
  } catch (err: unknown) {
    const error = err as Error;
    const isClarification = error.message.startsWith('PATCH_MISSING_INFO');

    logger.error('Patch execution failed', {
      trace_id: traceId,
      patch_id,
      error: error.message,
    });

    await progress.report('FAILED', `${patch_id} failed — ${error.message}`);
    await updatePatchStatus(patch_id, isClarification ? 'clarification_required' : 'failed', {
      error_message: error.message,
    });
  }
}

export async function buildPatchResult(patchId: string): Promise<PatchResult | null> {
  const { getPatch } = await import('../repositories/patchRepository');
  const record = await getPatch(patchId);
  if (!record) return null;

  const files = await getPatchFiles(patchId);
  const modified = files.filter((f) => f.action === 'modified').map((f) => f.file_path);
  const added    = files.filter((f) => f.action === 'added').map((f) => f.file_path);
  const deleted  = files.filter((f) => f.action === 'deleted').map((f) => f.file_path);
  const linesAdded   = files.reduce((s, f) => s + f.lines_added, 0);
  const linesRemoved = files.reduce((s, f) => s + f.lines_removed, 0);

  return {
    patch_id: record.patch_id,
    status: record.status,
    pull_request: record.pr_url
      ? {
          url: record.pr_url,
          number: record.pr_number!,
          branch: record.branch_name!,
          title: `[${record.patch_id}] ${record.type}: ${record.title}`,
          created_at: record.updated_at,
        }
      : null,
    changes: { files_modified: modified, files_added: added, files_deleted: deleted, lines_added: linesAdded, lines_removed: linesRemoved },
    test_result: null,
    traceability: [],
    completed_at: record.updated_at,
  };
}

function buildCommitMessage(input: PatchInputData, files: PatchFile[]): string {
  const bullets = files
    .map((f) => `- ${f.action} ${f.file_path}`)
    .join('\n');
  return `patch(${input.patch_id}): ${input.assignment.title}\n\n${bullets}\n\nCloses: ${input.patch_id}`;
}
