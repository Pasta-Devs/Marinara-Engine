import { AsyncLocalStorage } from "node:async_hooks";
import {
  type CapabilityAdvancedMemorySummary,
  type CapabilityCharacterStatusResult,
  type CapabilityCharacterStatusUpdate,
  type CapabilityChatActivityUpdate,
  type CapabilityChatMetadataUpdate,
  type CapabilityChatRecord,
  type CapabilityChatSummaries,
  type CapabilityCreateMessageWithSwipeInput,
  type CapabilityGameStateRecord,
  type CapabilityRoleplayEventInput,
  type CapabilityRoleplayEventRecord,
  type CapabilityDocumentRecord,
  type CapabilityDocumentStore,
  type CapabilityMessageRecord,
  type CapabilityPersistenceHost,
  type CapabilityPersistenceSession,
  type CapabilitySpatialSnapshotStore,
  type SessionSummary,
  type SpatialContextSnapshot,
  type SpatialSnapshotSource,
  normalizeChatSummaryEntries,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { and, desc, eq, inArray, ne, or } from "../../db/file-query.js";
import { IMPORTED_GAME_ENGINE_ANCHOR_PREFIX } from "../../db/file-backed-store.js";
import { FileUniqueConstraintError } from "../../db/file-schema.js";
import { engineEventOwner } from "./capability-roleplay-events.service.js";
import { ensureTimestampAfter } from "../import/import-timestamps.js";
import {
  advancedMemoryRecords,
  chats,
  capabilityDocuments,
  gameStateSnapshots,
  lorebookEntries,
  messages,
  messageSwipes,
  spatialContextSnapshots,
} from "../../db/schema/index.js";
import { createChatsStorage, withChatMetadataPatchQueue } from "../storage/chats.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { withNewGlobalGalleryCapabilityReferences } from "../image/global-gallery-capability-references.js";
import { resolveChatUserIdentity } from "../chat-user-identity.js";
import { parseExtra } from "../generation/prompt-attachments.js";
import {
  parseRoleplayUserCommands,
  roleplayAgentsSeeWhispers,
  roleplayAgentText,
} from "../generation/roleplay-commands.js";
import { handleConversationScheduleCommand } from "../generation/conversation-schedule-command-runtime.js";
import type { ScheduleUpdateCommand } from "../conversation/character-commands.js";
import { resolveCharacterNameMap } from "../../routes/generate/generate-route-utils.js";
import { conversationPromptHistoryContent } from "../../routes/generate/conversation-prompt-formatting.js";

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

const CHARACTER_STATUSES = new Set(["online", "idle", "dnd", "offline"]);
const MAX_STATUS_ACTIVITY_CHARS = 500;
const MAX_STATUS_DURATION_CHARS = 32;

/** A package's status update as the host's `[schedule_update]` command, or a thrown reason it is not one. */
function readCharacterStatusUpdate(update: CapabilityCharacterStatusUpdate): ScheduleUpdateCommand {
  if (!update || typeof update !== "object" || Array.isArray(update)) {
    throw new Error("updateCharacterStatus needs an update object.");
  }
  const { status, activity, duration } = update as Record<string, unknown>;
  if (status !== undefined && (typeof status !== "string" || !CHARACTER_STATUSES.has(status))) {
    throw new Error('updateCharacterStatus status must be "online", "idle", "dnd" or "offline".');
  }
  if (activity !== undefined && (typeof activity !== "string" || activity.length > MAX_STATUS_ACTIVITY_CHARS)) {
    throw new Error(`updateCharacterStatus activity must be text of at most ${MAX_STATUS_ACTIVITY_CHARS} characters.`);
  }
  if (duration !== undefined && (typeof duration !== "string" || duration.length > MAX_STATUS_DURATION_CHARS)) {
    throw new Error(`updateCharacterStatus duration must be text of at most ${MAX_STATUS_DURATION_CHARS} characters.`);
  }
  const trimmedActivity = activity?.trim();
  if (!status && !trimmedActivity) throw new Error("updateCharacterStatus needs a status or an activity.");
  return {
    type: "schedule_update",
    ...(status ? { status: status as ScheduleUpdateCommand["status"] } : {}),
    ...(trimmedActivity ? { activity: trimmedActivity } : {}),
    ...(duration?.trim() ? { duration: duration.trim() } : {}),
  };
}

const MAX_ROLEPLAY_EVENT_TEXT_CHARS = 1_000;
const MAX_ROLEPLAY_EVENT_PAYLOAD_CHARS = 8_000;

function mapBranchMetadata(value: unknown): CapabilityChatRecord["branch"] {
  const metadata = parseMetadata(value);
  if (!metadata) return null;

  const hasBranchMetadata = ["branchName", "branchParentChatId", "branchParentMessageId", "branchMessageId"].some(
    (key) => Object.prototype.hasOwnProperty.call(metadata, key),
  );
  if (!hasBranchMetadata) return null;
  const title = readTrimmedString(metadata.branchName);
  const parentChatId = readTrimmedString(metadata.branchParentChatId);
  const rawParentMessageId = readTrimmedString(metadata.branchParentMessageId);
  const rawChildMessageId = readTrimmedString(metadata.branchMessageId);
  const hasMessagePair = rawParentMessageId !== null && rawChildMessageId !== null;
  const isEmptyBranch = rawParentMessageId === null && rawChildMessageId === null;
  const hasKnownLineage = parentChatId !== null && (hasMessagePair || isEmptyBranch);

  return {
    title,
    parentChatId: hasKnownLineage ? parentChatId : null,
    parentMessageId: hasKnownLineage && hasMessagePair ? rawParentMessageId : null,
    childMessageId: hasKnownLineage && hasMessagePair ? rawChildMessageId : null,
  };
}

function mapChat(row: typeof chats.$inferSelect): CapabilityChatRecord {
  const branch = mapBranchMetadata(row.metadata);
  return {
    id: row.id,
    name: branch?.title ?? row.name,
    mode: row.mode,
    characterIds: parseStringArray(row.characterIds),
    groupId: row.groupId,
    personaId: row.personaId,
    connectionId: row.connectionId,
    metadata: row.metadata,
    branch,
    lastMessageAt: row.lastMessageAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * A Roleplay message as the generate route's agents read it: a user turn without leftover private tags, a reply with
 * its documents, and each whisper at its place (roleplayAgentText).
 */
function roleplayAgentContent(row: typeof messages.$inferSelect, names: ReadonlyMap<string, string>): string {
  const source = row.role === "user" ? { ...row, content: parseRoleplayUserCommands(row.content).content } : row;
  return roleplayAgentText(conversationPromptHistoryContent(source, "roleplay"), source, names);
}

/** `names` gives each message its agent view (roleplayAgentContent); null leaves `agentContent` out. */
function mapMessage(
  row: typeof messages.$inferSelect,
  names: ReadonlyMap<string, string> | null = null,
): CapabilityMessageRecord {
  return {
    id: row.id,
    chatId: row.chatId,
    role: row.role,
    characterId: row.characterId,
    content: row.content,
    activeSwipeIndex: row.activeSwipeIndex,
    extra: row.extra,
    createdAt: row.createdAt,
    ...(names ? { agentContent: roleplayAgentContent(row, names) } : {}),
  };
}

/**
 * Whisper recipients' names for agents reading this chat, as Engine-run agents get them (#7443), or null where
 * agents do not read whispers (see roleplayAgentsSeeWhispers).
 */
async function agentWhisperNames(db: DB, chatId: string): Promise<ReadonlyMap<string, string> | null> {
  const chat = (await db.select().from(chats).where(eq(chats.id, chatId)).limit(1))[0];
  if (!chat || !roleplayAgentsSeeWhispers(chat.mode, parseExtra(chat.metadata))) return null;
  const characters = createCharactersStorage(db);
  const identity = await resolveChatUserIdentity(characters, chat);
  return new Map([
    ...(await resolveCharacterNameMap(parseStringArray(chat.characterIds), (id) => characters.getById(id))),
    [identity?.id ?? "user", identity?.name ?? "User"],
  ]);
}

function readSummaryEntries(value: unknown): CapabilityChatSummaries["day"] {
  const entries: CapabilityChatSummaries["day"] = {};
  for (const [key, raw] of Object.entries(parseMetadata(value) ?? {})) {
    const entry = parseMetadata(raw);
    if (typeof entry?.summary === "string") {
      entries[key] = { summary: entry.summary, keyDetails: parseStringArray(entry.keyDetails) };
    }
  }
  return entries;
}

/**
 * One stored Game session as a complete SessionSummary. Older entries lack fields or keep `revelations`, so each
 * field is read on its own (as the Game routes do); a missing number is the entry's position plus one.
 */
function readGameSession(session: Record<string, unknown>, index: number, chatUpdatedAt?: string): SessionSummary {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const stats = parseMetadata(session.statsSnapshot);
  return {
    sessionNumber: typeof session.sessionNumber === "number" ? session.sessionNumber : index + 1,
    summary: text(session.summary),
    resumePoint: text(session.resumePoint),
    partyDynamics: text(session.partyDynamics),
    partyState: text(session.partyState),
    keyDiscoveries: [
      ...new Set([...parseStringArray(session.keyDiscoveries), ...parseStringArray(session.revelations)]),
    ],
    characterMoments: parseStringArray(session.characterMoments),
    littleDetails: parseStringArray(session.littleDetails),
    statsSnapshot: stats ? structuredClone(stats) : {},
    npcUpdates: parseStringArray(session.npcUpdates),
    ...(typeof session.nextSessionRequest === "string" ? { nextSessionRequest: session.nextSessionRequest } : {}),
    timestamp: typeof session.timestamp === "string" ? session.timestamp : (chatUpdatedAt ?? ""),
  };
}

/**
 * The summaries a chat keeps in its metadata; whatever is missing or malformed reads as empty.
 * Undated entries take the chat's own update time, so repeated reads return the same values.
 */
function mapChatSummaries(value: unknown, chatUpdatedAt?: string): Omit<CapabilityChatSummaries, "advancedMemory"> {
  const metadata = parseMetadata(value) ?? {};
  const sessions = Array.isArray(metadata.gamePreviousSessionSummaries) ? metadata.gamePreviousSessionSummaries : [];
  return {
    day: readSummaryEntries(metadata.daySummaries),
    week: readSummaryEntries(metadata.weekSummaries),
    rolling: normalizeChatSummaryEntries(metadata.summaryEntries, {
      legacySummary: typeof metadata.summary === "string" ? metadata.summary : null,
      now: chatUpdatedAt,
    }),
    gameSessions: sessions.flatMap((entry, index) => {
      const session = parseMetadata(entry);
      return typeof session?.summary === "string" ? [readGameSession(session, index, chatUpdatedAt)] : [];
    }),
  };
}

/** The columns a package sees; vectors, work-in-progress replies and message lists are never loaded. */
const advancedMemorySummaryColumns = {
  id: advancedMemoryRecords.id,
  sceneId: advancedMemoryRecords.sceneId,
  title: advancedMemoryRecords.title,
  content: advancedMemoryRecords.content,
  timeline: advancedMemoryRecords.timeline,
  startMessageId: advancedMemoryRecords.startMessageId,
  endMessageId: advancedMemoryRecords.endMessageId,
  audienceCharacterIds: advancedMemoryRecords.audienceCharacterIds,
  sourceFingerprint: advancedMemoryRecords.sourceFingerprint,
  structuredMemory: advancedMemoryRecords.structuredMemory,
  createdAt: advancedMemoryRecords.createdAt,
  updatedAt: advancedMemoryRecords.updatedAt,
};
type AdvancedMemorySummaryRow = Pick<
  typeof advancedMemoryRecords.$inferSelect,
  keyof typeof advancedMemorySummaryColumns
>;

/** The query keeps enabled scene rows; scaffolds and preparation work have no content yet. */
function mapAdvancedMemory(rows: AdvancedMemorySummaryRow[]): CapabilityAdvancedMemorySummary[] {
  return rows
    .filter((row) => row.content.trim())
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((row) => {
      let audience: unknown = [];
      try {
        audience = JSON.parse(row.audienceCharacterIds);
      } catch {
        audience = [];
      }
      return {
        id: row.id,
        sceneId: row.sceneId,
        kind: "scene",
        title: row.title,
        content: row.content,
        timeline: row.timeline ?? null,
        startMessageId: row.startMessageId,
        endMessageId: row.endMessageId,
        audienceCharacterIds: Array.isArray(audience)
          ? audience.filter((id): id is string => typeof id === "string")
          : [],
        sourceFingerprint: row.sourceFingerprint,
        updatedAt: row.updatedAt,
        memory: typeof row.structuredMemory === "string" ? row.structuredMemory : null,
      };
    });
}

function parsePresentCharacterIds(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const record = entry as { characterId?: unknown; id?: unknown };
      const id = record.characterId ?? record.id;
      return typeof id === "string" && id.trim().length > 0 ? [id] : [];
    });
  } catch {
    return [];
  }
}

function mapGameState(row: typeof gameStateSnapshots.$inferSelect): CapabilityGameStateRecord {
  return {
    snapshotId: row.id,
    chatId: row.chatId,
    messageId: row.messageId,
    swipeIndex: row.swipeIndex,
    date: row.date,
    time: row.time,
    location: row.location,
    weather: row.weather,
    temperature: row.temperature,
    presentCharacterIds: parsePresentCharacterIds(row.presentCharacters),
  };
}

function mapSnapshot(row: typeof spatialContextSnapshots.$inferSelect): SpatialContextSnapshot {
  return {
    id: row.id,
    chatId: row.chatId,
    messageId: row.messageId,
    swipeIndex: row.swipeIndex,
    currentLocationId: row.currentLocationId,
    definitionRevision: row.definitionRevision,
    source: row.source as SpatialSnapshotSource,
    transitionCommandId: row.transitionCommandId,
    transitionPayloadHash: row.transitionPayloadHash,
    createdAt: row.createdAt,
  };
}

function parseDocumentData(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function mapDocument(row: typeof capabilityDocuments.$inferSelect): CapabilityDocumentRecord {
  return {
    id: row.id,
    packageId: row.packageId,
    kind: row.kind,
    name: row.name,
    description: row.description,
    data: parseDocumentData(row.data),
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function createDocumentStore(db: DB): CapabilityDocumentStore {
  return {
    async list(packageId, kind) {
      const rows = await db
        .select()
        .from(capabilityDocuments)
        .where(and(eq(capabilityDocuments.packageId, packageId), eq(capabilityDocuments.kind, kind)))
        .orderBy(desc(capabilityDocuments.updatedAt), desc(capabilityDocuments.id));
      return rows.map(mapDocument);
    },
    async getById(packageId, id) {
      const rows = await db
        .select()
        .from(capabilityDocuments)
        .where(and(eq(capabilityDocuments.packageId, packageId), eq(capabilityDocuments.id, id)))
        .limit(1);
      return rows[0] ? mapDocument(rows[0]) : null;
    },
    async create(input) {
      return db.transaction(async (transaction) =>
        withNewGlobalGalleryCapabilityReferences(transaction, null, input.data, async () => {
          const row: typeof capabilityDocuments.$inferInsert = {
            ...input,
            data: JSON.stringify(input.data),
            revision: 1,
          };
          await transaction.insert(capabilityDocuments).values(row);
          return mapDocument(row as typeof capabilityDocuments.$inferSelect);
        }),
      );
    },
    async update(input) {
      return db.transaction(async (transaction) => {
        const rows = await transaction
          .select()
          .from(capabilityDocuments)
          .where(and(eq(capabilityDocuments.packageId, input.packageId), eq(capabilityDocuments.id, input.id)))
          .limit(1);
        const current = rows[0];
        if (!current || current.revision !== input.expectedRevision) return null;
        return withNewGlobalGalleryCapabilityReferences(transaction, current.data, input.data, async () => {
          const next = {
            ...current,
            name: input.name,
            description: input.description,
            data: JSON.stringify(input.data),
            revision: current.revision + 1,
            updatedAt: input.updatedAt,
          };
          await transaction
            .update(capabilityDocuments)
            .set({
              name: next.name,
              description: next.description,
              data: next.data,
              revision: next.revision,
              updatedAt: next.updatedAt,
            })
            .where(and(eq(capabilityDocuments.packageId, input.packageId), eq(capabilityDocuments.id, input.id)));
          return mapDocument(next);
        });
      });
    },
    async remove(packageId, id, expectedRevision) {
      return db.transaction(async (transaction) => {
        const rows = await transaction
          .select({ revision: capabilityDocuments.revision })
          .from(capabilityDocuments)
          .where(and(eq(capabilityDocuments.packageId, packageId), eq(capabilityDocuments.id, id)))
          .limit(1);
        if (!rows[0] || rows[0].revision !== expectedRevision) return false;
        await transaction
          .delete(capabilityDocuments)
          .where(and(eq(capabilityDocuments.packageId, packageId), eq(capabilityDocuments.id, id)));
        return true;
      });
    },
  };
}

type PersistencePermissionCheck = (permission: "chat-read" | "chat-write") => void;

function createSpatialSnapshotStore(
  db: DB,
  assertPermission: PersistencePermissionCheck,
): CapabilitySpatialSnapshotStore {
  const store: CapabilitySpatialSnapshotStore = {
    async getById(id, chatId) {
      assertPermission("chat-read");
      const condition = chatId
        ? and(eq(spatialContextSnapshots.chatId, chatId), eq(spatialContextSnapshots.id, id))
        : eq(spatialContextSnapshots.id, id);
      const rows = await db.select().from(spatialContextSnapshots).where(condition).limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },
    async getByAnchor(chatId, messageId, swipeIndex) {
      assertPermission("chat-read");
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(
          and(
            eq(spatialContextSnapshots.chatId, chatId),
            eq(spatialContextSnapshots.messageId, messageId),
            eq(spatialContextSnapshots.swipeIndex, swipeIndex),
          ),
        )
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },
    async getByCommand(chatId, commandId) {
      assertPermission("chat-read");
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(
          and(eq(spatialContextSnapshots.chatId, chatId), eq(spatialContextSnapshots.transitionCommandId, commandId)),
        )
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },
    async listByAnchors(chatId, anchors) {
      assertPermission("chat-read");
      if (anchors.length === 0) return [];
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(
          and(
            eq(spatialContextSnapshots.chatId, chatId),
            or(
              ...anchors.map((anchor) =>
                and(
                  eq(spatialContextSnapshots.messageId, anchor.messageId),
                  eq(spatialContextSnapshots.swipeIndex, anchor.swipeIndex),
                ),
              ),
            ),
          ),
        );
      return rows.map(mapSnapshot);
    },
    async listForChat(chatId) {
      assertPermission("chat-read");
      const rows = await db.select().from(spatialContextSnapshots).where(eq(spatialContextSnapshots.chatId, chatId));
      return rows.map(mapSnapshot);
    },
    async hasMessageSnapshots(chatId) {
      assertPermission("chat-read");
      const rows = await db
        .select({ id: spatialContextSnapshots.id })
        .from(spatialContextSnapshots)
        .where(and(eq(spatialContextSnapshots.chatId, chatId), ne(spatialContextSnapshots.messageId, "")))
        .limit(1);
      return rows.length > 0;
    },
    async getLatest(chatId) {
      assertPermission("chat-read");
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(eq(spatialContextSnapshots.chatId, chatId))
        .orderBy(desc(spatialContextSnapshots.createdAt), desc(spatialContextSnapshots.id))
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },
    async getBootstrap(chatId) {
      assertPermission("chat-read");
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(and(eq(spatialContextSnapshots.chatId, chatId), eq(spatialContextSnapshots.messageId, "")))
        .orderBy(desc(spatialContextSnapshots.createdAt), desc(spatialContextSnapshots.id))
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },
    async create(input) {
      assertPermission("chat-write");
      await db.insert(spatialContextSnapshots).values(input);
      return mapSnapshot(input as typeof spatialContextSnapshots.$inferSelect);
    },
    async replaceBootstrap(input) {
      assertPermission("chat-write");
      return db.transaction(async (tx) => {
        await tx
          .delete(spatialContextSnapshots)
          .where(and(eq(spatialContextSnapshots.chatId, input.chatId), eq(spatialContextSnapshots.messageId, "")));
        await tx.insert(spatialContextSnapshots).values(input);
        return mapSnapshot(input as typeof spatialContextSnapshots.$inferSelect);
      });
    },
    async replaceAtAnchor(input) {
      assertPermission("chat-write");
      return db.transaction(async (tx) => {
        await tx
          .delete(spatialContextSnapshots)
          .where(
            and(
              eq(spatialContextSnapshots.chatId, input.chatId),
              eq(spatialContextSnapshots.messageId, input.messageId),
              eq(spatialContextSnapshots.swipeIndex, input.swipeIndex),
            ),
          );
        await tx.insert(spatialContextSnapshots).values(input);
        return mapSnapshot(input as typeof spatialContextSnapshots.$inferSelect);
      });
    },
  };
  return store;
}

function createPersistenceSession(db: DB, assertPermission: PersistencePermissionCheck): CapabilityPersistenceSession {
  return {
    async listChats() {
      assertPermission("chat-read");
      return (await db.select().from(chats).orderBy(desc(chats.updatedAt))).map(mapChat);
    },
    async getChat(chatId) {
      assertPermission("chat-read");
      const rows = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
      return rows[0] ? mapChat(rows[0]) : null;
    },
    async listMessages(chatId) {
      assertPermission("chat-read");
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(messages.createdAt, messages.id);
      // A failed name lookup costs the agent view, never the messages.
      const names = await agentWhisperNames(db, chatId).catch((err) => {
        logger.warn(err, "Agent whisper names unavailable for chat %s; listing messages without agentContent", chatId);
        return null;
      });
      return rows.map((row) => mapMessage(row, names));
    },
    async listChatSummaries(chatId) {
      assertPermission("chat-read");
      const rows = await db
        .select({ metadata: chats.metadata, updatedAt: chats.updatedAt })
        .from(chats)
        .where(eq(chats.id, chatId))
        .limit(1);
      const records = rows[0]
        ? await db
            .select(advancedMemorySummaryColumns)
            .from(advancedMemoryRecords)
            .where(
              and(
                eq(advancedMemoryRecords.chatId, chatId),
                eq(advancedMemoryRecords.kind, "scene"),
                eq(advancedMemoryRecords.enabled, 1),
              ),
            )
        : [];
      return { ...mapChatSummaries(rows[0]?.metadata, rows[0]?.updatedAt), advancedMemory: mapAdvancedMemory(records) };
    },
    async getGameState(chatId) {
      assertPermission("chat-read");
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(and(eq(gameStateSnapshots.chatId, chatId), eq(gameStateSnapshots.committed, 1)))
        .orderBy(desc(gameStateSnapshots.createdAt), desc(gameStateSnapshots.id))
        .limit(1);
      return rows[0] ? mapGameState(rows[0]) : null;
    },
    async appendRoleplayEvent(input: CapabilityRoleplayEventInput): Promise<CapabilityRoleplayEventRecord | null> {
      assertPermission("chat-write");
      const scopedOwner = engineEventOwner(input.chatId);
      const text = input.text.trim().slice(0, MAX_ROLEPLAY_EVENT_TEXT_CHARS);
      if (!text || input.idempotencyKey.length === 0) return null;
      const event = { ...input, text };
      const data = JSON.stringify(event);
      if (data.length > MAX_ROLEPLAY_EVENT_PAYLOAD_CHARS) return null;
      const now = input.createdAt;
      try {
        await db.insert(capabilityDocuments).values({
          id: input.id,
          packageId: scopedOwner,
          kind: "roleplay-event",
          name: input.eventType,
          description: input.sourcePackageId,
          data,
          idempotencyKey: input.idempotencyKey,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        });
      } catch (error) {
        if (error instanceof FileUniqueConstraintError) return null;
        throw error;
      }
      return event;
    },
    async listExistingLorebookEntryIds(entryIds) {
      const requestedIds = Array.from(new Set(entryIds.filter((entryId) => entryId.length > 0)));
      if (requestedIds.length === 0) return [];
      const rows = await db
        .select({ id: lorebookEntries.id })
        .from(lorebookEntries)
        .where(inArray(lorebookEntries.id, requestedIds));
      const existingIds = new Set(rows.map((row) => row.id));
      return requestedIds.filter((entryId) => existingIds.has(entryId));
    },
    async createMessageWithSwipe(input: CapabilityCreateMessageWithSwipeInput) {
      assertPermission("chat-write");
      // `imported:` is RESERVED for synthetic experience-state anchors (#5405), and this is the
      // only message writer that takes a caller-supplied id — every other path builds one with
      // newId() (nanoid, whose alphabet has no colon). The reservation is load-bearing: the
      // messages -> game_engine_state cascade matches messageId ALONE and is never scoped by
      // chatId, so a real message minted at "imported:X" would let ITS deletion destroy an
      // imported campaign in a DIFFERENT chat — the exact cross-chat damage the synthetic anchor
      // exists to prevent — and would also fall under the validate() dangling-ref exemption that
      // assumes no such message can exist. Refuse before the transaction so nothing is written.
      if (input.id.startsWith(IMPORTED_GAME_ENGINE_ANCHOR_PREFIX)) {
        throw new Error(
          `Message id ${JSON.stringify(input.id)} uses the reserved ` +
            `"${IMPORTED_GAME_ENGINE_ANCHOR_PREFIX}" prefix, which belongs to imported experience-state anchors`,
        );
      }
      return db.transaction(async (tx) => {
        const chatRows = await tx
          .select({ lastMessageAt: chats.lastMessageAt })
          .from(chats)
          .where(eq(chats.id, input.chatId))
          .limit(1);
        const createdAt = ensureTimestampAfter(input.createdAt, chatRows[0]?.lastMessageAt);
        const message: typeof messages.$inferInsert = {
          id: input.id,
          chatId: input.chatId,
          role: input.role,
          characterId: input.characterId,
          content: input.content,
          activeSwipeIndex: 0,
          extra: JSON.stringify(input.extra),
          createdAt,
        };
        await tx.insert(messages).values(message);
        await tx.insert(messageSwipes).values({
          id: input.swipeId,
          messageId: input.id,
          index: 0,
          content: input.content,
          extra: JSON.stringify({}),
          createdAt,
        });
        await tx
          .update(chats)
          .set({ lastMessageAt: createdAt, updatedAt: createdAt })
          .where(eq(chats.id, input.chatId));
        return mapMessage(message as typeof messages.$inferSelect);
      });
    },
    async markGameStateSnapshotCommitted(chatId, snapshotId) {
      assertPermission("chat-write");
      await db
        .update(gameStateSnapshots)
        .set({ committed: 1 })
        .where(and(eq(gameStateSnapshots.id, snapshotId), eq(gameStateSnapshots.chatId, chatId)));
    },
    // Both metadata writers below replace the WHOLE blob and are not write-ordinal stamped
    // (#5406) — same category as `chats.updateMetadata`: the mirror rides through untouched, so
    // a key written here keeps a stale ordinal. Safe only while the keys packages order against
    // are reachable solely through the chat metadata PATCH path.
    async updateChatActivity(input: CapabilityChatActivityUpdate) {
      assertPermission("chat-write");
      await db.transaction(async (transaction) => {
        const rows = input.metadata
          ? await transaction
              .select({ metadata: chats.metadata })
              .from(chats)
              .where(eq(chats.id, input.chatId))
              .limit(1)
          : [];
        await withNewGlobalGalleryCapabilityReferences(transaction, rows[0]?.metadata, input.metadata, () =>
          transaction
            .update(chats)
            .set({
              lastMessageAt: input.lastMessageAt,
              updatedAt: input.updatedAt,
              ...(input.metadata ? { metadata: JSON.stringify(input.metadata) } : {}),
            })
            .where(eq(chats.id, input.chatId)),
        );
      });
    },
    async updateChatMetadata(input: CapabilityChatMetadataUpdate) {
      assertPermission("chat-write");
      await db.transaction(async (transaction) => {
        const rows = await transaction
          .select({ metadata: chats.metadata })
          .from(chats)
          .where(eq(chats.id, input.chatId))
          .limit(1);
        await withNewGlobalGalleryCapabilityReferences(transaction, rows[0]?.metadata, input.metadata, () =>
          transaction
            .update(chats)
            .set({
              metadata: JSON.stringify(input.metadata),
              updatedAt: input.updatedAt,
            })
            .where(eq(chats.id, input.chatId)),
        );
      });
    },
    documents: createDocumentStore(db),
    spatialSnapshots: createSpatialSnapshotStore(db, assertPermission),
  };
}

/**
 * The chat locks a package holds in the current async context. The metadata queue behind `withChatLock` is not
 * reentrant, so a patch made while holding the same chat's lock runs inside it instead of waiting for it forever.
 * `held` turns false when the lock's operation ends, so work the operation left running queues normally.
 */
const heldChatLocks = new AsyncLocalStorage<ReadonlyArray<{ chatId: string; held: boolean }>>();

/** Omitted permissions are reserved for trusted Engine callers; package activation always passes its manifest. */
export function createCapabilityPersistenceHost(db: DB, permissions?: readonly string[]): CapabilityPersistenceHost {
  const granted = permissions ? new Set(permissions) : null;
  const assertPermission: PersistencePermissionCheck = (permission) => {
    if (granted && !granted.has(permission)) throw new Error(`Package persistence requires ${permission} permission.`);
  };
  const session = createPersistenceSession(db, assertPermission);
  // Built on first use: hosts made without a database (tests, early activation) never touch chat storage.
  let chatsStorage: ReturnType<typeof createChatsStorage> | undefined;
  const hostChats = () => (chatsStorage ??= createChatsStorage(db));
  return {
    ...session,
    withChatLock: (chatId, operation) => {
      if (granted && !granted.has("chat-read") && !granted.has("chat-write")) {
        return Promise.reject(new Error("Package chat locks require chat-read or chat-write permission."));
      }
      return withChatMetadataPatchQueue(chatId, async () => {
        const lock = { chatId, held: true };
        try {
          return await heldChatLocks.run([...(heldChatLocks.getStore() ?? []), lock], operation);
        } finally {
          lock.held = false;
        }
      });
    },
    transaction: (operation) => db.transaction((tx) => operation(createPersistenceSession(tx, assertPermission))),
    async patchChatMetadata(chatId, patch, options) {
      assertPermission("chat-write");
      const apply = async () => {
        const chat = await hostChats().getById(chatId);
        if (!chat) return;
        const next = typeof patch === "function" ? await patch(parseMetadata(chat.metadata) ?? {}) : patch;
        // Like updateChatMetadata, a package patch cannot add a reference to a Global Gallery image that is gone.
        await withNewGlobalGalleryCapabilityReferences(db, chat.metadata, next, () =>
          hostChats().patchMetadata(chatId, next, {
            metadataQueueHeld: true,
            ...(options?.touchUpdatedAt === false ? { touchUpdatedAt: false } : {}),
          }),
        );
      };
      const lockHeld = heldChatLocks.getStore()?.some((lock) => lock.held && lock.chatId === chatId) ?? false;
      await (lockHeld ? apply() : withChatMetadataPatchQueue(chatId, apply));
    },
    async appendMessages(chatId, inputs) {
      assertPermission("chat-write");
      if (!(await hostChats().getById(chatId))) throw new Error(`Chat ${chatId} was not found.`);
      const ids = await hostChats().createMessagesBatch(
        chatId,
        inputs.map((input) => ({
          role: input.role,
          characterId: input.characterId,
          content: input.content,
          extra: input.extra,
          createdAt: input.createdAt,
        })),
      );
      if (ids.length === 0) return [];
      const rows = await db
        .select()
        .from(messages)
        .where(and(eq(messages.chatId, chatId), inArray(messages.id, ids)));
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [mapMessage(row)] : [];
      });
    },
    async setMessagesHiddenFromAI(chatId, messageIds, hidden) {
      assertPermission("chat-write");
      if (!(await hostChats().getById(chatId))) throw new Error(`Chat ${chatId} was not found.`);
      // An automatic writer leaves a message the user hid or showed by hand alone, like Advanced Memory (#7192).
      // ponytail: read outside the patch queues, so a hand-set choice made during this call can be overwritten; a
      // skip-manual option inside bulkSetHiddenFromAI's transaction closes it.
      const manual = new Set(
        (await hostChats().listMessages(chatId))
          .filter((message) => parseExtra(message.extra).visibilityManual === true)
          .map((message) => message.id),
      );
      // No extra fields: a package never marks a message's visibility as the user's choice.
      return hostChats().bulkSetHiddenFromAI(
        chatId,
        messageIds.filter((id) => !manual.has(id)),
        hidden,
      );
    },
    async createChatNote(sourceChatId, targetChatId, content, anchorMessageId) {
      assertPermission("chat-write");
      await hostChats().createNote(sourceChatId, targetChatId, content, anchorMessageId);
    },
    async createChatInfluence(sourceChatId, targetChatId, content, anchorMessageId) {
      assertPermission("chat-write");
      await hostChats().createInfluence(sourceChatId, targetChatId, content, anchorMessageId);
    },
    async updateCharacterStatus(chatId, characterId, update) {
      assertPermission("chat-write");
      const command = readCharacterStatusUpdate(update);
      const chat = await hostChats().getById(chatId);
      if (!chat) throw new Error(`Chat ${chatId} was not found.`);
      if (chat.mode !== "conversation") throw new Error(`Chat ${chatId} is not a Conversation chat.`);
      // Like a reply's command, it only reaches a character of this chat.
      if (!parseStringArray(chat.characterIds).includes(characterId)) {
        throw new Error(`Character ${characterId} is not in chat ${chatId}.`);
      }
      // A shared room keeps its own copy of each routine and never writes the character card.
      const metadata = parseMetadata(chat.metadata) ?? {};
      if (metadata.multiplayer || metadata.multiplayerSetup === true) return null;
      let result: CapabilityCharacterStatusResult | null = null;
      await handleConversationScheduleCommand({
        command,
        characterId,
        chatId,
        chats: hostChats(),
        characters: createCharactersStorage(db),
        sendUpdated: (data) => {
          result = {
            status: data.status as CapabilityCharacterStatusResult["status"],
            activity: (data.activity as string | null | undefined) ?? null,
            expiresAt: data.expiresAt as string,
          };
        },
      });
      return result;
    },
  };
}
