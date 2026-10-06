// #7053: the Game preview and generation routes must carry the selected persona's
// image appearance into the actual provider prompt, not merely load its record.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-game-image-appearance-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.MARINARA_ENV_FILE = join(fixtureDir, ".env");
writeFileSync(process.env.MARINARA_ENV_FILE, "");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const imagePrompts: string[] = [];
const providerErrors: unknown[] = [];
const provider = createServer(async (request, response) => {
  try {
    assert.equal(request.url, "/v1/images/generations", "the fixture only allows image requests");
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { prompt?: unknown };
    assert.equal(typeof body.prompt, "string");
    imagePrompts.push(body.prompt as string);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: [{ b64_json: png }] }));
  } catch (error) {
    providerErrors.push(error);
    response.writeHead(500);
    response.end("Unexpected fixture request");
  }
});

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Game image appearance fixture",
    provider: "image_generation",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "dall-e-3",
    imageService: "openai",
    imageGenerationSource: "openai",
    apiKey: "fixture",
  });
  await createAppSettingsStorage(db).set("ui", JSON.stringify({ autoSaveGeneratedImagesToGalleries: false }));
  const characters = createCharactersStorage(db);
  const chats = createChatsStorage(db);
  const appearance = "Copper curls, a moss-green coat, and a silver walking stick.";
  const override = "silver hair, azure eyes, embroidered white coat";
  const persona = await characters.createPersona("Fel Lockheart", "Persona fixture", undefined, {
    appearance,
    imageAppearanceEnabled: "true",
    imageAppearance: override,
  });
  assert.ok(persona);

  for (const scenario of [
    { name: "enabled", enabled: "true", text: override, selection: "chat", expected: override },
    { name: "disabled", enabled: "false", text: override, selection: "chat", expected: appearance },
    { name: "blank", enabled: "true", text: "   ", selection: "chat", expected: appearance },
    { name: "setup fallback", enabled: "true", text: override, selection: "setup", expected: override },
    { name: "unselected", enabled: "true", text: override, selection: "none", expected: null },
  ] as const) {
    await characters.updatePersona(persona.id, {
      imageAppearanceEnabled: scenario.enabled,
      imageAppearance: scenario.text,
    });
    const chat = await chats.create({
      name: `Game image appearance: ${scenario.name}`,
      mode: "game",
      characterIds: [],
      personaId: scenario.selection === "chat" ? persona.id : null,
    });
    assert.ok(chat);
    await chats.patchMetadata(chat.id, {
      enableSpriteGeneration: true,
      gameImageConnectionId: connection.id,
      gameImageDynamicPromptEnabled: false,
      gameSetupConfig: scenario.selection === "setup" ? { personaId: persona.id } : {},
    });
    const payload = {
      chatId: chat.id,
      illustration: {
        prompt: "Fel Lockheart stands beside a fountain in a quiet sunlit garden.",
        characters: ["Fel Lockheart"],
        slug: `appearance-${scenario.name.replaceAll(" ", "-")}`,
      },
      forceIllustration: true,
      includeCharacterAppearance: true,
      useAvatarReferences: false,
      queueImageGenerationRequests: false,
      imageSizes: { background: { width: 64, height: 64 } },
    };
    const callsBeforePreview = imagePrompts.length;
    const preview = await app.inject({ method: "POST", url: "/api/game/generate-assets/preview", payload });
    assert.equal(preview.statusCode, 200, `${scenario.name}: ${preview.body}`);
    const items = preview.json<{ items: Array<{ kind: string; prompt: string }> }>().items;
    assert.equal(items.length, 1, `${scenario.name}: preview returns one illustration`);
    assert.equal(items[0]?.kind, "illustration");
    assert.equal(imagePrompts.length, callsBeforePreview, "preview must not generate an image");

    const generated = await app.inject({ method: "POST", url: "/api/game/generate-assets", payload });
    assert.equal(generated.statusCode, 200, `${scenario.name}: ${generated.body}`);
    assert.deepEqual(providerErrors, []);
    assert.ok(generated.json().generatedIllustration?.tag, `${scenario.name}: image generation succeeds`);
    assert.equal(imagePrompts.length, callsBeforePreview + 1, `${scenario.name}: one image reaches the provider`);
    const sentPrompt = imagePrompts.at(-1)!;
    // OpenAI appends the separate negative prompt as "Do not include" prose.
    assert.ok(sentPrompt.startsWith(items[0]!.prompt), `${scenario.name}: the provider retains the preview prompt`);
    for (const prompt of [items[0]!.prompt, sentPrompt]) {
      if (scenario.expected) {
        assert.ok(prompt.includes(scenario.expected), `${scenario.name}: selected appearance reaches the prompt`);
      }
      if (scenario.expected !== appearance) assert.ok(!prompt.includes(appearance), `${scenario.name}: no prose leak`);
      if (scenario.expected !== override) assert.ok(!prompt.includes(override), `${scenario.name}: no override leak`);
    }
  }

  console.info("Game image appearance route regression passed (preview and generation, 5 scenarios).");
} finally {
  await app.close();
  await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}
