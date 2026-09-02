import type { MariPermissionsMode } from "../constants/mari-permissions-mode.js";
// ──────────────────────────────────────────────
// Professor Mari Workspace Agent Contracts
// ──────────────────────────────────────────────

export type MariWorkspaceToolName =
  | "docs_search"
  | "docs_read"
  | "read"
  | "grep"
  | "find"
  | "ls"
  | "edit"
  | "write"
  | "copy"
  | "move"
  | "remove"
  | "bash"
  | "dependency"
  | "app_data";

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

/**
 * #5748: the Accept action for a deferred (held) mutation. Shared so the
 * server's deferral event and the client's persisted-deferral re-derivation
 * (from the mariDeferredMutations message extra) can never drift.
 */
export const MARI_AUTHORIZATION_ACCEPT_CHIP: MariSuggestionChip = {
  id: "authorization-accept",
  label: "Accept",
  prompt: "I accept the proposed change.",
  tone: "success",
};

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
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");
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
      typeof entry === "string"
        ? { label: entry, prompt: entry }
        : entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : {};
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
export function sanitizeMariGuidedPlan(
  raw: unknown,
  options: { maxSteps?: number; maxChipsPerStep?: number } = {},
): MariGuidedPlanStep[] {
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
    const chips = sanitizeMariSuggestionChips(record.chips ?? record.options ?? record.suggestions, {
      maxChips: maxChipsPerStep,
    });
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
  maxContext: number;
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

// #4851: Professor Mari's saved memories (the mari_instructions store). The list
// surfaces full detail (content included) so the Memories management panel can edit
// in place, mirroring the Skills panel.
export interface MariInstructionSummary {
  id: string;
  name: string;
  description: string;
  persistent: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MariInstructionDetail extends MariInstructionSummary {
  content: string;
}

export interface MariInstructionsResponse {
  instructions: MariInstructionDetail[];
}

export interface MariInstructionMutationResponse {
  ok: boolean;
  instruction: MariInstructionDetail;
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

/**
 * Signals how a structured read was bounded so the model gets a machine-readable
 * cue instead of a silent mid-field cut. `fields` lists whole values elided from
 * an object read (largest first) with the exact `field` path to re-read each;
 * `field` describes a single windowed field read (`app_data { field, offset }`).
 */
export interface MariDbReadTruncation {
  truncated: boolean;
  fields?: Array<{ path: string; fullLength: number; returnedLength: number }>;
  field?: { path: string; offset: number; returned: number; total: number };
  /** Set when even structured elision could not fit the overview and it was hard-capped. */
  hardCapped?: boolean;
  /** Set when a `field=` read named a path that did not resolve on this row. */
  unresolvedField?: string;
}

export interface MariDbCommandResult {
  ok: boolean;
  mode: "read" | "dry-run" | "apply";
  command: string;
  output?: unknown;
  truncation?: MariDbReadTruncation;
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

export type MariDependencyTarget = "root" | "client" | "server" | "shared";

export interface MariDependencyInstallApproval {
  kind: "dependency_install";
  id: string;
  sessionId: string;
  packageName: string;
  version: string;
  target: MariDependencyTarget;
  dependencyType: "dependency" | "devDependency";
  integrity: string;
  tarballUrl: string;
  directDependencies: Array<{ name: string; range: string }>;
  reason: string | null;
  requestedAt: string;
  expiresAt: string;
}

export interface MariSensitiveFileApproval {
  kind: "sensitive_file";
  id: string;
  sessionId: string;
  path: string;
  changeType: "create" | "update";
  beforeHash: string | null;
  afterHash: string;
  preview: string;
  previewTruncated: boolean;
  reason: string | null;
  requestedAt: string;
  expiresAt: string;
}

export type MariWorkspacePendingApproval =
  | MariDbPendingApproval
  | MariDependencyInstallApproval
  | MariSensitiveFileApproval;

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

/**
 * #5740: the request/permission phrase Professor Mari reported acting on in
 * her most recent round that carried mutating commands. DIAGNOSTIC ONLY -
 * never validated, never gates anything (#5721's lesson stands). Retention is
 * deliberately the latest round only: one in-memory record, overwritten each
 * time, lost on server restart.
 */
/**
 * What actually became of the round's mutating commands. "held" = deferred
 * behind the Accept action, or staged behind a sensitive-change approval
 * card (#5756) - either way, awaiting the user; "applied" = every mutating
 * command succeeded and applied; "failed" = at least one was refused (a
 * permissions floor, validation) or errored; "interrupted" = the run ended
 * before the outcome was observed.
 */
export type MariUnderstoodRequestOutcome = "held" | "applied" | "failed" | "interrupted";

export interface MariUnderstoodRequest {
  /** Mari's quoted trigger phrase (user words or memory/instruction), or null when she reported none. */
  text: string | null;
  chatId: string;
  /** The persisted assistant message the round produced, once known. */
  messageId: string | null;
  /** Effective Permissions Mode when the round ran. */
  permissionsMode: MariPermissionsMode;
  /** Observed outcome - never inferred: "applied" is only set after the command batch reports success. */
  outcome: MariUnderstoodRequestOutcome;
  /** Short descriptions of the mutating commands (e.g. "app_data character.update"). */
  commands: string[];
  recordedAt: string;
}

export interface MariWorkspaceStatus {
  enabled: boolean;
  piAvailable: boolean;
  workspace: string;
  dataDir: string;
  tools: MariWorkspaceToolName[];
  shellSandbox: {
    available: boolean;
    backend: "macos-seatbelt" | "linux-bubblewrap" | null;
    reason?: string;
  };
  dbAccess: "server-managed";
  connection: MariWorkspaceConnectionSummary | null;
  skills: MariWorkspaceSkillSummary[];
  skillDiagnostics: string[];
  active: boolean;
  /** The EFFECTIVE Permissions Mode for the requested chat (#5725): the chat's override, else the global default. */
  permissionsMode: MariPermissionsMode;
  /** The global default mode (what a chat without an override runs under). */
  permissionsModeDefault: MariPermissionsMode;
  /** Whether permissionsMode came from a per-chat override or the global default. */
  permissionsModeSource: "default" | "chat";
  /** #5740: latest-round understood-request record (diagnostic only). */
  latestUnderstoodRequest: MariUnderstoodRequest | null;
  pendingApprovals: MariWorkspacePendingApproval[];
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
            kind?: "compaction_start" | "compaction_end" | "output_limit" | "retry" | "info" | "rate_limited";
            level?: "info" | "warning" | "error";
            reason?: string;
          };
    }
  | { type: "tool_start"; data: { id?: string; name: string; input?: unknown } }
  | { type: "tool_update"; data: { id?: string; name?: string; output?: string } }
  | { type: "tool_end"; data: { id?: string; name?: string; isError?: boolean; output?: string } }
  | { type: "approval_pending"; data: MariWorkspacePendingApproval }
  | { type: "metadata"; data: Record<string, unknown> }
  | { type: "suggestions"; data: MariSuggestionChip[] }
  | { type: "plan"; data: MariGuidedPlanStep[] }
  | { type: "done"; data?: unknown }
  | { type: "error"; data: string };
