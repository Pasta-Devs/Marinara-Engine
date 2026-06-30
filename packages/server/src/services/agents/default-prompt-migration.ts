import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  DEFAULT_AGENT_PROMPTS,
  getDefaultBuiltInAgentSettings,
  normalizeAgentPromptTemplateOptions,
  parseAgentSettingsRecord,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { agentConfigs } from "../../db/schema/index.js";
import { logger } from "../../lib/logger.js";

const LEGACY_V1_DEFAULT_AGENT_PROMPT_HASHES: Record<string, readonly string[]> = {
  background: ["9f4fd2708eb348513e6b2b95587489cd979a7dc4b75f123954ec8b099db8851e"],
  "card-evolution-auditor": ["072541f4141f847d8cf2baa6f72453ce246bd5c740c79cb542608a919e67b47f"],
  "character-tracker": ["218f705897344e1e80e1fe46ea7141e73d49a82a7c67d503dd2d52c5b7582fad"],
  combat: ["f87d476689f057e3734122fc82b8d6b0242c3a2ce10c7ffb2a9433507483cfa8"],
  continuity: ["dc641e82eeb0829f486e99251b238ec22abb909e96f76d6f85b89bf2693fc709"],
  "custom-tracker": ["1aee6c869521f11de7ca095bf1b1eaf6292edce863e2e8400fe2f9091025df30"],
  cyoa: ["bea961d2292f945599fd16ff3a5860c40f86bd2277e5c65787c13eda5b568b36"],
  director: ["644db63004a6cf58e747b2ca762084100789e8d5c0b29a3f1bdb1fec40ca4419"],
  "echo-chamber": ["ffaedffd762de790445333550a22319daee5be6176c03dfee772dda37636191e"],
  expression: ["a0dae5ce04e79b55bcb95e375e65d1bbbbdcf36df4c2882635053a4a25e37d2e"],
  haptic: ["b859e11b47cfaf71addf1098d89f220e463eae709e74c7a11351a4647034a26f"],
  html: ["2a0e9739c529c39dd5b9e879b3eed9f05f8dec0f0f46319b6fd159515079dec0"],
  illustrator: ["4ea814bcf6c4037faa2431e7163bb889f74736400e708bb817497899b3a8c117"],
  "knowledge-retrieval": ["4fa6d82e162c5c6249e726d618b5a4dfb04f51166ee9a06a5a82c7b1e8fe6e16"],
  "knowledge-router": ["c9c06d85a9966b8d4391542a5e41faee743e02723f0f239780a6c1c2ee2d29be"],
  "lorebook-keeper": ["fcadcc038895e3afaf9fa421decdfbbd4cac883d2c1212b14e2ba1fa26adffed"],
  "persona-stats": ["1231c0c952de1dbb031756f371c89467d3a2ef53f7aaa126247ec34b74b118e5"],
  "prose-guardian": ["8cf9672b67ded7204efc3ffd4ab31ad3796896b0cadb2191fe6d0a728129956b"],
  quest: ["74ed682013c1b99742e184fdb6df5f7d6ba8bfc9d6fb52f809d5e9b0ac86645b"],
  spotify: ["228be333d2af8de652cf868cb033f9d2091bc991ec9f316f7e8115b438386581"],
  "world-state": ["08e275fbcf15de0bc7962ff0f950f0635381af8dca5aeab83e1c928ce2010512"],
};

function normalizedPromptHash(value: string): string {
  return createHash("sha256").update(value.trim().replace(/\r\n/g, "\n")).digest("hex");
}

function defaultPromptHashes(agentType: string, currentDefault?: string): Set<string> {
  const hashes = new Set(LEGACY_V1_DEFAULT_AGENT_PROMPT_HASHES[agentType] ?? []);
  const current = currentDefault ?? DEFAULT_AGENT_PROMPTS[agentType];
  if (current?.trim()) hashes.add(normalizedPromptHash(current));
  return hashes;
}

function isKnownDefaultPrompt(agentType: string, prompt: string, currentDefault?: string): boolean {
  if (!prompt.trim()) return false;
  return defaultPromptHashes(agentType, currentDefault).has(normalizedPromptHash(prompt));
}

function migratePromptTemplateOptions(agentType: string, settings: unknown) {
  const parsed = parseAgentSettingsRecord(settings);
  const savedOptions = normalizeAgentPromptTemplateOptions(parsed.promptTemplates);
  if (savedOptions.length === 0) return { settings: parsed, changed: false };

  const defaultSettings = getDefaultBuiltInAgentSettings(agentType);
  const defaultOptions = new Map(
    normalizeAgentPromptTemplateOptions(defaultSettings.promptTemplates).map((option) => [option.id, option]),
  );
  let changed = false;
  const promptTemplates = savedOptions.map((option) => {
    const defaultOption = defaultOptions.get(option.id);
    if (!defaultOption) return option;
    if (!isKnownDefaultPrompt(agentType, option.promptTemplate, defaultOption.promptTemplate)) return option;
    changed = true;
    return { ...option, promptTemplate: defaultOption.promptTemplate };
  });

  if (!changed) return { settings: parsed, changed: false };
  return { settings: { ...parsed, promptTemplates }, changed: true };
}

export async function migrateLegacyDefaultAgentPrompts(db: DB) {
  const rows = await db.select().from(agentConfigs);
  let migratedPromptTemplates = 0;
  let migratedPromptTemplateOptions = 0;

  for (const row of rows) {
    const update: Partial<typeof agentConfigs.$inferInsert> = {};
    if (isKnownDefaultPrompt(row.type, row.promptTemplate)) {
      update.promptTemplate = "";
      migratedPromptTemplates += 1;
    }

    const settingsMigration = migratePromptTemplateOptions(row.type, row.settings);
    if (settingsMigration.changed) {
      update.settings = JSON.stringify(settingsMigration.settings);
      migratedPromptTemplateOptions += 1;
    }

    if (Object.keys(update).length > 0) {
      await db.update(agentConfigs).set(update).where(eq(agentConfigs.id, row.id));
    }
  }

  if (migratedPromptTemplates > 0 || migratedPromptTemplateOptions > 0) {
    logger.info(
      "[migration] Agent default prompts migrated: %d prompt templates, %d named options",
      migratedPromptTemplates,
      migratedPromptTemplateOptions,
    );
  }
}
