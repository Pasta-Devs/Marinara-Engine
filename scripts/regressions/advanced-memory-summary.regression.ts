import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-memory-summary-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

type RequestBody = {
  requestPath?: string;
  instructions?: string;
  input?: Array<{ content: string | Array<{ text: string }> }> | string[];
  max_output_tokens?: number;
  reasoning?: { effort?: string };
};
const requests: RequestBody[] = [];
let beforeSummary: (() => Promise<void>) | undefined;
let partial = false;
let sceneNeedsReasoningBudget = true;
const summary = "Maukie promised to return the compass before dawn.";
let summaryResponse = summary;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as RequestBody;
  response.setHeader("Content-Type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    response.end(JSON.stringify({ data: (body.input ?? []).map((_, index) => ({ index, embedding: [1, 0.5, 0] })) }));
    return;
  }
  assert(request.url?.endsWith("/responses"), "the actual Astra adapter uses Responses");
  requests.push({ ...body, requestPath: request.url });
  const input = (body.input as Array<{ content: string | Array<{ text: string }> }>)
    .flatMap((item) => (typeof item.content === "string" ? item.content : item.content.map((part) => part.text)))
    .join("\n");
  const classification = body.instructions?.startsWith("Identify scene transitions");
  let content: string;
  let incomplete = false;
  if (classification) {
    const transcript = JSON.parse(input) as Array<{ messageId: string; content: string }>;
    content = JSON.stringify({
      starts: transcript
        .filter((item) => item.content.startsWith("The following morning,"))
        .map(({ messageId }) => ({ messageId })),
    });
    incomplete = sceneNeedsReasoningBudget && (body.max_output_tokens ?? 0) < 2048;
    if (incomplete) content = "";
  } else {
    const callback = beforeSummary;
    beforeSummary = undefined;
    if (callback) await callback();
    // Model one plausible provider outcome: reasoning consumes the completion cap before final text.
    incomplete = partial || (body.max_output_tokens ?? 0) < 2048;
    content = incomplete
      ? partial
        ? '{"summary":"Maukie promised to return'
        : ""
      : JSON.stringify({ summary: summaryResponse });
  }
  response.end(
    JSON.stringify({
      id: "astra-memory-proof",
      status: incomplete ? "incomplete" : "completed",
      ...(incomplete ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
      output: content ? [{ type: "message", content: [{ type: "output_text", text: content }] }] : [],
      usage: {
        input_tokens: 100,
        output_tokens: incomplete ? body.max_output_tokens : 2000,
        output_tokens_details: { reasoning_tokens: incomplete && !content ? body.max_output_tokens : 1900 },
      },
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}/v1`;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { createConnectionSchema } = await import("../../packages/shared/src/schemas/connection.schema.ts");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS } = await import("../../packages/shared/src/types/advanced-memory.ts");
const { measureContextBudget } = await import("../../packages/server/src/services/llm/base-provider.js");
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const app = require("fastify")();
const db = await createFileNativeDB();
const { advancedMemoryRecords } = await import("../../packages/server/src/db/schema/advanced-memory.ts");
const { eq } = await import("../../packages/server/src/db/file-query.ts");
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
const connections = createConnectionsStorage(db);
app.decorate("db", db);
const { advancedMemoryRoutes } = await import("../../packages/server/src/routes/advanced-memory.routes.js");
await app.register(advancedMemoryRoutes, { prefix: "/chats" });
const settings = {
  ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
  enabled: true,
  maxContextTokens: 16_384,
  summaryBudgetTokens: 512,
};
async function createChat(name: string, hardCap?: number, omitReasoning = false) {
  const connection = await connections.create(
    createConnectionSchema.parse({
      name,
      provider: "openai",
      model: "gpt-6-astra",
      baseUrl,
      apiKey: "test-key",
      maxContext: 16_384,
      ...(hardCap ? { maxTokensOverride: hardCap } : {}),
      embeddingBaseUrl: baseUrl,
      embeddingModel: "memory-proof",
      treatAsLocalEndpoint: true,
    }),
  );
  assert(connection);
  if (omitReasoning)
    await connections.updateDefaultParameters(connection.id, { enabledParameters: { reasoningEffort: false } });
  const chat = await chats.create({ name, mode: "roleplay", characterIds: [], connectionId: connection.id });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    advancedMemory: settings,
    summaryConnectionId: connection.id,
    summaryMaxTokens: 4096,
  });
  await chats.createMessagesBatch(chat.id, [
    {
      role: "user",
      content:
        "At dusk by the lotus-filled river, I lent Maukie the brass compass. The frogs sang in the thickets and he promised that he would return it to me before dawn.",
    },
    { role: "assistant", content: "The following morning, we arrived at the market." },
  ]);
  return chat;
}
try {
  const chat = await createChat("Astra short summary");
  await memory.initialize(chat.id);
  const sceneRequest = requests.find((item) => item.instructions?.startsWith("Identify scene transitions"))!;
  assert.equal(sceneRequest.max_output_tokens, 4096, "scene decisions use Chat Summary output size");
  assert.equal(sceneRequest.reasoning?.effort, "low", "scene decisions request efficient reasoning too");
  const sceneCapped = await createChat("Explicit scene output cap", 256);
  const sceneRequestStart = requests.length;
  await memory.initialize(sceneCapped.id);
  assert(requests.length > sceneRequestStart);
  assert.equal(
    requests.at(-1)!.max_output_tokens,
    8196,
    "a small helper connection cap cannot starve automated summary reasoning",
  );
  sceneNeedsReasoningBudget = false;
  const body = requests.find((item) => !item.instructions?.startsWith("Identify scene transitions"))!;
  assert(body.instructions?.includes("self-contained historical recap"));
  assert(body.instructions?.includes('Omit "current situation", "open tensions"'));
  assert(body.max_output_tokens! >= 2048, "short retained memory does not starve reasoning of completion tokens");
  assert.equal(body.max_output_tokens, 8196, "automated summaries reserve at least 8,196 output tokens");
  assert.match(body.instructions!, /Write 2–3 paragraphs/u);
  assert.equal(
    body.reasoning?.effort,
    "low",
    "Astra maps the utility's efficient reasoning option to supported low effort",
  );
  assert(!body.instructions?.includes("1024 tokens"), "scene recaps have no hidden output target");
  const records = (await memory.status(chat.id)).records;
  assert.equal(records.find((record) => record.kind === "scene" && record.status === "closed")?.content, summary);
  assert(
    records.some((record) => record.kind === "excerpt" && record.content.includes("The frogs sang")),
    "only historical excerpts retain verbatim source text",
  );
  const sharedChat = await createChat("Two characters remember the same history");
  await chats.update(sharedChat.id, { characterIds: ["maukie", "powers"] });
  await chats.patchMetadata(sharedChat.id, {
    groupChatMode: "individual",
    advancedMemory: { ...settings, knowledgeStarts: { maukie: null, powers: null } },
  });
  const beforeShared = requests.length;
  await memory.initialize(sharedChat.id);
  const sharedScenes = (await memory.status(sharedChat.id)).records.filter(
    (record) => record.kind === "scene" && record.status === "closed" && record.audienceCharacterIds.length,
  );
  assert.equal(sharedScenes.length, 1, "characters with identical sources share one scene record");
  assert.deepEqual(sharedScenes[0]!.audienceCharacterIds, ["maukie", "powers"]);
  assert.equal(
    requests.slice(beforeShared).filter((item) => !item.instructions?.startsWith("Identify scene transitions")).length,
    1,
    "the common scene is summarized once, including the owner archive",
  );
  const sharedRow = (
    await db.select().from(advancedMemoryRecords).where(eq(advancedMemoryRecords.id, sharedScenes[0]!.id))
  )[0]!;
  for (const character of ["maukie", "powers"]) {
    await db.insert(advancedMemoryRecords).values({
      ...sharedRow,
      id: `legacy-${character}`,
      audienceCharacterIds: JSON.stringify([character]),
      content: `An earlier separately generated recap for ${character}.`,
    });
  }
  const beforeReuse = requests.length;
  await memory.initialize(sharedChat.id);
  assert.equal(requests.length, beforeReuse, "unchanged shared scenes need no further generation");
  assert(!(await memory.status(sharedChat.id)).records.some((record) => record.id.startsWith("legacy-")));
  await memory.updateRecord(sharedChat.id, sharedScenes[0]!.id, { content: "A shared manual correction." });
  await memory.initialize(sharedChat.id);
  assert.equal(
    (await memory.status(sharedChat.id)).records.find((record) => record.id === sharedScenes[0]!.id)?.content,
    "A shared manual correction.",
  );
  const sharedSource = await chats.listMessages(sharedChat.id);
  await chats.updateMessageExtra(sharedSource[0]!.id, { hiddenFromAICharacterIds: ["maukie"] });
  await memory.initialize(sharedChat.id);
  const restrictedScenes = (await memory.status(sharedChat.id)).records.filter(
    (record) => record.kind === "scene" && record.content && record.embeddingStatus !== "stale",
  );
  assert(
    !restrictedScenes.some((record) => record.audienceCharacterIds.includes("maukie")),
    "a previously shared scene cannot grant a character hidden history after its scope changes",
  );
  const characters = createCharactersStorage(db);
  const borrower = await characters.create(characterDataSchema.parse({ name: "Maukie" }));
  const narratorActor = await characters.create(characterDataSchema.parse({ name: "Narrator" }));
  assert(borrower && narratorActor);
  const narratorChat = await createChat("Narrator shares the whole scene archive");
  await chats.update(narratorChat.id, { characterIds: [borrower.id, narratorActor.id] });
  await chats.createMessagesBatch(
    narratorChat.id,
    Array.from({ length: 8 }, (_, index) => ({
      role: "user" as const,
      content: `${index === 6 ? "The following morning, " : ""}${"A brass compass promise beside the river. ".repeat(25)}`,
      extra: index === 2 ? { hiddenFromAICharacterIds: [narratorActor.id] } : undefined,
    })),
  );
  const narratorSource = await chats.listMessages(narratorChat.id);
  await chats.updateMessageExtra(narratorSource[8]!.id, { conversationStartForCharacterIds: [borrower.id] });
  await chats.patchMetadata(narratorChat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      ...settings,
      narratorCharacterId: narratorActor.id,
      knowledgeStarts: { [borrower.id]: narratorSource[8]!.id },
    },
  });
  await memory.initialize(narratorChat.id);
  const narratorScenes = (await memory.status(narratorChat.id)).records.filter((record) => record.kind === "scene");
  assert(
    !narratorScenes.some((record) => record.audienceCharacterIds.includes(narratorActor.id)),
    "the narrator does not get a separate character scene copy",
  );
  const earlySharedScene = narratorScenes.find(
    (record) => !record.audienceCharacterIds.length && record.messageIds.includes(narratorSource[0]!.id),
  );
  assert(earlySharedScene, "the shared archive includes scenes before ordinary characters joined");
  await chats.patchMetadata(narratorChat.id, {
    summaryEntries: [
      {
        id: "narrator-macro-correction",
        kind: "rolling",
        origin: "manual",
        content: "{{char}} alone keeps the corrected compass account.",
        enabled: true,
        title: "Narrator correction",
        sourceMode: "range",
        messageIds: [narratorSource[0]!.id],
        rangeStartIndex: 1,
        rangeEndIndex: 1,
        tokenEstimate: 12,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  const currentNarratorSource = await chats.listMessages(narratorChat.id);
  const narratorFullHistory = await memory.prepare({
    chatId: narratorChat.id,
    messages: currentNarratorSource,
    audienceCharacterIds: [narratorActor.id],
    budgetTokens: 50_000,
    readOnly: true,
  });
  assert.doesNotMatch(
    narratorFullHistory.chatSummary ?? "",
    /Narrator alone keeps/,
    "narrator constants do not duplicate their still-live source messages",
  );
  assert(narratorFullHistory.messageIds.includes(narratorSource[0]!.id), "the narrator knows the early history");
  assert(!narratorFullHistory.messageIds.includes(narratorSource[4]!.id), "explicit narrator hiding still applies");
  const narratorMemory = await memory.prepare({
    chatId: narratorChat.id,
    messages: currentNarratorSource,
    audienceCharacterIds: [narratorActor.id],
    budgetTokens: 1800,
  });
  assert(
    narratorMemory.chatSummary?.includes("Narrator alone keeps"),
    "archived narrator memory retains narrator macros",
  );
  assert.equal(
    narratorMemory.receipt.checkpointId,
    null,
    "constants use Chat Summaries, not separate continuity records",
  );
  const ownerMemory = await memory.prepare({
    chatId: narratorChat.id,
    messages: currentNarratorSource,
    audienceCharacterIds: [],
    audienceMode: "owner",
    budgetTokens: 50_000,
    readOnly: true,
  });
  assert(
    ownerMemory.messageIds.includes(currentNarratorSource.at(-1)!.id) &&
      ownerMemory.messageIds.every((id) => currentNarratorSource.slice(8).some((message) => message.id === id)),
    "explicit owner impersonation retains its own visibility rules when a narrator is selected",
  );
  await assert.rejects(
    memory.prepare({
      chatId: narratorChat.id,
      messages: currentNarratorSource,
      audienceCharacterIds: [],
      budgetTokens: 50_000,
      readOnly: true,
    }),
    /requires a responding character/i,
  );
  const repeated = await createChat("Repeated scene and continuity preparation");
  await chats.createMessagesBatch(
    repeated.id,
    Array.from({ length: 6 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content:
        index % 2 ? "The following morning, we moved to another location." : "We explored the island. ".repeat(200),
      createdAt: new Date(Date.now() + 1000 + index).toISOString(),
    })),
  );
  const repeatedMessages = await chats.listMessages(repeated.id);
  summaryResponse = `${summary} `.repeat(16);
  await Promise.all([memory.initialize(repeated.id), memory.initialize(repeated.id)]);
  summaryResponse = summary;
  const beforeRepeatedSummaries = requests.length;
  for (const budgetTokens of [1400, 1336, 1272, 1400]) {
    await memory.initialize(repeated.id);
    const prepared = await memory.prepare({
      chatId: repeated.id,
      messages: repeatedMessages,
      audienceCharacterIds: [],
      budgetTokens,
    });
    assert(prepared.receipt.estimatedTokensAfter <= budgetTokens);
    const archive = (await memory.status(repeated.id)).records;
    assert.equal(archive.filter((record) => record.kind === "scene" && record.status === "closed").length, 4);
    assert(
      !archive.some((record) => record.kind === "continuity"),
      "context adjustments never create continuity records",
    );
  }
  assert.equal(requests.length, beforeRepeatedSummaries, "prompt preparation never calls a summary model");
  const cjkChat = await createChat("CJK scene detection and complete summary chunks");
  const cjkSource = await chats.listMessages(cjkChat.id);
  const cjkText = "漢あ한𠀀😀".repeat(4000);
  await chats.updateMessageContent(cjkSource[0]!.id, cjkText);
  await chats.updateMessageContent(cjkSource[1]!.id, `The following morning,${cjkText}`);
  const cjkRequestStart = requests.length;
  await memory.initialize(cjkChat.id);
  const cjkRequests = requests.slice(cjkRequestStart);
  let summarizedSource = "";
  for (const request of cjkRequests) {
    const input = (request.input as Array<{ content: string | Array<{ text: string }> }>)
      .flatMap((item) => (typeof item.content === "string" ? item.content : item.content.map((part) => part.text)))
      .join("\n");
    assert(
      measureContextBudget(
        [
          { role: "system", content: request.instructions ?? "" },
          { role: "user", content: input },
        ],
        { maxContext: settings.maxContextTokens, maxTokens: request.max_output_tokens },
      ).fits,
      "every CJK classification and summary request must fit without provider trimming",
    );
    assert.doesNotMatch(input, /\p{Surrogate}/u, "CJK and emoji fragments must preserve surrogate pairs");
    if (!request.instructions?.startsWith("Identify scene transitions")) {
      summarizedSource += (input.match(/[漢あ한𠀀😀]/gu) ?? []).join("");
    }
  }
  assert.equal(summarizedSource, cjkText, "all original CJK source fragments reach the summarizer exactly once");
  assert.equal(
    (await memory.status(cjkChat.id)).records.find((record) => record.kind === "scene" && record.status === "closed")
      ?.content,
    summary,
    "large CJK history completes preparation rather than repeatedly failing its context guard",
  );
  const chatSource = await chats.listMessages(chat.id);
  const prepared = await memory.prepare({
    chatId: chat.id,
    messages: chatSource,
    audienceCharacterIds: [],
    budgetTokens: 4096,
    readOnly: true,
  });
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const legacyPolicy = hash([hash([false, [], {}, null]), settings, undefined, undefined, undefined]);
  await assert.rejects(
    memory.validatePrepared(chat.id, chatSource, { ...prepared.receipt, policyRevision: legacyPolicy }),
    /settings or summary corrections changed/,
    "cached prompts created before timeline labels must be rebuilt",
  );
  const mentionedPast = await createChat("Mentioned dates are not the scene's timeframe");
  const mentionedSource = await chats.listMessages(mentionedPast.id);
  await chats.updateMessageContent(
    mentionedSource[0]!.id,
    '"I remember January 2, 1990," she said. He replied that she died six years ago.',
  );
  await memory.initialize(mentionedPast.id);
  assert.equal(
    (await memory.status(mentionedPast.id)).records.find(
      (record) => record.kind === "scene" && record.status === "closed",
    )?.timeline,
    null,
    "remembered dates and durations inside dialogue do not become scene settings",
  );
  const repeatedDates = await createChat("Bounded pasted timeline labels");
  const repeatedSource = await chats.listMessages(repeatedDates.id);
  await chats.updateMessageContent(
    repeatedSource[0]!.id,
    Array.from({ length: 500 }, (_, index) => `Date: ${index} in an old ship's log`).join("\n"),
  );
  await memory.initialize(repeatedDates.id);
  assert(
    (await memory.status(repeatedDates.id)).records.every((record) => (record.timeline?.length ?? 0) <= 405),
    "repeated pasted labels cannot produce an unbounded mandatory timeframe header",
  );
  const correctedDate = await createChat("Manual time correction remains authoritative");
  const correctedSource = await chats.listMessages(correctedDate.id);
  await chats.updateMessageContent(
    correctedSource[0]!.id,
    `Date: June 10\n${"The meeting continued in the old market. ".repeat(200)}`,
  );
  await memory.initialize(correctedDate.id);
  const correctedScene = (await memory.status(correctedDate.id)).records.find(
    (record) => record.kind === "scene" && record.status === "closed",
  );
  assert(correctedScene);
  await memory.updateRecord(correctedDate.id, correctedScene.id, {
    content: "Correction: the meeting was June 12, not June 10.",
  });
  await memory.prepare({
    chatId: correctedDate.id,
    messages: await chats.listMessages(correctedDate.id),
    audienceCharacterIds: [],
    budgetTokens: 700,
  });
  await memory.checkScenesAfterGeneration(correctedDate.id);
  const correctedMemory = await memory.prepare({
    chatId: correctedDate.id,
    messages: await chats.listMessages(correctedDate.id),
    audienceCharacterIds: [],
    budgetTokens: 700,
  });
  assert(
    correctedMemory.chatSummary?.includes("source timeframe (summary corrections take precedence): June 10"),
    "source date labels explicitly defer to manual summary corrections",
  );
  assert(
    correctedMemory.chatSummary.includes("the meeting was June 12, not June 10"),
    "the corrected date survives continuity preparation unchanged",
  );

  const deletedChat = await createChat("Delete one shared scene summary");
  await chats.update(deletedChat.id, { characterIds: ["maukie", "powers"] });
  await chats.patchMetadata(deletedChat.id, {
    groupChatMode: "individual",
    advancedMemory: { ...settings, knowledgeStarts: { maukie: null, powers: null } },
  });
  await memory.initialize(deletedChat.id);
  const deletionStatus = await memory.status(deletedChat.id);
  const deletedScene = deletionStatus.records.find(
    (record) => record.kind === "scene" && record.content && record.audienceCharacterIds.length,
  )!;
  const openScene = deletionStatus.records.find((record) => record.kind === "scene" && record.status === "open")!;
  const deleteUrl = `/chats/${deletedChat.id}/advanced-memory/records/${deletedScene.id}`;
  assert.equal(
    (await app.inject({ method: "DELETE", url: `/chats/${chat.id}/advanced-memory/records/${deletedScene.id}` }))
      .statusCode,
    404,
    "deletion is scoped to the specified chat",
  );
  assert.equal(
    (await app.inject({ method: "DELETE", url: `/chats/${deletedChat.id}/advanced-memory/records/${openScene.id}` }))
      .statusCode,
    400,
    "deleting a recap cannot destroy its structural scene boundary",
  );
  const sourceBeforeDelete = await chats.listMessages(deletedChat.id);
  const deleted = await app.inject({ method: "DELETE", url: deleteUrl });
  assert.equal(deleted.statusCode, 200);
  assert(
    !deleted
      .json()
      .records.some((record: { kind: string; content: string }) => record.kind === "scene" && record.content),
    "deletion also removes the equivalent shared copy hidden behind the character summary",
  );
  assert.equal((await app.inject({ method: "GET", url: `${deleteUrl}/sources` })).statusCode, 404);
  await assert.rejects(memory.updateRecord(deletedChat.id, deletedScene.id, { enabled: true }), /not found/);
  const beforeMaintenance = requests.length;
  await memory.initialize(deletedChat.id);
  await memory.reindex(deletedChat.id);
  assert.equal(requests.length, beforeMaintenance, "preparation never pays to recreate the deleted recap");
  const afterDelete = await memory.status(deletedChat.id);
  assert(!afterDelete.records.some((record) => record.id === deletedScene.id));
  assert(
    afterDelete.records.some((record) => record.id === openScene.id),
    "the ongoing scene remains available",
  );
  assert.deepEqual(await chats.listMessages(deletedChat.id), sourceBeforeDelete, "source messages are untouched");
  const deletionMarker = (
    await db.select().from(advancedMemoryRecords).where(eq(advancedMemoryRecords.id, deletedScene.id))
  )[0]!;
  assert.equal(deletionMarker.content, "");
  assert.equal(deletionMarker.embedding, null);
  assert.equal(deletionMarker.summaryWork, null);

  const withoutReasoning = await createChat("Explicitly omitted reasoning parameter", undefined, true);
  const withoutReasoningStart = requests.length;
  await memory.initialize(withoutReasoning.id);
  assert(
    requests.slice(withoutReasoningStart).every((item) => !item.reasoning),
    "the connection's explicit parameter omission is preserved",
  );

  const capped = await createChat("Small Chat Summary output size", 8192);
  await chats.patchMetadata(capped.id, { summaryMaxTokens: 256 });
  const requestStart = requests.length;
  await memory.initialize(capped.id);
  assert.equal(
    requests.slice(requestStart).filter((item) => !item.instructions?.startsWith("Identify scene transitions")).length,
    1,
    "the summary receives enough reasoning room without hidden paid retries",
  );
  assert(
    requests
      .slice(requestStart)
      .filter((item) => !item.instructions?.startsWith("Identify scene transitions"))
      .every((item) => item.max_output_tokens === 8196),
    "automated summaries apply the reasoning floor independently of a smaller saved output size",
  );

  const tooSmall = await createChat("Context cannot fit the reasoning reserve");
  await connections.update(tooSmall.connectionId!, { maxContext: 8192 });
  await assert.rejects(memory.initialize(tooSmall.id), /output reserve do not fit/u);
  assert(!(await memory.status(tooSmall.id)).records.some((record) => record.kind === "scene" && record.content));

  const truncated = await createChat("Truncated summary");
  partial = true;
  await assert.rejects(memory.initialize(truncated.id), /output limit.*complet/i);
  assert(
    !(await memory.status(truncated.id)).records.some((record) => record.kind === "scene" && record.content),
    "partial visible text is not committed as a summary",
  );
  partial = false;
  await memory.initialize(truncated.id);
  assert.equal(
    (await memory.status(truncated.id)).records.find((record) => record.kind === "scene" && record.content)?.content,
    summary,
    "resume requests a complete summary instead of reusing truncated text",
  );

  const sceneOnly = await createChat("Scene-only helper summary with a 65k context");
  const helper = await connections.create(
    createConnectionSchema.parse({
      name: "Selected Advanced Memory helper",
      provider: "openai",
      model: "gpt-6-astra",
      baseUrl: `${baseUrl}/helper`,
      apiKey: "test-key",
      maxContext: 131_072,
      treatAsLocalEndpoint: true,
    }),
  );
  assert(helper);
  await chats.patchMetadata(sceneOnly.id, {
    advancedMemory: { ...settings, maxContextTokens: 65_000, helperConnectionId: helper.id },
    summaryMaxTokens: 12_000,
  });
  const sceneOnlySource = await chats.listMessages(sceneOnly.id);
  const wholeScene = `SCENE_START ${"Maukie explored the coast and returned the compass. ".repeat(1500)} SCENE_END`;
  await chats.updateMessageContent(sceneOnlySource[0]!.id, wholeScene);
  await chats.updateMessageContent(sceneOnlySource[1]!.id, "The following morning, ONGOING_SCENE_ONLY.");
  summaryResponse = `${summary} `.repeat(100);
  const sceneOnlyStart = requests.length;
  await memory.initialize(sceneOnly.id);
  const sceneOnlyRequests = requests.slice(sceneOnlyStart);
  const sceneSummaryRequests = sceneOnlyRequests.filter(
    (item) => !item.instructions?.startsWith("Identify scene transitions"),
  );
  assert.equal(sceneSummaryRequests.length, 1, "a scene fitting the context uses one summary request");
  assert(
    sceneOnlyRequests.every((item) => item.requestPath === "/v1/helper/responses"),
    "scene detection and summaries use the selected helper rather than the ordinary summary connection",
  );
  const sceneSummaryRequest = sceneSummaryRequests[0]!;
  assert.equal(sceneSummaryRequest.max_output_tokens, 12_000, "a larger Chat Summary output setting is preserved");
  const sceneInput = (sceneSummaryRequest.input as Array<{ content: string | Array<{ text: string }> }>)
    .flatMap((item) => (typeof item.content === "string" ? item.content : item.content.map((part) => part.text)))
    .join("\n");
  assert.equal(sceneInput, `#1 User: ${wholeScene}`, "the summary user message contains only its eligible scene");
  assert.doesNotMatch(sceneSummaryRequest.instructions!, /appendable continuation|only NEW durable|ordered summaries/);
  assert.match(sceneSummaryRequest.instructions!, /Return only valid JSON/);
  assert(
    measureContextBudget(
      [
        { role: "system", content: sceneSummaryRequest.instructions! },
        { role: "user", content: sceneInput },
      ],
      { maxContext: 65_000, maxTokens: sceneSummaryRequest.max_output_tokens },
    ).fits,
    "the helper request obeys the Advanced Memory context limit",
  );
  assert.equal(
    (await memory.status(sceneOnly.id)).records.find((record) => record.kind === "scene" && record.status === "closed")
      ?.content,
    summaryResponse.trim(),
    "a completed scene recap is retained without forcing it into the constant-summary budget",
  );
  summaryResponse = summary;

  // Main prompt preparation no longer performs continuity compaction. Its
  // background replacement and exact output setting are covered by post-generation regression.
  const joined = await createChat("Concurrent preparation requests");
  await chats.patchMetadata(joined.id, {
    advancedMemoryState: { status: "error", error: "Previous preparation failed" },
  });
  let releaseSummary!: () => void;
  const holdSummary = new Promise<void>((resolve) => {
    releaseSummary = resolve;
  });
  let enterSummary!: () => void;
  const entered = new Promise<void>((resolve) => {
    enterSummary = resolve;
  });
  beforeSummary = async () => {
    enterSummary();
    await holdSummary;
  };
  const initializeRoute = `/chats/${joined.id}/advanced-memory/initialize`;
  try {
    const initialRequests = await Promise.all(
      Array.from({ length: 3 }, () => app.inject({ method: "POST", url: initializeRoute, payload: {} })),
    );
    const first = initialRequests[0]!;
    assert.equal(first.statusCode, 202);
    assert.equal(
      first.json().job.status,
      "running",
      "202 acknowledges a persisted running job, never stale idle/error",
    );
    assert.equal(first.json().job.blocking, true);
    assert(
      initialRequests.every(
        (response) =>
          response.statusCode === 202 &&
          response.json().job.id === first.json().job.id &&
          response.json().job.error === null,
      ),
      "simultaneous start requests all acknowledge the same new job, not the previous error",
    );
    await entered;
    const count = requests.length;
    const repeated = await Promise.all(
      Array.from({ length: 3 }, () => app.inject({ method: "POST", url: initializeRoute, payload: { settings } })),
    );
    assert(
      repeated.every((response) => response.statusCode === 202 && response.json().job.id === first.json().job.id),
      "repeat clicks join one acknowledged job, including unchanged settings",
    );
    const controller = new AbortController();
    const waiter = memory.initialize(joined.id, { signal: controller.signal, blocking: true });
    controller.abort(new Error("Only stop this wait"));
    await assert.rejects(waiter, /Only stop this wait/);
    assert.equal(requests.length, count, "joined waits do not launch duplicate provider requests");
  } finally {
    releaseSummary();
  }
  await memory.initialize(joined.id);
  assert.equal(
    (await memory.status(joined.id)).job.status,
    "ready",
    "canceling one joined caller does not abort shared preparation",
  );
  await connections.update(sceneOnly.connectionId!, { maxContext: 131_072 });
  const restartChat = await chats.create({
    name: "Resume 19 saved summaries after a server restart",
    mode: "roleplay",
    characterIds: [],
    connectionId: sceneOnly.connectionId,
  });
  assert(restartChat);
  await chats.patchMetadata(restartChat.id, {
    advancedMemory: {
      ...settings,
      maxContextTokens: 65_000,
      helperConnectionId: helper.id,
      initialProcessingModel: "main",
    },
  });
  await chats.createMessagesBatch(
    restartChat.id,
    Array.from({ length: 1000 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: `${index > 0 && index % 48 === 0 ? "The following morning, " : ""}SCENE_${Math.floor(index / 48) + 1}: message ${index + 1}.`,
    })),
  );
  let restartSummaryCalls = 0;
  beforeSummary = async function stopAtTwentieth() {
    summaryResponse = `Saved scene ${++restartSummaryCalls}: ${summary}`;
    if (restartSummaryCalls === 20) partial = true;
    else beforeSummary = stopAtTwentieth;
  };
  const restartStart = requests.length;
  await assert.rejects(memory.initialize(restartChat.id), /output limit.*complet/i);
  const completedBeforeRestart = (await memory.status(restartChat.id)).records.filter(
    (record) => record.kind === "scene" && record.content,
  );
  assert.equal(completedBeforeRestart.length, 19, "nineteen paid summaries are complete before interruption");
  assert(
    requests
      .slice(restartStart)
      .every((item) =>
        item.instructions?.startsWith("Identify scene transitions")
          ? item.requestPath === "/v1/responses"
          : item.requestPath === "/v1/helper/responses",
      ),
    "the initial main-model choice applies to detection while summaries still use the helper",
  );
  await db._fileStore.close();
  const restartedDb = await createFileNativeDB();
  const restartedMemory = createAdvancedMemoryService(restartedDb);
  const restartedApp = require("fastify")();
  restartedApp.decorate("db", restartedDb);
  await restartedApp.register(advancedMemoryRoutes, { prefix: "/chats" });
  partial = false;
  summaryResponse = `Saved scene 20: ${summary}`;
  const restartedRequestStart = requests.length;
  try {
    const resumed = await restartedApp.inject({
      method: "POST",
      url: `/chats/${restartChat.id}/advanced-memory/initialize`,
      payload: {},
    });
    assert.equal(resumed.statusCode, 202);
    assert.notEqual(resumed.json().job.stage, "classifying");
    await restartedMemory.initialize(restartChat.id);
    const recovered = await restartedMemory.status(restartChat.id);
    assert.equal(recovered.job.status, "ready");
    assert.deepEqual(
      recovered.records.filter((record) => completedBeforeRestart.some((saved) => saved.id === record.id)),
      completedBeforeRestart,
      "completed summaries are reused from disk byte-for-byte after restarting",
    );
    assert.equal(requests.length - restartedRequestStart, 1, "Resume calls the model only for unfinished scene 20");
    assert(JSON.stringify(requests.at(-1)!.input).includes("SCENE_20:"));
    assert(!JSON.stringify(requests.at(-1)!.input).includes("SCENE_21:"), "the ongoing scene is not summarized early");
    assert.equal(recovered.records.filter((record) => record.kind === "scene" && record.status === "open").length, 1);
  } finally {
    await restartedApp.close();
    await restartedDb._fileStore.close();
    summaryResponse = summary;
  }

  console.info(
    "Advanced Memory summary regression passed (Astra Responses budgets, partial output, exact excerpts, acknowledged starts and joined cancellation).",
  );
} finally {
  beforeSummary = undefined;
  await app.close();
  await db._fileStore.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
}
