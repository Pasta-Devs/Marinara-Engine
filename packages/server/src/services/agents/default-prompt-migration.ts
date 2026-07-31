import { createHash } from "node:crypto";
import { eq } from "../../db/file-query.js";
import {
  BUILT_IN_AGENTS,
  DEFAULT_AGENT_PROMPT_TEMPLATE_ID,
  getDefaultAgentPrompt,
  getDefaultBuiltInAgentSettings,
  normalizeAgentPhaseForType,
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
  html: [
    "2a0e9739c529c39dd5b9e879b3eed9f05f8dec0f0f46319b6fd159515079dec0",
    "4675d053812349b7500998044af68f319dc6a947ba047614a07e83fab4a87bf6",
  ],
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

const LEGACY_BUILT_IN_AGENT_DESCRIPTIONS: Record<string, readonly string[]> = {
  html: [
    "Adds immersive HTML/CSS/JS formatting instructions to the last Roleplay user prompt without running a separate agent call.",
  ],
};

const LEGACY_BUILT_IN_NAMED_PROMPT_HASHES: Record<string, Record<string, readonly string[]>> = {
  storyboard: {
    "still-keyframes": [
      "35f010080454700cf509a5ec07636e75e812c594f33c4c58e5c5b72e8de64d4d",
      "b0d88c61750da6e72b4fee4322f10e6cc13ddcb71ee649c96f325f586fb69cb3",
    ],
    "novelai-keyframes": [
      "d023603b074be76aa5319666bd7fe763c0a3e874738ee0a455545804e93baa3a",
      "ea7dbd0b93c324d8dcabc5e32bf6fa4692837b2b4088ccdaf4069d17a2cf8bf0",
    ],
    "comic-page-keyframes": [
      "45bb3de5cd09ce7d695e05220ac156589bee602c570fe17f8560044ab31b945d",
      "c7cc9821f58dccb86daf0bd273e450a1abca66905f2cc1a6a171889517c618e5",
    ],
    "colored-manga-keyframes": [
      "da11bd4cc1205dc20a8939d263d4d89a144760edca11fa86ace2e97aaf4a5683",
      "17670d62e1e1a9b9dfdfee6b8cf48cf2404bc4987968dc0018f692ac4e3b8005",
    ],
    "bw-manga-keyframes": [
      "a5bd8a39e287bc19ef269e73e4dd8bdf4b945e34dccae86d3cf63076ae744668",
      "b92692c69b25f03efa223eec2ed12ae04007fb81b072819f29986ee624582226",
    ],
    "still-keyframes-animation": [
      "d7625e2dd230dda9fac625653de8f9fa7e95d631a5f7ded9eaf7981322b9d69b",
      "a57cc45d9c4c687f08f2ac640c48cb1da6111d5356fe5b0484aa0e8e9afd1b9a",
    ],
    "anime-episode-director": [
      "a63e7679b525d801776fed8bda108da63c9850b8f551e19f2a2d8bb8c91f8849",
      "0d6427988423bbbe54ceadf372ab72073708afc3574b0fb0c466dd296bf42ffe",
    ],
    "novelai-keyframes-animation": [
      "22968ccd5d14f6ff548ee9ff7b6e6afa20a2e6fe15b7822feb4486400e8949a1",
      "875602ed9b24d94b40f15fe9ab014bd63d5529fc710cc86b35b11c16abcb9f8d",
    ],
    "comic-page-animation": [
      "8818b2004dd4967710eeec8ab95cfff01fc65a8f6428f5b3c5f8894abd604284",
      "dc3f1a54da90ab67559778d1819a449252e83cca37f206df56b558fef7762954",
    ],
    "colored-manga-keyframes-animation": [
      "4134c0e0b365aabb5027f33883a7f1d1593774d997ce007159ffdb8708b3b285",
      "d68badeac6e84cd0e13fc4f0c8b00242c0ebb069381aa4b8ec740599ece29ec3",
    ],
    "bw-manga-keyframes-animation": [
      "bbe2fafc87395af962176f95fdc4e95067ab9c0f7db7883915c979bcf856b285",
      "e85bb980a176d9b2db2233abb64433daf103ba10e20cbd763a237f11fc225e41",
    ],
    "ltx-director-storyboard": [
      "e2b231eef33ca21d7b183974577ee476fb72acdbde2d0012c8218b130893893e",
      "1b39a315d41417576f09cc111d5afbcacdad30490aad90bfea8681af392cd3d8",
    ],
    "ltx-simple-image-to-video": [
      "d56bf37473e124e399fd6e2fa93835391ef0986a41e7bfcc65972e02e475b185",
      "72aecd237bf417fbb7809f6cdf4a67101f080fb9b70c4ef248b77ac0d2ae12cf",
    ],
  },
};

const ILLUSTRATOR_DEFAULT_PROMPT_TEMPLATE_MIGRATION_VERSION = 2;

function normalizedPromptHash(value: string): string {
  return createHash("sha256").update(value.trim().replace(/\r\n/g, "\n")).digest("hex");
}

function normalizedText(value: string): string {
  return value.trim().replace(/\r\n/g, "\n");
}

function defaultPromptHashes(agentType: string, currentDefault?: string): Set<string> {
  const hashes = new Set(LEGACY_V1_DEFAULT_AGENT_PROMPT_HASHES[agentType] ?? []);
  const current = currentDefault ?? getDefaultAgentPrompt(agentType);
  if (current?.trim()) hashes.add(normalizedPromptHash(current));
  return hashes;
}

function isKnownDefaultPrompt(agentType: string, prompt: string, currentDefault?: string): boolean {
  if (!prompt.trim()) return false;
  return defaultPromptHashes(agentType, currentDefault).has(normalizedPromptHash(prompt));
}

function isKnownDefaultNamedPrompt(
  agentType: string,
  optionId: string,
  prompt: string,
  currentDefault: string,
): boolean {
  if (isKnownDefaultPrompt(agentType, prompt, currentDefault)) return true;
  const promptHash = normalizedPromptHash(prompt);
  return (LEGACY_BUILT_IN_NAMED_PROMPT_HASHES[agentType]?.[optionId] ?? []).includes(promptHash);
}

function isKnownDefaultDescription(agentType: string, description: string, currentDescription: string): boolean {
  const normalized = normalizedText(description);
  if (!normalized) return true;
  if (normalized === normalizedText(currentDescription)) return true;
  return (LEGACY_BUILT_IN_AGENT_DESCRIPTIONS[agentType] ?? []).some((legacy) => normalized === normalizedText(legacy));
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
  const promptTemplates = savedOptions.flatMap((option) => {
    const defaultOption = defaultOptions.get(option.id);
    if (!defaultOption) {
      if (isKnownDefaultPrompt(agentType, option.promptTemplate)) {
        changed = true;
        return [];
      }
      return [option];
    }
    if (!isKnownDefaultNamedPrompt(agentType, option.id, option.promptTemplate, defaultOption.promptTemplate)) {
      return option;
    }
    if (option.promptTemplate === defaultOption.promptTemplate) return option;
    changed = true;
    return [{ ...defaultOption, ...option, promptTemplate: defaultOption.promptTemplate }];
  });

  if (!changed) return { settings: parsed, changed: false };
  return { settings: { ...parsed, promptTemplates }, changed: true };
}

export function buildLegacyDefaultAgentConfigUpdate(row: typeof agentConfigs.$inferSelect) {
  const update: Partial<typeof agentConfigs.$inferInsert> = {};
  const hasKnownDefaultPrompt = isKnownDefaultPrompt(row.type, row.promptTemplate);
  if (hasKnownDefaultPrompt) {
    update.promptTemplate = "";
  }

  const settingsMigration = migratePromptTemplateOptions(row.type, row.settings);
  let settings = settingsMigration.settings;

  const builtIn = BUILT_IN_AGENTS.find((agent) => agent.id === row.type);
  if (builtIn) {
    const hasKnownDefaultDescription = isKnownDefaultDescription(row.type, row.description, builtIn.description);
    if (hasKnownDefaultDescription) {
      update.description = builtIn.description;
    }

    const normalizedStoredPhase = normalizeAgentPhaseForType(row.type, row.phase);
    if (row.phase !== normalizedStoredPhase) update.phase = normalizedStoredPhase;
    if (row.type === "html" && hasKnownDefaultPrompt && hasKnownDefaultDescription && row.phase !== builtIn.phase) {
      update.phase = builtIn.phase;
    }

    const defaults = getDefaultBuiltInAgentSettings(builtIn.id);
    let settingsChanged = settingsMigration.changed;
    // A staging release accidentally persisted Background as Illustrator's global
    // default. Repair it once; the marker prevents later explicit user choices
    // from being overwritten on every startup. Per-chat selections live in chat
    // metadata and are intentionally unaffected.
    if (
      row.type === "illustrator" &&
      settings.illustratorDefaultPromptTemplateMigrationVersion !==
        ILLUSTRATOR_DEFAULT_PROMPT_TEMPLATE_MIGRATION_VERSION
    ) {
      settings = {
        ...settings,
        ...(settings.defaultPromptTemplateId === "background"
          ? { defaultPromptTemplateId: DEFAULT_AGENT_PROMPT_TEMPLATE_ID }
          : {}),
        illustratorDefaultPromptTemplateMigrationVersion: ILLUSTRATOR_DEFAULT_PROMPT_TEMPLATE_MIGRATION_VERSION,
      };
      settingsChanged = true;
    }
    // Existing configs with a custom raw prompt remain on the legacy Default
    // option unless the user selects another named prompt mode.
    if (
      row.type === "illustrator" &&
      row.promptTemplate.trim() &&
      !hasKnownDefaultPrompt &&
      settings.defaultPromptTemplateId === undefined
    ) {
      settings = { ...settings, defaultPromptTemplateId: DEFAULT_AGENT_PROMPT_TEMPLATE_ID };
      settingsChanged = true;
    }
    for (const [key, value] of Object.entries(defaults)) {
      if (key === "promptTemplates") continue;
      if (key === "resultType") {
        if (settings[key] !== value) {
          settings = { ...settings, [key]: value };
          settingsChanged = true;
        }
        continue;
      }
      if (settings[key] === undefined) {
        settings = { ...settings, [key]: value };
        settingsChanged = true;
      }
    }

    if (settingsChanged) update.settings = JSON.stringify(settings);
  } else if (settingsMigration.changed) {
    update.settings = JSON.stringify(settings);
  }

  return update;
}

export async function migrateLegacyDefaultAgentPrompts(db: DB) {
  const rows = await db.select().from(agentConfigs);
  let migratedPromptTemplates = 0;
  let migratedPromptTemplateOptions = 0;

  for (const row of rows) {
    const update = buildLegacyDefaultAgentConfigUpdate(row);
    if (update.promptTemplate !== undefined) {
      migratedPromptTemplates += 1;
    }

    if (update.settings !== undefined) {
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
