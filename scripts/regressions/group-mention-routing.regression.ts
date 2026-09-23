import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-group-mentions-"));
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
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

let outputs: string[] = [];
const prompts: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  if (request.url?.endsWith("/api/extra/abort")) {
    response.writeHead(200).end("{}");
    return;
  }
  prompts.push(JSON.stringify(body.messages));
  const content = outputs.shift();
  assert.notEqual(content, undefined, "mentions must not create an unbounded chain");
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Mention fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxTokensOverride: 256,
    maxContext: 8192,
  });
  assert(connection);
  const cast = await Promise.all(
    ["Alice", "Bob", "Charlie Brown"].map((name) =>
      createCharactersStorage(db).create(
        characterDataSchema.parse({
          name,
          extensions: {
            convoDisplayName: name === "Bob" ? "Bobby" : name,
            conversationStatusOverride: { status: "online", createdAt: new Date().toISOString() },
          },
        }),
      ),
    ),
  );
  assert(cast.every(Boolean));
  const [alice, bob, charlie] = cast as Array<{ id: string }>;
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Mention fixture", parameters: { maxTokens: 256, maxContext: 8192 } });
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
    name: "History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const turn = async (chatId: string, replies: string[], input: Record<string, unknown> = {}) => {
    outputs = [...replies];
    prompts.length = 0;
    const result = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: {
        chatId,
        forCharacterId: alice!.id,
        streaming: true,
        skipPresenceDelay: true,
        ...input,
      },
    });
    assert.equal(result.statusCode, 200, result.body);
    assert(!result.body.includes('"type":"error"'), result.body);
    assert.equal(outputs.length, 0, `every invited speaker should respond: ${result.body}`);
    return result.body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)))
      .filter((event) => event.type === "group_turn")
      .map((event) => event.data.characterId);
  };
  for (const mode of ["roleplay", "conversation"] as const) {
    const chat = await chats.create({
      name: "Mention routing",
      mode,
      characterIds: cast.map((character) => character!.id),
      connectionId: connection.id,
      promptPresetId: preset.id,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableMemoryRecall: false,
      groupChatMode: "individual",
      groupResponseOrder: "manual",
      characterExchanges: true,
    });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "What do you think?" });
    assert.deepEqual(
      await turn(chat.id, ["@Bob, your turn.", "Ask @Charlie Brown!", "Thanks, @Alice and @Bob."]),
      [alice!.id, bob!.id, charlie!.id],
      `${mode}: mentions chain once per available character`,
    );
    assert.match(prompts[1]!, /@Bob, your turn/, "the invited speaker sees the handoff");
    assert.match(prompts[2]!, /Ask @Charlie Brown/, "later invitations see preceding replies");
    if (mode === "conversation") {
      assert.deepEqual(
        await turn(chat.id, ["Hello @Bobby!", "Hello."]),
        [alice!.id, bob!.id],
        "display-name mentions route too",
      );
      const characters = createCharactersStorage(db);
      const bobRow = await characters.getById(bob!.id);
      const bobData = JSON.parse(bobRow!.data);
      await characters.update(bob!.id, {
        extensions: {
          ...bobData.extensions,
          conversationStatusOverride: { status: "offline", createdAt: new Date().toISOString() },
        },
      });
      assert.deepEqual(await turn(chat.id, ["Hello @Bobby!"]), [alice!.id], "offline characters stay out of handoffs");
      await characters.update(bob!.id, bobData);
      const { getAutonomousDailyBudget } =
        await import("../../packages/server/src/services/conversation/autonomous.service.js");
      await chats.patchMetadata(chat.id, {
        autonomousDailyCapOverride: 1,
        autonomousDailyBudget: { date: getAutonomousDailyBudget({}).date, counts: { [bob!.id]: 1 } },
      });
      assert.deepEqual(
        await turn(chat.id, ["Hello @Bob!"], { autonomous: true }),
        [alice!.id],
        "autonomous mentions respect the recipient's daily limit",
      );
      await chats.patchMetadata(chat.id, { autonomousDailyCapOverride: null, autonomousDailyBudget: null });
    }
    await chats.patchMetadata(chat.id, { inactiveCharacterIds: [bob!.id] });
    assert.deepEqual(
      await turn(chat.id, ["Hello @Bob!"]),
      [alice!.id],
      "mentions never activate an inactive character",
    );
    await chats.patchMetadata(chat.id, { inactiveCharacterIds: [] });
    assert.deepEqual(
      await turn(chat.id, ["Email alice@Bob.com, mention @Nobody or @BobbyLong."]),
      [alice!.id],
      `${mode}: unknown names and email addresses do not route`,
    );
    assert.deepEqual(
      await turn(chat.id, ["@Charlie Brown and @Bob, hello!", "Hello.", "Good day."]),
      [alice!.id, bob!.id, charlie!.id],
      `${mode}: multiple mentions use the existing roster order`,
    );
    await chats.patchMetadata(chat.id, { groupResponseOrder: "sequential" });
    assert.deepEqual(
      await turn(chat.id, ["@Charlie Brown, first!", "Hello.", "Then me."], { forCharacterId: undefined }),
      [alice!.id, charlie!.id, bob!.id],
      `${mode}: mentions prioritize the existing queue without duplicating it`,
    );
    const latest = (await chats.listMessages(chat.id)).at(-1)!;
    await turn(chat.id, ["@Alice and @Charlie Brown."], { forCharacterId: bob!.id, regenerateMessageId: latest.id });
    assert.equal(prompts.length, 1, "a swipe never triggers other speakers");
    await turn(chat.id, ["And @Alice."], { forCharacterId: bob!.id, continueMessageId: latest.id });
    assert.equal(prompts.length, 1, "continuing a reply never routes a new turn");
    await chats.patchMetadata(chat.id, { groupChatMode: "merged" });
    await turn(chat.id, ["@Bob, hello."], { userMessage: "Carry on." });
    assert.equal(prompts.length, 1, "merged mode keeps one generation");
  }
} finally {
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  closeDB();
  rmSync(dir, { recursive: true, force: true });
}
process.stdout.write("Group mention routing regressions passed.\n");
