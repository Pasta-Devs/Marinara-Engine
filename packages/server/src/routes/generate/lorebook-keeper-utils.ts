import {
  customAgentHasCapability,
  normalizeLorebookCategory,
  type AgentContext,
  type LorebookEntry,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { createLorebooksStorage } from "../../services/storage/lorebooks.storage.js";

export interface LorebookKeeperSettings {
  targetLorebookId: string | null;
  readBehindMessages: number;
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

function normalizeNonNegativeInteger(value: unknown, fallback: number, max: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(numeric)));
}

export function getCustomLorebookReadBehindMessages(settings: Record<string, unknown>): number {
  return normalizeNonNegativeInteger(settings.lorebookReadBehindMessages, 0, MAX_READ_BEHIND_MESSAGES);
}

export function customAgentUsesLorebookReadBehind(agent: {
  phase: string;
  isCustomAgent?: boolean;
  settings: Record<string, unknown>;
}): boolean {
  if (
    agent.phase !== "post_processing" ||
    agent.isCustomAgent !== true ||
    getCustomLorebookReadBehindMessages(agent.settings) <= 0
  ) {
    return false;
  }

  const canEditLorebooks = customAgentHasCapability(agent.settings, "edit_lorebooks");
  const canCreateLorebooks = customAgentHasCapability(agent.settings, "create_lorebooks");
  const enabledTools = Array.isArray(agent.settings.enabledTools) ? agent.settings.enabledTools : [];
  const writesLorebookEntries =
    canEditLorebooks && (agent.settings.lorebookWriteEnabled === true || enabledTools.includes("save_lorebook_entry"));
  const emitsLorebookUpdates =
    agent.settings.resultType === "lorebook_update" && (canEditLorebooks || canCreateLorebooks);

  return writesLorebookEntries || emitsLorebookUpdates;
}

export function customLorebookReadBehindRunKey(chatId: string, agentId: string, messageId: string): string {
  return `${chatId}:${agentId}:${messageId}`;
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
    if (!comparable || seen.has(comparable)) continue;
    seen.add(comparable);
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
  const existingComparable = normalizeKeeperFactForComparison(baseContent);
  const novelFacts = facts.filter((fact) => {
    const comparable = normalizeKeeperFactForComparison(fact);
    return comparable.length > 0 && !existingComparable.includes(comparable);
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

function readKeeperUpdateName(update: Record<string, unknown>): string {
  const nestedEntry = readNestedEntry(update);
  const rawName =
    typeof update.entryName === "string"
      ? update.entryName
      : typeof update.name === "string"
        ? update.name
        : typeof nestedEntry.name === "string"
          ? nestedEntry.name
          : "";
  return rawName.trim();
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
  writableLorebooks?: WritableLorebookSummary[];
  lorebookNamingScheme?: LorebookNamingScheme;
  worldName?: string | null;
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
    lorebookNamingScheme = {},
    worldName,
    updates,
    revectorizeEntry,
    signal,
  } = args;
  signal?.throwIfAborted();

  const routedUpdates = updates.filter(
    (update) => typeof update.targetLorebook === "string" && update.targetLorebook.trim().length > 0,
  );
  if (routedUpdates.length > 0) {
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
      const target = rawTarget.trim();
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
        updates: targetUpdates,
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
    const rawName = readKeeperUpdateName(update);
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
      });
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
    });
    signal?.throwIfAborted();
    if (created && typeof created === "object" && "id" in created) {
      const createdEntry = created as { id: string; name?: string | null; locked?: unknown };
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
