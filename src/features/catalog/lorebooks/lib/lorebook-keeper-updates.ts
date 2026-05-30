import type { QueryClient } from "@tanstack/react-query";
import {
  createLorebookEntrySchema,
  updateLorebookEntrySchema,
} from "../../../../engine/contracts/schemas/lorebook.schema";
import type { Chat } from "../../../../engine/contracts/types/chat";
import type { Lorebook, LorebookEntry } from "../../../../engine/contracts/types/lorebook";
import { storageApi } from "../../../../shared/api/storage-api";
import { parseChatMetadata } from "../../../../shared/lib/chat-display";
import type { PendingLorebookUpdate } from "../../../../shared/stores/agent.store";
import { chatKeys } from "../../chats/query-keys";
import { lorebookKeys } from "../query-keys";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => readString(item)).filter(Boolean)
    : typeof value === "string" && value.trim()
      ? [value.trim()]
      : [];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function entryDefaults(lorebookId: string, update: PendingLorebookUpdate): Record<string, unknown> {
  return {
    lorebookId,
    name: update.entryName || "Untitled entry",
    content: update.content,
    description: "",
    keys: update.keys,
    secondaryKeys: [],
    enabled: true,
    constant: false,
    selective: false,
    selectiveLogic: "and",
    probability: null,
    scanDepth: null,
    matchWholeWords: false,
    caseSensitive: false,
    useRegex: false,
    characterFilterMode: "any",
    characterFilterIds: [],
    characterTagFilterMode: "any",
    characterTagFilters: [],
    generationTriggerFilterMode: "any",
    generationTriggerFilters: [],
    additionalMatchingSources: [],
    position: 0,
    depth: 4,
    order: 100,
    role: "system",
    sticky: null,
    cooldown: null,
    delay: null,
    ephemeral: null,
    group: "",
    groupWeight: null,
    folderId: null,
    preventRecursion: false,
    locked: false,
    tag: update.tag,
    relationships: {},
    dynamicState: {},
    activationConditions: [],
    schedule: null,
    excludeFromVectorization: false,
    embedding: null,
  };
}

async function chatForUpdate(queryClient: QueryClient, chatId: string): Promise<Chat | null> {
  const cached = queryClient.getQueryData<Chat>(chatKeys.detail(chatId));
  if (cached) return cached;
  return (await storageApi.get<Chat>("chats", chatId).catch(() => null)) ?? null;
}

async function lorebooksForUpdate(queryClient: QueryClient): Promise<Lorebook[]> {
  const cached = queryClient.getQueryData<Lorebook[]>(lorebookKeys.list());
  if (cached) return cached;
  return storageApi.list<Lorebook>("lorebooks").catch(() => []);
}

async function resolveTargetLorebook(
  queryClient: QueryClient,
  chatId: string,
  rawUpdate: Record<string, unknown>,
): Promise<{ id: string; name: string } | null> {
  const explicitLorebookId = readString(rawUpdate.lorebookId);
  const chat = await chatForUpdate(queryClient, chatId);
  const metadata = parseChatMetadata(chat?.metadata);
  const metadataLorebookId = readString(metadata.lorebookKeeperTargetLorebookId);
  const activeLorebookIds = stringArray(metadata.activeLorebookIds);
  const lorebooks = await lorebooksForUpdate(queryClient);
  const targetId = explicitLorebookId || metadataLorebookId || activeLorebookIds[0] || lorebooks[0]?.id || "";
  if (!targetId) return null;
  const lorebook = lorebooks.find((item) => item.id === targetId);
  return { id: targetId, name: lorebook?.name || "Lorebook" };
}

function normalizeRawLorebookUpdate(raw: unknown): Record<string, unknown> | null {
  const update = asRecord(raw);
  const action = readString(update.action).toLowerCase();
  if (action !== "create" && action !== "update" && action !== "delete") return null;
  const entryName = readString(update.entryName) || readString(update.name);
  const entryId = readString(update.entryId) || readString(update.id);
  if (!entryName && !entryId) return null;
  return update;
}

function isNormalizedLorebookUpdate(value: Record<string, unknown> | null): value is Record<string, unknown> {
  return value !== null;
}

export function lorebookKeeperReviewRequired(chat: Chat | null | undefined): boolean {
  const metadata = parseChatMetadata(chat?.metadata);
  return metadata.lorebookKeeperReviewRequired !== false;
}

export async function buildPendingLorebookUpdates(
  queryClient: QueryClient,
  chatId: string,
  agentName: string,
  rawData: unknown,
): Promise<PendingLorebookUpdate[]> {
  const data = asRecord(rawData);
  const updates = Array.isArray(data.updates)
    ? data.updates.map(normalizeRawLorebookUpdate).filter(isNormalizedLorebookUpdate)
    : [];
  if (updates.length === 0) return [];

  const timestamp = Date.now();
  const pending: PendingLorebookUpdate[] = [];
  for (const rawUpdate of updates) {
    const target = await resolveTargetLorebook(queryClient, chatId, rawUpdate);
    if (!target) continue;
    const action = readString(rawUpdate.action).toLowerCase() as PendingLorebookUpdate["action"];
    pending.push({
      id: `lorebook-update-${target.id}-${timestamp}-${pending.length}`,
      chatId,
      lorebookId: target.id,
      lorebookName: target.name,
      action,
      entryId: readString(rawUpdate.entryId) || readString(rawUpdate.id) || null,
      entryName: readString(rawUpdate.entryName) || readString(rawUpdate.name) || "Untitled entry",
      content: readString(rawUpdate.content),
      newFacts: stringArray(rawUpdate.newFacts),
      keys: uniqueStrings(stringArray(rawUpdate.keys)),
      tag: readString(rawUpdate.tag),
      reason: readString(rawUpdate.reason),
      agentName,
      timestamp: timestamp + pending.length,
    });
  }
  return pending;
}

async function findExistingEntry(update: PendingLorebookUpdate): Promise<LorebookEntry | null> {
  if (update.entryId) {
    const entry = await storageApi.get<LorebookEntry>("lorebook-entries", update.entryId).catch(() => null);
    if (entry?.lorebookId === update.lorebookId) return entry;
  }
  const entries = await storageApi.list<LorebookEntry>("lorebook-entries", {
    filters: { lorebookId: update.lorebookId },
  });
  const targetName = update.entryName.trim().toLowerCase();
  return entries.find((entry) => entry.name.trim().toLowerCase() === targetName) ?? null;
}

function appendLoreFacts(existingContent: string, update: PendingLorebookUpdate): string {
  const additions = uniqueStrings([
    ...update.newFacts,
    ...(update.content && !existingContent.trim() ? [update.content] : []),
    ...(update.content &&
    existingContent.trim() &&
    !existingContent.includes(update.content) &&
    update.newFacts.length === 0
      ? [update.content]
      : []),
  ]).filter((fact) => !existingContent.toLowerCase().includes(fact.toLowerCase()));
  if (additions.length === 0) return existingContent;
  const additionText = additions.map((fact) => `- ${fact}`).join("\n");
  return [existingContent.trim(), additionText].filter(Boolean).join("\n\n");
}

export async function applyLorebookKeeperUpdate(update: PendingLorebookUpdate): Promise<void> {
  if (update.action === "create") {
    await storageApi.create<LorebookEntry>(
      "lorebook-entries",
      createLorebookEntrySchema.parse(entryDefaults(update.lorebookId, update)),
    );
    return;
  }

  const existing = await findExistingEntry(update);
  if (!existing) {
    if (update.action === "delete") return;
    await storageApi.create<LorebookEntry>(
      "lorebook-entries",
      createLorebookEntrySchema.parse(entryDefaults(update.lorebookId, update)),
    );
    return;
  }

  if (existing.locked) {
    throw new Error(`"${existing.name}" is locked and cannot be changed by Lorebook Keeper.`);
  }

  if (update.action === "delete") {
    await storageApi.delete("lorebook-entries", existing.id);
    return;
  }

  const nextContent = appendLoreFacts(existing.content ?? "", update);
  const nextKeys = uniqueStrings([...(existing.keys ?? []), ...update.keys]);
  const patch: Record<string, unknown> = {};
  if (nextContent !== existing.content) patch.content = nextContent;
  if (nextKeys.length !== (existing.keys ?? []).length) patch.keys = nextKeys;
  if (update.tag && update.tag !== existing.tag) patch.tag = update.tag;
  if (Object.keys(patch).length > 0) {
    patch.embedding = null;
    await storageApi.update<LorebookEntry>("lorebook-entries", existing.id, updateLorebookEntrySchema.parse(patch));
  }
}
