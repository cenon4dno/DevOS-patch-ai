/**
 * @file services/changePlanService.ts
 * @satisfies [REQ-PAT-004]
 * Asks Bridge Agent to analyze the existing code and produce a change plan.
 */

import { relayToBridge } from './bridgeClient';
import { readFileFromWorkspace } from './gitService';
import { ChangePlan, ChangePlanFile } from '../types';
import { PatchInputData } from '../schemas/patchSchema';
import logger from '../utils/logger';

function buildFileContext(localPath: string, hintedPaths: string[]): string {
  const sections: string[] = [];
  for (const filePath of hintedPaths) {
    const content = readFileFromWorkspace(localPath, filePath);
    if (content) {
      sections.push(`=== ${filePath} ===\n${content}`);
    }
  }
  return sections.length > 0 ? sections.join('\n\n') : '(no hinted files found in workspace)';
}

export async function buildChangePlan(
  input: PatchInputData,
  localPath: string,
  traceId: string,
): Promise<ChangePlan> {
  logger.info('Step started', { trace_id: traceId, step: 'ANALYZE', patch_id: input.patch_id });

  const hintedPaths = input.assignment.affected_files_hint ?? [];
  const fileContext = buildFileContext(localPath, hintedPaths);

  const criteriaText = input.assignment.acceptance_criteria
    .map((c, i) => `  ${i + 1}. ${c}`)
    .join('\n');

  const specText = input.assignment.spec
    ? [
        input.assignment.spec.functional ? `[TAG: FUNCTIONAL]\n${input.assignment.spec.functional}` : '',
        input.assignment.spec.tech_spec ? `[TAG: TECH-SPEC]\n${input.assignment.spec.tech_spec}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    : '';

  const systemInstruction = `[TAG: CONTEXT] You are a senior TypeScript developer reviewing an existing agent codebase.
Given the files below and the assignment description, produce a precise change plan.
Return ONLY valid JSON — no markdown, no explanation outside the JSON object.
JSON shape:
{
  "summary": "one sentence describing the change",
  "files": [
    {
      "path": "src/services/example.ts",
      "action": "modify|add|delete",
      "reason": "why this file is affected",
      "changes_description": "concise description of what must change"
    }
  ]
}`;

  const userText = [
    `Assignment type: ${input.assignment.type}`,
    `Title: ${input.assignment.title}`,
    `Description: ${input.assignment.description}`,
    specText ? `Specification:\n${specText}` : '',
    `Acceptance criteria:\n${criteriaText}`,
    `Existing files:\n${fileContext}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const raw = await relayToBridge(
    {
      systemInstruction,
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      temperature: 0.2,
      maxTokens: 4096,
    },
    traceId,
  );

  const plan = parseChangePlan(raw, input.patch_id);
  logger.info('Step complete', {
    trace_id: traceId,
    step: 'ANALYZE',
    patch_id: input.patch_id,
    files_in_plan: plan.files.length,
  });
  return plan;
}

function parseChangePlan(raw: string, patchId: string): ChangePlan {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`PATCH_MISSING_INFO: Bridge Agent returned no JSON change plan for ${patchId}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(`PATCH_MISSING_INFO: Could not parse change plan JSON for ${patchId}`);
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj['files'])) {
    throw new Error(`PATCH_MISSING_INFO: Change plan missing 'files' array for ${patchId}`);
  }

  const files: ChangePlanFile[] = (obj['files'] as unknown[]).map((f: unknown) => {
    const file = f as Record<string, unknown>;
    return {
      path: String(file['path'] ?? ''),
      action: (file['action'] as 'modify' | 'add' | 'delete') ?? 'modify',
      reason: String(file['reason'] ?? ''),
      changes_description: String(file['changes_description'] ?? ''),
    };
  });

  return {
    summary: String(obj['summary'] ?? ''),
    files,
  };
}
