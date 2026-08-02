// ──────────────────────────────────────────────
// Storage: Regex Scripts
// ──────────────────────────────────────────────
import { eq, asc } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { regexScripts } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import type { CreateRegexScriptInput, RegexApplyMode } from "@marinara-engine/shared";

function deriveApplyMode(input: { applyMode?: RegexApplyMode; promptOnly?: boolean }): RegexApplyMode {
  if (input.applyMode === "prompt" || input.applyMode === "display" || input.applyMode === "both") {
    return input.applyMode;
  }
  return input.promptOnly === true ? "prompt" : "display";
}

function promptOnlyForApplyMode(applyMode: RegexApplyMode): string {
  return String(applyMode === "prompt");
}

export function createRegexScriptsStorage(db: DB) {
  async function getNextOrder(): Promise<number> {
    const rows = await db.select({ order: regexScripts.order }).from(regexScripts);
    return rows.reduce((maxOrder, row) => Math.max(maxOrder, row.order), -1) + 1;
  }

  return {
    async list() {
      return db
        .select()
        .from(regexScripts)
        .orderBy(asc(regexScripts.order), asc(regexScripts.createdAt), asc(regexScripts.id));
    },

    async getById(id: string) {
      const rows = await db.select().from(regexScripts).where(eq(regexScripts.id, id));
      return rows[0] ?? null;
    },

    async create(input: CreateRegexScriptInput) {
      const id = newId();
      const timestamp = now();
      const order = input.order ?? (await getNextOrder());
      const applyMode = deriveApplyMode(input);
      await db.insert(regexScripts).values({
        id,
        name: input.name,
        enabled: String(input.enabled ?? true),
        findRegex: input.findRegex,
        replaceString: input.replaceString ?? "",
        trimStrings: JSON.stringify(input.trimStrings ?? []),
        placement: JSON.stringify(input.placement),
        flags: input.flags ?? "gi",
        promptOnly: promptOnlyForApplyMode(applyMode),
        applyMode,
        targetCharacterIds: JSON.stringify(input.targetCharacterIds ?? []),
        targetPromptPresetIds: JSON.stringify(input.targetPromptPresetIds ?? []),
        order,
        minDepth: input.minDepth ?? null,
        maxDepth: input.maxDepth ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async update(id: string, data: Partial<CreateRegexScriptInput>) {
      const updateFields: Record<string, unknown> = { updatedAt: now() };
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.enabled !== undefined) updateFields.enabled = String(data.enabled);
      if (data.findRegex !== undefined) updateFields.findRegex = data.findRegex;
      if (data.replaceString !== undefined) updateFields.replaceString = data.replaceString;
      if (data.trimStrings !== undefined) updateFields.trimStrings = JSON.stringify(data.trimStrings);
      if (data.placement !== undefined) updateFields.placement = JSON.stringify(data.placement);
      if (data.flags !== undefined) updateFields.flags = data.flags;
      if (data.applyMode !== undefined || data.promptOnly !== undefined) {
        const applyMode = deriveApplyMode(data);
        updateFields.promptOnly = promptOnlyForApplyMode(applyMode);
        updateFields.applyMode = applyMode;
      }
      if (data.targetCharacterIds !== undefined) {
        updateFields.targetCharacterIds = JSON.stringify(data.targetCharacterIds);
      }
      if (data.targetPromptPresetIds !== undefined) {
        updateFields.targetPromptPresetIds = JSON.stringify(data.targetPromptPresetIds);
      }
      if (data.order !== undefined) updateFields.order = data.order;
      if (data.minDepth !== undefined) updateFields.minDepth = data.minDepth;
      if (data.maxDepth !== undefined) updateFields.maxDepth = data.maxDepth;
      await db.update(regexScripts).set(updateFields).where(eq(regexScripts.id, id));
      return this.getById(id);
    },

    async reorder(scriptIds: string[]) {
      const uniqueScriptIds = Array.from(new Set(scriptIds));
      if (uniqueScriptIds.length === 0) return this.list();
      const orderedRows = await this.list();
      const existingIds = new Set(orderedRows.map((script) => script.id));
      const incomingQueue = uniqueScriptIds.filter((id) => existingIds.has(id));
      if (incomingQueue.length === 0) return orderedRows;
      const movingIds = new Set(incomingQueue);
      let cursor = 0;
      const nextIds = orderedRows.map((script) => {
        if (!movingIds.has(script.id)) return script.id;
        const nextId = incomingQueue[cursor];
        cursor += 1;
        return nextId ?? script.id;
      });
      const timestamp = now();
      await db.transaction(async (tx) => {
        for (let index = 0; index < nextIds.length; index += 1) {
          await tx
            .update(regexScripts)
            .set({ order: index, updatedAt: timestamp })
            .where(eq(regexScripts.id, nextIds[index]!));
        }
      });
      return this.list();
    },

    async remove(id: string) {
      await db.delete(regexScripts).where(eq(regexScripts.id, id));
    },
  };
}
