// ──────────────────────────────────────────────
// Storage: Prompt Presets, Groups, Sections & Choices
// ──────────────────────────────────────────────
import { eq, desc, asc } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { promptPresets, promptGroups, promptSections, choiceBlocks } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import type {
  CreatePromptPresetInput,
  UpdatePromptPresetInput,
  CreatePromptSectionInput,
  UpdatePromptSectionInput,
  CreatePromptGroupInput,
  UpdatePromptGroupInput,
  CreateChoiceBlockInput,
  UpdateChoiceBlockInput,
} from "@marinara-engine/shared";
import { DEFAULT_GENERATION_PARAMS } from "@marinara-engine/shared";
import { normalizeTimestampOverrides, type TimestampOverrides } from "../import/import-timestamps.js";

function resolveTimestamps(overrides?: TimestampOverrides | null) {
  const normalized = normalizeTimestampOverrides(overrides);
  const createdAt = normalized?.createdAt ?? now();
  return {
    createdAt,
    updatedAt: normalized?.updatedAt ?? createdAt,
  };
}

export function createPromptsStorage(db: DB) {
  return {
    // ═══════════════════════════════════════════
    //  Presets
    // ═══════════════════════════════════════════

    async list() {
      return db.select().from(promptPresets).orderBy(desc(promptPresets.updatedAt));
    },

    async getById(id: string) {
      const rows = await db.select().from(promptPresets).where(eq(promptPresets.id, id));
      return rows[0] ?? null;
    },

    async getDefault() {
      const rows = await db.select().from(promptPresets).where(eq(promptPresets.isDefault, "true"));
      return rows[0] ?? null;
    },

    async create(input: CreatePromptPresetInput, timestampOverrides?: TimestampOverrides | null) {
      const id = newId();
      const timestamp = resolveTimestamps(timestampOverrides);
      await db.insert(promptPresets).values({
        id,
        name: input.name,
        description: input.description ?? "",
        sectionOrder: JSON.stringify([]),
        groupOrder: JSON.stringify([]),
        variableGroups: JSON.stringify(input.variableGroups ?? []),
        variableValues: JSON.stringify(input.variableValues ?? {}),
        parameters: JSON.stringify(input.parameters ?? DEFAULT_GENERATION_PARAMS),
        wrapFormat: input.wrapFormat ?? "xml",
        isDefault: String(input.isDefault ?? false),
        author: input.author ?? "",
        createdAt: timestamp.createdAt,
        updatedAt: timestamp.updatedAt,
      });
      return this.getById(id);
    },

    async update(id: string, data: UpdatePromptPresetInput & { sectionOrder?: string[]; groupOrder?: string[] }) {
      const updateFields: Record<string, unknown> = { updatedAt: now() };
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.description !== undefined) updateFields.description = data.description;
      if (data.sectionOrder !== undefined) updateFields.sectionOrder = JSON.stringify(data.sectionOrder);
      if (data.groupOrder !== undefined) updateFields.groupOrder = JSON.stringify(data.groupOrder);
      if (data.variableGroups !== undefined) updateFields.variableGroups = JSON.stringify(data.variableGroups);
      if (data.variableValues !== undefined) updateFields.variableValues = JSON.stringify(data.variableValues);
      if (data.parameters !== undefined) updateFields.parameters = JSON.stringify(data.parameters);
      if (data.wrapFormat !== undefined) updateFields.wrapFormat = data.wrapFormat;
      if (data.author !== undefined) updateFields.author = data.author;
      if ((data as any).defaultChoices !== undefined)
        updateFields.defaultChoices = JSON.stringify((data as any).defaultChoices);
      await db.update(promptPresets).set(updateFields).where(eq(promptPresets.id, id));
      return this.getById(id);
    },

    async remove(id: string) {
      await db.delete(promptPresets).where(eq(promptPresets.id, id));
    },

    async setDefault(id: string) {
      // Clear all existing defaults, then set the one
      await db.update(promptPresets).set({ isDefault: "false", updatedAt: now() });
      await db.update(promptPresets).set({ isDefault: "true", updatedAt: now() }).where(eq(promptPresets.id, id));
      return this.getById(id);
    },

    async duplicate(id: string) {
      const preset = await this.getById(id);
      if (!preset) return null;
      const newPreset = await this.create({
        name: `${preset.name} (Copy)`,
        description: preset.description,
        variableGroups: JSON.parse(preset.variableGroups as string),
        variableValues: JSON.parse(preset.variableValues as string),
        parameters: JSON.parse(preset.parameters as string),
        wrapFormat: preset.wrapFormat as "xml" | "markdown",
        author: preset.author,
      });
      if (!newPreset) return null;

      // Copy groups with ID mapping
      const groupMap = new Map<string, string>();
      const groups = await this.listGroups(id);
      for (const g of groups) {
        const newGroup = await this.createGroup({
          presetId: newPreset.id,
          name: g.name,
          parentGroupId: null, // will fix parents after
          order: g.order,
          enabled: g.enabled === "true",
        });
        if (newGroup) groupMap.set(g.id, newGroup.id);
      }
      // Fix parent references
      for (const g of groups) {
        if (g.parentGroupId && groupMap.has(g.parentGroupId)) {
          const newGId = groupMap.get(g.id)!;
          await this.updateGroup(newGId, { parentGroupId: groupMap.get(g.parentGroupId)! });
        }
      }

      // Copy sections with ID mapping
      const sectionMap = new Map<string, string>();
      const sections = await this.listSections(id);
      for (const s of sections) {
        const newSection = await this.createSection({
          presetId: newPreset.id,
          identifier: s.identifier,
          name: s.name,
          content: s.content,
          role: s.role as "system" | "user" | "assistant",
          enabled: s.enabled === "true",
          isMarker: s.isMarker === "true",
          groupId: s.groupId ? (groupMap.get(s.groupId) ?? null) : null,
          markerConfig: s.markerConfig ? JSON.parse(s.markerConfig as string) : null,
          injectionPosition: s.injectionPosition as "ordered" | "depth",
          injectionDepth: s.injectionDepth,
          injectionOrder: s.injectionOrder,
          forbidOverrides: s.forbidOverrides === "true",
        });
        if (newSection) sectionMap.set(s.id, newSection.id);
      }

      // Copy choice blocks (preset variables)
      const existingVariables = await this.listChoiceBlocksForPreset(preset.id);
      for (const v of existingVariables) {
        await this.createChoiceBlock({
          presetId: newPreset.id,
          variableName: v.variableName,
          question: v.question,
          options: JSON.parse(v.options as string),
          multiSelect: v.multiSelect === "true",
          separator: v.separator,
          randomPick: v.randomPick === "true",
          displayMode: v.displayMode === "buttons" || v.displayMode === "listbox" ? v.displayMode : "auto",
          optionSort: v.optionSort === "alphabetical" ? "alphabetical" : "manual",
        });
      }

      // Copy section/group order
      const oldSectionOrder = JSON.parse(preset.sectionOrder as string) as string[];
      const newSectionOrder = oldSectionOrder.map((sid) => sectionMap.get(sid)).filter(Boolean) as string[];
      const oldGroupOrder = JSON.parse(preset.groupOrder as string) as string[];
      const newGroupOrder = oldGroupOrder.map((gid) => groupMap.get(gid)).filter(Boolean) as string[];
      await this.update(newPreset.id, { sectionOrder: newSectionOrder, groupOrder: newGroupOrder });

      return this.getById(newPreset.id);
    },

    // ═══════════════════════════════════════════
    //  Groups
    // ═══════════════════════════════════════════

    async listGroups(presetId: string) {
      return db.select().from(promptGroups).where(eq(promptGroups.presetId, presetId)).orderBy(promptGroups.order);
    },

    async getGroup(id: string) {
      const rows = await db.select().from(promptGroups).where(eq(promptGroups.id, id));
      return rows[0] ?? null;
    },

    async createGroup(input: CreatePromptGroupInput) {
      const id = newId();
      await db.insert(promptGroups).values({
        id,
        presetId: input.presetId,
        name: input.name,
        parentGroupId: input.parentGroupId ?? null,
        order: input.order ?? 100,
        enabled: String(input.enabled ?? true),
        createdAt: now(),
      });
      // Add to preset's group order
      const preset = await this.getById(input.presetId);
      if (preset) {
        const order = JSON.parse(preset.groupOrder as string) as string[];
        order.push(id);
        await this.update(input.presetId, { groupOrder: order });
      }
      return this.getGroup(id);
    },

    async updateGroup(id: string, data: UpdatePromptGroupInput) {
      const updateFields: Record<string, unknown> = {};
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.parentGroupId !== undefined) updateFields.parentGroupId = data.parentGroupId;
      if (data.order !== undefined) updateFields.order = data.order;
      if (data.enabled !== undefined) updateFields.enabled = String(data.enabled);
      await db.update(promptGroups).set(updateFields).where(eq(promptGroups.id, id));
      return this.getGroup(id);
    },

    async removeGroup(id: string) {
      const group = await this.getGroup(id);
      if (group) {
        // Remove from preset's group order
        const preset = await this.getById(group.presetId);
        if (preset) {
          const order = (JSON.parse(preset.groupOrder as string) as string[]).filter((gid) => gid !== id);
          await this.update(group.presetId, { groupOrder: order });
        }
        // Ungroup any sections in this group
        const sections = await this.listSections(group.presetId);
        for (const s of sections) {
          if (s.groupId === id) {
            await this.updateSection(s.id, { groupId: null });
          }
        }
        // Unparent any child groups
        const allGroups = await this.listGroups(group.presetId);
        for (const g of allGroups) {
          if (g.parentGroupId === id) {
            await this.updateGroup(g.id, { parentGroupId: null });
          }
        }
      }
      await db.delete(promptGroups).where(eq(promptGroups.id, id));
    },

    async reorderGroups(presetId: string, groupIds: string[]) {
      await this.update(presetId, { groupOrder: groupIds });
      // Also update individual order fields
      for (let i = 0; i < groupIds.length; i++) {
        await db
          .update(promptGroups)
          .set({ order: i * 100 })
          .where(eq(promptGroups.id, groupIds[i]!));
      }
    },

    // ═══════════════════════════════════════════
    //  Sections
    // ═══════════════════════════════════════════

    async listSections(presetId: string) {
      return db
        .select()
        .from(promptSections)
        .where(eq(promptSections.presetId, presetId))
        .orderBy(promptSections.injectionOrder);
    },

    async getSection(id: string) {
      const rows = await db.select().from(promptSections).where(eq(promptSections.id, id));
      return rows[0] ?? null;
    },

    async createSection(input: CreatePromptSectionInput) {
      const id = newId();
      await db.insert(promptSections).values({
        id,
        presetId: input.presetId,
        identifier: input.identifier,
        name: input.name,
        content: input.content ?? "",
        role: input.role ?? "system",
        enabled: String(input.enabled ?? true),
        isMarker: String(input.isMarker ?? false),
        groupId: input.groupId ?? null,
        markerConfig: input.markerConfig ? JSON.stringify(input.markerConfig) : null,
        injectionPosition: input.injectionPosition ?? "ordered",
        injectionDepth: input.injectionDepth ?? 0,
        injectionOrder: input.injectionOrder ?? 100,
        forbidOverrides: String(input.forbidOverrides ?? false),
      });
      // Add to preset's section order
      const preset = await this.getById(input.presetId);
      if (preset) {
        const order = JSON.parse(preset.sectionOrder as string) as string[];
        order.push(id);
        await this.update(input.presetId, { sectionOrder: order });
      }
      return this.getSection(id);
    },

    async updateSection(id: string, data: UpdatePromptSectionInput) {
      const updateFields: Record<string, unknown> = {};
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.content !== undefined) updateFields.content = data.content;
      if (data.role !== undefined) updateFields.role = data.role;
      if (data.enabled !== undefined) updateFields.enabled = String(data.enabled);
      if (data.groupId !== undefined) updateFields.groupId = data.groupId;
      if (data.markerConfig !== undefined)
        updateFields.markerConfig = data.markerConfig ? JSON.stringify(data.markerConfig) : null;
      if (data.injectionPosition !== undefined) updateFields.injectionPosition = data.injectionPosition;
      if (data.injectionDepth !== undefined) updateFields.injectionDepth = data.injectionDepth;
      if (data.injectionOrder !== undefined) updateFields.injectionOrder = data.injectionOrder;
      if (data.forbidOverrides !== undefined) updateFields.forbidOverrides = String(data.forbidOverrides);
      await db.update(promptSections).set(updateFields).where(eq(promptSections.id, id));
      return this.getSection(id);
    },

    async removeSection(id: string) {
      const section = await this.getSection(id);
      if (section) {
        const preset = await this.getById(section.presetId);
        if (preset) {
          const order = (JSON.parse(preset.sectionOrder as string) as string[]).filter((sid) => sid !== id);
          await this.update(section.presetId, { sectionOrder: order });
        }
      }
      await db.delete(promptSections).where(eq(promptSections.id, id));
    },

    async reorderSections(presetId: string, sectionIds: string[]) {
      await this.update(presetId, { sectionOrder: sectionIds });
      for (let i = 0; i < sectionIds.length; i++) {
        await db
          .update(promptSections)
          .set({ injectionOrder: i * 100 })
          .where(eq(promptSections.id, sectionIds[i]!));
      }
    },

    // ═══════════════════════════════════════════
    //  Choice Blocks (Preset Variables)
    // ═══════════════════════════════════════════

    async listChoiceBlocksForPreset(presetId: string) {
      return db
        .select()
        .from(choiceBlocks)
        .where(eq(choiceBlocks.presetId, presetId))
        .orderBy(asc(choiceBlocks.sortOrder));
    },

    async getChoiceBlock(id: string) {
      const rows = await db.select().from(choiceBlocks).where(eq(choiceBlocks.id, id));
      return rows[0] ?? null;
    },

    async createChoiceBlock(input: CreateChoiceBlockInput) {
      const id = newId();
      // Set sortOrder to be after existing variables
      const existing = await db.select().from(choiceBlocks).where(eq(choiceBlocks.presetId, input.presetId));
      const maxOrder = existing.reduce((max, v) => Math.max(max, v.sortOrder ?? 0), 0);
      await db.insert(choiceBlocks).values({
        id,
        presetId: input.presetId,
        variableName: input.variableName,
        question: input.question,
        options: JSON.stringify(input.options),
        multiSelect: String(input.multiSelect ?? false),
        separator: input.separator ?? ", ",
        randomPick: String(input.randomPick ?? false),
        displayMode: input.displayMode ?? "auto",
        optionSort: input.optionSort ?? "manual",
        sortOrder: maxOrder + 100,
        createdAt: now(),
      });
      const rows = await db.select().from(choiceBlocks).where(eq(choiceBlocks.id, id));
      return rows[0] ?? null;
    },

    async updateChoiceBlock(id: string, data: UpdateChoiceBlockInput) {
      const updateFields: Record<string, unknown> = {};
      if (data.variableName !== undefined) updateFields.variableName = data.variableName;
      if (data.question !== undefined) updateFields.question = data.question;
      if (data.options !== undefined) updateFields.options = JSON.stringify(data.options);
      if (data.multiSelect !== undefined) updateFields.multiSelect = String(data.multiSelect);
      if (data.separator !== undefined) updateFields.separator = data.separator;
      if (data.randomPick !== undefined) updateFields.randomPick = String(data.randomPick);
      if (data.displayMode !== undefined) updateFields.displayMode = data.displayMode;
      if (data.optionSort !== undefined) updateFields.optionSort = data.optionSort;
      await db.update(choiceBlocks).set(updateFields).where(eq(choiceBlocks.id, id));
      const rows = await db.select().from(choiceBlocks).where(eq(choiceBlocks.id, id));
      return rows[0] ?? null;
    },

    async removeChoiceBlock(id: string) {
      await db.delete(choiceBlocks).where(eq(choiceBlocks.id, id));
    },

    async reorderVariables(presetId: string, variableIds: string[]) {
      for (let i = 0; i < variableIds.length; i++) {
        await db
          .update(choiceBlocks)
          .set({ sortOrder: i * 100 })
          .where(eq(choiceBlocks.id, variableIds[i]!));
      }
    },
  };
}
