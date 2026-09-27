// Exercise the real retry route: selected history, review/resume, image attachments and gallery opt-out.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-illustrator-range-"));
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
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createGalleryStorage } = await import("../../packages/server/src/services/storage/gallery.storage.js");
const { createCharacterGalleryStorage } =
  await import("../../packages/server/src/services/storage/character-gallery.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { characterDataSchema, replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
replaceBuiltInAgentDefinitions([
  {
    id: "illustrator",
    name: "Illustrator",
    description: "Range fixture",
    phase: "post_processing",
    enabledByDefault: true,
    category: "utility",
    defaultTools: [],
    defaultSettings: { contextSize: 1 },
    defaultPromptTemplate: "Write a scene image prompt.",
  },
]);
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const textRequests: string[] = [];
let imageRequests = 0;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/images/generations")) {
    imageRequests++;
    response.end(JSON.stringify({ data: [{ b64_json: png }] }));
  } else {
    textRequests.push(JSON.stringify(body.messages));
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                prompt: "Aster in the old garden",
                characters: ["Aster"],
                reason: "Selected historical scene",
              }),
            },
          },
        ],
        usage: { total_tokens: 20 },
      }),
    );
  }
});
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
const chats = createChatsStorage(db);
const gallery = createGalleryStorage(db);
const characterGallery = createCharacterGalleryStorage(db);
const settings = createAppSettingsStorage(db);
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const connections = createConnectionsStorage(db);
  const textConnection = await connections.create({
    name: "Text fixture",
    provider: "custom",
    baseUrl,
    model: "fixture",
    apiKey: "fixture",
  });
  const imageConnection = await connections.create({
    name: "Image fixture",
    provider: "image_generation",
    baseUrl,
    model: "dall-e-3",
    imageService: "openai",
    imageGenerationSource: "openai",
    apiKey: "fixture",
  });
  await createAgentsStorage(db).create({
    type: "illustrator",
    name: "Illustrator",
    phase: "post_processing",
    connectionId: textConnection.id,
    settings: { imageConnectionId: imageConnection.id, contextSize: 1, enabledTools: [] },
  });
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Aster" }));
  const chat = await chats.create({
    name: "Historical range",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: textConnection.id,
    promptPresetId: null,
  });
  assert.ok(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    advancedMemory: true,
    attachSummariesToAgents: true,
    illustratorUseAvatarReferences: false,
    illustratorIncludeCharacterAppearance: false,
  });
  const messages = [];
  for (const [role, content, extra] of [
    ["assistant", "OUTSIDE_EARLIER", {}],
    ["user", "SELECTED_GARDEN_REQUEST", {}],
    ["assistant", "HIDDEN_SCENE", { hiddenFromAI: true }],
    ["assistant", "SELECTED_GARDEN_RESPONSE", {}],
    ["user", "FUTURE_CONVERSATION", { isConversationStart: true }],
    ["assistant", "FUTURE_REPLY", {}],
  ] as const) {
    const message = await chats.createMessage({ chatId: chat.id, role, content, extra: { ...extra } });
    assert.ok(message);
    messages.push(message);
  }
  const range = [messages[1]!.id, messages[3]!.id];
  const retry = (overrides: Record<string, unknown> = {}) =>
    app.inject({
      method: "POST",
      url: "/api/generate/retry-agents",
      payload: {
        chatId: chat.id,
        agentTypes: ["illustrator"],
        streaming: false,
        illustratorRetryTargets: ["illustration"],
        illustratorMessageRange: range,
        ...overrides,
      },
    });
  const parseEvents = (body: string) =>
    body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));
  await settings.set("ui", JSON.stringify({ autoSaveGeneratedImagesToGalleries: false }));
  const reviewed = await retry({ reviewImagePromptsBeforeSend: true });
  assert.equal(reviewed.statusCode, 200, reviewed.body);
  const review = parseEvents(reviewed.body).find((event) => event.type === "image_prompt_review");
  assert.ok(review, reviewed.body);
  assert.equal(imageRequests, 0, "prompt review must not generate an image yet");
  assert.equal(textRequests.length, 1);
  assert.match(textRequests[0]!, /SELECTED_GARDEN_REQUEST/);
  assert.match(textRequests[0]!, /SELECTED_GARDEN_RESPONSE/);
  assert.doesNotMatch(textRequests[0]!, /OUTSIDE_EARLIER|HIDDEN_SCENE|FUTURE_/);
  const override = { prompt: review.data.item.prompt, resultData: review.data.resultData };
  const resumed = await retry({ illustratorPromptReviewOverride: override });
  assert.ok(
    parseEvents(resumed.body).some((event) => event.type === "illustration"),
    resumed.body,
  );
  assert.equal(textRequests.length, 1, "review resume reuses the selected prompt");
  const images = await gallery.listByChatId(chat.id);
  assert.equal(images.length, 1, "opt-out preserves the chat gallery");
  assert.ok(existsSync(join(fixtureDir, "gallery", images[0]!.filePath)));
  assert.equal((await characterGallery.listByCharacterId(character.id)).length, 0);
  assert.equal(JSON.parse((await chats.getMessage(messages[3]!.id))!.extra).attachments.length, 1);
  assert.equal(
    JSON.parse((await chats.getMessage(messages[5]!.id))!.extra).attachments,
    undefined,
    "latest message must not receive a historical image",
  );

  // A single user message is a valid range, and the unchanged default still auto-saves.
  await settings.set("ui", "{}");
  const single = await retry({ illustratorMessageRange: [messages[1]!.id, messages[1]!.id] });
  assert.ok(
    parseEvents(single.body).some((event) => event.type === "illustration"),
    single.body,
  );
  assert.match(textRequests.at(-1)!, /SELECTED_GARDEN_REQUEST/);
  assert.doesNotMatch(textRequests.at(-1)!, /SELECTED_GARDEN_RESPONSE|FUTURE_|OUTSIDE_EARLIER/);
  assert.equal((await characterGallery.listByCharacterId(character.id)).length, 1);
  assert.equal(JSON.parse((await chats.getMessage(messages[1]!.id))!.extra).attachments.length, 1);

  const beforeRequests = textRequests.length + imageRequests;
  for (const invalid of [
    [],
    [messages[1]!.id],
    [null, null],
    [range[1], range[0]],
    ["other-chat", range[1]],
    [messages[2]!.id, messages[2]!.id],
  ]) {
    const result = await retry({ illustratorMessageRange: invalid });
    assert.ok(
      result.statusCode === 400 || parseEvents(result.body).some((event) => event.type === "error"),
      result.body,
    );
  }
  assert.equal((await retry({ agentTypes: ["illustrator", "echo-chamber"] })).statusCode, 400);
  assert.equal(textRequests.length + imageRequests, beforeRequests, "invalid ranges never call a provider");
  const ordinary = await retry({ illustratorMessageRange: undefined });
  assert.ok(
    parseEvents(ordinary.body).some((event) => event.type === "illustration"),
    ordinary.body,
  );
  assert.match(textRequests.at(-1)!, /FUTURE_REPLY/);
  assert.doesNotMatch(textRequests.at(-1)!, /SELECTED_GARDEN/);
  console.info("Historical Illustrator range, review and gallery setting regressions passed.");
} finally {
  provider.closeAllConnections();
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}
