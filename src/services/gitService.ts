/**
 * @file services/gitService.ts
 * @satisfies [REQ-PAT-003]
 * Handles cloning, branching, committing, and pushing to the target agent repo.
 */

import * as path from 'path';
import * as fs from 'fs';
import simpleGit, { SimpleGit } from 'simple-git';
import logger from '../utils/logger';

const WORKSPACE_ROOT = process.env.WORKSPACE_PATH ?? path.join(process.cwd(), 'workspace');

export function workspacePath(patchId: string): string {
  return path.join(WORKSPACE_ROOT, patchId);
}

export async function cloneOrPull(
  githubRepo: string,
  patchId: string,
  traceId: string,
): Promise<string> {
  const localPath = workspacePath(patchId);
  const repoUrl = `https://github.com/${githubRepo}.git`;

  if (fs.existsSync(path.join(localPath, '.git'))) {
    logger.info('Step started', { trace_id: traceId, step: 'GIT_PULL', patch_id: patchId });
    const git: SimpleGit = simpleGit(localPath);
    await git.checkout('main').catch(() => git.checkout('master'));
    await git.pull();
    logger.info('Step complete', { trace_id: traceId, step: 'GIT_PULL', patch_id: patchId });
  } else {
    logger.info('Step started', { trace_id: traceId, step: 'GIT_CLONE', patch_id: patchId, repo: repoUrl });
    fs.mkdirSync(localPath, { recursive: true });

    const token = process.env.GITHUB_TOKEN;
    const authenticatedUrl = token
      ? repoUrl.replace('https://', `https://${token}@`)
      : repoUrl;

    const git: SimpleGit = simpleGit();
    await git.clone(authenticatedUrl, localPath);
    logger.info('Step complete', { trace_id: traceId, step: 'GIT_CLONE', patch_id: patchId });
  }

  return localPath;
}

export async function createBranch(
  localPath: string,
  branchName: string,
  traceId: string,
  patchId: string,
): Promise<void> {
  logger.info('Step started', { trace_id: traceId, step: 'GIT_BRANCH', patch_id: patchId, branch: branchName });
  const git: SimpleGit = simpleGit(localPath);
  await git.checkoutLocalBranch(branchName);
  logger.info('Step complete', { trace_id: traceId, step: 'GIT_BRANCH', patch_id: patchId });
}

export async function commitAndPush(
  localPath: string,
  branchName: string,
  commitMessage: string,
  traceId: string,
  patchId: string,
): Promise<void> {
  logger.info('Step started', { trace_id: traceId, step: 'GIT_COMMIT', patch_id: patchId });
  const git: SimpleGit = simpleGit(localPath);

  await git.add('.');

  const status = await git.status();
  if (status.staged.length === 0 && status.modified.length === 0) {
    logger.warn('No changes to commit', { trace_id: traceId, patch_id: patchId });
    return;
  }

  await git.commit(commitMessage);
  logger.info('Step complete', { trace_id: traceId, step: 'GIT_COMMIT', patch_id: patchId });

  logger.info('Step started', { trace_id: traceId, step: 'GIT_PUSH', patch_id: patchId, branch: branchName });
  await git.push('origin', branchName, ['--set-upstream']);
  logger.info('Step complete', { trace_id: traceId, step: 'GIT_PUSH', patch_id: patchId });
}

export function readFileFromWorkspace(localPath: string, filePath: string): string | null {
  const fullPath = path.join(localPath, filePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf-8');
}

export function writeFileToWorkspace(
  localPath: string,
  filePath: string,
  content: string,
): void {
  const fullPath = path.join(localPath, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

export function deleteFileFromWorkspace(localPath: string, filePath: string): void {
  const fullPath = path.join(localPath, filePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

export function cleanWorkspace(patchId: string): void {
  const localPath = workspacePath(patchId);
  if (fs.existsSync(localPath)) {
    fs.rmSync(localPath, { recursive: true, force: true });
  }
}

export function getBranchName(patchId: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `patch/${patchId}-${slug}`;
}
