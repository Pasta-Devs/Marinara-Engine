// ──────────────────────────────────────────────
// Professor Mari Workspace Agent Contracts
// ──────────────────────────────────────────────

export type MariWorkspaceToolName = "read" | "grep" | "find" | "ls" | "edit" | "write" | "bash";

export interface MariWorkspaceToolTrace {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  input?: unknown;
  output?: string | null;
  updatedAt?: number;
}

export type MariWorkspaceTraceItem =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string }
  | { type: "tool"; tool: MariWorkspaceToolTrace }
  | { type: "status"; content: string };

export interface MariWorkspaceConnectionSummary {
  id: string;
  name: string;
  provider: string;
  model: string;
}

export interface MariWorkspaceSkillSummary {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  size: number;
  filePath: string;
}

export interface MariWorkspaceSkillDetail extends MariWorkspaceSkillSummary {
  content: string;
}

export interface MariWorkspaceSkillsResponse {
  skills: MariWorkspaceSkillDetail[];
  diagnostics: string[];
}

export interface MariDbValidationIssue {
  level: "error" | "notice" | "info";
  table?: string;
  id?: string | null;
  message: string;
}

export interface MariDbValidationResult {
  status: "passed" | "blocked";
  errors: MariDbValidationIssue[];
  notices: MariDbValidationIssue[];
  infos: MariDbValidationIssue[];
}

export interface MariDbRowChange {
  table: string;
  id: string;
  action: "insert" | "update" | "replace" | "delete";
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface MariDbDiffSummary {
  matchedRows: number;
  affectedRows: number;
  insertedRows: number;
  updatedRows: number;
  replacedRows: number;
  deletedRows: number;
  affectedTables: Record<string, number>;
  preview: MariDbRowChange[];
  truncated: boolean;
}

export interface MariDbCommandResult {
  ok: boolean;
  mode: "read" | "dry-run" | "apply";
  command: string;
  output?: unknown;
  summary?: MariDbDiffSummary;
  validation?: MariDbValidationResult;
  approval?: {
    status: "not_required" | "pending" | "approved" | "rejected" | "cancelled" | "timed_out" | "state_changed";
    id?: string;
    operationHash?: string;
  };
  journalPath?: string | null;
  error?: string;
}

export interface MariDbPendingApproval {
  id: string;
  sessionId: string;
  command: string;
  reason: string | null;
  operationHash: string;
  requestedAt: string;
  expiresAt: string;
  affectedTables: Record<string, number>;
  affectedRows: number;
  validationStatus: "passed" | "blocked";
  diffPreview: MariDbRowChange[];
  diffTruncated: boolean;
}

export interface MariDbHistoryEntry {
  id: string;
  sessionId: string;
  command: string;
  reason: string | null;
  status: "dry-run" | "approved" | "rejected" | "cancelled" | "timed_out" | "blocked" | "state_changed" | "failed";
  operationHash?: string;
  affectedTables: Record<string, number>;
  affectedRows: number;
  validationStatus: "passed" | "blocked";
  journalPath?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface MariWorkspaceStatus {
  enabled: boolean;
  piAvailable: boolean;
  workspace: string;
  dataDir: string;
  tools: MariWorkspaceToolName[];
  dbAccess: "server-managed";
  connection: MariWorkspaceConnectionSummary | null;
  skills: MariWorkspaceSkillSummary[];
  skillDiagnostics: string[];
  active: boolean;
  pendingApprovals: MariDbPendingApproval[];
  history: MariDbHistoryEntry[];
  error?: string | null;
}

export type MariWorkspacePromptEvent =
  | { type: "token"; data: string }
  | { type: "thinking"; data: string }
  | {
      type: "status";
      data:
        | string
        | {
            content: string;
            kind?: "compaction_start" | "compaction_end" | "output_limit" | "retry" | "info";
            level?: "info" | "warning" | "error";
            reason?: string;
          };
    }
  | { type: "tool_start"; data: { id?: string; name: string; input?: unknown } }
  | { type: "tool_update"; data: { id?: string; name?: string; output?: string } }
  | { type: "tool_end"; data: { id?: string; name?: string; isError?: boolean; output?: string } }
  | { type: "approval_pending"; data: MariDbPendingApproval }
  | { type: "metadata"; data: Record<string, unknown> }
  | { type: "done"; data?: unknown }
  | { type: "error"; data: string };
