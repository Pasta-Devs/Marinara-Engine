import type { MariPermissionsMode } from "../constants/mari-permissions-mode.js";
// ──────────────────────────────────────────────
// Professor Mari Workspace Agent Contracts
// ──────────────────────────────────────────────

export type ProfessorMariEntryPoint =
  | "home"
  | "floating-assistant"
  | "command-center"
  | "faq"
  | "character-chat"
  | "character-editor"
  | "persona-editor"
  | "lorebook-editor"
  | "preset-editor"
  | "connection-editor"
  | "agent-editor"
  | "settings"
  | "game-setup"
  | "chat-error";

export type ProfessorMariCapabilityOwner = "workspace" | "client-navigation";
export type ProfessorMariCompletionKind = "open-resource" | "show-field" | "show-review" | "return-to-source";

export const PROFESSOR_MARI_CAPABILITY_CATALOG = {
  explain: {
    owner: "workspace",
    entryPoints: ["home", "floating-assistant", "command-center", "faq", "character-chat"],
    completion: "return-to-source",
  },
  recommend: {
    owner: "workspace",
    entryPoints: ["home", "floating-assistant", "command-center", "character-chat"],
    completion: "return-to-source",
  },
  create: {
    owner: "workspace",
    entryPoints: ["home", "floating-assistant", "command-center", "character-chat"],
    completion: "open-resource",
  },
  edit: {
    owner: "workspace",
    entryPoints: ["home", "floating-assistant", "command-center", "character-chat"],
    completion: "show-review",
  },
  repair: {
    owner: "workspace",
    entryPoints: ["home", "floating-assistant", "command-center", "chat-error"],
    completion: "show-review",
  },
  navigate: {
    owner: "client-navigation",
    entryPoints: ["home", "command-center"],
    completion: "open-resource",
  },
} as const satisfies Record<
  string,
  {
    owner: ProfessorMariCapabilityOwner;
    entryPoints: readonly ProfessorMariEntryPoint[];
    completion: ProfessorMariCompletionKind;
  }
>;

export type ProfessorMariCapability = keyof typeof PROFESSOR_MARI_CAPABILITY_CATALOG;

export function isCapabilityAllowedFrom(capability: ProfessorMariCapability, source: ProfessorMariEntryPoint): boolean {
  return (PROFESSOR_MARI_CAPABILITY_CATALOG[capability].entryPoints as readonly ProfessorMariEntryPoint[]).includes(
    source,
  );
}

export function completionKindFor(capability: ProfessorMariCapability): ProfessorMariCompletionKind {
  return PROFESSOR_MARI_CAPABILITY_CATALOG[capability].completion;
}

export type ProfessorMariContextResourceKind =
  "character" | "persona" | "lorebook" | "preset" | "connection" | "agent" | "setting" | "chat" | "game";

export interface ProfessorMariContextResource {
  kind: ProfessorMariContextResourceKind;
  id: string;
  label?: string;
}

export type ProfessorMariRelatedResource = ProfessorMariContextResource & {
  kind: Extract<
    ProfessorMariContextResourceKind,
    "character" | "persona" | "lorebook" | "preset" | "connection" | "agent"
  >;
};

export interface ProfessorMariAskContext {
  source: ProfessorMariEntryPoint;
  capability: ProfessorMariCapability;
  query?: string;
  resource?: ProfessorMariContextResource;
  relatedResources?: ProfessorMariRelatedResource[];
  field?: string;
  /** Stable editor field identifier; `field` remains the human-readable compatibility label. */
  fieldId?: string;
  error?: { message: string; code?: string };
  action?: string;
  commandCenterResultId?: string;
  activeChat?: { id: string; label?: string; mode?: string };
  settingsLocation?: { tab?: string; controlId?: string };
  /** The omnibar aside's answer, carried along when `⌘↵` escalates it into Mari (R25). */
  asideAnswer?: { query: string; answer: string; tier: "local" | "remote"; sources?: ProfessorMariQuickSource[] };
}

// "floating-assistant" is gone: the floating window was replaced by a presence
// indicator that opens the omnibar. The surface enum above keeps the value,
// because it records where a request came FROM, not where it goes.
export type ProfessorMariHandoffDestination = "omnibar" | "home" | "character-chat";

export type ProfessorMariCompletion =
  | { kind: "open-resource"; resource: ProfessorMariContextResource }
  | { kind: "show-field"; resource: ProfessorMariContextResource; field: string }
  | { kind: "show-review"; reviewId?: string }
  | { kind: "return-to-source" };

export interface ProfessorMariHandoff {
  destination?: ProfessorMariHandoffDestination;
  draft?: string;
  context?: ProfessorMariAskContext;
  submitDraft?: boolean;
  completion?: ProfessorMariCompletion;
}

export interface ProfessorMariQuickPromptRequest {
  message: string;
  connectionId?: string | null;
  context?: Pick<ProfessorMariAskContext, "source"> &
    Partial<Pick<ProfessorMariAskContext, "capability" | "query" | "resource" | "field" | "fieldId" | "action">>;
  debugMode?: boolean;
  /**
   * The omnibar aside fires this without being asked, on a typing pause. That
   * call must never carry persistent memories or the contents of the focused
   * field: it sends the query, the surface, and the focused resource's label,
   * and nothing else.
   */
  unasked?: boolean;
  /**
   * Human label of whatever the user is looking at, for an unasked call. It is a
   * separate field rather than `context.resource` on purpose: the unasked
   * payload carries a label, never a kind or an id.
   */
  resourceLabel?: string;
}

/**
 * Capability words mapped to the official Agent package id(s) that cover them,
 * so "does Marinara do images/music/maps" questions can point at the real
 * package. Shared so the server (grounding text) and the client (the
 * "Download Agents" chip, computed from the already-typed query, no extra
 * round trip) never drift apart.
 */
export const OMNIBAR_CAPABILITY_AGENT_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  image: ["illustrator"],
  images: ["illustrator"],
  picture: ["illustrator"],
  pictures: ["illustrator"],
  photo: ["illustrator"],
  photos: ["illustrator"],
  video: ["illustrator"],
  videos: ["illustrator"],
  music: ["spotify"],
  song: ["spotify"],
  songs: ["spotify"],
  spotify: ["spotify"],
  map: ["hierarchical-maps"],
  maps: ["hierarchical-maps"],
  calls: ["conversation-calls"],
  chess: ["chess"],
  poker: ["poker"],
  uno: ["uno"],
  combat: ["combat"],
  battle: ["combat"],
  haptic: ["haptic"],
};

/** Up to 3 distinct package ids the query's words name a capability for. */
export function matchOmnibarCapabilityAgentPackageIds(query: string): string[] {
  const words = query.toLowerCase().match(/[a-z]+/g) ?? [];
  const ids = new Set<string>();
  for (const word of words) {
    for (const id of OMNIBAR_CAPABILITY_AGENT_KEYWORDS[word] ?? []) ids.add(id);
  }
  return [...ids].slice(0, 3);
}

export interface ProfessorMariQuickMetadata {
  connectionId: string;
  connectionName: string;
  model: string;
  fallbackUsed: boolean;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ProfessorMariQuickEditProposal {
  id: string;
  resource: ProfessorMariContextResource;
  fieldId: string;
  fieldLabel: string;
  before: string;
  after: string;
  fingerprint: string;
  expiresAt: string;
}

export interface ProfessorMariQuickEditApplyResponse {
  ok: true;
  proposalId: string;
  reviewId?: string;
  actionResult?: MariWorkspaceActionResult;
}

/** Why a quick answer failed, so the omnibar can say what to do. Classified on the server. */
export type ProfessorMariQuickErrorKind = "auth" | "missing-model" | "provider" | "empty" | "network";

/** A docs page the quick answer was grounded on. */
export interface ProfessorMariQuickSource {
  path: string;
  heading: string;
}

export type ProfessorMariQuickPromptEvent =
  | { type: "status"; data: { phase: "starting" | "thinking" } }
  | { type: "sources"; data: ProfessorMariQuickSource[] }
  | { type: "token"; data: string }
  | { type: "edit_proposal"; data: ProfessorMariQuickEditProposal }
  | { type: "metadata"; data: ProfessorMariQuickMetadata }
  | { type: "complete"; data: { ok: true } }
  | { type: "error"; data: { kind: ProfessorMariQuickErrorKind; message: string } };

export type MariWorkspaceActionResourceKind = Extract<
  ProfessorMariContextResourceKind,
  "character" | "persona" | "lorebook" | "preset"
>;

export interface MariWorkspaceActionResult {
  /** "failed": an apply that did not save; the card says Not saved, with `error` and Try again (slice 87). */
  status: "created" | "updated" | "failed";
  resource: {
    kind: MariWorkspaceActionResourceKind;
    id: string;
    label?: string;
  };
  changedFields: string[];
  editorTarget?: string;
  /** The first review; kept for messages saved before `reviewIds`. */
  reviewId?: string;
  summary: string;
  // Slice 74 receipt: what changed, kept on the message so the card stays full after Keep, Undo or a
  // reload. All optional: an older message lacks them and falls back to the field names.
  /** Every review merged into this record (one record per run). */
  reviewIds?: string[];
  /** Her one-line why for the change. */
  reason?: string;
  /** Slice 87: why a failed apply did not save, in plain words (status "failed"). */
  error?: string;
  /** Per field, short before/after excerpts or list names, in editor order. */
  changes?: MariChangeExcerpt[];
  /** Changed fields the excerpts leave out. */
  moreChanges?: number;
  /** When the undo record expires; absent when there is no undo (Accept edits mode). */
  undoUntil?: string;
  /** Written back by the Keep / Undo routes. */
  outcome?: "kept" | "undone";
}

export type MariChangeExcerpt =
  | { field: string; kind: "text"; before: string; after: string }
  | { field: string; kind: "value"; before: string; after: string }
  | {
      field: string;
      kind: "list";
      added: string[];
      edited: string[];
      removed: string[];
      count: { added: number; edited: number; removed: number };
      /** Slice 87: the added and edited entries with their keys and text, for a lorebook. */
      items?: MariChangeListItem[];
    };

export interface MariChangeListItem {
  name: string;
  keys?: string[];
  text?: string;
}

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
  | "app_data"
  | "package_service";

export type MariChipEntity =
  "characters" | "lorebooks" | "personas" | "presets" | "connections" | "agents" | "settings" | "chat";

export type MariChipTone = "default" | "danger" | "caution" | "success";

/**
 * M5b: a next-step card that acts at once on the client, with no Mari round-trip. The first three
 * kinds are the client's own navigation targets; the prompt stays the fallback for surfaces that
 * only render chips.
 */
export type MariSuggestionAction =
  | { kind: "resource"; resource: "character" | "persona" | "preset" | "lorebook" | "agent"; id: string }
  | { kind: "chat"; chatId: string }
  | { kind: "panel"; panel: "characters" | "personas" | "lorebooks" | "presets" | "connections" | "agents" }
  | { kind: "start-chat"; characterId: string }
  | { kind: "peek-prompt"; chatId: string };

export interface MariSuggestionChip {
  id: string;
  label: string;
  prompt: string;
  entity?: MariChipEntity;
  icon?: string;
  tone?: MariChipTone;
  /** M5b: one short fact under the label ("3 messages since your last summary"). */
  detail?: string;
  action?: MariSuggestionAction;
}

/**
 * Slice 71: one mutating command Mari held behind Accept, saved on her turn (`mariHeldChanges`) so the
 * "Needs you" card can say what Accept would do: the app-data action or command name, the record it
 * targets, its name when the command carries one, and the fields it sets (values cut short).
 */
export interface MariHeldChange {
  action: string;
  id?: string;
  name?: string;
  fields?: Array<{ key: string; value: string }>;
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

/**
 * #5820: the matching refusal. Held commands are never executed unless the
 * user accepts, so declining is just a reply - but without a control for it
 * the only way to say no was to compose a sentence, which is why users
 * reported seeing "nowhere to apply or revert".
 */
export const MARI_AUTHORIZATION_DECLINE_CHIP: MariSuggestionChip = {
  id: "authorization-decline",
  label: "Don't apply",
  prompt: "Do not apply those changes.",
  tone: "caution",
};

/**
 * The workspace agent reuses the id "authorization-accept" for an unrelated
 * output-limit chip ("Continue the task."), so the id alone cannot tell a
 * held-change approval from a keep-going prompt. Matching the prompt too
 * keeps the approval wording and the decline action off rows where nothing
 * is actually held.
 */
export function isMariHeldChangeApprovalChip(chip: MariSuggestionChip): boolean {
  return chip.id === MARI_AUTHORIZATION_ACCEPT_CHIP.id && chip.prompt === MARI_AUTHORIZATION_ACCEPT_CHIP.prompt;
}

/** Pairs a held-change Accept with its decline action, exactly once. */
export function withHeldChangeDeclineChip(chips: MariSuggestionChip[]): MariSuggestionChip[] {
  if (!chips.some(isMariHeldChangeApprovalChip)) return chips;
  if (chips.some((chip) => chip.id === MARI_AUTHORIZATION_DECLINE_CHIP.id)) return chips;
  const acceptIndex = chips.findIndex(isMariHeldChangeApprovalChip);
  return [...chips.slice(0, acceptIndex + 1), MARI_AUTHORIZATION_DECLINE_CHIP, ...chips.slice(acceptIndex + 1)];
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
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");
  if (MARI_CHIP_ENTITIES.has(normalized as MariChipEntity)) return normalized as MariChipEntity;
  return MARI_CHIP_ENTITY_ALIASES[normalized];
}

const CHIP_DETAIL_KEYS = ["detail", "fact", "hint"];
const MARI_CHIP_DETAIL_MAX = 80;
const MARI_ACTION_RESOURCES = new Set(["character", "persona", "preset", "lorebook", "agent"]);
const MARI_ACTION_PANELS = new Set(["characters", "personas", "lorebooks", "presets", "connections", "agents"]);

/** Only the action shapes the client knows how to run; anything else leaves a plain Mari card. */
function sanitizeMariSuggestionAction(raw: unknown): MariSuggestionAction | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const id = (key: string) => {
    const value = record[key];
    return typeof value === "string" && value.trim() ? truncateMariChipText(value, 120) : undefined;
  };
  const kind = record.kind;
  if (kind === "resource") {
    const resource = record.resource;
    const resourceId = id("id");
    return typeof resource === "string" && MARI_ACTION_RESOURCES.has(resource) && resourceId
      ? { kind, resource: resource as Extract<MariSuggestionAction, { kind: "resource" }>["resource"], id: resourceId }
      : undefined;
  }
  if (kind === "panel") {
    const panel = record.panel;
    return typeof panel === "string" && MARI_ACTION_PANELS.has(panel)
      ? { kind, panel: panel as Extract<MariSuggestionAction, { kind: "panel" }>["panel"] }
      : undefined;
  }
  if (kind === "start-chat") {
    const characterId = id("characterId");
    return characterId ? { kind, characterId } : undefined;
  }
  if (kind === "chat" || kind === "peek-prompt") {
    const chatId = id("chatId");
    return chatId ? { kind, chatId } : undefined;
  }
  return undefined;
}

/**
 * Models frequently drift from the exact { label, prompt } contract (plain string arrays,
 * a "text"/"title" key instead of "label", a missing "prompt" that should just reuse the
 * label, etc). Strict validation would silently discard the whole chip in those cases, so
 * this accepts the common near-miss shapes rather than requiring exact compliance.
 */
/** Non-finite caps fall back to the default; a cap of 0 means "emit nothing". */
function normalizeMariCap(value: number | undefined, fallback: number): number {
  const cap = Math.floor(value ?? fallback);
  return Number.isFinite(cap) ? Math.max(0, cap) : fallback;
}

export function sanitizeMariSuggestionChips(raw: unknown, options: { maxChips?: number } = {}): MariSuggestionChip[] {
  if (!Array.isArray(raw)) return [];
  const maxChips = normalizeMariCap(options.maxChips, 6);
  if (maxChips === 0) return [];
  const chips: MariSuggestionChip[] = [];
  const ids = new Set<string>();
  for (const entry of raw) {
    const record: Record<string, unknown> =
      typeof entry === "string"
        ? { label: entry, prompt: entry }
        : entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : {};
    if (Object.keys(record).length === 0) continue;
    const rawLabel = firstStringField(record, CHIP_LABEL_KEYS);
    const rawPrompt = firstStringField(record, CHIP_PROMPT_KEYS);
    if (!rawLabel || !rawPrompt) continue;
    const label = truncateMariChipText(rawLabel, 40);
    const prompt = truncateMariChipText(rawPrompt, 400);
    if (!label || !prompt) continue;
    let id =
      typeof record.id === "string" && record.id.trim()
        ? truncateMariChipText(record.id, 80)
        : `suggestion-${chips.length + 1}`;
    if (!id || ids.has(id)) id = `suggestion-${chips.length + 1}`;
    for (let attempt = 1; ids.has(id); attempt += 1) {
      id = `suggestion-${chips.length + 1}-${attempt}`;
    }
    ids.add(id);
    const chip: MariSuggestionChip = {
      id,
      label,
      prompt,
    };
    const entity = normalizeMariChipEntity(record.entity);
    if (entity) chip.entity = entity;
    if (typeof record.icon === "string" && record.icon.trim()) {
      chip.icon = truncateMariChipText(record.icon, 40);
    }
    if (typeof record.tone === "string") {
      const tone = record.tone.trim().toLowerCase();
      if (MARI_CHIP_TONES.has(tone as MariChipTone)) chip.tone = tone as MariChipTone;
    }
    const rawDetail = firstStringField(record, CHIP_DETAIL_KEYS);
    if (rawDetail) {
      // One line under the label: whitespace collapsed, an overlong fact cut with an ellipsis.
      const detail = rawDetail.replace(/\s+/g, " ").trim();
      chip.detail =
        detail.length > MARI_CHIP_DETAIL_MAX ? `${detail.slice(0, MARI_CHIP_DETAIL_MAX - 1).trimEnd()}…` : detail;
    }
    const action = sanitizeMariSuggestionAction(record.action);
    if (action) chip.action = action;
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
  const maxSteps = normalizeMariCap(options.maxSteps, 8);
  const maxChipsPerStep = normalizeMariCap(options.maxChipsPerStep, 5);
  if (maxSteps === 0) return [];
  const steps: MariGuidedPlanStep[] = [];
  const fieldKeys = new Set<string>();
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
    const fieldKey = truncateMariChipText(rawFieldKey, 40).replace(/\s+/g, "_");
    const question = truncateMariChipText(rawQuestion, 120);
    if (!fieldKey || !question || fieldKeys.has(fieldKey)) continue;
    fieldKeys.add(fieldKey);
    steps.push({
      fieldKey,
      question,
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
  /** Server clock at the first sighting of the call, so a replayed trace still has a duration. */
  startedAt?: number;
  updatedAt?: number;
}

export type MariWorkspaceTraceItem =
  | { type: "text"; content: string }
  /** Server clock (ms) when this thought began and last grew, so a saved run can say how long she thought. */
  | { type: "thinking"; content: string; startedAt?: number; updatedAt?: number }
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

/**
 * #5754 follow-up: deterministic post-apply verification. After an applied
 * mutation the engine re-reads every affected row FROM THE STORE and compares
 * the persisted values against what the plan asserted. Only "verified" - a
 * store-observed match - may satisfy the workspace verification guard: the
 * diff summary's preview is plan-derived (the same function serves dry-runs)
 * and must never count as proof of persistence. "mismatch" and "unavailable"
 * both fall back to requiring a manual confirmatory read, so a silent
 * persistence failure can only surface louder, never quieter.
 */
export interface MariDbReadBackMismatch {
  table: string;
  id: string;
  column: string;
  intended: unknown;
  persisted: unknown;
}

export interface MariDbMutationReadBack {
  /**
   * The guard does NOT parse this JSON: the command runtimes translate a
   * "verified"/"mismatch" status into an engine-written sentinel at position
   * zero of the command output, which is the only thing verification trusts
   * (later output bytes can contain model-authored text). This object is what
   * Mari herself reads for the detail.
   */
  status: "verified" | "mismatch" | "unavailable";
  /** Applied plan changes the read-back checked (all of them, not a preview cap). */
  checkedRows: number;
  /** Total mismatching columns/rows found; `mismatches` echoes a capped sample. */
  mismatchCount?: number;
  mismatches?: MariDbReadBackMismatch[];
  error?: string;
}

export interface MariDbCommandResult {
  ok: boolean;
  mode: "read" | "dry-run" | "apply";
  command: string;
  output?: unknown;
  truncation?: MariDbReadTruncation;
  summary?: MariDbDiffSummary;
  readBack?: MariDbMutationReadBack;
  validation?: MariDbValidationResult;
  approval?: {
    status: "not_required" | "pending" | "approved" | "rejected" | "cancelled" | "timed_out" | "state_changed";
    id?: string;
    operationHash?: string;
    /** An applied review's undo deadline. */
    expiresAt?: string;
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
  MariDbPendingApproval | MariDependencyInstallApproval | MariSensitiveFileApproval;

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

/**
 * The newest Professor Mari run, anchored on the server clock. `id` is the run's request message, which
 * is also what the client's "seen" marker stores, so a refresh or another device sees the same state.
 */
export interface MariWorkspaceLatestRun {
  id: string;
  chatId: string;
  startedAt: number;
  finishedAt: number | null;
  outcome: "running" | "finished" | "failed";
  /** Manual mode: the run ended with a change held behind Accept. Any answer starts a new run, which replaces this. */
  heldChange?: boolean;
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
  /** The newest run, or null before any run in this server process. */
  latestRun: MariWorkspaceLatestRun | null;
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
  // `durationMs` is measured on the server, so it survives a reload and does not depend on the
  // two clocks agreeing. A running step still ticks from the client's own start, which needs no
  // comparison. Optional, so an older server just falls back to the client measurement.
  | {
      type: "tool_end";
      data: { id?: string; name?: string; isError?: boolean; output?: string; durationMs?: number };
    }
  | { type: "approval_pending"; data: MariWorkspacePendingApproval }
  | {
      type: "metadata";
      /** `narration`: the text just sent belongs to the round whose steps came before it (slice 72). */
      data: Record<string, unknown> & { actionResult?: MariWorkspaceActionResult; narration?: boolean };
    }
  | { type: "suggestions"; data: MariSuggestionChip[] }
  | { type: "plan"; data: MariGuidedPlanStep[] }
  | { type: "done"; data?: unknown }
  | { type: "error"; data: string };
