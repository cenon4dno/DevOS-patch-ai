/**
 * @file services/testRunnerService.ts
 * @satisfies [REQ-PAT-006]
 * Runs the test suite in the cloned repo and captures the result.
 */

import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { TestResult } from '../types';
import logger from '../utils/logger';

const execAsync = promisify(exec);

export async function runTests(
  localPath: string,
  patchId: string,
  traceId: string,
): Promise<TestResult> {
  logger.info('Step started', { trace_id: traceId, step: 'VERIFY', patch_id: patchId });

  const pkgPath = path.join(localPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    logger.warn('No package.json found — skipping tests', { trace_id: traceId, patch_id: patchId });
    return { passed: true, total: 0, failed: 0, output_summary: 'No test suite found — skipped' };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
  const testScript = pkg.scripts?.['test'] ?? '';

  if (!testScript || testScript.includes('no test specified')) {
    logger.warn('No test script defined — skipping tests', { trace_id: traceId, patch_id: patchId });
    return { passed: true, total: 0, failed: 0, output_summary: 'No test script defined — skipped' };
  }

  try {
    const { stdout, stderr } = await execAsync('npm test', {
      cwd: localPath,
      timeout: 120_000,
    });

    const output = (stdout + stderr).slice(-2000);
    const result = parseTestOutput(output);

    logger.info('Step complete', {
      trace_id: traceId,
      step: 'VERIFY',
      patch_id: patchId,
      passed: result.passed,
      total: result.total,
      failed: result.failed,
    });

    return result;
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const output = ((error.stdout ?? '') + (error.stderr ?? '')).slice(-2000);
    const result = parseTestOutput(output);

    logger.error('Test suite failed', {
      trace_id: traceId,
      step: 'VERIFY',
      patch_id: patchId,
      error: error.message,
    });

    return { ...result, passed: false };
  }
}

function parseTestOutput(output: string): TestResult {
  // Vitest: "Tests  X passed (Y)" or "X failed | Y passed"
  const vitestMatch = output.match(/(\d+)\s+passed/);
  const vitestFail = output.match(/(\d+)\s+failed/);

  if (vitestMatch) {
    const passed = parseInt(vitestMatch[1], 10);
    const failed = vitestFail ? parseInt(vitestFail[1], 10) : 0;
    return {
      passed: failed === 0,
      total: passed + failed,
      failed,
      output_summary: output.split('\n').slice(-5).join(' ').trim(),
    };
  }

  // Jest/generic: "Tests: X passed, Y total"
  const jestMatch = output.match(/Tests:\s+(\d+)\s+passed.*?(\d+)\s+total/);
  if (jestMatch) {
    const passed = parseInt(jestMatch[1], 10);
    const total = parseInt(jestMatch[2], 10);
    return {
      passed: passed === total,
      total,
      failed: total - passed,
      output_summary: output.split('\n').slice(-5).join(' ').trim(),
    };
  }

  const hasFail = /fail|error/i.test(output);
  return {
    passed: !hasFail,
    total: 0,
    failed: hasFail ? 1 : 0,
    output_summary: output.split('\n').slice(-5).join(' ').trim(),
  };
}
