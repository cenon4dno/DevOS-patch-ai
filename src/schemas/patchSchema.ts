/**
 * @file schemas/patchSchema.ts
 * @satisfies [REQ-PAT-001]
 */

import { z } from 'zod';

const TargetAgentSchema = z.object({
  name: z.string().min(1),
  character: z.string().min(1),
  github_repo: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'Must be in owner/repo format'),
  local_path: z.string().optional(),
});

const AssignmentSpecSchema = z.object({
  functional: z.string().optional(),
  tech_spec: z.string().optional(),
});

const AssignmentSchema = z.object({
  type: z.enum(['bug_fix', 'feature', 'update']),
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  acceptance_criteria: z
    .array(z.string().min(5))
    .min(1, 'At least one acceptance criterion is required'),
  affected_files_hint: z.array(z.string()).optional(),
  spec: AssignmentSpecSchema.optional(),
});

const PatchContextSchema = z.object({
  reported_by: z.string().min(1),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  related_patch_ids: z.array(z.string()).optional(),
});

export const PatchInputSchema = z.object({
  patch_id: z.string().regex(/^PATCH-\w+$/, 'Must match PATCH-XXX format'),
  target_agent: TargetAgentSchema,
  assignment: AssignmentSchema,
  context: PatchContextSchema,
});

export type PatchInputData = z.infer<typeof PatchInputSchema>;
