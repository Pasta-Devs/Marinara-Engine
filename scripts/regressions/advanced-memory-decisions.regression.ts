import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DecisionBackend } from "../../packages/server/src/services/decision/decision-default.js";

const directory = mkdtempSync(join(tmpdir(), "marinara-memory-decisions-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

const requests: Array<{ kind: string; body: any }> = [];
let partial = false;
let rejectAll = false;
let stallNextDecision = false;
let endProbability = 0.6;
let beforeAnswer: (() => void) | undefined;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/systemone")) {
    requests.push({ kind: "decision", body });
    if (stallNextDecision) {
      stallNextDecision = false;
      return; // Keep this response open until the recall deadline cancels it.
    }
    const result = Object.fromEntries(
      Object.entries(body.questions).map(([id, value]) => {
        const question = value as { instructions: string };
        const memory = body.state.memories?.find((item: { id: string }) => item.id === id);
        const message = body.state.transcript?.find((item: { messageId: string }) => item.messageId === id);
        const probability = memory
          ? !rejectAll && /TARGET_SCENE|Cobalt refuge/.test(memory.text)
            ? 0.99
            : 0.01
          : question.instructions.includes("clearly START")
            ? message?.content.startsWith("SCENE_CHANGE")
              ? 0.99
              : 0.01
            : message?.content.includes("EXPLICIT_END")
              ? endProbability
              : 0.01;
        return [id, { type: "noul", noul: probability }];
      }),
    );
    if (partial) delete result[Object.keys(result)[0]!];
    beforeAnswer?.();
    beforeAnswer = undefined;
    response.end(JSON.stringify({ answers: result }));
    return;
  }
  if (request.url?.endsWith("/embeddings")) {
    requests.push({ kind: "embedding", body });
    response.end(
      JSON.stringify({ data: body.input.map((_: string, index: number) => ({ index, embedding: [1, 0, 0] })) }),
    );
    return;
  }
  const [system, user] = body.messages;
  const classify = system.content.startsWith("Identify scene transitions");
  requests.push({ kind: classify ? "classify" : "summary", body });
  const result = classify
    ? system.content.includes('"ends"')
      ? { ends: [] }
      : {
          starts: JSON.parse(user.content)
            .filter((message: { content: string }) => message.content.startsWith("SCENE_CHANGE"))
            .map((message: { messageId: string }) => ({ messageId: message.messageId })),
        }
    : {
        audience: "all",
        summary: user.content.includes("TARGET_SCENE")
          ? "TARGET_SCENE: The old oath concerned Cobalt refuge."
          : user.content.includes("PRIVATE_SECRET")
            ? "PRIVATE_SECRET: Hidden from the reader."
            : "Lantern soup was served.",
      };
  response.end(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: JSON.stringify(result) }, finish_reason: "stop" }],
    }),
  );
});

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { rankDecisionMemories, detectDecisionSceneBoundaries, finishMemoryDecisionDiagnostics } =
  await import("../../packages/server/src/services/advanced-memory-decisions.js");
const { prepareAdvancedMemoryContext } =
  await import("../../packages/server/src/services/generation/advanced-memory-context.js");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS, normalizeAdvancedMemorySettings, estimateChatSummaryTokens } =
  await import("../../packages/shared/dist/index.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const connections = createConnectionsStorage(db);
const memory = createAdvancedMemoryService(db);

try {
  assert.equal(DEFAULT_ADVANCED_MEMORY_SETTINGS.decisionEnabled, false);
  assert.equal(normalizeAdvancedMemorySettings({ enabled: true }).decisionConnectionId, null);
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
    name: "Memory decisions",
    provider: "decision",
    decisionSource: "custom",
    baseUrl: base,
    model: "memory-decisions",
    apiKey: "",
    maxStateTokens: 30000,
    decisionTimeoutMs: 30000,
  });
  const chat = await chats.create({
    name: "Decision recall",
    mode: "roleplay",
    characterIds: ["reader", "other"],
    connectionId: helper.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, { groupChatMode: "individual", summaryMaxTokens: 512 });
  await memory.updateSettings(chat.id, {
    enabled: true,
    decisionEnabled: true,
    decisionConnectionId: decision.id,
    knowledgeStarts: { reader: null, other: null },
    knowledgeConfirmed: true,
    retrieveMinMessages: 1,
    retrieveMaxMessages: 1,
  });
  await assert.rejects(memory.updateSettings(chat.id, { decisionConnectionId: helper.id }), /Decision connection/);
  await chats.createMessagesBatch(chat.id, [
    { role: "user", content: "PRIVATE_SECRET", extra: { hiddenFromAICharacterIds: ["reader"] } },
    {
      role: "assistant",
      characterId: "other",
      content: "PRIVATE_SECRET remembered.",
      extra: { hiddenFromAICharacterIds: ["reader"] },
    },
    { role: "user", content: "PRIVATE_SECRET hidden.", extra: { hiddenFromAICharacterIds: ["reader"] } },
    { role: "user", content: "SCENE_CHANGE TARGET_SCENE They make an oath." },
    { role: "assistant", characterId: "reader", content: "Cobalt refuge is our exact promise." },
    { role: "user", content: "They depart." },
    { role: "user", content: "SCENE_CHANGE They eat lantern soup." },
    { role: "assistant", characterId: "reader", content: "More lantern soup." },
    { role: "user", content: "The lantern soup is cold." },
    { role: "user", content: "SCENE_CHANGE You remember, don't you?", extra: { isConversationStart: true } },
  ]);
  await memory.initialize(chat.id);
  assert(requests.some((request) => request.kind === "summary" && request.body.model === "summary"));
  assert(!requests.some((request) => request.kind === "classify"), "Jev handles historical boundaries");
  assert(!requests.some((request) => request.kind === "embedding"), "decision mode needs no archive embeddings");
  const source = await chats.listMessages(chat.id);
  const input = { chatId: chat.id, messages: source, audienceCharacterIds: ["reader"], budgetTokens: 50000 };
  const beforeRecall = requests.length;
  const prepared = await memory.prepare(input);
  assert.match(prepared.recalledScenes!, /TARGET_SCENE/);
  assert.doesNotMatch(prepared.recalledScenes!, /PRIVATE_SECRET|Lantern soup was served/);
  assert.deepEqual(prepared.receipt.recalledMessageIds, [source[3]!.id]);
  assert(prepared.receipt.reasons.includes("decision-recall"));
  const diagnostics = prepared.receipt.decisionRecall!;
  assert.equal(diagnostics.model, "memory-decisions");
  assert.equal(diagnostics.fallback, false);
  assert.equal(diagnostics.sourceEndMessageId, source.at(-1)!.id);
  assert(diagnostics.results.some((row) => row.kind === "scene" && row.selected && row.score === 0.99));
  assert(diagnostics.results.some((row) => !row.selected && row.score === 0.01));
  assert(diagnostics.results.some((row) => row.kind === "message" && row.selected && row.id === source[3]!.id));
  assert.doesNotMatch(JSON.stringify(diagnostics), /PRIVATE_SECRET/);
  const recallRequests = requests.slice(beforeRecall);
  assert(recallRequests.length >= 2, "rank memories and then select original messages");
  for (const request of recallRequests) {
    assert.equal(request.kind, "decision");
    assert.equal(request.body.model, "memory-decisions");
    assert.doesNotMatch(JSON.stringify(request.body), /PRIVATE_SECRET/);
  }
  const beforePreview = requests.length;
  const preview = await memory.prepare({ ...input, readOnly: true });
  assert.equal(requests.length, beforePreview);
  assert(preview.receipt.reasons.includes("decision-recall-preview"));
  const reused = await prepareAdvancedMemoryContext({
    service: memory,
    chatId: chat.id,
    settings: (await memory.status(chat.id)).settings,
    sourceMessages: source,
    messages: [{ role: "user", content: "Continue the story." }],
    placements: [],
    audienceCharacterIds: ["reader"],
    cachedSnapshots: [{ audienceCharacterIds: ["reader"], prepared }],
    toProviderMessages: (messages) => messages,
  });
  assert(reused.receipt.reasons.includes("reused-swipe-memory"));
  assert.deepEqual(reused.receipt.decisionRecall, diagnostics, "swipes keep the original evaluation time and scores");
  assert.equal(requests.length, beforePreview, "a compatible swipe makes no decisions again");

  rejectAll = true;
  const noRecall = await memory.prepare(input);
  assert.equal(noRecall.recalledScenes, null, "no suitable candidates must not force recall");
  rejectAll = false;
  partial = true;
  const fallback = await memory.prepare(input);
  assert(fallback.receipt.reasons.includes("decision-recall-fallback"));
  assert.equal(fallback.receipt.decisionRecall?.fallback, true);
  assert(
    fallback.receipt.decisionRecall?.results.every((row) => row.score === undefined),
    "partial batches are not presented as usable scores",
  );
  partial = false;
  stallNextDecision = true;
  const started = performance.now();
  const timedOut = await memory.prepare(input);
  assert(timedOut.receipt.reasons.includes("decision-recall-fallback"));
  assert(performance.now() - started >= 9500, "the combined recall deadline expires");
  assert(performance.now() - started < 15000, "recall must not wait for the connection's 30-second timeout");
  const controller = new AbortController();
  beforeAnswer = () => controller.abort(new Error("cancel memory recall"));
  await assert.rejects(memory.prepare({ ...input, signal: controller.signal }), /cancel memory recall/);

  const scene = (await memory.status(chat.id)).records.find(
    (record) => record.kind === "scene" && record.content.includes("TARGET_SCENE"),
  )!;
  await memory.updateRecord(chat.id, scene.id, {
    content: 'TARGET_SCENE: An old oath. {{#if character == "other"}}CONDITION_SECRET{{/if}}',
  });
  const beforeConditional = requests.length;
  const conditional = await memory.prepare(input);
  assert.match(conditional.recalledScenes!, /TARGET_SCENE/);
  // Mari's rule (#7269): a private recap section no longer withholds the excerpt, because the
  // reader saw these messages in the chat. Messages hidden from the reader still stay out.
  assert.deepEqual(
    conditional.receipt.recalledMessageIds,
    [source[3]!.id],
    "a recap with a private section still recalls the messages its reader saw",
  );
  assert.doesNotMatch(conditional.recalledScenes!, /CONDITION_SECRET|PRIVATE_SECRET/);
  for (const request of requests.slice(beforeConditional)) {
    assert.equal(request.kind, "decision");
    assert.doesNotMatch(JSON.stringify(request.body), /CONDITION_SECRET|PRIVATE_SECRET/);
  }
  assert(
    !conditional.receipt.reasons.some((reason) => reason.startsWith("excerpt-")),
    "a scene with an excerpt needs no reason for a missing one",
  );
  assert.equal(conditional.receipt.decisionRecall?.notes, undefined);

  // The Decision model's picks size each excerpt within Minimum and Maximum, every recalled scene
  // gets its minimum before any excerpt grows, and a scene left without one says why (#7269).
  const sized = await chats.create({
    name: "Decision excerpt sizes",
    mode: "roleplay",
    characterIds: ["reader"],
    connectionId: helper.id,
  });
  assert(sized);
  await chats.patchMetadata(sized.id, { summaryMaxTokens: 512 });
  await memory.updateSettings(sized.id, {
    enabled: true,
    decisionEnabled: true,
    decisionConnectionId: decision.id,
    knowledgeStarts: { reader: null },
    knowledgeConfirmed: true,
    retrieveMinMessages: 1,
    retrieveMaxMessages: 2,
  });
  const padding = " ember".repeat(560);
  await chats.createMessagesBatch(sized.id, [
    ...["dock", "bridge"].flatMap((place) => [
      { role: "user" as const, content: `SCENE_CHANGE They reach the ${place}.` },
      { role: "assistant" as const, characterId: "reader", content: `Gulls circle the ${place}.` },
      { role: "user" as const, content: `TARGET_SCENE Cobalt refuge is sworn at the ${place}.${padding}` },
      {
        role: "assistant" as const,
        characterId: "reader",
        content: `Cobalt refuge, I repeat at the ${place}.${padding}`,
      },
      { role: "user" as const, content: `They leave the ${place}.` },
    ]),
    { role: "user", content: "SCENE_CHANGE You remember, don't you?", extra: { isConversationStart: true } },
  ]);
  await memory.initialize(sized.id);
  const sizedSource = await chats.listMessages(sized.id);
  const picked = sizedSource.filter((message) => message.content.includes("Cobalt refuge")).map(({ id }) => id);
  const sizedInput = { chatId: sized.id, messages: sizedSource, audienceCharacterIds: ["reader"], budgetTokens: 50000 };
  const roomy = await memory.prepare(sizedInput);
  assert.equal(roomy.receipt.recalledSceneIds.length, 2);
  assert.deepEqual(roomy.receipt.recalledMessageIds, picked, "both picked messages of each scene are recalled");
  const messageRows = roomy.receipt.decisionRecall!.results.filter((row) => row.kind === "message");
  assert.deepEqual(
    messageRows
      .filter((row) => row.selected)
      .map((row) => row.id)
      .sort(),
    [...picked].sort(),
    "Decision diagnostics mark exactly the picked messages as selected",
  );
  assert(!roomy.receipt.reasons.some((reason) => reason.startsWith("excerpt-")), "no excerpt is missing");
  assert.equal(roomy.receipt.decisionRecall!.notes, undefined);

  await memory.updateSettings(sized.id, { summaryBudgetTokens: 64 });
  const tight = await memory.prepare(sizedInput);
  assert.equal(tight.receipt.recalledSceneIds.length, 2);
  assert.equal(
    tight.receipt.recalledMessageIds.filter((id) => picked.includes(id)).length,
    2,
    "each scene keeps its one-message minimum before either excerpt grows",
  );
  assert.equal(tight.receipt.recalledMessageIds.length, 2);
  assert(!tight.receipt.reasons.includes("excerpt-no-room"), "neither scene loses its excerpt");

  for (const record of (await memory.status(sized.id)).records.filter(
    (item) => item.kind === "scene" && item.status === "closed",
  ))
    await memory.updateRecord(sized.id, record.id, {
      content: `TARGET_SCENE: The old oath concerned Cobalt refuge.${padding}`,
    });
  const full = await memory.prepare(sizedInput);
  assert.equal(full.receipt.recalledSceneIds.length, 2, "summaries keep their room before excerpts");
  assert.deepEqual(full.receipt.recalledMessageIds, [], "long summaries leave no room for an excerpt");
  assert(full.receipt.reasons.includes("excerpt-no-room"), "the receipt says why the excerpts are missing");
  assert.deepEqual(full.receipt.decisionRecall?.notes, ["excerpt-no-room"]);

  // When not one shortlisted message fits the room the summaries leave, no excerpt can be recalled,
  // so the Decision model is not asked to pick messages (#7269).
  const crowded = await chats.create({
    name: "Decision excerpts without room",
    mode: "roleplay",
    characterIds: ["reader"],
    connectionId: helper.id,
  });
  assert(crowded);
  await chats.patchMetadata(crowded.id, { summaryMaxTokens: 512 });
  await memory.updateSettings(crowded.id, {
    enabled: true,
    decisionEnabled: true,
    decisionConnectionId: decision.id,
    knowledgeStarts: { reader: null },
    knowledgeConfirmed: true,
    retrieveMinMessages: 1,
    retrieveMaxMessages: 2,
  });
  await chats.createMessagesBatch(crowded.id, [
    ...["dock", "bridge"].flatMap((place) => [
      { role: "user" as const, content: `SCENE_CHANGE TARGET_SCENE Cobalt refuge is sworn at the ${place}.${padding}` },
      {
        role: "assistant" as const,
        characterId: "reader",
        content: `Cobalt refuge, I repeat at the ${place}.${padding}`,
      },
    ]),
    { role: "user", content: "SCENE_CHANGE You remember, don't you?", extra: { isConversationStart: true } },
  ]);
  await memory.initialize(crowded.id);
  await memory.updateSettings(crowded.id, { summaryBudgetTokens: 64 });
  for (const record of (await memory.status(crowded.id)).records.filter(
    (item) => item.kind === "scene" && item.status === "closed",
  ))
    await memory.updateRecord(crowded.id, record.id, {
      content: `TARGET_SCENE: The old oath concerned Cobalt refuge.${padding}`,
    });
  const crowdedSource = await chats.listMessages(crowded.id);
  const crowdedIds = new Set(crowdedSource.map(({ id }) => id));
  const beforeCrowded = requests.length;
  const noRoom = await memory.prepare({
    chatId: crowded.id,
    messages: crowdedSource,
    audienceCharacterIds: ["reader"],
    budgetTokens: 50000,
  });
  assert.equal(noRoom.receipt.recalledSceneIds.length, 2, "the model still picks the scenes");
  assert.deepEqual(noRoom.receipt.recalledMessageIds, []);
  assert.deepEqual(noRoom.receipt.decisionRecall?.notes, ["excerpt-no-room"]);
  assert(
    !requests
      .slice(beforeCrowded)
      .some((request) => request.body.state.memories?.some((item: { id: string }) => crowdedIds.has(item.id))),
    "the Decision model is not asked about messages that cannot fit",
  );

  await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: "reader",
    content: "EXPLICIT_END The episode ends.",
  });
  await memory.updateSettings(chat.id, { sceneCheckInterval: 1 });
  await memory.checkScenesAfterGeneration(chat.id);
  const uncertainCheck = (await memory.status(chat.id)).job.decisionSceneCheck!;
  assert.equal(uncertainCheck.threshold, 0.8);
  assert(uncertainCheck.results.some((row) => row.score === 0.6 && !row.selected));
  assert(
    (await memory.status(chat.id)).records.some((record) => record.kind === "scene" && record.status === "open"),
    "uncertainty leaves the scene open",
  );
  endProbability = 0.99;
  await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: "reader",
    content: "EXPLICIT_END They part for the night.",
  });
  await memory.checkScenesAfterGeneration(chat.id);
  const last = (await chats.listMessages(chat.id)).at(-1)!;
  const endedCheck = (await memory.status(chat.id)).job.decisionSceneCheck!;
  assert.equal(endedCheck.sourceEndMessageId, last.id);
  assert(endedCheck.results.some((row) => row.id === last.id && row.score === 0.99 && row.selected));
  assert(
    (await memory.status(chat.id)).records.some(
      (record) => record.kind === "scene" && record.status === "closed" && record.endMessageId === last.id,
    ),
  );
  assert(!requests.some((request) => request.kind === "classify"), "healthy ongoing checks also use Jev");

  await memory.updateSettings(chat.id, { decisionEnabled: false });
  await memory.reindex(chat.id);
  const vectorizedIds = () =>
    memory.status(chat.id).then((status) =>
      status.records
        .filter((record) => record.embeddingStatus === "vectorized")
        .map((record) => record.id)
        .sort(),
    );
  const existingVectors = await vectorizedIds();
  assert(existingVectors.length > 0, "ordinary reindex builds vectors");
  await memory.updateSettings(chat.id, { decisionEnabled: true });
  const beforeReindex = requests.length;
  await memory.reindex(chat.id);
  assert.equal(requests.length, beforeReindex, "Decision reindex needs no model calls");
  assert.deepEqual(await vectorizedIds(), existingVectors, "Decision reindex preserves existing fallback vectors");

  await connections.remove(decision.id);
  assert((await memory.status(chat.id)).warnings.includes("decision-connection-unavailable"));
  const currentSource = await chats.listMessages(chat.id);
  const missing = await memory.prepare({ ...input, messages: currentSource });
  assert(missing.receipt.reasons.includes("decision-recall-fallback"));
  assert.equal(missing.receipt.decisionRecall?.fallback, true);
  await memory.updateSettings(chat.id, { decisionEnabled: false });
  const beforeDisabled = requests.filter((request) => request.kind === "decision").length;
  await memory.prepare({ ...input, messages: currentSource });
  assert.equal(requests.filter((request) => request.kind === "decision").length, beforeDisabled);

  const bounded = finishMemoryDecisionDiagnostics(
    {
      ...diagnostics,
      results: [
        ...Array.from({ length: 200 }, (_, index) => ({
          id: String(index),
          kind: "scene" as const,
          text: "A past memory",
          score: index / 200,
          selected: false,
        })),
        { id: "0", kind: "scene" as const, text: "Repeated candidate", score: 0.25, selected: false },
      ],
    },
    new Set(["0"]),
    false,
  );
  assert.equal(bounded.results.length, 128);
  assert.equal(bounded.omittedCount, 72);
  assert.equal(bounded.results[0]!.id, "0", "selected outcomes survive the saved-report cap");
  assert.equal(bounded.results[0]!.score, 0.25, "repeated candidates show the latest score once");

  // Bounded requests, atomic fallback, and cancellation, independent of provider timing.
  let batches = 0;
  const backend = {
    maxStateTokens: 1000,
    askMixed: async (state: unknown, questions: Array<{ id: string }>) => {
      batches++;
      assert(estimateChatSummaryTokens(JSON.stringify(state)) <= 1000);
      assert(questions.length <= 24);
      return { answers: new Map(questions.map((question) => [question.id, 0.9])), choices: new Map() };
    },
  } as unknown as DecisionBackend;
  const candidates = Array.from({ length: 70 }, (_, index) => ({ id: `memory-${index}`, text: "A past promise." }));
  assert.equal((await rankDecisionMemories(backend, "Remember it?", ["reader"], candidates))?.size, 70);
  assert(batches > 1);
  backend.askMixed = async () => ({ answers: new Map(), choices: new Map() });
  assert.equal(await rankDecisionMemories(backend, "Remember it?", [], candidates), null);
  assert.equal(
    await detectDecisionSceneBoundaries(backend, [{ messageId: "one", content: "Quiet." }], ["one"], "end"),
    null,
  );
  assert.equal(await rankDecisionMemories(backend, "Remember?", [], [{ id: "large", text: "x ".repeat(10000) }]), null);
  const cancelled = new AbortController();
  backend.askMixed = async () => {
    cancelled.abort(new Error("late answer"));
    return { answers: new Map([["one", 0.99]]), choices: new Map() };
  };
  await assert.rejects(
    rankDecisionMemories(backend, "Remember?", [], [{ id: "one", text: "Promise" }], cancelled.signal),
    /late answer/,
  );
  console.log("Advanced Memory Decision routing, visibility, fallback, boundaries, reuse and bounded requests passed.");
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
}
