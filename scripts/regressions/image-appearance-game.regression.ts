// #7053: the Game preview and generation routes must carry the selected persona's
// image appearance into the actual provider prompt, not merely load its record.
// #7419: Character Tracker portraits carry the tracked outfit to the provider too.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const { avatarsRoutes } = await import("../../packages/server/src/routes/avatars.routes.js");
const { buildTrackerPortraitPrompt } = await import("../../packages/server/src/services/image/tracker-portrait.js");
const { compileImagePrompt, DEFAULT_IMAGE_STYLE_PROFILES } = await import("../../packages/shared/dist/index.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const imagePrompts: string[] = [];
const providerErrors: unknown[] = [];
let failImages = false;
// Holds the next image request open until released, so a test can act while a portrait is being made.
let holdImages: { reached: () => void; released: Promise<void> } | null = null;
const provider = createServer(async (request, response) => {
  if (failImages) {
    response.writeHead(500);
    response.end("Image service down");
    return;
  }
  try {
    assert.equal(request.url, "/v1/images/generations", "the fixture only allows image requests");
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { prompt?: unknown };
    assert.equal(typeof body.prompt, "string");
    imagePrompts.push(body.prompt as string);
    const hold = holdImages;
    holdImages = null;
    if (hold) {
      hold.reached();
      await hold.released;
    }
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
await app.register(avatarsRoutes, { prefix: "/api/avatars" });

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

  // #8396: details from the reported tracker appearance must survive every style profile.
  const reportedNpc = {
    name: "Yunyun Lian",
    appearance: "5’2”, fluffy pink bunny ears, light pink hair, blue eyes, curvy figure.",
    outfit: "Knight Corps uniform",
  };
  for (const profile of DEFAULT_IMAGE_STYLE_PROFILES) {
    const compiled = compileImagePrompt({
      kind: "portrait",
      prompt: buildTrackerPortraitPrompt(reportedNpc, true),
      styleProfiles: { defaultProfileId: profile.id, profiles: DEFAULT_IMAGE_STYLE_PROFILES },
      styleProfileId: profile.id,
    });
    for (const detail of ["5’2”", "fluffy pink bunny ears", "light pink hair", "blue eyes", "curvy figure"]) {
      assert.ok(compiled.prompt.includes(detail), `${profile.id}: missing reported detail ${detail}`);
    }
    assert.ok(compiled.prompt.includes(reportedNpc.outfit), `${profile.id}: missing the outfit`);
  }
  const longNpc = {
    name: "Long Portrait",
    appearance: `${Array.from({ length: 700 }, (_, i) => `distinctive embroidered marking ${i}`).join(", ")}, opal antlers`,
    outfit: `${Array.from({ length: 80 }, (_, i) => `layer ${i} has its own geometric stitching`).join(". ")}. Brass anklets`,
  };
  const longPortrait = buildTrackerPortraitPrompt(longNpc, true);
  assert.ok(longNpc.appearance.length > 20_000, "exercise the former tracker request field limit too");
  assert.ok(longPortrait.includes(longNpc.appearance), "the complete appearance survives prompt assembly");
  assert.ok(longPortrait.includes(longNpc.outfit), "the complete outfit survives prompt assembly");
  assert.ok(longPortrait.includes("Brass anklets"), "the last outfit detail survives prompt assembly");
  for (const profile of DEFAULT_IMAGE_STYLE_PROFILES) {
    const compiled = compileImagePrompt({
      kind: "portrait",
      prompt: longPortrait,
      styleProfiles: { defaultProfileId: profile.id, profiles: DEFAULT_IMAGE_STYLE_PROFILES },
      styleProfileId: profile.id,
    });
    for (const detail of ["marking 0", "marking 350", "marking 699", "opal antlers", "layer 79", "Brass anklets"]) {
      assert.ok(compiled.prompt.includes(detail), `${profile.id}: missing long-prompt detail ${detail}`);
    }
  }

  // #7419: the tracker's outfit is included only when requested, for every style profile.
  const npc = {
    name: "Brannoc",
    appearance: "Short man with a messy brown beard and grey eyes.",
    outfit: "a simple red tunic",
  };
  const lookOnly = buildTrackerPortraitPrompt(npc, false);
  const lookAndOutfit = buildTrackerPortraitPrompt(npc, true);
  assert.ok(!lookOnly.includes("tunic"), "Look leaves the outfit out");
  assert.equal(buildTrackerPortraitPrompt({ ...npc, outfit: null }, true), lookOnly, "no outfit adds nothing");
  assert.equal(buildTrackerPortraitPrompt({ ...npc, outfit: "  " }, true), lookOnly, "a blank outfit adds nothing");
  // Tracker fields are raw model output; a list instead of text must not stop the portrait.
  assert.equal(buildTrackerPortraitPrompt({ ...npc, outfit: ["red tunic"] }, true), lookOnly, "a non-text outfit");
  // Every sentence of a layered outfit survives style compilation.
  const layeredOutfit = buildTrackerPortraitPrompt(
    { ...npc, outfit: "Barefoot. Loose linen trousers and a sleeveless grey vest!" },
    true,
  );
  for (const profile of DEFAULT_IMAGE_STYLE_PROFILES) {
    const compile = (prompt: string) =>
      compileImagePrompt({
        kind: "portrait",
        prompt,
        styleProfiles: { defaultProfileId: profile.id, profiles: DEFAULT_IMAGE_STYLE_PROFILES },
        styleProfileId: profile.id,
      }).prompt;
    assert.match(compile(lookAndOutfit), /simple red tunic/, `${profile.id}: the outfit reaches the image prompt`);
    assert.match(compile(lookAndOutfit), /brown beard/, `${profile.id}: so does the look`);
    assert.doesNotMatch(compile(lookOnly), /tunic/, `${profile.id}: Look stays without the outfit`);
    assert.match(compile(layeredOutfit), /Barefoot/, `${profile.id}: the first outfit sentence`);
    assert.match(compile(layeredOutfit), /linen trousers.*grey vest/, `${profile.id}: and the next one`);
  }

  // The portrait buttons: the route needs the tracker's image connection, sends the chosen prompt,
  // and keeps the old portrait when the image service fails.
  const trackerChat = await chats.create({ name: "Tracker portraits", mode: "roleplay", characterIds: [] });
  assert.ok(trackerChat);
  const portraitUrl = `/api/avatars/npc/${trackerChat.id}/generate`;
  const noConnection = await app.inject({ method: "POST", url: portraitUrl, payload: { ...npc, includeOutfit: true } });
  assert.equal(noConnection.statusCode, 400, noConnection.body);
  await createAgentsStorage(db).create({
    type: "character-tracker",
    name: "Character Tracker",
    phase: "post_processing",
    settings: { imageConnectionId: connection.id },
  });
  for (const profile of DEFAULT_IMAGE_STYLE_PROFILES) {
    await chats.patchMetadata(trackerChat.id, { imageStyleProfileId: profile.id });
    for (const character of [reportedNpc, longNpc]) {
      const generated = await app.inject({
        method: "POST",
        url: portraitUrl,
        payload: { ...character, includeOutfit: true },
      });
      assert.equal(generated.statusCode, 200, `${profile.id}: ${generated.body}`);
      const sent = imagePrompts.at(-1)!;
      for (const field of [character.appearance, character.outfit]) {
        // Tag grammar replaces terminal sentence punctuation with its list separator.
        assert.ok(
          sent.includes(field.replace(/[.!?]+$/u, "")),
          `${profile.id}: the provider receives the complete tracker field`,
        );
      }
    }
  }
  for (const includeOutfit of [false, true]) {
    const callsBefore = imagePrompts.length;
    const generated = await app.inject({ method: "POST", url: portraitUrl, payload: { ...npc, includeOutfit } });
    assert.equal(generated.statusCode, 200, generated.body);
    assert.match(
      generated.json().avatarPath,
      new RegExp(`^/api/avatars/npc/${trackerChat.id}/brannoc\\.png\\?v=\\d+$`),
    );
    assert.equal(imagePrompts.length, callsBefore + 1, "one image reaches the provider");
    assert.match(imagePrompts.at(-1)!, /brown beard/);
    assert.equal(imagePrompts.at(-1)!.includes("simple red tunic"), includeOutfit, `includeOutfit=${includeOutfit}`);
  }
  const portraitFile = join(fixtureDir, "avatars", "npc", trackerChat.id, "brannoc.png");
  writeFileSync(portraitFile, "old portrait");
  failImages = true;
  const failed = await app.inject({ method: "POST", url: portraitUrl, payload: { ...npc, includeOutfit: true } });
  failImages = false;
  assert.equal(failed.statusCode, 502, failed.body);
  assert.doesNotMatch(failed.body, /Image service down/, "the provider's own error text stays in the server log");
  assert.equal(readFileSync(portraitFile, "utf8"), "old portrait", "a failed portrait keeps the old one");

  // While a portrait is being made, a second request for it is refused (no second paid image),
  // and a portrait the user uploads meanwhile is kept, not overwritten when the first one arrives.
  let releaseImage = () => {};
  const imageReached = new Promise<void>((reached) => {
    holdImages = { reached, released: new Promise<void>((release) => (releaseImage = release)) };
  });
  // inject() only sends once awaited, so start it now.
  const pending = Promise.resolve(
    app.inject({ method: "POST", url: portraitUrl, payload: { ...npc, includeOutfit: true } }),
  );
  await imageReached;
  const callsWhileBusy = imagePrompts.length;
  const busy = await app.inject({ method: "POST", url: portraitUrl, payload: { ...npc, includeOutfit: false } });
  assert.equal(busy.statusCode, 409, busy.body);
  assert.equal(imagePrompts.length, callsWhileBusy, "the refused request never reaches the provider");
  const uploadedPng = Buffer.concat([Buffer.from(png, "base64"), Buffer.from("user upload")]);
  const upload = await app.inject({
    method: "POST",
    url: `/api/avatars/npc/${trackerChat.id}`,
    payload: { name: npc.name, avatar: `data:image/png;base64,${uploadedPng.toString("base64")}` },
  });
  assert.equal(upload.statusCode, 200, upload.body);
  releaseImage();
  const late = await pending;
  assert.equal(late.statusCode, 409, late.body);
  assert.ok(readFileSync(portraitFile).equals(uploadedPng), "the upload made meanwhile is kept");
  const afterwards = await app.inject({ method: "POST", url: portraitUrl, payload: { ...npc, includeOutfit: true } });
  assert.equal(afterwards.statusCode, 200, afterwards.body);
  assert.ok(readFileSync(portraitFile).equals(Buffer.from(png, "base64")), "a later portrait replaces it again");

  console.info("Game image appearance route regression passed (preview and generation, 5 scenarios).");
  console.info("Character Tracker portrait regression passed (prompt assembly and the portrait route).");
} finally {
  await app.close();
  provider.closeAllConnections(); // a failed assertion can leave a held image request open
  await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}
