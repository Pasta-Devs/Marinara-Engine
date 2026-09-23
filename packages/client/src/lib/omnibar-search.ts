import {
  normalizeProfessorMariNavigationQuery,
  type ProfessorMariBrowserTab,
  type ProfessorMariNavigationChat,
  type ProfessorMariNavigationResource,
  type ProfessorMariNavigationTarget,
} from "./professor-mari-navigation";
import type {
  CommandCenterResultGroupId,
  CommandCenterResultMedia,
  CommandCenterResultMetadata,
  CommandIcon,
  CommandKind,
} from "./command-center";
import type { CommandCenterPreviewData } from "../components/command-center/command-result-preview.types";
import type { ChatResourceDragKind } from "./chat-resource-drag";

export type OmnibarCategory =
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
/**
 * What choosing a result does, when it is not the generic "open this entity"
 * path. Results without an action fall back to their `target` / category.
 * Result ids stay opaque: they are keys and ranking handles, never a protocol.
 */
export type OmnibarAction =
  | { kind: "open-mari-chat"; chatId: string }
  | { kind: "slash"; command: string }
  | { kind: "goto-message"; chatId: string; messageNumber: number }
  | { kind: "detach-from-chat"; resource: ChatResourceDragKind; resourceId: string; label: string }
  | { kind: "add-to-chat"; resource: ChatResourceDragKind; resourceId: string; label: string }
  | { kind: "refine-query"; query: string }
  | { kind: "personal-extension"; commandId: string }
  | { kind: "open-docs"; path?: string }
  | { kind: "open-faq"; itemId: string };

export type OmnibarResult = {
  id: string;
  title: string;
  category: OmnibarCategory;
  target?: ProfessorMariNavigationTarget;
  score: number;
  action?: OmnibarAction;
  aliases?: readonly string[];
  description?: string;
  preview?: () => CommandCenterPreviewData;
  metadata?: readonly CommandCenterResultMetadata[];
  media?: CommandCenterResultMedia;
  group?: CommandCenterResultGroupId;
  source?: string;
  snippet?: string;
  path?: string;
  line?: number | null;
  contextLabel?: string;
  /** Internal search tier used to discard fuzzy rows once a literal match exists. */
  matchKind?: "literal" | "fuzzy";
  control?: {
    type: "toggle" | "choice";
    label: string;
    value: string | boolean;
    options?: readonly { value: string; label: string }[];
    onChange: (value: string | boolean) => void;
  };
  /**
   * Set on rows produced by expanding a choice control: picking the row applies
   * that value. It lives on the row so a row found by typing works even when its
   * parent control is not in the ranked list.
   */
  chooseValue?: () => void;
  kind?: CommandKind;
  icon?: CommandIcon;
  availability?:
    | "available"
    | "unavailable"
    | { status: "available" | "requires-capability" | "requires-admin"; capability?: string; setupTarget?: boolean };
};
export type OmnibarSearchData = {
  commands: readonly {
    id: string;
    title: string;
    target?: ProfessorMariNavigationTarget;
    action?: OmnibarAction;
    aliases?: readonly string[];
    kind?: CommandKind;
    icon?: CommandIcon;
    availability?: {
      status: "available" | "requires-capability" | "requires-admin";
      capability?: string;
      setupTarget?: boolean;
    };
  }[];
  chats: readonly (ProfessorMariNavigationChat & {
    mode?: string;
    description?: string;
    preview?: () => CommandCenterPreviewData;
  })[];
  resources: readonly (ProfessorMariNavigationResource & {
    description?: string;
    preview?: () => CommandCenterPreviewData;
  })[];
  connections: readonly {
    id: string;
    name: string;
    provider?: string;
    model?: string;
    isDefault?: boolean;
    imagePath?: string | null;
    preview?: () => CommandCenterPreviewData;
  }[];
  browserTabs?: readonly ProfessorMariBrowserTab[];
  controls?: readonly OmnibarResult[];
  context?: OmnibarContext;
  contextLabels?: Partial<Record<OmnibarContextReason, string>>;
  askProfessorTitle?: string;
};

export type OmnibarIntentKind = "navigate" | "action" | "create" | "explain" | "recommend" | "repair";

export type OmnibarIntent = {
  kind: OmnibarIntentKind;
  verb: string;
  targetQuery: string;
  /** Set when the query names the object kind ("add character eliza"), so the search can narrow to it. */
  objectCategory?: OmnibarCategory;
};

export type OmnibarSurface = "home" | "chat" | "editor" | "settings" | "library" | "game";
export type OmnibarContextReason =
  | "surface"
  | "open-resource"
  | "active-chat"
  | "settings-target"
  | "dirty"
  | "setup"
  | "error"
  | "pinned"
  | "recent";

export type OmnibarContext = {
  surface: OmnibarSurface;
  surfaceResultIds: readonly string[];
  activeChat?: { id: string; mode?: string; resultIds: readonly string[] };
  openResource?: { kind: OmnibarCategory; id: string; resultId: string };
  settingsTarget?: { tab?: string; controlId?: string; resultId: string };
  editorDirty: boolean;
  pinnedResultIds: readonly string[];
  recentResultIds: readonly string[];
  setupResultIds: readonly string[];
  error?: { resultIds: readonly string[]; message?: string };
};

const MAX_CONTEXT_IDS = 32;

function boundedIds(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).filter((value) => value.trim()).map((value) => value.slice(0, 256)))].slice(
    0,
    MAX_CONTEXT_IDS,
  );
}

export function createOmnibarContext(input: Partial<OmnibarContext> & Pick<OmnibarContext, "surface">): OmnibarContext {
  const openResource = input.openResource;
  const settingsTarget = input.settingsTarget;
  return {
    surface: input.surface,
    surfaceResultIds: boundedIds(input.surfaceResultIds),
    activeChat: input.activeChat
      ? {
          id: input.activeChat.id.slice(0, 256),
          mode: input.activeChat.mode?.slice(0, 32),
          resultIds: boundedIds(input.activeChat.resultIds),
        }
      : undefined,
    openResource: openResource
      ? {
          kind: openResource.kind,
          id: openResource.id.slice(0, 256),
          resultId: openResource.resultId.slice(0, 256),
        }
      : undefined,
    settingsTarget: settingsTarget
      ? {
          tab: settingsTarget.tab?.slice(0, 64),
          controlId: settingsTarget.controlId?.slice(0, 128),
          resultId: settingsTarget.resultId.slice(0, 256),
        }
      : undefined,
    editorDirty: input.editorDirty === true,
    pinnedResultIds: boundedIds(input.pinnedResultIds),
    recentResultIds: boundedIds(input.recentResultIds),
    setupResultIds: boundedIds(input.setupResultIds),
    error: input.error
      ? { resultIds: boundedIds(input.error.resultIds), message: input.error.message?.slice(0, 160) }
      : undefined,
  };
}

/**
 * Words naming an object kind, so "add character eliza" narrows to characters
 * instead of searching for the literal word "character". Plurals included
 * because a verb phrase reads either way ("open characters").
 */
const OBJECT_KIND_WORDS: readonly [OmnibarCategory, RegExp][] = [
  ["character", /^characters?\b\s*/],
  ["persona", /^personas?\b\s*/],
  ["lorebook", /^lorebooks?\b\s*/],
  ["preset", /^presets?\b\s*/],
  ["connection", /^connections?\b\s*/],
  ["agent", /^agents?\b\s*/],
  ["chat", /^chats?\b\s*/],
  ["settings", /^settings?\b\s*/],
];

const INTENT_PATTERNS: readonly [OmnibarIntentKind, RegExp][] = [
  ["navigate", /^(open|show|go\s+to)\b\s*/],
  ["action", /^(add|use|activate|set|enable|disable|turn\s+on|turn\s+off|remove|drop|detach)\b\s*/],
  ["create", /^(create|new|import)\b\s*/],
  ["explain", /^(explain|why|how)\b\s*/],
  ["recommend", /^(compare|recommend|improve)\b\s*/],
  ["repair", /^(fix|broken|failed|error)\b\s*/],
];

export function parseOmnibarIntent(query: string): OmnibarIntent | null {
  const normalized = normalizeProfessorMariNavigationQuery(query);
  for (const [kind, pattern] of INTENT_PATTERNS) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const targetQuery = normalized
      .slice(match[0].length)
      .replace(/^(?:a|an|the)\s+/, "")
      .replace(/\s+(?:to\s+this\s+chat|in\s+this\s+chat|as\s+(?:the\s+)?default)$/, "")
      .trim();
    const verb = match[1]!.replace(/\s+/g, " ");
    const objectKind = OBJECT_KIND_WORDS.find(([, pattern]) => pattern.test(targetQuery));
    if (!objectKind) return { kind, verb, targetQuery };
    return {
      kind,
      verb,
      targetQuery: targetQuery.replace(objectKind[1], "").trim(),
      objectCategory: objectKind[0],
    };
  }
  if (/\b(?:broken|failed|error)\b/.test(normalized)) {
    return { kind: "repair", verb: normalized.match(/\b(broken|failed|error)\b/)![1]!, targetQuery: normalized };
  }
  return null;
}

/** Verbs that take something away. "disable" belongs here: disabling a lorebook detaches it. */
const DETACHING_VERBS = /^(?:remove|drop|detach|disable|turn\s+off)\b/i;

export function isOmnibarRemovalIntent(query: string): boolean {
  return DETACHING_VERBS.test(normalizeProfessorMariNavigationQuery(query));
}

/**
 * The attach half of the action intent: "add Eliza", "use this preset". Shares
 * the `action` verb list with removal, so it is defined as "an action intent
 * that is not a removal" rather than a second verb list that can drift.
 * "disable Tavern" therefore never offers to attach Tavern.
 */
/**
 * A verb typed on its own, with no object yet: "add", "open", "enable". Returns
 * the intent so the caller can build the list of things that can follow it.
 * A verb with a named kind ("add character") is not bare — the search narrows
 * to that kind instead.
 */
export function isOmnibarRefinableVerb(query: string): OmnibarIntent | null {
  const intent = parseOmnibarIntent(query);
  if (!intent || intent.targetQuery || intent.objectCategory) return null;
  return intent.kind === "action" || intent.kind === "navigate" || intent.kind === "create" ? intent : null;
}

export function isOmnibarAddIntent(query: string): boolean {
  return parseOmnibarIntent(query)?.kind === "action" && !isOmnibarRemovalIntent(query);
}

export type OmnibarActiveChatContext = {
  id: string;
  characterIds?: readonly string[];
  personaId?: string | null;
  promptPresetId?: string | null;
  connectionId?: string | null;
  lorebookIds?: readonly string[];
  enableAgents?: boolean;
  activeAgentIds?: readonly string[];
};

export function getOmnibarActiveChatContextResultIds(
  activeChatId: string | null | undefined,
  chat: OmnibarActiveChatContext | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!activeChatId || !chat || chat.id !== activeChatId) return ids;
  ids.add(`chat:${chat.id}`);
  for (const characterId of chat.characterIds ?? []) ids.add(`character:${characterId}`);
  if (chat.personaId) ids.add(`persona:${chat.personaId}`);
  if (chat.promptPresetId) ids.add(`preset:${chat.promptPresetId}`);
  if (chat.connectionId) ids.add(`connection:${chat.connectionId}`);
  for (const lorebookId of chat.lorebookIds ?? []) ids.add(`lorebook:${lorebookId}`);
  if (chat.enableAgents) {
    for (const agentId of chat.activeAgentIds ?? []) ids.add(`agent:${agentId}`);
  }
  return ids;
}

/** Resource kinds whose icon is not the generic package. */
const RESOURCE_ICONS: Partial<Record<string, CommandIcon>> = {
  character: "character",
  persona: "persona",
  lorebook: "lorebook",
  preset: "preset",
  agent: "agent",
};

/** A query no normalised title can equal, so a bare verb matches nothing by text. */
const NO_MATCH = "\u0000";

/**
 * The bottom rung under exact, prefix, whole-word and substring: the query's
 * letters appear in order but not together. It catches a typo ("elzia" for
 * "eliza") and initials ("pm" for "professor mari"). Scored below every literal
 * match so it only decides what would otherwise find nothing, and floored at
 * three characters because shorter queries match almost any title.
 */
export function scoreSubsequence(query: string, value: string) {
  if (query.length < 3) return -1;
  let index = 0;
  for (const character of value) {
    if (character === query[index] && ++index === query.length) {
      // Prefer the shortest title that contains the run: "PM" should find
      // "Professor Mari" before "Preset Manager Settings".
      return Math.max(1, 60 - value.length);
    }
  }
  return -1;
}

function scoreText(query: string, values: readonly string[]) {
  return values.reduce((best, value) => {
    const normalized = normalizeProfessorMariNavigationQuery(value);
    if (!normalized) return best;
    if (normalized === query) return Math.max(best, 300 + normalized.length);
    if (normalized.startsWith(query)) return Math.max(best, 200 + query.length);
    if (query.length >= 2 && ` ${normalized} `.includes(` ${query} `)) {
      return Math.max(best, 150 + query.length);
    }
    if (normalized.includes(query)) return Math.max(best, 100 + query.length);
    return Math.max(best, scoreSubsequence(query, normalized));
  }, -1);
}

function scoreContainedText(query: string, values: readonly string[]) {
  return values.reduce((best, value) => {
    const normalized = normalizeProfessorMariNavigationQuery(value);
    if (normalized.length < 2 || normalized.length >= query.length) return best;
    return query.includes(normalized) ? Math.max(best, 150 + normalized.length) : best;
  }, -1);
}

function scoreIntent(
  intent: OmnibarIntent | null,
  result: Pick<OmnibarResult, "id" | "category" | "kind" | "availability" | "control">,
) {
  if (!intent) return 0;
  if (intent.kind === "navigate") return result.category === "navigation" || result.kind === "resource" ? 70 : 25;
  if (intent.kind === "action")
    return result.kind === "action" || result.control ? 80 : result.kind === "resource" ? 55 : 0;
  if (intent.kind === "create") return /^(?:create-|import-)/.test(result.id) ? 100 : 0;
  if (intent.kind === "explain") return result.category === "docs" ? 80 : result.category === "settings" ? 25 : 0;
  if (intent.kind === "repair") {
    return typeof result.availability === "object" && result.availability.status === "requires-capability" ? 90 : 0;
  }
  return 0;
}

function getContextScore(resultId: string, context: OmnibarContext | undefined) {
  if (!context) return { score: 0, reason: undefined };
  const matches = (ids: readonly string[]) => ids.includes(resultId);
  if (context.openResource?.resultId === resultId)
    return { score: 80, reason: context.editorDirty ? ("dirty" as const) : ("open-resource" as const) };
  if (context.settingsTarget?.resultId === resultId) return { score: 80, reason: "settings-target" as const };
  if (context.activeChat && matches(context.activeChat.resultIds)) return { score: 55, reason: "active-chat" as const };
  if (context.error && matches(context.error.resultIds)) return { score: 50, reason: "error" as const };
  if (matches(context.setupResultIds)) return { score: 35, reason: "setup" as const };
  if (matches(context.surfaceResultIds)) return { score: 30, reason: "surface" as const };
  if (matches(context.pinnedResultIds)) return { score: 25, reason: "pinned" as const };
  if (matches(context.recentResultIds)) return { score: 15, reason: "recent" as const };
  return { score: 0, reason: undefined };
}

function finishResult(result: OmnibarResult, intent: OmnibarIntent | null, data: OmnibarSearchData): OmnibarResult {
  const context = getContextScore(result.id, data.context);
  return {
    ...result,
    score: result.score + context.score + scoreIntent(intent, result),
    contextLabel: context.reason ? data.contextLabels?.[context.reason] : undefined,
  };
}

/** Keep typo recovery as a fallback, never as noise beside a literal result. */
export function filterOmnibarFuzzyFallback<T extends Pick<OmnibarResult, "id" | "matchKind" | "score">>(
  results: readonly T[],
): T[] {
  const hasLiteralMatch = results.some(
    (result) =>
      result.matchKind === "literal" ||
      (result.matchKind === undefined && result.id !== "ask-professor-mari" && result.score >= 100),
  );
  return hasLiteralMatch ? results.filter((result) => result.matchKind !== "fuzzy") : [...results];
}

export function searchOmnibar(query: string, data: OmnibarSearchData): OmnibarResult[] {
  const normalized = normalizeProfessorMariNavigationQuery(query);
  if (!normalized) return [];
  const intent = parseOmnibarIntent(query);
  // A bare verb ("add", "remove") is a half-sentence, not a search term. Text
  // matching it just surfaces every row containing the word, so the verb is
  // matched against nothing and the verb-suggestion builder answers it instead.
  // "add character" is not bare: the kind narrows the list, and the empty
  // target then matches every row in that category.
  const bare = Boolean(intent && !intent.targetQuery && !intent.objectCategory);
  const searchQuery = bare ? NO_MATCH : intent ? intent.targetQuery : normalized;
  const fullQuery = bare ? NO_MATCH : normalized;
  const results: OmnibarResult[] = [];
  for (const control of data.controls ?? []) {
    const score = Math.max(
      scoreText(searchQuery, [control.title, ...(control.aliases ?? [])]),
      scoreText(fullQuery, [control.title, ...(control.aliases ?? [])]),
    );
    if (score >= 0)
      results.push(finishResult({ ...control, score, matchKind: score < 100 ? "fuzzy" : "literal" }, intent, data));
  }
  for (const command of data.commands) {
    const score = Math.max(
      scoreText(searchQuery, [command.title, ...(command.aliases ?? [])]),
      scoreText(fullQuery, [command.title, ...(command.aliases ?? [])]),
    );
    const contextualRepair =
      intent?.kind === "repair" &&
      (command.availability?.status === "requires-capability" || data.context?.error?.resultIds.includes(command.id));
    if (score >= 0 || contextualRepair)
      results.push(
        finishResult(
          {
            ...command,
            category: command.kind === "settings" ? "settings" : "navigation",
            kind: command.kind,
            icon: command.icon,
            availability: command.availability,
            score: contextualRepair ? Math.max(score, 80) : score,
            matchKind: score >= 0 ? (score < 100 ? "fuzzy" : "literal") : undefined,
          },
          intent,
          data,
        ),
      );
  }
  for (const chat of data.chats) {
    const score = Math.max(scoreText(searchQuery, [chat.name]), scoreText(fullQuery, [chat.name]));
    if (score >= 0)
      results.push(
        finishResult(
          {
            id: `chat:${chat.id}`,
            title: chat.name,
            category: "chat",
            target: { kind: "chat", chatId: chat.id },
            score,
            matchKind: score < 100 ? "fuzzy" : "literal",
            description: chat.description,
            preview: chat.preview,
            kind: "chat",
            icon: "chats",
          },
          intent,
          data,
        ),
      );
  }
  for (const resource of data.resources) {
    const primaryScore = Math.max(
      scoreText(searchQuery, [resource.name, ...(resource.aliases ?? [])]),
      scoreText(fullQuery, [resource.name, ...(resource.aliases ?? [])]),
      scoreContainedText(fullQuery, [resource.name, ...(resource.aliases ?? [])]),
    );
    const rawMetadataScore = Math.max(
      scoreText(searchQuery, resource.searchText ?? []),
      scoreText(fullQuery, resource.searchText ?? []),
      scoreContainedText(fullQuery, resource.searchText ?? []),
    );
    // Metadata supports literal discovery without letting a long synopsis outrank
    // an exact, prefix, or whole-word name match. Do not use fuzzy metadata hits.
    const metadataScore = rawMetadataScore >= 100 ? Math.min(rawMetadataScore, 145) : -1;
    const score = Math.max(primaryScore, metadataScore);
    if (score >= 0)
      results.push(
        finishResult(
          {
            ...resource,
            id: `${resource.kind}:${resource.id}`,
            title: resource.name,
            category: resource.kind,
            target: { kind: "resource", resource: resource.kind, id: resource.id },
            score,
            matchKind: score < 100 ? "fuzzy" : "literal",
            description: resource.description,
            preview: resource.preview,
            kind: "resource",
            icon: RESOURCE_ICONS[resource.kind] ?? "package",
          },
          intent,
          data,
        ),
      );
  }
  for (const connection of data.connections) {
    const values = [connection.name, connection.provider ?? "", connection.model ?? ""];
    const score = Math.max(scoreText(searchQuery, values), scoreText(fullQuery, values));
    if (score >= 0)
      results.push(
        finishResult(
          {
            id: `connection:${connection.id}`,
            title: connection.name,
            category: "connection",
            target: { kind: "panel", panel: "connections" },
            score,
            matchKind: score < 100 ? "fuzzy" : "literal",
            preview: connection.preview,
            kind: "settings",
            icon: "connection",
          },
          intent,
          data,
        ),
      );
  }
  return (intent?.objectCategory ? results.filter((item) => item.category === intent.objectCategory) : results)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    .concat({
      id: "ask-professor-mari",
      title: data.askProfessorTitle ?? "Ask Professor Mari",
      category: "professor",
      score: -1,
    });
}

export function getUnambiguousOmnibarResult(results: readonly OmnibarResult[]): OmnibarResult | null {
  const direct = results.filter((result) => result.id !== "ask-professor-mari");
  const first = direct[0];
  if (!first) return null;
  return direct[1]?.score === first.score ? null : first;
}

export function isDirectActiveChatAction(
  query: string,
  result: Pick<OmnibarResult, "id" | "category">,
  results: readonly OmnibarResult[],
): boolean {
  const intent = parseOmnibarIntent(query);
  if (intent?.kind !== "action") return false;
  const directResult = getUnambiguousOmnibarResult(results);
  if (directResult?.id !== result.id) return false;
  if (/\b(?:add|use)\b.*\b(?:this|current)\s+chat\b/i.test(query)) return true;
  return intent.verb === "add" && result.category === "character";
}
