// ──────────────────────────────────────────────
// Storage: Conversation Calls
// ──────────────────────────────────────────────
import { and, desc, eq, inArray } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import {
  conversationCallMessages,
  conversationCallSessions,
  conversationCallSounds,
} from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import type {
  ConversationCallMessage,
  ConversationCallMessageKind,
  ConversationCallMode,
  ConversationCallSession,
  ConversationCallStatus,
  ConversationCallSound,
  MessageRole,
} from "@marinara-engine/shared";

type CreateCallInput = {
  chatId: string;
  mode: ConversationCallMode;
  initiator: "user" | "character";
  initiatorCharacterId?: string | null;
  metadata?: Record<string, unknown>;
};

type CreateCallMessageInput = {
  callId: string;
  chatId: string;
  role: MessageRole;
  characterId?: string | null;
  participantKind: "user" | "character";
  kind: ConversationCallMessageKind;
  content: string;
  extra?: Record<string, unknown>;
  createdAt?: string | null;
};

const BUILT_IN_SOUNDS: Array<{ id: string; name: string; mimeType: string }> = [
  { id: "builtin-soft-chime", name: "Soft Chime", mimeType: "audio/x-marinara-synth" },
  { id: "builtin-tap", name: "Tap", mimeType: "audio/x-marinara-synth" },
  { id: "builtin-sparkle", name: "Sparkle", mimeType: "audio/x-marinara-synth" },
  { id: "builtin-pop", name: "Pop", mimeType: "audio/x-marinara-synth" },
];

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toSession(row: typeof conversationCallSessions.$inferSelect): ConversationCallSession {
  return {
    id: row.id,
    chatId: row.chatId,
    status: row.status,
    mode: row.mode,
    initiator: row.initiator,
    initiatorCharacterId: row.initiatorCharacterId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    summary: row.summary,
    metadata: parseRecord(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMessage(row: typeof conversationCallMessages.$inferSelect): ConversationCallMessage {
  return {
    id: row.id,
    callId: row.callId,
    chatId: row.chatId,
    role: row.role,
    characterId: row.characterId,
    participantKind: row.participantKind,
    kind: row.kind,
    content: row.content,
    extra: parseRecord(row.extra),
    createdAt: row.createdAt,
  };
}

function toSound(row: typeof conversationCallSounds.$inferSelect): ConversationCallSound {
  return {
    id: row.id,
    name: row.name,
    filePath: row.filePath,
    mimeType: row.mimeType,
    durationMs: row.durationMs,
    builtIn: row.builtIn === "true",
    createdAt: row.createdAt,
  };
}

export function createConversationCallsStorage(db: DB) {
  async function ensureBuiltInSounds() {
    const ids = BUILT_IN_SOUNDS.map((sound) => sound.id);
    const existing = await db
      .select({ id: conversationCallSounds.id })
      .from(conversationCallSounds)
      .where(inArray(conversationCallSounds.id, ids));
    const existingIds = new Set(existing.map((row) => row.id));
    const timestamp = now();
    const missing = BUILT_IN_SOUNDS.filter((sound) => !existingIds.has(sound.id));
    if (missing.length === 0) return;
    await db.insert(conversationCallSounds).values(
      missing.map((sound) => ({
        id: sound.id,
        name: sound.name,
        filePath: null,
        mimeType: sound.mimeType,
        durationMs: null,
        builtIn: "true",
        createdAt: timestamp,
      })),
    );
  }

  return {
    async createSession(input: CreateCallInput) {
      const id = newId();
      const timestamp = now();
      const status: ConversationCallStatus = input.initiator === "character" ? "ringing" : "active";
      await db.insert(conversationCallSessions).values({
        id,
        chatId: input.chatId,
        status,
        mode: input.mode,
        initiator: input.initiator,
        initiatorCharacterId: input.initiatorCharacterId ?? null,
        startedAt: status === "active" ? timestamp : null,
        endedAt: null,
        summary: null,
        metadata: JSON.stringify(input.metadata ?? {}),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getSession(id);
    },

    async getSession(id: string) {
      const rows = await db.select().from(conversationCallSessions).where(eq(conversationCallSessions.id, id));
      return rows[0] ? toSession(rows[0]) : null;
    },

    async getActiveForChat(chatId: string) {
      const rows = await db
        .select()
        .from(conversationCallSessions)
        .where(and(eq(conversationCallSessions.chatId, chatId), eq(conversationCallSessions.status, "active")))
        .orderBy(desc(conversationCallSessions.updatedAt));
      return rows[0] ? toSession(rows[0]) : null;
    },

    async getRingingForChat(chatId: string) {
      const rows = await db
        .select()
        .from(conversationCallSessions)
        .where(and(eq(conversationCallSessions.chatId, chatId), eq(conversationCallSessions.status, "ringing")))
        .orderBy(desc(conversationCallSessions.updatedAt));
      return rows[0] ? toSession(rows[0]) : null;
    },

    async updateStatus(
      id: string,
      status: ConversationCallStatus,
      patch: { summary?: string | null; metadata?: Record<string, unknown> } = {},
    ) {
      const current = await this.getSession(id);
      if (!current) return null;
      const timestamp = now();
      await db
        .update(conversationCallSessions)
        .set({
          status,
          startedAt: status === "active" ? (current.startedAt ?? timestamp) : current.startedAt,
          endedAt: status === "ended" || status === "declined" || status === "missed" ? timestamp : current.endedAt,
          summary: patch.summary !== undefined ? patch.summary : current.summary,
          metadata: patch.metadata ? JSON.stringify({ ...current.metadata, ...patch.metadata }) : JSON.stringify(current.metadata),
          updatedAt: timestamp,
        })
        .where(eq(conversationCallSessions.id, id));
      return this.getSession(id);
    },

    async createMessage(input: CreateCallMessageInput) {
      const id = newId();
      const timestamp = input.createdAt ?? now();
      await db.insert(conversationCallMessages).values({
        id,
        callId: input.callId,
        chatId: input.chatId,
        role: input.role,
        characterId: input.characterId ?? null,
        participantKind: input.participantKind,
        kind: input.kind,
        content: input.content,
        extra: JSON.stringify(input.extra ?? {}),
        createdAt: timestamp,
      });
      return this.getMessage(id);
    },

    async getMessage(id: string) {
      const rows = await db.select().from(conversationCallMessages).where(eq(conversationCallMessages.id, id));
      return rows[0] ? toMessage(rows[0]) : null;
    },

    async updateMessageExtra(id: string, partial: Record<string, unknown>) {
      const current = await this.getMessage(id);
      if (!current) return null;
      await db
        .update(conversationCallMessages)
        .set({ extra: JSON.stringify({ ...current.extra, ...partial }) })
        .where(eq(conversationCallMessages.id, id));
      return this.getMessage(id);
    },

    async listMessages(callId: string) {
      const rows = await db
        .select()
        .from(conversationCallMessages)
        .where(eq(conversationCallMessages.callId, callId))
        .orderBy(conversationCallMessages.createdAt, conversationCallMessages.id);
      return rows.map(toMessage);
    },

    async listSounds() {
      await ensureBuiltInSounds();
      const rows = await db.select().from(conversationCallSounds).orderBy(conversationCallSounds.builtIn, conversationCallSounds.name);
      return rows.map(toSound);
    },

    async createSound(input: { name: string; filePath: string; mimeType: string; durationMs?: number | null }) {
      const id = newId();
      const timestamp = now();
      await db.insert(conversationCallSounds).values({
        id,
        name: input.name,
        filePath: input.filePath,
        mimeType: input.mimeType,
        durationMs: input.durationMs ?? null,
        builtIn: "false",
        createdAt: timestamp,
      });
      const rows = await db.select().from(conversationCallSounds).where(eq(conversationCallSounds.id, id));
      return rows[0] ? toSound(rows[0]) : null;
    },

    async getSound(id: string) {
      await ensureBuiltInSounds();
      const rows = await db.select().from(conversationCallSounds).where(eq(conversationCallSounds.id, id));
      return rows[0] ? toSound(rows[0]) : null;
    },

    async deleteSound(id: string) {
      const sound = await this.getSound(id);
      if (!sound || sound.builtIn) return sound;
      await db.delete(conversationCallSounds).where(eq(conversationCallSounds.id, id));
      return sound;
    },
  };
}
