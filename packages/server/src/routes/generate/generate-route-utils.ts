import { isDeepStrictEqual } from "node:util";
import {
  GENERATION_PARAMETER_SEND_KEYS,
  PROVIDERS,
  SUMMARY_TAIL_MESSAGES,
  applyTrackerFieldLocksToGameStatePatch,
  generationParametersSchema,
  normalizeTextForMatch,
  normalizeThinkingTagPairs,
  parseTrackerFieldLocks,
  type CharacterStat,
  type GameState,
  type GenerationParameterSendMap,
  type GenerationParameters,
  type InventoryItem,
  type PlayerStats,
} from "@marinara-engine/shared";
import { wrapContent } from "../../services/prompt/format-engine.js";

export type SimpleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
  files?: Array<{ type: string; data: string; filename?: string }>;
  contextKind?: "prompt" | "history" | "injection";
};
export type SpeakerPrefixMessage = SimpleMessage & {
  characterId?: string | null;
  name?: string | null;
  providerMetadata?: Record<string, unknown>;
};
export type StoredGenerationParameters = Partial<GenerationParameters>;
export type PromptAttachment = {
  type?: string | null;
  url?: string | null;
  data?: string | null;
  filename?: string | null;
  name?: string | null;
  prompt?: string | null;
  galleryId?: string | null;
};

function createEmptyPlayerStats(): PlayerStats {
  return { stats: [], attributes: null, skills: {}, inventory: [], activeQuests: [], status: "" };
}

const TEXT_ATTACHMENT_CHAR_LIMIT = 60_000;
const IMAGE_ATTACHMENT_PROVIDER_BYTE_LIMIT = 6 * 1024 * 1024;
const FILE_ATTACHMENT_PROVIDER_BYTE_LIMIT = 20 * 1024 * 1024;
const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  "csv",
  "json",
  "jsonl",
  "log",
  "markdown",
  "md",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractPatchRecord(patch: Record<string, unknown>, field: string): Record<string, unknown> | null {
  const value = patch[field];
  return isPlainRecord(value) ? value : null;
}

function extractPatchArray<T>(patch: Record<string, unknown>, field: string, fallback: T[]): T[] {
  const value = patch[field];
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function extractPlayerStatsPatch(patch: Record<string, unknown>): Record<string, unknown> {
  return extractPatchRecord(patch, "playerStats") ?? {};
}

function extractPlayerStatsPatchArray<T>(patch: Record<string, unknown>, field: keyof PlayerStats, fallback: T[]): T[] {
  const value = extractPlayerStatsPatch(patch)[field];
  return Array.isArray(value) ? (value as T[]) : fallback;
}

type PlayerStatsArrayField = {
  [K in keyof PlayerStats]-?: NonNullable<PlayerStats[K]> extends unknown[] ? K : never;
}[keyof PlayerStats];

export function buildLockedPlayerStatsArrayPatch<T>({
  field,
  values,
  snapshot,
  lockState,
  basePlayerStats,
}: {
  field: PlayerStatsArrayField;
  values: T[];
  snapshot: { playerStats?: unknown } | null | undefined;
  lockState: GameState | null | undefined;
  basePlayerStats?: PlayerStats;
}) {
  const existingPlayerStats = parseSnapshotPlayerStats(snapshot);
  const lockedPatch = applyTrackerFieldLocksToGameStatePatch({ playerStats: { [field]: values } }, lockState);
  const lockedValues = extractPlayerStatsPatchArray<T>(lockedPatch, field, values);
  const playerStats = { ...(basePlayerStats ?? existingPlayerStats), [field]: lockedValues };
  const existingValues = existingPlayerStats[field];
  const changed = !isDeepStrictEqual(lockedValues, Array.isArray(existingValues) ? existingValues : []);
  const patch = {
    playerStats: { [field]: lockedValues },
  } as { playerStats: Partial<Record<PlayerStatsArrayField, T[]>> };
  return { changed, patch, playerStats, values: lockedValues };
}

function parseSnapshotPersonaStats(snapshot: { personaStats?: unknown } | null | undefined): CharacterStat[] {
  const raw = snapshot?.personaStats;
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? (parsed as CharacterStat[]) : [];
  } catch {
    return [];
  }
}

export function buildLockedPersonaTrackerPatch({
  stats,
  status,
  inventory,
  hasStats,
  hasStatus,
  hasInventory,
  snapshot,
  lockState,
}: {
  stats: CharacterStat[];
  status: string;
  inventory: InventoryItem[];
  hasStats?: boolean;
  hasStatus?: boolean;
  hasInventory?: boolean;
  snapshot: { personaStats?: unknown; playerStats?: unknown } | null | undefined;
  lockState: GameState | null | undefined;
}) {
  const rawPatch: Record<string, unknown> = {};
  if (hasStats ?? stats.length > 0) rawPatch.personaStats = stats;

  const rawPlayerStatsPatch: Record<string, unknown> = {};
  if (hasStatus ?? !!status) rawPlayerStatsPatch.status = status;
  if (hasInventory ?? inventory.length > 0) rawPlayerStatsPatch.inventory = inventory;
  if (Object.keys(rawPlayerStatsPatch).length > 0) rawPatch.playerStats = rawPlayerStatsPatch;

  const patch = applyTrackerFieldLocksToGameStatePatch(rawPatch, lockState);
  const updates: Record<string, string> = {};
  const existingPersonaStats = parseSnapshotPersonaStats(snapshot);
  const existingPlayerStats = parseSnapshotPlayerStats(snapshot);

  const lockedPersonaStats = extractPatchArray<CharacterStat>(patch, "personaStats", []);
  const personaStatsChanged =
    Array.isArray(patch.personaStats) && !isDeepStrictEqual(lockedPersonaStats, existingPersonaStats);
  if (personaStatsChanged) updates.personaStats = JSON.stringify(lockedPersonaStats);

  const lockedPlayerStatsPatch = extractPlayerStatsPatch(patch);
  const playerStats = { ...existingPlayerStats };
  let hasPlayerStatsPatch = false;
  if (Object.prototype.hasOwnProperty.call(lockedPlayerStatsPatch, "status")) {
    playerStats.status = typeof lockedPlayerStatsPatch.status === "string" ? lockedPlayerStatsPatch.status : "";
    hasPlayerStatsPatch = true;
  }
  if (Array.isArray(lockedPlayerStatsPatch.inventory)) {
    playerStats.inventory = lockedPlayerStatsPatch.inventory as InventoryItem[];
    hasPlayerStatsPatch = true;
  }

  const playerStatsChanged = hasPlayerStatsPatch && !isDeepStrictEqual(playerStats, existingPlayerStats);
  if (playerStatsChanged) updates.playerStats = JSON.stringify(playerStats);

  return {
    changed: personaStatsChanged || playerStatsChanged,
    inventory: Array.isArray(lockedPlayerStatsPatch.inventory)
      ? (lockedPlayerStatsPatch.inventory as InventoryItem[])
      : [],
    patch,
    updates,
  };
}

export function parseSnapshotPlayerStats(snapshot: { playerStats?: unknown } | null | undefined): PlayerStats {
  const raw = snapshot?.playerStats;
  if (!raw) return createEmptyPlayerStats();
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return isPlainRecord(parsed) ? (parsed as unknown as PlayerStats) : createEmptyPlayerStats();
  } catch {
    return createEmptyPlayerStats();
  }
}

export function shouldAbortOnPassiveGenerationDisconnect(args: { chatMode: string; impersonate?: boolean }): boolean {
  return args.chatMode !== "conversation" || args.impersonate === true;
}

export function resolveProviderTopK(provider: unknown, topK: number): number | undefined {
  const normalized = Number.isFinite(topK) ? Math.max(0, Math.trunc(topK)) : 0;
  const providerId = typeof provider === "string" ? provider.toLowerCase() : "";
  if (providerId === "google" || providerId === "google_vertex") {
    return normalized > 0 ? normalized : undefined;
  }
  return normalized > 0 ? normalized : undefined;
}

export function normalizeServiceTier(value: unknown): "flex" | "priority" | null {
  return value === "flex" || value === "priority" ? value : null;
}

export function mergeCustomParameters(
  base: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base ?? {})) {
    if (!isUnsafeCustomParameterKey(key)) merged[key] = value;
  }
  if (!next) return merged;
  for (const [key, value] of Object.entries(next)) {
    if (isUnsafeCustomParameterKey(key)) continue;
    if (value === undefined) continue;
    const current = merged[key];
    if (isPlainRecord(current) && isPlainRecord(value)) {
      merged[key] = mergeCustomParameters(current, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function isUnsafeCustomParameterKey(key: string): boolean {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function resolveKnowledgeSourceLorebookIds(args: {
  settings: Record<string, unknown> | null | undefined;
  chatActiveLorebookIds: unknown;
}): { sourceLorebookIds: string[]; source: "manual" | "chat_active" | "none" } {
  const manualIds = normalizeStringArray(args.settings?.sourceLorebookIds);
  if (manualIds.length > 0) {
    return { sourceLorebookIds: manualIds, source: "manual" };
  }

  if (args.settings?.useChatActiveLorebooks === false) {
    return { sourceLorebookIds: [], source: "none" };
  }

  const chatActiveIds = normalizeStringArray(args.chatActiveLorebookIds);
  return {
    sourceLorebookIds: chatActiveIds,
    source: chatActiveIds.length > 0 ? "chat_active" : "none",
  };
}

/** Find last message index matching a role (or predicate). Returns -1 if not found. */
export function findLastIndex(messages: SimpleMessage[], role: string): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === role) return i;
  }
  return -1;
}

function isLastMessagePromptBlock(content: unknown): boolean {
  if (typeof content !== "string") return false;
  return /<\/?last_message>/i.test(content) || /(?:^|\n)\s*##\s+Last Message\s*(?:\n|$)/i.test(content);
}

function stripBoundaryLastMessageWrapper(content: string): string {
  return content
    .replace(/^\s*<last_message>\s*\n?/i, "")
    .replace(/\n?\s*<\/last_message>\s*$/i, "")
    .replace(/^\s*##\s+Last Message\s*\n/i, "")
    .trim();
}

function hasBoundaryChatHistoryClose(content: string): boolean {
  return /\n?\s*<\/chat_history>\s*$/i.test(content);
}

function stripBoundaryChatHistoryClose(content: string): string {
  return content.replace(/\n?\s*<\/chat_history>\s*$/i, "").trimEnd();
}

function appendBoundaryChatHistoryClose(content: string): string {
  return `${content.trimEnd()}\n</chat_history>`;
}

export function dedupeLastMessageWrappers<T extends { content: string }>(messages: T[]): void {
  const lastMessageIndexes: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (isLastMessagePromptBlock(messages[i]!.content)) {
      lastMessageIndexes.push(i);
    }
  }
  if (lastMessageIndexes.length <= 1) return;

  const keepIndex = lastMessageIndexes[lastMessageIndexes.length - 1]!;
  for (const index of lastMessageIndexes) {
    if (index === keepIndex) continue;
    let content = stripBoundaryLastMessageWrapper(messages[index]!.content);
    const previousMessage = messages[index - 1];
    if (previousMessage && hasBoundaryChatHistoryClose(previousMessage.content)) {
      messages[index - 1] = {
        ...previousMessage,
        content: stripBoundaryChatHistoryClose(previousMessage.content),
      };
      content = appendBoundaryChatHistoryClose(content);
    }
    messages[index] = {
      ...messages[index]!,
      content,
    };
  }
}

/** Tracker context is injected outside chat history, directly before the latest history/last-message block. */
export function findTrackerContextInsertIndex(
  messages: Array<{ role: "system" | "user" | "assistant"; content?: string; contextKind?: string }>,
): number {
  let latestHistoryIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.contextKind === "history") {
      latestHistoryIndex = i;
      break;
    }
  }

  let latestLastMessageBlockIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isLastMessagePromptBlock(messages[i]!.content)) {
      latestLastMessageBlockIndex = i;
      break;
    }
  }

  if (latestLastMessageBlockIndex >= 0 && latestLastMessageBlockIndex > latestHistoryIndex) {
    return latestLastMessageBlockIndex;
  }
  if (latestHistoryIndex >= 0) {
    return latestHistoryIndex;
  }
  if (latestLastMessageBlockIndex >= 0) {
    return latestLastMessageBlockIndex;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") return i;
  }

  return messages.length;
}

type PromptRoleMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  contextKind?: "prompt" | "history" | "injection";
  characterId?: string | null;
  images?: string[];
  files?: Array<{ type: string; data: string; filename?: string }>;
  providerMetadata?: Record<string, unknown>;
};

function clonePromptRoleMessage<T extends PromptRoleMessage>(message: T): T {
  return {
    ...message,
    ...(message.images ? { images: [...message.images] } : {}),
    ...(message.files ? { files: message.files.map((file) => ({ ...file })) } : {}),
    ...(message.providerMetadata ? { providerMetadata: { ...message.providerMetadata } } : {}),
  };
}

function appendPromptMessageContent(target: PromptRoleMessage, source: PromptRoleMessage) {
  target.content = `${target.content}\n\n${source.content}`;
  if (target.contextKind !== source.contextKind) {
    delete target.contextKind;
  }
  if (source.images?.length) {
    target.images = [...(target.images ?? []), ...source.images];
  }
  if (source.files?.length) {
    target.files = [...(target.files ?? []), ...source.files.map((file) => ({ ...file }))];
  }
  if (source.providerMetadata) {
    target.providerMetadata = {
      ...(target.providerMetadata ?? {}),
      ...source.providerMetadata,
    };
  }
}

/**
 * Provider-safe role normalization for strict prompt presets.
 *
 * System blocks before chat history stay as provider system messages. Once
 * conversation turns have started, later system blocks are appended to the
 * latest user message so the request remains system/user/assistant/user...
 * without making post-history preset sections removable during context fitting.
 * Depth injections are already positioned in history, so they become user
 * messages in place instead of moving to the latest user turn.
 */
export function appendNonLeadingSystemMessagesToLastUser<T extends PromptRoleMessage>(messages: T[]): T[] {
  const result: T[] = [];
  let pastLeadingSystem = false;
  let lastUserIndex = -1;

  for (const message of messages) {
    const cloned = clonePromptRoleMessage(message);
    if (!pastLeadingSystem) {
      if (cloned.role !== "system") pastLeadingSystem = true;
      result.push(cloned);
      if (cloned.role === "user") lastUserIndex = result.length - 1;
      continue;
    }

    if (cloned.role === "system") {
      const converted = { ...cloned, role: "user" as const };
      if (cloned.contextKind === "injection") {
        result.push(converted as T);
        lastUserIndex = result.length - 1;
        continue;
      }
      if (lastUserIndex >= 0) {
        appendPromptMessageContent(result[lastUserIndex]!, converted);
      } else {
        result.push(converted as T);
        lastUserIndex = result.length - 1;
      }
      continue;
    }

    result.push(cloned);
    if (cloned.role === "user") lastUserIndex = result.length - 1;
  }

  return result;
}

/** Parse a JSON extra field safely. */
export function parseExtra(extra: unknown): Record<string, unknown> {
  if (!extra) return {};
  try {
    return typeof extra === "string" ? JSON.parse(extra) : (extra as Record<string, unknown>);
  } catch {
    return {};
  }
}

export function isMessageHiddenFromAI(message: { extra?: unknown }): boolean {
  return parseExtra(message.extra).hiddenFromAI === true;
}

export function isRoleplaySummaryMode(chatMode: string): boolean {
  return chatMode === "roleplay" || chatMode === "visual_novel";
}

/**
 * Resolve the roleplay summary tail (how many recent messages stay visible when
 * the auto-summary hides the rest) from the chat's `summaryTailMessages` value.
 * `DEFAULT` only when the value is genuinely unset; an explicit `MIN` (0) means
 * "hide the whole batch". A present-but-invalid value (NaN, negative) fails
 * closed to `MIN` so corrupt metadata hides more rather than silently leaking
 * extra context. Clamped to [MIN, MAX].
 */
export function resolveRoleplaySummaryTail(value: unknown): number {
  const { MIN, MAX, DEFAULT } = SUMMARY_TAIL_MESSAGES;
  if (value === undefined || value === null) return DEFAULT;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < MIN) return MIN;
  return Math.min(MAX, n);
}

/**
 * Compute which summarized message IDs the roleplay rolling summary should hide,
 * protecting the most-recent `tail` *visible* messages so recent context stays
 * in the prompt. Pure: `messages` must be chat-ordered (ascending). Returns the
 * subset of `entryMessageIds` that is not in the protected tail.
 */
export function computeSummaryHideIds(args: {
  messages: Array<{ id: string; extra?: unknown }>;
  entryMessageIds: string[];
  tail: number;
}): string[] {
  const { messages, entryMessageIds, tail } = args;
  if (entryMessageIds.length === 0) return [];
  const { MIN, MAX } = SUMMARY_TAIL_MESSAGES;
  const clampedTail = Number.isFinite(tail) ? Math.max(MIN, Math.min(MAX, Math.floor(tail))) : MIN;
  const visible = messages.filter((message) => !isMessageHiddenFromAI(message));
  const tailIdSet = new Set(clampedTail > 0 ? visible.slice(-clampedTail).map((message) => message.id) : []);
  const entryIdSet = new Set(entryMessageIds);
  return messages
    .filter((message) => entryIdSet.has(message.id) && !tailIdSet.has(message.id))
    .map((message) => message.id);
}

/**
 * Select the messages a non-range rolling summary should cover. Normally the most
 * recent `contextSize` *visible* messages (the historical `visible.slice(-contextSize)`
 * behavior). When a previous summary has already hidden earlier messages, the window is
 * extended back to that summary's hidden boundary, so a protected tail that has drifted
 * beyond the last `contextSize` visible messages is re-summarized and hidden on this run
 * instead of staying visible forever and accumulating (#2879). Because each entry's hide
 * window is `entryMessageIds` minus the tail, the LLM-facing batch and the hide set share
 * this selection; extending it is what lets a stranded tail be reclaimed.
 *
 * The boundary is identified ONLY by messages a live summary entry actually summarized
 * (its `messageIds` / `hiddenMessageIds`) — NOT by the bare `hiddenFromAI` flag. That
 * flag is ambiguous: the user's manual "Hide from AI" toggle writes the same flag, so
 * keying off it would let a stray manual hide on an early message be misread as a summary
 * boundary and balloon the window to (nearly) the whole chat. With no summary-owned
 * hidden message before the window (e.g. the first summary, or only manual hides), the
 * plain last-`size` window is used. Pure: `messages` must be chat-ordered (ascending).
 */
export function selectRollingSummaryMessages<T extends { id: string; extra?: unknown }>(args: {
  messages: T[];
  contextSize: number;
  summaryEntries?: ReadonlyArray<{ enabled?: boolean; hiddenMessageIds?: string[]; messageIds?: string[] }>;
}): T[] {
  const { messages, contextSize } = args;
  const size = Number.isFinite(contextSize) ? Math.max(0, Math.floor(contextSize)) : 0;
  if (size <= 0) return [];
  const visible = messages.filter((message) => !isMessageHiddenFromAI(message));
  // Fewer visible messages than the window — nothing can have drifted out of it.
  if (visible.length <= size) return visible;
  // Ids owned by a live (enabled) summary entry — what it summarized. A manual "Hide from
  // AI" never appears here, so it can't be mistaken for a boundary. We include both
  // `hiddenMessageIds` and `messageIds` so entries created before `hiddenMessageIds`
  // existed (see ChatSummaryEntry) still anchor a boundary; the hidden check in the scan
  // keeps the protected tail (also in `messageIds`, but visible) from being chosen.
  const summaryOwned = new Set<string>();
  for (const entry of Array.isArray(args.summaryEntries) ? args.summaryEntries : []) {
    if (entry?.enabled === false) continue;
    for (const id of Array.isArray(entry?.hiddenMessageIds) ? entry.hiddenMessageIds : []) summaryOwned.add(id);
    for (const id of Array.isArray(entry?.messageIds) ? entry.messageIds : []) summaryOwned.add(id);
  }
  if (summaryOwned.size === 0) return visible.slice(-size);
  // The previous summary's boundary: the most recent hidden message owned by a summary.
  let lastBoundaryIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isMessageHiddenFromAI(messages[i]!) && summaryOwned.has(messages[i]!.id)) {
      lastBoundaryIndex = i;
      break;
    }
  }
  // No summary-hidden message precedes the window — keep the plain last-`size` window.
  if (lastBoundaryIndex < 0) return visible.slice(-size);
  // Visible messages accumulated since that boundary. Extend the window to cover all of
  // them when they exceed `size`, pulling a drifted protected tail back into the batch.
  const sinceBoundary = messages
    .slice(lastBoundaryIndex + 1)
    .filter((message) => !isMessageHiddenFromAI(message)).length;
  return visible.slice(-Math.max(size, sinceBoundary));
}

export function resolveRoleplayChatSummary(chatMode: string, chatMetadata: Record<string, unknown>): string | null {
  if (!isRoleplaySummaryMode(chatMode)) return null;
  return ((chatMetadata.summary as string) ?? "").trim() || null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readCharacterName(data: unknown): string | null {
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const name = (parsed as { name?: unknown }).name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

export async function resolveCharacterNameMap(
  characterIds: string[],
  getCharacterById: (id: string) => Promise<{ data?: unknown } | null | undefined>,
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    characterIds.map(async (id) => {
      const row = await getCharacterById(id);
      const name = readCharacterName(row?.data);
      return name ? ([id, name] as const) : null;
    }),
  );

  return new Map(entries.filter((entry): entry is readonly [string, string] => !!entry));
}

function prefixSpeakerName(content: string, speakerName: string): string {
  const speaker = speakerName.trim();
  if (!speaker) return content;
  const trimmed = content.trim();
  const alreadyPrefixed = new RegExp(`^${escapeRegex(speaker)}\\s*:`, "i").test(trimmed);
  if (alreadyPrefixed) return trimmed;
  return trimmed ? `${speaker}: ${trimmed}` : `${speaker}:`;
}

export function prefixGroupIndividualHistorySpeakers<T extends SpeakerPrefixMessage>(
  messages: T[],
  options: {
    personaName: string;
    characterNamesById: ReadonlyMap<string, string>;
  },
): T[] {
  const personaName = options.personaName.trim() || "User";

  return messages.map((message) => {
    let speakerName: string | null = null;
    if (message.role === "user") {
      speakerName = personaName;
    } else if (message.role === "assistant") {
      speakerName =
        (message.characterId ? (options.characterNamesById.get(message.characterId) ?? null) : null) ??
        (typeof message.name === "string" && message.name.trim() ? message.name.trim() : null);
    }

    if (!speakerName) return message;
    const content = prefixSpeakerName(message.content, speakerName);
    return content === message.content ? message : { ...message, content };
  });
}

export function canUseMessageForUserRegeneration(input: {
  message: { role?: unknown; extra?: unknown };
  supportsHiddenFromAI: boolean;
}): boolean {
  return !(input.message.role === "user" && input.supportsHiddenFromAI && isMessageHiddenFromAI(input.message));
}

function parsePromptAttachments(extra: unknown): PromptAttachment[] | undefined {
  const rawAttachments = parseExtra(extra).attachments;
  if (!Array.isArray(rawAttachments)) return undefined;
  const attachments = rawAttachments.filter(isPromptAttachment);
  return attachments.length ? attachments : undefined;
}

export function resolveUserRegenerationPersistentAttachments(message: {
  role?: unknown;
  extra?: unknown;
}): PromptAttachment[] | undefined {
  if (message.role !== "user") return undefined;
  return parsePromptAttachments(message.extra);
}

function isPromptAttachment(value: unknown): value is PromptAttachment {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Build the instruction used when regenerating a user-authored message as a swipe.
 * The original user text and readable attachments are wrapped in
 * <original_user_message> tags so downstream generation can return only
 * replacement user-message text.
 */
export function buildUserMessageRegenerationInstruction(message: { content?: unknown; extra?: unknown }): string {
  const original = typeof message.content === "string" ? message.content.trim() : "";
  const attachments = parsePromptAttachments(message.extra);
  const originalWithAttachments = appendReadableAttachmentsToContent(original, attachments);
  return [
    "Regenerate the user's previous message as an alternate swipe.",
    "Write only the replacement user message text.",
    "Do not answer as the assistant, continue the assistant side, or describe what the assistant does next.",
    "",
    "<original_user_message>",
    originalWithAttachments,
    "</original_user_message>",
  ].join("\n");
}

export function buildUserMessageRegenerationPrompt(message: { content?: unknown; extra?: unknown }): SimpleMessage {
  const attachments = parsePromptAttachments(message.extra);
  const images = extractImageAttachmentDataUrls(attachments);
  const files = extractFileAttachmentInputs(attachments);
  return {
    role: "user",
    content: buildUserMessageRegenerationInstruction(message),
    ...(images.length ? { images } : {}),
    ...(files.length ? { files } : {}),
  };
}

export function buildUserMessageRegenerationPromptFromSource(source: SimpleMessage): SimpleMessage {
  return {
    role: "user",
    content: buildUserMessageRegenerationInstruction({ content: source.content }),
    ...(source.images?.length ? { images: source.images } : {}),
    ...(source.files?.length ? { files: source.files } : {}),
  };
}

/**
 * Build the context-facing version of a user message being regenerated.
 * This preserves the original user text and attachments for prompt shaping
 * without adding the provider-facing rewrite instruction.
 */
export function buildUserMessageRegenerationSourceMessage(message: {
  content?: unknown;
  extra?: unknown;
}): SimpleMessage {
  const original = typeof message.content === "string" ? message.content : "";
  const attachments = parsePromptAttachments(message.extra);
  const content = appendReadableAttachmentsToContent(original, attachments);
  const images = extractImageAttachmentDataUrls(attachments);
  const files = extractFileAttachmentInputs(attachments);
  return {
    role: "user",
    content,
    ...(images.length ? { images } : {}),
    ...(files.length ? { files } : {}),
  };
}

export function appendGenerationTailMessages(
  messages: SimpleMessage[],
  options: {
    assistantPrefill: string;
    followUpIteration: number;
    impersonate: boolean;
    isGoogleProvider: boolean;
    regenerateUserMessage: SimpleMessage | null;
  },
): { assistantPrefillInjected: boolean; googleUserRegenerationInjected: boolean } {
  if (options.followUpIteration !== 0) {
    return { assistantPrefillInjected: false, googleUserRegenerationInjected: false };
  }

  const shouldAppendGoogleUserRegeneration =
    !options.impersonate && options.isGoogleProvider && !!options.regenerateUserMessage;
  const assistantPrefill = options.assistantPrefill.trim();
  const shouldAppendAssistantPrefill = !options.impersonate && !!assistantPrefill;

  if (shouldAppendAssistantPrefill) {
    // Strip the trailing edge: Anthropic's Messages API rejects a final assistant
    // message ending in whitespace (HTTP 400), which surfaces to users as a refusal.
    // A prefill ending in "\n" or a space is common. The user-facing prefill is
    // rendered separately, so only what is sent to the API is trimmed.
    messages.push({ role: "assistant", content: options.assistantPrefill.trimEnd() });
  }

  if (shouldAppendGoogleUserRegeneration) {
    messages.push(options.regenerateUserMessage!);
  }

  return {
    assistantPrefillInjected: shouldAppendAssistantPrefill,
    googleUserRegenerationInjected: shouldAppendGoogleUserRegeneration,
  };
}

export function resolveActiveCharacterIds(
  characterIds: string[],
  metadata: Record<string, unknown>,
  options: { mode?: string; allowEmpty?: boolean } = {},
): string[] {
  if (options.mode === "game") return characterIds;

  const inactiveIds = Array.isArray(metadata.inactiveCharacterIds)
    ? new Set(metadata.inactiveCharacterIds.filter((id): id is string => typeof id === "string"))
    : new Set<string>();
  const activeIds = characterIds.filter((id) => !inactiveIds.has(id));

  if (activeIds.length > 0 || options.allowEmpty) return activeIds;
  return characterIds;
}

export function resolvePromptCharacterIdsForTarget(
  characterIds: string[],
  targetCharacterId: string | null | undefined,
): string[] {
  if (typeof targetCharacterId === "string" && characterIds.includes(targetCharacterId)) {
    return [targetCharacterId];
  }
  return characterIds;
}

export function shouldPreferLatestVisibleGameState(input: {
  attachments?: unknown[] | null;
  impersonate?: boolean;
  regenerateMessageId?: string | null;
  userMessage?: string | null;
}): boolean {
  if (input.impersonate === true || !!input.regenerateMessageId) return true;
  return !input.userMessage?.trim() && !input.attachments?.length;
}

export function resolveVisibleGameStateAnchor(
  messages: Array<{ role?: unknown; id?: unknown; activeSwipeIndex?: unknown }>,
): { messageId: string; swipeIndex: number } | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    if (message.role !== "assistant" || typeof message.id !== "string" || !message.id) continue;
    const swipeIndex =
      typeof message.activeSwipeIndex === "number" &&
      Number.isInteger(message.activeSwipeIndex) &&
      message.activeSwipeIndex >= 0
        ? message.activeSwipeIndex
        : 0;
    return { messageId: message.id, swipeIndex };
  }
  return null;
}

export function resolveRegenerationGameStateAnchor(
  messages: Array<{ role?: unknown; id?: unknown; activeSwipeIndex?: unknown }>,
  regenerateMessageId: string | null | undefined,
): { messageId: string; swipeIndex: number } | null {
  if (!regenerateMessageId) return resolveVisibleGameStateAnchor(messages);
  const targetIndex = messages.findIndex((message) => message.id === regenerateMessageId);
  if (targetIndex < 0) return resolveVisibleGameStateAnchor(messages);
  return resolveVisibleGameStateAnchor(messages.slice(0, targetIndex));
}

export function resolveRegenerationGameStateFallbackMessageIds(
  messages: Array<{ role?: unknown; id?: unknown }>,
  regenerateMessageId: string | null | undefined,
): string[] | null {
  if (!regenerateMessageId) return null;
  const targetIndex = messages.findIndex((message) => message.id === regenerateMessageId);
  const boundedMessages = targetIndex >= 0 ? messages.slice(0, targetIndex) : messages;
  const ids = new Set<string>([""]);
  for (const message of boundedMessages) {
    if (message.role === "assistant" && typeof message.id === "string") {
      ids.add(message.id);
    }
  }
  return Array.from(ids);
}

export function getAttachmentFilename(attachment: PromptAttachment): string {
  const rawName = attachment.filename ?? attachment.name;
  return typeof rawName === "string" && rawName.trim() ? rawName.trim() : "attachment";
}

export function extractImageAttachmentDataUrls(attachments: PromptAttachment[] | undefined): string[] {
  return (attachments ?? [])
    .filter((attachment) => typeof attachment.type === "string" && attachment.type.startsWith("image/"))
    .map((attachment) => attachment.data)
    .filter((data): data is string => typeof data === "string" && data.length > 0)
    .filter((data) => estimateDataUrlBytes(data) <= IMAGE_ATTACHMENT_PROVIDER_BYTE_LIMIT);
}

export function extractFileAttachmentInputs(
  attachments: PromptAttachment[] | undefined,
): Array<{ type: string; data: string; filename: string }> {
  return (attachments ?? []).flatMap((attachment) => {
    const type = normalizeProviderFileAttachmentType(attachment);
    if (!type || typeof attachment.data !== "string") return [];
    if (estimateDataUrlBytes(attachment.data) > FILE_ATTACHMENT_PROVIDER_BYTE_LIMIT) return [];
    const data = normalizeDataUrlMimeType(attachment.data, type);
    if (!data) return [];
    return [{ type, data, filename: getAttachmentFilename(attachment) }];
  });
}

function normalizeProviderFileAttachmentType(attachment: PromptAttachment): string | null {
  const type = typeof attachment.type === "string" ? attachment.type.toLowerCase().trim() : "";
  const filename = getAttachmentFilename(attachment).toLowerCase();
  if (type === "application/pdf" || filename.endsWith(".pdf")) return "application/pdf";
  return null;
}

function normalizeDataUrlMimeType(dataUrl: string, mimeType: string): string | null {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return null;
  const meta = dataUrl.slice(5, commaIndex).toLowerCase();
  if (!meta.includes(";base64")) return null;
  return `data:${mimeType};base64,${dataUrl.slice(commaIndex + 1)}`;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return Buffer.byteLength(dataUrl, "utf8");

  const meta = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);
  if (!meta.includes(";base64")) {
    try {
      return Buffer.byteLength(decodeURIComponent(payload), "utf8");
    } catch {
      return Buffer.byteLength(payload, "utf8");
    }
  }

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function isReadableTextAttachment(attachment: PromptAttachment): boolean {
  const type = typeof attachment.type === "string" ? attachment.type.toLowerCase() : "";
  if (type.startsWith("text/")) return true;
  if (
    type === "application/json" ||
    type === "application/ld+json" ||
    type === "application/xml" ||
    type === "application/x-yaml" ||
    type === "application/yaml"
  ) {
    return true;
  }

  const name = getAttachmentFilename(attachment).toLowerCase();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  return !!extension && TEXT_ATTACHMENT_EXTENSIONS.has(extension);
}

function decodeDataUrlText(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return null;

  const meta = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);
  try {
    if (meta.includes(";base64")) {
      return Buffer.from(payload, "base64").toString("utf8");
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function escapeXmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildReadableAttachmentBlocks(attachments: PromptAttachment[] | undefined): string[] {
  return (attachments ?? []).flatMap((attachment) => {
    if (!isReadableTextAttachment(attachment) || typeof attachment.data !== "string") return [];
    const decoded = decodeDataUrlText(attachment.data);
    if (!decoded?.trim()) return [];

    const filename = getAttachmentFilename(attachment);
    const type = typeof attachment.type === "string" && attachment.type.trim() ? attachment.type.trim() : "text/plain";
    const trimmed =
      decoded.length > TEXT_ATTACHMENT_CHAR_LIMIT
        ? `${decoded.slice(0, TEXT_ATTACHMENT_CHAR_LIMIT)}\n\n[Attachment truncated after ${TEXT_ATTACHMENT_CHAR_LIMIT} characters.]`
        : decoded;

    return [
      [
        `<attached_file name="${escapeXmlAttribute(filename)}" type="${escapeXmlAttribute(type)}">`,
        trimmed,
        `</attached_file>`,
      ].join("\n"),
    ];
  });
}

export function appendReadableAttachmentsToContent(
  content: string,
  attachments: PromptAttachment[] | undefined,
): string {
  const blocks = buildReadableAttachmentBlocks(attachments);
  if (blocks.length === 0) return content;
  return `${content}${content.trim() ? "\n\n" : ""}${blocks.join("\n\n")}`;
}

/** Resolve the base URL for a connection, falling back to the provider default. */
export function resolveBaseUrl(connection: { baseUrl: string | null; provider: string }): string {
  if (connection.baseUrl) return connection.baseUrl.replace(/\/+$/, "");
  // Subscription/login-backed providers own their endpoint internally, but
  // downstream callers gate on a non-empty baseUrl. Return a sentinel so the
  // gate passes; the provider ignores the value.
  if (connection.provider === "claude_subscription") return "claude-agent-sdk://local";
  if (connection.provider === "openai_chatgpt") return "openai-chatgpt://codex-auth";
  const providerDef = PROVIDERS[connection.provider as keyof typeof PROVIDERS];
  return providerDef?.defaultBaseUrl ?? "";
}

export function shouldEnableAgentsForGeneration({
  chatEnableAgents,
  chatMode,
  impersonate,
  impersonateBlockAgents,
}: {
  chatEnableAgents: boolean;
  chatMode: string;
  impersonate: boolean;
  impersonateBlockAgents: boolean;
}): boolean {
  return chatEnableAgents && chatMode !== "conversation" && !(impersonate && impersonateBlockAgents);
}

export function shouldInjectIdentityFallback({
  chatMode,
  presetId,
}: {
  chatMode: string;
  presetId: string | null | undefined;
}): boolean {
  if (chatMode === "game") return false;
  // Conversation mode never runs the preset assembler (it is excluded from the
  // assemblePrompt path), so the preset only supplies the conversation prompt
  // text — it never injects character/persona card info. Without the identity
  // fallback, selecting a prompt preset leaves the model with only the
  // character names and no description/personality. Always inject the fallback
  // for conversation mode; the injector self-guards against duplicating a
  // profile that a custom prompt already contains.
  if (chatMode === "conversation") return true;
  return !presetId;
}

/** Parse connection/chat stored generation parameters without injecting schema defaults. */
export function parseStoredGenerationParameters(raw: unknown): StoredGenerationParameters | null {
  let parsed = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const result = generationParametersSchema.partial().safeParse(parsed);
  if (result.success) return result.data;

  // Older installs or extension callers may leave one malformed field in an
  // otherwise useful parameter blob. Salvage valid scalar fields instead of
  // dropping the whole advanced-parameter fallback.
  const source = parsed as Record<string, unknown>;
  const out: StoredGenerationParameters = {};
  if (source.temperature !== undefined) {
    const temperature = generationParametersSchema.shape.temperature.safeParse(source.temperature);
    if (temperature.success) out.temperature = temperature.data;
  }
  if (source.topP !== undefined) {
    const topP = generationParametersSchema.shape.topP.safeParse(source.topP);
    if (topP.success) out.topP = topP.data;
  }
  if (source.topK !== undefined) {
    const topK = generationParametersSchema.shape.topK.safeParse(source.topK);
    if (topK.success) out.topK = topK.data;
  }
  if (source.minP !== undefined) {
    const minP = generationParametersSchema.shape.minP.safeParse(source.minP);
    if (minP.success) out.minP = minP.data;
  }
  if (source.maxTokens !== undefined) {
    const maxTokens = generationParametersSchema.shape.maxTokens.safeParse(source.maxTokens);
    if (maxTokens.success) out.maxTokens = maxTokens.data;
  }
  if (source.maxContext !== undefined) {
    const maxContext = generationParametersSchema.shape.maxContext.safeParse(source.maxContext);
    if (maxContext.success) out.maxContext = maxContext.data;
  }
  if (source.frequencyPenalty !== undefined) {
    const frequencyPenalty = generationParametersSchema.shape.frequencyPenalty.safeParse(source.frequencyPenalty);
    if (frequencyPenalty.success) out.frequencyPenalty = frequencyPenalty.data;
  }
  if (source.presencePenalty !== undefined) {
    const presencePenalty = generationParametersSchema.shape.presencePenalty.safeParse(source.presencePenalty);
    if (presencePenalty.success) out.presencePenalty = presencePenalty.data;
  }
  if (
    source.reasoningEffort === null ||
    ["low", "medium", "high", "xhigh", "maximum"].includes(String(source.reasoningEffort))
  ) {
    out.reasoningEffort = source.reasoningEffort as StoredGenerationParameters["reasoningEffort"];
  }
  if (source.verbosity === null || ["low", "medium", "high"].includes(String(source.verbosity))) {
    out.verbosity = source.verbosity as StoredGenerationParameters["verbosity"];
  }
  if (source.serviceTier === null || source.serviceTier === "flex" || source.serviceTier === "priority") {
    out.serviceTier = source.serviceTier as StoredGenerationParameters["serviceTier"];
  }
  if (typeof source.assistantPrefill === "string") out.assistantPrefill = source.assistantPrefill;
  if (Array.isArray(source.customThinkingTags)) {
    out.customThinkingTags = normalizeThinkingTagPairs(source.customThinkingTags);
  }
  if (isPlainRecord(source.customParameters)) {
    out.customParameters = mergeCustomParameters({}, source.customParameters);
  }
  if (isPlainRecord(source.enabledParameters)) {
    const enabledParameters: GenerationParameterSendMap = {};
    for (const key of GENERATION_PARAMETER_SEND_KEYS) {
      if (typeof source.enabledParameters[key] === "boolean") enabledParameters[key] = source.enabledParameters[key];
    }
    if (Object.keys(enabledParameters).length > 0) out.enabledParameters = enabledParameters;
  }
  for (const key of [
    "squashSystemMessages",
    "showThoughts",
    "useMaxContext",
    "strictRoleFormatting",
    "singleUserMessage",
  ] as const) {
    const value = source[key];
    if (typeof value === "boolean") out[key] = value;
  }
  if (Array.isArray(source.stopSequences) && source.stopSequences.every((item) => typeof item === "string")) {
    out.stopSequences = source.stopSequences;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Inject text into the `</output_format>` section if present,
 * otherwise append to the last user message (or last message overall).
 */
export function injectIntoOutputFormatOrLastUser(
  messages: SimpleMessage[],
  block: string,
  opts?: { indent?: boolean },
): void {
  const prefix = opts?.indent ? "    " : "";
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    if (msg.content.includes("</output_format>")) {
      messages[i] = {
        ...msg,
        content: msg.content.replace("</output_format>", prefix + block + "\n</output_format>"),
      };
      return;
    }
  }

  const lastIdx = Math.max(findLastIndex(messages, "user"), messages.length - 1);
  const target = messages[lastIdx]!;
  messages[lastIdx] = { ...target, content: target.content + "\n\n" + block };
}

/** Build wrapped field parts from a record of { fieldName: value }. */
export function wrapFields(
  fields: Record<string, string | undefined | null>,
  format: "xml" | "markdown" | "none",
): string[] {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value) parts.push(wrapContent(value, name, format, 2));
  }
  return parts;
}

function trackerCharacterIdKey(character: Record<string, unknown>) {
  return typeof character.characterId === "string" ? character.characterId.trim().toLowerCase() : "";
}

function trackerCharacterNameKey(character: Record<string, unknown>) {
  return normalizeTextForMatch(character.name);
}

function trackerCharacterKey(character: Record<string, unknown>) {
  return trackerCharacterIdKey(character) || trackerCharacterNameKey(character) || null;
}

function isNpcTrackerAvatarPath(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("/api/avatars/npc/");
}

export function isManualTrackerCharacterId(value: unknown): boolean {
  return typeof value === "string" && value.trim().startsWith("manual-");
}

function canUseManualTrackerNameFallback(character: Record<string, unknown>) {
  const id = trackerCharacterIdKey(character);
  if (!id || isManualTrackerCharacterId(id)) return true;
  const name = trackerCharacterNameKey(character);
  return !!name && id === name;
}

export function preserveTrackerCharacterUiFields(
  nextCharacters: Array<Record<string, unknown>>,
  previousCharacters: Array<Record<string, unknown>>,
): void {
  const previousByKey = new Map<string, Record<string, unknown>>();
  const previousManualByName = new Map<string, Record<string, unknown>>();
  const previousNameCounts = new Map<string, number>();
  for (const character of previousCharacters) {
    const key = trackerCharacterKey(character);
    if (key) previousByKey.set(key, character);
    const name = trackerCharacterNameKey(character);
    if (name) previousNameCounts.set(name, (previousNameCounts.get(name) ?? 0) + 1);
    if (name && isManualTrackerCharacterId(character.characterId)) {
      previousManualByName.set(name, character);
    }
  }

  for (const character of nextCharacters) {
    const key = trackerCharacterKey(character);
    const name = trackerCharacterNameKey(character);
    const previous =
      (key ? previousByKey.get(key) : null) ??
      (name && previousNameCounts.get(name) === 1 && canUseManualTrackerNameFallback(character)
        ? previousManualByName.get(name)
        : null);
    const previousPortraitFocusX = previous?.portraitFocusX;
    const previousPortraitFocusY = previous?.portraitFocusY;
    const previousPortraitZoom = previous?.portraitZoom;
    const previousAvatarPath = previous?.avatarPath;
    if (
      (typeof character.avatarPath !== "string" || !character.avatarPath.trim()) &&
      isNpcTrackerAvatarPath(previousAvatarPath)
    ) {
      character.avatarPath = previousAvatarPath.trim();
    }
    if (
      (typeof character.portraitFocusX !== "number" || !Number.isFinite(character.portraitFocusX)) &&
      typeof previousPortraitFocusX === "number" &&
      Number.isFinite(previousPortraitFocusX)
    ) {
      character.portraitFocusX = previousPortraitFocusX;
    }
    if (
      (typeof character.portraitFocusY !== "number" || !Number.isFinite(character.portraitFocusY)) &&
      typeof previousPortraitFocusY === "number" &&
      Number.isFinite(previousPortraitFocusY)
    ) {
      character.portraitFocusY = previousPortraitFocusY;
    }
    if (
      (typeof character.portraitZoom !== "number" || !Number.isFinite(character.portraitZoom)) &&
      typeof previousPortraitZoom === "number" &&
      Number.isFinite(previousPortraitZoom)
    ) {
      character.portraitZoom = previousPortraitZoom;
    }
  }
}

/** Parse game state JSON fields from a DB row. */
export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseGameStateRow(row: Record<string, unknown>): GameState {
  const manualOverrides = parseJsonField<Record<string, string> | null>(row.manualOverrides, null);
  const fieldLocks = parseTrackerFieldLocks(row.fieldLocks);
  return {
    id: row.id as string,
    chatId: row.chatId as string,
    messageId: row.messageId as string,
    swipeIndex: row.swipeIndex as number,
    date: row.date as string | null,
    time: row.time as string | null,
    location: row.location as string | null,
    weather: row.weather as string | null,
    temperature: row.temperature as string | null,
    presentCharacters: parseJsonField<any[]>(row.presentCharacters, []),
    recentEvents: parseJsonField<string[]>(row.recentEvents, []),
    playerStats: parseJsonField<PlayerStats | null>(row.playerStats, null),
    personaStats: parseJsonField<any[] | null>(row.personaStats, null),
    manualOverrides,
    fieldLocks,
    createdAt: row.createdAt as string,
  };
}
