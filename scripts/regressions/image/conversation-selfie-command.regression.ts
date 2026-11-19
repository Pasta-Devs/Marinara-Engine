// Conversation selfies, from the /selfie command and the Gallery, through the real code with a stand-in text model
// and image service, on a fresh database in a temporary folder:
// - the chat's own image prompt connection writes the prompt;
// - debug mode logs the prompt writer's system prompt;
// - a group selfie, asked for in the request, describes every character and not the user's Persona, and is saved to
//   every depicted character's gallery; an ordinary selfie only to the speaker's.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-conversation-selfie-command-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";

const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { galleryRoutes } = await import("../../../packages/server/src/routes/gallery.routes.js");
const { handleConversationSelfieCommand } =
  await import("../../../packages/server/src/services/generation/conversation-selfie-command-runtime.js");
const { logger } = await import("../../../packages/server/src/lib/logger.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createCharacterGalleryStorage } =
  await import("../../../packages/server/src/services/storage/character-gallery.storage.js");
const { characterDataSchema } = await import("../../../packages/shared/dist/index.js");

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
// Which address each prompt-writer request reached, and every prompt sent to the image service.
const writerUrls: string[] = [];
const imagePrompts: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/images/generations")) {
    imagePrompts.push(String(body.prompt));
    response.end(JSON.stringify({ data: [{ b64_json: png }] }));
    return;
  }
  writerUrls.push(request.url ?? "");
  // The writer names the user, Pat, who is taking the photo, as a real model often does.
  response.end(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: "selfie taken by Pat, cafe" }, finish_reason: "stop" }],
      usage: { total_tokens: 20 },
    }),
  );
});
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(galleryRoutes, { prefix: "/api/gallery" });
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const characterGallery = createCharacterGalleryStorage(db);
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connections = createConnectionsStorage(db);
  const writer = (name: string, path: string) =>
    connections.create({
      name,
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}${path}`,
      model: "fixture",
      apiKey: "fixture",
    });
  const text = await writer("Text fixture", "/v1");
  const chatWriter = await writer("Chat image prompt writer", "/chat-writer/v1");
  const image = await connections.create({
    name: "Image fixture",
    provider: "image_generation",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "dall-e-3",
    imageService: "openai",
    imageGenerationSource: "openai",
    apiKey: "fixture",
  });
  assert.ok(text && chatWriter && image);

  const aster = await characters.create(characterDataSchema.parse({ name: "Aster", appearance: "ASTER_LOOK" }));
  const brin = await characters.create(characterDataSchema.parse({ name: "Brin", appearance: "BRIN_LOOK" }));
  assert.ok(aster && brin);
  const conversation = await chats.create({
    name: "Conversation",
    mode: "conversation",
    characterIds: [aster.id, brin.id],
    connectionId: text.id,
  });
  assert.ok(conversation);
  const chatMeta = { imageGenConnectionId: image.id, selfieIncludeCharacterAppearance: true };
  await chats.patchMetadata(conversation.id, chatMeta);

  const selfie = async (options: {
    generationGuide?: string;
    chatMeta?: Record<string, unknown>;
    debugMode?: boolean;
  }) => {
    writerUrls.length = 0;
    imagePrompts.length = 0;
    const events: Array<Record<string, unknown>> = [];
    const handled = await handleConversationSelfieCommand({
      command: { type: "selfie" } as Parameters<typeof handleConversationSelfieCommand>[0]["command"],
      characterId: aster.id,
      chatId: conversation.id,
      chatMeta: options.chatMeta ?? chatMeta,
      charInfo: [
        { id: aster.id, name: "Aster", appearance: "ASTER_LOOK" },
        { id: brin.id, name: "Brin", appearance: "BRIN_LOOK" },
      ],
      persona: { id: null, name: "Pat", appearance: "PERSONA_LOOK" },
      promptConnection: (await connections.getWithKey(text.id))!,
      promptConnectionId: text.id,
      generationGuide: options.generationGuide ?? null,
      debugMode: options.debugMode,
      serviceTier: null,
      db,
      chars: characters,
      chats,
      connections,
      sendEvent: (event) => events.push(event),
    });
    assert.equal(handled, true);
    assert.equal(imagePrompts.length, 1, JSON.stringify(events));
    return imagePrompts[0]!;
  };
  const galleryCount = async (characterId: string) => (await characterGallery.listByCharacterId(characterId)).length;

  // An ordinary selfie describes and keeps only the character taking it.
  const solo = await selfie({});
  assert.match(solo, /ASTER_LOOK/u);
  assert.doesNotMatch(solo, /BRIN_LOOK/u);
  assert.equal(await galleryCount(aster.id), 1);
  assert.equal(await galleryCount(brin.id), 0);

  // A group selfie asked for in the request describes everyone in the chat, never the user's Persona, and lands in
  // every depicted character's gallery.
  const group = await selfie({ generationGuide: "Take a group selfie with everyone, Pat included." });
  assert.match(group, /ASTER_LOOK/u);
  assert.match(group, /BRIN_LOOK/u, "the guided request makes it a group selfie");
  assert.doesNotMatch(group, /PERSONA_LOOK/u, "the user taking the photo is not in it");
  assert.equal(await galleryCount(aster.id), 2);
  assert.equal(await galleryCount(brin.id), 1, "a group selfie is saved to every depicted character");

  // The chat's own image prompt connection writes the prompt, for /selfie and for the Gallery's selfie button.
  const ownWriterMeta = { ...chatMeta, illustratorPromptConnectionId: chatWriter.id };
  assert.equal(writerUrls[0], "/v1/chat/completions", "without a chat setting, the chat's connection writes");
  await selfie({ chatMeta: ownWriterMeta });
  assert.deepEqual(writerUrls, ["/chat-writer/v1/chat/completions"]);
  await chats.patchMetadata(conversation.id, ownWriterMeta);
  writerUrls.length = 0;
  const gallerySelfie = await app.inject({
    method: "POST",
    url: `/api/gallery/${conversation.id}/selfie`,
    payload: { characterId: aster.id, previewOnly: true },
  });
  assert.equal(gallerySelfie.statusCode, 200, gallerySelfie.body);
  assert.deepEqual(writerUrls, ["/chat-writer/v1/chat/completions"]);

  // Debug mode logs the system prompt the prompt writer is given.
  const logged: string[] = [];
  const warn = logger.warn.bind(logger);
  logger.warn = ((message: unknown, ...rest: unknown[]) => {
    logged.push([message, ...rest].map(String).join("\n"));
  }) as typeof logger.warn;
  try {
    await selfie({ debugMode: true });
  } finally {
    logger.warn = warn;
  }
  assert.ok(
    logged.some((line) => line.startsWith("[debug/commands/selfie] prompt-builder system:") && line.includes("Aster")),
    "debug mode logs the prompt writer's system prompt",
  );
  console.info("Conversation selfies use the chat's prompt writer, log in debug mode and handle group shots.");
} finally {
  provider.closeAllConnections();
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}
