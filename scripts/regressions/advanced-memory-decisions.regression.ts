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
let cutProbability = 0.3;
let failSummaries = false;
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
          : question.instructions.includes("cut to a new scene")
            ? message?.content.startsWith("SCENE_CHANGE")
              ? 0.99
              : message?.content.startsWith("UNSURE_CUT")
                ? cutProbability
                : 0.01
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
  if (failSummaries && !classify) {
    response.statusCode = 500;
    response.end(JSON.stringify({ error: { message: "summary helper is down" } }));
    return;
  }
  requests.push({ kind: classify ? "classify" : "summary", body });
  const result = classify
    ? system.content.includes('"ends"')
      ? {
          // A helper that ends the scene on the entry just before a message that opens a new one.
          ends: JSON.parse(user.content).flatMap(
            (
              message: { messageNumber: number; content: string; alreadyChecked?: boolean },
              index: number,
              transcript: Array<{ messageNumber: number }>,
            ) =>
              index > 0 && !message.alreadyChecked && message.content.startsWith("SCENE_CHANGE")
                ? [{ messageNumber: transcript[index - 1]!.messageNumber }]
                : [],
          ),
        }
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
const { rankDecisionMemories, detectDecisionSceneStarts, finishMemoryDecisionDiagnostics } =
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

  // A scene change counts at the Decision connection's own threshold (0.5 for System One), not a fixed 0.8,
  // and each new message is compared with the three before it, with who wrote them (#7371).
  const sceneCheckpoint = async () => {
    const metadata = (await chats.getById(chat.id))!.metadata;
    return (typeof metadata === "string" ? JSON.parse(metadata) : metadata).advancedMemoryState.sceneCheckMessageId;
  };
  await memory.updateSettings(chat.id, { sceneCheckInterval: 2 });
  await chats.createMessagesBatch(chat.id, [
    { role: "assistant", characterId: "reader", content: "UNSURE_CUT Maybe somewhere else." },
    { role: "user", content: "They keep walking." },
  ]);
  await memory.checkScenesAfterGeneration(chat.id);
  const unsure = (await memory.status(chat.id)).job.decisionSceneCheck!;
  assert.equal(unsure.threshold, 0.5, "scene changes use the connection's own threshold");
  assert(unsure.results.some((row) => row.kind === "scene_start" && row.score === 0.3 && !row.selected));
  assert(
    (await memory.status(chat.id)).records.some((record) => record.kind === "scene" && record.status === "open"),
    "an unlikely cut leaves the scene open",
  );
  cutProbability = 0.6;
  await chats.createMessagesBatch(chat.id, [
    { role: "assistant", characterId: "reader", content: "UNSURE_CUT Later, at the harbor." },
    { role: "user", content: "The gulls cry." },
  ]);
  const beforeCut = requests.length;
  await memory.checkScenesAfterGeneration(chat.id);
  const cutSource = await chats.listMessages(chat.id);
  const harbor = cutSource.findIndex((message) => message.content.startsWith("UNSURE_CUT Later"));
  const cutRequest = requests
    .slice(beforeCut)
    .find((request) => request.kind === "decision" && request.body.questions[cutSource[harbor]!.id]);
  assert(cutRequest, "the new messages are asked about");
  assert.deepEqual(
    cutRequest.body.state.transcript.map((entry: { messageId: string }) => entry.messageId),
    cutSource.slice(harbor - 3, harbor + 2).map((message) => message.id),
    "the three messages before the check come with it",
  );
  assert(cutRequest.body.state.transcript.every((entry: { speaker?: string }) => entry.speaker));
  const cut = (await memory.status(chat.id)).job.decisionSceneCheck!;
  assert(cut.results.some((row) => row.id === cutSource[harbor]!.id && row.score === 0.6 && row.selected));
  const afterCut = await memory.status(chat.id);
  assert(
    afterCut.records.some(
      (record) =>
        record.kind === "scene" && record.status === "closed" && record.endMessageId === cutSource[harbor - 1]!.id,
    ),
    "a cut at the first new message ends the scene on the last message the previous check saw",
  );
  assert(
    afterCut.records.some(
      (record) =>
        record.kind === "scene" && record.status === "open" && record.startMessageId === cutSource[harbor]!.id,
    ),
  );

  // Re-scan finds the cut the earlier check scored too low, and keeps every scene outside the range (#7371).
  const unsureIndex = cutSource.findIndex((message) => message.content.startsWith("UNSURE_CUT Maybe"));
  const outside = afterCut.records
    .filter((record) => record.kind === "scene" && record.content && record.endMessageId !== cutSource[harbor - 1]!.id)
    .map((record) => [record.id, record.content]);
  const checkpointBeforeRescan = await sceneCheckpoint();
  await assert.rejects(
    memory.initialize(chat.id, { range: { start: unsureIndex, end: cutSource.length } }),
    new RegExp(`Choose messages between #1 and #${cutSource.length}`),
  );
  // A summary the user edited (the TARGET_SCENE correction above) stops a re-scan before any paid call.
  const beforeProtected = requests.length;
  await assert.rejects(
    memory.initialize(chat.id, { range: { start: 2, end: 6 } }),
    /Messages #4–#6 have a summary you edited/,
  );
  assert.equal(requests.length, beforeProtected, "a refused re-scan asks no model");
  // A re-scan stopped during its summaries keeps its new scenes, and Resume finishes them.
  failSummaries = true;
  await assert.rejects(memory.initialize(chat.id, { range: { start: unsureIndex - 1, end: harbor - 1 } }));
  failSummaries = false;
  assert(
    (await memory.status(chat.id)).unpreparedScenes.some(
      (scene) => scene.startIndex === unsureIndex + 1 && scene.endIndex === harbor,
    ),
    "the re-scanned layout is saved before its summaries",
  );
  await memory.initialize(chat.id);
  const rescanned = await memory.status(chat.id);
  assert.equal(rescanned.job.status, "ready");
  for (const [id, content] of outside)
    assert(
      rescanned.records.some((record) => record.id === id && record.content === content),
      "scenes outside the range keep their summaries",
    );
  assert(
    rescanned.records.some(
      (record) =>
        record.kind === "scene" &&
        record.status === "closed" &&
        record.content &&
        record.startMessageId === cutSource[unsureIndex]!.id &&
        record.endMessageId === cutSource[harbor - 1]!.id,
    ),
    "the re-scanned cut becomes its own summarized scene",
  );
  assert(
    rescanned.records.some(
      (record) =>
        record.kind === "scene" && record.status === "open" && record.startMessageId === cutSource[harbor]!.id,
    ),
    "the boundary after the range stays",
  );
  assert.equal(await sceneCheckpoint(), checkpointBeforeRescan, "a re-scan leaves the reply cadence alone");
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
    calibration: { defaultThreshold: 0.5, questionShape: "text" },
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
    await detectDecisionSceneStarts(
      backend,
      [
        { messageId: "zero", speaker: "Reader", content: "Loud." },
        { messageId: "one", speaker: "Reader", content: "Quiet." },
      ],
      ["one"],
    ),
    null,
  );
  // A small Decision model drops earlier messages and shortens long ones instead of falling back (#7371).
  backend.askMixed = async (state: unknown, questions: Array<{ id: string }>) => {
    assert(estimateChatSummaryTokens(JSON.stringify(state)) <= 1000);
    return { answers: new Map(questions.map((question) => [question.id, 0.9])), choices: new Map() };
  };
  const long = Array.from({ length: 8 }, (_, index) => ({
    messageId: `long-${index}`,
    speaker: "Reader",
    content: `Opening ${index}. ${"The road goes on. ".repeat(120)}Closing ${index}.`,
  }));
  assert.deepEqual(await detectDecisionSceneStarts(backend, long, ["long-3", "long-4", "long-5", "long-6", "long-7"]), [
    "long-3",
    "long-4",
    "long-5",
    "long-6",
    "long-7",
  ]);
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
  // Without a Decision model, the Helper checks every message since the last check, after the one that check
  // ended on, so a turn that adds several messages, or a scene change right between two checks, is not missed.
  const helperChat = await chats.create({
    name: "Helper scene check",
    mode: "roleplay",
    characterIds: ["reader"],
    connectionId: helper.id,
  });
  assert(helperChat);
  await memory.updateSettings(helperChat.id, {
    enabled: true,
    knowledgeStarts: { reader: null },
    knowledgeConfirmed: true,
    sceneCheckInterval: 2,
  });
  await chats.createMessagesBatch(helperChat.id, [
    { role: "user", content: "Hello." },
    {
      role: "assistant",
      characterId: "reader",
      content: `Hi there. ${"We talk for a long while. ".repeat(400)}Goodbye.`,
    },
  ]);
  await memory.initialize(helperChat.id);
  await chats.createMessagesBatch(helperChat.id, [
    // A command between the two checks leaves a gap in the numbers.
    { role: "user", content: "/roll 1d20", extra: { commandOnly: true } },
    { role: "user", content: "SCENE_CHANGE Later, at the harbor." },
    { role: "assistant", characterId: "reader", content: "The gulls cry." },
    { role: "user", content: "We wait for the boat." },
  ]);
  const beforeHelperCheck = requests.length;
  await memory.checkScenesAfterGeneration(helperChat.id);
  const helperSource = await chats.listMessages(helperChat.id);
  const helperCheck = requests
    .slice(beforeHelperCheck)
    .find((request) => request.kind === "classify" && request.body.messages[0].content.includes('"ends"'));
  assert(helperCheck, "the Helper checks the scene");
  const helperTranscript: Array<{ messageNumber: number; alreadyChecked?: boolean; speaker?: string }> = JSON.parse(
    helperCheck.body.messages[1].content,
  );
  assert.deepEqual(
    helperTranscript.filter((message) => !message.alreadyChecked).map((message) => message.messageNumber),
    [4, 5, 6],
    "all three new messages are checked, although the interval is two",
  );
  assert(
    helperTranscript.every((message) => message.speaker),
    "the Helper sees who wrote each message",
  );
  const shown = helperTranscript.filter((message) => message.alreadyChecked);
  assert.deepEqual(
    shown.map((message) => message.messageNumber),
    [2],
  );
  assert(
    estimateChatSummaryTokens((shown[0] as unknown as { content: string }).content) <= 520,
    "a long earlier message is shortened to its ends",
  );
  const helperScenes = (await memory.status(helperChat.id)).records.filter((record) => record.kind === "scene");
  assert(
    helperScenes.some((record) => record.status === "closed" && record.endMessageId === helperSource[1]!.id),
    "the scene ends on the message the last check ended on",
  );
  assert(helperScenes.some((record) => record.status === "open" && record.startMessageId === helperSource[2]!.id));

  console.log("Advanced Memory Decision routing, visibility, fallback, boundaries, reuse and bounded requests passed.");
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
}
