import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const dir = mkdtempSync(join(tmpdir(), "marinara-scene-post-generation-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS, characterDataSchema, replaceBuiltInAgentDefinitions } =
  await import("../../packages/shared/dist/index.js");
const calls: Array<{
  kind: string;
  messages: Array<{ role: string; content: string }>;
  streaming?: boolean;
  path?: string;
}> = [];
let finishStream: (() => void) | undefined;
let streamFinished = false;
let streamGate: Promise<void> | undefined;
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (req.url?.endsWith("/embeddings")) {
    calls.push({ kind: "embedding", messages: [] });
    const input = Array.isArray(body.input) ? body.input : [body.input];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: input.map((_: unknown, index: number) => ({ index, embedding: [1, 0, 0] })) }));
    return;
  }
  const responses = req.url?.endsWith("/responses");
  const messages = body.messages ?? [
    ...(body.instructions ? [{ role: "system", content: body.instructions }] : []),
    ...body.input.map((message: { role: string; content: string | Array<{ text: string }> }) => ({
      role: message.role,
      content:
        typeof message.content === "string" ? message.content : message.content.map((part) => part.text).join("\n"),
    })),
  ];
  const prompt = JSON.stringify(messages);
  const kind = prompt.includes("TRACKER_SCENE_FIXTURE")
    ? "tracker"
    : prompt.includes("Identify scene transitions")
      ? "scene"
      : prompt.includes("Summarize only the supplied eligible source material")
        ? "summary"
        : "main";
  calls.push({ kind, messages, streaming: body.stream, path: req.url });
  const content =
    kind === "tracker"
      ? '{"values":{"weather":"clear"}}'
      : kind === "scene"
        ? JSON.stringify({
            starts: JSON.parse(messages[1].content)
              .filter((message: { content: string }) => message.content.startsWith("SCENE_CHANGE"))
              .map((message: { messageId: string }) => ({ messageId: message.messageId })),
          })
        : kind === "summary"
          ? '{"summary":"ARCHIVED_RECAP: The silver compass promise guided the travelers."}'
          : "The character continues the silver compass journey.";
  const response = {
    id: "fixture",
    status: "completed",
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: content }] }],
    usage: { input_tokens: 40, output_tokens: 20, total_tokens: 60 },
  };
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(
      `data: ${JSON.stringify(
        responses
          ? { type: "response.output_text.delta", delta: content }
          : { choices: [{ index: 0, delta: { content }, finish_reason: null }] },
      )}\n\n`,
    );
    if (kind === "main" && streamGate) {
      await streamGate;
      streamFinished = true;
    }
    res.end(
      responses
        ? `data: ${JSON.stringify({ type: "response.completed", response })}\n\n`
        : `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify(
        responses
          ? response
          : { choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] },
      ),
    );
  }
});
const db = await getDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
const chatIds: string[] = [];
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Scene fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 8192,
    maxTokensOverride: 1024,
    embeddingModel: "fixture-embedding",
  });
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Dottore" }));
  assert.ok(character);
  const chat = await chats.create({
    name: "Scene cadence",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
  });
  assert(chat);
  chatIds.push(chat.id);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    authorNote: "UNRELATED_AUTHOR_NOTE",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 8192,
      helperConnectionId: connection.id,
    },
  });
  await memory.initialize(chat.id);
  const generate = async (extra: Record<string, unknown> = {}) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, forCharacterId: character.id, ...extra },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    return response;
  };
  const waitFor = async (predicate: () => Promise<boolean>) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (await predicate()) return;
      await delay(25);
    }
    assert.fail("Post-generation scene check did not finish");
  };
  const waitForSceneCheck = async () => {
    const last = (await chats.listMessages(chat.id)).at(-1)!;
    await waitFor(async () => {
      const state = JSON.parse((await chats.getById(chat.id))!.metadata).advancedMemoryState;
      return state.sceneCheckMessageId === last.id && state.status === "ready";
    });
  };
  const addFourMessages = async (newScene = false) => {
    for (let index = 0; index < 4; index++)
      await chats.createMessage({
        chatId: chat.id,
        role: index % 2 ? "assistant" : "user",
        content: `${index === 0 && newScene ? "SCENE_CHANGE " : ""}The silver compass promise continued. ${index}`,
        ...(index === 0 && newScene ? { extra: { isConversationStart: true } } : {}),
      });
  };
  await addFourMessages();
  await chats.updateMessageContent(
    (await chats.listMessages(chat.id))[0]!.id,
    "ARCHIVED_SOURCE_ONLY: The silver compass promise began.",
  );
  calls.length = 0;
  await generate();
  await waitForSceneCheck();
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["main", "scene"],
    "an ongoing scene is checked after the fifth saved turn without summarizing or indexing",
  );
  const sceneCall = calls.find((call) => call.kind === "scene")!;
  assert(!JSON.stringify(sceneCall.messages).includes("UNRELATED_AUTHOR_NOTE"));
  const window = JSON.parse(sceneCall.messages[1]!.content);
  assert.equal(window.length, 5);
  assert(window.at(-1).content.includes("continues the silver compass"), "the check includes the just-saved reply");
  assert(!(await memory.status(chat.id)).records.some((record) => record.content));

  await addFourMessages(true);
  calls.length = 0;
  await generate();
  await waitForSceneCheck();
  assert.deepEqual(
    calls.slice(0, 3).map((call) => call.kind),
    ["main", "scene", "summary"],
    "a detected scene ending prepares the archive only after the main reply",
  );
  assert(calls.some((call) => call.kind === "embedding"));
  const archive = (await memory.status(chat.id)).records;
  assert(archive.some((record) => record.kind === "scene" && record.content.includes("ARCHIVED_RECAP")));
  assert(
    archive.filter((record) => record.content).every((record) => record.endIndex <= 5),
    "only the closed scene is summarized and indexed",
  );

  // The provider waits for the HTTP client to receive a token before finishing.
  // A buffering server would time out rather than satisfy this handshake.
  const url = await app.listen({ host: "127.0.0.1", port: 0 });
  for (const [provider, model] of [
    ["custom", "fixture"],
    ["openai", "gpt-6-astra"],
  ] as const) {
    await createConnectionsStorage(db).update(connection.id, { provider, model });
    streamGate = new Promise<void>((resolve) => {
      finishStream = resolve;
    });
    streamFinished = false;
    calls.length = 0;
    const streamed = await fetch(`${url}/api/generate/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatId: chat.id, forCharacterId: character.id, streaming: true }),
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(streamed.status, 200);
    const reader = streamed.body!.getReader();
    const decoder = new TextDecoder();
    let body = "";
    let tokenSeen = false;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      body += decoder.decode(value, { stream: true });
      if (!tokenSeen && body.includes('"type":"token"')) {
        assert.equal(streamFinished, false, "the main reply is streamed before provider completion");
        tokenSeen = true;
        finishStream!();
      }
    }
    streamGate = undefined;
    assert(tokenSeen, body);
    assert(!body.includes('"type":"error"'), body);
    const mainCall = calls.find((call) => call.kind === "main")!;
    assert.equal(mainCall.streaming, true);
    assert.equal(mainCall.path, provider === "openai" ? "/v1/responses" : "/v1/chat/completions");
    assert(JSON.stringify(calls.find((call) => call.kind === "main")!.messages).includes("ARCHIVED_RECAP"));
    assert(
      !calls.some((call) => ["scene", "summary"].includes(call.kind)),
      "routine recall does not prepare the archive",
    );
  }
  await createConnectionsStorage(db).update(connection.id, { provider: "custom", model: "fixture" });

  replaceBuiltInAgentDefinitions([
    {
      id: "custom-tracker",
      name: "Tracker fixture",
      description: "Local regression fixture",
      category: "tracker",
      phase: "post_processing",
      enabledByDefault: false,
      defaultPromptTemplate: "TRACKER_SCENE_FIXTURE Return JSON values.",
    },
  ]);
  const tracker = await createAgentsStorage(db).create({
    type: "recall-tracker-fixture",
    name: "Tracker fixture",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "TRACKER_SCENE_FIXTURE Return JSON values.",
    settings: {
      resultType: "custom_tracker_update",
      maxTokens: 1024,
      contextSize: 5,
      customCapabilities: { edit_main_prompt: true, edit_trackers: true },
      contextSources: { chatHistory: true },
    },
  });
  assert(tracker);
  await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: [tracker.type] });
  calls.length = 0;
  await generate();
  assert.deepEqual(
    calls.filter((call) => call.kind !== "embedding").map((call) => call.kind),
    ["main", "tracker"],
    "trackers do not force an out-of-cadence scene check",
  );
  const trackerPrompt = JSON.stringify(calls.find((call) => call.kind === "tracker")!.messages);
  assert.doesNotMatch(
    trackerPrompt,
    /ARCHIVED_RECAP|Included below are recalled|__scene_check|__MARINARA_ADVANCED_MEMORY_/u,
    "agent prompts never receive Advanced Recall output or a bundled scene-check request",
  );
  const beforeRetry = JSON.parse((await chats.getById(chat.id))!.metadata).advancedMemoryState;
  calls.length = 0;
  const retry = await app.inject({
    method: "POST",
    url: "/api/generate/retry-agents",
    payload: { chatId: chat.id, agentTypes: [tracker.type] },
  });
  assert.equal(retry.statusCode, 200, retry.body);
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["tracker"],
    "manual agent reruns make no recall, summary, embedding or scene-check calls",
  );
  assert.doesNotMatch(JSON.stringify(calls), /ARCHIVED_RECAP|Included below are recalled|__MARINARA_ADVANCED_MEMORY_/u);
  assert.deepEqual(JSON.parse((await chats.getById(chat.id))!.metadata).advancedMemoryState, beforeRetry);

  calls.length = 0;
  const auxiliary = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: { chatId: chat.id, forCharacterId: character.id },
  });
  assert.equal(auxiliary.statusCode, 200, auxiliary.body);
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["main"],
    "auxiliary generation makes only its requested model call",
  );
  assert.doesNotMatch(JSON.stringify(calls), /ARCHIVED_RECAP|Included below are recalled|__MARINARA_ADVANCED_MEMORY_/u);

  assert.doesNotMatch(
    JSON.stringify(calls),
    /ARCHIVED_SOURCE_ONLY/u,
    "auxiliary generations still respect the shared context start",
  );

  const trackerSettings = JSON.parse(tracker.settings);
  await createAgentsStorage(db).update(tracker.id, { settings: { ...trackerSettings, runInterval: 100 } });
  await addFourMessages();
  calls.length = 0;
  await generate();
  await waitForSceneCheck();
  assert.deepEqual(
    calls.filter((call) => call.kind !== "embedding").map((call) => call.kind),
    ["main", "scene"],
    "the scene interval is independent of an agent's interval",
  );
  assert(
    !(await memory.status(chat.id)).records.some((record) => record.kind === "excerpt" && record.startIndex > 5),
    "an ongoing scene is still not indexed",
  );
  assert.equal((await memory.status(chat.id)).job.blocking, false, "post-generation work remains background activity");
} finally {
  finishStream?.();
  for (const chatId of chatIds) await memory.cancel(chatId);
  replaceBuiltInAgentDefinitions([]);
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
process.stdout.write("Main Roleplay streaming, agent isolation and post-generation scene-end archiving passed.\n");
