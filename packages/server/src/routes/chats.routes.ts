// ──────────────────────────────────────────────
// Routes: Chats
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import AdmZip from "adm-zip";
import { logger } from "../lib/logger.js";
import {
  PROFESSOR_MARI_ID,
  createChatSchema,
  createMessageSchema,
  appendChatSummaryEntryToMetadata,
  compileChatSummaryEntries,
  createChatSummaryEntry,
  DEFAULT_CONVERSATION_PROMPT,
  DEFAULT_GAME_SYSTEM_PROMPT,
  DEFAULT_CHAT_SUMMARY_PROMPT,
  markAutonomousUnreadSchema,
  nameToXmlTag,
  normalizeChatSummaryEntries,
  resolveMacros,
  stripMacroComments,
  summariesPatchSchema,
  unwrapConversationInstructions,
  wrapConversationInstructions,
  coerceGameStateTextValue,
  normalizeTrackerFieldLocks,
  parseTrackerFieldLocks,
  normalizeTextForMatch,
} from "@marinara-engine/shared";
import type {
  CharacterData,
  ChatMemoryChunk,
  ChatMemoryRecallExportChunk,
  ChatMemoryRecallExportPayload,
  ChatMemoryRecallImportResult,
  ChatSummaryEntry,
  ExportEnvelope,
  GameNpc,
  LorebookEntryTimingState,
} from "@marinara-engine/shared";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createLorebooksStorage } from "../services/storage/lorebooks.storage.js";
import { createGameStateStorage, type GameStateVisibleAnchor } from "../services/storage/game-state.storage.js";
import { createRegexScriptsStorage } from "../services/storage/regex-scripts.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { resolveChatSummaryConnection } from "../services/chat-summary/connection-resolution.js";
import { generateMissingConversationSummaries } from "../services/conversation/auto-summary.service.js";
import { clearChatActivity, recordUserReaction } from "../services/conversation/autonomous.service.js";
import { rebuildMemoryChunks } from "../services/memory-recall.js";
import { wrapContent } from "../services/prompt/format-engine.js";
import { chatSummaryFingerprintMatches, fingerprintChatSummary } from "../services/prompt/chat-summary-fingerprint.js";
import { newId } from "../utils/id-generator.js";
import { characters, gameStateSnapshots, memoryChunks } from "../db/schema/index.js";
import { and, desc, eq, inArray } from "drizzle-orm";
import { existsSync } from "fs";
import { join } from "path";
import { DATA_DIR } from "../utils/data-dir.js";
import { normalizeTimestampOverrides } from "../services/import/import-timestamps.js";
import {
  appendNonLeadingSystemMessagesToLastUser,
  computeSummaryHideIds,
  findTrackerContextInsertIndex,
  isManualTrackerCharacterId,
  parseExtra,
  resolveRoleplayChatSummary,
  resolveRoleplaySummaryTail,
  isMessageHiddenFromAI,
  resolveBaseUrl,
  resolveActiveCharacterIds,
  resolveVisibleGameStateAnchor,
  shouldEnableAgentsForGeneration,
} from "./generate/generate-route-utils.js";
import {
  filterGameInternalAgentIds,
  resolveGameLorebookScopeExclusions,
} from "../services/lorebook/game-lorebook-scope.js";
import {
  isMemoryRecallVectorizerAvailable,
  resetMemoryRecallVectorizerCache,
  resolveMemoryRecallEmbeddingSource,
} from "../services/memory-recall-embedding.js";
import { applyRegexScriptsToPromptMessages } from "../services/regex/regex-application.js";
import { sanitizeGameNpcAvatarUrls } from "../services/game/npc-avatar-utils.js";
import { applyImmersiveHtmlPromptInjection } from "../services/generation/immersive-html-injection.js";
import { buildCommittedTrackerContextBlock } from "../services/generation/committed-tracker-context.js";
import { parseLorebookWriteApprovalText } from "./generate/agent-write-approval.js";
import { persistLorebookKeeperUpdates } from "./generate/lorebook-keeper-utils.js";

type TrackerWrapFormat = "xml" | "markdown" | "none";
type EntryStateOverrides = Record<string, { ephemeral?: number | null; enabled?: boolean }>;
const MEMORY_RECALL_IMPORT_BODY_LIMIT_BYTES = 25 * 1024 * 1024;
const MEMORY_RECALL_IMPORT_BATCH_SIZE = 500;
const PROFESSOR_MARI_INTERNAL_CHAT_MARKER = "professor-mari";

type PromptChoiceBlockRow = {
  variableName: string;
  options: unknown;
  multiSelect?: unknown;
  randomPick?: unknown;
  separator?: unknown;
};

function presetStringField(preset: Record<string, unknown> | null | undefined, field: string): string {
  const value = preset?.[field];
  return typeof value === "string" ? value.trim() : "";
}

function parsePromptChoiceOptions(value: unknown): Array<{ value: string }> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((option) => {
      if (!option || typeof option !== "object" || Array.isArray(option)) return [];
      const rawValue = (option as Record<string, unknown>).value;
      return typeof rawValue === "string" ? [{ value: rawValue }] : [];
    });
  } catch {
    return [];
  }
}

function resolvePromptChoiceVariables(
  choiceBlocks: PromptChoiceBlockRow[],
  chatChoices: Record<string, string | string[]>,
): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const block of choiceBlocks) {
    const options = parsePromptChoiceOptions(block.options);
    const optionValues = new Set(options.map((option) => option.value));
    const fallback = options[0]?.value ?? "";
    const selected = chatChoices[block.variableName];
    const isMulti = block.multiSelect === true || block.multiSelect === "true";
    const isRandom = block.randomPick === true || block.randomPick === "true";
    const separator = typeof block.separator === "string" ? block.separator : ", ";

    if (isMulti) {
      const selectedValues = Array.isArray(selected)
        ? selected.filter((value) => optionValues.has(value))
        : typeof selected === "string" && optionValues.has(selected)
          ? [selected]
          : [];
      if (selectedValues.length === 0) {
        variables[block.variableName] = fallback;
      } else if (isRandom) {
        variables[block.variableName] = selectedValues[Math.floor(Math.random() * selectedValues.length)] ?? "";
      } else {
        variables[block.variableName] = selectedValues.join(separator);
      }
      continue;
    }

    variables[block.variableName] = typeof selected === "string" && optionValues.has(selected) ? selected : fallback;
  }
  return variables;
}

function parseSnapshotJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toSafeExportName(name: string, fallback: string) {
  const safe = name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return safe || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseChatMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(raw) ? raw : {};
}

function isHomeProfessorMariChat(chat: { metadata?: unknown }) {
  return parseChatMetadata(chat.metadata).internalAssistant === PROFESSOR_MARI_INTERNAL_CHAT_MARKER;
}

function hasProfessorMariCharacter(chat: { characterIds?: unknown }) {
  return resolveChatCharacterIds(chat.characterIds).includes(PROFESSOR_MARI_ID);
}

function shouldHideProfessorMariChat(chat: { metadata?: unknown }) {
  return isHomeProfessorMariChat(chat);
}

function isUsableTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(new Date(value).getTime());
}

function normalizeMemoryEmbedding(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return null;
  const vector: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isFinite(item)) return null;
    vector.push(item);
  }
  return vector;
}

function parseMemoryEmbedding(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    return normalizeMemoryEmbedding(JSON.parse(raw));
  } catch {
    return null;
  }
}

function normalizeMemoryRecallImportChunk(value: unknown, importedAt: string): ChatMemoryRecallExportChunk | null {
  if (!isRecord(value) || typeof value.content !== "string" || value.content.trim().length === 0) return null;
  const messageCount =
    Number.isInteger(value.messageCount) && Number(value.messageCount) > 0 ? Number(value.messageCount) : 1;
  const firstMessageAt = isUsableTimestamp(value.firstMessageAt) ? value.firstMessageAt : importedAt;
  const lastMessageAt = isUsableTimestamp(value.lastMessageAt) ? value.lastMessageAt : firstMessageAt;
  const createdAt = isUsableTimestamp(value.createdAt) ? value.createdAt : importedAt;

  return {
    content: value.content,
    embedding: normalizeMemoryEmbedding(value.embedding),
    messageCount,
    firstMessageAt,
    lastMessageAt,
    createdAt,
  };
}

function getMemoryRecallChunkImportKey(
  chunk: Pick<ChatMemoryRecallExportChunk, "content" | "firstMessageAt" | "lastMessageAt">,
): string {
  return JSON.stringify([chunk.firstMessageAt, chunk.lastMessageAt, chunk.content]);
}

function readMemoryRecallImportPayload(
  body: unknown,
): { chunks: ChatMemoryRecallExportChunk[]; skipped: number; sourceChatId: string | null } | null {
  if (!isRecord(body) || body.type !== "marinara_memory_recall" || body.version !== 1) return null;
  const data = body.data;
  if (!isRecord(data) || !Array.isArray(data.chunks)) return null;
  const sourceChat = data.sourceChat;
  if (!isRecord(sourceChat) || typeof sourceChat.id !== "string" || sourceChat.id.trim().length === 0) {
    return null;
  }
  const sourceChatId = sourceChat.id.trim();

  const importedAt = new Date().toISOString();
  const chunks: ChatMemoryRecallExportChunk[] = [];
  for (const chunk of data.chunks) {
    const normalized = normalizeMemoryRecallImportChunk(chunk, importedAt);
    if (normalized) chunks.push(normalized);
  }
  return { chunks, skipped: data.chunks.length - chunks.length, sourceChatId };
}

function sanitizeChatGameNpcAvatars<T extends { metadata?: unknown }>(chat: T): T {
  const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
  if (!metadata || typeof metadata !== "object") return chat;
  const gameNpcs = Array.isArray((metadata as Record<string, unknown>).gameNpcs)
    ? ((metadata as Record<string, unknown>).gameNpcs as GameNpc[])
    : null;
  if (!gameNpcs) return chat;
  const sanitizedNpcs = sanitizeGameNpcAvatarUrls(gameNpcs);
  if (sanitizedNpcs === gameNpcs) return chat;
  const sanitizedMetadata = { ...(metadata as Record<string, unknown>), gameNpcs: sanitizedNpcs };
  return {
    ...chat,
    metadata: typeof chat.metadata === "string" ? JSON.stringify(sanitizedMetadata) : sanitizedMetadata,
  };
}
type SummaryEntriesPatchBody =
  | { operation: "replace"; entry: Partial<ChatSummaryEntry> & { id: string; content: string } }
  | { operation: "delete"; entryId: string }
  | { operation: "toggle"; entryId: string; enabled: boolean };

async function loadLatestChatGameSnapshot(
  app: FastifyInstance,
  chatId: string,
  visibleAnchor?: GameStateVisibleAnchor | null,
) {
  return createGameStateStorage(app.db).getForGeneration(chatId, {
    preferLatestVisible: true,
    visibleAnchor,
  });
}

function formatPeekTrackerContextBlock(args: {
  wrapFormat: TrackerWrapFormat;
  snap: typeof gameStateSnapshots.$inferSelect;
  chatMeta: Record<string, unknown>;
  chatEnableAgents: boolean;
  activeAgentIds: string[];
}): string | null {
  return buildCommittedTrackerContextBlock({
    chatEnableAgents: args.chatEnableAgents,
    activeAgentIds: args.activeAgentIds,
    latestGameState: args.snap,
    chatMetadata: args.chatMeta,
    wrapFormat: args.wrapFormat,
  });
}

function resolveLorebookGenerationTriggers(mode: unknown): string[] {
  const modeTrigger = mode === "game" ? "game" : typeof mode === "string" && mode.trim() ? mode.trim() : "roleplay";
  return Array.from(new Set([modeTrigger, "chat"]));
}

function resolveChatCharacterIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function toPeekPromptMessages(
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
    contextKind?: "prompt" | "history" | "injection";
  }>,
): Array<{ role: string; content: string }> {
  return appendNonLeadingSystemMessagesToLastUser(messages).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function cardPromptText(value: unknown): string {
  return typeof value === "string" ? stripMacroComments(value).trim() : "";
}

async function buildPersonaSnapshotForChat(app: FastifyInstance, chat: { personaId?: string | null } | null) {
  const charactersStore = createCharactersStorage(app.db);
  const personas = await charactersStore.listPersonas();
  const chatPersonaId = chat?.personaId ?? null;
  const persona =
    (chatPersonaId ? personas.find((candidate) => candidate.id === chatPersonaId) : null) ??
    personas.find((candidate) => candidate.isActive === "true");

  if (!persona) return null;

  return {
    personaId: persona.id,
    name: persona.name,
    description: persona.description ?? "",
    personality: persona.personality ?? "",
    scenario: persona.scenario ?? "",
    backstory: persona.backstory ?? "",
    appearance: persona.appearance ?? "",
    avatarUrl: persona.avatarPath || null,
    avatarCrop: persona.avatarCrop || null,
    nameColor: persona.nameColor || null,
    dialogueColor: persona.dialogueColor || null,
    boxColor: persona.boxColor || null,
  };
}

function resolveEntryStateOverrides(value: unknown): EntryStateOverrides | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;

  const overrides: EntryStateOverrides = {};
  for (const [entryId, override] of Object.entries(value)) {
    if (typeof override !== "object" || override === null || Array.isArray(override)) return undefined;
    const { ephemeral, enabled } = override as Record<string, unknown>;
    if (ephemeral !== undefined && ephemeral !== null && typeof ephemeral !== "number") return undefined;
    if (enabled !== undefined && typeof enabled !== "boolean") return undefined;
    overrides[entryId] = {
      ...(ephemeral !== undefined ? { ephemeral } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    };
  }

  return overrides;
}

export async function chatsRoutes(app: FastifyInstance) {
  const storage = createChatsStorage(app.db);

  const clearConversationScheduleState = async (chat: Awaited<ReturnType<typeof storage.getById>>) => {
    if (!chat) return;
    const characterIds: string[] =
      typeof chat.characterIds === "string"
        ? JSON.parse(chat.characterIds)
        : Array.isArray(chat.characterIds)
          ? chat.characterIds
          : [];
    if (characterIds.length === 0) return;

    const characterStorage = createCharactersStorage(app.db);
    for (const characterId of characterIds) {
      const row = await characterStorage.getById(characterId);
      if (!row) continue;
      const data = JSON.parse(row.data as string) as CharacterData;
      const currentExtensions = (data.extensions ?? {}) as Record<string, unknown>;
      if (currentExtensions.conversationStatus === "online" && currentExtensions.conversationActivity == null) {
        continue;
      }
      const extensions: Record<string, unknown> = {
        ...currentExtensions,
        conversationStatus: "online",
        conversationActivity: undefined,
      };
      await characterStorage.update(characterId, { extensions } as Partial<CharacterData>, undefined, {
        skipVersionSnapshot: true,
      });
    }
  };

  // List all chats
  app.get("/", async () => {
    const chats = await storage.list();
    return chats.filter((chat) => !shouldHideProfessorMariChat(chat)).map(sanitizeChatGameNpcAvatars);
  });

  app.get<{ Querystring: { connectionId?: string; personaId?: string } }>("/internal/professor-mari", async (req) => {
    const chats = await storage.list();
    const existing = chats.find(isHomeProfessorMariChat);
    const hasConnectionOverride = "connectionId" in req.query;
    const connectionId =
      typeof req.query.connectionId === "string" && req.query.connectionId ? req.query.connectionId : null;
    const personaId = typeof req.query.personaId === "string" && req.query.personaId ? req.query.personaId : null;

    if (existing) {
      const nextConnectionId = hasConnectionOverride ? connectionId : (existing.connectionId ?? null);
      await storage.update(existing.id, {
        characterIds: [PROFESSOR_MARI_ID],
        connectionId: nextConnectionId,
        personaId,
        promptPresetId: null,
      });
      const updated = await storage.patchMetadata(existing.id, {
        internalAssistant: PROFESSOR_MARI_INTERNAL_CHAT_MARKER,
        enableAgents: false,
        autonomousMessages: false,
        characterExchanges: false,
        tags: ["internal"],
      });
      return sanitizeChatGameNpcAvatars(updated ?? existing);
    }

    const created = await storage.create({
      name: "Professor Mari",
      mode: "conversation",
      characterIds: [PROFESSOR_MARI_ID],
      groupId: null,
      personaId,
      promptPresetId: null,
      connectionId,
    });
    if (!created) return created;
    const updated = await storage.patchMetadata(created.id, {
      internalAssistant: PROFESSOR_MARI_INTERNAL_CHAT_MARKER,
      enableAgents: false,
      autonomousMessages: false,
      characterExchanges: false,
      tags: ["internal"],
    });
    return sanitizeChatGameNpcAvatars(updated ?? created);
  });

  // List chats by group
  app.get<{ Params: { groupId: string } }>("/group/:groupId", async (req) => {
    const chats = await storage.listByGroup(req.params.groupId);
    return chats.filter((chat) => !shouldHideProfessorMariChat(chat)).map(sanitizeChatGameNpcAvatars);
  });

  // Get single chat
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat || isHomeProfessorMariChat(chat)) {
      return reply.status(404).send({ error: "Chat not found" });
    }
    return sanitizeChatGameNpcAvatars(chat);
  });

  // Create chat
  app.post("/", async (req, reply) => {
    const input = createChatSchema.parse(req.body);
    if (input.characterIds.includes(PROFESSOR_MARI_ID)) {
      return reply.status(400).send({ error: "Professor Mari is only available from the Home screen." });
    }
    const body = req.body as Record<string, unknown>;
    const chat = await storage.create(
      input,
      normalizeTimestampOverrides({
        createdAt: body.createdAt,
        updatedAt: body.updatedAt,
      }),
    );
    if (!chat) return chat;

    return chat;
  });

  // Update chat
  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const data = createChatSchema.partial().parse(req.body);
    const existing = await storage.getById(req.params.id);
    if (!existing || isHomeProfessorMariChat(existing)) {
      return reply.status(404).send({ error: "Chat not found" });
    }
    if (data.characterIds?.includes(PROFESSOR_MARI_ID) && !hasProfessorMariCharacter(existing)) {
      return reply.status(400).send({ error: "Professor Mari is only available from the Home screen." });
    }
    return storage.update(req.params.id, data);
  });

  app.post<{ Params: { id: string } }>("/:id/touch", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat || isHomeProfessorMariChat(chat)) {
      return reply.status(404).send({ error: "Chat not found" });
    }
    return storage.touch(req.params.id);
  });

  // Update chat metadata (partial merge)
  app.patch<{ Params: { id: string } }>("/:id/metadata", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const incoming = req.body as Record<string, unknown>;
    // Validate Discord webhook URL if provided
    if (typeof incoming.discordWebhookUrl === "string" && incoming.discordWebhookUrl.trim()) {
      const url = incoming.discordWebhookUrl.trim();
      if (!/^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url)) {
        return reply.status(400).send({ error: "Invalid Discord webhook URL" });
      }
      incoming.discordWebhookUrl = url;
    }
    if (incoming.inactiveCharacterIds !== undefined) {
      if (
        !Array.isArray(incoming.inactiveCharacterIds) ||
        !incoming.inactiveCharacterIds.every((id) => typeof id === "string")
      ) {
        return reply.status(400).send({ error: "inactiveCharacterIds must be an array of strings" });
      }
      const characterIds: string[] =
        typeof chat.characterIds === "string"
          ? JSON.parse(chat.characterIds)
          : Array.isArray(chat.characterIds)
            ? chat.characterIds
            : [];
      const validIds = new Set(characterIds);
      incoming.inactiveCharacterIds = Array.from(
        new Set((incoming.inactiveCharacterIds as string[]).filter((id) => validIds.has(id))),
      );
    }
    if (incoming.conversationSchedulesEnabled === false) {
      await clearConversationScheduleState(chat);
      incoming.characterSchedules = undefined;
      incoming.scheduleWeekStart = undefined;
    }
    return storage.patchMetadata(req.params.id, incoming);
  });

  // Mark a chat as having autonomous messages the user has not viewed yet.
  app.post<{ Params: { id: string } }>("/:id/autonomous-unread", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const input = markAutonomousUnreadSchema.parse(req.body ?? {});
    return storage.markAutonomousUnread(req.params.id, input);
  });

  // Clear autonomous unread state when the user views the relevant chat.
  app.delete<{ Params: { id: string } }>("/:id/autonomous-unread", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    return storage.clearAutonomousUnread(req.params.id);
  });

  // Update chat summaries (entry-level merge for day/week summaries).
  // Dedicated from generic metadata PATCH so concurrent user edits don't overwrite
  // the entire daySummaries/weekSummaries maps — patchMetadata serializes the
  // read-modify-write per chat and merges per-entry onto fresh metadata, so a
  // queued in-flight generation write can't interleave between the read and write
  // and clobber user edits on other keys.
  app.patch<{ Params: { id: string } }>("/:id/summaries", async (req, reply) => {
    const parsed = summariesPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid summaries payload", issues: parsed.error.issues });
    }
    const updated = await storage.patchMetadata(req.params.id, (current) => ({
      daySummaries: {
        ...((current.daySummaries as Record<string, unknown>) ?? {}),
        ...(parsed.data.daySummaries ?? {}),
      },
      weekSummaries: {
        ...((current.weekSummaries as Record<string, unknown>) ?? {}),
        ...(parsed.data.weekSummaries ?? {}),
      },
    }));
    if (!updated) return reply.status(404).send({ error: "Chat not found" });
    return updated;
  });

  // Update rolling summary entries without replacing unrelated chat metadata.
  app.patch<{ Params: { id: string }; Body: SummaryEntriesPatchBody }>("/:id/summary-entries", async (req, reply) => {
    const body = req.body;
    if (!body || typeof body !== "object" || !("operation" in body)) {
      return reply.status(400).send({ error: "Invalid summary entry operation" });
    }
    if (body.operation === "replace") {
      if (
        !body.entry ||
        typeof body.entry.id !== "string" ||
        !body.entry.id.trim() ||
        typeof body.entry.content !== "string" ||
        !body.entry.content.trim()
      ) {
        return reply.status(400).send({ error: "replace requires entry.id and entry.content" });
      }
    } else if (body.operation === "delete") {
      if (typeof body.entryId !== "string" || !body.entryId.trim()) {
        return reply.status(400).send({ error: "delete requires entryId" });
      }
    } else if (body.operation === "toggle") {
      if (typeof body.entryId !== "string" || !body.entryId.trim() || typeof body.enabled !== "boolean") {
        return reply.status(400).send({ error: "toggle requires entryId and enabled" });
      }
    } else {
      return reply.status(400).send({ error: "Unsupported summary entry operation" });
    }

    // For delete: restore visibility of the messages this entry covered (except
    // any still covered by another enabled entry) BEFORE removing the entry.
    // Unhiding first is what keeps this safe without a transaction: if the
    // metadata write below fails, the messages are visible and the entry still
    // exists (a benign, self-consistent state) — never hidden with no entry to
    // justify them. So no rollback bookkeeping is needed.
    if (body.operation === "delete") {
      const current = await storage.getById(req.params.id);
      if (!current) return reply.status(404).send({ error: "Chat not found" });
      const currentMeta = parseExtra(current.metadata) as Record<string, unknown>;
      const currentEntries = normalizeChatSummaryEntries(currentMeta.summaryEntries, {
        legacySummary: typeof currentMeta.summary === "string" ? currentMeta.summary : null,
      });
      const target = currentEntries.find((entry) => entry.id === body.entryId);
      if (target) {
        // Restore exactly what this entry hid. `hiddenMessageIds` records the
        // precise hidden subset; older entries without it fall back to messageIds.
        const covered = target.hiddenMessageIds ?? target.messageIds ?? [];
        const stillCovered = new Set<string>();
        for (const entry of currentEntries) {
          if (entry.id === body.entryId || !entry.enabled) continue;
          for (const id of entry.hiddenMessageIds ?? entry.messageIds ?? []) stillCovered.add(id);
        }
        const toUnhide = covered.filter((id) => !stillCovered.has(id));
        if (toUnhide.length > 0) {
          await storage.bulkSetHiddenFromAI(req.params.id, toUnhide, false);
        }
      }
    }

    const updated = await storage.patchMetadata(req.params.id, (freshMeta) => {
      const entries = normalizeChatSummaryEntries(freshMeta.summaryEntries, {
        legacySummary: typeof freshMeta.summary === "string" ? freshMeta.summary : null,
      });
      let nextEntries: ChatSummaryEntry[];

      if (body.operation === "replace") {
        const now = new Date().toISOString();
        const existing = entries.find((entry) => entry.id === body.entry.id);
        const replacement = createChatSummaryEntry(
          {
            ...existing,
            ...body.entry,
            id: body.entry.id,
            content: body.entry.content,
            updatedAt: now,
            createdAt: existing?.createdAt ?? body.entry.createdAt ?? now,
          },
          { createId: newId, now },
        );
        nextEntries = entries.some((entry) => entry.id === replacement.id)
          ? entries.map((entry) => (entry.id === replacement.id ? replacement : entry))
          : [...entries, replacement];
      } else if (body.operation === "delete") {
        nextEntries = entries.filter((entry) => entry.id !== body.entryId);
      } else if (body.operation === "toggle") {
        const now = new Date().toISOString();
        nextEntries = entries.map((entry) =>
          entry.id === body.entryId ? { ...entry, enabled: body.enabled, updatedAt: now } : entry,
        );
      } else {
        nextEntries = entries;
      }

      return {
        summaryEntries: nextEntries,
        summary: compileChatSummaryEntries(nextEntries),
      };
    });

    if (!updated) return reply.status(404).send({ error: "Chat not found" });
    return updated;
  });

  app.post<{
    Params: { id: string };
    Body: {
      kind?: unknown;
      text?: unknown;
      payload?: unknown;
      agentName?: unknown;
      agentType?: unknown;
    };
  }>("/:id/agent-write-approval/commit", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const body = req.body ?? {};
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return reply.status(400).send({ error: "Approval text is required" });

    if (body.kind === "summary_update") {
      const payload = isRecord(body.payload) ? body.payload : {};
      const messageIds = Array.isArray(payload.messageIds)
        ? payload.messageIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : [];
      const messageCount =
        typeof payload.messageCount === "number" && Number.isFinite(payload.messageCount)
          ? Math.max(1, Math.trunc(payload.messageCount))
          : messageIds.length || undefined;
      const promptTemplateId =
        typeof payload.promptTemplateId === "string" && payload.promptTemplateId.trim()
          ? payload.promptTemplateId.trim()
          : null;
      let combined: string | null = text;
      let createdEntry: ChatSummaryEntry | null = null;
      let summaryEntries: ChatSummaryEntry[] = [];
      const updated = await storage.patchMetadata(req.params.id, (freshMeta) => {
        const now = new Date().toISOString();
        const result = appendChatSummaryEntryToMetadata(
          freshMeta,
          {
            kind: "rolling",
            origin: "automated",
            sourceMode: "agent",
            content: text,
            enabled: true,
            ...(messageCount ? { messageCount } : {}),
            ...(messageIds.length > 0 ? { messageIds } : {}),
            promptTemplateId,
            createdAt: now,
            updatedAt: now,
          },
          { createId: newId, now },
        );
        combined = result.summary;
        createdEntry = result.entry;
        summaryEntries = result.entries;
        return {
          summary: result.summary,
          summaryEntries: result.entries,
        };
      });
      if (!updated) return reply.status(404).send({ error: "Chat not found" });
      // Auto-hide is intentionally NOT applied on the approval-gated commit path:
      // the proposal's messageIds/ordering are captured at proposal time but the
      // entry commits later, so hiding here could target a drifted snapshot.
      // Approval-gated chats hide via the manual popover toggle; only the inline
      // auto-summary path (no approval delay) auto-hides.
      return { ok: true, summary: combined, entry: createdEntry, entries: summaryEntries };
    }

    if (body.kind === "lorebook_update") {
      const payload = isRecord(body.payload) ? body.payload : {};
      const updates = parseLorebookWriteApprovalText(text);
      if (updates.length === 0) {
        return reply.status(400).send({ error: "No lorebook entries found in approval text" });
      }
      const preferredTargetLorebookId =
        typeof payload.preferredTargetLorebookId === "string" && payload.preferredTargetLorebookId.trim()
          ? payload.preferredTargetLorebookId.trim()
          : null;
      const writableLorebookIds = Array.isArray(payload.writableLorebookIds)
        ? payload.writableLorebookIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : null;
      const lorebooksStore = createLorebooksStorage(app.db);
      const targetLorebookId = await persistLorebookKeeperUpdates({
        lorebooksStore,
        chatId: req.params.id,
        chatName: (chat as { name?: string | null }).name,
        preferredTargetLorebookId,
        writableLorebookIds,
        updates,
      });
      return { ok: true, targetLorebookId };
    }

    return reply.status(400).send({ error: "Unsupported agent write approval kind" });
  });

  // Generate any missing conversation day/week summaries on demand. This uses
  // the same summary pipeline as conversation generation, but scans the full
  // scoped chat history so old failed days remain recoverable.
  app.post<{ Params: { id: string } }>("/:id/backfill-summaries", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    if (chat.mode !== "conversation") return reply.status(400).send({ error: "Not a conversation chat" });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const maxMissingDays = Math.max(1, Math.min(60, Math.floor(Number(body.maxMissingDays) || 14)));
    const chatMeta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});

    const connections = createConnectionsStorage(app.db);
    const connId = chat.connectionId ?? (await connections.getDefault())?.id;
    if (!connId) return reply.status(400).send({ error: "No API connection configured for this chat" });
    const conn = await connections.getWithKey(connId);
    if (!conn) return reply.status(400).send({ error: "API connection not found" });

    let baseUrl = conn.baseUrl;
    if (!baseUrl) {
      const { PROVIDERS } = await import("@marinara-engine/shared");
      const providerDef = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
      baseUrl = providerDef?.defaultBaseUrl ?? "";
    }
    if (!baseUrl && conn.provider === "claude_subscription") baseUrl = "claude-agent-sdk://local";
    if (!baseUrl && conn.provider === "openai_chatgpt") baseUrl = "openai-chatgpt://codex-auth";
    if (!baseUrl) return reply.status(400).send({ error: "No base URL for this connection" });

    const characterIds: string[] = Array.isArray(chat.characterIds)
      ? chat.characterIds
      : typeof chat.characterIds === "string"
        ? JSON.parse(chat.characterIds)
        : [];
    const charactersStore = createCharactersStorage(app.db);
    const charIdToName = new Map<string, string>();
    for (const characterId of characterIds) {
      const row = await charactersStore.getById(characterId);
      if (!row) continue;
      try {
        const data = JSON.parse(row.data as string);
        charIdToName.set(characterId, typeof data.name === "string" && data.name.trim() ? data.name : "Character");
      } catch {
        charIdToName.set(characterId, "Character");
      }
    }

    const personas = await charactersStore.listPersonas();
    const persona =
      (chat.personaId ? personas.find((candidate) => candidate.id === chat.personaId) : null) ??
      personas.find((candidate) => candidate.isActive === "true");
    const personaName = persona?.name ?? "User";

    const allMessages = await storage.listMessages(req.params.id);
    let startIdx = 0;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const extra = parseExtra(allMessages[i]!.extra);
      if (extra.isConversationStart) {
        startIdx = i;
        break;
      }
    }
    const scopedMessages = startIdx > 0 ? allMessages.slice(startIdx) : allMessages;

    const provider = createLLMProvider(
      conn.provider,
      baseUrl,
      conn.apiKey,
      conn.maxContext,
      conn.openrouterProvider,
      conn.maxTokensOverride,
    );
    const result = await generateMissingConversationSummaries({
      messages: scopedMessages,
      metadata: chatMeta,
      provider,
      model: conn.model,
      personaName,
      charIdToName,
      rolloverHour: Math.max(0, Math.min(11, Math.floor((chatMeta.dayRolloverHour as number | undefined) ?? 4))),
      maxMissingDays,
    });

    for (const failure of result.failedDays) {
      logger.warn(
        { chatId: req.params.id, date: failure.date, err: failure.error },
        "[conversation-summary] manual backfill failed day summary",
      );
    }
    for (const failure of result.failedWeeks) {
      logger.warn(
        { chatId: req.params.id, weekKey: failure.weekKey, err: failure.error },
        "[conversation-summary] manual backfill failed week summary",
      );
    }

    const hasNewSummaries =
      Object.keys(result.newlyGeneratedDays).length > 0 || Object.keys(result.newlyConsolidatedWeeks).length > 0;
    if (hasNewSummaries) {
      await storage.patchMetadata(req.params.id, (freshMeta) => {
        const existingDaySummaries = (freshMeta.daySummaries as Record<string, unknown> | undefined) ?? {};
        const existingWeekSummaries = (freshMeta.weekSummaries as Record<string, unknown> | undefined) ?? {};
        return {
          ...freshMeta,
          daySummaries: { ...existingDaySummaries, ...result.newlyGeneratedDays },
          weekSummaries: { ...existingWeekSummaries, ...result.newlyConsolidatedWeeks },
        };
      });
    }

    return {
      generatedDays: Object.keys(result.newlyGeneratedDays),
      consolidatedWeeks: Object.keys(result.newlyConsolidatedWeeks),
      failedDays: result.failedDays,
      failedWeeks: result.failedWeeks,
      missingDayCount: result.missingDayCount,
      processedDayCount: result.processedDayCount,
      remainingMissingDayCount: result.remainingMissingDayCount,
    };
  });

  // ── Chat Connections (OOC ↔ Roleplay) ──

  // Connect two chats bidirectionally
  app.post<{ Params: { id: string } }>("/:id/connect", async (req, reply) => {
    const { targetChatId } = req.body as { targetChatId: string };
    if (!targetChatId || typeof targetChatId !== "string") {
      return reply.status(400).send({ error: "targetChatId is required" });
    }
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const target = await storage.getById(targetChatId);
    if (!target) return reply.status(404).send({ error: "Target chat not found" });
    // Don't allow self-connection
    if (req.params.id === targetChatId) {
      return reply.status(400).send({ error: "Cannot connect a chat to itself" });
    }
    await storage.connectChats(req.params.id, targetChatId);
    return { connected: true, chatId: req.params.id, targetChatId };
  });

  // Disconnect a chat from its partner
  app.post<{ Params: { id: string } }>("/:id/disconnect", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    await storage.disconnectChat(req.params.id);
    await storage.deleteInfluencesForChat(req.params.id);
    await storage.deleteNotesForChat(req.params.id);
    return { disconnected: true };
  });

  // List pending OOC influences for a chat
  app.get<{ Params: { id: string } }>("/:id/influences", async (req) => {
    return storage.listPendingInfluences(req.params.id);
  });

  // List durable conversation notes targeting a chat
  app.get<{ Params: { id: string } }>("/:id/notes", async (req) => {
    return storage.listNotes(req.params.id);
  });

  // Delete a single conversation note (scoped to the target chat to prevent cross-chat deletion)
  app.delete<{ Params: { id: string; noteId: string } }>("/:id/notes/:noteId", async (req, reply) => {
    await storage.deleteNoteForChat(req.params.id, req.params.noteId);
    return reply.status(204).send();
  });

  // Clear every conversation note targeting a chat
  app.delete<{ Params: { id: string } }>("/:id/notes", async (req, reply) => {
    await storage.clearNotes(req.params.id);
    return reply.status(204).send();
  });

  // Delete all chats in a group (all branches)
  app.delete<{ Params: { groupId: string }; Querystring: { force?: string } }>("/group/:groupId", async (req, reply) => {
    const force = req.query.force === "true" || req.query.force === "1";
    const guard = await storage.canDeleteGroup(req.params.groupId, { force });
    if (!guard.allowed) {
      return reply.status(409).send({ error: guard.reason });
    }
    await storage.removeGroup(req.params.groupId);
    return reply.status(204).send();
  });

  // Delete chat
  app.delete<{ Params: { id: string }; Querystring: { force?: string } }>("/:id", async (req, reply) => {
    const force = req.query.force === "true" || req.query.force === "1";
    const guard = await storage.canDeleteChat(req.params.id, { force });
    if (!guard.allowed) {
      return reply.status(409).send({ error: guard.reason });
    }
    // If this is a scene chat, clean up the origin chat's scene pointer
    const chat = await storage.getById(req.params.id);
    if (chat) {
      const meta = parseExtra(chat.metadata) as Record<string, unknown>;
      const originId = meta.sceneOriginChatId;
      if (typeof originId === "string" && originId) {
        const origin = await storage.getById(originId);
        if (origin) {
          const originMeta = parseExtra(origin.metadata) as Record<string, unknown>;
          delete originMeta.activeSceneChatId;
          delete originMeta.sceneBusyCharIds;
          await storage.updateMetadata(originId, originMeta);
        }
      }
    }
    const activeGenerations = (app as unknown as {
      activeGenerations?: Map<string, { abortController?: AbortController }>;
    }).activeGenerations;
    activeGenerations?.get(req.params.id)?.abortController?.abort();
    activeGenerations?.delete(req.params.id);
    clearChatActivity(req.params.id);
    // Disconnect from partner chat before deleting
    await storage.disconnectChat(req.params.id);
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });

  // ── Messages ──

  // List messages for a chat (supports pagination via ?limit=N&before=CURSOR)
  app.get<{ Params: { id: string }; Querystring: { limit?: string; before?: string } }>(
    "/:id/messages",
    async (req) => {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 0;
      if (limit > 0) {
        return storage.listMessagesPaginated(req.params.id, limit, req.query.before || undefined);
      }
      return storage.listMessages(req.params.id);
    },
  );

  // Total message count for a chat (lightweight, for absolute numbering)
  app.get<{ Params: { id: string } }>("/:id/message-count", async (req) => {
    return { count: await storage.countMessages(req.params.id) };
  });

  // List memory-recall chunks for this chat only.
  app.get<{ Params: { id: string } }>("/:id/memories", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const vectorizerAvailable = await isMemoryRecallVectorizerAvailable(app.db, {
      chatMetadata: chat.metadata,
      connectionId: chat.connectionId,
    });

    const chunks = await app.db
      .select({
        id: memoryChunks.id,
        chatId: memoryChunks.chatId,
        content: memoryChunks.content,
        embedding: memoryChunks.embedding,
        messageCount: memoryChunks.messageCount,
        firstMessageAt: memoryChunks.firstMessageAt,
        lastMessageAt: memoryChunks.lastMessageAt,
        createdAt: memoryChunks.createdAt,
      })
      .from(memoryChunks)
      .where(eq(memoryChunks.chatId, req.params.id))
      .orderBy(desc(memoryChunks.lastMessageAt));

    return chunks.map(
      ({ embedding, ...chunk }) =>
        ({
          ...chunk,
          hasEmbedding: !!embedding,
          embeddingStatus: embedding ? "vectorized" : vectorizerAvailable ? "pending" : "unavailable",
        }) satisfies ChatMemoryChunk,
    );
  });

  // Export memory-recall chunks for this chat so they can be imported into another chat.
  app.get<{ Params: { id: string } }>("/:id/memories/export", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const chunks = await app.db
      .select({
        content: memoryChunks.content,
        embedding: memoryChunks.embedding,
        messageCount: memoryChunks.messageCount,
        firstMessageAt: memoryChunks.firstMessageAt,
        lastMessageAt: memoryChunks.lastMessageAt,
        createdAt: memoryChunks.createdAt,
      })
      .from(memoryChunks)
      .where(eq(memoryChunks.chatId, req.params.id))
      .orderBy(memoryChunks.firstMessageAt);

    const payload: ChatMemoryRecallExportPayload = {
      sourceChat: {
        id: chat.id,
        name: chat.name,
        mode: chat.mode,
        memoryCount: chunks.length,
      },
      chunks: chunks.map((chunk) => ({
        content: chunk.content,
        embedding: parseMemoryEmbedding(chunk.embedding),
        messageCount: chunk.messageCount,
        firstMessageAt: chunk.firstMessageAt,
        lastMessageAt: chunk.lastMessageAt,
        createdAt: chunk.createdAt,
      })),
    };
    const envelope: ExportEnvelope<ChatMemoryRecallExportPayload> = {
      type: "marinara_memory_recall",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: payload,
    };

    return reply
      .header("Content-Type", "application/json")
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(
          `${toSafeExportName(chat.name || "chat", "chat")}-memory-recall.marinara.json`,
        )}"`,
      )
      .send(envelope);
  });

  // Import exported memory-recall chunks into this chat. Imported rows are retargeted to this chat.
  app.post<{ Params: { id: string }; Querystring: { replace?: string } }>(
    "/:id/memories/import",
    { bodyLimit: MEMORY_RECALL_IMPORT_BODY_LIMIT_BYTES },
    async (req, reply) => {
      const chat = await storage.getById(req.params.id);
      if (!chat) return reply.status(404).send({ error: "Chat not found" });

      const parsed = readMemoryRecallImportPayload(req.body);
      if (!parsed) {
        logger.warn("[memory-recall] Rejected invalid import payload for chat %s", req.params.id);
        return reply.status(400).send({ error: "Invalid Memory Recall export file" });
      }
      if (parsed.chunks.length === 0) {
        logger.warn("[memory-recall] Rejected import with no usable chunks for chat %s", req.params.id);
        return reply.status(400).send({ error: "No usable memory chunks found in this export file" });
      }

      const replace = req.query.replace === "true";
      const importedSourceChatId =
        parsed.sourceChatId && parsed.sourceChatId !== req.params.id ? parsed.sourceChatId : null;
      const existingChunkIds = replace
        ? await app.db.select({ id: memoryChunks.id }).from(memoryChunks).where(eq(memoryChunks.chatId, req.params.id))
        : [];

      const existing = replace
        ? []
        : await app.db
            .select({
              content: memoryChunks.content,
              firstMessageAt: memoryChunks.firstMessageAt,
              lastMessageAt: memoryChunks.lastMessageAt,
            })
            .from(memoryChunks)
            .where(eq(memoryChunks.chatId, req.params.id));
      const existingKeys = new Set(existing.map(getMemoryRecallChunkImportKey));

      let skipped = parsed.skipped;
      const rowsToInsert: Array<typeof memoryChunks.$inferInsert> = [];
      for (const chunk of parsed.chunks) {
        const key = getMemoryRecallChunkImportKey(chunk);
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        rowsToInsert.push({
          id: newId(),
          chatId: req.params.id,
          content: chunk.content,
          embedding: chunk.embedding ? JSON.stringify(chunk.embedding) : null,
          messageCount: chunk.messageCount,
          sourceChatId: importedSourceChatId,
          firstMessageAt: chunk.firstMessageAt,
          lastMessageAt: chunk.lastMessageAt,
          createdAt: chunk.createdAt,
        });
        existingKeys.add(key);
      }

      for (let i = 0; i < rowsToInsert.length; i += MEMORY_RECALL_IMPORT_BATCH_SIZE) {
        await app.db.insert(memoryChunks).values(rowsToInsert.slice(i, i + MEMORY_RECALL_IMPORT_BATCH_SIZE));
      }

      if (replace && existingChunkIds.length > 0) {
        for (let i = 0; i < existingChunkIds.length; i += MEMORY_RECALL_IMPORT_BATCH_SIZE) {
          const ids = existingChunkIds.slice(i, i + MEMORY_RECALL_IMPORT_BATCH_SIZE).map((chunk) => chunk.id);
          await app.db
            .delete(memoryChunks)
            .where(and(eq(memoryChunks.chatId, req.params.id), inArray(memoryChunks.id, ids)));
        }
      }

      const imported = rowsToInsert.length;
      logger.info(
        "[memory-recall] Imported %d memory chunks into chat %s (skipped %d, replaced=%s)",
        imported,
        req.params.id,
        skipped,
        replace,
      );

      return {
        imported,
        skipped,
        replaced: replace,
      } satisfies ChatMemoryRecallImportResult;
    },
  );

  // Rebuild memory-recall chunks for this chat from the current message log.
  app.post<{ Params: { id: string } }>("/:id/memories/refresh", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    resetMemoryRecallVectorizerCache();

    const characterIds: string[] = Array.isArray(chat.characterIds)
      ? chat.characterIds
      : typeof chat.characterIds === "string"
        ? JSON.parse(chat.characterIds)
        : [];
    const charactersStore = createCharactersStorage(app.db);
    const characterNames: Record<string, string> = {};
    for (const characterId of characterIds) {
      const row = await charactersStore.getById(characterId);
      if (!row) continue;
      try {
        const data = JSON.parse(row.data as string) as { name?: unknown };
        characterNames[characterId] = typeof data.name === "string" && data.name.trim() ? data.name : "Character";
      } catch {
        characterNames[characterId] = "Character";
      }
    }

    const personas = await charactersStore.listPersonas();
    const persona =
      (chat.personaId ? personas.find((candidate) => candidate.id === chat.personaId) : null) ??
      personas.find((candidate) => candidate.isActive === "true");
    const userName = persona?.name ?? "User";

    const embeddingSource = await resolveMemoryRecallEmbeddingSource(app.db, {
      chatMetadata: chat.metadata,
      connectionId: chat.connectionId,
    });
    const rebuilt = await rebuildMemoryChunks(app.db, req.params.id, { userName, characterNames }, { embeddingSource });
    return { rebuilt };
  });

  // Clear all memory-recall chunks for this chat.
  app.delete<{ Params: { id: string } }>("/:id/memories", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    await app.db.delete(memoryChunks).where(eq(memoryChunks.chatId, req.params.id));
    return reply.status(204).send();
  });

  // Delete one memory-recall chunk from this chat.
  app.delete<{ Params: { id: string; memoryId: string } }>("/:id/memories/:memoryId", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    await app.db
      .delete(memoryChunks)
      .where(and(eq(memoryChunks.chatId, req.params.id), eq(memoryChunks.id, req.params.memoryId)));
    return reply.status(204).send();
  });

  // Create message
  app.post<{ Params: { id: string } }>("/:id/messages", async (req) => {
    const input = createMessageSchema.parse({ ...(req.body as Record<string, unknown>), chatId: req.params.id });
    const body = req.body as Record<string, unknown>;
    const created = await storage.createMessage(
      input,
      normalizeTimestampOverrides({
        createdAt: body.createdAt,
        updatedAt: body.updatedAt,
      }),
    );
    if (created?.id && input.role === "user") {
      const chat = await storage.getById(req.params.id);
      const personaSnapshot = await buildPersonaSnapshotForChat(app, chat);
      if (personaSnapshot) {
        return (await storage.updateMessageExtra(created.id, { personaSnapshot })) ?? created;
      }
    }
    return created;
  });

  // Delete message
  app.delete<{ Params: { chatId: string; messageId: string } }>("/:chatId/messages/:messageId", async (req, reply) => {
    await storage.removeMessage(req.params.messageId);
    return reply.status(204).send();
  });

  // Bulk delete messages
  app.post<{ Params: { chatId: string } }>("/:chatId/messages/bulk-delete", async (req, reply) => {
    const { messageIds } = req.body as { messageIds: string[] };
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return reply.status(400).send({ error: "messageIds array is required" });
    }
    await storage.removeMessages(messageIds, req.params.chatId);
    return reply.status(204).send();
  });

  // Edit message content
  app.patch<{ Params: { chatId: string; messageId: string } }>("/:chatId/messages/:messageId", async (req, reply) => {
    const { content } = req.body as { content: string };
    if (typeof content !== "string") return reply.status(400).send({ error: "content is required" });
    const updated = await storage.updateMessageContent(req.params.messageId, content);
    if (!updated) return reply.status(404).send({ error: "Message not found" });
    return updated;
  });

  // Update message extra (partial merge) — also syncs to the active swipe
  app.patch<{ Params: { chatId: string; messageId: string } }>(
    "/:chatId/messages/:messageId/extra",
    async (req, reply) => {
      const partial = req.body as Record<string, unknown>;
      const updated = await storage.updateMessageExtra(req.params.messageId, partial);
      if (!updated) return reply.status(404).send({ error: "Message not found" });
      // A lone user reaction (no text after it) is a valid turn: feed it to the
      // autonomous-messaging cadence so a character may notice and respond,
      // time-gated. Only when this update leaves the user with a reaction here
      // (so removing one's last reaction doesn't count as fresh activity).
      if (Object.prototype.hasOwnProperty.call(partial, "reactions")) {
        const next = partial.reactions;
        const userReacted =
          Array.isArray(next) &&
          next.some(
            (r) =>
              !!r &&
              typeof r === "object" &&
              Array.isArray((r as { by?: unknown }).by) &&
              (r as { by: unknown[] }).by.includes("user"),
          );
        if (userReacted) recordUserReaction(req.params.chatId);
      }
      const syncAllSwipeExtra: Record<string, unknown> = {};
      if (Object.prototype.hasOwnProperty.call(partial, "hiddenFromAI")) {
        syncAllSwipeExtra.hiddenFromAI = partial.hiddenFromAI;
      }
      if (Object.prototype.hasOwnProperty.call(partial, "reactions")) {
        syncAllSwipeExtra.reactions = partial.reactions;
      }

      if (Object.keys(syncAllSwipeExtra).length > 0) {
        // hiddenFromAI and reactions are message-level fields, so keep them
        // stable across swipe changes instead of binding them to one swipe.
        const swipes = await storage.getSwipes(req.params.messageId);
        for (const swipe of swipes) {
          await storage.updateSwipeExtra(req.params.messageId, swipe.index, syncAllSwipeExtra);
        }
      }

      // Keep swipe extra in sync so per-swipe data (like spriteExpressions) persists.
      await storage.updateSwipeExtra(req.params.messageId, updated.activeSwipeIndex, partial);
      return updated;
    },
  );

  // Bulk-set hiddenFromAI on many messages (iterates per message through the storage layer)
  app.patch<{ Params: { chatId: string }; Body: { messageIds: string[]; hidden: boolean } }>(
    "/:chatId/messages/bulk-hidden",
    async (req, reply) => {
      const { messageIds, hidden } = req.body;
      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return reply.status(400).send({ error: "messageIds must be a non-empty array" });
      }
      if (typeof hidden !== "boolean") {
        return reply.status(400).send({ error: "hidden must be a boolean" });
      }
      const updated = (await storage.bulkSetHiddenFromAI(req.params.chatId, messageIds, hidden)).length;
      return { updated };
    },
  );

  // Get latest game state for a chat (respects the active swipe of the last assistant message)
  app.get<{ Params: { id: string } }>("/:id/game-state", async (req, reply) => {
    const { createGameStateStorage } = await import("../services/storage/game-state.storage.js");
    const gameStateStore = createGameStateStorage(app.db);
    const msgs = await storage.listMessages(req.params.id);
    const visibleAnchor = resolveVisibleGameStateAnchor(msgs);
    const row = await gameStateStore.getForGeneration(req.params.id, {
      preferLatestVisible: true,
      visibleAnchor,
    });
    if (!row) return reply.send(null);
    const presentCharacters = JSON.parse((row.presentCharacters as string) ?? "[]") as Array<Record<string, unknown>>;
    const playerStats = row.playerStats ? JSON.parse(row.playerStats as string) : null;
    const personaStats = row.personaStats ? JSON.parse(row.personaStats as string) : null;
    const storedManualOverrides = row.manualOverrides
      ? (JSON.parse(row.manualOverrides as string) as Record<string, string>)
      : null;
    const fieldLocks = parseTrackerFieldLocks(row.fieldLocks);

    // ── Enrich present characters with avatar paths ──
    // Match NPC names against the chat's known character cards, then fall back to stored NPC avatars on disk.
    const charsNeedingAvatar = presentCharacters.filter(
      (c) => !c.avatarPath && c.name && !isManualTrackerCharacterId(c.characterId),
    );
    if (charsNeedingAvatar.length > 0) {
      const chat = await storage.getById(req.params.id);
      const chatCharIds: string[] = (() => {
        try {
          const parsed = JSON.parse((chat?.characterIds as string) ?? "[]");
          return Array.isArray(parsed) ? parsed.filter((id) => id !== PROFESSOR_MARI_ID) : [];
        } catch {
          return [];
        }
      })();
      // Build a name → avatarPath map from the chat's character records
      const nameToAvatar = new Map<string, string>();
      if (chatCharIds.length > 0) {
        const charRows = await app.db
          .select({ id: characters.id, data: characters.data, avatarPath: characters.avatarPath })
          .from(characters)
          .where(inArray(characters.id, chatCharIds));
        for (const cr of charRows) {
          try {
            const d = typeof cr.data === "string" ? JSON.parse(cr.data) : cr.data;
            if (d?.name && cr.avatarPath) {
              nameToAvatar.set(normalizeTextForMatch(d.name), cr.avatarPath as string);
            }
          } catch {
            /* skip */
          }
        }
      }
      const NPC_AVATAR_DIR = join(DATA_DIR, "avatars", "npc");
      for (const char of charsNeedingAvatar) {
        const name = char.name as string;
        // 1. Try matching a known character card by name
        const knownAvatar = nameToAvatar.get(normalizeTextForMatch(name));
        if (knownAvatar) {
          char.avatarPath = knownAvatar;
          continue;
        }
        // 2. Try loading a stored NPC avatar from disk
        const safeName = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        if (safeName) {
          const npcPath = join(NPC_AVATAR_DIR, req.params.id, `${safeName}.png`);
          if (existsSync(npcPath)) char.avatarPath = `/api/avatars/npc/${req.params.id}/${safeName}.png`;
        }
      }
    }

    return {
      id: row.id,
      chatId: row.chatId,
      messageId: row.messageId,
      swipeIndex: row.swipeIndex,
      date: row.date,
      time: row.time,
      location: row.location,
      weather: row.weather,
      temperature: row.temperature,
      presentCharacters,
      recentEvents: JSON.parse((row.recentEvents as string) ?? "[]"),
      playerStats,
      personaStats,
      manualOverrides: storedManualOverrides,
      fieldLocks,
      createdAt: row.createdAt,
    };
  });

  // Update game state fields for a chat
  app.patch<{ Params: { id: string } }>("/:id/game-state", async (req, reply) => {
    const { createGameStateStorage } = await import("../services/storage/game-state.storage.js");
    const gameStateStore = createGameStateStorage(app.db);
    const body = req.body as Record<string, unknown>;
    const manual = body.manual === true;
    // Explicit flag to wipe all manual overrides (e.g. from the Clear button)
    const clearOverrides = body.clearOverrides === true;
    const targetMessageId = typeof body.messageId === "string" && body.messageId ? body.messageId : null;
    const targetSwipeIndex =
      typeof body.swipeIndex === "number" && Number.isInteger(body.swipeIndex) && body.swipeIndex >= 0
        ? body.swipeIndex
        : null;
    const hasExplicitTarget = targetMessageId !== null && targetSwipeIndex !== null;
    const fields: Partial<{
      date: string | null;
      time: string | null;
      location: string | null;
      weather: string | null;
      temperature: string | null;
      presentCharacters: any[];
      playerStats: any;
      personaStats: any[];
      fieldLocks: Record<string, boolean> | null;
    }> = {};
    if (body.date !== undefined) fields.date = coerceGameStateTextValue(body.date);
    if (body.time !== undefined) fields.time = coerceGameStateTextValue(body.time);
    if (body.location !== undefined) fields.location = coerceGameStateTextValue(body.location);
    if (body.weather !== undefined) fields.weather = coerceGameStateTextValue(body.weather);
    if (body.temperature !== undefined) fields.temperature = coerceGameStateTextValue(body.temperature);
    if (body.presentCharacters !== undefined) fields.presentCharacters = body.presentCharacters as any[];
    if (body.playerStats !== undefined) fields.playerStats = body.playerStats;
    if (body.personaStats !== undefined) fields.personaStats = body.personaStats as any[];
    if (body.fieldLocks !== undefined) fields.fieldLocks = normalizeTrackerFieldLocks(body.fieldLocks);
    // Target the same snapshot the GET endpoint returns — the one for the last
    // assistant message's active swipe — so edits persist to the row the user
    // actually sees. Falls back to updateLatest when no messages exist yet.
    let updated: Awaited<ReturnType<typeof gameStateStore.updateLatest>> = null;
    if (hasExplicitTarget) {
      const targetMessage = await storage.getMessage(targetMessageId);
      const targetSnapshot = await gameStateStore.getByMessage(targetMessageId, targetSwipeIndex);
      if (targetMessage?.chatId === req.params.id || targetSnapshot?.chatId === req.params.id) {
        updated = await gameStateStore.updateByMessage(
          targetMessageId,
          targetSwipeIndex,
          req.params.id,
          fields,
          manual,
        );
      }
    }
    if (!updated && !hasExplicitTarget) {
      const msgs = await storage.listMessages(req.params.id);
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i]!.role === "assistant") {
          const msg = msgs[i]!;
          updated = await gameStateStore.updateByMessage(msg.id, msg.activeSwipeIndex, req.params.id, fields, manual);
          break;
        }
      }
    }
    if (!updated && !hasExplicitTarget) {
      updated = await gameStateStore.updateLatest(req.params.id, fields, manual);
    }
    // Wipe all manual overrides when explicitly requested
    if (clearOverrides && updated) {
      const { eq } = await import("drizzle-orm");
      const { gameStateSnapshots } = await import("../db/schema/index.js");
      await app.db
        .update(gameStateSnapshots)
        .set({ manualOverrides: null })
        .where(eq(gameStateSnapshots.id, (updated as any).id));
      updated = { ...updated, manualOverrides: null };
    }
    // If no snapshot exists yet, create one so manual edits aren't lost
    if (!updated && manual && !hasExplicitTarget) {
      const manualOverrides: Record<string, string> = {};
      const TRACKABLE = ["date", "time", "location", "weather", "temperature"] as const;
      for (const key of TRACKABLE) {
        const text = coerceGameStateTextValue(fields[key]);
        if (text) manualOverrides[key] = text;
      }
      await gameStateStore.create(
        {
          chatId: req.params.id,
          messageId: "",
          swipeIndex: 0,
          date: (fields.date as string) ?? null,
          time: (fields.time as string) ?? null,
          location: (fields.location as string) ?? null,
          weather: (fields.weather as string) ?? null,
          temperature: (fields.temperature as string) ?? null,
          presentCharacters: (fields.presentCharacters as any[]) ?? [],
          recentEvents: [],
          playerStats: (fields.playerStats as any) ?? null,
          personaStats: (fields.personaStats as any) ?? null,
          fieldLocks: normalizeTrackerFieldLocks(fields.fieldLocks),
        },
        Object.keys(manualOverrides).length > 0 ? manualOverrides : null,
      );
      updated = await gameStateStore.getLatest(req.params.id);
    }
    if (!updated) return reply.status(404).send({ error: "No game state found" });
    return updated;
  });

  // Delete all game state for a chat
  app.delete<{ Params: { id: string } }>("/:id/game-state", async (req, reply) => {
    const { createGameStateStorage } = await import("../services/storage/game-state.storage.js");
    const gameStateStore = createGameStateStorage(app.db);
    await gameStateStore.deleteForChat(req.params.id);
    return reply.status(204).send();
  });

  // Peek prompt — assemble the prompt for this chat as if generating right now
  app.post<{ Params: { id: string } }>("/:id/peek-prompt", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const chatMessages = await storage.listMessages(req.params.id);
    const chatMeta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
    const chatMode = (chat.mode as string) ?? "roleplay";
    const chatSummaryFingerprint = fingerprintChatSummary(chatMeta.summary);
    const visibleGameStateAnchor = resolveVisibleGameStateAnchor(chatMessages);
    const supportsHiddenFromAI = chatMode === "conversation" || chatMode === "roleplay" || chatMode === "visual_novel";

    const readCachedPrompt = (
      extra: Record<string, unknown>,
    ): { messages: Array<{ role: string; content: string }>; generationInfo?: Record<string, unknown> } | null => {
      const cachedPrompt = Array.isArray(extra.cachedPrompt)
        ? extra.cachedPrompt
            .map((entry) => {
              if (!isRecord(entry) || typeof entry.role !== "string" || typeof entry.content !== "string") {
                return null;
              }
              return { role: entry.role, content: entry.content };
            })
            .filter((entry): entry is { role: string; content: string } => entry !== null)
        : [];
      if (cachedPrompt.length === 0) return null;

      // Newer prompt caches record the summary fingerprint used at generation time.
      // Older v1.6.1-era caches did not; those are still exact debug-log prompts,
      // so prefer them over the live best-effort fallback.
      if (
        Object.prototype.hasOwnProperty.call(extra, "chatSummaryFingerprint") &&
        !chatSummaryFingerprintMatches(extra, chatSummaryFingerprint)
      ) {
        return null;
      }

      return {
        messages: cachedPrompt,
        generationInfo: isRecord(extra.generationInfo) ? extra.generationInfo : undefined,
      };
    };

    // ── Primary: return the cached prompt from the last generation ──
    // This is an exact copy of what was actually sent to the model,
    // including all runtime injections (lorebooks, game state, scene context, etc.).
    const latestVisibleMessage = (() => {
      for (let i = chatMessages.length - 1; i >= 0; i--) {
        const message = chatMessages[i]!;
        if (supportsHiddenFromAI && isMessageHiddenFromAI(message)) continue;
        return message as any;
      }
      return null;
    })();

    if (latestVisibleMessage?.role === "assistant") {
      const extra = parseExtra(latestVisibleMessage.extra) as Record<string, unknown>;
      let cached = readCachedPrompt(extra);

      // If message-level extra doesn't have it (swipe overwrite), check swipes.
      if (!cached && latestVisibleMessage.id) {
        const swipes = await storage.getSwipes(latestVisibleMessage.id);
        const activeSwipe = swipes.find((s: any) => s.index === latestVisibleMessage.activeSwipeIndex);
        if (activeSwipe) {
          cached = readCachedPrompt(parseExtra(activeSwipe.extra) as Record<string, unknown>);
        }
        if (!cached) {
          for (const sw of swipes) {
            cached = readCachedPrompt(parseExtra(sw.extra) as Record<string, unknown>);
            if (cached) break;
          }
        }
      }

      if (cached) {
        return {
          messages: cached.messages,
          parameters: null,
          source: "cached",
          exact: true,
          generationInfo: cached.generationInfo ?? null,
          agentNote: "This is the cached text prompt saved after provider preparation for the active assistant swipe.",
        };
      }
    }

    // ── Fallback: live assembly preview (no generation has happened yet) ──
    // This is a best-effort approximation; it won't include runtime-only
    // injections like cached game state, scene context, semantic memory, etc.
    const presetId =
      typeof chat.promptPresetId === "string" && chat.promptPresetId
        ? chat.promptPresetId
        : typeof chatMeta.presetId === "string" && chatMeta.presetId
          ? chatMeta.presetId
          : null;
    if (presetId) {
      try {
        const { createPromptsStorage } = await import("../services/storage/prompts.storage.js");
        const { createCharactersStorage } = await import("../services/storage/characters.storage.js");
        const { assemblePrompt, buildPromptMacroContext, resolvePromptIdleDuration } =
          await import("../services/prompt/index.js");
        const presetStore = createPromptsStorage(app.db);
        const charStore = createCharactersStorage(app.db);

        const preset = await presetStore.getById(presetId);
        const chatMode = (chat.mode as string) ?? "roleplay";
        if (preset || chatMode === "conversation" || chatMode === "game") {
          // Apply conversation-start filter
          let scopedMessages = chatMessages;
          for (let i = chatMessages.length - 1; i >= 0; i--) {
            const extra =
              typeof chatMessages[i]!.extra === "string"
                ? JSON.parse(chatMessages[i]!.extra as string)
                : (chatMessages[i]!.extra ?? {});
            if (extra.isConversationStart) {
              scopedMessages = chatMessages.slice(i);
              break;
            }
          }
          let filteredMessages = supportsHiddenFromAI
            ? scopedMessages.filter((message: any) => !isMessageHiddenFromAI(message))
            : scopedMessages;
          const promptIdleDuration = resolvePromptIdleDuration(filteredMessages);

          // Apply context message limit
          const contextLimit = chatMeta.contextMessageLimit as number | null;
          if (contextLimit && contextLimit > 0 && filteredMessages.length > contextLimit) {
            filteredMessages = filteredMessages.slice(-contextLimit);
          }

          const mappedMessages = filteredMessages.map((m: any) => ({
            role: m.role === "narrator" ? "system" : m.role,
            content: m.content as string,
          }));

          // Strip trailing assistant messages — peek should show only what we SEND to the model
          while (mappedMessages.length > 0 && mappedMessages[mappedMessages.length - 1]!.role === "assistant") {
            mappedMessages.pop();
          }

          const [sections, groups, choiceBlocks] = preset
            ? await Promise.all([
                presetStore.listSections(presetId),
                presetStore.listGroups(presetId),
                presetStore.listChoiceBlocksForPreset(presetId),
              ])
            : [[], [], []];

          const allCharacterIds = resolveChatCharacterIds(chat.characterIds);
          const characterIds = resolveActiveCharacterIds(allCharacterIds, chatMeta, {
            mode: (chat.mode as string) ?? "roleplay",
            allowEmpty: true,
          });

          let personaName = "User";
          let personaId: string | null = null;
          let personaDescription = "";
          let personaFields: Record<string, string> = {};
          const allPersonas = await charStore.listPersonas();
          const persona =
            (chat.personaId ? allPersonas.find((p: any) => p.id === chat.personaId) : null) ??
            allPersonas.find((p: any) => p.isActive === "true");
          if (persona) {
            personaId = persona.id as string;
            personaName = persona.name;
            personaDescription = cardPromptText(persona.description);

            personaFields = {
              personality: cardPromptText(persona.personality),
              scenario: cardPromptText(persona.scenario),
              backstory: cardPromptText(persona.backstory),
              appearance: cardPromptText(persona.appearance),
            };
          }

          const personaStats = (() => {
            if (!persona?.personaStats) return undefined;
            if (typeof persona.personaStats !== "string") return persona.personaStats;
            try {
              return JSON.parse(persona.personaStats as string);
            } catch {
              return undefined;
            }
          })();

          const chatChoices = (chatMeta.presetChoices ?? {}) as Record<string, string | string[]>;
          const promptMacroContext = await buildPromptMacroContext({
            db: app.db,
            characterIds,
            personaName,
            personaDescription,
            personaFields,
            variables:
              chatMode === "conversation" || chatMode === "game"
                ? resolvePromptChoiceVariables(choiceBlocks as PromptChoiceBlockRow[], chatChoices)
                : {},
            groupScenarioOverrideText:
              typeof chatMeta.groupScenarioText === "string" && (chatMeta.groupScenarioText as string).trim()
                ? (chatMeta.groupScenarioText as string).trim()
                : null,
            lastInput: [...mappedMessages].reverse().find((message) => message.role === "user")?.content,
            chatId: req.params.id,
            lastGenerationType: "preview",
            idleDuration: promptIdleDuration,
          });
          const resolvePromptMacros = (value: string) => resolveMacros(value, promptMacroContext);
          // Apply regex scripts to prompt context (mirrors generate.routes.ts).
          const regexStore = createRegexScriptsStorage(app.db);
          applyRegexScriptsToPromptMessages(mappedMessages, await regexStore.list(), {
            resolveMacros: (value) => resolveMacros(value, promptMacroContext, { trimResult: false }),
          });
          promptMacroContext.lastInput = [...mappedMessages]
            .reverse()
            .find((message) => message.role === "user")?.content;
          if (chatMode === "conversation") {
            const customPrompt =
              typeof chatMeta.customSystemPrompt === "string" && chatMeta.customSystemPrompt.trim()
                ? (chatMeta.customSystemPrompt as string).trim()
                : null;
            const selectedConversationPrompt = presetStringField(
              preset as Record<string, unknown> | null,
              "conversationPrompt",
            );
            const conversationPromptTemplate =
              customPrompt ?? (selectedConversationPrompt || DEFAULT_CONVERSATION_PROMPT);
            const charNameList = promptMacroContext.characters.join(", ") || "Character";
            const renderedConversationPrompt = resolveMacros(
              conversationPromptTemplate
                .replace(/\{\{charName\}\}/g, charNameList)
                .replace(/\{\{userName\}\}/g, personaName),
              promptMacroContext,
            );
            const messages = [
              {
                role: "system" as const,
                content: wrapConversationInstructions(unwrapConversationInstructions(renderedConversationPrompt)),
              },
              ...mappedMessages,
            ];
            return {
              messages: toPeekPromptMessages(messages),
              parameters: null,
              source: "live_preview",
              exact: false,
              generationInfo: null,
              agentNote:
                "No saved model request was available, so this is a live best-effort preview assembled without sending.",
            };
          }
          if (chatMode === "game") {
            const customPrompt =
              typeof chatMeta.gameSystemPrompt === "string" && chatMeta.gameSystemPrompt.trim()
                ? (chatMeta.gameSystemPrompt as string).trim()
                : null;
            const selectedGamePrompt = presetStringField(preset as Record<string, unknown> | null, "gamePrompt");
            const gamePromptTemplate = customPrompt ?? (selectedGamePrompt || DEFAULT_GAME_SYSTEM_PROMPT);
            const renderedGamePrompt = resolveMacros(gamePromptTemplate, promptMacroContext);
            const messages = [
              {
                role: "system" as const,
                content: renderedGamePrompt,
              },
              ...mappedMessages,
            ];
            return {
              messages: toPeekPromptMessages(messages),
              parameters: null,
              source: "live_preview",
              exact: false,
              generationInfo: null,
              agentNote:
                "No saved model request was available, so this is a live best-effort preview assembled without sending.",
            };
          }
          const entryStateOverrides = resolveEntryStateOverrides(chatMeta.entryStateOverrides);
          const lorebookScopeExclusions = resolveGameLorebookScopeExclusions(chatMode, chatMeta);
          const promptActiveAgentIds = Array.isArray(chatMeta.activeAgentIds)
            ? (chatMeta.activeAgentIds as string[])
            : [];
          const activePromptAgentIds = filterGameInternalAgentIds(chatMode, promptActiveAgentIds);
          const activeChatSummary = resolveRoleplayChatSummary(chatMode, chatMeta);

          const assembled = await assemblePrompt({
            db: app.db,
            preset: preset as any,
            sections: sections as any,
            groups: groups as any,
            choiceBlocks: choiceBlocks as any,
            chatChoices,
            chatId: req.params.id,
            characterIds,
            personaId,
            personaName,
            personaDescription,
            personaFields,
            personaStats,
            chatMessages: mappedMessages,
            chatSummary: activeChatSummary,
            enableAgents: chatMeta.enableAgents === true,
            activeAgentIds: activePromptAgentIds,
            activeLorebookIds: Array.isArray(chatMeta.activeLorebookIds)
              ? (chatMeta.activeLorebookIds as string[])
              : [],
            excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
            excludedLorebookSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
            entryStateOverrides:
              (chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) &&
              typeof (chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) === "object"
                ? ((chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) as Record<
                    string,
                    { ephemeral?: number | null; enabled?: boolean }
                  >)
                : undefined,
            entryTimingStates:
              (chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) &&
              typeof (chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) === "object"
                ? ((chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) as Record<
                    string,
                    LorebookEntryTimingState
                  >)
                : undefined,
            generationTriggers:
              (chatMeta.generationTriggers ?? chatMeta.lorebookGenerationTriggers) &&
              Array.isArray(chatMeta.generationTriggers ?? chatMeta.lorebookGenerationTriggers)
                ? ((chatMeta.generationTriggers ?? chatMeta.lorebookGenerationTriggers) as string[])
                : undefined,
            lorebookTokenBudget:
              typeof (chatMeta.lorebookTokenBudget ?? chatMeta.generationLorebookTokenBudget) === "number"
                ? ((chatMeta.lorebookTokenBudget ?? chatMeta.generationLorebookTokenBudget) as number)
                : undefined,
            previewOnly: true,
            groupScenarioOverrideText:
              typeof chatMeta.groupScenarioText === "string" && (chatMeta.groupScenarioText as string).trim()
                ? (chatMeta.groupScenarioText as string).trim()
                : null,
            lastGenerationType: "preview",
            idleDuration: promptIdleDuration,
          });

          // ── Strip <speaker> tags from chat history to save tokens (roleplay only) ──
          const isGroupChat = characterIds.length > 1;
          if (isGroupChat && chatMode !== "conversation") {
            const speakerCloseRegex = /<\/speaker>/g;
            for (let i = 0; i < assembled.messages.length; i++) {
              const msg = assembled.messages[i]!;
              if (msg.role === "system") continue;
              if (msg.content.includes("<speaker=")) {
                let converted = msg.content;
                converted = converted.replace(/<speaker="[^"]*">/g, "");
                converted = converted.replace(speakerCloseRegex, "");
                converted = converted.replace(/^\s*\n/gm, "").trim();
                assembled.messages[i] = { ...msg, content: converted };
              }
            }
          }

          // ── Inject group chat speaker tag instructions ──
          const groupChatMode =
            chatMode === "conversation" ? "merged" : ((chatMeta.groupChatMode as string) ?? "merged");
          const groupSpeakerColors =
            chatMeta.groupSpeakerColors === true || (chatMode === "conversation" && isGroupChat);

          if (isGroupChat && groupChatMode === "merged" && groupSpeakerColors && chatMode !== "conversation") {
            // Fetch character names for the example
            const charNames: string[] = [];
            for (const cid of characterIds) {
              const charRow = await charStore.getById(cid);
              if (charRow) {
                const charData = JSON.parse(charRow.data as string);
                charNames.push(charData.name ?? "Unknown");
              }
            }
            const speakerInstruction = `- Since this is a group chat, wrap each character's dialogue in <speaker="name"> tags. Tags can appear inline with narration, they don't need to be on separate lines. Example: <speaker="${charNames[0] ?? "John"}">"Hello there,"</speaker> [action beat/dialogue tag].`;
            const wrapFmt = (preset as any).wrapFormat || "xml";
            const instructionBlock =
              wrapFmt === "markdown" ? `\n## Group Chat\n${speakerInstruction}` : speakerInstruction;

            // Inject into </output_format> if present, otherwise append to last user message
            let speakerInjected = false;
            for (let i = 0; i < assembled.messages.length; i++) {
              const msg = assembled.messages[i]!;
              if (msg.content.includes("</output_format>")) {
                assembled.messages[i] = {
                  ...msg,
                  content: msg.content.replace("</output_format>", "    " + instructionBlock + "\n</output_format>"),
                };
                speakerInjected = true;
                break;
              }
            }
            if (!speakerInjected) {
              let lastUserIdx = -1;
              for (let i = assembled.messages.length - 1; i >= 0; i--) {
                if (assembled.messages[i]!.role === "user") {
                  lastUserIdx = i;
                  break;
                }
              }
              const idx = lastUserIdx >= 0 ? lastUserIdx : assembled.messages.length - 1;
              const target = assembled.messages[idx]!;
              assembled.messages[idx] = { ...target, content: target.content + "\n\n" + instructionBlock };
            }
          }

          // ── Static injection: Immersive HTML is a prompt directive, not a runtime LLM agent ──
          const peekAgentIds = Array.isArray(chatMeta.activeAgentIds) ? (chatMeta.activeAgentIds as string[]) : [];
          const previewAgentsStore = createAgentsStorage(app.db);
          await applyImmersiveHtmlPromptInjection({
            chatMode,
            enableAgents: chatMeta.enableAgents === true,
            activeAgentIds: peekAgentIds,
            wrapFormat: (preset as any).wrapFormat || "xml",
            messages: assembled.messages,
            getHtmlAgentConfig: () => previewAgentsStore.getByType("html"),
          });

          // ── Fallback: inject character & persona info if the preset didn't include them ──
          const wrapFormat = ((preset as any).wrapFormat as "xml" | "markdown" | "none") || "xml";
          const allContent = assembled.messages.map((m) => m.content).join("\n");

          // Character info fallback
          for (const cid of characterIds) {
            const charRow = await charStore.getById(cid);
            if (!charRow) continue;
            const charData = JSON.parse(charRow.data as string);
            const charName = charData.name ?? "Unknown";
            const charDesc = cardPromptText(charData.description);
            const xmlTag = nameToXmlTag(charName);
            const hasCharInfo =
              (charDesc && allContent.includes(charDesc.split("\n")[0]!.trim().slice(0, 80))) ||
              allContent.includes(`<${xmlTag}>`) ||
              allContent.includes(`<${charName}>`) ||
              new RegExp(`^#{1,6} ${charName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m").test(allContent);
            if (!hasCharInfo && charDesc) {
              const hasGroupOverride =
                typeof chatMeta.groupScenarioText === "string" && (chatMeta.groupScenarioText as string).trim();
              const characterMacroContext = {
                ...promptMacroContext,
                char: charName,
                characterFields: {
                  description: charDesc,
                  personality: cardPromptText(charData.personality),
                  scenario: cardPromptText(charData.scenario),
                  backstory: cardPromptText(charData.extensions?.backstory),
                  appearance: cardPromptText(charData.extensions?.appearance),
                  example: cardPromptText(charData.mes_example),
                  systemPrompt: cardPromptText(charData.system_prompt),
                },
              };
              const resolveCharacterMacros = (value: string) => resolveMacros(value, characterMacroContext);
              const parts: string[] = [];
              if (charDesc) parts.push(wrapContent(resolveCharacterMacros(charDesc), "description", wrapFormat, 2));
              if (characterMacroContext.characterFields.personality)
                parts.push(
                  wrapContent(
                    resolveCharacterMacros(characterMacroContext.characterFields.personality),
                    "personality",
                    wrapFormat,
                    2,
                  ),
                );
              if (characterMacroContext.characterFields.scenario && !hasGroupOverride)
                parts.push(
                  wrapContent(
                    resolveCharacterMacros(characterMacroContext.characterFields.scenario),
                    "scenario",
                    wrapFormat,
                    2,
                  ),
                );
              if (characterMacroContext.characterFields.backstory)
                parts.push(
                  wrapContent(
                    resolveCharacterMacros(characterMacroContext.characterFields.backstory),
                    "backstory",
                    wrapFormat,
                    2,
                  ),
                );
              if (characterMacroContext.characterFields.appearance)
                parts.push(
                  wrapContent(
                    resolveCharacterMacros(characterMacroContext.characterFields.appearance),
                    "appearance",
                    wrapFormat,
                    2,
                  ),
                );
              if (characterMacroContext.characterFields.systemPrompt)
                parts.push(
                  wrapContent(
                    resolveCharacterMacros(characterMacroContext.characterFields.systemPrompt),
                    "system_prompt",
                    wrapFormat,
                    2,
                  ),
                );
              if (characterMacroContext.characterFields.example)
                parts.push(
                  wrapContent(
                    resolveCharacterMacros(characterMacroContext.characterFields.example),
                    "example_dialogue",
                    wrapFormat,
                    2,
                  ),
                );
              if (parts.length > 0) {
                const block = wrapContent(parts.join("\n"), charName, wrapFormat, 1);
                const firstSysIdx = assembled.messages.findIndex((m) => m.role === "system");
                const insertAt = firstSysIdx >= 0 ? firstSysIdx + 1 : 0;
                assembled.messages.splice(insertAt, 0, { role: "system", content: block });
              }
            }
          }

          // Persona info fallback
          if (personaDescription) {
            const personaXmlTag = nameToXmlTag(personaName);
            const hasPersonaInfo =
              allContent.includes(personaDescription.split("\n")[0]!.trim().slice(0, 80)) ||
              allContent.includes(`<${personaXmlTag}>`) ||
              allContent.includes(`<${personaName}>`) ||
              new RegExp(`^#{1,6} ${personaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m").test(allContent);
            if (!hasPersonaInfo) {
              const fieldParts: string[] = [];
              if (personaDescription)
                fieldParts.push(wrapContent(resolvePromptMacros(personaDescription), "description", wrapFormat, 2));
              if (personaFields.personality)
                fieldParts.push(
                  wrapContent(resolvePromptMacros(personaFields.personality), "personality", wrapFormat, 2),
                );
              if (personaFields.backstory)
                fieldParts.push(wrapContent(resolvePromptMacros(personaFields.backstory), "backstory", wrapFormat, 2));
              if (personaFields.appearance)
                fieldParts.push(
                  wrapContent(resolvePromptMacros(personaFields.appearance), "appearance", wrapFormat, 2),
                );
              if (personaFields.scenario)
                fieldParts.push(wrapContent(resolvePromptMacros(personaFields.scenario), "scenario", wrapFormat, 2));
              // Include enabled RPG attributes
              if (personaStats?.rpgStats?.enabled) {
                const rpg = personaStats.rpgStats as {
                  attributes: Array<{ name: string; value: number }>;
                  hp: { value: number; max: number };
                };
                const rpgLines = [`Max HP: ${rpg.hp.max}`];
                for (const attr of rpg.attributes) {
                  rpgLines.push(`${attr.name}: ${attr.value}`);
                }
                fieldParts.push(wrapContent(rpgLines.join("\n"), "rpg_attributes", wrapFormat, 2));
              }
              if (fieldParts.length > 0) {
                const block = wrapContent(fieldParts.join("\n"), personaName, wrapFormat, 1);
                const firstUserIdx = assembled.messages.findIndex((m) => m.role === "user" || m.role === "assistant");
                const insertAt = firstUserIdx >= 0 ? firstUserIdx : assembled.messages.length;
                assembled.messages.splice(insertAt, 0, { role: "system", content: block });
              }
            }
          }

          // ── Tracker context fallback: mirror the read-only snapshot injection from /api/generate ──
          const activeAgentIds = Array.isArray(chatMeta.activeAgentIds) ? (chatMeta.activeAgentIds as string[]) : [];
          const chatEnableAgents = shouldEnableAgentsForGeneration({
            chatEnableAgents: chatMeta.enableAgents === true,
            chatMode,
            impersonate: false,
            impersonateBlockAgents: false,
          });
          if (chatEnableAgents && activeAgentIds.length > 0) {
            const snap = await loadLatestChatGameSnapshot(app, req.params.id, visibleGameStateAnchor);
            const contextBlock = snap
              ? formatPeekTrackerContextBlock({ wrapFormat, snap, chatMeta, chatEnableAgents, activeAgentIds })
              : null;

            if (contextBlock) {
              assembled.messages.splice(findTrackerContextInsertIndex(assembled.messages), 0, {
                role: "user",
                content: contextBlock,
                contextKind: "injection",
              });
            }
          }

          return {
            messages: toPeekPromptMessages(assembled.messages),
            parameters: assembled.parameters,
            source: "live_preview",
            exact: false,
            generationInfo: null,
            agentNote:
              "No saved model request was available, so this is a live best-effort preview assembled without sending.",
          };
        }
      } catch (e) {
        logger.error(e, "[peek-prompt] Assembler failed, falling through to cached/raw messages");
      }
    }

    // ── Last resort: return raw chat messages ──
    const mappedMessages = chatMessages.map((m: any) => ({
      role: m.role === "narrator" ? "system" : m.role,
      content: m.content as string,
    }));
    while (mappedMessages.length > 0 && mappedMessages[mappedMessages.length - 1]!.role === "assistant") {
      mappedMessages.pop();
    }

    return {
      messages: mappedMessages,
      parameters: null,
      source: "raw_messages",
      exact: false,
      generationInfo: null,
      agentNote: "Prompt assembly was unavailable, so only visible raw chat messages are shown.",
    };
  });

  // ── Swipes ──

  // List swipes for a message
  app.get<{ Params: { chatId: string; messageId: string } }>("/:chatId/messages/:messageId/swipes", async (req) => {
    return storage.getSwipes(req.params.messageId);
  });

  // Add a swipe
  app.post<{ Params: { chatId: string; messageId: string } }>("/:chatId/messages/:messageId/swipes", async (req) => {
    const { content, silent } = req.body as { content: string; silent?: boolean };
    return storage.addSwipe(req.params.messageId, content, silent);
  });

  // Delete a swipe without deleting the parent message
  app.delete<{ Params: { chatId: string; messageId: string; index: string } }>(
    "/:chatId/messages/:messageId/swipes/:index",
    async (req, reply) => {
      const index = Number.parseInt(req.params.index, 10);
      if (!Number.isInteger(index) || index < 0) {
        return reply.status(400).send({ error: "Valid swipe index is required" });
      }

      const swipes = await storage.getSwipes(req.params.messageId);
      if (swipes.length <= 1) {
        return reply.status(400).send({ error: "Cannot delete the last remaining swipe" });
      }

      const target = swipes.find((swipe: any) => swipe.index === index);
      if (!target) {
        return reply.status(404).send({ error: "Swipe not found" });
      }

      const updated = await storage.removeSwipe(req.params.messageId, index);
      if (!updated) {
        return reply.status(404).send({ error: "Message not found" });
      }

      return updated;
    },
  );

  // Set active swipe
  app.put<{ Params: { chatId: string; messageId: string } }>(
    "/:chatId/messages/:messageId/active-swipe",
    async (req) => {
      const { index } = req.body as { index: number };
      return storage.setActiveSwipe(req.params.messageId, index);
    },
  );

  // ── Export ──

  type ExportFormat = "jsonl" | "text";
  type ChatRow = NonNullable<Awaited<ReturnType<typeof storage.getById>>>;

  const normalizeExportFormat = (value: unknown): ExportFormat =>
    typeof value === "string" && value.toLowerCase() === "text" ? "text" : "jsonl";

  const parseExportCharacterIds = (raw: unknown): string[] => {
    if (Array.isArray(raw)) return raw.filter((id): id is string => typeof id === "string");
    if (typeof raw !== "string") return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  };

  const parseExportMetadata = (raw: unknown): Record<string, unknown> => {
    if (!raw) return {};
    if (typeof raw === "object") return raw as Record<string, unknown>;
    if (typeof raw !== "string") return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };

  const safeExportNamePart = (value: unknown, fallback: string): string => {
    const source = typeof value === "string" && value.trim() ? value.trim() : fallback;
    return (
      source
        .normalize("NFKD")
        .replace(/[^\w .-]+/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || fallback
    );
  };

  const serializeChatTranscript = async (chat: ChatRow, format: ExportFormat) => {
    const msgs = await storage.listMessages(chat.id);
    const charIds = parseExportCharacterIds(chat.characterIds);
    const metadata = parseExportMetadata(chat.metadata);
    const branchName = typeof metadata.branchName === "string" ? metadata.branchName : "";

    // Build a characterId → name map for all characters in this chat
    const charNameMap = new Map<string, string>();
    if (charIds.length > 0) {
      try {
        const rows = await app.db.select().from(characters).where(inArray(characters.id, charIds));
        for (const row of rows) {
          const data = JSON.parse(row.data);
          if (data?.name) charNameMap.set(row.id, data.name);
        }
      } catch {
        // fall through — use chat name as fallback
      }
    }
    const primaryCharName = (charIds[0] && charNameMap.get(charIds[0])) ?? chat.name;

    const getDisplayName = (msg: { role: string; characterId?: string | null }) => {
      if (msg.role === "user") return "User";
      if (msg.role === "system") return "System";
      if (msg.role === "narrator") return "Narrator";
      if (msg.characterId && charNameMap.has(msg.characterId)) return charNameMap.get(msg.characterId)!;
      return primaryCharName;
    };

    if (format === "text") {
      const header = `Chat: ${chat.name}\nDate: ${chat.createdAt}\n${"─".repeat(50)}\n`;
      const body = msgs
        .map((msg) => {
          const name = getDisplayName(msg);
          const ts = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : "";
          return `[${name}]${ts ? ` (${ts})` : ""}\n${msg.content}`;
        })
        .join("\n\n");

      return {
        content: header + body,
        extension: "txt",
        contentType: "text/plain; charset=utf-8",
        messageCount: msgs.length,
        branchName,
      };
    }

    const lines: string[] = [
      JSON.stringify({
        user_name: "User",
        character_name: primaryCharName,
        create_date: chat.createdAt,
        chat_metadata: {
          ...metadata,
          branchName,
          marinara_metadata: metadata,
        },
      }),
    ];

    for (const msg of msgs) {
      const messageExtra = parseExportMetadata(msg.extra);
      const swipes = await storage.getSwipes(msg.id);
      const exportSwipes =
        swipes.length > 0
          ? swipes.map((swipe: { index: number; content: string; extra?: unknown; createdAt?: string }) => ({
              index: swipe.index,
              content: swipe.index === msg.activeSwipeIndex ? msg.content : swipe.content,
              extra: swipe.index === msg.activeSwipeIndex ? messageExtra : parseExportMetadata(swipe.extra),
              createdAt: swipe.createdAt,
            }))
          : [
              {
                index: 0,
                content: msg.content,
                extra: messageExtra,
                createdAt: msg.createdAt,
              },
            ];
      lines.push(
        JSON.stringify({
          name: getDisplayName(msg),
          is_user: msg.role === "user",
          is_system: msg.role === "system",
          role: msg.role,
          character_id: msg.characterId,
          mes: msg.content,
          swipes: exportSwipes.map((swipe) => swipe.content),
          swipe_id: msg.activeSwipeIndex,
          send_date: msg.createdAt,
          extra: {
            ...messageExtra,
            marinara_role: msg.role,
            marinara_character_id: msg.characterId,
            marinara_swipes: exportSwipes.map((swipe) => ({
              index: swipe.index,
              extra: swipe.extra,
              created_at: swipe.createdAt,
            })),
          },
        }),
      );
    }

    return {
      content: lines.join("\n"),
      extension: "jsonl",
      contentType: "application/jsonl",
      messageCount: msgs.length,
      branchName,
    };
  };

  const buildBulkExportFilename = (
    chat: ChatRow,
    index: number,
    total: number,
    branchName: string,
    extension: string,
  ) => {
    const padWidth = Math.max(2, String(total).length);
    const ordinal = String(index + 1).padStart(padWidth, "0");
    const name = safeExportNamePart(chat.name, "chat");
    const branch = branchName ? `__${safeExportNamePart(branchName, "branch")}` : "";
    const group = chat.groupId ? `__group-${String(chat.groupId).slice(0, 8)}` : "";
    return `${ordinal}__${name}${branch}${group}__${chat.id.slice(0, 8)}.${extension}`;
  };

  app.post<{
    Body: { chatIds?: string[]; format?: string; scope?: "selected" | "all" };
  }>("/export/bulk", async (req, reply) => {
    const format = normalizeExportFormat(req.body?.format);
    const scope = req.body?.scope === "all" ? "all" : "selected";
    const uniqueIds = [...new Set((req.body?.chatIds ?? []).filter((id): id is string => typeof id === "string"))];

    let chatsToExport: ChatRow[];
    if (scope === "all") {
      chatsToExport = ((await storage.list()) as ChatRow[]).filter((chat) => !shouldHideProfessorMariChat(chat));
    } else {
      if (uniqueIds.length === 0) return reply.status(400).send({ error: "No chats selected for export" });
      const rows = await Promise.all(uniqueIds.map((id) => storage.getById(id)));
      chatsToExport = rows.filter((chat): chat is ChatRow => chat !== null && !shouldHideProfessorMariChat(chat));
    }

    if (chatsToExport.length === 0) return reply.status(404).send({ error: "No chats found to export" });

    const zip = new AdmZip();
    const manifest: Array<Record<string, unknown>> = [];

    for (let index = 0; index < chatsToExport.length; index++) {
      const chat = chatsToExport[index]!;
      const serialized = await serializeChatTranscript(chat, format);
      const file = buildBulkExportFilename(
        chat,
        index,
        chatsToExport.length,
        serialized.branchName,
        serialized.extension,
      );
      zip.addFile(file, Buffer.from(serialized.content, "utf8"));
      manifest.push({
        file,
        id: chat.id,
        name: chat.name,
        mode: chat.mode,
        groupId: chat.groupId,
        folderId: chat.folderId,
        branchName: serialized.branchName || null,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messageCount: serialized.messageCount,
      });
    }

    zip.addFile(
      "manifest.json",
      Buffer.from(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            format,
            scope,
            count: chatsToExport.length,
            chats: manifest,
          },
          null,
          2,
        ),
        "utf8",
      ),
    );

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return reply
      .header("Content-Type", "application/zip")
      .header("Content-Disposition", `attachment; filename="chat-transcripts-${format}-${stamp}.zip"`)
      .send(zip.toBuffer());
  });

  // Export chat — supports JSONL (default, SillyTavern-compatible) and plain text
  app.get<{ Params: { id: string }; Querystring: { format?: string } }>("/:id/export", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const format = normalizeExportFormat(req.query.format);
    const serialized = await serializeChatTranscript(chat as ChatRow, format);

    return reply
      .header("Content-Type", serialized.contentType)
      .header("Content-Disposition", `attachment; filename="${encodeURIComponent(chat.name)}.${serialized.extension}"`)
      .send(serialized.content);
  });

  // ── Branch (duplicate) ──

  // Create a branch (copy) of an existing chat
  app.post<{ Params: { id: string } }>("/:id/branch", async (req, reply) => {
    const sourceChat = await storage.getById(req.params.id);
    if (!sourceChat) return reply.status(404).send({ error: "Chat not found" });

    const sourceMeta =
      typeof sourceChat.metadata === "string" ? JSON.parse(sourceChat.metadata) : (sourceChat.metadata ?? {});
    const isSceneChat = sourceMeta.sceneStatus === "active" || !!sourceMeta.sceneOriginChatId;
    if (isSceneChat) {
      return reply.status(400).send({ error: "Scene chats cannot be branched" });
    }

    const { upToMessageId } = (req.body ?? {}) as { upToMessageId?: string };

    // Ensure the source chat belongs to a group so branches are linked
    let groupId = sourceChat.groupId as string | null;
    if (!groupId) {
      groupId = newId();
      await storage.update(req.params.id, { groupId });
    }

    // Create a new chat as a branch. Keep the main thread/chat name stable and
    // store the per-branch display label in metadata instead.
    const newChat = await storage.create({
      name: sourceChat.name,
      mode: sourceChat.mode as "conversation" | "roleplay" | "visual_novel" | "game",
      characterIds: (() => {
        try {
          return JSON.parse(sourceChat.characterIds as string);
        } catch {
          return [];
        }
      })(),
      groupId,
      personaId: sourceChat.personaId,
      promptPresetId: sourceChat.promptPresetId,
      connectionId: sourceChat.connectionId,
    });

    if (!newChat) return reply.status(500).send({ error: "Failed to create branch" });

    // Copy metadata (preset, lorebooks, agents, persona settings, etc.) from source chat
    // but keep branch labels separate from the stable thread name.
    const settingsToKeep = { ...sourceMeta };
    for (const key of ["summary", "summaryEntries", "lastAutomaticSummaryMessageId", "daySummaries", "weekSummaries"]) {
      delete settingsToKeep[key];
    }
    await storage.updateMetadata(newChat.id, {
      ...settingsToKeep,
      branchName: "New Branch",
    });

    // Copy messages from source chat, using the active swipe's content.
    // Preserve each message's original createdAt timestamp so ordering and
    // display times remain identical to the source chat.
    const msgs = await storage.listMessages(req.params.id);
    const sourceToBranchedMessageId = new Map<string, string>();

    for (const msg of msgs) {
      // Resolve the content from the active swipe (may differ from msg.content
      // if the user swiped to an alternative response)
      let content = msg.content;
      if (msg.activeSwipeIndex > 0) {
        const swipes = await storage.getSwipes(msg.id);
        const activeSwipe = swipes.find((s: { index: number }) => s.index === msg.activeSwipeIndex);
        if (activeSwipe) content = activeSwipe.content;
      }

      const created = await storage.createMessage(
        {
          chatId: newChat.id,
          role: msg.role as "user" | "assistant" | "system" | "narrator",
          characterId: msg.characterId,
          content,
        },
        { createdAt: msg.createdAt as string },
      );

      if (created) {
        sourceToBranchedMessageId.set(msg.id, created.id);

        // Preserve per-message metadata (displayText, generationInfo, etc.)
        try {
          const extraObj = typeof msg.extra === "string" ? JSON.parse(msg.extra) : (msg.extra ?? {});
          if (extraObj && typeof extraObj === "object") {
            const branchSafeExtra = { ...(extraObj as Record<string, unknown>) };
            delete branchSafeExtra.cachedPrompt;
            delete branchSafeExtra.chatSummaryFingerprint;
            await storage.updateMessageExtra(created.id, branchSafeExtra);
          }
        } catch {
          // Ignore malformed extra payloads rather than failing the branch.
        }
      }

      // Stop if we hit the specified message
      if (upToMessageId && msg.id === upToMessageId) break;
    }

    // Fix updatedAt: createMessage sets the chat's updatedAt to each message's
    // (preserved) timestamp, so after the loop the branched chat's updatedAt is
    // the last source message's original time. Reset it to now so the branch
    // appears at the top of the chat list as a freshly created chat.
    // Also inherit the source chat's folder so the branch stays inside the
    // same categorization tree (the new branch becomes the most-recently-
    // updated row in its group, so the sidebar reads its folderId).
    await storage.update(newChat.id, { folderId: sourceChat.folderId ?? null });

    // Copy game-state snapshots from the source chat for every copied message.
    // Each snapshot is keyed by (chatId, messageId, swipeIndex), so we must re-associate
    // them to the new branch's message IDs. Copying all snapshots (not just the latest)
    // ensures that branching a branch at an earlier point finds the correct tracker state
    // for that specific message, not just the latest snapshot in the source chat.
    if (sourceToBranchedMessageId.size > 0) {
      const { createGameStateStorage } = await import("../services/storage/game-state.storage.js");
      const gameStateStore = createGameStateStorage(app.db);

      // Helper to create a snapshot re-keyed for the new branch.
      const copySnapshot = async (
        snapshot: NonNullable<Awaited<ReturnType<typeof gameStateStore.getByMessage>>>,
        targetMessageId: string,
        targetSwipeIndex: number,
      ) => {
        try {
          const overrides = parseSnapshotJson<Record<string, string> | null>(snapshot.manualOverrides, null);
          await gameStateStore.create(
            {
              chatId: newChat.id,
              messageId: targetMessageId,
              swipeIndex: targetSwipeIndex,
              date: (snapshot.date as string) ?? null,
              time: (snapshot.time as string) ?? null,
              location: (snapshot.location as string) ?? null,
              weather: (snapshot.weather as string) ?? null,
              temperature: (snapshot.temperature as string) ?? null,
              presentCharacters: parseSnapshotJson(snapshot.presentCharacters, []),
              recentEvents: parseSnapshotJson(snapshot.recentEvents, []),
              playerStats: parseSnapshotJson(snapshot.playerStats, null),
              personaStats: parseSnapshotJson(snapshot.personaStats, null),
              fieldLocks: parseTrackerFieldLocks(snapshot.fieldLocks),
              committed: (snapshot.committed as any) === 1,
            } as any,
            overrides,
          );
        } catch (err) {
          logger.warn(err, "Failed to copy game-state snapshot while branching chat");
          // Ignore individual snapshot copy failures; branching should still succeed.
        }
      };

      for (const [srcMsgId, branchedMsgId] of sourceToBranchedMessageId) {
        const srcMsg = msgs.find((m) => m.id === srcMsgId);
        if (!srcMsg) continue;

        const snapshot = await gameStateStore.getByMessage(srcMsgId, srcMsg.activeSwipeIndex);
        if (snapshot) {
          await copySnapshot(snapshot, branchedMsgId, 0);
        }
      }

      // Also copy the bootstrap snapshot (messageId: "") if one exists.
      // This is created when tracker state is set manually before any generation,
      // and is not tied to any specific message.
      const bootstrap = await gameStateStore.getByChatAndMessage(req.params.id, "", 0);
      if (bootstrap) {
        await copySnapshot(bootstrap, "", 0);
      }
    }

    // Return the fully-updated chat (including copied metadata)
    return storage.getById(newChat.id);
  });

  // ── Generate Summary ──
  // Calls the LLM to produce a rolling summary from the chat history,
  // saves it into chatMetadata.summary, and returns it.
  // Model resolution: default-for-agents → chat connection.
  app.post<{ Params: { id: string } }>("/:id/generate-summary", async (req, reply) => {
    const chat = await storage.getById(req.params.id);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const chatMeta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});

    // Accept context size from request body, fall back to chat meta, then default 50.
    // Manual UI generation may also pass inclusive message ID anchors.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const contextSize = Math.max(
      5,
      Math.min(500, Number(body.contextSize) || (chatMeta.summaryContextSize as number) || 50),
    );
    const requestedRangeStartMessageId = typeof body.rangeStartMessageId === "string" ? body.rangeStartMessageId : null;
    const requestedRangeEndMessageId = typeof body.rangeEndMessageId === "string" ? body.rangeEndMessageId : null;
    const requestedRangeStartIndex =
      typeof body.rangeStartIndex === "number" && Number.isInteger(body.rangeStartIndex) ? body.rangeStartIndex : null;
    const requestedRangeEndIndex =
      typeof body.rangeEndIndex === "number" && Number.isInteger(body.rangeEndIndex) ? body.rangeEndIndex : null;
    const hasRangeByMessageId = !!requestedRangeStartMessageId && !!requestedRangeEndMessageId;
    const hasRangeByIndex = requestedRangeStartIndex !== null && requestedRangeEndIndex !== null;
    const hasRange = hasRangeByMessageId || hasRangeByIndex;

    const connections = createConnectionsStorage(app.db);

    const resolvedSummaryConnection = await resolveChatSummaryConnection({
      chatConnectionId: chat.connectionId,
      chatMetadata: chatMeta,
      connections,
      resolveBaseUrl,
    });
    if (!resolvedSummaryConnection.ok) {
      if (resolvedSummaryConnection.warnings.length > 0) {
        logger.warn(
          { chatId: req.params.id, warnings: resolvedSummaryConnection.warnings },
          "[chat-summary] Could not resolve summary connection",
        );
      }
      return reply.status(400).send({ error: resolvedSummaryConnection.error });
    }
    if (resolvedSummaryConnection.warnings.length > 0) {
      logger.warn(
        {
          chatId: req.params.id,
          connectionId: resolvedSummaryConnection.connectionId,
          source: resolvedSummaryConnection.source,
          warnings: resolvedSummaryConnection.warnings,
        },
        "[chat-summary] Resolved summary connection after fallback",
      );
    }
    const { provider, model } = resolvedSummaryConnection;

    // Build conversation context (use contextSize from popover, or a custom range).
    // Hidden-from-AI messages are excluded from summary generation even when
    // they fall inside the selected range.
    const allMessages = await storage.listMessages(req.params.id);
    let selectedRangeStartIndex: number | undefined;
    let selectedRangeEndIndex: number | undefined;
    const selectedMessages = hasRange
      ? (() => {
          const startIndex = hasRangeByIndex
            ? requestedRangeStartIndex! - 1
            : allMessages.findIndex((message) => message.id === requestedRangeStartMessageId);
          const endIndex = hasRangeByIndex
            ? requestedRangeEndIndex! - 1
            : allMessages.findIndex((message) => message.id === requestedRangeEndMessageId);
          if (startIndex === -1 || endIndex === -1) {
            return { error: "Summary range messages were not found in this chat" as const };
          }
          if (startIndex < 0 || endIndex < 0 || startIndex >= allMessages.length || endIndex >= allMessages.length) {
            return { error: "Summary range is outside this chat's message history" as const };
          }
          const from = Math.min(startIndex, endIndex);
          const to = Math.max(startIndex, endIndex);
          const count = to - from + 1;
          if (count > 500) {
            return { error: "Summary ranges cannot include more than 500 messages" as const };
          }
          selectedRangeStartIndex = from + 1;
          selectedRangeEndIndex = to + 1;
          return allMessages.slice(from, to + 1).filter((message) => !isMessageHiddenFromAI(message));
        })()
      : allMessages.slice(-contextSize).filter((message) => !isMessageHiddenFromAI(message));
    if (selectedMessages && "error" in selectedMessages) {
      return reply.status(400).send({ error: selectedMessages.error });
    }
    if (selectedMessages.length === 0) {
      return reply.status(400).send({ error: "No non-hidden messages available for the requested summary range" });
    }
    const chatLog = selectedMessages
      .map((m: any) => `[${m.role}]: ${(m.content as string).slice(0, 2000)}`)
      .join("\n\n");

    const previousSummary = chatMeta.summary ?? null;
    const requestedPromptTemplateId =
      typeof body.promptTemplateId === "string" && body.promptTemplateId.trim()
        ? body.promptTemplateId.trim()
        : typeof chatMeta.activeSummaryPromptTemplateId === "string" && chatMeta.activeSummaryPromptTemplateId.trim()
          ? chatMeta.activeSummaryPromptTemplateId.trim()
          : null;
    const summaryPromptTemplates = Array.isArray(chatMeta.summaryPromptTemplates)
      ? (chatMeta.summaryPromptTemplates as Array<Record<string, unknown>>)
      : [];
    const selectedSummaryPrompt = requestedPromptTemplateId
      ? summaryPromptTemplates.find(
          (template) =>
            template.id === requestedPromptTemplateId &&
            typeof template.prompt === "string" &&
            template.prompt.trim().length > 0,
        )
      : null;
    const summaryPrompt =
      typeof selectedSummaryPrompt?.prompt === "string"
        ? selectedSummaryPrompt.prompt.trim()
        : DEFAULT_CHAT_SUMMARY_PROMPT;

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system", content: summaryPrompt },
      {
        role: "user",
        content:
          (previousSummary ? `Previous summary:\n${previousSummary}\n\n` : "") + `Recent conversation:\n${chatLog}`,
      },
    ];

    const result = await provider.chatComplete(messages, {
      model,
      temperature: 0.5,
      maxTokens: 2048,
    });

    if (!result.content) {
      return reply.status(500).send({ error: "No response from AI" });
    }

    // Parse JSON response
    let summaryText: string;
    try {
      const cleaned = result.content
        .trim()
        .replace(/```(?:json)?\s*/gi, "")
        .replace(/```/g, "");
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      const json = JSON.parse(cleaned.slice(first, last + 1));
      summaryText = json.summary ?? result.content;
    } catch {
      summaryText = result.content.trim();
    }

    const messageIds = selectedMessages.map((message) => message.id);
    // Subset eligible to be hidden when "Hide summarised messages" is on: the
    // summarized set minus the protected tail, so manual hiding honors
    // `summaryTailMessages` like the automatic path. Persisted on the entry (when
    // hiding is enabled) so deletion restores exactly what was hidden.
    const hideEnabled = chatMeta.hideSummarisedMessages === true;
    const eligibleToHide = hideEnabled
      ? computeSummaryHideIds({
          messages: allMessages,
          entryMessageIds: messageIds,
          tail: resolveRoleplaySummaryTail(chatMeta.summaryTailMessages),
        })
      : [];
    // Perform the hide on the server, BEFORE the entry records hiddenMessageIds, so
    // the recorded set always reflects messages actually hidden (no phantom set if a
    // separate client call were to fail). The client no longer hides. bulkSetHidden
    // returns exactly the ids it flipped visible->hidden, read at the moment of
    // mutation — so ownership can never be a stale pre-provider snapshot that claims
    // a message another action hid during the (seconds-long) provider call above.
    const hideMessageIds =
      eligibleToHide.length > 0 ? await storage.bulkSetHiddenFromAI(req.params.id, eligibleToHide, true) : [];
    // If the entry that owns hiddenMessageIds is not persisted (chat vanished, or
    // the write throws), roll back exactly the hides this attempt applied (the set
    // bulkSetHidden reported flipping) so we never leave messages hidden with no
    // entry. A rollback failure is surfaced (re-thrown), not swallowed, so the
    // caller learns recovery did not complete.
    const rollbackHide = async () => {
      if (hideMessageIds.length === 0) return;
      await storage.bulkSetHiddenFromAI(req.params.id, hideMessageIds, false);
    };

    // Append as a structured entry and recompile the prompt-facing summary
    // without replacing concurrent metadata changes.
    let combined: string | null = summaryText;
    let createdEntry: ChatSummaryEntry | null = null;
    let summaryEntries: ChatSummaryEntry[] = [];
    let updatedChat: Awaited<ReturnType<typeof storage.patchMetadata>>;
    try {
      updatedChat = await storage.patchMetadata(req.params.id, (freshMeta) => {
        const now = new Date().toISOString();
        const result = appendChatSummaryEntryToMetadata(
          freshMeta,
          {
            kind: "rolling",
            origin: "manual",
            sourceMode: hasRange ? "range" : "last",
            content: summaryText,
            enabled: true,
            messageCount: selectedMessages.length,
            rangeStartIndex: selectedRangeStartIndex,
            rangeEndIndex: selectedRangeEndIndex,
            messageIds,
            ...(hideMessageIds.length > 0 ? { hiddenMessageIds: hideMessageIds } : {}),
            promptTemplateId: requestedPromptTemplateId,
            createdAt: now,
            updatedAt: now,
          },
          { createId: newId, now },
        );
        combined = result.summary;
        createdEntry = result.entry;
        summaryEntries = result.entries;
        return {
          summary: result.summary,
          summaryEntries: result.entries,
          ...(!hasRange && typeof body.contextSize !== "undefined" ? { summaryContextSize: contextSize } : {}),
        };
      });
    } catch (err) {
      await rollbackHide();
      throw err;
    }
    if (!updatedChat) {
      await rollbackHide();
      return reply.status(404).send({ error: "Chat not found" });
    }

    return {
      summary: combined,
      entry: createdEntry,
      entries: summaryEntries,
      messageIds,
      hideMessageIds,
    };
  });
}
