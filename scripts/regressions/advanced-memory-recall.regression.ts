import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-bounded-recall-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";
const calls: string[] = [];
const summaryInputs: string[] = [];
let stallQuery = false;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    const texts = Array.isArray(body.input) ? body.input : [body.input];
    calls.push("embedding");
    if (stallQuery) return;
    response.end(JSON.stringify({ data: texts.map((_: string, index: number) => ({ index, embedding: [1, 0, 0] })) }));
    return;
  }
  const classification = body.messages[0].content.startsWith("Identify scene transitions");
  calls.push(classification ? "classify" : "summary");
  if (!classification) summaryInputs.push(JSON.stringify(body.messages));
  const content = classification
    ? {
        starts: JSON.parse(body.messages[1].content)
          .filter((message: { content: string }) => message.content.startsWith("SCENE_CHANGE"))
          .map((message: { messageId: string }) => ({ messageId: message.messageId })),
      }
    : { summary: "SCENE_RECAP: The silver compass promise led the travelers through the mountain pass." };
  response.end(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: JSON.stringify(content) }, finish_reason: "stop" }],
    }),
  );
});
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const {
  DEFAULT_ADVANCED_MEMORY_SETTINGS,
  normalizeAdvancedMemorySettings,
  createChatSummaryEntry,
  estimateChatSummaryTokens,
} = await import("../../packages/shared/dist/index.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Bounded recall fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 65_000,
    maxTokensOverride: 512,
    embeddingModel: "fixture-embedding",
  });
  const chat = await chats.create({
    name: "Five past scenes",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
  });
  assert(chat);
  await memory.updateSettings(chat.id, { enabled: true, retrieveMinMessages: 3, retrieveMaxMessages: 3 });
  assert.equal(DEFAULT_ADVANCED_MEMORY_SETTINGS.retrieveMaxScenes, 3);
  assert.equal(
    normalizeAdvancedMemorySettings({ enabled: true }).retrieveMaxScenes,
    3,
    "old settings gain the default",
  );
  await chats.createMessagesBatch(
    chat.id,
    Array.from({ length: 65 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: `${index % 12 === 0 ? "SCENE_CHANGE " : ""}The silver compass promise led the travelers through the mountain pass. Turn ${index + 1}.`,
      extra: {
        ...(index === 60 ? { isConversationStart: true } : {}),
        attachments: [
          {
            type: "image",
            filename: "illustration_1.png",
            url: "/gallery/illustration.png",
            imageCaption: "ILLUSTRATION_CAPTION",
          },
          { type: "image/png", filename: "uploaded.png", data: "data:image/png;base64,AAAA" },
          { type: "text/plain", filename: "clue.txt", data: "data:text/plain,READABLE_CLUE_TEXT" },
        ],
      },
    })),
  );
  await memory.initialize(chat.id);
  const source = await chats.listMessages(chat.id);
  const input = { chatId: chat.id, messages: source, audienceCharacterIds: [], budgetTokens: 50_000 };
  const before = calls.length;
  const stages: string[] = [];
  const recalled = await memory.prepare({ ...input, onProgress: (job) => stages.push(job.stage) });
  assert.equal(
    recalled.receipt.recalledSceneIds.length,
    3,
    "the default caps distinct scenes, including matching excerpt chunks",
  );
  assert.equal(
    recalled.receipt.recalledMessageIds.length,
    9,
    "each scene contributes at most one three-message excerpt",
  );
  assert.deepEqual(
    calls.slice(before),
    ["embedding"],
    "ordinary recall only embeds its query, without archive preparation",
  );
  assert(!stages.includes("indexing") && !stages.includes("summarizing") && !stages.includes("classifying"));
  assert.equal(recalled.recalledMessages, null, "all recalled scenes share one prompt component");
  assert.match(
    recalled.recalledScenes!,
    /Present message range in the context is: #61–#65, with the last user message being #65\./u,
  );
  assert.equal(recalled.recalledScenes!.match(/SCENE_RECAP/g)?.length, 3);
  assert.doesNotMatch(
    recalled.recalledScenes!,
    /illustration_1|uploaded\.png|ILLUSTRATION_CAPTION|content unavailable/u,
  );
  assert.match(recalled.recalledScenes!, /READABLE_CLUE_TEXT/u, "readable attachments remain in recalled excerpts");
  assert.doesNotMatch(
    summaryInputs.join("\n"),
    /illustration_1|uploaded\.png|ILLUSTRATION_CAPTION|content unavailable/u,
  );
  assert.match(
    summaryInputs.join("\n"),
    /READABLE_CLUE_TEXT/u,
    "new summaries still receive readable source attachments",
  );
  assert.equal(recalled.recalledScenes!.match(/Excerpt:\nMessages #\d+–#\d+;/g)?.length, 3);
  for (const block of recalled.recalledScenes!.split("Scene summary:\n").slice(1)) {
    assert(block.indexOf("SCENE_RECAP") < block.indexOf("Excerpt:\n"), "each summary precedes its own excerpt");
    const range = /Excerpt:\nMessages #(\d+)–#(\d+);/u.exec(block)!;
    assert.equal(Number(range[2]) - Number(range[1]), 2, "one heading covers the complete contiguous excerpt");
    assert.equal(block.match(/^#\d+ /gm)?.length, 3);
  }
  await memory.validatePrepared(chat.id, source, recalled.receipt);
  const [intro, ...blocks] = recalled.recalledScenes!.split("Scene summary:\n");
  const sceneSummaryTokens = blocks.reduce(
    (total, block) => total + estimateChatSummaryTokens(`Scene summary:\n${block.split("\n\nExcerpt:\n")[0]!.trim()}`),
    0,
  );
  await memory.updateSettings(chat.id, { retrieveMinMessages: 1 });
  const summariesFirst = await memory.prepare({
    ...input,
    readOnly: true,
    budgetTokens:
      recalled.receipt.estimatedTokensAfter -
      estimateChatSummaryTokens(recalled.recalledScenes!) +
      sceneSummaryTokens +
      estimateChatSummaryTokens(intro!.trim()) +
      8,
  });
  assert.equal(
    summariesFirst.receipt.recalledSceneIds.length,
    3,
    "all fitting scene summaries take priority over every scene excerpt",
  );
  assert.equal(
    summariesFirst.receipt.recalledMessageIds.length,
    0,
    "excerpts use only the room left after scene summaries",
  );
  await memory.updateSettings(chat.id, { retrieveMinMessages: 3 });
  await memory.updateSettings(chat.id, { retrieveMaxScenes: 1 });
  const one = await memory.prepare({ ...input, readOnly: true });
  assert.equal(one.receipt.recalledSceneIds.length, 1);
  assert.equal(one.receipt.recalledMessageIds.length, 3);
  await assert.rejects(memory.validatePrepared(chat.id, source, recalled.receipt), /changed/u);
  await memory.updateSettings(chat.id, { retrieveMaxScenes: 0 });
  const beforeOff = calls.length;
  const off = await memory.prepare(input);
  assert.deepEqual(off.receipt.recalledSceneIds, []);
  assert.deepEqual(off.receipt.recalledMessageIds, []);
  assert.equal(off.recalledMessages, null);
  assert.equal(off.recalledScenes, null);
  assert.equal(off.chatSummary, null, "scene recall does not create a second constant-summary store");
  assert.equal(calls.length, beforeOff, "disabled recall does not request a query embedding");

  await memory.updateSettings(chat.id, { retrieveMaxScenes: 50, retrieveMinMessages: 0, retrieveMaxMessages: 0 });
  const summaries = await memory.prepare({ ...input, readOnly: true });
  assert.equal(summaries.receipt.recalledSceneIds.length, 5, "a limit is a maximum, not a required count");
  assert.equal(summaries.recalledMessages, null);
  assert.equal(summaries.recalledScenes!.match(/SCENE_RECAP/g)?.length, 5);

  await memory.updateSettings(chat.id, { retrieveMaxScenes: 3, retrieveMinMessages: 3, retrieveMaxMessages: 3 });
  const appended = await chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: "And what happened to that silver compass promise?",
  });
  assert(appended);
  const beforeAppend = calls.length;
  const next = await memory.prepare({ ...input, messages: await chats.listMessages(chat.id) });
  assert.deepEqual(calls.slice(beforeAppend), ["embedding"], "new live turns are not archived before generation");
  assert(next.messageIds.includes(appended.id));
  assert.match(next.recalledScenes!, /last user message being #66\./u);

  await memory.updateSettings(chat.id, { summaryBudgetTokens: 20_000 });
  const constantEntries = [
    [1, 12],
    [13, 62],
    [63, 66],
  ].map(([start, end], index) =>
    createChatSummaryEntry({
      id: `constant-${index}`,
      content: `CONSTANT_RANGE_${index} `.repeat(500),
      enabled: true,
      origin: "manual",
      rangeStartIndex: start,
      rangeEndIndex: end,
    }),
  );
  await chats.patchMetadata(chat.id, {
    summaryEntries: [
      ...constantEntries,
      createChatSummaryEntry({
        id: "disabled",
        content: "DISABLED_CONSTANT",
        enabled: false,
        origin: "manual",
        rangeStartIndex: 1,
        rangeEndIndex: 12,
      }),
      createChatSummaryEntry({
        id: "future",
        content: "FUTURE_CONSTANT",
        enabled: true,
        origin: "manual",
        rangeStartIndex: 1,
        rangeEndIndex: 100,
      }),
    ],
  });
  const withConstants = await memory.prepare({ ...input, messages: await chats.listMessages(chat.id), readOnly: true });
  assert(
    withConstants.chatSummary!.includes(constantEntries[0]!.content.trim()),
    "fully archived constants remain included",
  );
  assert.doesNotMatch(
    withConstants.chatSummary!,
    /CONSTANT_RANGE_1|CONSTANT_RANGE_2/u,
    "overlapping and live constants are omitted without changing their enabled state",
  );
  assert.doesNotMatch(withConstants.chatSummary!, /DISABLED_CONSTANT|FUTURE_CONSTANT/u);
  const tight = await memory.prepare({
    ...input,
    messages: await chats.listMessages(chat.id),
    readOnly: true,
    budgetTokens: estimateChatSummaryTokens(withConstants.chatSummary!) + 600,
  });
  assert.equal(
    tight.chatSummary,
    withConstants.chatSummary,
    "optional recalled scenes cannot displace constant summaries",
  );
  assert(
    tight.receipt.recalledSceneIds.length < withConstants.receipt.recalledSceneIds.length,
    "recall yields when constants use the available request budget",
  );
  assert(tight.receipt.estimatedTokensAfter <= tight.receipt.budgetTokens);

  stallQuery = true;
  const started = Date.now();
  const fallback = await memory.prepare({ ...input, messages: await chats.listMessages(chat.id) });
  assert(Date.now() - started < 4000, "a stalled embedding provider cannot stall optional recall for minutes");
  assert(fallback.receipt.recalledSceneIds.length > 0, "bounded lexical recall survives a stalled embedding provider");
  stallQuery = false;

  const savedScenes = (await memory.status(chat.id)).records.filter(
    (record) => record.kind === "scene" && record.content,
  );
  for (const record of savedScenes) {
    await memory.updateRecord(chat.id, record.id, {
      content: "The silver compass promise led the travelers through the mountain pass. ".repeat(68),
    });
  }
  for (const summaryBudgetTokens of [3000, 6000]) {
    await memory.updateSettings(chat.id, { summaryBudgetTokens });
    const constant = createChatSummaryEntry({
      id: "allocated-constant",
      content: "CONSTANT ".repeat(Math.floor((summaryBudgetTokens * 0.65 * 4) / 9)),
      enabled: true,
      rangeStartIndex: 1,
      rangeEndIndex: 12,
    });
    await chats.patchMetadata(chat.id, { summaryEntries: [constant] });
    const allocated = await memory.prepare({ ...input, messages: await chats.listMessages(chat.id), readOnly: true });
    assert(allocated.chatSummary!.includes(constant.content.trim()));
    const memoryTokens =
      estimateChatSummaryTokens(allocated.chatSummary!) + estimateChatSummaryTokens(allocated.recalledScenes!);
    assert(memoryTokens > summaryBudgetTokens, "relevant scenes can use the extra allowance");
    assert(
      memoryTokens <= summaryBudgetTokens + 2000,
      `total memory fits the user's ${summaryBudgetTokens} + 2k budget`,
    );
    assert.equal(allocated.receipt.recalledSceneIds.length, summaryBudgetTokens === 3000 ? 2 : 3);
  }
  const cueChat = await chats.create({
    name: "Distinctive details in old scenes",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
  });
  assert(cueChat);
  await memory.updateSettings(cueChat.id, {
    enabled: true,
    retrieveMaxScenes: 1,
    retrieveMinMessages: 0,
    retrieveMaxMessages: 0,
  });
  const topics = ["rosemary", "harbor", "orchard", "workshop", "library", "observatory"];
  await chats.createMessagesBatch(cueChat.id, [
    ...topics.flatMap((topic, index) =>
      Array.from({ length: 3 }, (_, turn) => ({
        role: "user" as const,
        content: `${turn === 0 ? "SCENE_CHANGE " : ""}The travelers discussed ${topic}. ${index === 0 ? "A parent treated childhood injuries with rosemary and gave the child an amber locket." : "They planned the silver compass journey through the mountain pass."}`,
      })),
    ),
    ...Array.from({ length: 3 }, (_, index) => ({
      role: "assistant" as const,
      content: "The silver compass journey through the mountain pass continues.",
      extra: index === 0 ? { isConversationStart: true } : {},
    })),
    {
      role: "user" as const,
      content:
        "SCENE_CHANGE Breakfast waits on the table. The plate holds fresh bread while the window admits sunlight. I remember rosemary Dad used on my scraped knees.",
    },
  ]);
  await memory.initialize(cueChat.id);
  const cueScenes = (await memory.status(cueChat.id)).records.filter(
    (record) => record.kind === "scene" && record.status === "closed" && record.content,
  );
  const targetScene = cueScenes.find((record) => record.startIndex === 1)!;
  assert(targetScene);
  const recap =
    "A parent comforted childhood injuries with rosemary. " +
    "The travelers repaired equipment, discussed checkpoint duties, apologized for an argument, washed clothes, prepared supplies, and agreed to rest before dawn. " +
    "An old dream concerned a forgotten companion, a mysterious vial, a damaged mechanism, coded markings, lavender soap, a winter expedition, and promises about future discoveries.";
  for (const scene of cueScenes) {
    await memory.updateRecord(cueChat.id, scene.id, {
      content: scene.id === targetScene.id ? recap : "The silver compass journey through the mountain pass continued.",
    });
  }
  const beforeCue = calls.length;
  const cueRecall = await memory.prepare({
    chatId: cueChat.id,
    messages: await chats.listMessages(cueChat.id),
    audienceCharacterIds: [],
    budgetTokens: 50_000,
    readOnly: true,
  });
  assert.deepEqual(
    cueRecall.receipt.recalledSceneIds,
    [targetScene.sceneId],
    "the latest distinctive cue beats older broad context",
  );
  assert.match(cueRecall.recalledScenes!, /parent comforted childhood injuries with rosemary/u);
  assert.deepEqual(cueRecall.receipt.recalledMessageIds, []);
  assert.equal(calls.length, beforeCue, "local cue ranking makes no model calls");

  const cueMessages = await chats.listMessages(cueChat.id);
  await chats.updateMessageContent(cueMessages.at(-1)!.id, "Where did that amber locket come from?");
  const sourceCue = await memory.prepare({
    chatId: cueChat.id,
    messages: await chats.listMessages(cueChat.id),
    audienceCharacterIds: [],
    budgetTokens: 50_000,
    readOnly: true,
  });
  assert.deepEqual(
    sourceCue.receipt.recalledSceneIds,
    [targetScene.sceneId],
    "original messages can find scenes even when excerpt output is disabled",
  );
  assert.deepEqual(sourceCue.receipt.recalledMessageIds, []);

  process.stdout.write(
    "Advanced Memory scene limits, paired excerpts, current-turn context and bounded retrieval passed.\n",
  );
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
