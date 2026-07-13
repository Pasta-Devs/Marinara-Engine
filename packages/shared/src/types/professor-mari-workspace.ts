// ──────────────────────────────────────────────
// Professor Mari Workspace Agent Contracts
// ──────────────────────────────────────────────

export type MariWorkspaceToolName = "read" | "grep" | "find" | "ls" | "edit" | "write" | "mari" | "bash" | "app_data";

export type MariChipEntity =
  | "characters"
  | "lorebooks"
  | "personas"
  | "presets"
  | "connections"
  | "agents"
  | "settings"
  | "chat";

export type MariChipTone = "default" | "danger" | "caution" | "success";

export interface MariSuggestionChip {
  id: string;
  label: string;
  prompt: string;
  entity?: MariChipEntity;
  icon?: string;
  tone?: MariChipTone;
}

export const MARI_STARTER_CHIPS: MariSuggestionChip[] = [
  {
    id: "starter-character",
    label: "Create a character",
    entity: "characters",
    icon: "UserPlus",
    prompt: "Let's create a new character together - guide me through it step by step.",
  },
  {
    id: "starter-lorebook",
    label: "Create a lorebook",
    entity: "lorebooks",
    icon: "BookOpen",
    prompt: "Help me build a new lorebook, one entry at a time.",
  },
  {
    id: "starter-persona",
    label: "Create a persona",
    entity: "personas",
    icon: "UserRound",
    prompt: "Help me create a persona for myself, step by step.",
  },
  {
    id: "starter-explore",
    label: "What can you do?",
    icon: "Wand2",
    prompt: "What kinds of things can you help me do here?",
  },
  {
    id: "starter-surprise",
    label: "Surprise me",
    icon: "Dices",
    prompt: "Surprise me - suggest something fun we could create.",
  },
];

const MARI_CHIP_ENTITIES = new Set<MariChipEntity>([
  "characters",
  "lorebooks",
  "personas",
  "presets",
  "connections",
  "agents",
  "settings",
  "chat",
]);

const MARI_CHIP_ENTITY_ALIASES: Record<string, MariChipEntity> = {
  character: "characters",
  characters: "characters",
  lorebook: "lorebooks",
  lorebooks: "lorebooks",
  persona: "personas",
  personas: "personas",
  preset: "presets",
  presets: "presets",
  connection: "connections",
  connections: "connections",
  agent: "agents",
  agents: "agents",
  setting: "settings",
  settings: "settings",
  chat: "chat",
};

const MARI_CHIP_TONES = new Set<MariChipTone>(["default", "danger", "caution", "success"]);

function truncateMariChipText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength).trimEnd() : trimmed;
}

const CHIP_LABEL_KEYS = ["label", "text", "title", "name", "option"];
const CHIP_PROMPT_KEYS = ["prompt", "message", "value", "send", "query", "reply"];

function firstStringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function normalizeMariChipEntity(value: unknown): MariChipEntity | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "_");
  if (MARI_CHIP_ENTITIES.has(normalized as MariChipEntity)) return normalized as MariChipEntity;
  return MARI_CHIP_ENTITY_ALIASES[normalized];
}

/**
 * Models frequently drift from the exact { label, prompt } contract (plain string arrays,
 * a "text"/"title" key instead of "label", a missing "prompt" that should just reuse the
 * label, etc). Strict validation would silently discard the whole chip in those cases, so
 * this accepts the common near-miss shapes rather than requiring exact compliance.
 */
export function sanitizeMariSuggestionChips(raw: unknown, options: { maxChips?: number } = {}): MariSuggestionChip[] {
  if (!Array.isArray(raw)) return [];
  const maxChips = options.maxChips ?? 6;
  const chips: MariSuggestionChip[] = [];
  for (const entry of raw) {
    const record: Record<string, unknown> =
      typeof entry === "string" ? { label: entry, prompt: entry } : entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Record<string, unknown>) : {};
    if (Object.keys(record).length === 0) continue;
    const rawLabel = firstStringField(record, CHIP_LABEL_KEYS);
    const rawPrompt = firstStringField(record, CHIP_PROMPT_KEYS) ?? rawLabel;
    if (!rawLabel || !rawPrompt) continue;
    const label = truncateMariChipText(rawLabel, 40);
    const prompt = truncateMariChipText(rawPrompt, 400);
    if (!label || !prompt) continue;
    const chip: MariSuggestionChip = {
      id:
        typeof record.id === "string" && record.id.trim()
          ? truncateMariChipText(record.id, 80)
          : `suggestion-${chips.length + 1}`,
      label,
      prompt,
    };
    const entity = normalizeMariChipEntity(record.entity);
    if (entity) chip.entity = entity;
    if (typeof record.icon === "string" && record.icon.trim()) {
      chip.icon = truncateMariChipText(record.icon, 40);
    }
    if (typeof record.tone === "string" && MARI_CHIP_TONES.has(record.tone as MariChipTone)) {
      chip.tone = record.tone as MariChipTone;
    }
    chips.push(chip);
    if (chips.length >= maxChips) break;
  }
  return chips;
}

/**
 * One question in a guided-creation plan Mari returns in a single call. The client walks
 * these locally (tap a chip -> next step, zero further calls) until exhausted, then sends
 * one summary message back so Mari performs the actual creation with her normal commands.
 */
export interface MariGuidedPlanStep {
  fieldKey: string;
  question: string;
  chips: MariSuggestionChip[];
}

const PLAN_STEP_FIELD_KEY_KEYS = ["fieldKey", "key", "field", "name"];
const PLAN_STEP_QUESTION_KEYS = ["question", "prompt", "label", "text"];

/** Same tolerant-parsing philosophy as sanitizeMariSuggestionChips - accept near-miss shapes. */
export function sanitizeMariGuidedPlan(raw: unknown, options: { maxSteps?: number; maxChipsPerStep?: number } = {}): MariGuidedPlanStep[] {
  if (!Array.isArray(raw)) return [];
  const maxSteps = options.maxSteps ?? 8;
  const maxChipsPerStep = options.maxChipsPerStep ?? 5;
  const steps: MariGuidedPlanStep[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const rawFieldKey = firstStringField(record, PLAN_STEP_FIELD_KEY_KEYS);
    const rawQuestion = firstStringField(record, PLAN_STEP_QUESTION_KEYS) ?? rawFieldKey;
    if (!rawFieldKey || !rawQuestion) continue;
    const chips = sanitizeMariSuggestionChips(record.chips ?? record.options ?? record.suggestions, { maxChips: maxChipsPerStep });
    if (chips.length === 0) continue;
    steps.push({
      fieldKey: truncateMariChipText(rawFieldKey, 40).replace(/\s+/g, "_"),
      question: truncateMariChipText(rawQuestion, 120),
      chips,
    });
    if (steps.length >= maxSteps) break;
  }
  return steps;
}

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
  kind?: "applied_review" | "approval";
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
  status:
    | "dry-run"
    | "approved"
    | "kept"
    | "restored"
    | "rejected"
    | "cancelled"
    | "timed_out"
    | "blocked"
    | "state_changed"
    | "failed";
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
  pendingResumes: MariWorkspacePendingResume[];
  history: MariDbHistoryEntry[];
  error?: string | null;
}

export interface MariWorkspacePendingResume {
  runId: string;
  chatId: string;
  kind: "client" | "server" | "full";
  reason: string;
  requestedAt: string;
  command: string;
  note?: string;
  manualSteps: string[];
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
  | { type: "suggestions"; data: MariSuggestionChip[] }
  | { type: "plan"; data: MariGuidedPlanStep[] }
  | { type: "done"; data?: unknown }
  | { type: "error"; data: string };
