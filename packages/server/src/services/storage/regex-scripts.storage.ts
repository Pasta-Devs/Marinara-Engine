// ──────────────────────────────────────────────
// Storage: Regex Scripts
// ──────────────────────────────────────────────
import { eq, asc, isNull, inArray, or } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { regexScripts } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import type { CreateRegexScriptInput } from "@marinara-engine/shared";

export function createRegexScriptsStorage(db: DB) {
  return {
    async list() {
      return db.select().from(regexScripts).orderBy(asc(regexScripts.order));
    },

    async listForCharacters(characterIds: string[]) {
      if (characterIds.length === 0) {
        return db.select().from(regexScripts).where(isNull(regexScripts.characterId)).orderBy(asc(regexScripts.order));
      }
      return db
        .select()
        .from(regexScripts)
        .where(or(isNull(regexScripts.characterId), inArray(regexScripts.characterId, characterIds)))
        .orderBy(asc(regexScripts.order));
    },

    async listByCharacter(characterId: string) {
      return db
        .select()
        .from(regexScripts)
        .where(eq(regexScripts.characterId, characterId))
        .orderBy(asc(regexScripts.order));
    },

    async getById(id: string) {
      const rows = await db.select().from(regexScripts).where(eq(regexScripts.id, id));
      return rows[0] ?? null;
    },

    async create(input: CreateRegexScriptInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(regexScripts).values({
        id,
        characterId: input.characterId ?? null,
        name: input.name,
        enabled: String(input.enabled ?? true),
        findRegex: input.findRegex,
        replaceString: input.replaceString ?? "",
        trimStrings: JSON.stringify(input.trimStrings ?? []),
        placement: JSON.stringify(input.placement),
        flags: input.flags ?? "gi",
        promptOnly: String(input.promptOnly ?? false),
        order: input.order ?? 0,
        minDepth: input.minDepth ?? null,
        maxDepth: input.maxDepth ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async createBatch(inputs: CreateRegexScriptInput[]): Promise<number> {
      if (inputs.length === 0) return 0;
      const timestamp = now();
      const rows = inputs.map((input, i) => ({
        id: newId(),
        characterId: input.characterId ?? null,
        name: input.name,
        enabled: String(input.enabled ?? true),
        findRegex: input.findRegex,
        replaceString: input.replaceString ?? "",
        trimStrings: JSON.stringify(input.trimStrings ?? []),
        placement: JSON.stringify(input.placement),
        flags: input.flags ?? "gi",
        promptOnly: String(input.promptOnly ?? false),
        order: input.order ?? i,
        minDepth: input.minDepth ?? null,
        maxDepth: input.maxDepth ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));
      await db.insert(regexScripts).values(rows);
      return rows.length;
    },

    async update(id: string, data: Partial<CreateRegexScriptInput>) {
      const updateFields: Record<string, unknown> = { updatedAt: now() };
      if (data.characterId !== undefined) updateFields.characterId = data.characterId;
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.enabled !== undefined) updateFields.enabled = String(data.enabled);
      if (data.findRegex !== undefined) updateFields.findRegex = data.findRegex;
      if (data.replaceString !== undefined) updateFields.replaceString = data.replaceString;
      if (data.trimStrings !== undefined) updateFields.trimStrings = JSON.stringify(data.trimStrings);
      if (data.placement !== undefined) updateFields.placement = JSON.stringify(data.placement);
      if (data.flags !== undefined) updateFields.flags = data.flags;
      if (data.promptOnly !== undefined) updateFields.promptOnly = String(data.promptOnly);
      if (data.order !== undefined) updateFields.order = data.order;
      if (data.minDepth !== undefined) updateFields.minDepth = data.minDepth;
      if (data.maxDepth !== undefined) updateFields.maxDepth = data.maxDepth;
      await db.update(regexScripts).set(updateFields).where(eq(regexScripts.id, id));
      return this.getById(id);
    },

    async reorder(scriptIds: string[]) {
      const timestamp = now();
      await Promise.all(
        scriptIds.map((id, index) =>
          db.update(regexScripts).set({ order: index, updatedAt: timestamp }).where(eq(regexScripts.id, id)),
        ),
      );
      return this.list();
    },

    async remove(id: string) {
      await db.delete(regexScripts).where(eq(regexScripts.id, id));
    },

    async removeByCharacter(characterId: string) {
      await db.delete(regexScripts).where(eq(regexScripts.characterId, characterId));
    },
  };
}
