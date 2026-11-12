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
process.env.PROVIDER_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { buildChatImageGenerationRecord, parseChatImageGenerationRecord } =
  await import("../../packages/shared/src/utils/chat-image-generation.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { galleryRoutes } = await import("../../packages/server/src/routes/gallery.routes.js");
const { readRecordedReferenceImages } =
  await import("../../packages/server/src/services/image/illustrator-references.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGalleryStorage } = await import("../../packages/server/src/services/storage/gallery.storage.js");

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const imagePrompts: string[] = [];
const promptModelRequests: Array<{
  model?: string;
  messages?: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
}> = [];
let promptModelOutput = "";
let promptModelFinish = "stop";
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  response.writeHead(200, { "content-type": "application/json" });
  if (request.url?.endsWith("/chat/completions")) {
    promptModelRequests.push(body);
    response.end(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: promptModelOutput }, finish_reason: promptModelFinish }],
      }),
    );
    return;
  }
  imagePrompts.push(String(body.prompt));
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
    imagePromptInstructions: "Use concise comma-separated image tags.",
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
  const connections = createConnectionsStorage(db);
  const novelAi = await connections.create({
    name: "Native NovelAI fixture",
    provider: "image_generation",
    baseUrl: "https://image.novelai.net",
    model: "nai-diffusion-5-full",
    imageService: "novelai",
    imagePromptInstructions: "Use concise comma-separated image tags.",
    apiKey: "fixture",
  });
  assert.ok(novelAi?.id);
  const textFixture = {
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "fixture",
  } as const;
  const promptModel = await connections.create({
    ...textFixture,
    name: "Prompt model fixture",
    model: "fixture-prompt-model",
  });
  assert.ok(promptModel?.id);
  const agentsDefault = await connections.create({
    ...textFixture,
    name: "Agents default fixture",
    model: "fixture-agents-default",
    defaultForAgents: true,
    maxTokensOverride: 2100,
  });
  const illustratorModel = await connections.create({
    ...textFixture,
    name: "Illustrator model fixture",
    model: "fixture-illustrator-model",
  });
  const chatModel = await connections.create({
    ...textFixture,
    name: "Chat model fixture",
    model: "fixture-chat-model",
  });
  await connections.updateDefaultParameters(illustratorModel.id, { temperature: 0.55 });
  await connections.updateDefaultParameters(agentsDefault.id, { enabledParameters: { temperature: false } });
  const agents = createAgentsStorage(db);
  const illustrator = await agents.create({
    type: "illustrator",
    name: "Illustrator",
    description: "",
    phase: "post_processing",
    connectionId: illustratorModel.id,
    imagePath: null,
    promptTemplate: "",
    settings: { maxTokens: 5230 },
  });
  assert.ok(agentsDefault?.id && illustrator?.id && chatModel?.id);
  await chats.update(chat.id, { connectionId: chatModel.id });
  await chats.updateMetadata(chat.id, { illustratorPromptConnectionId: promptModel.id });

  const draft = {
    connectionId: novelAi.id,
    prompt: "1girl, 1boy, throne room",
    negativePrompt: "lowres",
    characterPrompts: [
      { name: "Arceana", prompt: "tall elf queen", position: { x: 0.7, y: 0.5 } },
      { name: "Rolim", prompt: "chancellor", negativePrompt: "crown" },
    ],
  };
  const guidedDraft = { ...draft, guidance: "Make it dusk and give the queen a silver cloak." };
  promptModelOutput = JSON.stringify({
    prompt: "1girl, 1boy, throne room, dusk",
    negativePrompt: "lowres, oversaturated",
    characterPrompts: [
      { id: 1, prompt: "chancellor", negativePrompt: "" },
      { id: 0, prompt: "tall elf queen, silver cloak", negativePrompt: "gold cloak" },
    ],
  });
  const beforeRewrite = await gallery.listByChatId(chat.id);
  const messageBeforeRewrite = await chats.getMessage(message.id);
  const rewritten = await app.inject({ method: "POST", url: `${regenerateUrl}/prompt`, payload: guidedDraft });
  assert.equal(rewritten.statusCode, 200, rewritten.body);
  const expectedRewrite = {
    prompt: "1girl, 1boy, throne room, dusk",
    negativePrompt: "lowres, oversaturated",
    characterPrompts: [
      { ...draft.characterPrompts[0], prompt: "tall elf queen, silver cloak", negativePrompt: "gold cloak" },
      { ...draft.characterPrompts[1], negativePrompt: "" },
    ],
  };
  assert.deepEqual(
    rewritten.json(),
    expectedRewrite,
    "rewrites all prompt fields while keeping character identity and position",
  );
  assert.equal(promptModelRequests.length, 1);
  assert.equal(promptModelRequests[0]?.model, "fixture-prompt-model");
  assert.equal(promptModelRequests[0]?.max_tokens, 5230, "rewrites inherit Illustrator's saved output budget");
  assert.equal(promptModelRequests[0]?.temperature, 0.55);
  const promptMessages = promptModelRequests[0]?.messages ?? [];
  assert.match(
    promptMessages.find(({ role }) => role === "system")?.content ?? "",
    /native NovelAI character prompts[\s\S]*"characterPrompts"[\s\S]*Use concise comma-separated image tags/,
  );
  const sentDraft = JSON.parse(promptMessages.find(({ role }) => role === "user")?.content ?? "");
  assert.equal(sentDraft.guidance, guidedDraft.guidance);
  assert.equal(Object.keys(sentDraft).at(-1), "guidance", "guidance comes after the draft in the model context");
  assert.equal(sentDraft.prompt, draft.prompt, "the current draft takes precedence over the saved image prompt");
  assert.deepEqual(await gallery.listByChatId(chat.id), beforeRewrite);
  assert.deepEqual(await chats.getMessage(message.id), messageBeforeRewrite);
  assert.equal(imagePrompts.length, 0, "prompt rewriting does not call the image provider");

  const jsonPrompt = JSON.stringify({ scene: "throne room", lighting: "dusk" });
  promptModelOutput = JSON.stringify({ ...JSON.parse(promptModelOutput), prompt: jsonPrompt });
  const withoutGuidance = await app.inject({
    method: "POST",
    url: `${regenerateUrl}/prompt`,
    payload: { ...draft, prompt: jsonPrompt },
  });
  assert.equal(withoutGuidance.statusCode, 200, withoutGuidance.body);
  assert.equal(withoutGuidance.json().prompt, jsonPrompt, "the rewritten image prompt can itself be JSON text");
  const unguidedDraft = JSON.parse(
    promptModelRequests[1]?.messages?.find(({ role }) => role === "user")?.content ?? "",
  );
  assert.equal(unguidedDraft.guidance, "");
  assert.equal(unguidedDraft.prompt, jsonPrompt);

  promptModelOutput = JSON.stringify({
    prompt: expectedRewrite.prompt,
    negativePrompt: expectedRewrite.negativePrompt,
    characterPrompts: [
      { id: 0, prompt: "silver cloak", negativePrompt: "" },
      { id: 0, prompt: "chancellor", negativePrompt: "" },
    ],
  });
  const invalidRewrite = await app.inject({ method: "POST", url: `${regenerateUrl}/prompt`, payload: guidedDraft });
  assert.equal(invalidRewrite.statusCode, 502, invalidRewrite.body);
  assert.match(invalidRewrite.json().error, /duplicate.*character IDs/);
  promptModelOutput = JSON.stringify({ ...expectedRewrite, characterPrompts: [] });
  const missingCharacters = await app.inject({ method: "POST", url: `${regenerateUrl}/prompt`, payload: guidedDraft });
  assert.equal(missingCharacters.statusCode, 502, missingCharacters.body);
  assert.match(missingCharacters.json().error, /missing.*character IDs/);
  const unknownImage = await app.inject({
    method: "POST",
    url: `/api/gallery/${chat.id}/images/missing-image/regenerate/prompt`,
    payload: guidedDraft,
  });
  assert.equal(unknownImage.statusCode, 404, unknownImage.body);
  await chats.updateMetadata(chat.id, { illustratorPromptConnectionId: "missing-text-connection" });
  const noPromptModel = await app.inject({ method: "POST", url: `${regenerateUrl}/prompt`, payload: guidedDraft });
  assert.equal(noPromptModel.statusCode, 400, noPromptModel.body);
  assert.equal(
    promptModelRequests.length,
    4,
    "unknown images and missing text connections never reach the text provider",
  );
  assert.equal(imagePrompts.length, 0);

  await chats.updateMetadata(chat.id, { illustratorPromptConnectionId: null });
  const repairedJson = JSON.stringify({
    prompt: jsonPrompt,
    negativePrompt: expectedRewrite.negativePrompt,
    characterPrompts: expectedRewrite.characterPrompts.map(({ prompt, negativePrompt }, id) => ({
      id,
      prompt,
      negativePrompt,
    })),
  }).replace(/}$/, ",}");
  promptModelOutput = [
    "<think>Consider the prompt.</think>",
    "Here is the revision:",
    "```json",
    repairedJson,
    "```",
  ].join("\n");
  const repaired = await app.inject({ method: "POST", url: `${regenerateUrl}/prompt`, payload: guidedDraft });
  assert.equal(repaired.statusCode, 200, repaired.body);
  assert.equal(promptModelRequests.at(-1)?.model, "fixture-illustrator-model");
  assert.equal(promptModelRequests.at(-1)?.temperature, 0.55, "a saved connection temperature takes precedence");
  assert.deepEqual(
    repaired.json(),
    { ...expectedRewrite, prompt: jsonPrompt },
    "repairs wrapped JSON without changing its strings",
  );

  await agents.update(illustrator.id, { connectionId: null });
  promptModelFinish = "length";
  const cutOff = await app.inject({ method: "POST", url: `${regenerateUrl}/prompt`, payload: guidedDraft });
  assert.equal(cutOff.statusCode, 502, cutOff.body);
  assert.match(cutOff.json().error, /output limit/);
  assert.equal(promptModelRequests.at(-1)?.model, "fixture-agents-default");
  assert.equal(promptModelRequests.at(-1)?.max_tokens, 2100, "the selected Agents connection caps the output budget");
  assert.equal(promptModelRequests.at(-1)?.temperature, undefined, "the selected connection can omit temperature");
  promptModelFinish = "stop";

  const qwen = await connections.create({
    name: "Qwen image fixture",
    provider: "image_generation",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "qwen-image",
    imageService: "openai",
    apiKey: "fixture",
  });
  assert.ok(qwen?.id);
  const baseRewrite = { prompt: expectedRewrite.prompt, negativePrompt: expectedRewrite.negativePrompt };
  promptModelOutput = JSON.stringify({
    ...baseRewrite,
    characterPrompts: [{ id: 0, prompt: "Invented caption", negativePrompt: "" }],
  });
  const plainDraft = { ...guidedDraft, connectionId: qwen.id, characterPrompts: [] };
  const plainRewrite = await app.inject({ method: "POST", url: `${regenerateUrl}/prompt`, payload: plainDraft });
  assert.equal(plainRewrite.statusCode, 200, plainRewrite.body);
  assert.deepEqual(plainRewrite.json(), { ...baseRewrite, characterPrompts: [] });
  const plainMessages = promptModelRequests.at(-1)?.messages ?? [];
  const plainSystem = plainMessages.find(({ role }) => role === "system")?.content ?? "";
  assert.ok(plainSystem.includes('{"prompt":"…","negativePrompt":"…"}'));
  assert.doesNotMatch(plainSystem, /characterPrompts|NovelAI/);
  const plainInput = JSON.parse(plainMessages.find(({ role }) => role === "user")?.content ?? "");
  assert.deepEqual(plainInput, {
    prompt: plainDraft.prompt,
    negativePrompt: plainDraft.negativePrompt,
    guidance: plainDraft.guidance,
  });

  // Qwen gets the captions appended to its prompt, so guidance has to revise them too.
  const switchedPayload = { ...guidedDraft, connectionId: qwen.id };
  promptModelOutput = JSON.stringify({
    ...baseRewrite,
    characterPrompts: [
      { id: 1, prompt: "chancellor", negativePrompt: "", name: "Renamed", position: { x: 0.9, y: 0.9 } },
      { id: 0, prompt: "tall elf queen, silver cloak", negativePrompt: "gold cloak" },
    ],
  });
  const switchedRewrite = await app.inject({
    method: "POST",
    url: `${regenerateUrl}/prompt`,
    payload: switchedPayload,
  });
  assert.equal(switchedRewrite.statusCode, 200, switchedRewrite.body);
  assert.deepEqual(
    switchedRewrite.json(),
    expectedRewrite,
    "flattened captions are revised in place and keep their names and positions",
  );
  const switchedMessages = promptModelRequests.at(-1)?.messages ?? [];
  const switchedSystem = switchedMessages.find(({ role }) => role === "system")?.content ?? "";
  assert.match(switchedSystem, /no native character prompts/);
  assert.match(switchedSystem, /Do not add or remove characters/);
  assert.doesNotMatch(switchedSystem, /NovelAI/);
  const switchedInput = JSON.parse(switchedMessages.find(({ role }) => role === "user")?.content ?? "");
  assert.deepEqual(
    switchedInput.characterPrompts.map(({ id, name }: { id: number; name: string }) => [id, name]),
    guidedDraft.characterPrompts.map(({ name }, id) => [id, name]),
  );
  promptModelOutput = JSON.stringify({
    ...baseRewrite,
    characterPrompts: [
      { id: 0, prompt: "tall elf queen", negativePrompt: "" },
      { id: 1, prompt: "chancellor", negativePrompt: "" },
      { id: 2, prompt: "royal guard", negativePrompt: "" },
    ],
  });
  const addedFlatCaption = await app.inject({
    method: "POST",
    url: `${regenerateUrl}/prompt`,
    payload: switchedPayload,
  });
  assert.equal(addedFlatCaption.statusCode, 502, addedFlatCaption.body);
  assert.match(addedFlatCaption.json().error, /extra character IDs/);

  const qwenImage = await gallery.create({
    chatId: chat.id,
    filePath: `${chat.id}/qwen.png`,
    prompt: "1girl, solo, tall elf queen, throne room",
    provider: "image_generation",
    model: qwen.model,
    width: 896,
    height: 1280,
    generation: buildChatImageGenerationRecord({ connectionId: qwen.id }),
  });
  assert.ok(qwenImage?.id);
  const soloCaption = { name: "Elf queen", prompt: "girl, tall elf queen, silver cloak", negativePrompt: "" };
  const convertedDraft = {
    ...plainDraft,
    prompt: qwenImage.prompt,
    connectionId: novelAi.id,
    guidance: "Move the queen into a separate character prompt.",
  };
  const expectedConversion = {
    prompt: "1girl, solo, throne room",
    negativePrompt: baseRewrite.negativePrompt,
    characterPrompts: [soloCaption],
  };
  promptModelOutput = JSON.stringify({
    ...expectedConversion,
    characterPrompts: [{ ...soloCaption, position: "" }],
  });
  const converted = await app.inject({
    method: "POST",
    url: `/api/gallery/${chat.id}/images/${qwenImage.id}/regenerate/prompt`,
    payload: convertedDraft,
  });
  assert.equal(converted.statusCode, 200, converted.body);
  assert.deepEqual(converted.json(), expectedConversion, "an empty position leaves placement to NovelAI");
  const conversionMessages = promptModelRequests.at(-1)?.messages ?? [];
  assert.match(conversionMessages.find(({ role }) => role === "system")?.content ?? "", /including solo subjects/);
  const conversionInput = JSON.parse(conversionMessages.find(({ role }) => role === "user")?.content ?? "");
  assert.deepEqual(conversionInput.characterPrompts, []);
  assert.equal(conversionInput.guidance, convertedDraft.guidance);

  const revisedPosition = { x: 0.2, y: 0.65 };
  promptModelOutput = JSON.stringify({
    ...baseRewrite,
    characterPrompts: [
      { id: 0, prompt: "tall elf queen", negativePrompt: "", position: revisedPosition },
      { id: 1, prompt: "chancellor", negativePrompt: "crown", position: "" },
    ],
  });
  const positionedDraft = {
    ...guidedDraft,
    guidance: "Move the queen to x 0.2 and y 0.65.",
    characterPrompts: [
      guidedDraft.characterPrompts[0],
      { ...guidedDraft.characterPrompts[1], position: { x: 0.75, y: 0.5 } },
    ],
  };
  const repositioned = await app.inject({ method: "POST", url: `${regenerateUrl}/prompt`, payload: positionedDraft });
  assert.equal(repositioned.statusCode, 200, repositioned.body);
  assert.deepEqual(repositioned.json().characterPrompts, [
    { ...positionedDraft.characterPrompts[0], negativePrompt: "", position: revisedPosition },
    positionedDraft.characterPrompts[1],
  ]);

  const soloDraft = {
    ...draft,
    prompt: "1girl, solo, throne room",
    characterPrompts: [draft.characterPrompts[0]],
    guidance: "Add a knight named Mira to the scene.",
  };
  const newCaption = {
    prompt: "girl, Mira, knight, silver armor",
    negativePrompt: "crown",
    position: { x: 0.3, y: 0.5 },
  };
  for (const name of [undefined, "Mira"]) {
    promptModelOutput = JSON.stringify({
      ...baseRewrite,
      prompt: "2girls, throne room",
      characterPrompts: [
        { id: 1, name, ...newCaption },
        { id: 0, prompt: "tall elf queen", negativePrompt: "" },
      ],
    });
    const added = await app.inject({ method: "POST", url: `${regenerateUrl}/prompt`, payload: soloDraft });
    assert.equal(added.statusCode, 200, added.body);
    assert.deepEqual(added.json(), {
      prompt: "2girls, throne room",
      negativePrompt: baseRewrite.negativePrompt,
      characterPrompts: [
        { ...soloDraft.characterPrompts[0], negativePrompt: "" },
        { name: name ?? "Character 2", ...newCaption },
      ],
    });
  }
  const additionMessages = promptModelRequests.at(-1)?.messages ?? [];
  assert.match(additionMessages.find(({ role }) => role === "system")?.content ?? "", /new characters requested/);

  promptModelOutput = '{"prompt":"unfinished';
  const invalidJson = await app.inject({ method: "POST", url: `${regenerateUrl}/prompt`, payload: soloDraft });
  assert.equal(invalidJson.statusCode, 502, invalidJson.body);
  assert.match(invalidJson.json().error, /valid JSON object/);
  promptModelOutput = JSON.stringify({ prompt: "", negativePrompt: "", characterPrompts: [] });
  const invalidFields = await app.inject({ method: "POST", url: `${regenerateUrl}/prompt`, payload: soloDraft });
  assert.equal(invalidFields.statusCode, 502, invalidFields.body);
  assert.match(invalidFields.json().error, /invalid prompt fields/);

  const novelAiV45 = await connections.create({
    name: "NovelAI V4.5 fixture",
    provider: "image_generation",
    baseUrl: "https://image.novelai.net",
    model: "nai-diffusion-4-5-full",
    imageService: "novelai",
    apiKey: "fixture",
  });
  assert.ok(novelAiV45?.id);
  const oversizedDraft = {
    ...draft,
    connectionId: novelAiV45.id,
    characterPrompts: Array.from({ length: 7 }, (_, index) => ({
      name: `Character ${index + 1}`,
      prompt: "elf, silver cloak",
    })),
  };
  const requestsBeforeLimitCheck = promptModelRequests.length;
  for (const url of [`${regenerateUrl}/prompt`, regenerateUrl]) {
    const response = await app.inject({ method: "POST", url, payload: oversizedDraft });
    assert.equal(response.statusCode, 400, response.body);
    assert.match(response.json().error, /accepts up to 6 character prompts/);
  }
  assert.equal(promptModelRequests.length, requestsBeforeLimitCheck, "oversized drafts never reach the text provider");
  promptModelOutput = JSON.stringify({
    ...baseRewrite,
    characterPrompts: oversizedDraft.characterPrompts.map((character, id) => ({
      ...character,
      id,
      negativePrompt: "",
    })),
  });
  const oversizedRewrite = await app.inject({
    method: "POST",
    url: `${regenerateUrl}/prompt`,
    payload: { ...oversizedDraft, characterPrompts: oversizedDraft.characterPrompts.slice(0, 6) },
  });
  assert.equal(oversizedRewrite.statusCode, 502, oversizedRewrite.body);
  assert.match(oversizedRewrite.json().error, /returned 7 character prompts.*accepts up to 6/);
  assert.equal(imagePrompts.length, 0);

  const requestsBeforeImage = promptModelRequests.length;
  const regenerated = await app.inject({
    method: "POST",
    url: regenerateUrl,
    payload: { prompt: "2girls, throne room" },
  });
  assert.equal(regenerated.statusCode, 200, regenerated.body);
  assert.equal(
    promptModelRequests.length,
    requestsBeforeImage,
    "image-only regeneration does not call the Prompt Model",
  );
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

  const fromRewrite = await app.inject({ method: "POST", url: regenerateUrl, payload: rewritten.json() });
  assert.equal(fromRewrite.statusCode, 200, fromRewrite.body);
  assert.match(imagePrompts.at(-1) ?? "", /^1girl, 1boy, throne room, dusk/);
  assert.match(imagePrompts.at(-1) ?? "", /Arceana: tall elf queen, silver cloak/);
  const fromRewriteRecord = parseChatImageGenerationRecord(fromRewrite.json().image.generation);
  assert.equal(fromRewriteRecord?.negativePrompt, expectedRewrite.negativePrompt);
  assert.deepEqual(fromRewriteRecord?.characterPrompts, [
    expectedRewrite.characterPrompts[0],
    { name: "Rolim", prompt: "chancellor" },
  ]);

  console.log("chat-image-generation-record: ok (record, storage round trip, regenerate route)");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB?.().catch(() => {});
  rmSync(fixtureDir, { recursive: true, force: true });
}
