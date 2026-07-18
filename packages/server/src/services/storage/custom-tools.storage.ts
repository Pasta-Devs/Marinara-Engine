// ──────────────────────────────────────────────
// Storage: Custom Tools
// ──────────────────────────────────────────────
import { asc, desc, eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { agentConfigs, customTools } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { parseAgentSettingsRecord, type CreateCustomToolInput } from "@marinara-engine/shared";
import { isCustomToolScriptEnabled } from "../../config/runtime-config.js";

export function createCustomToolsStorage(db: DB) {
  async function getNextSortOrder(): Promise<number> {
    const rows = await db.select({ sortOrder: customTools.sortOrder }).from(customTools);
    return rows.reduce((maxOrder, row) => Math.max(maxOrder, row.sortOrder), 0) + 10;
  }

  return {
    async list() {
      return db
        .select()
        .from(customTools)
        .orderBy(asc(customTools.sortOrder), desc(customTools.updatedAt), asc(customTools.id));
    },

    async listEnabled() {
      const rows = await db
        .select()
        .from(customTools)
        .orderBy(asc(customTools.sortOrder), asc(customTools.name), asc(customTools.id));
      return rows.filter((row) => {
        if (row.enabled !== "true") return false;
        return row.executionType !== "script" || isCustomToolScriptEnabled();
      });
    },

    async getById(id: string) {
      const rows = await db.select().from(customTools).where(eq(customTools.id, id));
      return rows[0] ?? null;
    },

    async getByName(name: string) {
      const rows = await db.select().from(customTools).where(eq(customTools.name, name));
      return rows[0] ?? null;
    },

    async create(input: CreateCustomToolInput) {
      const id = newId();
      const timestamp = now();
      const sortOrder = input.sortOrder ?? (await getNextSortOrder());
      await db.insert(customTools).values({
        id,
        name: input.name,
        description: input.description ?? "",
        parametersSchema: JSON.stringify(input.parametersSchema ?? {}),
        executionType: input.executionType ?? "static",
        webhookUrl: input.webhookUrl ?? null,
        staticResult: input.staticResult ?? null,
        scriptBody: input.scriptBody ?? null,
        includeHiddenContext: String(input.includeHiddenContext ?? false),
        enabled: String(input.enabled ?? true),
        sortOrder,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async update(id: string, data: Partial<CreateCustomToolInput>) {
      const current = await this.getById(id);
      if (!current) return null;
      const updateFields: Record<string, unknown> = { updatedAt: now() };
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.description !== undefined) updateFields.description = data.description;
      if (data.parametersSchema !== undefined) updateFields.parametersSchema = JSON.stringify(data.parametersSchema);
      if (data.executionType !== undefined) {
        updateFields.executionType = data.executionType;
      }
      if (data.webhookUrl !== undefined) updateFields.webhookUrl = data.webhookUrl;
      if (data.staticResult !== undefined) updateFields.staticResult = data.staticResult;
      if (data.scriptBody !== undefined) updateFields.scriptBody = data.scriptBody;
      if (data.includeHiddenContext !== undefined) {
        updateFields.includeHiddenContext = String(data.includeHiddenContext);
      }
      if (data.enabled !== undefined) {
        updateFields.enabled = String(data.enabled);
      }
      if (data.sortOrder !== undefined) updateFields.sortOrder = data.sortOrder;
      await db.update(customTools).set(updateFields).where(eq(customTools.id, id));
      return this.getById(id);
    },

    async reorder(toolIds: string[]) {
      const uniqueToolIds = Array.from(new Set(toolIds));
      if (uniqueToolIds.length === 0) return this.list();
      const orderedRows = await this.list();
      const existingIds = new Set(orderedRows.map((tool) => tool.id));
      const incomingQueue = uniqueToolIds.filter((id) => existingIds.has(id));
      if (incomingQueue.length === 0) return orderedRows;
      const movingIds = new Set(incomingQueue);
      let cursor = 0;
      const nextIds = orderedRows.map((tool) => {
        if (!movingIds.has(tool.id)) return tool.id;
        const nextId = incomingQueue[cursor];
        cursor += 1;
        return nextId ?? tool.id;
      });
      const timestamp = now();
      await db.transaction(async (tx) => {
        for (let index = 0; index < nextIds.length; index += 1) {
          await tx
            .update(customTools)
            .set({ sortOrder: (index + 1) * 10, updatedAt: timestamp })
            .where(eq(customTools.id, nextIds[index]!));
        }
      });
      return this.list();
    },

    async remove(id: string) {
      const tool = await this.getById(id);
      if (!tool) return;

      const timestamp = now();
      await db.transaction(async (tx) => {
        const configs = await tx.select().from(agentConfigs);
        for (const config of configs) {
          const settings = parseAgentSettingsRecord(config.settings);
          if (!Array.isArray(settings.enabledTools) || !settings.enabledTools.includes(tool.name)) continue;
          await tx
            .update(agentConfigs)
            .set({
              settings: JSON.stringify({
                ...settings,
                enabledTools: settings.enabledTools.filter((name) => name !== tool.name),
              }),
              updatedAt: timestamp,
            })
            .where(eq(agentConfigs.id, config.id));
        }
        await tx.delete(customTools).where(eq(customTools.id, id));
      });
    },
  };
}
