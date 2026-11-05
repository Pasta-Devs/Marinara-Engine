// With Automatic Summaries and "Hide summarised messages" on, the recent message tail caps the summarized
// history the model gets, and older messages no summary covers yet are counted as a backlog (#8831).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-summary-recent-tail-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { capSummarizedHistory } = await import("../../packages/server/src/routes/generate/generate-route-utils.js");
const { characterDataSchema, compileChatSummaryEntries, createChatSummaryEntry } =
  await import("../../packages/shared/dist/index.js");

// Every history message is one "Seed n.", "Turn n." or "Reply n." line; summaries say "Recap n".
const historyCount = (messages: unknown) =>
  (messages as Array<{ content: string }>)
    .map((message) => message.content)
    .join("\n")
    .match(/\b(?:Seed|Turn|Reply) \d+\./gu)?.length ?? 0;
const mainPrompts: unknown[] = [];
let summaries = 0;
let replies = 0;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (JSON.stringify(body.messages).includes("Automatic Chat Summary")) {
    const content = JSON.stringify({ name: "Recap", summary: `Recap ${++summaries}` });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
    return;
  }
  assert.equal(body.stream, true, "only the reply streams");
  mainPrompts.push(body.messages);
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: `Reply ${++replies}.` } }] })}\n\n`);
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });

try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Recent tail fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 131072,
    maxTokensOverride: 256,
  });
  assert(connection);
  const alice = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Alice" }));
  assert(alice);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Recent tail fixture",
    parameters: { maxTokens: 256, maxContext: 131072 },
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
    name: "Recent tail proof",
    mode: "roleplay",
    characterIds: [alice.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert(chat);
  // The issue's chat: 64 visible messages, a 50-message summary window, a tail of 10, a summary every 5.
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableTools: false,
    enableMemoryRecall: false,
    automaticSummaryEnabled: true,
    hideSummarisedMessages: true,
    summaryTailMessages: 10,
    summaryContextSize: 50,
    summaryRunInterval: 5,
  });
  for (let index = 1; index <= 64; index++) {
    await chats.createMessage({
      chatId: chat.id,
      role: index % 2 ? "user" : "assistant",
      characterId: index % 2 ? null : alice.id,
      content: `Seed ${index}.`,
    });
  }
  // Read after the prompts are checked, so a server without the count fails on what it sends first.
  const backlog = async () => {
    const response = await app.inject({ method: "GET", url: `/api/chats/${chat.id}/summary-backlog` });
    return response.statusCode === 200
      ? (response.json() as { backlog: number }).backlog
      : `HTTP ${response.statusCode}`;
  };
  const sent: number[] = [];
  const backlogs: Array<number | string> = [];
  for (let turn = 1; turn <= 6; turn++) {
    await chats.createMessage({ chatId: chat.id, role: "user", characterId: null, content: `Turn ${turn}.` });
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    sent.push(historyCount(mainPrompts.at(-1)));
    backlogs.push(await backlog());
  }
  assert.equal(summaries, 2, "summaries ran after replies 1 and 4");
  // Reply 1's summary covered only the newest 50 messages, so Seed 1-16 stay as a backlog until reply 4's
  // summary covers them; every summarized message past the newest 10 is left out from the next turn on.
  assert.deepEqual(sent, [65, 26, 26, 26, 10, 10], "messages sent per turn");
  assert.deepEqual(backlogs, [16, 16, 16, 0, 0, 0], "backlog after each turn");

  // Peek Prompt opens on the request sent for the last reply; `current` builds what the next one starts from.
  const peek = async (payload: Record<string, unknown>) => {
    const response = await app.inject({ method: "POST", url: `/api/chats/${chat.id}/peek-prompt`, payload });
    assert.equal(response.statusCode, 200, response.body);
    return response.json() as { source: string; messages: unknown; agentNote?: string };
  };
  const saved = await peek({});
  assert.equal(saved.source, "cached");
  assert.equal(historyCount(saved.messages), 10, "the saved request is what turn 6 sent");
  const current = await peek({ current: true });
  assert.equal(current.source, "live_preview");
  assert.equal(current.agentNote, undefined, "asked for, so it never claims the saved request is missing");
  // The tail ends with reply 6, which a live preview leaves out because the model does not get its own reply.
  assert.equal(historyCount(current.messages), 9, "the current context keeps only the tail");
  assert.match(JSON.stringify(current.messages), /Turn 6\./u);
  // The read-only preview that Decision tests use builds the same capped history.
  const dryRun = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: { chatId: chat.id, returnPrompt: true },
  });
  assert.equal(dryRun.statusCode, 200, dryRun.body);
  assert.equal(historyCount(dryRun.json().prompt.messages), 10, "the preview keeps only the tail");

  // A swipe leaves out every summary of the reply it replaces, so the messages that summary covers are sent
  // word for word instead. This summary was committed after approval, which never hides its messages.
  const swiped = await chats.create({
    name: "Recent tail swipe",
    mode: "roleplay",
    characterIds: [alice.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert(swiped);
  const swipedIds: string[] = [];
  for (let index = 1; index <= 20; index++) {
    const message = await chats.createMessage({
      chatId: swiped.id,
      role: index % 2 ? "user" : "assistant",
      characterId: index % 2 ? null : alice.id,
      content: `Seed ${index}.`,
    });
    assert(message);
    swipedIds.push(message.id);
  }
  const swipedEntries = [
    createChatSummaryEntry({ id: "older", content: "Recap of the start.", messageIds: swipedIds.slice(0, 4) }),
    createChatSummaryEntry({ id: "latest", content: "Recap of the swiped reply.", messageIds: swipedIds.slice(4) }),
  ];
  await chats.patchMetadata(swiped.id, {
    enableAgents: false,
    enableTools: false,
    enableMemoryRecall: false,
    hideSummarisedMessages: true,
    summaryTailMessages: 4,
    summaryEntries: swipedEntries,
    summary: compileChatSummaryEntries(swipedEntries),
  });
  const lastReply = swipedIds.at(-1)!;
  const swipe = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: swiped.id, regenerateMessageId: lastReply },
  });
  assert.equal(swipe.statusCode, 200, swipe.body);
  assert(!swipe.body.includes('"type":"error"'), swipe.body);
  const swipePrompt = JSON.stringify(mainPrompts.at(-1));
  assert.doesNotMatch(swipePrompt, /Recap of the swiped reply/u, "the swiped reply's summary is left out");
  assert.match(swipePrompt, /Recap of the start/u, "a summary without the swiped reply stays");
  // Seeds 1-4 go with their summary; Seeds 5-19 stay, since the summary of them is left out; Seed 20 is swiped.
  assert.equal(historyCount(mainPrompts.at(-1)), 15, "a swipe sends what its left-out summary covers");
  assert.doesNotMatch(swipePrompt, /Seed (?:[1-4]|20)\./u);
  const swipePreview = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: { chatId: swiped.id, returnPrompt: true, regenerateMessageId: lastReply },
  });
  assert.equal(swipePreview.statusCode, 200, swipePreview.body);
  assert.equal(historyCount(swipePreview.json().prompt.messages), 15, "the swipe preview sends the same");

  // The helper alone: covered messages past the tail go, uncovered ones stay and count, the user's choice wins.
  const rows = Array.from({ length: 8 }, (_, index) => ({ id: `m${index + 1}`, extra: {} as Record<string, unknown> }));
  const meta = (extra: Record<string, unknown> = {}) => ({
    hideSummarisedMessages: true,
    summaryTailMessages: 3,
    summaryEntries: [{ id: "e1", content: "Recap", enabled: true, messageIds: ["m3", "m4", "m5", "m6"] }],
    ...extra,
  });
  const ids = (result: { messages: Array<{ id: string }> }) => result.messages.map((message) => message.id);
  assert.deepEqual(
    ids(capSummarizedHistory(rows, meta())),
    ["m1", "m2", "m6", "m7", "m8"],
    "covered m3-m5 are past the tail",
  );
  assert.equal(capSummarizedHistory(rows, meta()).backlog, 2, "m1 and m2 have no summary yet");
  assert.deepEqual(ids(capSummarizedHistory(rows, meta({ hideSummarisedMessages: false }))), ids({ messages: rows }));
  assert.equal(capSummarizedHistory(rows, meta({ hideSummarisedMessages: false })).backlog, 0, "hiding off: no cap");
  assert.deepEqual(
    ids(
      capSummarizedHistory(
        rows,
        meta({ summaryEntries: [{ id: "e1", content: "Recap", enabled: false, messageIds: ["m3"] }] }),
      ),
    ),
    ids({ messages: rows }),
    "a disabled entry covers nothing",
  );
  assert.deepEqual(ids(capSummarizedHistory(rows, meta({ summaryTailMessages: 0 }))), ["m1", "m2", "m7", "m8"]);
  const shown = rows.map((row) => (row.id === "m4" ? { ...row, extra: { visibilityManual: true } } : row));
  assert.deepEqual(
    ids(capSummarizedHistory(shown, meta())),
    ["m1", "m2", "m4", "m6", "m7", "m8"],
    "shown by hand stays",
  );

  // A message only a turned-off summary covers is sent on purpose, and Backfill Summary skips it too.
  const off = meta({
    summaryEntries: [
      { id: "e1", content: "Recap", enabled: true, messageIds: ["m3", "m4", "m5", "m6"] },
      { id: "e0", content: "Old recap", enabled: false, messageIds: ["m1"] },
    ],
  });
  assert.deepEqual(ids(capSummarizedHistory(rows, off)), ["m1", "m2", "m6", "m7", "m8"]);
  assert.equal(capSummarizedHistory(rows, off).backlog, 1, "only m2 has no summary at all");

  // An entry the swipe's summary leaves out, by its messages or the ones it hid, covers nothing either.
  const split = meta({
    summaryEntries: [
      { id: "e1", content: "Recap", enabled: true, messageIds: ["m3", "m4"] },
      { id: "e2", content: "Recap", enabled: true, messageIds: ["m5", "m6"], hiddenMessageIds: ["m9"] },
    ],
  });
  assert.deepEqual(ids(capSummarizedHistory(rows, split)), ["m1", "m2", "m6", "m7", "m8"]);
  for (const target of ["m6", "m9"]) {
    assert.deepEqual(
      ids(capSummarizedHistory(rows, split, { excludeMessageIds: [target] })),
      ["m1", "m2", "m5", "m6", "m7", "m8"],
      `swiping ${target} keeps what e2 covered`,
    );
  }

  // Semantic retrieval always keeps only the newest entries, so what an older one covers is sent as it is.
  const dated = (entries: Array<Record<string, unknown>>) =>
    entries.map((entry, index) => ({ ...entry, createdAt: `2026-01-0${index + 1}T00:00:00.000Z` }));
  const semantic = meta({
    semanticSummaryRetrievalEnabled: true,
    semanticSummaryRecentCount: 1,
    summaryEntries: dated([
      { id: "e1", content: "Recap", enabled: true, messageIds: ["m3", "m4"] },
      { id: "e2", content: "Recap", enabled: true, messageIds: ["m5", "m6"] },
    ]),
  });
  assert.deepEqual(ids(capSummarizedHistory(rows, semantic)), ["m1", "m2", "m3", "m4", "m6", "m7", "m8"]);
  assert.equal(capSummarizedHistory(rows, semantic).backlog, 2, "m3 and m4 have a summary, so only m1 and m2 count");
  assert.deepEqual(
    ids(capSummarizedHistory(rows, { ...semantic, semanticSummaryRecentCount: 2 })),
    ["m1", "m2", "m6", "m7", "m8"],
    "both entries are among the newest kept",
  );
  console.log("summary recent tail regression passed");
} finally {
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  closeDB();
  rmSync(dir, { recursive: true, force: true });
}
