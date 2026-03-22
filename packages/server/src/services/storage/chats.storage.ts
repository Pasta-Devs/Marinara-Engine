// ──────────────────────────────────────────────
// Storage: Chats
// ──────────────────────────────────────────────
import { eq, desc, and, lt, sql, count } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { chats, messages, messageSwipes, chatImages, oocInfluences } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { DATA_DIR } from "../../utils/data-dir.js";
import type { CreateChatInput, CreateMessageInput } from "@marinara-engine/shared";

const GALLERY_DIR = join(DATA_DIR, "gallery");

export function createChatsStorage(db: DB) {
  return {
    async list() {
      return db.select().from(chats).orderBy(desc(chats.updatedAt));
    },

    async getById(id: string) {
      const rows = await db.select().from(chats).where(eq(chats.id, id));
      return rows[0] ?? null;
    },

    async create(input: CreateChatInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(chats).values({
        id,
        name: input.name,
        mode: input.mode,
        characterIds: JSON.stringify(input.characterIds),
        groupId: input.groupId ?? null,
        personaId: input.personaId,
        promptPresetId: input.promptPresetId,
        connectionId: input.connectionId,
        metadata: JSON.stringify({
          summary: null,
          tags: [],
          enableAgents: true,
          agentOverrides: {},
          activeAgentIds: [],
          activeToolIds: [],
        }),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async update(id: string, data: Partial<CreateChatInput>) {
      await db
        .update(chats)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.mode !== undefined && { mode: data.mode }),
          ...(data.characterIds !== undefined && { characterIds: JSON.stringify(data.characterIds) }),
          ...(data.groupId !== undefined && { groupId: data.groupId }),
          ...(data.personaId !== undefined && { personaId: data.personaId }),
          ...(data.promptPresetId !== undefined && { promptPresetId: data.promptPresetId }),
          ...(data.connectionId !== undefined && { connectionId: data.connectionId }),
          updatedAt: now(),
        })
        .where(eq(chats.id, id));
      return this.getById(id);
    },

    /** List all chats belonging to a group. */
    async listByGroup(groupId: string) {
      return db.select().from(chats).where(eq(chats.groupId, groupId)).orderBy(desc(chats.updatedAt));
    },

    async updateMetadata(id: string, metadata: Record<string, unknown>) {
      await db
        .update(chats)
        .set({ metadata: JSON.stringify(metadata), updatedAt: now() })
        .where(eq(chats.id, id));
      return this.getById(id);
    },

    async remove(id: string) {
      // Clean up gallery images (DB records + files on disk)
      await db.delete(chatImages).where(eq(chatImages.chatId, id));
      const galleryDir = join(GALLERY_DIR, id);
      if (existsSync(galleryDir)) rmSync(galleryDir, { recursive: true, force: true });

      await db.delete(chats).where(eq(chats.id, id));
    },

    /** Delete all chats in a group (all branches). */
    async removeGroup(groupId: string) {
      // Find all chat IDs in this group, then clean up their gallery data
      const groupChats = await db.select({ id: chats.id }).from(chats).where(eq(chats.groupId, groupId));
      for (const chat of groupChats) {
        await db.delete(chatImages).where(eq(chatImages.chatId, chat.id));
        const galleryDir = join(GALLERY_DIR, chat.id);
        if (existsSync(galleryDir)) rmSync(galleryDir, { recursive: true, force: true });
      }

      await db.delete(chats).where(eq(chats.groupId, groupId));
    },

    // ── Messages ──

    async listMessages(chatId: string) {
      const rows = await db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.createdAt);
      const swipeCounts = await db
        .select({ messageId: messageSwipes.messageId, count: count() })
        .from(messageSwipes)
        .where(sql`${messageSwipes.messageId} IN (SELECT id FROM messages WHERE chat_id = ${chatId})`)
        .groupBy(messageSwipes.messageId);
      const countMap = new Map(swipeCounts.map((r) => [r.messageId, r.count]));
      return rows.map((m) => ({ ...m, swipeCount: countMap.get(m.id) ?? 0 }));
    },

    /** Paginated: returns the latest `limit` messages (optionally before a cursor). */
    async listMessagesPaginated(chatId: string, limit: number, before?: string) {
      const conditions = [eq(messages.chatId, chatId)];
      if (before) conditions.push(lt(messages.createdAt, before));
      const rows = await db
        .select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
      const reversed = rows.reverse();
      const ids = reversed.map((m) => m.id);
      if (ids.length === 0) return reversed;
      const swipeCounts = await db
        .select({ messageId: messageSwipes.messageId, count: count() })
        .from(messageSwipes)
        .where(
          sql`${messageSwipes.messageId} IN (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
        .groupBy(messageSwipes.messageId);
      const countMap = new Map(swipeCounts.map((r) => [r.messageId, r.count]));
      return reversed.map((m) => ({ ...m, swipeCount: countMap.get(m.id) ?? 0 }));
    },

    async getMessage(id: string) {
      const rows = await db.select().from(messages).where(eq(messages.id, id));
      return rows[0] ?? null;
    },

    async createMessage(input: CreateMessageInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(messages).values({
        id,
        chatId: input.chatId,
        role: input.role,
        characterId: input.characterId,
        content: input.content,
        activeSwipeIndex: 0,
        extra: JSON.stringify({
          displayText: null,
          isGenerated: input.role !== "user",
          tokenCount: null,
          generationInfo: null,
        }),
        createdAt: timestamp,
      });
      // Create the initial swipe (index 0)
      await db.insert(messageSwipes).values({
        id: newId(),
        messageId: id,
        index: 0,
        content: input.content,
        extra: JSON.stringify({}),
        createdAt: timestamp,
      });
      // Update chat's updatedAt
      await db.update(chats).set({ updatedAt: timestamp }).where(eq(chats.id, input.chatId));
      return this.getMessage(id);
    },

    /**
     * Bulk-insert messages in a single transaction. Much faster than one-by-one
     * createMessage calls (especially on Windows/NTFS where each transaction fsync is expensive).
     * Does NOT return the created messages or update chat.updatedAt per message —
     * caller should update chat.updatedAt once after the batch.
     */
    async createMessagesBatch(chatId: string, inputs: Omit<CreateMessageInput, "chatId">[]) {
      if (inputs.length === 0) return;
      const msgRows: (typeof messages.$inferInsert)[] = [];
      const swipeRows: (typeof messageSwipes.$inferInsert)[] = [];
      const baseTime = Date.now();

      for (let idx = 0; idx < inputs.length; idx++) {
        const input = inputs[idx]!;
        const id = newId();
        const timestamp = new Date(baseTime + idx).toISOString();
        msgRows.push({
          id,
          chatId,
          role: input.role,
          characterId: input.characterId,
          content: input.content,
          activeSwipeIndex: 0,
          extra: JSON.stringify({
            displayText: null,
            isGenerated: input.role !== "user",
            tokenCount: null,
            generationInfo: null,
          }),
          createdAt: timestamp,
        });
        swipeRows.push({
          id: newId(),
          messageId: id,
          index: 0,
          content: input.content,
          extra: JSON.stringify({}),
          createdAt: timestamp,
        });
      }

      const lastTimestamp = new Date(baseTime + inputs.length - 1).toISOString();

      // Batch in chunks of 500 to stay within SQLite variable limits
      const CHUNK = 500;
      await db.transaction(async (tx) => {
        for (let i = 0; i < msgRows.length; i += CHUNK) {
          await tx.insert(messages).values(msgRows.slice(i, i + CHUNK));
          await tx.insert(messageSwipes).values(swipeRows.slice(i, i + CHUNK));
        }
        await tx.update(chats).set({ updatedAt: lastTimestamp }).where(eq(chats.id, chatId));
      });
    },

    async updateMessageContent(id: string, content: string) {
      await db.update(messages).set({ content }).where(eq(messages.id, id));
      return this.getMessage(id);
    },

    /** Merge partial data into a message's extra JSON field. */
    async updateMessageExtra(id: string, partial: Record<string, unknown>) {
      const msg = await this.getMessage(id);
      if (!msg) return null;
      const existing = typeof msg.extra === "string" ? JSON.parse(msg.extra) : (msg.extra ?? {});
      const merged = { ...existing, ...partial };
      await db
        .update(messages)
        .set({ extra: JSON.stringify(merged) })
        .where(eq(messages.id, id));
      return this.getMessage(id);
    },

    async removeMessage(id: string) {
      await db.delete(messages).where(eq(messages.id, id));
    },

    async getSwipes(messageId: string) {
      return db.select().from(messageSwipes).where(eq(messageSwipes.messageId, messageId)).orderBy(messageSwipes.index);
    },

    async addSwipe(messageId: string, content: string) {
      const existing = await this.getSwipes(messageId);
      const nextIndex = existing.length;

      // Backfill: save current message extra onto the currently-active swipe
      // so its thinking/generationInfo isn't lost when we switch away
      const msg = await this.getMessage(messageId);
      if (msg) {
        const msgExtra = typeof msg.extra === "string" ? JSON.parse(msg.extra) : (msg.extra ?? {});
        const activeSwipe = existing.find((s: any) => s.index === msg.activeSwipeIndex);
        if (activeSwipe) {
          await db
            .update(messageSwipes)
            .set({ extra: JSON.stringify(msgExtra) })
            .where(eq(messageSwipes.id, activeSwipe.id));
        }
      }

      const id = newId();
      await db.insert(messageSwipes).values({
        id,
        messageId,
        index: nextIndex,
        content,
        extra: JSON.stringify({}),
        createdAt: now(),
      });
      // Set active swipe to the new one and reset message extra for the fresh swipe
      // (thinking/generationInfo will be populated by updateMessageExtra after generation)
      const clearedExtra = msg
        ? {
            ...(typeof msg.extra === "string" ? JSON.parse(msg.extra) : (msg.extra ?? {})),
            thinking: null,
            generationInfo: null,
          }
        : {};
      await db
        .update(messages)
        .set({ activeSwipeIndex: nextIndex, content, extra: JSON.stringify(clearedExtra) })
        .where(eq(messages.id, messageId));
      return { id, index: nextIndex };
    },

    async setActiveSwipe(messageId: string, index: number) {
      const swipes = await this.getSwipes(messageId);
      const target = swipes.find((s: any) => s.index === index);
      if (!target) return null;

      // Before switching, save current message extra onto the outgoing swipe
      const msg = await this.getMessage(messageId);
      if (msg) {
        const msgExtra = typeof msg.extra === "string" ? JSON.parse(msg.extra) : (msg.extra ?? {});
        const outgoingSwipe = swipes.find((s: any) => s.index === msg.activeSwipeIndex);
        if (outgoingSwipe) {
          await db
            .update(messageSwipes)
            .set({ extra: JSON.stringify(msgExtra) })
            .where(eq(messageSwipes.id, outgoingSwipe.id));
        }
      }

      // Sync the target swipe's extra onto the message
      const swipeExtra = typeof target.extra === "string" ? JSON.parse(target.extra) : (target.extra ?? {});
      await db
        .update(messages)
        .set({
          activeSwipeIndex: index,
          content: target.content,
          extra: JSON.stringify(swipeExtra),
        })
        .where(eq(messages.id, messageId));
      return this.getMessage(messageId);
    },

    /** Merge partial data into a swipe's extra JSON field. */
    async updateSwipeExtra(messageId: string, swipeIndex: number, partial: Record<string, unknown>) {
      const swipes = await this.getSwipes(messageId);
      const target = swipes.find((s: any) => s.index === swipeIndex);
      if (!target) return;
      const existing = typeof target.extra === "string" ? JSON.parse(target.extra) : (target.extra ?? {});
      const merged = { ...existing, ...partial };
      await db
        .update(messageSwipes)
        .set({ extra: JSON.stringify(merged) })
        .where(eq(messageSwipes.id, target.id));
    },

    // ── Chat Connections ──

    /** Bidirectionally link two chats. */
    async connectChats(chatIdA: string, chatIdB: string) {
      const timestamp = now();
      await db.update(chats).set({ connectedChatId: chatIdB, updatedAt: timestamp }).where(eq(chats.id, chatIdA));
      await db.update(chats).set({ connectedChatId: chatIdA, updatedAt: timestamp }).where(eq(chats.id, chatIdB));
    },

    /** Remove the bidirectional link for a chat (and its partner). */
    async disconnectChat(chatId: string) {
      const chat = await this.getById(chatId);
      if (!chat) return;
      const parsed = typeof chat.connectedChatId === "string" ? chat.connectedChatId : null;
      const timestamp = now();
      await db.update(chats).set({ connectedChatId: null, updatedAt: timestamp }).where(eq(chats.id, chatId));
      if (parsed) {
        await db.update(chats).set({ connectedChatId: null, updatedAt: timestamp }).where(eq(chats.id, parsed));
      }
    },

    // ── OOC Influences ──

    /** Create a queued influence from a conversation → its connected roleplay. */
    async createInfluence(sourceChatId: string, targetChatId: string, content: string, anchorMessageId?: string) {
      const id = newId();
      await db.insert(oocInfluences).values({
        id,
        sourceChatId,
        targetChatId,
        content,
        anchorMessageId: anchorMessageId ?? null,
        consumed: "false",
        createdAt: now(),
      });
      return id;
    },

    /** Get all unconsumed influences targeting a chat. */
    async listPendingInfluences(targetChatId: string) {
      return db
        .select()
        .from(oocInfluences)
        .where(and(eq(oocInfluences.targetChatId, targetChatId), eq(oocInfluences.consumed, "false")))
        .orderBy(oocInfluences.createdAt);
    },

    /** Mark an influence as consumed after it's been injected. */
    async markInfluenceConsumed(id: string) {
      await db.update(oocInfluences).set({ consumed: "true" }).where(eq(oocInfluences.id, id));
    },

    /** Delete all influences associated with a chat (as source or target). */
    async deleteInfluencesForChat(chatId: string) {
      await db.delete(oocInfluences).where(eq(oocInfluences.sourceChatId, chatId));
      await db.delete(oocInfluences).where(eq(oocInfluences.targetChatId, chatId));
    },
  };
}
