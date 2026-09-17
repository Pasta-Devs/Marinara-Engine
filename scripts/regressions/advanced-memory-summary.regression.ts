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
  requests.push(body);
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
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { createConnectionSchema } = await import("../../packages/shared/src/schemas/connection.schema.ts");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS } = await import("../../packages/shared/src/types/advanced-memory.ts");
const { measureContextBudget } = await import("../../packages/server/src/services/llm/base-provider.js");
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const app = require("fastify")();
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
const connections = createConnectionsStorage(db);
app.decorate("db", db);
const { advancedMemoryRoutes } = await import("../../packages/server/src/routes/advanced-memory.routes.js");
await app.register(advancedMemoryRoutes, { prefix: "/chats" });
const settings = {
  ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
  enabled: true,
  maxContextTokens: 8192,
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
      maxContext: 8192,
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
  await chats.patchMetadata(chat.id, { advancedMemory: settings, summaryConnectionId: connection.id });
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
  assert.equal(sceneRequest.max_output_tokens, 2048, "scene decisions reserve context-bounded reasoning space");
  assert.equal(sceneRequest.reasoning?.effort, "low", "scene decisions request efficient reasoning too");
  const sceneCapped = await createChat("Explicit scene output cap", 256);
  const sceneRequestStart = requests.length;
  await assert.rejects(memory.initialize(sceneCapped.id), /scene helper.*output limit/i);
  assert.equal(requests.length, sceneRequestStart + 1, "truncated classification does not trigger paid retries");
  assert.equal(requests.at(-1)!.max_output_tokens, 256, "scene classification respects the connection cap");
  sceneNeedsReasoningBudget = false;
  const body = requests.find((item) => !item.instructions?.startsWith("Identify scene transitions"))!;
  assert(body.max_output_tokens! >= 2048, "short retained memory does not starve reasoning of completion tokens");
  assert(
    body.max_output_tokens! <= Math.floor(settings.maxContextTokens / 3),
    "completion reserve stays context bounded",
  );
  assert.equal(
    body.reasoning?.effort,
    "low",
    "Astra maps the utility's efficient reasoning option to supported low effort",
  );
  assert(JSON.stringify(body.input).includes("under 409 tokens"), "visible summary target remains short");
  const records = (await memory.status(chat.id)).records;
  assert.equal(records.find((record) => record.kind === "scene" && record.status === "closed")?.content, summary);
  assert(
    records.some((record) => record.kind === "excerpt" && record.content.includes("The frogs sang")),
    "only historical excerpts retain verbatim source text",
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
  let checkpointId: string | null = null;
  const beforeRepeatedSummaries = requests.length;
  for (const budgetTokens of [1400, 1336, 1272, 1400]) {
    await memory.initialize(repeated.id);
    const prepared = await memory.prepare({
      chatId: repeated.id,
      messages: repeatedMessages,
      audienceCharacterIds: [],
      budgetTokens,
    });
    checkpointId ??= prepared.receipt.checkpointId;
    assert(checkpointId, "the bounded context must create a continuity summary");
    assert.equal(prepared.receipt.checkpointId, checkpointId, "a fitting summary survives context-budget adjustments");
    const archive = (await memory.status(repeated.id)).records;
    assert.equal(archive.filter((record) => record.kind === "scene" && record.status === "closed").length, 4);
    assert.equal(archive.filter((record) => record.kind === "continuity").length, 1, "one record per unchanged range");
  }
  assert.equal(requests.length, beforeRepeatedSummaries + 1, "the continuity model is called once across all budgets");
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

  const withoutReasoning = await createChat("Explicitly omitted reasoning parameter", undefined, true);
  const withoutReasoningStart = requests.length;
  await memory.initialize(withoutReasoning.id);
  assert(
    requests.slice(withoutReasoningStart).every((item) => !item.reasoning),
    "the connection's explicit parameter omission is preserved",
  );

  const capped = await createChat("Explicit output cap", 256);
  const requestStart = requests.length;
  await assert.rejects(memory.initialize(capped.id), /256 of 256 output tokens, 256 of them reasoning/);
  assert.equal(
    requests.slice(requestStart).filter((item) => !item.instructions?.startsWith("Identify scene transitions")).length,
    1,
    "empty output does not cause hidden paid retries",
  );
  assert(
    requests.slice(requestStart).every((item) => item.max_output_tokens! <= 256),
    "the connection hard cap remains authoritative",
  );

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
