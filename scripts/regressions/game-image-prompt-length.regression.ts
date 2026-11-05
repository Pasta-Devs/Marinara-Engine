import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-game-image-prompt-length-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { buildNpcPortraitProviderPrompt, buildBackgroundProviderPrompt, buildSceneIllustrationProviderPrompt } =
  await import("../../packages/server/src/services/game/game-asset-generation.js");
const { createDefaultImageStyleProfileSettings } = await import("../../packages/shared/src/index.js");
const gameRoutes = await import("../../packages/server/src/routes/game.routes.js");
const credentials = { chatId: "prompt-length-proof", imgModel: "unused", imgBaseUrl: "", imgApiKey: "" };
const styles = createDefaultImageStyleProfileSettings();
const longPrompt = (tail: string) => `${"silver hair, pink bunny ears, layered knight uniform, ".repeat(200)}${tail}`;
const failures: string[] = [];

async function check(name: string, run: () => Promise<void> | void) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

try {
  await check("full canonical NPC appearance survives plain and styled compilation", async () => {
    const appearance = longPrompt("PORTRAIT_APPEARANCE_TAIL");
    for (const profile of [undefined, "z-image-turbo", "danbooru"]) {
      const result = await buildNpcPortraitProviderPrompt({
        ...credentials,
        npcName: "Yunyun",
        appearance,
        ...(profile ? { styleProfiles: styles, styleProfileId: profile } : {}),
      });
      assert.ok(result.prompt.includes(appearance), `${profile ?? "plain"} clips canonical appearance`);
      assert.match(result.negativePrompt, /watermark/i);
    }
  });

  await check("provider-ready backgrounds retain text past both former caps", async () => {
    const sceneDescription = longPrompt("BACKGROUND_PROMPT_TAIL");
    for (const preserve of [false, true]) {
      const result = await buildBackgroundProviderPrompt({
        ...credentials,
        locationSlug: "moonlit-garden",
        sceneDescription,
        providerReadyPrompt: true,
        preserveFullBackgroundPrompt: preserve,
      });
      assert.equal(result.prompt, sceneDescription);
    }
  });

  await check("preserved scene prompt and style survive without a final length cut", async () => {
    const prompt = longPrompt("SCENE_PROMPT_TAIL");
    const style = "ornate rococo oil painting";
    const result = await buildSceneIllustrationProviderPrompt({
      ...credentials,
      prompt: `${prompt} Art direction: ${style}.`,
      artStyle: style,
      useGamePromptTemplate: false,
      preserveFullScenePrompt: true,
      styleProfiles: styles,
      styleProfileId: "z-image-turbo",
    });
    assert.ok(result.prompt.includes(prompt));
    assert.equal(result.prompt.toLowerCase().split(style).length - 1, 1);
  });

  await check("dynamic image text remains complete for every Game asset kind", async () => {
    const generated = longPrompt("DYNAMIC_IMAGE_PROMPT_TAIL");
    const common = {
      ...credentials,
      dynamicPromptGenerator: async () => generated,
      styleProfiles: styles,
      styleProfileId: "z-image-turbo",
    };
    const results = await Promise.all([
      buildNpcPortraitProviderPrompt({ ...common, npcName: "Yunyun", appearance: "pink hair" }),
      buildBackgroundProviderPrompt({ ...common, locationSlug: "garden", sceneDescription: "A garden." }),
      buildSceneIllustrationProviderPrompt({ ...common, prompt: "A moonlit garden." }),
    ]);
    for (const result of results) assert.ok(result.prompt.includes(generated));
    await assert.rejects(
      buildNpcPortraitProviderPrompt({
        ...common,
        npcName: "Yunyun",
        appearance: "pink hair",
        dynamicPromptGenerator: async () => "too short",
      }),
      /no usable prompt/,
    );
  });

  await check("all supplied scene appearance notes retain their complete text", async () => {
    const characterDescriptions = Array.from(
      { length: 18 },
      (_, index) => `Character ${index}: ${"a violet ribbon and long silver braid ".repeat(20)}LOOK_${index}_TAIL`,
    );
    const result = await buildSceneIllustrationProviderPrompt({
      ...credentials,
      prompt: "The ensemble gathers in the courtyard.",
      useGamePromptTemplate: false,
      characterDescriptions,
    });
    for (const description of characterDescriptions) assert.ok(result.prompt.includes(description));
  });

  await check("backgrounds and scenes retain complete user image instructions", async () => {
    const instructions = `${longPrompt("USER_IMAGE_INSTRUCTIONS_TAIL")}\n<palette>violet and gold</palette>`;
    const results = await Promise.all([
      buildBackgroundProviderPrompt({
        ...credentials,
        locationSlug: "courtyard",
        sceneDescription: "A moonlit courtyard.",
        imagePromptInstructions: `  ${instructions}  `,
      }),
      buildSceneIllustrationProviderPrompt({
        ...credentials,
        prompt: "A moonlit courtyard.",
        imagePromptInstructions: `  ${instructions}  `,
      }),
    ]);
    for (const result of results) assert.ok(result.prompt.includes(`User image instructions: ${instructions}`));
  });

  await check("dynamic response cleanup preserves long plain and JSON prompts", () => {
    const generated = longPrompt("SANITIZED_RESPONSE_TAIL");
    const sanitize = gameRoutes.sanitizeDynamicGameImagePromptResponse;
    assert.equal(typeof sanitize, "function");
    for (const response of [
      generated,
      `Prompt: ${generated}`,
      JSON.stringify({ prompt: generated }),
      JSON.stringify({ positivePrompt: generated }),
      `\`\`\`json\n${JSON.stringify({ imagePrompt: generated })}\n\`\`\``,
    ]) {
      assert.equal(sanitize(response), generated);
    }
    assert.equal(sanitize(JSON.stringify({ prompt: 42 })), null);
    assert.equal(sanitize(""), null);
    assert.equal(sanitize("too short"), null);
  });

  await check("built-in director removes output caps while keeping bounded input context", async () => {
    const messages = await gameRoutes.buildDynamicGameImagePromptMessages({
      request: {
        kind: "portrait",
        title: "Yunyun",
        sourcePrompt: longPrompt("DRAFT_CONTEXT_TAIL"),
        assetContext: [],
        maxCharacters: 1400,
      },
      meta: {},
      setupConfig: null,
      latestState: null,
      latestTurnNarration: null,
    });
    const text = JSON.stringify(messages);
    assert.doesNotMatch(text, /Maximum length:|Keep the prompt under/i);
    assert.ok(!text.includes("DRAFT_CONTEXT_TAIL"), "LLM draft context still uses its existing excerpt budget");
  });
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

assert.deepEqual(failures, [], `Game image prompt failures: ${failures.join(", ")}`);
