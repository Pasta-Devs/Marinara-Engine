import {
  type CapabilityChatActivityUpdate,
  type CapabilityChatMetadataUpdate,
  type CapabilityChatRecord,
  type CapabilityCreateMessageWithSwipeInput,
  type CapabilityMessageRecord,
  type CapabilityPersistenceHost,
  type CapabilityPersistenceSession,
  type CapabilitySpatialSnapshotStore,
  type SpatialContextSnapshot,
  type SpatialSnapshotSource,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { and, desc, eq, inArray, ne, or } from "../../db/file-query.js";
import { ensureTimestampAfter } from "../import/import-timestamps.js";
import {
  chats,
  gameStateSnapshots,
  lorebookEntries,
  messages,
  messageSwipes,
  spatialContextSnapshots,
} from "../../db/schema/index.js";
import { withChatMetadataPatchQueue } from "../storage/chats.storage.js";

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

function mapChat(row: typeof chats.$inferSelect): CapabilityChatRecord {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    characterIds: parseStringArray(row.characterIds),
    connectionId: row.connectionId,
    metadata: row.metadata,
    lastMessageAt: row.lastMessageAt,
    updatedAt: row.updatedAt,
  };
}

function mapMessage(row: typeof messages.$inferSelect): CapabilityMessageRecord {
  return {
    id: row.id,
    chatId: row.chatId,
    role: row.role,
    characterId: row.characterId,
    content: row.content,
    activeSwipeIndex: row.activeSwipeIndex,
    extra: row.extra,
    createdAt: row.createdAt,
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

function createSpatialSnapshotStore(db: DB): CapabilitySpatialSnapshotStore {
  const store: CapabilitySpatialSnapshotStore = {
    async getById(id) {
      const rows = await db.select().from(spatialContextSnapshots).where(eq(spatialContextSnapshots.id, id)).limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },
    async getByAnchor(chatId, messageId, swipeIndex) {
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
      const rows = await db.select().from(spatialContextSnapshots).where(eq(spatialContextSnapshots.chatId, chatId));
      return rows.map(mapSnapshot);
    },
    async hasMessageSnapshots(chatId) {
      const rows = await db
        .select({ id: spatialContextSnapshots.id })
        .from(spatialContextSnapshots)
        .where(and(eq(spatialContextSnapshots.chatId, chatId), ne(spatialContextSnapshots.messageId, "")))
        .limit(1);
      return rows.length > 0;
    },
    async getLatest(chatId) {
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(eq(spatialContextSnapshots.chatId, chatId))
        .orderBy(desc(spatialContextSnapshots.createdAt), desc(spatialContextSnapshots.id))
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },
    async getBootstrap(chatId) {
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(and(eq(spatialContextSnapshots.chatId, chatId), eq(spatialContextSnapshots.messageId, "")))
        .orderBy(desc(spatialContextSnapshots.createdAt), desc(spatialContextSnapshots.id))
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },
    async create(input) {
      await db.insert(spatialContextSnapshots).values(input);
      return mapSnapshot(input as typeof spatialContextSnapshots.$inferSelect);
    },
    async replaceBootstrap(input) {
      return db.transaction(async (tx) => {
        await tx
          .delete(spatialContextSnapshots)
          .where(and(eq(spatialContextSnapshots.chatId, input.chatId), eq(spatialContextSnapshots.messageId, "")));
        await tx.insert(spatialContextSnapshots).values(input);
        return mapSnapshot(input as typeof spatialContextSnapshots.$inferSelect);
      });
    },
    async replaceAtAnchor(input) {
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

function createPersistenceSession(db: DB): CapabilityPersistenceSession {
  return {
    async getChat(chatId) {
      const rows = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
      return rows[0] ? mapChat(rows[0]) : null;
    },
    async listMessages(chatId) {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(messages.createdAt, messages.id);
      return rows.map(mapMessage);
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
        return mapMessage(message as typeof messages.$inferSelect);
      });
    },
    async markGameStateSnapshotCommitted(chatId, snapshotId) {
      await db
        .update(gameStateSnapshots)
        .set({ committed: 1 })
        .where(and(eq(gameStateSnapshots.id, snapshotId), eq(gameStateSnapshots.chatId, chatId)));
    },
    async updateChatActivity(input: CapabilityChatActivityUpdate) {
      await db
        .update(chats)
        .set({
          lastMessageAt: input.lastMessageAt,
          updatedAt: input.updatedAt,
          ...(input.metadata ? { metadata: JSON.stringify(input.metadata) } : {}),
        })
        .where(eq(chats.id, input.chatId));
    },
    async updateChatMetadata(input: CapabilityChatMetadataUpdate) {
      await db
        .update(chats)
        .set({
          metadata: JSON.stringify(input.metadata),
          updatedAt: input.updatedAt,
        })
        .where(eq(chats.id, input.chatId));
    },
    spatialSnapshots: createSpatialSnapshotStore(db),
  };
}

export function createCapabilityPersistenceHost(db: DB): CapabilityPersistenceHost {
  const session = createPersistenceSession(db);
  return {
    ...session,
    withChatLock: (chatId, operation) => withChatMetadataPatchQueue(chatId, operation),
    transaction: (operation) => db.transaction((tx) => operation(createPersistenceSession(tx))),
  };
}
