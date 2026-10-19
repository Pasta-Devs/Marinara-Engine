// Reference scope for videos: through the real gallery routes with a fake text model and ComfyUI, the
// video settings decide whether a clip's prompt gets the named characters' Appearance lines (Conversation
// and Roleplay) and whether a Conversation clip with no picture of its own starts from the avatar. The
// image settings alone (older chats) leave videos unchanged.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-media-reference-scope-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

let closeDatabase: (() => Promise<void>) | undefined;
let app: { close: () => Promise<unknown> } | undefined;
let provider: import("node:http").Server | undefined;
try {
  const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const Fastify = requireServer("fastify") as typeof import("fastify").default;
  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  const { galleryRoutes } = await import("../../packages/server/src/routes/gallery.routes.js");
  const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const { createConnectionsStorage } =
    await import("../../packages/server/src/services/storage/connections.storage.js");
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const { createGalleryStorage } = await import("../../packages/server/src/services/storage/gallery.storage.js");
  const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(12)]);
  const APPEARANCE = /Aster's Appearance: silver hair, green coat/u;
  const PERSONA_APPEARANCE = /Jamie's Appearance: short red hair, denim jacket/u;

  const comfyPrompts: string[] = [];
  provider = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const url = request.url ?? "";
    response.setHeader("content-type", "application/json");
    if (url.endsWith("/prompt")) {
      comfyPrompts.push(Buffer.concat(chunks).toString());
      return response.end(JSON.stringify({ prompt_id: "job" }));
    }
    if (url.includes("/history/")) {
      return response.end(
        JSON.stringify({
          job: {
            status: { completed: true, status_str: "success" },
            outputs: { "9": { gifs: [{ filename: "clip.mp4", subfolder: "", type: "output" }] } },
          },
        }),
      );
    }
    if (url.startsWith("/view")) {
      response.setHeader("content-type", "video/mp4");
      return response.end(mp4);
    }
    // Both writers name Aster: the Conversation writer as plain text, the Roleplay director as JSON.
    const roleplayDirector = Buffer.concat(chunks).toString().includes("narrationBeat");
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: roleplayDirector
                ? JSON.stringify({ narrationBeat: "Aster turns to Jamie at the window" })
                : "Aster waves to Jamie and Rowan",
            },
            finish_reason: "stop",
          },
        ],
        usage: { total_tokens: 20 },
      }),
    );
  });

  const db = await getDB();
  closeDatabase = closeDB;
  const server = Fastify();
  app = server;
  server.decorate("db", db);
  await server.register(galleryRoutes, { prefix: "/api/gallery" });
  await server.register(chatsRoutes, { prefix: "/api/chats" });

  const fakeProvider = provider;
  await new Promise<void>((resolve) => fakeProvider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const connections = createConnectionsStorage(db);
  const text = await connections.create({
    name: "Text",
    provider: "custom",
    baseUrl: `${baseUrl}/v1`,
    model: "fixture",
    apiKey: "fixture",
  });
  const video = await connections.create({
    name: "ComfyUI video",
    provider: "video_generation",
    baseUrl,
    model: "fixture-video",
    videoService: "comfyui",
    videoGenerationSource: "comfyui",
    comfyuiWorkflow: JSON.stringify({ "1": { inputs: { text: "%prompt%", image: "%reference_image%" } } }),
    apiKey: "",
  });
  mkdirSync(join(fixtureDir, "avatars"), { recursive: true });
  writeFileSync(join(fixtureDir, "avatars", "aster.png"), png);
  const aster = await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Aster", extensions: { appearance: "silver hair, green coat" } }),
    "/api/avatars/file/aster.png",
  );
  assert.ok(aster);
  // A character the user plays as, who is not one of the chat's characters.
  const rowan = await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Rowan", extensions: { appearance: "braided black hair" } }),
  );
  assert.ok(rowan);
  const ROWAN_APPEARANCE = /Rowan's Appearance: braided black hair/u;
  const chats = createChatsStorage(db);
  const lastComfyInputs = () =>
    (JSON.parse(comfyPrompts.at(-1) ?? "{}") as { prompt?: Record<string, { inputs: Record<string, string> }> })
      .prompt?.["1"]?.inputs;

  // Settings are saved through Chat Settings' own route, and each one must come back as sent.
  const saveChatSettings = async (chatId: string, patch: Record<string, unknown>) => {
    const response = await server.inject({ method: "PATCH", url: `/api/chats/${chatId}/metadata`, payload: patch });
    assert.equal(response.statusCode, 200, response.body);
    const raw = (await chats.getById(chatId))?.metadata;
    const saved = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) assert.deepEqual(saved[key], value, key);
  };

  // The user's persona, named by both writers, gets an Appearance line too.
  const jamie = await createCharactersStorage(db).createPersona("Jamie", "The player.", undefined, {
    appearance: "short red hair, denim jacket",
  });
  assert.ok(jamie);

  // ── Conversation ──
  const convo = await chats.create({
    name: "Convo",
    mode: "conversation",
    characterIds: [aster.id],
    personaId: jamie.id,
    connectionId: text.id,
  });
  assert.ok(convo);
  const sendVideo = async (meta: Record<string, unknown>) => {
    await saveChatSettings(convo.id, {
      sceneVideoConnectionId: video.id,
      sceneVideoFirstFrame: "prompt_only",
      selfieIncludeCharacterAppearance: false,
      selfieUseAvatarReferences: false,
      selfieVideoIncludeCharacterAppearance: false,
      selfieVideoUseAvatarReferences: false,
      ...meta,
    });
    const response = await server.inject({
      method: "POST",
      url: `/api/gallery/${convo.id}/video`,
      payload: { characterId: aster.id },
    });
    assert.equal(response.statusCode, 200, response.body);
    return { body: response.json() as { firstFrame: string }, inputs: lastComfyInputs() };
  };

  // Off: no appearance lines, no picture.
  const off = await sendVideo({});
  assert.doesNotMatch(off.inputs?.text ?? "", APPEARANCE);
  assert.doesNotMatch(off.inputs?.text ?? "", PERSONA_APPEARANCE);
  assert.equal(off.body.firstFrame, "none");

  // Older chats with only the image settings on: videos are unchanged.
  const imagesOnly = await sendVideo({ selfieIncludeCharacterAppearance: true, selfieUseAvatarReferences: true });
  assert.doesNotMatch(imagesOnly.inputs?.text ?? "", APPEARANCE);
  assert.equal(imagesOnly.body.firstFrame, "none");

  // Videos: the appearance lines join the prompt, and the prompt-only clip starts from the avatar.
  const videos = await sendVideo({ selfieVideoIncludeCharacterAppearance: true, selfieVideoUseAvatarReferences: true });
  assert.match(videos.inputs?.text ?? "", APPEARANCE);
  assert.match(videos.inputs?.text ?? "", PERSONA_APPEARANCE);
  assert.equal(videos.body.firstFrame, "avatar");
  assert.equal(videos.inputs?.image, png.toString("base64"));
  assert.doesNotMatch(videos.inputs?.text ?? "", ROWAN_APPEARANCE);

  // Playing as a character outside the chat: that character's Appearance line joins when the clip names them.
  const switched = await server.inject({
    method: "PATCH",
    url: `/api/chats/${convo.id}`,
    payload: { personaId: null, personaCharacterId: rowan.id },
  });
  assert.equal(switched.statusCode, 200, switched.body);
  const playedCharacter = await sendVideo({ selfieVideoIncludeCharacterAppearance: true });
  assert.match(playedCharacter.inputs?.text ?? "", ROWAN_APPEARANCE);
  assert.doesNotMatch(playedCharacter.inputs?.text ?? "", PERSONA_APPEARANCE);

  // ── Roleplay ──
  const roleplay = await chats.create({
    name: "RP",
    mode: "roleplay",
    characterIds: [aster.id],
    personaId: jamie.id,
    connectionId: text.id,
  });
  assert.ok(roleplay);
  mkdirSync(join(fixtureDir, "gallery", roleplay.id), { recursive: true });
  writeFileSync(join(fixtureDir, "gallery", roleplay.id, "pic.png"), png);
  const picture = await createGalleryStorage(db).create({
    chatId: roleplay.id,
    filePath: `${roleplay.id}/pic.png`,
    prompt: "Aster by the window",
  });
  assert.ok(picture);
  const preview = async (meta: Record<string, unknown>) => {
    await saveChatSettings(roleplay.id, { sceneVideoConnectionId: video.id, ...meta });
    const response = await server.inject({
      method: "POST",
      url: "/api/gallery/generate-scene-video/preview",
      payload: { chatId: roleplay.id, galleryImageId: picture.id },
    });
    assert.equal(response.statusCode, 200, response.body);
    return (response.json() as { prompt: string }).prompt;
  };
  const imageSettingOnly = await preview({ illustratorIncludeCharacterAppearance: true });
  assert.doesNotMatch(imageSettingOnly, APPEARANCE);
  assert.doesNotMatch(imageSettingOnly, PERSONA_APPEARANCE);
  const withAppearance = await preview({ illustratorVideoIncludeCharacterAppearance: true });
  assert.match(withAppearance, APPEARANCE);
  assert.match(withAppearance, PERSONA_APPEARANCE);
  console.log("media-reference-scope regression passed");
} finally {
  await app?.close();
  const fakeProvider = provider;
  if (fakeProvider?.listening) await new Promise<void>((resolve) => fakeProvider.close(() => resolve()));
  await closeDatabase?.();
  rmSync(fixtureDir, { recursive: true, force: true });
}
