import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DecisionBackend } from "../../packages/server/src/services/decision/decision-default.js";

// #7699: the Decision shortlist ranks by words and meaning, adds the scene after a strong match, places each
// judged scene in the story, keeps the answers of requests that worked, gets time sized to its backend, and
// fills in vectors missing from Decision-mode archives after replies. Fake providers only: no network, no model.
const directory = mkdtempSync(join(tmpdir(), "marinara-recall-fusion-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

// The fake embedder counts concept words, so a paraphrase shares a direction with its scene but no word.
const CONCEPTS = [/\b(?:locket|pendant|chain)\b/giu, /\brope\b/giu];
let vector = (text: string) => [...CONCEPTS.map((concept) => (text.match(concept) ?? []).length), 0.1];
const embeddingInputs: string[][] = [];
let embeddingRequests = 0;
// An embedder that rejects some inputs, as llama-server does with a text over its batch size, fails the request.
let rejectedEmbedding: RegExp | null = null;
const recallRequests: Array<Array<{ id: string; text: string }>> = [];
const decisionBodies: string[] = [];
const recallConversations: string[] = [];
let embeddingsDown = false;
let failFirstRecallBatch = false;
let accepted = /locket|TARGET_SCENE/u;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url === "/v1/systemone") {
    decisionBodies.push(JSON.stringify(body));
    const memories: Array<{ id: string; text: string }> | undefined = body.state.memories;
    if (memories) {
      recallRequests.push(memories);
      recallConversations.push(body.state.currentConversation);
      if (failFirstRecallBatch && recallRequests.length === 1) {
        response.statusCode = 500;
        response.end("{}");
        return;
      }
    }
    const answers = Object.fromEntries(
      Object.entries(body.questions).map(([id, value]) => {
        const memory = memories?.find((item) => item.id === id);
        const message = body.state.transcript?.find((item: { messageId: string }) => item.messageId === id);
        const probability = memory
          ? accepted.test(memory.text)
            ? 0.95
            : 0.05
          : (value as { instructions: string }).instructions.includes("cut to a new scene") &&
              message?.content.startsWith("SCENE_CHANGE")
            ? 0.99
            : 0.01;
        return [id, { type: "noul", noul: probability }];
      }),
    );
    response.end(JSON.stringify({ answers }));
    return;
  }
  if (request.url === "/v1/embeddings") {
    embeddingRequests++;
    if (embeddingsDown || body.input.some((text: string) => rejectedEmbedding?.test(text))) {
      response.statusCode = 500;
      response.end("{}");
      return;
    }
    embeddingInputs.push(body.input);
    response.end(
      JSON.stringify({ data: body.input.map((text: string, index: number) => ({ index, embedding: vector(text) })) }),
    );
    return;
  }
  const scene = /\[scene (\d+)\]/u.exec(body.messages[1].content)?.[1];
  const summary =
    scene === undefined
      ? body.messages[1].content.includes("TARGET_SCENE")
        ? "TARGET_SCENE: The old oath concerned Cobalt refuge."
        : "Lantern soup was served."
      : sceneSummaries[Number(scene)];
  response.end(
    JSON.stringify({
      choices: [
        {
          message: { role: "assistant", content: JSON.stringify({ audience: "all", summary }) },
          finish_reason: "stop",
        },
      ],
    }),
  );
});

const LOCKET_SCENE = 5;
const LIGHTHOUSE_SCENE = 12;
// Every other scene shares the word "rope" with the questions, so word matching alone ranks these three last.
const chores = ["paint", "bread", "letters", "lamps", "boots", "tea", "nets", "a kettle", "soap"];
const summaries = Array.from({ length: 30 }, (_, index) =>
  index === LOCKET_SCENE
    ? "Kaito gave Mari a silver locket by the harbor."
    : index === LIGHTHOUSE_SCENE
      ? "Mari found a lighthouse key in the sand."
      : index === LIGHTHOUSE_SCENE + 1
        ? "They walked back at sunrise and slept until noon."
        : `Mari and Kaito bought rope${" and more rope".repeat(index % 3)} with ${chores[index % chores.length]} at the market.`,
);
let sceneSummaries = summaries;

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService, UNEMBEDDABLE_RETRY_MS } =
  await import("../../packages/server/src/services/advanced-memory.js");
const { rankDecisionMemories, memoryDecisionClock } =
  await import("../../packages/server/src/services/advanced-memory-decisions.js");
const { recallTerms, scoreRecallTerms, fuseRecallRanks, bestOverQueries } =
  await import("../../packages/server/src/services/advanced-memory-ranking.js");
const { estimateChatSummaryTokens } = await import("../../packages/shared/dist/index.js");
const { advancedMemoryRecords } = await import("../../packages/server/src/db/schema/advanced-memory.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const connections = createConnectionsStorage(db);
const memory = createAdvancedMemoryService(db);

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const helper = await connections.create({
    name: "Summary helper",
    provider: "custom",
    baseUrl: `${base}/v1`,
    model: "summary",
    apiKey: "fixture",
    maxContext: 65000,
    embeddingModel: "fixture",
  });
  const decision = await connections.create({
    name: "Jev",
    provider: "decision",
    decisionSource: "custom",
    baseUrl: base,
    model: "jev-latest",
    apiKey: "",
    maxStateTokens: 30000,
  });
  const decisionSettings = {
    enabled: true,
    decisionEnabled: true,
    decisionConnectionId: decision.id,
    knowledgeStarts: { kaito: null },
    knowledgeConfirmed: true,
    retrieveMaxScenes: 3,
    retrieveMinMessages: 1,
    retrieveMaxMessages: 1,
  };
  const sceneMessages = (index: number) => [
    { role: "user" as const, content: `SCENE_CHANGE [scene ${index}] Mari and Kaito meet.` },
    { role: "assistant" as const, characterId: "kaito", content: "Kaito nods." },
    { role: "user" as const, content: "They talk for a while." },
  ];
  const liveMessages = [
    { role: "user" as const, content: "SCENE_CHANGE Mari comes home late.", extra: { isConversationStart: true } },
    { role: "assistant" as const, characterId: "kaito", content: "Kaito waves from the kitchen." },
    { role: "user" as const, content: "Hello." },
  ];

  const chat = await chats.create({
    name: "Locket",
    mode: "roleplay",
    characterIds: ["kaito"],
    connectionId: helper.id,
  });
  assert(chat);
  await memory.updateSettings(chat.id, decisionSettings);
  await chats.createMessagesBatch(chat.id, [...summaries.flatMap((_, index) => sceneMessages(index)), ...liveMessages]);
  await memory.initialize(chat.id);
  const records = (await memory.status(chat.id)).records;
  const sceneRecord = (index: number) =>
    records.find((record) => record.kind === "scene" && record.content === summaries[index])!;
  assert(
    records.filter((record) => record.content).every((record) => record.embeddingStatus === "vectorized"),
    "Decision mode embeds what it archives",
  );
  const ask = async (question: string) => {
    const source = await chats.listMessages(chat.id);
    await chats.updateMessageContent(source.at(-1)!.id, question);
    recallRequests.length = 0;
    embeddingInputs.length = 0;
    return memory.prepare({
      chatId: chat.id,
      messages: await chats.listMessages(chat.id),
      audienceCharacterIds: ["kaito"],
      budgetTokens: 50000,
    });
  };

  // A paraphrase with no word of the scene reaches the shortlist by meaning, through rank fusion.
  const paraphrase = "Do you remember the pendant on its chain? We still need rope.";
  const fused = await ask(paraphrase);
  assert.deepEqual(embeddingInputs, [[paraphrase]], "the query embedding is the latest user message alone");
  const [scenePass] = recallRequests;
  assert(scenePass!.length <= 24);
  assert(
    scenePass!.some(({ id }) => id === sceneRecord(LOCKET_SCENE).id),
    "the locket scene reaches the Decision model through its vector",
  );
  assert.deepEqual(fused.receipt.recalledSceneIds, [sceneRecord(LOCKET_SCENE).sceneId]);
  // Each judged scene starts with one short line placing it in the story.
  for (const { text } of scenePass!) {
    const line = text.split("\n")[0]!;
    assert.match(line, /^Messages #\d+–#\d+; speakers: User, Character$/u);
    assert(estimateChatSummaryTokens(line) <= 25);
  }

  // "What happened after X": the scene after a strong match joins the shortlist, which keeps its size.
  await ask("What happened right after the lighthouse? We still need rope.");
  const [afterPass] = recallRequests;
  assert.equal(afterPass!.length, 24, "the shortlist keeps its size");
  assert(afterPass!.some(({ id }) => id === sceneRecord(LIGHTHOUSE_SCENE).id));
  assert(
    afterPass!.some(({ id }) => id === sceneRecord(LIGHTHOUSE_SCENE + 1).id),
    "the scene right after the lighthouse is judged too",
  );

  // A failed request costs only its own memories: the other request's answers still count. The first request
  // (the best 24) fails; the model accepts the sunrise scene in the second, and the locket scene falls back.
  await memory.updateSettings(chat.id, { retrieveMaxScenes: 30 });
  failFirstRecallBatch = true;
  accepted = /locket|sunrise/u;
  const partial = await ask(paraphrase);
  failFirstRecallBatch = false;
  accepted = /locket|TARGET_SCENE/u;
  await memory.updateSettings(chat.id, { retrieveMaxScenes: 3 });
  const [failed, answered] = recallRequests;
  assert.equal(failed!.length + answered!.length, 30, "30 scenes in two requests");
  assert(failed!.some(({ id }) => id === sceneRecord(LOCKET_SCENE).id));
  assert(answered!.some(({ id }) => id === sceneRecord(LIGHTHOUSE_SCENE + 1).id));
  assert(partial.receipt.reasons.includes("decision-recall"));
  assert(partial.receipt.reasons.includes("decision-recall-partial"), partial.receipt.reasons.join(", "));
  assert(!partial.receipt.reasons.includes("decision-recall-fallback"));
  assert.equal(
    partial.receipt.recalledSceneIds[0],
    sceneRecord(LIGHTHOUSE_SCENE + 1).sceneId,
    "the model's pick from the request that answered comes first",
  );
  assert(
    partial.receipt.recalledSceneIds.includes(sceneRecord(LOCKET_SCENE).sceneId),
    "ordinary recall still finds the locket among the unanswered scenes",
  );
  const failedScenes = new Set(failed!.map(({ id }) => records.find((record) => record.id === id)!.sceneId));
  assert(
    partial.receipt.recalledSceneIds.slice(1).every((sceneId) => failedScenes.has(sceneId)),
    "only unanswered scenes fall back, after the model's picks",
  );
  const rows = partial.receipt.decisionRecall!.results.filter((row) => row.kind === "scene");
  assert(rows.filter((row) => failed!.some(({ id }) => id === row.id)).every((row) => row.score === undefined));
  assert(rows.filter((row) => answered!.some(({ id }) => id === row.id)).every((row) => row.score !== undefined));
  assert.equal(partial.receipt.decisionRecall!.fallback, true);

  // Preparing again for the same reply keeps its Decision time limit: with none left, ordinary recall.
  recallRequests.length = 0;
  const late = await memory.prepare({
    chatId: chat.id,
    messages: await chats.listMessages(chat.id),
    audienceCharacterIds: ["kaito"],
    budgetTokens: 50000,
    decisionDeadline: Date.now() - 1,
  });
  assert.equal(recallRequests.length, 0, "no Decision request once the reply's limit has passed");
  assert(late.receipt.reasons.includes("decision-recall-fallback"), late.receipt.reasons.join(", "));

  // Vectors missing from a Decision-mode archive are filled in after replies, a bounded few at a time:
  // summaries first, the newest scenes first.
  const backfill = await chats.create({
    name: "Backfill",
    mode: "roleplay",
    characterIds: ["kaito"],
    connectionId: helper.id,
  });
  assert(backfill);
  await memory.updateSettings(backfill.id, decisionSettings);
  await chats.createMessagesBatch(backfill.id, [
    ...summaries.flatMap((_, index) => sceneMessages(index)),
    ...liveMessages,
  ]);
  embeddingsDown = true;
  await memory.initialize(backfill.id);
  embeddingsDown = false;
  const vectorized = async () =>
    (await memory.status(backfill.id)).records.filter((record) => record.embeddingStatus === "vectorized");
  assert.equal((await vectorized()).length, 0, "the embedder was down while archiving");
  const archived = (await memory.status(backfill.id)).records.filter(
    (record) => record.content && record.status === "closed",
  );
  assert.equal(archived.length, 60, "30 summaries and 30 excerpts lack vectors");
  embeddingInputs.length = 0;
  await memory.checkScenesAfterGeneration(backfill.id);
  const filled = await vectorized();
  assert.equal(filled.length, 32, "one reply fills a bounded number of records");
  assert.equal(embeddingInputs.length, 1, "in one embedding request");
  assert.equal(filled.filter((record) => record.kind === "scene").length, 30, "summaries first");
  const newestExcerpts = archived
    .filter((record) => record.kind === "excerpt")
    .sort((a, b) => b.startIndex - a.startIndex)
    .slice(0, 2)
    .map((record) => record.id)
    .sort();
  assert.deepEqual(
    filled
      .filter((record) => record.kind === "excerpt")
      .map((record) => record.id)
      .sort(),
    newestExcerpts,
    "then the newest scenes",
  );
  await memory.checkScenesAfterGeneration(backfill.id);
  assert.equal((await vectorized()).length, 60, "the next reply goes on");

  // Another embedding model's vectors are replaced the same way. A text the embedder rejects no longer fails
  // the others: they are sent one at a time, and the rejected one is skipped from then on.
  await connections.update(helper.id, { embeddingModel: "fixture-2" });
  rejectedEmbedding = /\[scene 29\]/u;
  embeddingInputs.length = 0;
  await memory.checkScenesAfterGeneration(backfill.id);
  assert.equal(embeddingInputs.flat().length, 31, "all but the rejected excerpt get the new model's vectors");
  assert(
    embeddingInputs.every((batch) => batch.length === 1),
    "one text per request once the batch failed",
  );
  let requests = embeddingRequests;
  embeddingInputs.length = 0;
  await memory.checkScenesAfterGeneration(backfill.id);
  assert.equal(embeddingRequests - requests, 1, "the rejected text is not sent again");
  assert.equal(embeddingInputs.flat().length, 28, "the fill moves on to the other excerpts");
  rejectedEmbedding = null;
  // A refusal is not forever: after the cooldown the rejected text is tried again and gets its vector.
  embeddingInputs.length = 0;
  await memory.checkScenesAfterGeneration(backfill.id);
  assert.equal(embeddingInputs.length, 0, "not before the cooldown ends");
  const realNow = Date.now;
  Date.now = () => realNow() + UNEMBEDDABLE_RETRY_MS + 1;
  try {
    await memory.checkScenesAfterGeneration(backfill.id);
  } finally {
    Date.now = realNow;
  }
  assert.equal(embeddingInputs.flat().length, 1, "the rejected text is tried again after the cooldown");
  assert.match(embeddingInputs.flat()[0]!, /\[scene 29\]/u);
  // With the embedder down, a reply sends the batch and its shortest text, not every text alone.
  await connections.update(helper.id, { embeddingModel: "fixture-3" });
  embeddingsDown = true;
  requests = embeddingRequests;
  await memory.checkScenesAfterGeneration(backfill.id);
  embeddingsDown = false;
  assert.equal(embeddingRequests - requests, 2);

  // The line placing a scene uses only what the reader saw: a message hidden from them gives no date.
  const group = await chats.create({
    name: "Dates",
    mode: "roleplay",
    characterIds: ["reader", "other"],
    connectionId: helper.id,
  });
  assert(group);
  await chats.patchMetadata(group.id, { groupChatMode: "individual" });
  await memory.updateSettings(group.id, {
    ...decisionSettings,
    knowledgeStarts: { reader: null, other: null },
  });
  const hidden = { hiddenFromAICharacterIds: ["reader"] };
  await chats.createMessagesBatch(group.id, [
    { role: "user", content: "SCENE_CHANGE\nDate: Spring 3\nTARGET_SCENE They make an oath." },
    { role: "assistant", characterId: "reader", content: "Cobalt refuge is our promise." },
    { role: "user", content: "Date: Autumn 1\nThey part ways.", extra: hidden },
    { role: "user", content: "SCENE_CHANGE\nDate: Winter 9\nPRIVATE_SECRET", extra: hidden },
    { role: "assistant", characterId: "other", content: "PRIVATE_SECRET kept.", extra: hidden },
    { role: "user", content: "SCENE_CHANGE They eat lantern soup." },
    { role: "assistant", characterId: "reader", content: "More soup." },
    { role: "user", content: "SCENE_CHANGE You remember the oath, don't you?", extra: { isConversationStart: true } },
  ]);
  await memory.initialize(group.id);
  recallRequests.length = 0;
  decisionBodies.length = 0;
  const dated = await memory.prepare({
    chatId: group.id,
    messages: await chats.listMessages(group.id),
    audienceCharacterIds: ["reader"],
    budgetTokens: 50000,
  });
  assert(dated.receipt.reasons.includes("decision-recall"), dated.receipt.reasons.join(", "));
  const oath = recallRequests[0]!.find(({ text }) => text.includes("TARGET_SCENE"))!;
  const oathLine = oath.text.split("\n")[0]!;
  assert.match(oathLine, /^Messages #1–#2; story time: Spring 3; speakers: User, Character$/u);
  assert(estimateChatSummaryTokens(oathLine) <= 25);
  assert.doesNotMatch(decisionBodies.join("\n"), /Autumn 1|Winter 9|PRIVATE_SECRET/u, "nothing the reader missed");

  // A group reply's recall reads what the user said since the responder last spoke, as when Maukie answers after
  // the user talked with Pantalone: each user message is its own embedding query, a record scores its best match,
  // and the cue words and the Decision model's conversation cover the same span (#7699).
  const conceptVector = vector;
  vector = (text: string) => [
    (text.match(/\b(?:locket|pendant|chain)\b/giu) ?? []).length,
    (text.match(/\brope\b/giu) ?? []).length,
    (text.match(/\bmarket\b/giu) ?? []).length,
    0.1,
  ];
  const span = await chats.create({
    name: "Span",
    mode: "roleplay",
    characterIds: ["maukie", "pantalone", "colombina"],
    connectionId: helper.id,
  });
  assert(span);
  await chats.patchMetadata(span.id, { groupChatMode: "individual" });
  await memory.updateSettings(span.id, {
    ...decisionSettings,
    knowledgeStarts: { maukie: null, pantalone: null, colombina: null },
  });
  const cue = "Pantalone, do you remember the pendant on its chain?";
  const smallTalk = ["We still need rope, Pantalone.", "Anyway, we still need rope."];
  await chats.createMessagesBatch(span.id, [
    ...summaries.flatMap((_, index) =>
      sceneMessages(index).map((message) =>
        message.role === "assistant" ? { ...message, characterId: "pantalone" } : message,
      ),
    ),
    { role: "user", content: "SCENE_CHANGE Mari comes home late.", extra: { isConversationStart: true } },
    { role: "assistant", characterId: "maukie", content: "Maukie waves from the kitchen." },
    { role: "user", content: cue },
    { role: "assistant", characterId: "pantalone", content: "Pantalone shrugs." },
    { role: "user", content: smallTalk[0]! },
    { role: "assistant", characterId: "pantalone", content: "Pantalone counts his coins." },
    { role: "user", content: smallTalk[1]! },
  ]);
  await memory.initialize(span.id);
  const spanRecords = (await memory.status(span.id)).records;
  const spanScene = (index: number) =>
    spanRecords.find((record) => record.kind === "scene" && record.content === summaries[index])!;
  const replyAs = async (responder: string, continueMessageId?: string) => {
    recallRequests.length = 0;
    recallConversations.length = 0;
    embeddingInputs.length = 0;
    return memory.prepare({
      chatId: span.id,
      messages: await chats.listMessages(span.id),
      audienceCharacterIds: [responder],
      budgetTokens: 50000,
      continueMessageId,
    });
  };
  // Mari's case: the question was the first of three user messages to Pantalone, and Maukie replies.
  const maukie = await replyAs("maukie");
  assert.deepEqual(embeddingInputs, [[cue, ...smallTalk]], "each user message since Maukie spoke, one request");
  assert(
    recallRequests[0]!.some(({ id }) => id === spanScene(LOCKET_SCENE).id),
    "the locket scene reaches the Decision shortlist through the first message",
  );
  assert.match(recallConversations[0]!, /pendant on its chain/u, "the Decision model reads the question too");
  assert.deepEqual(maukie.receipt.recalledSceneIds, [spanScene(LOCKET_SCENE).sceneId]);
  // Decision off: the locket scene scores by the first message and the rope scenes by the later ones, each by its
  // best match, so the locket comes first, then the scenes most about rope.
  await memory.updateSettings(span.id, { decisionEnabled: false });
  const plain = await replyAs("maukie");
  await memory.updateSettings(span.id, { decisionEnabled: true });
  const mostRope = summaries.flatMap((summary, index) => (summary.split("rope").length === 4 ? [index] : []));
  assert.equal(plain.receipt.recalledSceneIds[0], spanScene(LOCKET_SCENE).sceneId, "the locket scene first");
  assert.equal(plain.receipt.recalledSceneIds.length, 3);
  assert(
    plain.receipt.recalledSceneIds
      .slice(1)
      .every((sceneId) => mostRope.some((index) => spanScene(index).sceneId === sceneId)),
    "then the scenes the latest message matches best",
  );
  // Colombina has not spoken yet: the latest user message, as before.
  await replyAs("colombina");
  assert.deepEqual(embeddingInputs, [[smallTalk[1]]], "a first reply reads the latest user message");
  assert.doesNotMatch(recallConversations[0] ?? "", /pendant/u, "and the last four messages");
  // Continuing Maukie's reply reads what it answered, as when it began, not from after the reply itself.
  const [partialReplyId] = await chats.createMessagesBatch(span.id, [
    { role: "assistant", characterId: "maukie", content: "Maukie starts to answer." },
  ]);
  const continued = await replyAs("maukie", partialReplyId);
  assert.deepEqual(embeddingInputs, [[cue, ...smallTalk]], "a continuation reads the same user messages");
  assert.match(recallConversations[0]!, /pendant on its chain/u, "and the Decision model reads the question");
  assert.deepEqual(continued.receipt.recalledSceneIds, [spanScene(LOCKET_SCENE).sceneId]);
  await chats.removeMessage(partialReplyId!);
  // What Maukie may not read never joins his query: a whisper to Pantalone, a message hidden from Maukie.
  await chats.createMessagesBatch(span.id, [
    {
      role: "user",
      content: '[whisper: character="Pantalone" text="WHISPERED_PENDANT"]',
      extra: {
        roleplayCommandActivity: [
          {
            command: { type: "whisper", character: "Pantalone", text: "WHISPERED_PENDANT" },
            raw: '[whisper: character="Pantalone" text="WHISPERED_PENDANT"]',
            whisperRecipient: { id: "pantalone", kind: "character" },
          },
        ],
      },
    },
    { role: "user", content: "HIDDEN_PENDANT chain", extra: { hiddenFromAICharacterIds: ["maukie"] } },
  ]);
  await replyAs("maukie");
  assert.deepEqual(embeddingInputs, [[cue, ...smallTalk]], "nothing Maukie may not read");
  assert.doesNotMatch(recallConversations.join("\n"), /WHISPERED|HIDDEN_PENDANT/u);
  await replyAs("pantalone");
  assert.deepEqual(embeddingInputs, [[smallTalk[1], "HIDDEN_PENDANT chain"]], "Pantalone's span is his own");
  // At most the six latest user messages with text; an image alone has none to search with.
  const notes = Array.from({ length: 8 }, (_, index) => `Rope note ${index + 1}.`);
  await chats.createMessagesBatch(span.id, [
    { role: "assistant", characterId: "maukie", content: "Maukie nods." },
    ...notes.map((content) => ({ role: "user" as const, content })),
    { role: "user", content: "", extra: { attachments: [{ type: "image", url: "/rope.png" }] } },
  ]);
  await replyAs("maukie");
  assert.deepEqual(embeddingInputs, [notes.slice(-6)], "the six latest user messages with text");
  // An embedder that rejects one long earlier message fails the whole request: the latest message is then
  // embedded alone, so the question still finds the locket by meaning.
  const question = "Do you remember the pendant on its chain?";
  await new Promise((resolve) => setTimeout(resolve, 20)); // after the notes' timestamps
  await chats.createMessagesBatch(span.id, [
    { role: "assistant", characterId: "maukie", content: "Maukie listens." },
    { role: "user", content: `LONG_TURN ${"The storm rolls over the hills. ".repeat(60)}` },
    { role: "assistant", characterId: "pantalone", content: "Pantalone shrugs." },
    { role: "user", content: question },
  ]);
  await memory.updateSettings(span.id, { decisionEnabled: false });
  rejectedEmbedding = /LONG_TURN/u;
  requests = embeddingRequests;
  const rejectedTurn = await replyAs("maukie");
  rejectedEmbedding = null;
  await memory.updateSettings(span.id, { decisionEnabled: true });
  assert.equal(embeddingRequests - requests, 2, "the span's messages, then the latest alone");
  assert.deepEqual(embeddingInputs, [[question]]);
  assert.deepEqual(rejectedTurn.receipt.recalledSceneIds, [spanScene(LOCKET_SCENE).sceneId]);
  vector = conceptVector;

  // After-reply vector upkeep and Reindex use only records Reindex accepts, and a failed Reindex keeps old vectors.
  const stale = await chats.create({
    name: "Stale",
    mode: "roleplay",
    characterIds: ["kaito"],
    connectionId: helper.id,
  });
  assert(stale);
  await memory.updateSettings(stale.id, decisionSettings);
  await chats.createMessagesBatch(stale.id, [
    ...summaries.flatMap((_, index) => sceneMessages(index)),
    ...liveMessages,
  ]);
  embeddingsDown = true;
  await memory.initialize(stale.id);
  embeddingsDown = false;
  const staleRecords = (await memory.status(stale.id)).records.filter(
    (record) => record.content && record.status === "closed",
  );
  // The two newest scenes' records lean on a summary correction that no longer exists.
  const newestStart = Math.max(...staleRecords.map((record) => record.startIndex));
  const outdated = staleRecords.filter((record) => record.startIndex >= newestStart - 3);
  assert.equal(outdated.length, 4);
  for (const record of outdated)
    await db
      .update(advancedMemoryRecords)
      .set({ dependencies: JSON.stringify([{ id: "summary:removed", revision: "gone" }]) })
      .where(eq(advancedMemoryRecords.id, record.id));
  const outdatedIds = new Set(outdated.map((record) => record.id));
  assert.deepEqual(
    (await memory.status(stale.id)).records.filter((record) => record.embeddingStatus === "stale").map(({ id }) => id),
    outdated.map(({ id }) => id),
    "only those are invalid",
  );
  const outdatedVectors = async () =>
    (await db.select().from(advancedMemoryRecords)).filter((row) => outdatedIds.has(row.id) && row.embedding).length;
  embeddingInputs.length = 0;
  await memory.checkScenesAfterGeneration(stale.id);
  const staleVectorized = () =>
    memory.status(stale.id).then(({ records }) => records.filter((record) => record.embeddingStatus === "vectorized"));
  assert.equal(embeddingInputs.flat().length, 32, "the reply's places all go to valid records");
  assert.equal(await outdatedVectors(), 0, "no invalid record is embedded");
  const before = new Map((await staleVectorized()).map((record) => [record.id, record]));
  assert.equal(before.size, 32);
  embeddingsDown = true;
  await memory.reindex(stale.id);
  embeddingsDown = false;
  assert.deepEqual(
    (await staleVectorized()).map((record) => record.id).sort(),
    [...before.keys()].sort(),
    "Reindex with the embedder down keeps every vector",
  );
  // 28 closed scenes' two records each, and the live scene's excerpt.
  embeddingInputs.length = 0;
  await memory.reindex(stale.id);
  assert.equal(embeddingInputs.flat().length, 57, "Reindex embeds every valid record again, and no invalid one");
  assert.equal(await outdatedVectors(), 0);
  assert.equal((await staleVectorized()).length, 57);

  // Until nearly every scene has a vector, the shortlist keeps ordinary recall's order. Vectors come to the newest
  // scenes first, and fused with so few, their unrelated similarities would push word matches out (#7699).
  const cues =
    "amber basil cedar delta ember flint grove harbor ivory juniper kelp lilac maple nectar olive pebble quartz raven sable thistle umber velvet willow yarrow zinnia".split(
      " ",
    );
  // Scene i < 24 shares 25 - i of the question's words, so it ranks i + 1st by words; later scenes share one.
  sceneSummaries = Array.from(
    { length: 40 },
    (_, index) => `Scene ${index} notes: ${cues.slice(0, index < 24 ? 25 - index : 1).join(" ")}.`,
  );
  // Every summary's similarity is low and unrelated to the question, as with a plain local embedder.
  vector = (text: string) =>
    text.includes("Remember")
      ? [1, 0, 1]
      : [0, 1, ([...text].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 997, 0) / 997) * 0.3];
  const coverage = await chats.create({
    name: "Coverage",
    mode: "roleplay",
    characterIds: ["kaito"],
    connectionId: helper.id,
  });
  assert(coverage);
  await memory.updateSettings(coverage.id, decisionSettings);
  await chats.createMessagesBatch(coverage.id, [
    ...sceneSummaries.flatMap((_, index) => sceneMessages(index)),
    ...liveMessages.slice(0, -1),
    { role: "user", content: `Remember ${cues.join(" ")}?` },
  ]);
  embeddingsDown = true;
  await memory.initialize(coverage.id);
  embeddingsDown = false;
  const coverageRecords = (await memory.status(coverage.id)).records;
  const coveragePass = async () => {
    recallRequests.length = 0;
    await memory.prepare({
      chatId: coverage.id,
      messages: await chats.listMessages(coverage.id),
      audienceCharacterIds: ["kaito"],
      budgetTokens: 50000,
    });
    return recallRequests[0]!.map(({ id }) =>
      sceneSummaries.indexOf(coverageRecords.find((r) => r.id === id)!.content!),
    );
  };
  const wordsOnly = await coveragePass();
  assert.deepEqual(
    [...wordsOnly].sort((a, b) => a - b),
    Array.from({ length: 24 }, (_, index) => index),
    "with no vectors, the 24 best word matches",
  );
  await memory.checkScenesAfterGeneration(coverage.id);
  assert.equal(
    (await memory.status(coverage.id)).records.filter(
      (record) => record.kind === "scene" && record.embeddingStatus === "vectorized",
    ).length,
    32,
    "one reply gives the newest 32 of 40 summaries vectors",
  );
  const partlyVectored = await coveragePass();
  assert.deepEqual(
    [...partlyVectored].sort((a, b) => a - b),
    [...wordsOnly].sort((a, b) => a - b),
    "no word match is pushed out",
  );
  assert.deepEqual(partlyVectored, wordsOnly, "in the word-match order");
  sceneSummaries = summaries;

  // The pass is sized to its backend: the expected time with headroom, at least 10 s, at most its cap, and
  // a backend too slow for every statement judges fewer, the best ranked first.
  const asked: string[][] = [];
  const backend = {
    maxStateTokens: 30000,
    calibration: { defaultThreshold: 0.5, questionShape: "text" },
    requestMs: (statements: number) => statements * 350,
    askMixed: async (_state: unknown, questions: Array<{ id: string }>) => {
      asked.push(questions.map(({ id }) => id));
      return { answers: new Map(questions.map(({ id }) => [id, 0.9])), choices: new Map() };
    },
  } as unknown as DecisionBackend;
  const candidates = Array.from({ length: 36 }, (_, index) => ({ id: `memory-${index}`, text: "A past promise." }));
  const sized = (maxMs: number) => {
    const limits: number[] = [];
    return {
      limits,
      clock: { signal: new AbortController().signal, maxMs, limit: (ms: number) => limits.push(ms), stop() {} },
    };
  };
  let pass = sized(25_000);
  assert.equal(
    (await rankDecisionMemories(backend, "Remember?", [], candidates.slice(0, 24), undefined, undefined, pass.clock))
      ?.size,
    24,
  );
  assert.deepEqual(pass.limits, [24 * 350 * 1.5], "Open-Jev 2B gets 12.6 s for 24 statements");
  pass = sized(25_000);
  await rankDecisionMemories(backend, "Remember?", [], candidates.slice(0, 4), undefined, undefined, pass.clock);
  assert.deepEqual(pass.limits, [10_000], "never under 10 s");
  backend.requestMs = (statements) => statements * 800;
  asked.length = 0;
  pass = sized(25_000);
  const fewer = await rankDecisionMemories(backend, "Remember?", [], candidates, undefined, undefined, pass.clock);
  assert.deepEqual(
    [...fewer!.keys()],
    candidates.slice(0, 20).map(({ id }) => id),
    "9B judges the best 20 of 36",
  );
  assert.deepEqual(pass.limits, [20 * 800 * 1.5]);
  assert(pass.limits[0]! <= 25_000, "within the cap");
  assert.deepEqual(
    asked.map((batch) => batch.length),
    [10, 10],
    "requests of at most 8 s, so a time limit keeps those that finished",
  );
  // A chat model's speed is unknown: it is asked every candidate in short requests, and a fast one answers all.
  backend.requestMs = undefined;
  asked.length = 0;
  pass = sized(25_000);
  assert.equal(
    (await rankDecisionMemories(backend, "Remember?", [], candidates.slice(0, 24), undefined, undefined, pass.clock))
      ?.size,
    24,
  );
  assert.deepEqual(
    asked.map((batch) => batch.length),
    [8, 8, 8],
  );
  assert.deepEqual(pass.limits, [25_000]);
  // A System One connection answers a request's statements together; its per-statement limit is not its cost.
  backend.requestMs = () => 4000;
  pass = sized(15_000);
  assert.equal(
    (await rankDecisionMemories(backend, "Remember?", [], candidates, undefined, undefined, pass.clock))?.size,
    36,
  );
  assert.deepEqual(pass.limits, [12_000], "two requests of a connection");
  // The clock aborts at its limit, never past its cap.
  const capped = memoryDecisionClock(undefined, 40);
  capped.limit(60_000);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert(capped.signal.aborted, "the cap holds");
  capped.stop();

  // One failed batch keeps the other's answers; a candidate too large for any request keeps its full text and
  // falls back alone.
  backend.requestMs = undefined;
  let calls = 0;
  backend.askMixed = async (_state: unknown, questions: Array<{ id: string }>) =>
    ++calls === 2
      ? { answers: new Map(), choices: new Map(), error: "down" }
      : { answers: new Map(questions.map(({ id }) => [id, 0.9])), choices: new Map() };
  const mixed = await rankDecisionMemories(
    backend,
    "Remember?",
    [],
    [...candidates.slice(0, 30), { id: "huge", text: "x ".repeat(40_000) }],
  );
  assert.deepEqual(
    [...mixed!].filter(([, score]) => score === 0.9).map(([id]) => id),
    candidates.slice(0, 24).map(({ id }) => id),
  );
  assert.deepEqual(
    [...mixed!]
      .filter(([, score]) => score === null)
      .map(([id]) => id)
      .sort(),
    [...candidates.slice(24, 30).map(({ id }) => id), "huge"].sort(),
  );

  // A record scores its best match over the queries. An earlier query close to everything, like a long story turn,
  // first loses 1.5 times how much its mean is above the latest's, so it lifts only what stands out for it.
  const rounded = (values: number[]) => values.map((value) => Math.round(value * 100) / 100);
  assert.deepEqual(bestOverQueries([[0.2, 0.9]]), [0.2, 0.9], "one query: its own scores");
  assert.deepEqual(
    bestOverQueries([
      [0.8, 0, 0.1],
      [0.3, 0.3, 0.3],
    ]),
    [0.8, 0.3, 0.3],
    "a focused earlier query",
  );
  assert.deepEqual(
    rounded(
      bestOverQueries([
        [0.8, 0.6, 0.7],
        [0.1, 0.2, 0.6],
      ]),
    ),
    [0.2, 0.2, 0.6],
    "a diffuse earlier query loses 1.5 times its excess mean",
  );

  // Fusion keeps the word order when no vector exists, and lets a strong vector match in.
  const words = new Map([
    ["a", 0.9],
    ["b", 0.5],
    ["c", 0],
    ["d", 0],
  ]);
  assert.deepEqual(fuseRecallRanks(words, new Map()), ["a", "b", "c", "d"]);
  assert.deepEqual(
    fuseRecallRanks(
      words,
      new Map([
        ["d", 0.4],
        ["a", 0.1],
        ["b", 0.1],
        ["c", 0.1],
      ]),
    ).slice(0, 2),
    ["a", "d"],
  );

  // Chinese and Japanese text is matched by overlapping character pairs, not as one sentence-long word.
  const japanese = recallTerms("祭りの夜にカイトがくれた月のロケットを覚えてる？");
  assert(japanese.has("ロケ") && japanese.has("ット") && japanese.has("祭り"));
  assert(!japanese.has("祭りの夜にカイトがくれた月のロケットを覚えてる"));
  const chinese = [recallTerms("凯托在节日那天晚上送我月亮吊坠"), recallTerms("我们去市场买绳子")];
  const [pendant, rope] = scoreRecallTerms(recallTerms("你还记得那个吊坠吗"), chinese);
  assert(pendant! > 0 && rope === 0, "a Chinese question finds the scene that shares its words");
  assert.deepEqual([...recallTerms("Shiro's bowl is still full")], ["shiro", "bowl", "still", "full"]);

  console.log("Advanced Memory recall fusion, neighbours, scene lines, partial passes, sizing and backfill passed.");
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
