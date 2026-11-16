import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// #6945: a roll_dice added under Function Calling must reach a Roleplay reply and run, as the Roll command's does.
const dir = mkdtempSync(join(tmpdir(), "marinara-roleplay-function-calling-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema, getRoleplayCommandActivity } = await import("../../../packages/shared/dist/index.js");

const requests: Array<Record<string, any>> = [];
let outputs: string[] = [];
// Errors inside the fake provider are kept and rethrown after the request, so a broken
// assertion there fails the test instead of leaving the response open until it times out.
let providerError: unknown = null;
// A KoboldCPP-style local endpoint whose model writes its tool calls as text.
const provider = createServer(async (request, response) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    if (!request.url?.endsWith("/chat/completions")) return void response.writeHead(404).end();
    const body = JSON.parse(Buffer.concat(chunks).toString());
    requests.push(body);
    const content = outputs.shift();
    assert.notEqual(content, undefined, "unexpected provider request");
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`);
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } catch (error) {
    providerError ??= error;
    if (!response.headersSent) response.writeHead(500);
    response.end();
  }
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "KoboldCPP fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "gemma",
    apiKey: "fixture",
    maxContext: 8192,
    maxTokensOverride: 512,
    treatAsLocalEndpoint: true,
  });
  assert(connection);
  const narrator = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Narrator" }));
  assert(narrator);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Function calling fixture",
    parameters: { maxTokens: 512, maxContext: 8192 },
    wrapFormat: "xml",
  });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "Respond as {{char}}.",
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const chat = await chats.create({
    name: "Function calling proof",
    mode: "roleplay",
    characterIds: [narrator.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert(chat);
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Roll for me." });
  const generate = async (metadata: Record<string, unknown>, sequence: string[]) => {
    await chats.patchMetadata(chat.id, { enableAgents: false, enableMemoryRecall: false, ...metadata });
    outputs = [...sequence];
    providerError = null;
    const start = requests.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, forCharacterId: narrator.id },
    });
    if (providerError) throw providerError;
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(outputs.length, 0, "every planned provider round ran");
    return { body: response.body, sent: requests.slice(start) };
  };
  const offered = (body: Record<string, any>) => (body.tools ?? []).map((tool: any) => tool.function.name);
  // What the client shows when the stream ends: tokens add to the reply, content_replace replaces it.
  const shown = (body: string) =>
    body.split("\n").reduce((text, line) => {
      const event = line.startsWith("data: ") ? JSON.parse(line.slice(6)) : null;
      return event?.type === "token" ? text + event.data : event?.type === "content_replace" ? event.data : text;
    }, "");

  // The reporter's setup: Commands off, Function Calling on with roll_dice, and a model that answers in text.
  const call =
    '<tool_call>{"name": "roll_dice", "arguments": {"notation": "1d20+1", "reason": "User request", "character": "Narrator"}}</tool_call>';
  const functionCalling = await generate({ enableTools: true, activeToolIds: ["roll_dice"] }, [
    call,
    "The die settles.",
  ]);
  assert.equal(functionCalling.sent.length, 2, "the textual call must run and the model must continue");
  const [first, followUp] = functionCalling.sent;
  assert.deepEqual(offered(first!), ["roll_dice"], "the provider must receive the chat's roll_dice");
  assert.match(
    first!.messages[0].content,
    /<available_functions>[\s\S]*- roll_dice:/u,
    "a local endpoint's prompt must describe the chat's roll_dice",
  );
  const toolResult = followUp!.messages.find((message: any) => message.role === "tool");
  assert(toolResult, "the roll result must go back to the model");
  assert.match(toolResult.content, /"notation":"1d20\+1"/u);
  assert.match(functionCalling.body, /"type":"tool_result"[^\n]*"name":"roll_dice"[^\n]*"diceRollResult"/u);
  const saved = (await chats.listMessages(chat.id)).at(-1)!;
  const [roll] = getRoleplayCommandActivity(JSON.parse(saved.extra));
  assert.equal(roll?.command.type, "roll", "the roll is kept with the reply like a Rolls command's");
  assert.equal(roll?.error, undefined, roll?.error);
  assert.match(roll?.result ?? "", /"total":/u);
  // #6951: the call was streamed as text before it was recognised. It must not stay in the reply.
  assert.equal(saved.content, "The die settles.", "the call's text is not saved with the reply");
  assert.equal(shown(functionCalling.body), "The die settles.", "nor left on screen");

  // Negative controls: Function Calling only grants what the chat selected, and an
  // enabled Roll command keeps deciding who may roll.
  const otherTool = await generate({ enableTools: true, activeToolIds: ["search_lorebook"] }, ["No dice here."]);
  assert.deepEqual(offered(otherTool.sent[0]!), ["search_lorebook"]);
  const narratorOnly = await generate(
    {
      enableTools: true,
      activeToolIds: ["roll_dice"],
      roleplayCommandsEnabled: true,
      roleplayCommandToggles: { roll: true },
      roleplayRollAudience: "narrator",
      roleplayCommandNarratorId: "someone-else",
    },
    ["Only the narrator may roll."],
  );
  assert.deepEqual(offered(narratorOnly.sent[0]!), [], "a narrator-only Roll command still withholds roll_dice");
  console.log("Roleplay function calling regression passed.");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
