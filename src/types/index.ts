/**
 * @file types/index.ts
 * @satisfies [REQ-PAT-001]
 */

export type PatchType = 'bug_fix' | 'feature' | 'update';
export type PatchStatus =
  | 'pending'
  | 'analyzing'
  | 'implementing'
  | 'testing'
  | 'pr_created'
  | 'completed'
  | 'failed'
  | 'clarification_required';
export type FileAction = 'modified' | 'added' | 'deleted';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface TargetAgent {
  name: string;
  character: string;
  github_repo: string;
  local_path?: string;
}

export interface AssignmentSpec {
  functional?: string;
  tech_spec?: string;
}

export interface Assignment {
  type: PatchType;
  title: string;
  description: string;
  acceptance_criteria: string[];
  affected_files_hint?: string[];
  spec?: AssignmentSpec;
}

export interface PatchContext {
  reported_by: string;
  priority: Priority;
  related_patch_ids?: string[];
}

export interface PatchInput {
  patch_id: string;
  target_agent: TargetAgent;
  assignment: Assignment;
  context: PatchContext;
}

export interface PatchFile {
  id?: number;
  patch_id: string;
  file_path: string;
  action: FileAction;
  lines_added: number;
  lines_removed: number;
}

export interface PatchRecord {
  id?: number;
  patch_id: string;
  target_agent: string;
  github_repo: string;
  type: PatchType;
  title: string;
  description: string;
  status: PatchStatus;
  branch_name: string | null;
  pr_url: string | null;
  pr_number: number | null;
  error_message: string | null;
  priority: Priority;
  reported_by: string;
  created_at: string;
  updated_at: string;
}

export interface PullRequestResult {
  url: string;
  number: number;
  branch: string;
  title: string;
  created_at: string;
}

export interface TestResult {
  passed: boolean;
  total: number;
  failed: number;
  output_summary: string;
}

export interface TraceabilityEntry {
  acceptance_criterion: string;
  satisfied_by: string;
}

export interface PatchResult {
  patch_id: string;
  status: PatchStatus;
  pull_request: PullRequestResult | null;
  changes: {
    files_modified: string[];
    files_added: string[];
    files_deleted: string[];
    lines_added: number;
    lines_removed: number;
  };
  test_result: TestResult | null;
  traceability: TraceabilityEntry[];
  completed_at: string;
}

export interface ChangePlanFile {
  path: string;
  action: 'modify' | 'add' | 'delete';
  reason: string;
  changes_description: string;
}

export interface ChangePlan {
  summary: string;
  files: ChangePlanFile[];
}

export interface HealthStatus {
  status: 'UP' | 'DOWN';
  timestamp: string;
  version: string;
  uptime_seconds?: number;
  character: string;
  persona_message: string;
  services?: {
    database?: string;
    bridge_agent?: string;
  };
}

export interface BridgeRelayRequest {
  systemInstruction: string;
  contents: Array<{
    role: 'user' | 'assistant';
    parts: Array<{ text: string }>;
  }>;
  temperature?: number;
  maxTokens?: number;
}

export interface BridgeRelayResponse {
  status: 'success' | 'error';
  content?: string;
  error?: {
    code: string;
    message: string;
  };
}
