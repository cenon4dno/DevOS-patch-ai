/**
 * @file services/implementationService.ts
 * @satisfies [REQ-PAT-005]
 * Asks Bridge Agent to produce updated file content, then writes it to disk.
 */

import { relayToBridge } from './bridgeClient';
import { readFileFromWorkspace, writeFileToWorkspace, deleteFileFromWorkspace } from './gitService';
import { ChangePlanFile, PatchFile } from '../types';
import logger from '../utils/logger';

export async function applyChangePlan(
  localPath: string,
  planFiles: ChangePlanFile[],
  patchId: string,
  traceId: string,
): Promise<PatchFile[]> {
  logger.info('Step started', {
    trace_id: traceId,
    step: 'IMPLEMENT',
    patch_id: patchId,
    file_count: planFiles.length,
  });

  const patchFiles: PatchFile[] = [];

  for (const planFile of planFiles) {
    if (planFile.action === 'delete') {
      deleteFileFromWorkspace(localPath, planFile.path);
      patchFiles.push({ patch_id: patchId, file_path: planFile.path, action: 'deleted', lines_added: 0, lines_removed: 0 });
      logger.info('File deleted', { trace_id: traceId, patch_id: patchId, path: planFile.path });
      continue;
    }

    const existing = readFileFromWorkspace(localPath, planFile.path);
    const action = planFile.action === 'add' || !existing ? 'add' : 'modify';

    const systemInstruction = `[TAG: TECH-SPEC] You are a TypeScript developer implementing a precise code change.
Return ONLY the complete updated file content — no markdown fences, no explanation, no surrounding text.
Rules: no 'any' types, no TODO stubs, no partial implementations, preserve all existing JSDoc @satisfies headers.`;

    const userText = [
      `File: ${planFile.path}`,
      `Change required: ${planFile.changes_description}`,
      `Reason: ${planFile.reason}`,
      existing ? `Current content:\n${existing}` : '(new file — no existing content)',
    ].join('\n\n');

    const updatedContent = await relayToBridge(
      {
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        temperature: 0.1,
        maxTokens: 8192,
      },
      traceId,
    );

    const cleanedContent = stripMarkdownFences(updatedContent);
    writeFileToWorkspace(localPath, planFile.path, cleanedContent);

    const linesAdded = cleanedContent.split('\n').length;
    const linesRemoved = existing ? existing.split('\n').length : 0;

    patchFiles.push({
      patch_id: patchId,
      file_path: planFile.path,
      action: action === 'add' ? 'added' : 'modified',
      lines_added: linesAdded,
      lines_removed: linesRemoved,
    });

    logger.info('File written', {
      trace_id: traceId,
      patch_id: patchId,
      path: planFile.path,
      action,
    });
  }

  logger.info('Step complete', {
    trace_id: traceId,
    step: 'IMPLEMENT',
    patch_id: patchId,
    files_written: patchFiles.length,
  });

  return patchFiles;
}

function stripMarkdownFences(content: string): string {
  return content
    .replace(/^```[\w]*\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();
}
