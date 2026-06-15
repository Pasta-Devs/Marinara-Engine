import { and, eq } from "drizzle-orm";
import type {
  DiscordBridgeParticipant,
  DiscordBridgeMessageDirection,
  DiscordBridgeMessageMapping,
  DiscordBridgeThreadBinding,
  DiscordBridgeUserPersona,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import {
  chatParticipants,
  discordBridgeMessageMappings,
  discordBridgeThreadBindings,
  discordBridgeUserPersonas,
} from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

export interface UpsertThreadBindingInput {
  guildId: string;
  channelId: string;
  threadId: string;
  chatId: string;
  chatName: string;
  personaId?: string | null;
  characterIds: string[];
}

export interface UpsertMessageMappingInput {
  bindingId: string;
  marinaraMessageId: string;
  discordMessageIds: string[];
  role: DiscordBridgeMessageMapping["role"];
  direction: DiscordBridgeMessageDirection;
  contentHash: string;
}

export interface UpsertUserPersonaInput {
  guildId: string;
  discordUserId: string;
  personaId: string;
}

export interface UpsertDiscordParticipantInput {
  chatId: string;
  guildId: string;
  discordUserId: string;
  discordDisplayName: string;
  personaId?: string | null;
  active?: boolean;
  hasSpoken?: boolean;
  lastMessageId?: string | null;
  lastSpokeAt?: string | null;
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string");
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toThreadBinding(row: typeof discordBridgeThreadBindings.$inferSelect): DiscordBridgeThreadBinding {
  return {
    id: row.id,
    guildId: row.guildId,
    channelId: row.channelId,
    threadId: row.threadId,
    chatId: row.chatId,
    chatName: row.chatName,
    personaId: row.personaId ?? null,
    characterIds: parseStringArray(row.characterIds),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMessageMapping(row: typeof discordBridgeMessageMappings.$inferSelect): DiscordBridgeMessageMapping {
  return {
    id: row.id,
    bindingId: row.bindingId,
    marinaraMessageId: row.marinaraMessageId,
    discordMessageIds: parseStringArray(row.discordMessageIds),
    role: row.role,
    direction: row.direction,
    contentHash: row.contentHash,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toUserPersona(row: typeof discordBridgeUserPersonas.$inferSelect): DiscordBridgeUserPersona {
  return {
    id: row.id,
    guildId: row.guildId,
    discordUserId: row.discordUserId,
    personaId: row.personaId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toBoolean(raw: unknown): boolean {
  return raw === true || raw === 1 || raw === "true";
}

function toParticipant(row: typeof chatParticipants.$inferSelect): DiscordBridgeParticipant {
  return {
    id: row.id,
    chatId: row.chatId,
    source: "discord_bridge",
    guildId: row.guildId ?? null,
    discordUserId: row.discordUserId ?? null,
    discordDisplayName: row.discordDisplayName,
    personaId: row.personaId ?? null,
    active: toBoolean(row.active),
    hasSpoken: toBoolean(row.hasSpoken),
    lastMessageId: row.lastMessageId ?? null,
    lastSpokeAt: row.lastSpokeAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDiscordBridgeStorage(db: DB) {
  return {
    async listThreadBindings(): Promise<DiscordBridgeThreadBinding[]> {
      const rows = await db.select().from(discordBridgeThreadBindings);
      return rows.map(toThreadBinding);
    },

    async getThreadBindingById(id: string): Promise<DiscordBridgeThreadBinding | null> {
      const rows = await db.select().from(discordBridgeThreadBindings).where(eq(discordBridgeThreadBindings.id, id));
      return rows[0] ? toThreadBinding(rows[0]) : null;
    },

    async getThreadBindingByThreadId(threadId: string): Promise<DiscordBridgeThreadBinding | null> {
      const rows = await db
        .select()
        .from(discordBridgeThreadBindings)
        .where(eq(discordBridgeThreadBindings.threadId, threadId));
      return rows[0] ? toThreadBinding(rows[0]) : null;
    },

    async getThreadBindingByChatId(chatId: string): Promise<DiscordBridgeThreadBinding | null> {
      const rows = await db
        .select()
        .from(discordBridgeThreadBindings)
        .where(eq(discordBridgeThreadBindings.chatId, chatId));
      return rows[0] ? toThreadBinding(rows[0]) : null;
    },

    async upsertThreadBinding(input: UpsertThreadBindingInput): Promise<DiscordBridgeThreadBinding> {
      const timestamp = now();
      const existing = await this.getThreadBindingByThreadId(input.threadId);
      if (existing) {
        await db
          .update(discordBridgeThreadBindings)
          .set({
            guildId: input.guildId,
            channelId: input.channelId,
            chatId: input.chatId,
            chatName: input.chatName,
            personaId: input.personaId ?? null,
            characterIds: JSON.stringify(input.characterIds),
            updatedAt: timestamp,
          })
          .where(eq(discordBridgeThreadBindings.id, existing.id));
        const updated = await this.getThreadBindingByThreadId(input.threadId);
        if (updated) return updated;
      }

      await this.deleteThreadBindingsByChatId(input.chatId);

      await db.insert(discordBridgeThreadBindings).values({
        id: newId(),
        guildId: input.guildId,
        channelId: input.channelId,
        threadId: input.threadId,
        chatId: input.chatId,
        chatName: input.chatName,
        personaId: input.personaId ?? null,
        characterIds: JSON.stringify(input.characterIds),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const created = await this.getThreadBindingByThreadId(input.threadId);
      if (!created) throw new Error("Failed to create Discord bridge thread binding");
      return created;
    },

    async deleteThreadBinding(id: string): Promise<void> {
      await db.delete(discordBridgeMessageMappings).where(eq(discordBridgeMessageMappings.bindingId, id));
      await db.delete(discordBridgeThreadBindings).where(eq(discordBridgeThreadBindings.id, id));
    },

    async deleteThreadBindingsByChatId(chatId: string): Promise<void> {
      const rows = await db
        .select()
        .from(discordBridgeThreadBindings)
        .where(eq(discordBridgeThreadBindings.chatId, chatId));
      for (const row of rows) {
        await this.deleteThreadBinding(row.id);
      }
    },

    async listMessageMappings(bindingId: string): Promise<DiscordBridgeMessageMapping[]> {
      const rows = await db
        .select()
        .from(discordBridgeMessageMappings)
        .where(eq(discordBridgeMessageMappings.bindingId, bindingId));
      return rows.map(toMessageMapping);
    },

    async getMessageMappingByDiscordMessageId(
      bindingId: string,
      discordMessageId: string,
    ): Promise<DiscordBridgeMessageMapping | null> {
      const mappings = await this.listMessageMappings(bindingId);
      return mappings.find((mapping) => mapping.discordMessageIds.includes(discordMessageId)) ?? null;
    },

    async getMessageMappingByMarinaraMessageId(marinaraMessageId: string): Promise<DiscordBridgeMessageMapping | null> {
      const rows = await db
        .select()
        .from(discordBridgeMessageMappings)
        .where(eq(discordBridgeMessageMappings.marinaraMessageId, marinaraMessageId));
      return rows[0] ? toMessageMapping(rows[0]) : null;
    },

    async upsertMessageMapping(input: UpsertMessageMappingInput): Promise<DiscordBridgeMessageMapping> {
      const timestamp = now();
      const discordMessageIds = JSON.stringify(input.discordMessageIds);
      const existing = await this.getMessageMappingByMarinaraMessageId(input.marinaraMessageId);
      if (existing) {
        await db
          .update(discordBridgeMessageMappings)
          .set({
            bindingId: input.bindingId,
            discordMessageIds,
            role: input.role,
            direction: input.direction,
            contentHash: input.contentHash,
            chunkCount: input.discordMessageIds.length,
            updatedAt: timestamp,
          })
          .where(eq(discordBridgeMessageMappings.id, existing.id));
        const updated = await this.getMessageMappingByMarinaraMessageId(input.marinaraMessageId);
        if (updated) return updated;
      }

      await db.insert(discordBridgeMessageMappings).values({
        id: newId(),
        bindingId: input.bindingId,
        marinaraMessageId: input.marinaraMessageId,
        discordMessageIds,
        role: input.role,
        direction: input.direction,
        contentHash: input.contentHash,
        chunkCount: input.discordMessageIds.length,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const created = await this.getMessageMappingByMarinaraMessageId(input.marinaraMessageId);
      if (!created) throw new Error("Failed to create Discord bridge message mapping");
      return created;
    },

    async getUserPersona(guildId: string, discordUserId: string): Promise<DiscordBridgeUserPersona | null> {
      const rows = await db
        .select()
        .from(discordBridgeUserPersonas)
        .where(
          and(
            eq(discordBridgeUserPersonas.guildId, guildId),
            eq(discordBridgeUserPersonas.discordUserId, discordUserId),
          ),
        );
      return rows[0] ? toUserPersona(rows[0]) : null;
    },

    async upsertUserPersona(input: UpsertUserPersonaInput): Promise<DiscordBridgeUserPersona> {
      const timestamp = now();
      const existing = await this.getUserPersona(input.guildId, input.discordUserId);
      if (existing) {
        await db
          .update(discordBridgeUserPersonas)
          .set({
            personaId: input.personaId,
            updatedAt: timestamp,
          })
          .where(eq(discordBridgeUserPersonas.id, existing.id));
        const updated = await this.getUserPersona(input.guildId, input.discordUserId);
        if (updated) return updated;
      }

      await db.insert(discordBridgeUserPersonas).values({
        id: newId(),
        guildId: input.guildId,
        discordUserId: input.discordUserId,
        personaId: input.personaId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const created = await this.getUserPersona(input.guildId, input.discordUserId);
      if (!created) throw new Error("Failed to create Discord bridge user persona");
      return created;
    },

    async listActiveParticipants(chatId: string): Promise<DiscordBridgeParticipant[]> {
      const rows = await db
        .select()
        .from(chatParticipants)
        .where(and(eq(chatParticipants.chatId, chatId), eq(chatParticipants.active, "true")));
      return rows.map(toParticipant);
    },

    async getDiscordParticipant(chatId: string, guildId: string, discordUserId: string) {
      const rows = await db
        .select()
        .from(chatParticipants)
        .where(
          and(
            eq(chatParticipants.chatId, chatId),
            eq(chatParticipants.source, "discord_bridge"),
            eq(chatParticipants.guildId, guildId),
            eq(chatParticipants.discordUserId, discordUserId),
          ),
        );
      return rows[0] ? toParticipant(rows[0]) : null;
    },

    async upsertDiscordParticipant(input: UpsertDiscordParticipantInput): Promise<DiscordBridgeParticipant> {
      const timestamp = now();
      const existing = await this.getDiscordParticipant(input.chatId, input.guildId, input.discordUserId);
      const displayName = input.discordDisplayName.trim() || input.discordUserId;
      if (existing) {
        await db
          .update(chatParticipants)
          .set({
            discordDisplayName: displayName,
            personaId: input.personaId ?? null,
            active: input.active === false ? "false" : "true",
            ...(input.hasSpoken !== undefined && { hasSpoken: input.hasSpoken ? "true" : "false" }),
            ...(input.lastMessageId !== undefined && { lastMessageId: input.lastMessageId }),
            ...(input.lastSpokeAt !== undefined && { lastSpokeAt: input.lastSpokeAt }),
            updatedAt: timestamp,
          })
          .where(eq(chatParticipants.id, existing.id));
        const updated = await this.getDiscordParticipant(input.chatId, input.guildId, input.discordUserId);
        if (updated) return updated;
      }

      await db.insert(chatParticipants).values({
        id: newId(),
        chatId: input.chatId,
        source: "discord_bridge",
        guildId: input.guildId,
        discordUserId: input.discordUserId,
        discordDisplayName: displayName,
        personaId: input.personaId ?? null,
        active: input.active === false ? "false" : "true",
        hasSpoken: input.hasSpoken ? "true" : "false",
        lastMessageId: input.lastMessageId ?? null,
        lastSpokeAt: input.lastSpokeAt ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const created = await this.getDiscordParticipant(input.chatId, input.guildId, input.discordUserId);
      if (!created) throw new Error("Failed to create Discord bridge participant");
      return created;
    },

    async markParticipantSpoken(input: {
      participantId: string;
      lastMessageId: string;
      lastSpokeAt?: string | null;
    }): Promise<DiscordBridgeParticipant | null> {
      const timestamp = now();
      await db
        .update(chatParticipants)
        .set({
          hasSpoken: "true",
          lastMessageId: input.lastMessageId,
          lastSpokeAt: input.lastSpokeAt ?? timestamp,
          updatedAt: timestamp,
        })
        .where(eq(chatParticipants.id, input.participantId));
      const rows = await db.select().from(chatParticipants).where(eq(chatParticipants.id, input.participantId));
      return rows[0] ? toParticipant(rows[0]) : null;
    },

    async deactivateParticipant(participantId: string): Promise<DiscordBridgeParticipant | null> {
      await db
        .update(chatParticipants)
        .set({ active: "false", updatedAt: now() })
        .where(eq(chatParticipants.id, participantId));
      const rows = await db.select().from(chatParticipants).where(eq(chatParticipants.id, participantId));
      return rows[0] ? toParticipant(rows[0]) : null;
    },
  };
}
