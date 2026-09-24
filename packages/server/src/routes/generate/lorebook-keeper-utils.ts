import {
  customAgentHasCapability,
  decodeAgentXmlEntities,
  normalizeLorebookCategory,
  type AgentContext,
  type LorebookEntry,
  type SourceMessageRef,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { createLorebooksStorage } from "../../services/storage/lorebooks.storage.js";

export interface LorebookKeeperSettings {
  targetLorebookId: string | null;
  readBehindMessages: number;
}

export interface CustomLorebookBackfillSettings {
  enabled: boolean;
  chunkSize: number;
}

export interface ExistingLorebookEntrySummary {
  id: string;
  name: string;
  content: string;
  keys: string[];
  locked: boolean;
}

export interface WritableLorebookSummary {
  id: string;
  name: string;
}

export type LorebookNamingScheme = Record<string, string>;

type LorebooksStore = ReturnType<typeof createLorebooksStorage>;

type LorebookKeeperMessage = {
  id: string;
  role: string;
  content: string;
  characterId?: string | null;
};

export const MAX_READ_BEHIND_MESSAGES = 100;
export const DEFAULT_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE = 25;
export const MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE = 100;
export const CUSTOM_LOREBOOK_BACKFILL_CURSOR_KEY = "_lorebookBackfillLastMessageId";

function normalizeNonNegativeInteger(value: unknown, fallback: number, max: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(numeric)));
}

export function getCustomLorebookReadBehindMessages(settings: Record<string, unknown>): number {
  return normalizeNonNegativeInteger(settings.lorebookReadBehindMessages, 0, MAX_READ_BEHIND_MESSAGES);
}

export function getCustomLorebookBackfillSettings(settings: Record<string, unknown>): CustomLorebookBackfillSettings {
  return {
    enabled: settings.lorebookBackfillEnabled === true,
    chunkSize: Math.max(
      1,
      normalizeNonNegativeInteger(
        settings.lorebookBackfillChunkSize,
        DEFAULT_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE,
        MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE,
      ),
    ),
  };
}

function customAgentCanProcessLorebookHistory(agent: {
  phase: string;
  isCustomAgent?: boolean;
  settings: Record<string, unknown>;
}): boolean {
  if (agent.phase !== "post_processing" || agent.isCustomAgent !== true) return false;

  const canEditLorebooks = customAgentHasCapability(agent.settings, "edit_lorebooks");
  const canCreateLorebooks = customAgentHasCapability(agent.settings, "create_lorebooks");
  const enabledTools = Array.isArray(agent.settings.enabledTools) ? agent.settings.enabledTools : [];
  const writesLorebookEntries =
    canEditLorebooks && (agent.settings.lorebookWriteEnabled === true || enabledTools.includes("save_lorebook_entry"));
  const emitsLorebookUpdates =
    agent.settings.resultType === "lorebook_update" && (canEditLorebooks || canCreateLorebooks);

  return writesLorebookEntries || emitsLorebookUpdates;
}

export function customAgentUsesLorebookReadBehind(agent: {
  phase: string;
  isCustomAgent?: boolean;
  settings: Record<string, unknown>;
}): boolean {
  return getCustomLorebookReadBehindMessages(agent.settings) > 0 && customAgentCanProcessLorebookHistory(agent);
}

export function customAgentUsesLorebookBackfill(agent: {
  phase: string;
  isCustomAgent?: boolean;
  settings: Record<string, unknown>;
}): boolean {
  return getCustomLorebookBackfillSettings(agent.settings).enabled && customAgentCanProcessLorebookHistory(agent);
}

export function customLorebookReadBehindRunKey(chatId: string, agentId: string, _messageId?: string): string {
  // One chat-and-agent lease covers the complete historical run. A target-based
  // key permits the next chunk to start while the previous chunk is still
  // applying lorebook effects.
  return `${chatId}:${agentId}`;
}

export function tryClaimCustomLorebookReadBehindRun(activeRuns: Set<string>, runKey: string): boolean {
  if (activeRuns.has(runKey)) return false;
  activeRuns.add(runKey);
  return true;
}

function isEnabledLorebook(value: unknown): boolean {
  return value === true || value === "true";
}

function getAssistantMessages<T extends { id: string; role: string }>(messages: T[]): T[] {
  return messages.filter((message) => message.role === "assistant");
}

function findMessageIndex<T extends { id: string }>(messages: T[], messageId: string | null): number {
  if (!messageId) return -1;
  return messages.findIndex((message) => message.id === messageId);
}

export function getLorebookKeeperSettings(chatMeta: Record<string, unknown>): LorebookKeeperSettings {
  const targetLorebookId =
    typeof chatMeta.lorebookKeeperTargetLorebookId === "string" && chatMeta.lorebookKeeperTargetLorebookId.trim()
      ? chatMeta.lorebookKeeperTargetLorebookId.trim()
      : null;

  return {
    targetLorebookId,
    readBehindMessages: normalizeNonNegativeInteger(
      chatMeta.lorebookKeeperReadBehindMessages,
      0,
      MAX_READ_BEHIND_MESSAGES,
    ),
  };
}

export function getLorebookNamingScheme(settings: Record<string, unknown> | null | undefined): LorebookNamingScheme {
  const raw = settings?.lorebookNamingScheme;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const scheme: LorebookNamingScheme = {};
  for (const [key, value] of Object.entries(raw).slice(0, 32)) {
    const alias = key.trim().toLowerCase();
    const template = typeof value === "string" ? value.trim() : "";
    if (alias && template) scheme[alias] = template;
  }
  return scheme;
}

export async function resolveLorebookKeeperTarget(args: {
  lorebooksStore: LorebooksStore;
  chatId: string;
  characterIds: string[];
  personaId?: string | null;
  activeLorebookIds: string[];
  preferredTargetLorebookId: string | null;
}): Promise<{
  writableLorebookIds: string[];
  writableLorebooks: WritableLorebookSummary[];
  targetLorebookId: string | null;
  targetLorebookName: string | null;
}> {
  const { lorebooksStore, chatId, characterIds, personaId, activeLorebookIds, preferredTargetLorebookId } = args;
  const allBooks = (await lorebooksStore.list()) as unknown as Array<{
    id: string;
    name?: string | null;
    enabled?: unknown;
    characterId?: string | null;
    characterIds?: string[] | null;
    personaId?: string | null;
    personaIds?: string[] | null;
    chatId?: string | null;
  }>;

  const relevantBooks = allBooks.filter((book) => {
    if (preferredTargetLorebookId && book.id === preferredTargetLorebookId) return true;
    if (!isEnabledLorebook(book.enabled)) return false;
    if (activeLorebookIds.includes(book.id)) return true;
    if (book.characterIds?.some((characterId) => characterIds.includes(characterId))) return true;
    if (book.characterId && characterIds.includes(book.characterId)) return true;
    if (personaId && book.personaIds?.includes(personaId)) return true;
    if (book.personaId && book.personaId === personaId) return true;
    if (book.chatId && book.chatId === chatId) return true;
    return false;
  });

  const uniqueBooks = [...new Map(relevantBooks.map((book) => [book.id, book])).values()];
  uniqueBooks.sort((left, right) => {
    const leftPreferred = preferredTargetLorebookId && left.id === preferredTargetLorebookId ? 0 : 1;
    const rightPreferred = preferredTargetLorebookId && right.id === preferredTargetLorebookId ? 0 : 1;
    if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;

    const leftChatScoped = left.chatId === chatId ? 0 : 1;
    const rightChatScoped = right.chatId === chatId ? 0 : 1;
    return leftChatScoped - rightChatScoped;
  });

  const writableLorebookIds = uniqueBooks.map((book) => book.id);
  const writableLorebooks = uniqueBooks.map((book) => ({ id: book.id, name: book.name?.trim() || book.id }));
  const targetLorebookId =
    preferredTargetLorebookId && writableLorebookIds.includes(preferredTargetLorebookId)
      ? preferredTargetLorebookId
      : (writableLorebookIds[0] ?? null);
  const targetLorebookName = uniqueBooks.find((book) => book.id === targetLorebookId)?.name?.trim() ?? null;

  return { writableLorebookIds, writableLorebooks, targetLorebookId, targetLorebookName };
}

export async function loadLorebookKeeperExistingEntries(
  lorebooksStore: LorebooksStore,
  targetLorebookId: string | null,
): Promise<ExistingLorebookEntrySummary[]> {
  if (!targetLorebookId) return [];

  const entries = (await lorebooksStore.listEntries(targetLorebookId)) as Array<{
    id?: string | null;
    name?: string | null;
    content?: string | null;
    keys?: string[] | null;
    locked?: unknown;
  }>;

  return entries
    .filter((entry) => typeof entry.name === "string" && entry.name.trim().length > 0)
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : "",
      name: entry.name!.trim(),
      content: typeof entry.content === "string" ? entry.content : "",
      keys: Array.isArray(entry.keys) ? entry.keys.filter((key) => typeof key === "string") : [],
      locked: entry.locked === true || entry.locked === "true",
    }));
}

export function getLorebookKeeperAutomaticTarget<T extends { id: string; role: string }>(
  messages: T[],
  readBehindMessages: number,
): T | null {
  if (readBehindMessages <= 0) return null;
  const assistants = getAssistantMessages(messages);
  return assistants[assistants.length - readBehindMessages] ?? null;
}

export function getLorebookKeeperAutomaticPendingCount<T extends { id: string; role: string }>(
  messages: T[],
  readBehindMessages: number,
  lastProcessedMessageId: string | null,
): number {
  const assistants = getAssistantMessages(messages);
  const targetIndex = readBehindMessages <= 0 ? assistants.length : assistants.length - readBehindMessages;
  if (targetIndex < 0) return 0;

  const lastProcessedIndex = findMessageIndex(assistants, lastProcessedMessageId);
  if (lastProcessedIndex >= 0) {
    return Math.max(targetIndex - lastProcessedIndex, 0);
  }
  return targetIndex + 1;
}

export function getLorebookKeeperBackfillTargets<T extends { id: string; role: string }>(
  messages: T[],
  readBehindMessages: number,
  lastProcessedMessageId: string | null,
): T[] {
  const assistants = getAssistantMessages(messages);
  const eligibleCount = Math.max(assistants.length - Math.max(readBehindMessages, 0), 0);
  const eligibleAssistants = assistants.slice(0, eligibleCount);
  const lastProcessedIndex = findMessageIndex(eligibleAssistants, lastProcessedMessageId);
  return lastProcessedIndex >= 0 ? eligibleAssistants.slice(lastProcessedIndex + 1) : eligibleAssistants;
}

export function getCustomLorebookBackfillChunk<T extends { id: string; role: string }>(
  messages: T[],
  readBehindMessages: number,
  lastProcessedMessageId: string | null,
  chunkSize: number,
  cursorMessages: T[] = messages,
): { messages: T[]; target: T } | null {
  const normalizedChunkSize = Math.max(
    1,
    normalizeNonNegativeInteger(
      chunkSize,
      DEFAULT_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE,
      MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE,
    ),
  );
  const cursorIndexes = new Map(cursorMessages.map((message, index) => [message.id, index]));
  const previousIndex = lastProcessedMessageId ? (cursorIndexes.get(lastProcessedMessageId) ?? -1) : -1;
  // A deleted cursor has no safe recovery position. Stopping is preferable to
  // silently replaying already-applied lorebook history from the beginning.
  if (lastProcessedMessageId && previousIndex < 0) return null;

  const assistants = getAssistantMessages(messages);
  const eligibleCount = Math.max(assistants.length - Math.max(readBehindMessages, 0), 0);
  const targets = assistants
    .slice(0, eligibleCount)
    .filter((message) => (cursorIndexes.get(message.id) ?? Infinity) > previousIndex);
  const pendingMessages = messages.filter((message) => (cursorIndexes.get(message.id) ?? Infinity) > previousIndex);
  const firstWindowIds = new Set(pendingMessages.slice(0, normalizedChunkSize).map((message) => message.id));
  const target = [...targets].reverse().find((candidate) => firstWindowIds.has(candidate.id)) ?? targets[0];
  if (!target) return null;

  const targetIndex = pendingMessages.findIndex((message) => message.id === target.id);
  const startIndex = Math.max(0, targetIndex - normalizedChunkSize + 1);
  return {
    messages: pendingMessages.slice(startIndex, targetIndex + 1),
    target,
  };
}

/**
 * Backfill cursor carried on an approval-gated lorebook proposal. The cursor is
 * advanced only when the proposal is committed, so a pending chunk is not
 * skipped, but an approved one is not re-run forever either.
 */
export type CustomLorebookBackfillCursorPayload = { agentConfigId: string; messageId: string };

export function readCustomLorebookBackfillCursorPayload(value: unknown): CustomLorebookBackfillCursorPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const agentConfigId = typeof record.agentConfigId === "string" ? record.agentConfigId.trim() : "";
  const messageId = typeof record.messageId === "string" ? record.messageId.trim() : "";
  return agentConfigId && messageId ? { agentConfigId, messageId } : null;
}

/**
 * Only move the cursor forward, and only onto a message that still exists in the
 * chat, so approving a stale duplicate proposal cannot rewind a newer cursor.
 */
export function shouldAdvanceCustomLorebookBackfillCursor(
  orderedMessageIds: string[],
  currentCursor: string | null,
  nextCursor: string,
): boolean {
  const nextIndex = orderedMessageIds.indexOf(nextCursor);
  if (nextIndex < 0) return false;
  if (!currentCursor) return true;
  return orderedMessageIds.indexOf(currentCursor) < nextIndex;
}

export function buildHistoricalLorebookKeeperContext<T extends LorebookKeeperMessage>(
  baseContext: AgentContext,
  messages: T[],
  targetMessageId: string,
): AgentContext | null {
  const targetIndex = messages.findIndex((message) => message.id === targetMessageId);
  if (targetIndex < 0) return null;

  const targetMessage = messages[targetIndex]!;
  return {
    ...baseContext,
    recentMessages: messages.slice(0, targetIndex).map((message) => ({
      role: message.role,
      content: message.content,
      characterId: message.characterId ?? undefined,
    })),
    mainResponse: targetMessage.content,
    mainResponseSegments: undefined,
  };
}

function normalizeKeeperFact(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .replace(/^(?:[-*]|\u2022)\s+/, "")
    .replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function normalizeKeeperFactForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeeperFacts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const facts: string[] = [];
  for (const entry of value) {
    const fact = normalizeKeeperFact(entry);
    if (!fact) continue;
    const comparable = normalizeKeeperFactForComparison(fact);
    if (seen.has(comparable)) continue;
    seen.add(comparable);
    facts.push(fact);
  }
  return facts;
}

function dedupeKeeperContentParagraphs(content: string): string {
  const paragraphs = content
    .split(/\r?\n\s*\r?\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const paragraph of paragraphs) {
    const comparable = normalizeKeeperFactForComparison(paragraph);
    // Punctuation-only paragraphs (such as "---" section breaks) are kept verbatim.
    if (comparable) {
      if (seen.has(comparable)) continue;
      seen.add(comparable);
    }
    deduped.push(paragraph);
  }

  return deduped.join("\n\n");
}

function mergeLorebookKeys(existingKeys: unknown, newKeys: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  const add = (key: unknown) => {
    if (typeof key !== "string") return;
    const trimmed = key.trim();
    if (!trimmed) return;
    const comparable = trimmed.toLowerCase();
    if (seen.has(comparable)) return;
    seen.add(comparable);
    merged.push(trimmed);
  };

  if (Array.isArray(existingKeys)) {
    for (const key of existingKeys) add(key);
  }
  for (const key of newKeys) add(key);
  return merged;
}

export function mergeLorebookKeeperUpdateContent(args: {
  existingContent: unknown;
  replacementContent: unknown;
  newFacts: unknown;
}): string {
  const existing = typeof args.existingContent === "string" ? dedupeKeeperContentParagraphs(args.existingContent) : "";
  const replacement =
    typeof args.replacementContent === "string" ? dedupeKeeperContentParagraphs(args.replacementContent) : "";
  const facts = normalizeKeeperFacts(args.newFacts);
  // A supplied content body is an update, not an appendix. Retain the old body only
  // when Lorebook Keeper supplied facts without a replacement.
  const baseContent = replacement || existing;
  if (facts.length === 0) return baseContent;
  // Compare whole lines and sentences, not substrings, so "Mara is a mage" is not
  // treated as known just because the entry says "Mara is a mage hunter".
  // Whole lines count too, so a multi-sentence fact the keeper already appended
  // as one bullet still matches itself on the next pass.
  // A fact made only of sentences the entry already holds (for example a restatement of
  // part of a longer prose line) is known as well. A sentence may end in a closing quote
  // or bracket, as in `She said "no." Then left.`
  const stripBullet = (unit: string) => unit.replace(/^\s*(?:[-*]|\u2022)\s+/, "");
  const splitSentences = (text: string) => text.split(/(?<=[.!?]["'\u201D\u2019)\]]*)\s+/);
  const baseLines = baseContent.split(/\r?\n+/);
  const baseUnits = new Set(
    [...baseLines, ...baseLines.flatMap((line) => splitSentences(stripBullet(line)))]
      .map((unit) => normalizeKeeperFactForComparison(stripBullet(unit)))
      .filter(Boolean),
  );
  const novelFacts = facts.filter((fact) => {
    const comparable = normalizeKeeperFactForComparison(fact);
    if (comparable.length === 0 || baseUnits.has(comparable)) return false;
    const factSentences = splitSentences(stripBullet(fact))
      .map((sentence) => normalizeKeeperFactForComparison(sentence))
      .filter(Boolean);
    return !(factSentences.length > 1 && factSentences.every((sentence) => baseUnits.has(sentence)));
  });

  if (novelFacts.length === 0) return baseContent;

  const addition = novelFacts.map((fact) => `- ${fact}`).join("\n");
  return baseContent ? `${baseContent}\n\n${addition}` : addition;
}

function readNestedEntry(update: Record<string, unknown>): Record<string, unknown> {
  return update.entry && typeof update.entry === "object" && !Array.isArray(update.entry)
    ? (update.entry as Record<string, unknown>)
    : {};
}

export function readKeeperUpdateName(update: Record<string, unknown>, namesAreVerbatim = false): string {
  const nestedEntry = readNestedEntry(update);
  const rawName =
    typeof update.entryName === "string"
      ? update.entryName
      : typeof update.name === "string"
        ? update.name
        : typeof nestedEntry.name === "string"
          ? nestedEntry.name
          : "";
  return (namesAreVerbatim ? rawName : decodeAgentXmlEntities(rawName)).trim();
}

function readKeeperUpdateContent(update: Record<string, unknown>): string {
  const nestedEntry = readNestedEntry(update);
  return typeof update.content === "string"
    ? update.content
    : typeof nestedEntry.content === "string"
      ? nestedEntry.content
      : "";
}

function readKeeperUpdateKeys(update: Record<string, unknown>): string[] {
  const nestedEntry = readNestedEntry(update);
  const rawKeys = Array.isArray(update.keys) ? update.keys : Array.isArray(nestedEntry.keys) ? nestedEntry.keys : [];
  return rawKeys.filter((key): key is string => typeof key === "string");
}

function readKeeperUpdateTag(update: Record<string, unknown>): string {
  const nestedEntry = readNestedEntry(update);
  return typeof update.tag === "string" ? update.tag : typeof nestedEntry.tag === "string" ? nestedEntry.tag : "";
}

export function readLorebookKeeperUpdateOrder(update: Record<string, unknown>): number | undefined {
  const nestedEntry = readNestedEntry(update);
  const rawOrder = typeof update.order === "number" ? update.order : nestedEntry.order;
  return typeof rawOrder === "number" && Number.isSafeInteger(rawOrder) ? rawOrder : undefined;
}

export async function persistLorebookKeeperUpdates(args: {
  lorebooksStore: LorebooksStore;
  chatId: string;
  chatName: string | null | undefined;
  preferredTargetLorebookId: string | null;
  writableLorebookIds: string[] | null;
  /** An explicitly selected target takes precedence over model-proposed destinations. */
  allowTargetRouting?: boolean;
  /** Human-approved names have already crossed the model-output decoding boundary. */
  namesAreVerbatim?: boolean;
  writableLorebooks?: WritableLorebookSummary[];
  lorebookNamingScheme?: LorebookNamingScheme;
  worldName?: string | null;
  /**
   * Agent producing these updates; stamped onto entries together with the
   * source refs so message deletion can cascade (a human PATCH never carries
   * provenance — the HTTP schemas strip it).
   */
  sourceAgentId?: string;
  /** Turn messages the updates were extracted from; entries' current-content refs. */
  sourceMessageRefs?: SourceMessageRef[];
  /** Shared across routed batches so one keeper call keeps its original undo snapshot. */
  writtenEntryIds?: Set<string>;
  updates: Array<Record<string, unknown>>;
  revectorizeEntry?: (entry: LorebookEntry) => Promise<void>;
  signal?: AbortSignal;
}): Promise<string | null> {
  const {
    lorebooksStore,
    chatId,
    chatName,
    preferredTargetLorebookId,
    writableLorebookIds,
    writableLorebooks,
    allowTargetRouting = true,
    namesAreVerbatim = false,
    lorebookNamingScheme = {},
    worldName,
    sourceAgentId,
    sourceMessageRefs,
    writtenEntryIds = new Set<string>(),
    updates,
    revectorizeEntry,
    signal,
  } = args;
  // Refs are the anchor; attribution rides along with them. Callers that
  // pass refs explicitly stamp provenance even when the array is empty (the
  // entry stays attributed — and snapshotted — just not cascade-reachable);
  // callers passing nothing keep the old unstamped behavior.
  const provenance =
    sourceMessageRefs !== undefined
      ? { sourceAgentId: sourceAgentId ?? "lorebook-keeper", sourceMessageRefs }
      : undefined;
  signal?.throwIfAborted();

  const routedUpdates = updates.filter(
    (update) => typeof update.targetLorebook === "string" && update.targetLorebook.trim().length > 0,
  );
  if (allowTargetRouting && routedUpdates.length > 0) {
    const writableIds = new Set(writableLorebookIds ?? []);
    if (preferredTargetLorebookId) writableIds.add(preferredTargetLorebookId);
    const allBooks = (await lorebooksStore.list()) as unknown as WritableLorebookSummary[];
    signal?.throwIfAborted();
    const books = new Map(
      allBooks.filter((book) => writableIds.has(book.id)).map((book) => [book.id, { id: book.id, name: book.name }]),
    );
    for (const book of writableLorebooks ?? []) {
      if (writableIds.has(book.id)) books.set(book.id, book);
    }

    const resolveTarget = async (rawTarget: string): Promise<string | null> => {
      signal?.throwIfAborted();
      const target = (namesAreVerbatim ? rawTarget : decodeAgentXmlEntities(rawTarget)).trim();
      const exact = [...books.values()].find((book) => book.name === target);
      if (exact) return exact.id;

      const alias = target.toLowerCase();
      const template = lorebookNamingScheme[alias];
      if (!template) return null;
      const resolvedName = template.replaceAll("[WorldName]", worldName?.trim() || chatName?.trim() || chatId);
      const existing = [...books.values()].find((book) => book.name === resolvedName);
      if (existing) return existing.id;
      signal?.throwIfAborted();
      const created = await lorebooksStore.create({
        name: resolvedName,
        description: `Automatically created for Lorebook Keeper's ${alias} entries`,
        category: normalizeLorebookCategory(alias),
        chatId,
        enabled: true,
        generatedBy: "agent",
        sourceAgentId: "lorebook-keeper",
      });
      signal?.throwIfAborted();
      const id = (created as { id?: string } | null)?.id ?? null;
      if (id) {
        writableIds.add(id);
        books.set(id, { id, name: resolvedName });
      }
      return id;
    };

    const grouped = new Map<string | null, Array<Record<string, unknown>>>();
    for (const update of updates) {
      signal?.throwIfAborted();
      const rawTarget = typeof update.targetLorebook === "string" ? update.targetLorebook.trim() : "";
      const targetId = rawTarget ? await resolveTarget(rawTarget) : null;
      signal?.throwIfAborted();
      const { targetLorebook: _targetLorebook, ...plainUpdate } = update;
      const bucket = grouped.get(targetId) ?? [];
      bucket.push(plainUpdate);
      grouped.set(targetId, bucket);
    }

    let firstResolvedTarget: string | null = null;
    let fallbackTarget: string | null = null;
    for (const [targetId, targetUpdates] of grouped) {
      signal?.throwIfAborted();
      const resolved = await persistLorebookKeeperUpdates({
        lorebooksStore,
        chatId,
        chatName,
        preferredTargetLorebookId: targetId ?? preferredTargetLorebookId,
        writableLorebookIds: targetId ? [targetId] : [...writableIds],
        sourceAgentId,
        sourceMessageRefs,
        writtenEntryIds,
        updates: targetUpdates,
        namesAreVerbatim,
        revectorizeEntry,
        signal,
      });
      signal?.throwIfAborted();
      firstResolvedTarget ??= resolved;
      if (targetId === null) fallbackTarget = resolved;
    }
    return preferredTargetLorebookId ?? fallbackTarget ?? firstResolvedTarget;
  }

  let targetLorebookId = preferredTargetLorebookId ?? writableLorebookIds?.[0] ?? null;
  if (!targetLorebookId) {
    signal?.throwIfAborted();
    const created = await lorebooksStore.create({
      name: `Auto-generated (${chatName || chatId})`,
      description: "Automatically created by the Lorebook Keeper agent",
      category: "uncategorized",
      chatId,
      enabled: true,
      generatedBy: "agent",
      sourceAgentId: "lorebook-keeper",
    });
    signal?.throwIfAborted();
    targetLorebookId = (created as { id?: string } | null)?.id ?? null;
  }

  if (!targetLorebookId) return null;

  signal?.throwIfAborted();
  const existingEntries = (await lorebooksStore.listEntries(targetLorebookId)) as unknown as Array<{
    id: string;
    name?: string | null;
    content?: string | null;
    keys?: string[] | null;
    tag?: string | null;
    locked?: unknown;
  }>;
  signal?.throwIfAborted();
  const entryByName = new Map<string, (typeof existingEntries)[number]>();
  for (const entry of existingEntries) {
    const name = typeof entry.name === "string" ? entry.name.trim().toLowerCase() : "";
    if (name) entryByName.set(name, entry);
  }

  for (const update of updates) {
    signal?.throwIfAborted();
    const rawName = readKeeperUpdateName(update, namesAreVerbatim);
    if (!rawName) continue;

    const content = readKeeperUpdateContent(update);
    const keys = readKeeperUpdateKeys(update);
    const tag = readKeeperUpdateTag(update);
    const order = readLorebookKeeperUpdateOrder(update);
    const existing = entryByName.get(rawName.toLowerCase());

    if (existing && (existing.locked === true || existing.locked === "true")) {
      continue;
    }

    if (existing) {
      const mergedContent = mergeLorebookKeeperUpdateContent({
        existingContent: existing.content,
        replacementContent: content,
        newFacts: update.newFacts,
      });
      const mergedKeys = mergeLorebookKeys(existing.keys, keys);
      const mergedTag = tag || existing.tag || "";
      signal?.throwIfAborted();
      const updated = await lorebooksStore.updateEntry(existing.id, {
        content: mergedContent,
        keys: mergedKeys,
        tag: mergedTag,
        ...(order !== undefined ? { order } : {}),
        ...(provenance ?? {}),
        ...(provenance ? { preserveProvenanceSnapshot: writtenEntryIds.has(existing.id) } : {}),
      });
      if (updated) writtenEntryIds.add(existing.id);
      signal?.throwIfAborted();
      if (revectorizeEntry && updated) {
        try {
          signal?.throwIfAborted();
          await revectorizeEntry(updated as LorebookEntry);
          signal?.throwIfAborted();
        } catch (err) {
          signal?.throwIfAborted();
          logger.warn(err, "[lorebook-keeper] Failed to refresh embedding for updated entry %s", existing.id);
        }
      }
      entryByName.set(rawName.toLowerCase(), {
        ...existing,
        content: mergedContent,
        keys: mergedKeys,
        tag: mergedTag,
      });
      continue;
    }

    const createContent = mergeLorebookKeeperUpdateContent({
      existingContent: "",
      replacementContent: content,
      newFacts: update.newFacts,
    });
    signal?.throwIfAborted();
    const created = await lorebooksStore.createEntry({
      lorebookId: targetLorebookId,
      name: rawName,
      content: createContent,
      keys,
      tag,
      enabled: true,
      ...(order !== undefined ? { order } : {}),
      ...(provenance ?? {}),
    });
    signal?.throwIfAborted();
    if (created && typeof created === "object" && "id" in created) {
      const createdEntry = created as { id: string; name?: string | null; locked?: unknown };
      writtenEntryIds.add(createdEntry.id);
      entryByName.set(rawName.toLowerCase(), {
        ...createdEntry,
        name: createdEntry.name ?? rawName,
        content: createContent,
        keys,
        tag,
      });
    }
  }

  return targetLorebookId;
}
