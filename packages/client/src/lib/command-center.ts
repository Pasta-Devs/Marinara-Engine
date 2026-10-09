import {
  PROFESSOR_MARI_CAPABILITY_CATALOG,
  type ProfessorMariAskContext,
  type ProfessorMariCapability,
  type ProfessorMariContextResource,
  normalizeTextForMatch,
} from "@marinara-engine/shared";
import type { ProfessorMariNavigationTarget } from "./professor-mari-navigation";
import { isQuestionShaped } from "./omnibar-scope";

export type CommandKind = "navigation" | "chat" | "resource" | "settings" | "action";

export type CommandIcon =
  | "command"
  | "home"
  | "chats"
  | "character"
  | "persona"
  | "lorebook"
  | "preset"
  | "connection"
  | "agent"
  | "settings"
  | "extensions"
  | "documentation"
  | "game-assets"
  | "package"
  | "professor"
  | "music"
  | "upload"
  | "updates"
  | "diagnostics"
  | "backups"
  | "speech";

export type CommandCenterCategoryFilter =
  | "all"
  | "chats"
  | "characters"
  | "personas"
  | "lorebooks"
  | "presets"
  | "connections"
  | "agents"
  | "settings"
  | "docs";

export type CommandCenterResultCategory =
  | "navigation"
  | "chat"
  | "character"
  | "persona"
  | "lorebook"
  | "preset"
  | "connection"
  | "agent"
  | "settings"
  | "professor"
  | "docs";

export type CommandCenterResultGroupId =
  | "now"
  | "try"
  | "context"
  | "current-work"
  | "continue"
  | "frecent"
  | "recent"
  | "quick-controls"
  | "create-navigation"
  | "navigation"
  | "messages"
  | "lorebook-entries"
  | Exclude<CommandCenterCategoryFilter, "all">
  | "professor-suggested"
  | "top-hit"
  | "professor-fallback";

export interface CommandCenterResultMetadata {
  label: string;
  value: string | number;
}

export interface CommandCenterResultMedia {
  src: string;
  alt: string;
}

export interface CommandCenterPresentableResult {
  id: string;
  category: CommandCenterResultCategory;
  control?: unknown;
  metadata?: readonly CommandCenterResultMetadata[];
  media?: CommandCenterResultMedia;
  group?: CommandCenterResultGroupId;
  /** Set on the empty list's one "Now" row (slice 78), which leads every other group. */
  now?: string;
  /** Match strength; a Top hit needs a prefix match or better (see TOP_HIT_MIN_SCORE). */
  score?: number;
  /** The visible name. A Top hit must match it, not a hidden alias. */
  title?: string;
}

export interface CommandCenterResultGroup<T extends CommandCenterPresentableResult> {
  id: CommandCenterResultGroupId;
  results: T[];
}

export interface CommandCenterPresentation<T extends CommandCenterPresentableResult> {
  filter: CommandCenterCategoryFilter;
  results: T[];
  groups: CommandCenterResultGroup<T>[];
  categoryAvailability: Record<CommandCenterCategoryFilter, number>;
}

export interface CommandDefinition {
  id: string;
  title: string;
  kind: CommandKind;
  icon: CommandIcon;
  aliases?: readonly string[];
  /** Looser synonyms (O3): matched, but scored below a label/alias match. */
  keywords?: readonly string[];
  target?: ProfessorMariNavigationTarget;
  description?: string;
  availability?: {
    status: "available" | "requires-capability" | "requires-admin";
    capability?: string;
    setupTarget?: boolean;
  };
}

export interface CommandResult {
  command: CommandDefinition;
  score: number;
}

export interface CommandRecentEntry {
  id: string;
  lastUsedAt: number;
  useCount: number;
}

export interface CommandRankingState {
  recent: CommandRecentEntry[];
}

export interface RankedCommandResult<T extends CommandResult = CommandResult> {
  result: T;
  rankingScore: number;
}

interface CommandStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const COMMAND_RANKING_STORAGE_KEY = "marinara:command-center:ranking:v1";
export const COMMAND_CENTER_SESSION_STORAGE_KEY = "marinara:command-center:session:v1";
export const COMMAND_CENTER_MAX_RESULTS = 75;
export const COMMAND_CENTER_CATEGORY_FILTERS: readonly CommandCenterCategoryFilter[] = [
  "all",
  "chats",
  "characters",
  "personas",
  "lorebooks",
  "presets",
  "connections",
  "agents",
  "settings",
  "docs",
];
export const COMMAND_CENTER_SEARCH_GROUP_ORDER: readonly CommandCenterResultGroupId[] = [
  // Intent rows ("Remove Eliza from this chat") first: the user named the verb,
  // so acting on the object beats another way to look at it. Omitting this group
  // dropped those rows back into their category bucket, where a same-named chat
  // outranked them.
  "current-work",
  "professor-suggested",
  "top-hit",
  "navigation",
  "chats",
  "characters",
  "personas",
  "lorebooks",
  "presets",
  "connections",
  "agents",
  "settings",
  // Message hits from other chats and docs arrive after a server round trip.
  // Last, so a late answer never pushes down a row the arrow keys are on.
  "messages",
  "lorebook-entries",
  "docs",
  "professor-fallback",
];
// UX-07: for a question, Ask Mari comes before the message and docs groups, which a question matches loosely.
const COMMAND_CENTER_QUESTION_GROUP_ORDER = COMMAND_CENTER_SEARCH_GROUP_ORDER.flatMap((id) =>
  id === "messages" ? ["professor-fallback", id] : id === "professor-fallback" ? [] : [id],
) as readonly CommandCenterResultGroupId[];
// Slice 78: what needs you, then the first-use examples, then where you left off, then this screen.
const COMMAND_CENTER_EMPTY_GROUP_ORDER = [
  "now",
  "try",
  "continue",
  "current-work",
  // O2: the surface's most frecent rows lead the fallback, above plain "last used anywhere" recents.
  "frecent",
  "recent",
  "quick-controls",
  "create-navigation",
] as const satisfies readonly CommandCenterResultGroupId[];
// UX-14: a returning user (with a Continue row) resumes first; Try examples sit below the work. A row
// that needs you (`now`) still leads.
const COMMAND_CENTER_RETURNING_GROUP_ORDER = [
  "now",
  "continue",
  "current-work",
  "try",
  "frecent",
  "recent",
  "quick-controls",
  "create-navigation",
] as const satisfies readonly CommandCenterResultGroupId[];
const MAX_RECENT_COMMANDS = 100;
const MAX_COMMAND_ID_LENGTH = 256;
const MAX_USE_COUNT = 10_000;
const RECENCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** The list, or the one surface that has taken it over. */
export type CommandCenterPane = "results" | "mari";

/**
 * A task handed to Professor Mari, held in session state rather than component
 * state because the omnibar dialog unmounts on close. `pending` means she has
 * not started, `working` that she has been seen active, and `finished` that she
 * stopped after working — the transition the omnibar offers actions for.
 */
export interface CommandCenterMariHandoff {
  status: "pending" | "working" | "finished";
  context: ProfessorMariAskContext | null;
  draft?: string;
  /** Set once by a cold (omnibar-closed) handoff; the dialog consumes and clears it on mount. */
  submitDraft?: boolean;
}

export interface CommandCenterSessionState {
  query: string;
  filter: CommandCenterCategoryFilter;
  pane: CommandCenterPane;
  activeResultId: string | null;
  mariReturnResultId: string | null;
  mariHandoff: CommandCenterMariHandoff | null;
}

export const DEFAULT_COMMAND_CENTER_SESSION_STATE: CommandCenterSessionState = {
  query: "",
  filter: "all",
  pane: "results",
  activeResultId: null,
  mariReturnResultId: null,
  mariHandoff: null,
};

function getCommandCenterSessionStorage(): CommandStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function normalizeCommandCenterSessionState(value: unknown): CommandCenterSessionState {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const filter = COMMAND_CENTER_CATEGORY_FILTERS.includes(source.filter as CommandCenterCategoryFilter)
    ? (source.filter as CommandCenterCategoryFilter)
    : "all";
  // A session persisted before the browse, detail and quick panes were removed
  // falls back to the list. `mari` is preserved on purpose: `GlobalOmnibarHost`
  // requests Professor Mari by writing that pane and then opening the omnibar.
  // The "always reopen on the list" rule is enforced where it belongs, by the
  // omnibar persisting `results` when it closes.
  const pane = source.pane === "mari" ? "mari" : "results";
  const stringOrNull = (next: unknown) => (typeof next === "string" && next.trim() ? next.trim() : null);

  return {
    query: typeof source.query === "string" ? source.query.slice(0, 500) : "",
    filter,
    pane,
    activeResultId: stringOrNull(source.activeResultId),
    mariReturnResultId: stringOrNull(source.mariReturnResultId),
    mariHandoff: normalizeMariHandoff(source.mariHandoff),
  };
}

/**
 * Moves a handed-off task along as Mari's active flag changes. `pending` only
 * becomes `finished` by way of `working`, so a handoff she never picked up does
 * not look finished on the next poll. Idempotent: the same flag twice is a
 * no-op, which is what makes the persisted status survive the omnibar closing.
 */
export function advanceMariHandoff(
  handoff: CommandCenterMariHandoff | null,
  mariActive: boolean,
): CommandCenterMariHandoff | null {
  if (!handoff) return null;
  const status = mariActive ? "working" : handoff.status === "working" ? "finished" : handoff.status;
  return status === handoff.status ? handoff : { ...handoff, status };
}

function normalizeMariHandoff(value: unknown): CommandCenterMariHandoff | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const status = source.status;
  if (status !== "pending" && status !== "working" && status !== "finished") return null;
  const rawContext =
    source.context && typeof source.context === "object" && !Array.isArray(source.context)
      ? (source.context as Record<string, unknown>)
      : null;
  const capability =
    typeof rawContext?.capability === "string" && rawContext.capability in PROFESSOR_MARI_CAPABILITY_CATALOG
      ? (rawContext.capability as ProfessorMariCapability)
      : null;
  const resourceKinds = new Set<ProfessorMariContextResource["kind"]>([
    "character",
    "persona",
    "lorebook",
    "preset",
    "connection",
    "agent",
    "setting",
    "chat",
    "game",
  ]);
  const rawResource =
    rawContext?.resource && typeof rawContext.resource === "object" && !Array.isArray(rawContext.resource)
      ? (rawContext.resource as Record<string, unknown>)
      : null;
  const resourceKind =
    typeof rawResource?.kind === "string" && resourceKinds.has(rawResource.kind as ProfessorMariContextResource["kind"])
      ? (rawResource.kind as ProfessorMariContextResource["kind"])
      : null;
  const resourceId = typeof rawResource?.id === "string" ? rawResource.id.trim().slice(0, 200) : "";
  const resource =
    resourceKind && resourceId
      ? {
          kind: resourceKind,
          id: resourceId,
          ...(typeof rawResource?.label === "string" ? { label: rawResource.label.trim().slice(0, 200) } : {}),
        }
      : undefined;
  const field = typeof rawContext?.field === "string" ? rawContext.field.trim().slice(0, 200) : "";
  const fieldId = typeof rawContext?.fieldId === "string" ? rawContext.fieldId.trim().slice(0, 200) : "";
  const action = typeof rawContext?.action === "string" ? rawContext.action.slice(0, 500) : "";
  const rawError =
    rawContext?.error && typeof rawContext.error === "object" && !Array.isArray(rawContext.error)
      ? (rawContext.error as Record<string, unknown>)
      : null;
  const errorMessage = typeof rawError?.message === "string" ? rawError.message.slice(0, 2_000) : "";
  const error = errorMessage
    ? { message: errorMessage, ...(typeof rawError?.code === "string" ? { code: rawError.code.slice(0, 200) } : {}) }
    : undefined;
  const rawActiveChat =
    rawContext?.activeChat && typeof rawContext.activeChat === "object" && !Array.isArray(rawContext.activeChat)
      ? (rawContext.activeChat as Record<string, unknown>)
      : null;
  const activeChatId = typeof rawActiveChat?.id === "string" ? rawActiveChat.id.trim().slice(0, 256) : "";
  const activeChat = activeChatId
    ? {
        id: activeChatId,
        ...(typeof rawActiveChat?.label === "string" ? { label: rawActiveChat.label.slice(0, 200) } : {}),
        ...(typeof rawActiveChat?.mode === "string" ? { mode: rawActiveChat.mode.slice(0, 32) } : {}),
      }
    : undefined;
  const rawSettingsLocation =
    rawContext?.settingsLocation &&
    typeof rawContext.settingsLocation === "object" &&
    !Array.isArray(rawContext.settingsLocation)
      ? (rawContext.settingsLocation as Record<string, unknown>)
      : null;
  const settingsLocation = rawSettingsLocation
    ? {
        ...(typeof rawSettingsLocation.tab === "string" ? { tab: rawSettingsLocation.tab.slice(0, 64) } : {}),
        ...(typeof rawSettingsLocation.controlId === "string"
          ? { controlId: rawSettingsLocation.controlId.slice(0, 128) }
          : {}),
      }
    : undefined;
  const rawAsideAnswer =
    rawContext?.asideAnswer && typeof rawContext.asideAnswer === "object" && !Array.isArray(rawContext.asideAnswer)
      ? (rawContext.asideAnswer as Record<string, unknown>)
      : null;
  const asideAnswerTier: "local" | "remote" | null =
    rawAsideAnswer?.tier === "local" || rawAsideAnswer?.tier === "remote"
      ? (rawAsideAnswer.tier as "local" | "remote")
      : null;
  // The docs pages the quick answer used, kept only when well formed; they are shown under the hand-off card.
  const asideSources = Array.isArray(rawAsideAnswer?.sources)
    ? rawAsideAnswer.sources.flatMap((item: unknown) => {
        const source = item as Record<string, unknown> | null;
        return source && typeof source.path === "string" && typeof source.heading === "string"
          ? [{ path: source.path.slice(0, 300), heading: source.heading.slice(0, 300) }]
          : [];
      })
    : [];
  const asideAnswer =
    asideAnswerTier && typeof rawAsideAnswer?.query === "string" && typeof rawAsideAnswer?.answer === "string"
      ? {
          query: rawAsideAnswer.query.slice(0, 500),
          answer: rawAsideAnswer.answer.slice(0, 4_000),
          tier: asideAnswerTier,
          ...(asideSources.length ? { sources: asideSources.slice(0, 3) } : {}),
        }
      : undefined;
  const context: CommandCenterMariHandoff["context"] = capability
    ? {
        source: "command-center",
        capability,
        query: typeof rawContext?.query === "string" ? rawContext.query.slice(0, 500) : undefined,
        ...(resource ? { resource } : {}),
        ...(field ? { field } : {}),
        ...(fieldId ? { fieldId } : {}),
        ...(error ? { error } : {}),
        ...(action ? { action } : {}),
        ...(activeChat ? { activeChat } : {}),
        ...(settingsLocation ? { settingsLocation } : {}),
        ...(asideAnswer ? { asideAnswer } : {}),
      }
    : null;
  const draft = typeof source.draft === "string" ? source.draft.slice(0, 500) : undefined;
  const submitDraft = source.submitDraft === true;
  return { status, context, ...(draft ? { draft } : {}), ...(submitDraft ? { submitDraft } : {}) };
}

export function readCommandCenterSessionState(
  storage: CommandStorage | null = getCommandCenterSessionStorage(),
): CommandCenterSessionState {
  if (!storage) return DEFAULT_COMMAND_CENTER_SESSION_STATE;
  try {
    return normalizeCommandCenterSessionState(
      JSON.parse(storage.getItem(COMMAND_CENTER_SESSION_STORAGE_KEY) ?? "null"),
    );
  } catch {
    return DEFAULT_COMMAND_CENTER_SESSION_STATE;
  }
}

export function writeCommandCenterSessionState(
  state: CommandCenterSessionState,
  storage: CommandStorage | null = getCommandCenterSessionStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(COMMAND_CENTER_SESSION_STORAGE_KEY, JSON.stringify(normalizeCommandCenterSessionState(state)));
    return true;
  } catch {
    return false;
  }
}

function normalizeCommandId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id && id.length <= MAX_COMMAND_ID_LENGTH ? id : null;
}

function normalizeTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function getBrowserStorage(): CommandStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeCommandRankingState(value: unknown): CommandRankingState {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  // R9: a stale `pinnedIds` field from a state saved before pinning was removed is simply
  // dropped here, never read — so a "Pinned" group cannot silently reappear from old data.
  const recentById = new Map<string, CommandRecentEntry>();
  for (const value of Array.isArray(source.recent) ? source.recent : []) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    const id = normalizeCommandId(entry.id);
    const lastUsedAt = normalizeTimestamp(entry.lastUsedAt);
    if (!id || lastUsedAt === null) continue;
    const useCount =
      typeof entry.useCount === "number" && Number.isFinite(entry.useCount)
        ? Math.max(1, Math.min(MAX_USE_COUNT, Math.floor(entry.useCount)))
        : 1;
    const current = recentById.get(id);
    if (!current || lastUsedAt > current.lastUsedAt) recentById.set(id, { id, lastUsedAt, useCount });
  }

  return {
    recent: [...recentById.values()].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, MAX_RECENT_COMMANDS),
  };
}

export function readCommandRankingState(storage: CommandStorage | null = getBrowserStorage()): CommandRankingState {
  if (!storage) return { recent: [] };
  try {
    return normalizeCommandRankingState(JSON.parse(storage.getItem(COMMAND_RANKING_STORAGE_KEY) ?? "null"));
  } catch {
    return { recent: [] };
  }
}

export function writeCommandRankingState(
  state: CommandRankingState,
  storage: CommandStorage | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(COMMAND_RANKING_STORAGE_KEY, JSON.stringify(normalizeCommandRankingState(state)));
    return true;
  } catch {
    return false;
  }
}

export function recordCommandUse(state: CommandRankingState, commandId: string, now = Date.now()): CommandRankingState {
  const id = normalizeCommandId(commandId);
  const lastUsedAt = normalizeTimestamp(now);
  if (!id || lastUsedAt === null) return normalizeCommandRankingState(state);
  const current = state.recent.find((entry) => entry.id === id);
  return normalizeCommandRankingState({
    ...state,
    recent: [
      { id, lastUsedAt, useCount: Math.min(MAX_USE_COUNT, (current?.useCount ?? 0) + 1) },
      ...state.recent.filter((entry) => entry.id !== id),
    ],
  });
}

export function rankCommandResults<T extends CommandResult>(
  results: readonly T[],
  state: CommandRankingState,
  now = Date.now(),
): RankedCommandResult<T>[] {
  const normalized = normalizeCommandRankingState(state);
  const recent = new Map(normalized.recent.map((entry) => [entry.id, entry]));
  const currentTime = normalizeTimestamp(now) ?? Date.now();

  return results
    .map((result, index) => {
      const entry = recent.get(result.command.id);
      const age = entry ? Math.max(0, currentTime - entry.lastUsedAt) : RECENCY_WINDOW_MS;
      const recencyBoost = entry ? Math.max(0, 40 * (1 - age / RECENCY_WINDOW_MS)) : 0;
      const frequencyBoost = entry ? Math.min(20, Math.log2(entry.useCount + 1) * 4) : 0;
      return {
        result,
        rankingScore: result.score + recencyBoost + frequencyBoost,
        index,
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore || a.index - b.index)
    .map(({ index: _index, ...result }) => result);
}

const FILTER_CATEGORY: Record<Exclude<CommandCenterCategoryFilter, "all">, CommandCenterResultCategory> = {
  chats: "chat",
  characters: "character",
  personas: "persona",
  lorebooks: "lorebook",
  presets: "preset",
  connections: "connection",
  agents: "agent",
  settings: "settings",
  docs: "docs",
};

const CATEGORY_GROUP: Partial<Record<CommandCenterResultCategory, CommandCenterResultGroupId>> = {
  navigation: "navigation",
  chat: "chats",
  character: "characters",
  persona: "personas",
  lorebook: "lorebooks",
  preset: "presets",
  connection: "connections",
  agent: "agents",
  settings: "settings",
  docs: "docs",
  professor: "navigation",
};

/** Prefix match or better: see the text scores in omnibar-search (exact 300+, prefix 200+). */
const TOP_HIT_MIN_SCORE = 200;
/**
 * Groups a Top hit is never taken from: the ones already above it, and the ones
 * whose rows arrive after a server round trip, which would change the top row
 * while the arrow keys are on it.
 */
const NEVER_TOP_HIT = new Set<CommandCenterResultGroupId>([
  "now",
  "try",
  "current-work",
  "context",
  "continue",
  "professor-suggested",
  "professor-fallback",
  "messages",
  "lorebook-entries",
  "docs",
]);

/**
 * Groups render in a fixed category order, so without this the best match could
 * sit below weaker rows of an earlier category. The best-ranked strong match is
 * lifted to the top, unless it is already the first row there.
 */
function findTopHit<T extends CommandCenterPresentableResult>(
  ranked: readonly T[],
  groupOf: (result: T) => CommandCenterResultGroupId,
  query: string,
): T | null {
  const typed = normalizeTextForMatch(query);
  // The typed text must start the visible title or one of its words: a row found
  // through an alias ("theme" finding Accent Color) is a fair result but a
  // confusing Top hit, and it would take Enter from the row the user meant.
  const eligible = ranked.filter(
    (result) => !NEVER_TOP_HIT.has(groupOf(result)) && (result.score ?? 0) >= TOP_HIT_MIN_SCORE,
  );
  // A row that names itself the Top hit (Open Mari for "mari") wins over a title-prefix guess.
  const pinned = ranked.find((result) => groupOf(result) === "top-hit");
  if (pinned) return pinned;
  const name = (result: T) => normalizeTextForMatch(result.title);
  // A title that starts with the text beats one where only a later word does:
  // "persona" leads with Persona library, not Show Characters in Persona Pickers.
  const candidate =
    eligible.find((result) => name(result).startsWith(typed)) ??
    eligible.find((result) => name(result).includes(` ${typed}`));
  if (!candidate) return null;
  const firstShown = COMMAND_CENTER_SEARCH_GROUP_ORDER.filter((id) => !NEVER_TOP_HIT.has(id))
    .map((id) => ranked.find((result) => groupOf(result) === id))
    .find(Boolean);
  return firstShown === candidate ? null : candidate;
}

export function presentCommandCenterResults<T extends CommandCenterPresentableResult>(
  rankedResults: readonly T[],
  options: {
    query: string;
    filter?: CommandCenterCategoryFilter;
    rankingState?: CommandRankingState;
  },
): CommandCenterPresentation<T> {
  const filter = options.filter ?? "all";
  const uniqueResults: T[] = [];
  const seenIds = new Set<string>();
  for (const result of rankedResults) {
    if (seenIds.has(result.id)) continue;
    seenIds.add(result.id);
    uniqueResults.push(result);
  }
  const categoryAvailability = Object.fromEntries(
    COMMAND_CENTER_CATEGORY_FILTERS.map((category) => [
      category,
      category === "all"
        ? uniqueResults.length
        : uniqueResults.filter((result) => result.category === FILTER_CATEGORY[category]).length,
    ]),
  ) as Record<CommandCenterCategoryFilter, number>;
  const results = uniqueResults
    .filter((result) => filter === "all" || result.category === FILTER_CATEGORY[filter])
    .slice(0, COMMAND_CENTER_MAX_RESULTS);
  const groups = new Map<CommandCenterResultGroupId, T[]>();
  const addToGroup = (id: CommandCenterResultGroupId, result: T) => {
    const group = groups.get(id);
    if (group) group.push(result);
    else groups.set(id, [result]);
  };

  if (!options.query.trim()) {
    const ranking = normalizeCommandRankingState(options.rankingState);
    const recentIds = new Set(ranking.recent.map((entry) => entry.id));
    for (const result of results) {
      if (result.now) addToGroup("now", result);
      else if (result.group === "try") addToGroup("try", result);
      else if (result.group === "current-work" || result.group === "context") addToGroup("current-work", result);
      else if (result.group === "continue") addToGroup("continue", result);
      else if (result.group === "frecent") addToGroup("frecent", result);
      else if (result.group === "recent" || recentIds.has(result.id)) addToGroup("recent", result);
      else if (result.control) addToGroup("quick-controls", result);
      else addToGroup("create-navigation", result);
    }
    const groupOrder = groups.has("continue") ? COMMAND_CENTER_RETURNING_GROUP_ORDER : COMMAND_CENTER_EMPTY_GROUP_ORDER;
    const presentedGroups = groupOrder.flatMap((id) => {
      const groupResults = groups.get(id);
      return groupResults ? [{ id, results: groupResults }] : [];
    });
    return {
      filter,
      results: presentedGroups.flatMap((group) => group.results),
      groups: presentedGroups,
      categoryAvailability,
    };
  }

  // An explicit group wins when it is one this view renders; otherwise the
  // result would silently vanish into a group nobody lists.
  const groupOf = (result: T): CommandCenterResultGroupId =>
    result.id === "ask-professor-mari"
      ? (result.group ?? "professor-fallback")
      : result.group && COMMAND_CENTER_SEARCH_GROUP_ORDER.includes(result.group)
        ? result.group
        : (CATEGORY_GROUP[result.category] ?? "navigation");
  const topHit = findTopHit(results, groupOf, options.query);
  for (const result of results) {
    addToGroup(result === topHit ? "top-hit" : groupOf(result), result);
  }
  const groupOrder = isQuestionShaped(options.query)
    ? COMMAND_CENTER_QUESTION_GROUP_ORDER
    : COMMAND_CENTER_SEARCH_GROUP_ORDER;
  const presentedGroups = groupOrder.flatMap((id) => {
    const groupResults = groups.get(id);
    return groupResults ? [{ id, results: groupResults }] : [];
  });
  return {
    filter,
    results: presentedGroups.flatMap((group) => group.results),
    groups: presentedGroups,
    categoryAvailability,
  };
}

export interface OmnibarShortcutEvent {
  key: string;
  code?: string;
  repeat?: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform ?? "");
}

/**
 * Cmd+K on Apple devices, Ctrl+K elsewhere. Only the platform's own modifier
 * counts: on macOS Ctrl+K is the text fields' "delete to end of line" binding.
 * Non-Latin layouts report the local letter in `key`, so the physical K key is
 * matched through `code`. Held-down repeats would toggle the bar open and shut.
 */
export function isOmnibarShortcut(event: OmnibarShortcutEvent, apple = isApplePlatform()): boolean {
  return isModLetterShortcut(event, "k", apple);
}

/** M18: Cmd+J / Ctrl+J, "Ask Prof. Mari about this". Same rules as {@link isOmnibarShortcut}. */
export function isAskMariShortcut(event: OmnibarShortcutEvent, apple = isApplePlatform()): boolean {
  return isModLetterShortcut(event, "j", apple);
}

function isModLetterShortcut(event: OmnibarShortcutEvent, letter: string, apple: boolean): boolean {
  const modifier = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!modifier || event.altKey || event.shiftKey || event.repeat) return false;
  const key = event.key.toLowerCase();
  return key === letter || (!/^[a-z]$/.test(key) && event.code === `Key${letter.toUpperCase()}`);
}
