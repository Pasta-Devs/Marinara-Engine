// #7357: through the real routes, with a fake text model and image service, every image prompt writer gets
// the image connection's Image Prompting Instructions and the Style text as guidance, and the prompt sent to
// the image service (or shown in Image Prompt Review) never carries a sentence of either the writer copied.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-image-prompt-guidance-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { galleryRoutes } = await import("../../packages/server/src/routes/gallery.routes.js");
const { handleConversationSelfieCommand } =
  await import("../../packages/server/src/services/generation/conversation-selfie-command-runtime.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema, replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");

replaceBuiltInAgentDefinitions([
  {
    id: "illustrator",
    name: "Illustrator",
    description: "Guidance fixture",
    phase: "post_processing",
    enabledByDefault: true,
    category: "utility",
    defaultTools: [],
    defaultSettings: { contextSize: 2 },
    defaultPromptTemplate: 'AGENT_WRITER Return JSON {"shouldGenerate":true,"prompt":"...","style":"visual style"}.',
  },
]);

const DANBOORU = "Danbooru-tagged anime generation for SDXL, Illustrious, Pony, NovelAI, and similar checkpoints.";
const WATERCOLOR = "Soft watercolor wash with visible paper texture and gentle bleeding edges.";
const INSTRUCTIONS = "Write everything in capital letters.";
const SUBJECT = "1GIRL, SOLO, SILVER HAIR, RAIN";
const COPIED = /Danbooru-tagged anime generation|watercolor wash|Write everything in capital letters/iu;
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// The writers obey the instructions (capital letters) but also echo the guidance: the Illustrator's JSON
// "style" is nothing but the Style text, which used to be pasted in front of the image prompt.
const writerRequests: Record<string, string> = {};
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
  const messages = JSON.stringify(body.messages);
  const writer = messages.includes("character-free scene background prompt")
    ? "background"
    : messages.includes("manual Gallery illustration request")
      ? "manual"
      : messages.includes("AGENT_WRITER")
        ? "agent"
        : messages.includes("image prompt generator")
          ? "selfie"
          : "";
  if (writer) writerRequests[writer] = messages;
  const content = {
    background: JSON.stringify({ locationName: "garden", prompt: `RAINY GARDEN, ${DANBOORU}`, tags: ["garden"] }),
    manual: JSON.stringify({ prompt: `${SUBJECT}, ${INSTRUCTIONS}`, style: DANBOORU.slice(0, -1) }),
    agent: JSON.stringify({ shouldGenerate: true, prompt: `${SUBJECT}, ${INSTRUCTIONS}`, style: DANBOORU }),
    selfie: `1GIRL, SELFIE, ${WATERCOLOR} ${INSTRUCTIONS}`,
    "": "Aster steps into the silver rain.",
  }[writer];
  response.end(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { total_tokens: 20 },
    }),
  );
});
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(galleryRoutes, { prefix: "/api/gallery" });
const chats = createChatsStorage(db);
const parseEvents = (body: string) =>
  body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
const assertGuided = (writer: string, styleText: RegExp) => {
  const request = writerRequests[writer];
  assert.ok(request, `the ${writer} writer ran`);
  assert.match(request, /<image_prompting_instructions>[^<]*Write everything in capital letters/u, writer);
  assert.match(request, styleText, `the ${writer} writer gets the Style text`);
};
const assertClean = (prompt: string, subject: RegExp) => {
  assert.doesNotMatch(prompt, COPIED, prompt);
  assert.match(prompt, subject, prompt);
};
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const connections = createConnectionsStorage(db);
  const text = await connections.create({
    name: "Text fixture",
    provider: "custom",
    baseUrl,
    model: "fixture",
    apiKey: "fixture",
  });
  const image = await connections.create({
    name: "Image fixture",
    provider: "image_generation",
    baseUrl,
    model: "dall-e-3",
    imageService: "openai",
    imageGenerationSource: "openai",
    apiKey: "fixture",
    imagePromptInstructions: INSTRUCTIONS,
  });
  await createAgentsStorage(db).create({
    type: "illustrator",
    name: "Illustrator",
    phase: "post_processing",
    connectionId: text.id,
    settings: { imageConnectionId: image.id, contextSize: 2, enabledTools: [] },
  });
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Aster" }));
  const preset = await createPromptsStorage(db).create({ name: "Fixture", parameters: {}, wrapFormat: "xml" });
  assert.ok(preset);
  await createPromptsStorage(db).createSection({
    presetId: preset.id,
    identifier: "history",
    name: "History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const roleplay = await chats.create({
    name: "Roleplay",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: text.id,
    promptPresetId: preset.id,
  });
  assert.ok(roleplay);
  await chats.patchMetadata(roleplay.id, {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    imageStyleProfileId: "danbooru",
    illustratorUseAvatarReferences: false,
    illustratorIncludeCharacterAppearance: false,
    automaticSummaryEnabled: false,
  });
  await createAppSettingsStorage(db).set(
    "ui",
    JSON.stringify({
      autoSaveGeneratedImagesToGalleries: false,
      // A user's copy of Auto with their own Style text.
      imageStyleProfiles: {
        defaultProfileId: "auto",
        profiles: [{ id: "my-auto", name: "My Auto", baseStyle: "auto", styleText: WATERCOLOR }],
      },
    }),
  );

  // The Illustrator after a fresh reply.
  const generated = await app.inject({
    method: "POST",
    url: "/api/generate",
    payload: { chatId: roleplay.id, userMessage: "Aster walks into the rain.", streaming: false },
  });
  assert.equal(generated.statusCode, 200, generated.body);
  assertGuided("agent", /Danbooru-tagged anime generation/u);
  assert.equal(imagePrompts.length, 1, generated.body);
  assertClean(imagePrompts[0]!, /^masterpiece, best quality.*1GIRL, SOLO, SILVER HAIR, RAIN/u);

  // Image Prompt Review for an Illustrator re-run and for the Illustration button.
  for (const [writer, targets] of [
    ["agent", undefined],
    ["manual", ["illustration"]],
  ] as const) {
    delete writerRequests[writer];
    const retried = await app.inject({
      method: "POST",
      url: "/api/generate/retry-agents",
      payload: {
        chatId: roleplay.id,
        agentTypes: ["illustrator"],
        streaming: false,
        reviewImagePromptsBeforeSend: true,
        illustratorRetryTargets: targets,
      },
    });
    const review = parseEvents(retried.body).find((event) => event.type === "image_prompt_review");
    assert.ok(review, retried.body);
    assertGuided(writer, /Danbooru-tagged anime generation/u);
    assertClean(review.data.item.prompt, /1GIRL, SOLO, SILVER HAIR, RAIN$/u);
  }

  // The scene background writer.
  const background = await app.inject({
    method: "POST",
    url: "/api/generate/retry-agents",
    payload: {
      chatId: roleplay.id,
      agentTypes: ["illustrator"],
      streaming: false,
      reviewImagePromptsBeforeSend: true,
      illustratorRetryTargets: ["background"],
    },
  });
  const backgroundReview = parseEvents(background.body).find((event) => event.type === "image_prompt_review");
  assert.ok(backgroundReview, background.body);
  assertGuided("background", /Danbooru-tagged anime generation/u);
  assertClean(backgroundReview.data.item.prompt, /RAINY GARDEN$/u);

  // Conversation selfies from the Gallery and from /selfie, with the user's Auto copy.
  const conversation = await chats.create({
    name: "Conversation",
    mode: "conversation",
    characterIds: [character.id],
    connectionId: text.id,
  });
  assert.ok(conversation);
  const conversationMeta = { imageGenConnectionId: image.id, imageStyleProfileId: "my-auto" };
  await chats.patchMetadata(conversation.id, conversationMeta);
  const gallerySelfie = await app.inject({
    method: "POST",
    url: `/api/gallery/${conversation.id}/selfie`,
    payload: { characterId: character.id, previewOnly: true },
  });
  assert.equal(gallerySelfie.statusCode, 200, gallerySelfie.body);
  assertGuided("selfie", /watercolor wash/u);
  assertClean(JSON.parse(gallerySelfie.body).items[0].prompt, /^1GIRL, SELFIE$/u);
  delete writerRequests.selfie;
  imagePrompts.length = 0;
  await handleConversationSelfieCommand({
    command: { type: "selfie" } as Parameters<typeof handleConversationSelfieCommand>[0]["command"],
    characterId: character.id,
    chatId: conversation.id,
    // A configured positive prompt stays as written, even when it repeats an instruction.
    chatMeta: { ...conversationMeta, selfiePositivePrompt: "Write in capital letters" },
    charInfo: [],
    persona: null,
    promptConnection: (await connections.getWithKey(text.id))!,
    promptConnectionId: text.id,
    serviceTier: null,
    db,
    chars: createCharactersStorage(db),
    chats,
    connections,
    sendEvent: () => {},
  });
  assertGuided("selfie", /watercolor wash/u);
  assert.equal(imagePrompts.length, 1);
  assertClean(imagePrompts[0]!, /^1GIRL, SELFIE, Write in capital letters$/u);
  console.info("Image prompt writers follow Image Prompting Instructions and Style text without pasting them.");
} finally {
  provider.closeAllConnections();
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}
