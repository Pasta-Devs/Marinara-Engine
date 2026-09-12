import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-interrupt-generation-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { messages: messagesTable } = await import("../../packages/server/src/db/schema/chats.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema, getRoleplayCommandActivity, DEFAULT_ADVANCED_MEMORY_SETTINGS } =
  await import("../../packages/shared/dist/index.js");
const prompts: string[] = [];
let outputs: string[] = [];
let beforeResponse: (() => Promise<void>) | undefined;
let failNext = false;
const provider = createServer(async (request, response) => {
  if (request.url?.endsWith("/api/extra/abort")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = JSON.stringify(body.messages ?? []);
  const classification = prompt.includes("Identify scene transitions");
  const summary = prompt.includes("Summarize only the supplied eligible source material");
  if (request.url?.endsWith("/embeddings")) {
    const texts = Array.isArray(body.input) ? body.input : [body.input];
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: texts.map((_: unknown, index: number) => ({ index, embedding: [1, 0, 0] })) }));
    return;
  }
  const content = classification ? '{"starts":[]}' : summary ? '{"summary":"A fixture scene."}' : outputs.shift();
  if (!classification && !summary) {
    prompts.push(prompt);
    const callback = beforeResponse;
    beforeResponse = undefined;
    await callback?.();
    if (failNext) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "fixture provider failure" } }));
      return;
    }
  }
  assert.notEqual(content, undefined, "unexpected generation request");
  if (!body.stream) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
    return;
  }
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n` +
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
const activeGenerations = new Map<string, { abortController: AbortController }>();
app.decorate("activeGenerations", activeGenerations);
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Interrupt fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
    maxTokensOverride: 512,
    embeddingModel: "fixture-embedding",
  });
  assert(connection);
  const characters = createCharactersStorage(db);
  const participants = await Promise.all(
    ["Dottore", "Visitor", "Witness"].map((name) => characters.create(characterDataSchema.parse({ name }))),
  );
  assert(participants.every(Boolean));
  const [first, second, third] = participants;
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Interrupt fixture",
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
  const createChat = async (enabled = true, ids = [first!.id]) => {
    const chat = await chats.create({
      name: "Interrupt proof",
      mode: "roleplay",
      characterIds: ids,
      connectionId: connection.id,
      promptPresetId: preset.id,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableMemoryRecall: false,
      roleplayCommandsEnabled: true,
      roleplayCommandToggles: { interrupt: enabled },
      groupChatMode: "individual",
      groupResponseOrder: "manual",
    });
    return chat;
  };
  const generate = async (chatId: string, content: string, extra: Record<string, unknown> = {}) => {
    outputs = [content];
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId, forCharacterId: first!.id, ...extra },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(outputs.length, 0);
    return response;
  };
  const original = 'Mari cries. "And I really hate myself! I want to just finish myself already!"';
  const cut = 'Mari cries. "And I really hate myself—"';
  const interruption = '[interrupt: part="I really hate myself!"] Dottore interrupts her.';
  const chat = await createChat();
  const older = await chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: "An older line must remain unchanged.",
  });
  const source = await chats.createMessage({ chatId: chat.id, role: "user", content: original });
  assert(source && older);
  const firstRun = await generate(chat.id, interruption);
  assert.equal((await chats.getMessage(source.id))!.content, cut);
  assert.equal((await chats.getMessage(older.id))!.content, older.content);
  assert(firstRun.body.includes('"type":"roleplay_interrupted_message"'));
  assert(prompts.at(-1)!.includes("I want to just finish myself already!"));
  const reply = (await chats.listMessages(chat.id)).at(-1)!;
  assert(!reply.content.includes("[interrupt"));
  assert.equal(getRoleplayCommandActivity(JSON.parse(reply.extra))[0]!.interruption!.originalContent, original);

  await generate(chat.id, "Dottore listens without interrupting.", { regenerateMessageId: reply.id });
  assert(
    prompts.at(-1)!.includes("I want to just finish myself already!"),
    "rerolls receive the complete original input",
  );
  assert.equal((await chats.getMessage(source.id))!.content, original);
  await chats.setActiveSwipe(reply.id, 0);
  assert.equal((await chats.getMessage(source.id))!.content, cut);
  failNext = true;
  beforeResponse = async () => {
    const blocked = await app.inject({
      method: "POST",
      url: `/api/chats/${chat.id}/messages/${reply.id}/interrupt/restore`,
      payload: { swipeIndex: 0, activityIndex: 0 },
    });
    assert.equal(blocked.statusCode, 409, "Restore shares the real active generation registry");
  };
  const failed = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, regenerateMessageId: reply.id },
  });
  failNext = false;
  assert(failed.body.includes('"type":"error"'));
  assert(prompts.at(-1)!.includes("I want to just finish myself already!"));
  assert.equal((await chats.getMessage(source.id))!.content, cut, "failed rerolls reapply the selected old swipe");
  outputs = [interruption];
  beforeResponse = async () => {
    const aborted = await app.inject({ method: "POST", url: "/api/generate/abort", payload: { chatId: chat.id } });
    assert.equal(aborted.json().aborted, true);
  };
  await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, regenerateMessageId: reply.id },
  });
  assert.equal((await chats.getMessage(source.id))!.content, cut, "cancelled rerolls reapply the selected old swipe");
  const restored = await app.inject({
    method: "POST",
    url: `/api/chats/${chat.id}/messages/${reply.id}/interrupt/restore`,
    payload: { swipeIndex: 0, activityIndex: 0 },
  });
  assert.equal(restored.statusCode, 200, restored.body);
  assert.equal((await chats.getMessage(source.id))!.content, original);

  const disabled = await createChat(false);
  const disabledSource = await chats.createMessage({ chatId: disabled.id, role: "user", content: original });
  await generate(disabled.id, interruption);
  assert.equal((await chats.getMessage(disabledSource!.id))!.content, original);
  assert(!prompts.at(-1)!.includes("- [interrupt:"));

  const lateCancel = await createChat();
  const lateSource = await chats.createMessage({ chatId: lateCancel.id, role: "user", content: original });
  const originalInsert = db.insert;
  let abortedDuringSave = false;
  db.insert = (table) => {
    if (table === messagesTable && !abortedDuringSave) {
      const active = activeGenerations.get(lateCancel.id);
      assert(active, "the response is still generating when its message is saved");
      active.abortController.abort();
      abortedDuringSave = true;
    }
    return originalInsert(table);
  };
  try {
    await generate(lateCancel.id, interruption);
  } finally {
    db.insert = originalInsert;
  }
  assert(abortedDuringSave, "inject cancellation after parsing, while saving the assistant response");
  assert.equal((await chats.getMessage(lateSource!.id))!.content, original);
  assert.match(
    getRoleplayCommandActivity(JSON.parse((await chats.listMessages(lateCancel.id)).at(-1)!.extra))[0]!.error!,
    /cancelled/,
  );

  const edited = await createChat();
  const editedSource = await chats.createMessage({ chatId: edited.id, role: "user", content: original });
  beforeResponse = async () => {
    await chats.updateMessageContent(editedSource!.id, "A newer manual edit wins.");
  };
  await generate(edited.id, interruption);
  assert.equal((await chats.getMessage(editedSource!.id))!.content, "A newer manual edit wins.");
  assert(getRoleplayCommandActivity(JSON.parse((await chats.listMessages(edited.id)).at(-1)!.extra))[0]!.error);

  const hidden = await createChat(true, [first!.id, second!.id]);
  const visible = await chats.createMessage({ chatId: hidden.id, role: "user", content: original });
  const hiddenSource = await chats.createMessage({
    chatId: hidden.id,
    role: "user",
    content: original,
    extra: { hiddenFromAICharacterIds: [first!.id] },
  });
  await generate(hidden.id, interruption);
  assert.equal(
    (await chats.getMessage(visible!.id))!.content,
    original,
    "never search an older visible message instead",
  );
  assert.equal((await chats.getMessage(hiddenSource!.id))!.content, original);
  assert(!prompts.at(-1)!.includes("- [interrupt:"));

  const group = await createChat(true, [first!.id, second!.id, third!.id]);
  await chats.patchMetadata(group.id, {
    groupResponseOrder: "sequential",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 8192,
      summaryBudgetTokens: 512,
      knowledgeStarts: { [first!.id]: null, [second!.id]: null, [third!.id]: null },
      knowledgeConfirmed: true,
    },
  });
  const groupSource = await chats.createMessage({ chatId: group.id, role: "user", content: original });
  outputs = [
    '[interrupt: part="I really hate myself!"] Dottore reaches for the lever. DISCARDED_ASSISTANT_TAIL.',
    '[interrupt: part="reaches for the lever."] Visitor stops his hand.',
    "Witness sees both interruptions.",
  ];
  const start = prompts.length;
  const groupRun = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: group.id } });
  assert.equal(groupRun.statusCode, 200, groupRun.body);
  assert(!groupRun.body.includes('"type":"error"'), groupRun.body);
  assert.equal(outputs.length, 0);
  assert.equal(prompts.length - start, 3);
  assert(
    !prompts[start + 1]!.includes("I want to just finish myself already!"),
    "later characters see the cut user input",
  );
  assert(!prompts[start + 2]!.includes("DISCARDED_ASSISTANT_TAIL"), "later characters see a cut character reply");
  assert.equal((await chats.getMessage(groupSource!.id))!.content, cut);
  const groupMessages = await chats.listMessages(group.id);
  assert.equal(groupMessages[1]!.content, "Dottore reaches for the lever—");

  console.log(
    "Roleplay interrupt generation regression passed (literal cuts, full reroll context, recovery, edits, visibility and group continuation).",
  );
} finally {
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
