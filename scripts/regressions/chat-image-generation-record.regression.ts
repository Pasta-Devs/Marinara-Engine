// #7767: chat gallery rows keep the request an image was rendered from, so it can be
// regenerated with the same negative prompt, NovelAI character prompts, connection and
// reference sources. Older rows (no record) and malformed records read as null.
// The regenerate route re-sends that request (optionally edited), saves a new image and
// swaps it into the message attachment that showed the old one.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-chat-image-generation-"));
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
const { buildChatImageGenerationRecord, parseChatImageGenerationRecord } =
  await import("../../packages/shared/src/utils/chat-image-generation.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { galleryRoutes } = await import("../../packages/server/src/routes/gallery.routes.js");
const { readRecordedReferenceImages } =
  await import("../../packages/server/src/services/image/illustrator-references.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGalleryStorage } = await import("../../packages/server/src/services/storage/gallery.storage.js");

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const imagePrompts: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { prompt?: unknown };
  imagePrompts.push(String(body.prompt));
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ data: [{ b64_json: png }] }));
});

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(galleryRoutes, { prefix: "/api/gallery" });

try {
  // Builder trims, drops unusable character prompts and duplicate ids.
  const record = buildChatImageGenerationRecord({
    connectionId: "  conn-1 ",
    negativePrompt: " lowres, bad hands ",
    characterPrompts: [
      { name: "Arceana", prompt: "tall elf queen", negativePrompt: "", position: { x: 0.7, y: 0.5 } },
      { name: "  ", prompt: "nameless" },
      { name: "Rolim", prompt: "   " },
    ],
    referenceCharacterIds: ["char-a", "char-a", " ", "char-b"],
    referencePersonaId: "",
    locationImageId: "global-gallery:loc-1",
  });
  assert.deepEqual(record, {
    version: 1,
    prompt: null,
    connectionId: "conn-1",
    negativePrompt: "lowres, bad hands",
    characterPrompts: [{ name: "Arceana", prompt: "tall elf queen", position: { x: 0.7, y: 0.5 } }],
    references: {
      characterIds: ["char-a", "char-b"],
      personaId: null,
      personaSource: null,
      locationImageId: "global-gallery:loc-1",
    },
  });

  // Unknown, empty and malformed values read as "no record".
  assert.equal(parseChatImageGenerationRecord(null), null);
  assert.equal(parseChatImageGenerationRecord(""), null);
  assert.equal(parseChatImageGenerationRecord("{not json"), null);
  assert.equal(parseChatImageGenerationRecord(JSON.stringify({ ...record, version: 2 })), null);

  // Round trip through the real file-backed gallery table.
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Regenerate", mode: "roleplay" });
  assert.ok(chat?.id);
  const gallery = createGalleryStorage(db);

  const withRecord = await gallery.create({
    chatId: chat.id,
    filePath: `${chat.id}/new.png`,
    prompt: "throne room",
    generation: record,
  });
  const legacy = await gallery.create({ chatId: chat.id, filePath: `${chat.id}/old.png`, prompt: "old image" });

  const storedRecord = await gallery.getById(withRecord!.id, chat.id);
  assert.equal(typeof storedRecord?.generation, "string");
  assert.deepEqual(parseChatImageGenerationRecord(storedRecord?.generation), record);

  const storedLegacy = await gallery.getById(legacy!.id, chat.id);
  assert.equal(storedLegacy?.generation ?? null, null);
  assert.equal(parseChatImageGenerationRecord(storedLegacy?.generation), null);

  // Recorded reference sources are re-read from their current pictures; unknown ids are skipped.
  mkdirSync(join(fixtureDir, "avatars"), { recursive: true });
  writeFileSync(join(fixtureDir, "avatars", "arceana.png"), Buffer.from(png, "base64"));
  const references = await readRecordedReferenceImages({
    characterIds: ["arceana", "deleted-character"],
    personaId: "fel",
    charactersStore: {
      getById: async (id) =>
        id === "arceana"
          ? { id, data: JSON.stringify({ name: "Arceana" }), avatarPath: "/api/avatars/file/arceana.png" }
          : null,
      getPersona: async (id) => ({
        id,
        avatarPath: "/api/avatars/file/arceana.png",
        useCharacterSheetAsReference: "false",
      }),
    },
  });
  assert.deepEqual(references, [png, png]);
  // A persona first sent as a sprite skips the avatar on re-roll (no sprite here, so nothing is sent).
  const spriteOnly = await readRecordedReferenceImages({
    characterIds: [],
    personaId: "fel",
    personaSource: "sprite",
    charactersStore: {
      getById: async () => null,
      getPersona: async (id) => ({
        id,
        avatarPath: "/api/avatars/file/arceana.png",
        useCharacterSheetAsReference: "false",
      }),
    },
  });
  assert.deepEqual(spriteOnly, [], "a sprite-sourced persona never falls back to the avatar");
  // A recorded avatar is sent again even if a character sheet was turned on since. The sheet has
  // different bytes, so the old sheet-first order would return it instead.
  const sheetPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
  mkdirSync(join(fixtureDir, "gallery", "personas", "fel"), { recursive: true });
  writeFileSync(join(fixtureDir, "gallery", "personas", "fel", "sheet.png"), Buffer.from(sheetPng, "base64"));
  const personaSheetGallery = {
    getById: async (id: string) => (id === "sheet-1" ? { personaId: "fel", filePath: "personas/fel/sheet.png" } : null),
  };
  const currentPreference = await readRecordedReferenceImages({
    characterIds: [],
    personaId: "fel",
    personaGallery: personaSheetGallery,
    charactersStore: {
      getById: async () => null,
      getPersona: async (id) => ({
        id,
        avatarPath: "/api/avatars/file/arceana.png",
        characterSheetImageId: "sheet-1",
        useCharacterSheetAsReference: "true",
      }),
    },
  });
  assert.deepEqual(currentPreference, [sheetPng], "without a recorded source the sheet is preferred");
  const recordedAvatar = await readRecordedReferenceImages({
    personaGallery: personaSheetGallery,
    characterIds: [],
    personaId: "fel",
    personaSource: "avatar",
    charactersStore: {
      getById: async () => null,
      getPersona: async (id) => ({
        id,
        avatarPath: "/api/avatars/file/arceana.png",
        characterSheetImageId: "sheet-1",
        useCharacterSheetAsReference: "true",
      }),
    },
  });
  assert.deepEqual(recordedAvatar, [png], "the recorded persona picture wins over the current preference");
  assert.equal(
    parseChatImageGenerationRecord(
      JSON.stringify(buildChatImageGenerationRecord({ referencePersonaId: "fel", referencePersonaSource: "sprite" })),
    )?.references.personaSource,
    "sprite",
  );

  // ── Regenerate route ──
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Regenerate fixture",
    provider: "image_generation",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "dall-e-3",
    imageService: "openai",
    imageGenerationSource: "openai",
    apiKey: "fixture",
    // The default Images connection, used for images saved before records existed.
    defaultForAgents: true,
  });
  assert.ok(connection?.id);
  await createAppSettingsStorage(db).set("ui", JSON.stringify({ autoSaveGeneratedImagesToGalleries: false }));

  const illustration = await gallery.create({
    chatId: chat.id,
    filePath: `${chat.id}/illustration.png`,
    prompt: "1girl, throne room",
    provider: "image_generation",
    model: "dall-e-3",
    width: 896,
    height: 1280,
    generation: buildChatImageGenerationRecord({
      connectionId: connection.id,
      negativePrompt: "lowres",
      characterPrompts: [{ name: "Arceana", prompt: "tall elf queen" }],
    }),
  });
  assert.ok(illustration?.id);
  const message = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "Behind you, Chancellor Rolim scoffs.",
    extra: {
      attachments: [
        { type: "image", url: "/api/gallery/file/old.png", prompt: "1girl, throne room", galleryId: illustration.id },
        { type: "image", url: "/api/gallery/file/other.png", prompt: "other", galleryId: "someone-else" },
      ],
    },
  } as never);
  assert.ok(message?.id);

  const regenerateUrl = `/api/gallery/${chat.id}/images/${illustration.id}/regenerate`;
  const regenerated = await app.inject({
    method: "POST",
    url: regenerateUrl,
    payload: { prompt: "2girls, throne room" },
  });
  assert.equal(regenerated.statusCode, 200, regenerated.body);
  const result = regenerated.json() as {
    image: { id: string; url: string; prompt: string; generation: string; width: number; height: number };
    replacedMessageIds: string[];
  };
  // Edited prompt sent; the saved character prompt rides along (flattened for a non-NovelAI provider).
  assert.equal(imagePrompts.length, 1);
  assert.ok(imagePrompts[0]!.startsWith("2girls, throne room"), imagePrompts[0]);
  assert.ok(imagePrompts[0]!.includes("Arceana: tall elf queen"), imagePrompts[0]);
  assert.notEqual(result.image.id, illustration.id);
  // The row keeps the provider's display prompt; the record keeps the editable one, so the
  // character prompt is never folded in twice on the next regeneration.
  assert.equal(result.image.prompt, "2girls, throne room\n\nArceana: tall elf queen");
  assert.deepEqual([result.image.width, result.image.height], [896, 1280]);
  const newRecord = parseChatImageGenerationRecord(result.image.generation);
  assert.equal(newRecord?.prompt, "2girls, throne room");
  assert.equal(newRecord?.connectionId, connection.id);
  assert.equal(newRecord?.negativePrompt, "lowres", "the saved negative prompt is kept when not edited");
  assert.deepEqual(newRecord?.characterPrompts, [{ name: "Arceana", prompt: "tall elf queen" }]);
  assert.deepEqual(result.replacedMessageIds, [message.id], "found by scanning when no messageId is sent");

  // Both the message mirror and its swipe row now show the new image; the other attachment is untouched.
  const updatedMessage = await chats.getMessage(message.id);
  const swipes = await chats.getSwipes(message.id);
  for (const extra of [updatedMessage?.extra, swipes[0]?.extra]) {
    const attachments = (typeof extra === "string" ? JSON.parse(extra) : extra).attachments;
    assert.equal(attachments[0].galleryId, result.image.id);
    assert.equal(attachments[0].url, result.image.url);
    assert.equal(attachments[0].prompt, result.image.prompt);
    assert.equal(attachments[0].type, "image");
    assert.equal(attachments[1].galleryId, "someone-else");
  }
  assert.ok(await gallery.getById(illustration.id, chat.id), "the old image stays in the gallery");

  // A second message showing the same image (e.g. a copied reply) is updated too, even when
  // the re-roll was opened from the first message.
  const copiedMessage = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "Copied reply.",
    extra: { attachments: [{ type: "image", url: result.image.url, galleryId: result.image.id }] },
  } as never);
  assert.ok(copiedMessage?.id);

  // Editing negative and character prompts, and pointing at the message directly.
  const edited = await app.inject({
    method: "POST",
    url: `/api/gallery/${chat.id}/images/${result.image.id}/regenerate`,
    payload: {
      prompt: "2girls, throne room, night",
      negativePrompt: "",
      characterPrompts: [{ name: "Arceana", prompt: "elf queen, crown" }],
      messageId: message.id,
    },
  });
  assert.equal(edited.statusCode, 200, edited.body);
  const editedResult = edited.json() as { image: { generation: string }; replacedMessageIds: string[] };
  assert.equal(imagePrompts[1], "2girls, throne room, night\n\nArceana: elf queen, crown", "no doubled captions");
  const editedRecord = parseChatImageGenerationRecord(editedResult.image.generation);
  assert.equal(editedRecord?.negativePrompt, "", "an empty negative prompt clears it");
  assert.deepEqual(
    editedResult.replacedMessageIds,
    [message.id, copiedMessage.id],
    "opened message first, then the rest",
  );

  // An image left behind on an inactive swipe is still found from the gallery (no messageId).
  const swipedImage = await gallery.create({
    chatId: chat.id,
    filePath: `${chat.id}/swiped.png`,
    prompt: "swiped away",
    provider: "image_generation",
    model: "dall-e-3",
    generation: buildChatImageGenerationRecord({ prompt: "swiped away", connectionId: connection.id }),
  });
  assert.ok(swipedImage?.id);
  const swipedMessage = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "First take.",
    extra: { attachments: [{ type: "image", url: "/api/gallery/file/swiped.png", galleryId: swipedImage.id }] },
  } as never);
  assert.ok(swipedMessage?.id);
  await chats.addSwipe(swipedMessage.id, "Second take.");
  const swipedMirror = await chats.getMessage(swipedMessage.id);
  assert.ok(!JSON.stringify(swipedMirror?.extra ?? {}).includes(swipedImage.id), "the fresh swipe has no image");
  const swipedResult = await app.inject({
    method: "POST",
    url: `/api/gallery/${chat.id}/images/${swipedImage.id}/regenerate`,
    payload: { prompt: "swiped away, again" },
  });
  assert.equal(swipedResult.statusCode, 200, swipedResult.body);
  const swipedBody = swipedResult.json() as { image: { id: string }; replacedMessageIds: string[] };
  assert.deepEqual(swipedBody.replacedMessageIds, [swipedMessage.id], "inactive swipe rows are scanned too");
  const firstTake = (await chats.getSwipes(swipedMessage.id))[0];
  assert.ok(
    JSON.stringify(firstTake?.extra ?? {}).includes(swipedBody.image.id),
    "the inactive swipe shows the new image",
  );

  // An image saved before records existed still regenerates, on the chat's image connection.
  const legacyRegenerated = await app.inject({
    method: "POST",
    url: `/api/gallery/${chat.id}/images/${legacy!.id}/regenerate`,
    payload: { prompt: "old image, again" },
  });
  assert.equal(legacyRegenerated.statusCode, 200, legacyRegenerated.body);
  const legacyRecord = parseChatImageGenerationRecord(
    (legacyRegenerated.json() as { image: { generation: string } }).image.generation,
  );
  assert.equal(legacyRecord?.connectionId, connection.id);
  assert.deepEqual(
    (legacyRegenerated.json() as { replacedMessageIds: string[] }).replacedMessageIds,
    [],
    "a gallery-only image replaces nothing",
  );

  // A swap that fails partway is rolled back: the first message gets its old image back and the
  // unused new row is removed, so a retry starts clean.
  const sharedImage = await gallery.create({
    chatId: chat.id,
    filePath: `${chat.id}/shared.png`,
    prompt: "shared",
    generation: buildChatImageGenerationRecord({ prompt: "shared", connectionId: connection.id }),
  });
  assert.ok(sharedImage?.id);
  const sharedAttachment = { type: "image", url: "/api/gallery/file/shared.png", galleryId: sharedImage.id };
  const firstShared = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "First.",
    extra: { attachments: [sharedAttachment] },
  } as never);
  const secondShared = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "Second.",
    extra: { attachments: [sharedAttachment] },
  } as never);
  assert.ok(firstShared?.id && secondShared?.id);
  const galleryCountBefore = (await gallery.listByChatId(chat.id)).length;
  const realTransaction = db.transaction.bind(db);
  let transactionCalls = 0;
  db.transaction = ((fn: Parameters<typeof realTransaction>[0]) => {
    transactionCalls += 1;
    if (transactionCalls === 2) return Promise.reject(new Error("simulated storage failure"));
    return realTransaction(fn);
  }) as typeof db.transaction;
  let failedSwap;
  try {
    failedSwap = await app.inject({
      method: "POST",
      url: `/api/gallery/${chat.id}/images/${sharedImage.id}/regenerate`,
      payload: { prompt: "shared, again", messageId: firstShared.id },
    });
  } finally {
    db.transaction = realTransaction as typeof db.transaction;
  }
  assert.equal(failedSwap.statusCode, 502, failedSwap.body);
  assert.equal(transactionCalls, 3, "first swap applied, second failed, first undone");
  for (const id of [firstShared.id, secondShared.id]) {
    const extra = (await chats.getMessage(id))?.extra;
    const attachments = (typeof extra === "string" ? JSON.parse(extra) : extra).attachments;
    assert.equal(attachments[0].galleryId, sharedImage.id, "every message is back on the original image");
  }
  assert.equal((await gallery.listByChatId(chat.id)).length, galleryCountBefore, "the unused new row is removed");

  // If the undo itself fails, the first message still points at the new image, so it is kept.
  transactionCalls = 0;
  db.transaction = ((fn: Parameters<typeof realTransaction>[0]) => {
    transactionCalls += 1;
    if (transactionCalls >= 2) return Promise.reject(new Error("simulated storage failure"));
    return realTransaction(fn);
  }) as typeof db.transaction;
  let failedUndo;
  try {
    failedUndo = await app.inject({
      method: "POST",
      url: `/api/gallery/${chat.id}/images/${sharedImage.id}/regenerate`,
      payload: { prompt: "shared, once more", messageId: firstShared.id },
    });
  } finally {
    db.transaction = realTransaction as typeof db.transaction;
  }
  assert.equal(failedUndo.statusCode, 502, failedUndo.body);
  const strandedExtra = (await chats.getMessage(firstShared.id))?.extra;
  const strandedId = (typeof strandedExtra === "string" ? JSON.parse(strandedExtra) : strandedExtra).attachments[0]
    .galleryId;
  assert.notEqual(strandedId, sharedImage.id, "the failed undo left the first message on the new image");
  assert.ok(await gallery.getById(strandedId, chat.id), "so the new image row is kept, not deleted");

  // Rejections: a picked connection that is gone, an unknown image, an empty prompt.
  const missingConnection = await app.inject({
    method: "POST",
    url: regenerateUrl,
    payload: { prompt: "x", connectionId: "missing-connection" },
  });
  assert.equal(missingConnection.statusCode, 400, missingConnection.body);
  const missingImage = await app.inject({
    method: "POST",
    url: `/api/gallery/${chat.id}/images/missing-image/regenerate`,
    payload: { prompt: "x" },
  });
  assert.equal(missingImage.statusCode, 404, missingImage.body);
  const emptyPrompt = await app.inject({ method: "POST", url: regenerateUrl, payload: { prompt: "   " } });
  assert.notEqual(emptyPrompt.statusCode, 200, "an empty prompt is rejected");
  assert.equal(imagePrompts.length, 6, "rejected requests never reach the provider");

  console.log("chat-image-generation-record: ok (record, storage round trip, regenerate route)");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB?.().catch(() => {});
  rmSync(fixtureDir, { recursive: true, force: true });
}
