// Sharing a game setup: the share text and file, reading a shared file back, and what an import keeps or refuses.
import assert from "node:assert/strict";
import {
  buildGameSetupShareFile,
  formatGameSetupShareText,
  parseGameSetupShareFileJson,
  resolveGameSetupImport,
  type GameSetupShareSource,
} from "../../../packages/client/src/lib/game-setup-share.js";

const sharedGameSetupSource: GameSetupShareSource = {
  gameName: "Tower Run",
  config: {
    genre: "Fantasy, anime JRPG dungeon crawler",
    setting: "A city built around a shifting dungeon tower",
    tone: "Heroic, dark, comedic",
    difficulty: "normal",
    combatStyle: "tactical",
    spatialMapInstructions: "Build a shifting tower with a market ward and flooded catacombs.",
    gameWorldMapMode: "hierarchical",
    spatialMapDraftSize: "large",
    spatialMapTargetLocationCount: 10,
    spatialMapGroundingMode: "lore_expand",
    rating: "nsfw",
    playerGoals: "Become an elite dungeon conqueror",
    gmMode: "standalone",
    partyCharacterIds: ["character-local-id"],
    personaId: "persona-local-id",
    activeLorebookIds: ["lorebook-local-id"],
    artStylePrompt: "Painterly cel-shaded fantasy",
    generatedArtStylePrompt: "Original painterly cel-shaded fantasy",
    useCampaignArtStyle: false,
    imageStyleProfileId: "image-style-profile-local-id",
    enableAgents: true,
    enableQuickTimeEvents: false,
    enableSpriteGeneration: true,
    imageConnectionId: "image-connection-local-id",
    videoConnectionId: "video-connection-local-id",
    gameStoryboardAutoIllustrationsEnabled: true,
    gameStoryboardAutoGenerationEnabled: true,
    gameStoryboardKeyframeCount: 3,
    gameGmPromptTemplateId: "anime-game-prompt",
    gameStoryboardAnimationPromptTemplateId: "comic-page-animation",
    gameStoryboardVideoPromptTemplateId: "comic-page-game-video",
    enableLorebookKeeper: true,
    customHudWidgets: [
      {
        id: "widget-local-id",
        type: "progress_bar",
        label: "Tower progress",
        position: "hud_right",
        config: { startingValue: 3, max: 100 },
      },
    ],
    generationParameters: { temperature: 0.7 },
    gameSystemPrompt: "Keep each turn visually filmable.",
  },
  effectiveGenerationParameters: {
    temperature: 1.1,
    maxTokens: 16384,
    maxContext: 128000,
    reasoningEffort: "high",
    customParameters: { example_flag: true },
    stopSequences: ["[END]"],
  },
  preferences: "Use clear progression and frequent loot rewards.",
  connections: {
    gm: { name: "ChatGPT Subscription", provider: "openai_chatgpt", model: "gpt-5.6-sol" },
    image: { name: "Image Generator", provider: "image_generation", model: "banana-2-lite" },
    video: { name: "Video Generator", provider: "video_generation", service: "gemini-omni" },
  },
  labels: {
    characterNames: { "character-local-id": "Party Member" },
    lorebookNames: { "lorebook-local-id": "Dungeon Lore" },
    personaName: "Player Persona",
  },
};
const sharedGameSetup = formatGameSetupShareText(sharedGameSetupSource);
assert.match(sharedGameSetup, /Presentation: Storyboard Optimized/u);
assert.match(sharedGameSetup, /Temperature: 1\.1/u);
assert.match(sharedGameSetup, /Max Tokens: 16384/u);
assert.match(sharedGameSetup, /gpt-5\.6-sol/iu);
assert.match(sharedGameSetup, /Use clear progression and frequent loot rewards/u);
assert.match(sharedGameSetup, /Dungeon Lore/u);
assert.match(sharedGameSetup, /Combat style: Tactical/u);
assert.match(sharedGameSetup, /Quick Time Events: Off/u);
assert.match(sharedGameSetup, /Build a shifting tower with a market ward and flooded catacombs\./u);
assert.match(sharedGameSetup, /World map size: Medium/u);
assert.match(sharedGameSetup, /World map place target: 10/u);
assert.match(sharedGameSetup, /World map build from: Lore \+ AI/u);
assert.match(sharedGameSetup, /"startingValue": 3/u);
assert.doesNotMatch(
  sharedGameSetup,
  /character-local-id|persona-local-id|connection-local-id|lorebook-local-id|profile-local-id|widget-local-id/u,
);
const exportedGameSetup = buildGameSetupShareFile(sharedGameSetupSource, "2026-07-16T12:00:00.000Z");
const parsedGameSetup = parseGameSetupShareFileJson(JSON.stringify(exportedGameSetup));
const resolvedGameSetup = resolveGameSetupImport(parsedGameSetup, {
  characters: [{ id: "character-new-id", name: "Party Member" }],
  personas: [{ id: "persona-new-id", name: "Player Persona" }],
  lorebooks: [{ id: "lorebook-new-id", name: "Dungeon Lore" }],
  promptPresets: [],
  connections: [
    {
      id: "gm-connection-new-id",
      name: "ChatGPT Subscription",
      provider: "openai_chatgpt",
      model: "gpt-5.6-sol",
    },
    {
      id: "image-connection-new-id",
      name: "Image Generator",
      provider: "image_generation",
      model: "banana-2-lite",
    },
    {
      id: "video-connection-new-id",
      name: "Video Generator",
      provider: "video_generation",
      videoService: "gemini-omni",
    },
  ],
});
assert.equal(exportedGameSetup.format, "marinara-game-setup");
assert.equal(exportedGameSetup.version, 1);
assert.equal(exportedGameSetup.exportedAt, "2026-07-16T12:00:00.000Z");
assert.equal(resolvedGameSetup.config.enableAgents, true);
assert.equal(resolvedGameSetup.config.enableQuickTimeEvents, false);
assert.equal(parsedGameSetup.setup.effectiveGenerationParameters?.temperature, 1.1);
assert.equal(parsedGameSetup.setup.effectiveGenerationParameters?.maxContext, 128000);
assert.deepEqual(parsedGameSetup.setup.effectiveGenerationParameters?.stopSequences, ["[END]"]);
assert.equal(resolvedGameSetup.config.combatStyle, "tactical");
assert.equal(
  resolvedGameSetup.config.spatialMapInstructions,
  "Build a shifting tower with a market ward and flooded catacombs.",
);
assert.equal(resolvedGameSetup.config.spatialMapDraftSize, "medium");
assert.equal(resolvedGameSetup.config.spatialMapTargetLocationCount, 10);
assert.equal(resolvedGameSetup.config.spatialMapGroundingMode, "lore_expand");
assert.equal(resolvedGameSetup.gmConnectionId, "gm-connection-new-id");
assert.equal(resolvedGameSetup.config.imageConnectionId, "image-connection-new-id");
assert.equal(resolvedGameSetup.config.videoConnectionId, "video-connection-new-id");
assert.deepEqual(resolvedGameSetup.config.partyCharacterIds, ["character-new-id"]);
assert.equal(resolvedGameSetup.config.personaId, "persona-new-id");
assert.deepEqual(resolvedGameSetup.config.activeLorebookIds, ["lorebook-new-id"]);
assert.equal(resolvedGameSetup.config.artStylePrompt, "Painterly cel-shaded fantasy");
assert.equal(resolvedGameSetup.config.generatedArtStylePrompt, "Original painterly cel-shaded fantasy");
assert.equal(resolvedGameSetup.config.useCampaignArtStyle, false);
assert.equal(resolvedGameSetup.config.imageStyleProfileId, "image-style-profile-local-id");
assert.equal(resolvedGameSetup.preferences, "Use clear progression and frequent loot rewards.");
assert.deepEqual(resolvedGameSetup.warnings, []);
assert.doesNotMatch(JSON.stringify(exportedGameSetup), /apiKey|baseUrl/u);
const unresolvedGameSetup = resolveGameSetupImport(parsedGameSetup, {
  characters: [],
  personas: [],
  lorebooks: [],
  promptPresets: [],
  connections: [],
});
assert.equal(unresolvedGameSetup.gmConnectionId, null);
assert.deepEqual(unresolvedGameSetup.config.partyCharacterIds, []);
assert.equal(unresolvedGameSetup.config.personaId, null);
assert.deepEqual(unresolvedGameSetup.config.activeLorebookIds, []);
assert.equal(unresolvedGameSetup.config.spatialMapGroundingMode, "setup");
assert.ok(unresolvedGameSetup.warnings.some((warning) => /World map[\s\S]*Game setup/u.test(warning)));
assert.ok(unresolvedGameSetup.warnings.length >= 5);
for (const [size, targetLocationCount] of [
  ["small", 8],
  ["medium", 16],
  ["large", 28],
] as const) {
  const presetMapSetup = parseGameSetupShareFileJson(
    JSON.stringify(
      buildGameSetupShareFile({
        ...sharedGameSetupSource,
        config: {
          ...sharedGameSetupSource.config,
          spatialMapDraftSize: size,
          spatialMapTargetLocationCount: undefined,
        },
      }),
    ),
  );
  assert.equal(presetMapSetup.setup.config.spatialMapDraftSize, size);
  assert.equal(presetMapSetup.setup.config.spatialMapTargetLocationCount, targetLocationCount);
}
for (const groundingMode of ["setup", "lore_strict", "lore_expand"] as const) {
  const groundedMapSetup = parseGameSetupShareFileJson(
    JSON.stringify({
      ...exportedGameSetup,
      setup: {
        ...exportedGameSetup.setup,
        config: { ...exportedGameSetup.setup.config, spatialMapGroundingMode: groundingMode },
      },
    }),
  );
  assert.equal(groundedMapSetup.setup.config.spatialMapGroundingMode, groundingMode);
}
const providerOnlyGameSetup = resolveGameSetupImport(parsedGameSetup, {
  characters: [],
  personas: [],
  lorebooks: [],
  promptPresets: [],
  connections: [
    {
      id: "wrong-name-same-provider",
      name: "Different OpenAI Connection",
      provider: "openai_chatgpt",
      model: "gpt-5.6-sol",
    },
  ],
});
assert.equal(providerOnlyGameSetup.gmConnectionId, null);
assert.throws(() => parseGameSetupShareFileJson(sharedGameSetup), /Choose a reusable Game Mode setup JSON file/u);
assert.throws(
  () => parseGameSetupShareFileJson(JSON.stringify({ ...exportedGameSetup, version: 99 })),
  /unsupported version 99/u,
);
assert.throws(
  () => parseGameSetupShareFileJson(JSON.stringify({ format: "other", version: 1 })),
  /not a Marinara Game Mode setup file/u,
);
assert.throws(
  () =>
    parseGameSetupShareFileJson(
      JSON.stringify({
        ...exportedGameSetup,
        setup: {
          ...exportedGameSetup.setup,
          config: { ...exportedGameSetup.setup.config, enableAgents: "yes" },
        },
      }),
    ),
  /invalid Enable Agents value/u,
);
assert.throws(
  () =>
    parseGameSetupShareFileJson(
      JSON.stringify({
        ...exportedGameSetup,
        setup: {
          ...exportedGameSetup.setup,
          config: { ...exportedGameSetup.setup.config, spatialMapInstructions: "x".repeat(4_001) },
        },
      }),
    ),
  /invalid Spatial Map Instructions value/u,
);
for (const invalidConfig of [
  { spatialMapDraftSize: "enormous" },
  { spatialMapTargetLocationCount: 0 },
  { spatialMapTargetLocationCount: 41 },
  { spatialMapTargetLocationCount: 10.5 },
  { spatialMapGroundingMode: "internet" },
]) {
  assert.throws(
    () =>
      parseGameSetupShareFileJson(
        JSON.stringify({
          ...exportedGameSetup,
          setup: {
            ...exportedGameSetup.setup,
            config: { ...exportedGameSetup.setup.config, ...invalidConfig },
          },
        }),
      ),
    /invalid (Spatial Map Draft Size|Spatial Map Target Location Count|Spatial Map Grounding Mode) value/u,
  );
}
assert.throws(
  () =>
    parseGameSetupShareFileJson(
      JSON.stringify({
        ...exportedGameSetup,
        setup: {
          ...exportedGameSetup.setup,
          config: { ...exportedGameSetup.setup.config, generationParameters: [] },
        },
      }),
    ),
  /invalid generation parameters/u,
);
assert.throws(
  () =>
    parseGameSetupShareFileJson(
      JSON.stringify({
        ...exportedGameSetup,
        setup: {
          ...exportedGameSetup.setup,
          config: { ...exportedGameSetup.setup.config, generationParameters: { maxContext: "invalid" } },
        },
      }),
    ),
  /invalid generation parameters/u,
);
assert.throws(
  () =>
    parseGameSetupShareFileJson(
      JSON.stringify({
        ...exportedGameSetup,
        setup: {
          ...exportedGameSetup.setup,
          effectiveGenerationParameters: { stopSequences: "invalid" },
        },
      }),
    ),
  /invalid generation parameters/u,
);
assert.throws(
  () =>
    parseGameSetupShareFileJson(
      JSON.stringify({
        ...exportedGameSetup,
        setup: {
          ...exportedGameSetup.setup,
          effectiveGenerationParameters: { unsupportedParameter: true },
        },
      }),
    ),
  /invalid generation parameters/u,
);
