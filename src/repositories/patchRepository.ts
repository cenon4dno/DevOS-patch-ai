/**
 * @file repositories/patchRepository.ts
 * @satisfies [REQ-PAT-002]
 */

import db from '../database/sqlite';
import { PatchRecord, PatchStatus, PatchFile } from '../types';
import { PatchInputData } from '../schemas/patchSchema';

export async function createPatch(input: PatchInputData): Promise<PatchRecord> {
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO patches
      (patch_id, target_agent, github_repo, type, title, description,
       status, priority, reported_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    [
      input.patch_id,
      input.target_agent.name,
      input.target_agent.github_repo,
      input.assignment.type,
      input.assignment.title,
      input.assignment.description,
      input.context.priority,
      input.context.reported_by,
      now,
      now,
    ],
  );

  return getPatch(input.patch_id) as Promise<PatchRecord>;
}

export async function getPatch(patchId: string): Promise<PatchRecord | null> {
  const row = await db.get('SELECT * FROM patches WHERE patch_id = ?', [patchId]);
  return row ?? null;
}

export async function listPatches(): Promise<PatchRecord[]> {
  return db.all('SELECT * FROM patches ORDER BY created_at DESC');
}

export async function updatePatchStatus(
  patchId: string,
  status: PatchStatus,
  extra: Partial<Pick<PatchRecord, 'branch_name' | 'pr_url' | 'pr_number' | 'error_message'>> = {},
): Promise<void> {
  const fields: string[] = ['status = ?', 'updated_at = ?'];
  const params: unknown[] = [status, new Date().toISOString()];

  if (extra.branch_name !== undefined) { fields.push('branch_name = ?'); params.push(extra.branch_name); }
  if (extra.pr_url !== undefined)      { fields.push('pr_url = ?');      params.push(extra.pr_url); }
  if (extra.pr_number !== undefined)   { fields.push('pr_number = ?');   params.push(extra.pr_number); }
  if (extra.error_message !== undefined) { fields.push('error_message = ?'); params.push(extra.error_message); }

  params.push(patchId);
  await db.run(`UPDATE patches SET ${fields.join(', ')} WHERE patch_id = ?`, params);
}

export async function savePatchFiles(files: PatchFile[]): Promise<void> {
  for (const f of files) {
    await db.run(
      'INSERT INTO patch_files (patch_id, file_path, action, lines_added, lines_removed) VALUES (?, ?, ?, ?, ?)',
      [f.patch_id, f.file_path, f.action, f.lines_added, f.lines_removed],
    );
  }
}

export async function getPatchFiles(patchId: string): Promise<PatchFile[]> {
  return db.all('SELECT * FROM patch_files WHERE patch_id = ?', [patchId]);
}
