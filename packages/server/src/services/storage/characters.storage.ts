// ──────────────────────────────────────────────
// Storage: Characters, Personas & Groups
// ──────────────────────────────────────────────
import { eq, desc } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { characters, personas, characterGroups } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import type { CharacterData } from "@marinara-engine/shared";

export function createCharactersStorage(db: DB) {
  return {
    // ── Characters ──

    async list() {
      return db.select().from(characters).orderBy(desc(characters.updatedAt));
    },

    async getById(id: string) {
      const rows = await db.select().from(characters).where(eq(characters.id, id));
      return rows[0] ?? null;
    },

    async create(data: CharacterData, avatarPath?: string) {
      const id = newId();
      const timestamp = now();
      await db.insert(characters).values({
        id,
        data: JSON.stringify(data),
        avatarPath: avatarPath ?? null,
        spriteFolderPath: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async update(id: string, data: Partial<CharacterData>, avatarPath?: string) {
      const existing = await this.getById(id);
      if (!existing) return null;
      const currentData = JSON.parse(existing.data) as CharacterData;
      const merged = { ...currentData, ...data };
      await db
        .update(characters)
        .set({
          data: JSON.stringify(merged),
          ...(avatarPath !== undefined && { avatarPath }),
          updatedAt: now(),
        })
        .where(eq(characters.id, id));
      return this.getById(id);
    },

    async updateAvatar(id: string, avatarPath: string) {
      await db.update(characters).set({ avatarPath, updatedAt: now() }).where(eq(characters.id, id));
      return this.getById(id);
    },

    async remove(id: string) {
      await db.delete(characters).where(eq(characters.id, id));
    },

    // ── Personas ──

    async listPersonas() {
      return db.select().from(personas).orderBy(desc(personas.updatedAt));
    },

    async getPersona(id: string) {
      const rows = await db.select().from(personas).where(eq(personas.id, id));
      return rows[0] ?? null;
    },

    async createPersona(
      name: string,
      description: string,
      avatarPath?: string,
      extra?: {
        comment?: string;
        personality?: string;
        scenario?: string;
        backstory?: string;
        appearance?: string;
        nameColor?: string;
        dialogueColor?: string;
        boxColor?: string;
        personaStats?: string;
        altDescriptions?: string;
      },
    ) {
      const id = newId();
      const timestamp = now();
      await db.insert(personas).values({
        id,
        name,
        comment: extra?.comment ?? "",
        description,
        personality: extra?.personality ?? "",
        scenario: extra?.scenario ?? "",
        backstory: extra?.backstory ?? "",
        appearance: extra?.appearance ?? "",
        avatarPath: avatarPath ?? null,
        isActive: "false",
        nameColor: extra?.nameColor ?? "",
        dialogueColor: extra?.dialogueColor ?? "",
        boxColor: extra?.boxColor ?? "",
        personaStats: extra?.personaStats ?? "",
        altDescriptions: extra?.altDescriptions ?? "[]",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getPersona(id);
    },

    async setActivePersona(id: string) {
      // Deactivate all
      await db.update(personas).set({ isActive: "false" });
      // Activate the one
      await db.update(personas).set({ isActive: "true", updatedAt: now() }).where(eq(personas.id, id));
    },

    async removePersona(id: string) {
      await db.delete(personas).where(eq(personas.id, id));
    },

    async updatePersona(
      id: string,
      updates: {
        name?: string;
        comment?: string;
        description?: string;
        personality?: string;
        scenario?: string;
        backstory?: string;
        appearance?: string;
        avatarPath?: string;
        nameColor?: string;
        dialogueColor?: string;
        boxColor?: string;
        personaStats?: string;
        altDescriptions?: string;
      },
    ) {
      const sets: Record<string, unknown> = { updatedAt: now() };
      if (updates.name !== undefined) sets.name = updates.name;
      if (updates.comment !== undefined) sets.comment = updates.comment;
      if (updates.description !== undefined) sets.description = updates.description;
      if (updates.personality !== undefined) sets.personality = updates.personality;
      if (updates.scenario !== undefined) sets.scenario = updates.scenario;
      if (updates.backstory !== undefined) sets.backstory = updates.backstory;
      if (updates.appearance !== undefined) sets.appearance = updates.appearance;
      if (updates.avatarPath !== undefined) sets.avatarPath = updates.avatarPath;
      if (updates.nameColor !== undefined) sets.nameColor = updates.nameColor;
      if (updates.dialogueColor !== undefined) sets.dialogueColor = updates.dialogueColor;
      if (updates.boxColor !== undefined) sets.boxColor = updates.boxColor;
      if (updates.personaStats !== undefined) sets.personaStats = updates.personaStats;
      if (updates.altDescriptions !== undefined) sets.altDescriptions = updates.altDescriptions;
      await db.update(personas).set(sets).where(eq(personas.id, id));
      return this.getPersona(id);
    },

    // ── Character Groups ──

    async listGroups() {
      return db.select().from(characterGroups).orderBy(desc(characterGroups.updatedAt));
    },

    async getGroupById(id: string) {
      const rows = await db.select().from(characterGroups).where(eq(characterGroups.id, id));
      return rows[0] ?? null;
    },

    async createGroup(name: string, description: string, characterIds: string[] = []) {
      const id = newId();
      const timestamp = now();
      await db.insert(characterGroups).values({
        id,
        name,
        description,
        characterIds: JSON.stringify(characterIds),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getGroupById(id);
    },

    async updateGroup(
      id: string,
      updates: { name?: string; description?: string; characterIds?: string[]; avatarPath?: string },
    ) {
      const existing = await this.getGroupById(id);
      if (!existing) return null;
      await db
        .update(characterGroups)
        .set({
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.characterIds !== undefined && { characterIds: JSON.stringify(updates.characterIds) }),
          ...(updates.avatarPath !== undefined && { avatarPath: updates.avatarPath }),
          updatedAt: now(),
        })
        .where(eq(characterGroups.id, id));
      return this.getGroupById(id);
    },

    async removeGroup(id: string) {
      await db.delete(characterGroups).where(eq(characterGroups.id, id));
    },
  };
}
