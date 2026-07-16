// ──────────────────────────────────────────────
// Seed: Marinara's Universal Prompt Preset
// Creates or refreshes Marinara's bundled universal roleplay preset.
// Reads the exported preset JSON and imports it via the standard importer.
// ──────────────────────────────────────────────
import { logger } from "../lib/logger.js";
import type { DB } from "./connection.js";
import { createPromptsStorage } from "../services/storage/prompts.storage.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { importMarinara } from "../services/import/marinara.importer.js";
import { choiceBlocks, promptGroups, promptSections } from "./schema/index.js";
import { DEFAULT_CONVERSATION_PROMPT, DEFAULT_GAME_SYSTEM_PROMPT } from "@marinara-engine/shared";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createHash } from "crypto";
import { eq } from "./file-query.js";
import { migrateLegacyDefaultConversationPromptLead } from "./default-conversation-prompt-migration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LEGACY_MARINARA_PRESET_NAME = "Default";
const MARINARA_PRESET_NAME = "Marinara's Universal Preset";
const MARINARA_PRESET_DESCRIPTION = "Marinara's universal roleplay preset. Serves as a good base.";
const MARINARA_PRESET_AUTHOR = "Marinara";
const MARINARA_PRESET_SEED_HASH_KEY = "seed:marinara-universal-preset:sha256";
const MARINARA_PRESET_SNAPSHOT_KEY = "seed:marinara-universal-preset:snapshot-sha256";

type BundledPresetEnvelope = {
  type: "marinara_preset";
  version: 1;
  exportedAt: string;
  data: {
    preset: Record<string, unknown>;
    groups?: Record<string, unknown>[];
    sections?: Record<string, unknown>[];
    choiceBlocks?: Record<string, unknown>[];
  };
};

function readBundledDefaultPreset(): { hash: string; envelope: BundledPresetEnvelope } {
  const jsonPath = join(__dirname, "default-preset.json");
  const raw = readFileSync(jsonPath, "utf-8");
  const envelope = JSON.parse(raw) as BundledPresetEnvelope;
  return {
    hash: createHash("sha256").update(raw).digest("hex"),
    envelope,
  };
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function numberField(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

function booleanField(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return fallback;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function withoutRowIdentity(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => withoutRowIdentity(item));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (["id", "presetId", "createdAt", "updatedAt", "parentGroupId", "groupId"].includes(key)) continue;
    out[key] = withoutRowIdentity(item);
  }
  return out;
}

function stableKeyMap<T extends { id?: unknown }>(rows: T[], prefix: string, getBase: (row: T) => string): Map<string, string> {
  const counts = new Map<string, number>();
  const sorted = [...rows].sort((a, b) => {
    const aBase = getBase(a);
    const bBase = getBase(b);
    if (aBase !== bBase) return aBase.localeCompare(bBase);
    return stableStringify(withoutRowIdentity(a)).localeCompare(stableStringify(withoutRowIdentity(b)));
  });
  const map = new Map<string, string>();
  for (const row of sorted) {
    if (typeof row.id !== "string") continue;
    const base = getBase(row).trim() || "unnamed";
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    map.set(row.id, `${prefix}:${base}:${count}`);
  }
  return map;
}

function orderedStableKeys(value: unknown, keyMap: Map<string, string>): string[] {
  return parseJsonField<string[]>(value, []).map((id) => keyMap.get(id)).filter((id): id is string => Boolean(id));
}

function bundledPresetDescription(envelope: BundledPresetEnvelope): string {
  return String(envelope.data.preset.description ?? MARINARA_PRESET_DESCRIPTION);
}

function bundledConversationPrompt(preset: Record<string, unknown>): string {
  return String(preset.conversationPrompt ?? preset.conversation_prompt ?? DEFAULT_CONVERSATION_PROMPT);
}

function bundledGamePrompt(preset: Record<string, unknown>): string {
  return String(preset.gamePrompt ?? preset.game_prompt ?? DEFAULT_GAME_SYSTEM_PROMPT);
}

function buildPresetSnapshot(args: {
  preset: Record<string, unknown>;
  groups: Record<string, unknown>[];
  sections: Record<string, unknown>[];
  choiceBlocks: Record<string, unknown>[];
}) {
  const { preset, groups, sections, choiceBlocks } = args;
  const groupKeyMap = stableKeyMap(groups, "group", (group) => String(group.name ?? ""));
  const sectionKeyMap = stableKeyMap(sections, "section", (section) =>
    String(section.identifier ?? section.name ?? ""),
  );
  const choiceKeyMap = stableKeyMap(choiceBlocks, "choice", (choice) => String(choice.variableName ?? ""));

  return {
    preset: {
      name: String(preset.name ?? ""),
      description: String(preset.description ?? ""),
      conversationPrompt: bundledConversationPrompt(preset),
      gamePrompt: bundledGamePrompt(preset),
      variableGroups: parseJsonField(preset.variableGroups, []),
      variableValues: parseJsonField(preset.variableValues, {}),
      parameters: parseJsonField(preset.parameters, {}),
      wrapFormat: String(preset.wrapFormat ?? "xml"),
      author: String(preset.author ?? ""),
      defaultChoices: parseJsonField(preset.defaultChoices, {}),
      sectionOrder: orderedStableKeys(preset.sectionOrder, sectionKeyMap),
      groupOrder: orderedStableKeys(preset.groupOrder, groupKeyMap),
    },
    groups: groups
      .map((group) => ({
        key: typeof group.id === "string" ? (groupKeyMap.get(group.id) ?? "") : "",
        name: String(group.name ?? ""),
        parentGroupKey:
          typeof group.parentGroupId === "string" ? (groupKeyMap.get(group.parentGroupId) ?? null) : null,
        order: numberField(group.order, 100),
        enabled: booleanField(group.enabled, true),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    sections: sections
      .map((section) => ({
        key: typeof section.id === "string" ? (sectionKeyMap.get(section.id) ?? "") : "",
        identifier: String(section.identifier ?? ""),
        name: String(section.name ?? ""),
        content: String(section.content ?? ""),
        role: String(section.role ?? "system"),
        enabled: booleanField(section.enabled, true),
        isMarker: booleanField(section.isMarker, false),
        groupKey: typeof section.groupId === "string" ? (groupKeyMap.get(section.groupId) ?? null) : null,
        markerConfig: section.markerConfig ? parseJsonField(section.markerConfig, null) : null,
        injectionPosition: String(section.injectionPosition ?? "ordered"),
        injectionDepth: numberField(section.injectionDepth, 0),
        injectionOrder: numberField(section.injectionOrder, 100),
        forbidOverrides: booleanField(section.forbidOverrides, false),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    choiceBlocks: choiceBlocks
      .map((choice) => ({
        key: typeof choice.id === "string" ? (choiceKeyMap.get(choice.id) ?? "") : "",
        variableName: String(choice.variableName ?? ""),
        question: String(choice.question ?? ""),
        options: parseJsonField(choice.options, []),
        multiSelect: booleanField(choice.multiSelect, false),
        separator: String(choice.separator ?? ", "),
        randomPick: booleanField(choice.randomPick, false),
        displayMode: String(choice.displayMode ?? "auto"),
        optionSort: String(choice.optionSort ?? "manual"),
        sortOrder: numberField(choice.sortOrder, 0),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

function computeBundledPresetSnapshotHash(envelope: BundledPresetEnvelope): string {
  const bundled = envelope.data;
  return contentHash(
    buildPresetSnapshot({
      preset: bundled.preset,
      groups: bundled.groups ?? [],
      sections: bundled.sections ?? [],
      choiceBlocks: bundled.choiceBlocks ?? [],
    }),
  );
}

async function computePresetSnapshotHash(
  storage: ReturnType<typeof createPromptsStorage>,
  presetId: string,
): Promise<string | null> {
  const preset = await storage.getById(presetId);
  if (!preset) return null;
  const groups = await storage.listGroups(presetId);
  const sections = await storage.listSections(presetId);
  const choiceBlocksForPreset = await storage.listChoiceBlocksForPreset(presetId);
  return contentHash(
    buildPresetSnapshot({
      preset,
      groups,
      sections,
      choiceBlocks: choiceBlocksForPreset,
    }),
  );
}

async function migrateExistingMarinaraConversationPrompt(
  storage: ReturnType<typeof createPromptsStorage>,
  preset: { id: string; conversationPrompt?: unknown },
  bundledPrompt: string,
): Promise<boolean> {
  const currentPrompt = typeof preset.conversationPrompt === "string" ? preset.conversationPrompt : "";
  const migratedPrompt = migrateLegacyDefaultConversationPromptLead(currentPrompt, bundledPrompt);
  if (migratedPrompt === currentPrompt) return false;
  await storage.update(preset.id, { conversationPrompt: migratedPrompt });
  return true;
}

async function applyBundledPresetToExisting(
  db: DB,
  storage: ReturnType<typeof createPromptsStorage>,
  presetId: string,
  envelope: BundledPresetEnvelope,
) {
  const bundled = envelope.data;
  const preset = bundled.preset;

  await storage.update(presetId, {
    name: String(preset.name ?? MARINARA_PRESET_NAME),
    description: String(preset.description ?? MARINARA_PRESET_DESCRIPTION),
    conversationPrompt: bundledConversationPrompt(preset),
    gamePrompt: bundledGamePrompt(preset),
    variableGroups: parseJsonField(preset.variableGroups, []),
    variableValues: parseJsonField(preset.variableValues, {}),
    parameters: parseJsonField(preset.parameters, {}),
    wrapFormat: (preset.wrapFormat as "xml" | "markdown" | "none" | undefined) ?? "xml",
    author: String(preset.author ?? MARINARA_PRESET_AUTHOR),
    defaultChoices: parseJsonField(preset.defaultChoices, {}),
  });

  await db.delete(choiceBlocks).where(eq(choiceBlocks.presetId, presetId));
  await db.delete(promptSections).where(eq(promptSections.presetId, presetId));
  await db.delete(promptGroups).where(eq(promptGroups.presetId, presetId));

  const groupMap = new Map<string, string>();
  for (const group of bundled.groups ?? []) {
    const newGroup = await storage.createGroup({
      presetId,
      name: String(group.name ?? ""),
      parentGroupId: null,
      order: numberField(group.order, 100),
      enabled: group.enabled === true || group.enabled === "true",
    });
    if (newGroup) groupMap.set(String(group.id), newGroup.id);
  }

  for (const group of bundled.groups ?? []) {
    if (!group.parentGroupId || !groupMap.has(String(group.parentGroupId))) continue;
    const newGroupId = groupMap.get(String(group.id));
    if (!newGroupId) continue;
    await storage.updateGroup(newGroupId, {
      parentGroupId: groupMap.get(String(group.parentGroupId))!,
    });
  }

  const sectionMap = new Map<string, string>();
  for (const section of bundled.sections ?? []) {
    const newSection = await storage.createSection({
      presetId,
      identifier: String(section.identifier ?? ""),
      name: String(section.name ?? ""),
      content: String(section.content ?? ""),
      role: (section.role as "system" | "user" | "assistant" | undefined) ?? "system",
      enabled: section.enabled === true || section.enabled === "true",
      isMarker: section.isMarker === true || section.isMarker === "true",
      groupId: section.groupId ? (groupMap.get(String(section.groupId)) ?? null) : null,
      markerConfig: section.markerConfig ? parseJsonField(section.markerConfig, null) : null,
      injectionPosition: (section.injectionPosition as "ordered" | "depth" | undefined) ?? "ordered",
      injectionDepth: numberField(section.injectionDepth, 0),
      injectionOrder: numberField(section.injectionOrder, 100),
      forbidOverrides: section.forbidOverrides === true || section.forbidOverrides === "true",
    });
    if (newSection) sectionMap.set(String(section.id), newSection.id);
  }

  for (const choice of bundled.choiceBlocks ?? []) {
    await storage.createChoiceBlock({
      presetId,
      variableName: String(choice.variableName ?? ""),
      question: String(choice.question ?? ""),
      options: parseJsonField(choice.options, []),
      multiSelect: choice.multiSelect === true || choice.multiSelect === "true",
      separator: String(choice.separator ?? ", "),
      randomPick: choice.randomPick === true || choice.randomPick === "true",
      displayMode: choice.displayMode === "buttons" || choice.displayMode === "listbox" ? choice.displayMode : "auto",
      optionSort: choice.optionSort === "alphabetical" ? "alphabetical" : "manual",
    });
  }

  await storage.update(presetId, {
    sectionOrder: parseJsonField<string[]>(preset.sectionOrder, [])
      .map((sectionId) => sectionMap.get(sectionId))
      .filter((sectionId): sectionId is string => Boolean(sectionId)),
    groupOrder: parseJsonField<string[]>(preset.groupOrder, [])
      .map((groupId) => groupMap.get(groupId))
      .filter((groupId): groupId is string => Boolean(groupId)),
  });
}

// ─────────────────────────────────────────────
//  Main seed function
// ─────────────────────────────────────────────
export async function seedDefaultPreset(db: DB) {
  const storage = createPromptsStorage(db);
  const appSettings = createAppSettingsStorage(db);
  const bundled = readBundledDefaultPreset();

  const existing = await storage.list();
  const existingMarinaraPreset =
    existing.find(
      (preset) =>
        preset.name === MARINARA_PRESET_NAME && preset.author === MARINARA_PRESET_AUTHOR && preset.isDefault === "true",
    ) ??
    existing.find((preset) => preset.name === MARINARA_PRESET_NAME && preset.author === MARINARA_PRESET_AUTHOR) ??
    existing.find(
      (preset) => preset.name === LEGACY_MARINARA_PRESET_NAME && preset.author === MARINARA_PRESET_AUTHOR,
    );

  const appliedHash = await appSettings.get(MARINARA_PRESET_SEED_HASH_KEY);
  const appliedSnapshotHash = await appSettings.get(MARINARA_PRESET_SNAPSHOT_KEY);
  const bundledConversationPromptValue = bundledConversationPrompt(bundled.envelope.data.preset);
  if (existingMarinaraPreset && appliedHash !== bundled.hash) {
    if (!appliedSnapshotHash) {
      const migratedConversationPrompt = await migrateExistingMarinaraConversationPrompt(
        storage,
        existingMarinaraPreset,
        bundledConversationPromptValue,
      );
      await appSettings.set(MARINARA_PRESET_SEED_HASH_KEY, bundled.hash);
      await appSettings.set(MARINARA_PRESET_SNAPSHOT_KEY, computeBundledPresetSnapshotHash(bundled.envelope));
      logger.info(
        "[seed] Preserved existing Marinara universal preset without prior snapshot while recording bundled hash %s",
        bundled.hash.slice(0, 12),
      );
      if (migratedConversationPrompt) {
        logger.info("[seed] Updated the legacy Marinara Conversation prompt lead sentence");
      }
      return;
    }

    const currentSnapshotHash = await computePresetSnapshotHash(storage, existingMarinaraPreset.id);
    if (currentSnapshotHash && currentSnapshotHash !== appliedSnapshotHash) {
      const migratedConversationPrompt = await migrateExistingMarinaraConversationPrompt(
        storage,
        existingMarinaraPreset,
        bundledConversationPromptValue,
      );
      await appSettings.set(MARINARA_PRESET_SEED_HASH_KEY, bundled.hash);
      logger.info(
        "[seed] Preserved customized Marinara universal preset while recording bundled hash %s",
        bundled.hash.slice(0, 12),
      );
      if (migratedConversationPrompt) {
        logger.info("[seed] Updated the legacy Marinara Conversation prompt lead sentence");
      }
      return;
    }

    const wasDefault = existingMarinaraPreset.isDefault === "true";
    await applyBundledPresetToExisting(db, storage, existingMarinaraPreset.id, bundled.envelope);
    if (wasDefault) await storage.setDefault(existingMarinaraPreset.id);
    await appSettings.set(MARINARA_PRESET_SEED_HASH_KEY, bundled.hash);
    const nextSnapshotHash = await computePresetSnapshotHash(storage, existingMarinaraPreset.id);
    if (nextSnapshotHash) await appSettings.set(MARINARA_PRESET_SNAPSHOT_KEY, nextSnapshotHash);
    logger.info("[seed] Updated bundled Marinara universal preset to %s", bundled.hash.slice(0, 12));
    return;
  }

  if (
    existingMarinaraPreset &&
    (await migrateExistingMarinaraConversationPrompt(
      storage,
      existingMarinaraPreset,
      bundledConversationPromptValue,
    ))
  ) {
    logger.info("[seed] Updated the legacy Marinara Conversation prompt lead sentence");
  }

  if (existingMarinaraPreset && !appliedSnapshotHash) {
    await appSettings.set(MARINARA_PRESET_SNAPSHOT_KEY, computeBundledPresetSnapshotHash(bundled.envelope));
  }

  // Older builds named the bundled preset "Default"; keep the display name tidy
  // even when its bundled body already matches the current seed hash.
  const legacyMarinaraPreset = existing.find(
    (preset) => preset.name === LEGACY_MARINARA_PRESET_NAME && preset.author === MARINARA_PRESET_AUTHOR,
  );
  if (legacyMarinaraPreset) {
    await storage.update(legacyMarinaraPreset.id, {
      name: MARINARA_PRESET_NAME,
      description: bundledPresetDescription(bundled.envelope),
    });
  }

  // Skip if any preset already exists (user may have deleted or changed defaults)
  if (existing.length > 0) return;

  // Import using the standard importer
  const result = await importMarinara(bundled.envelope, db);
  if (!result.success || result.type !== "marinara_preset") {
    logger.error("[seed] Failed to import default preset: %j", result);
    return;
  }

  // Set as default + apply default variable selections
  const presetId = (result as { id: string }).id;
  await storage.setDefault(presetId);
  await storage.update(presetId, {
    conversationPrompt: bundledConversationPrompt(bundled.envelope.data.preset),
    gamePrompt: bundledGamePrompt(bundled.envelope.data.preset),
    defaultChoices: parseJsonField(bundled.envelope.data.preset.defaultChoices, {}),
  });
  await appSettings.set(MARINARA_PRESET_SEED_HASH_KEY, bundled.hash);
  const seededSnapshotHash = await computePresetSnapshotHash(storage, presetId);
  if (seededSnapshotHash) await appSettings.set(MARINARA_PRESET_SNAPSHOT_KEY, seededSnapshotHash);
}
