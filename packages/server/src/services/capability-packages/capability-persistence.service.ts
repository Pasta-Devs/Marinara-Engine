import {
  type CapabilityChatActivityUpdate,
  type CapabilityChatMetadataUpdate,
  type CapabilityChatRecord,
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
  type SpatialContextSnapshot,
  type SpatialSnapshotSource,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { and, desc, eq, inArray, ne, or } from "../../db/file-query.js";
import { IMPORTED_GAME_ENGINE_ANCHOR_PREFIX } from "../../db/file-backed-store.js";
import { FileUniqueConstraintError } from "../../db/file-schema.js";
import { engineEventOwner } from "./capability-roleplay-events.service.js";
import { ensureTimestampAfter } from "../import/import-timestamps.js";
import {
  chats,
  capabilityDocuments,
  gameStateSnapshots,
  lorebookEntries,
  messages,
  messageSwipes,
  spatialContextSnapshots,
} from "../../db/schema/index.js";
import { withChatMetadataPatchQueue } from "../storage/chats.storage.js";
import { withNewGlobalGalleryCapabilityReferences } from "../image/global-gallery-capability-references.js";

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

function createSpatialSnapshotStore(db: DB): CapabilitySpatialSnapshotStore {
  const store: CapabilitySpatialSnapshotStore = {
    async getById(id, chatId) {
      const condition = chatId
        ? and(eq(spatialContextSnapshots.chatId, chatId), eq(spatialContextSnapshots.id, id))
        : eq(spatialContextSnapshots.id, id);
      const rows = await db.select().from(spatialContextSnapshots).where(condition).limit(1);
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
    async listChats() {
      return (await db.select().from(chats).orderBy(desc(chats.updatedAt))).map(mapChat);
    },
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
    async getGameState(chatId) {
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(and(eq(gameStateSnapshots.chatId, chatId), eq(gameStateSnapshots.committed, 1)))
        .orderBy(desc(gameStateSnapshots.createdAt), desc(gameStateSnapshots.id))
        .limit(1);
      return rows[0] ? mapGameState(rows[0]) : null;
    },
    async appendRoleplayEvent(input: CapabilityRoleplayEventInput): Promise<CapabilityRoleplayEventRecord | null> {
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
        return mapMessage(message as typeof messages.$inferSelect);
      });
    },
    async markGameStateSnapshotCommitted(chatId, snapshotId) {
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
