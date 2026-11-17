// Pictures drawn with a reply, through the real generate and retry routes on a fresh database in a temporary folder,
// with a stand-in text model and image service:
// - each image agent's picture uses that agent's own settings: a custom image agent's goes to its image connection,
//   not the Illustrator's;
// - the characters in the picture come from the user's latest message too, but the user's Persona is never added
//   just for being named;
// - Roleplay pictures use the Illustration size, and Game pictures the Game scene size.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-illustrator-reply-images-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema, replaceBuiltInAgentDefinitions } = await import("../../../packages/shared/dist/index.js");

replaceBuiltInAgentDefinitions([
  {
    id: "illustrator",
    name: "Illustrator",
    description: "Reply image fixture",
    phase: "post_processing",
    enabledByDefault: false,
    category: "misc",
    defaultTools: [],
    defaultSettings: { contextSize: 2 },
    defaultPromptTemplate: "ILLUSTRATOR_FIXTURE Return JSON.",
  },
]);

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
// Every request to the image service: which image connection it reached, the prompt and the size.
const images: Array<{ url: string; prompt: string; size: string }> = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  if (request.url?.endsWith("/images/generations")) {
    images.push({ url: request.url, prompt: String(body.prompt), size: String(body.size) });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: [{ b64_json: png }] }));
    return;
  }
  const prompt = JSON.stringify(body.messages ?? []);
  // Both image agents describe a scene that names nobody, so who is in it comes from the conversation.
  const content =
    prompt.includes("ILLUSTRATOR_FIXTURE") || prompt.includes("PAINTER_FIXTURE")
      ? JSON.stringify({ shouldGenerate: true, prompt: "a rainy street at dusk", characters: [] })
      : "The rain keeps falling.";
  if (body.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
});
const db = await getDB();
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const connections = createConnectionsStorage(db);
  const text = await connections.create({
    name: "Text fixture",
    provider: "custom",
    baseUrl: `${origin}/v1`,
    model: "fixture",
    apiKey: "fixture",
  });
  const imageConnection = (name: string, path: string) =>
    connections.create({
      name,
      provider: "image_generation",
      baseUrl: `${origin}${path}`,
      model: "dall-e-3",
      imageService: "openai",
      imageGenerationSource: "openai",
      apiKey: "fixture",
    });
  const illustratorImages = await imageConnection("Illustrator images", "/illustrator/v1");
  const painterImages = await imageConnection("Painter images", "/painter/v1");
  assert.ok(text && illustratorImages && painterImages);

  const agents = createAgentsStorage(db);
  const imageAgentSettings = { contextSize: 2, enabledTools: [], includeCharacterAppearance: true };
  await agents.create({
    type: "illustrator",
    name: "Illustrator",
    phase: "post_processing",
    connectionId: text.id,
    promptTemplate: "ILLUSTRATOR_FIXTURE Return JSON.",
    settings: { ...imageAgentSettings, imageConnectionId: illustratorImages.id },
  });
  const painter = await agents.create({
    type: "scene-painter",
    name: "Scene Painter",
    phase: "post_processing",
    connectionId: text.id,
    promptTemplate: "PAINTER_FIXTURE Return JSON.",
    settings: {
      ...imageAgentSettings,
      resultType: "image_prompt",
      customCapabilities: { trigger_image_generation: true },
      imageConnectionId: painterImages.id,
    },
  });
  assert.ok(painter);

  const card = (name: string) =>
    characters.create(characterDataSchema.parse({ name, extensions: { appearance: `${name.toUpperCase()}_LOOK` } }));
  const aster = await card("Aster");
  const brin = await card("Brin");
  const persona = await characters.createPersona("Pat", "The user.", undefined, { appearance: "PERSONA_LOOK" });
  assert.ok(aster && brin && persona);

  const byConnection = () => {
    const found = Object.fromEntries(images.map((image) => [image.url.split("/")[1], image]));
    images.length = 0;
    return found;
  };
  const run = async (url: string, payload: Record<string, unknown>) => {
    const result = await app.inject({ method: "POST", url, payload });
    assert.equal(result.statusCode, 200, result.body);
    assert.ok(!result.body.includes('"type":"error"'), result.body);
    return result.body;
  };

  // ── Roleplay: a fresh reply, then a retry of both image agents ───────────────
  const roleplay = await chats.create({
    name: "Roleplay pictures",
    mode: "roleplay",
    characterIds: [aster.id, brin.id],
    connectionId: text.id,
    promptPresetId: null,
    personaId: persona.id,
  });
  assert.ok(roleplay);
  await chats.patchMetadata(roleplay.id, {
    enableAgents: true,
    activeAgentIds: [painter.type, "illustrator"],
    automaticSummaryEnabled: false,
  });
  const checkRoleplayPictures = (label: string) => {
    const pictures = byConnection();
    assert.deepEqual(Object.keys(pictures).sort(), ["illustrator", "painter"], `${label}: one picture per image agent`);
    for (const picture of Object.values(pictures)) {
      assert.match(picture.prompt, /BRIN_LOOK/u, `${label}: the user's latest message names Brin`);
      assert.doesNotMatch(picture.prompt, /ASTER_LOOK/u, `${label}: nobody named Aster`);
      assert.doesNotMatch(picture.prompt, /PERSONA_LOOK/u, `${label}: naming the user doesn't put them in the picture`);
      assert.equal(picture.size, "1024x1792", `${label}: Roleplay uses the portrait Illustration size`);
    }
  };
  const body = await run("/api/generate/", {
    chatId: roleplay.id,
    userMessage: "Brin and Pat watch the rain together.",
    streaming: false,
  });
  checkRoleplayPictures("reply");
  const assistant = (await chats.listMessages(roleplay.id)).filter((message) => message.role === "assistant").at(-1);
  assert.ok(assistant, body);
  await run("/api/generate/retry-agents", {
    chatId: roleplay.id,
    agentTypes: [painter.type, "illustrator"],
    forMessageId: assistant.id,
    streaming: false,
  });
  checkRoleplayPictures("retry");

  // ── Game: pictures use the Game scene size ───────────────────────────────────
  // Game chats don't run the built-in Illustrator, but a custom image agent still draws there.
  const game = await chats.create({
    name: "Game pictures",
    mode: "game",
    characterIds: [],
    connectionId: text.id,
    promptPresetId: null,
  });
  assert.ok(game);
  await chats.patchMetadata(game.id, { enableAgents: true, activeAgentIds: [painter.type], enableTools: false });
  await run("/api/generate/", { chatId: game.id, userMessage: "We step into the rain.", streaming: false });
  const gamePictures = byConnection();
  assert.deepEqual(Object.keys(gamePictures), ["painter"]);
  assert.equal(gamePictures.painter!.size, "1792x1024", "Game uses the landscape Game scene size");
  console.info("Reply pictures follow their own agent, the latest user message and the mode's canvas size.");
} finally {
  provider.closeAllConnections();
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
