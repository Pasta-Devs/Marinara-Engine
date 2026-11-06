// Fix repairs every flagged Advanced Memory scene in one run, never rewrites a hand-edited
// summary, never widens access on an unclear answer, and reports what it changed.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-memory-fix-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

const MARKERS = [
  "RECHECK_CLEARS",
  "STILL_UNCLEAR",
  "VISIBILITY",
  "MANUAL",
  "MISSING",
  "LEGACY_OK",
  "LEGACY_FAILS",
  "DELETED",
  "BOUNDARY",
] as const;
type Marker = (typeof MARKERS)[number];
// A second chat: a hand-edited scene that gains a shown message, and unclear participants that narrow.
const EXTRA_MARKERS = ["GROWN", "NARROWED"] as const;
let phase: "initial" | "fix" = "initial";
let compactionCalls = 0;
const calls: string[] = [];
const visibilityInputs: string[] = [];
const initialAudience: Record<Marker, unknown> = {
  RECHECK_CLEARS: ["stranger-x"],
  STILL_UNCLEAR: undefined,
  VISIBILITY: "all",
  MANUAL: ["maukie"],
  MISSING: ["maukie"],
  LEGACY_OK: ["maukie"],
  LEGACY_FAILS: ["maukie"],
  DELETED: ["maukie"],
  BOUNDARY: ["maukie"],
};
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    response.end(
      JSON.stringify({ data: body.input.map((_: string, index: number) => ({ index, embedding: [1, 0, 0] })) }),
    );
    return;
  }
  const [system, transcript] = body.messages;
  let content: string;
  if (system.content.startsWith("Identify scene transitions")) {
    content = JSON.stringify({
      starts: JSON.parse(transcript.content)
        .filter((message: { content: string }) => message.content.startsWith("SCENE_CHANGE"))
        .map((message: { messageId: string }) => ({ messageId: message.messageId })),
    });
  } else if (system.content.includes("about half its current length")) {
    // Shortening constant Chat Summaries always fails here, so Resume retries it.
    compactionCalls++;
    response.end(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: '{"summary":"Failed' }, finish_reason: "error" }],
      }),
    );
    return;
  } else if (transcript.content.includes("COMPACT")) {
    content = JSON.stringify({ summary: "Recap of the COMPACT chapter.", audience: ["maukie"] });
  } else {
    const audienceOnly = system.content.startsWith("Identify the participants");
    const marker = [...MARKERS, ...EXTRA_MARKERS].find((item) => transcript.content.includes(item)) ?? "OTHER";
    calls.push(`${phase}:${audienceOnly ? "audience" : "summary"}:${marker}`);
    if (marker === "GROWN" || marker === "NARROWED") {
      content = JSON.stringify(
        phase === "initial"
          ? {
              summary: `Recap of ${marker}.`,
              audience: marker === "NARROWED" ? ["maukie", "pantalone", "stranger-x"] : ["maukie"],
            }
          : audienceOnly
            ? { audience: ["maukie", "stranger-y"] }
            : { summary: `Fixed recap of ${marker}.`, audience: ["maukie"] },
      );
    } else if (phase === "initial") {
      const audience = initialAudience[marker as Marker];
      content = JSON.stringify({ summary: `Recap of ${marker}.`, ...(audience === undefined ? {} : { audience }) });
    } else if (audienceOnly) {
      content =
        marker === "LEGACY_FAILS"
          ? "The helper could not answer."
          : JSON.stringify(
              marker === "RECHECK_CLEARS"
                ? { audience: ["maukie"] }
                : marker === "LEGACY_OK"
                  ? { audience: ["pantalone"] }
                  : {},
            );
    } else {
      if (marker === "VISIBILITY") visibilityInputs.push(transcript.content);
      content = JSON.stringify({ summary: `Fixed recap of ${marker}.`, audience: ["maukie", "pantalone"] });
    }
  }
  response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
});

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { advancedMemoryRecords } = await import("../../packages/server/src/db/schema/advanced-memory.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { advancedMemoryProblems, createChatSummaryEntry } = await import("../../packages/shared/src/index.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Fix fixture",
    provider: "custom",
    model: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "fixture",
    maxContext: 65000,
    embeddingModel: "fixture",
  });
  const chat = await chats.create({
    name: "Memory fix",
    mode: "roleplay",
    characterIds: ["maukie", "pantalone", "narrator"],
    connectionId: connection.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      enabled: true,
      narratorCharacterId: "narrator",
      knowledgeStarts: { maukie: null, pantalone: null },
      knowledgeConfirmed: true,
    },
  });
  await chats.createMessagesBatch(chat.id, [
    ...MARKERS.flatMap((marker, index) => [
      { role: "user", content: `${index ? "SCENE_CHANGE " : ""}${marker} Mari opens the ${marker} chapter.` },
      { role: "assistant", characterId: "maukie", content: `Maukie remembers the ${marker} chapter.` },
    ]),
    { role: "user", content: "SCENE_CHANGE The story goes on." },
  ]);
  const messages = await chats.listMessages(chat.id);
  await memory.initialize(chat.id);
  const status = () => memory.status(chat.id);
  const scenes = async () =>
    (await status()).records.filter((record) => record.kind === "scene" && record.id !== record.sceneId);
  const scene = async (marker: Marker) => {
    const start = messages[MARKERS.indexOf(marker) * 2]!.id;
    return (await scenes()).find((record) => record.startMessageId === start)!;
  };
  const sceneId = (marker: Marker) => `scene-${messages[MARKERS.indexOf(marker) * 2]!.id}`;
  const has = (record: { dependencies: Array<{ id: string }> }, id: string) =>
    record.dependencies.some((item) => item.id === id);
  assert.equal((await scenes()).filter((record) => record.content).length, MARKERS.length);
  assert(has(await scene("RECHECK_CLEARS"), "scene-audience-unmatched"), "unknown names are flagged");
  assert.deepEqual((await scene("STILL_UNCLEAR")).audienceCharacterIds, ["maukie", "pantalone"]);
  assert(has(await scene("STILL_UNCLEAR"), "scene-audience-unmatched"), "a missing answer is flagged");

  // Source visibility changes after the VISIBILITY recap was written: Pantalone no longer sees its last message.
  await chats.updateMessageExtra(messages[5]!.id, { hiddenFromAICharacterIds: ["pantalone"] });
  // The user corrected MANUAL by hand; then one of its messages was hidden from Maukie.
  const manual = await scene("MANUAL");
  await memory.updateRecord(chat.id, manual.id, { content: "Hand-written MANUAL recap." });
  await chats.updateMessageExtra(messages[7]!.id, { hiddenFromAICharacterIds: ["maukie"] });
  // MISSING lost its summary (for example an interrupted run), LEGACY_* predate participant checks.
  await db.delete(advancedMemoryRecords).where(eq(advancedMemoryRecords.id, (await scene("MISSING")).id));
  for (const marker of ["LEGACY_OK", "LEGACY_FAILS"] as const)
    await db
      .update(advancedMemoryRecords)
      .set({ dependencies: "[]" })
      .where(eq(advancedMemoryRecords.id, (await scene(marker)).id));
  // The user deleted DELETED; Fix must not bring it back.
  await memory.deleteRecord(chat.id, (await scene("DELETED")).id);
  // BOUNDARY is a hand-edited summary whose scene boundaries no longer match.
  const boundary = await scene("BOUNDARY");
  await memory.updateRecord(chat.id, boundary.id, { content: "Hand-written BOUNDARY recap." });
  const boundaryStart = messages[MARKERS.indexOf("BOUNDARY") * 2]!.id;
  await db
    .update(advancedMemoryRecords)
    .set({ endMessageId: boundaryStart, messageIds: JSON.stringify([boundaryStart]) })
    .where(eq(advancedMemoryRecords.id, boundary.id));

  const before = advancedMemoryProblems(await status());
  assert.deepEqual(
    new Set(before.fixSceneIds),
    new Set(
      (["RECHECK_CLEARS", "STILL_UNCLEAR", "VISIBILITY", "MISSING", "LEGACY_OK", "LEGACY_FAILS"] as const).map(sceneId),
    ),
    "unclear participants, unchecked older scenes, outdated and missing summaries are fixable",
  );
  assert.deepEqual(
    new Set(before.reviewSceneIds),
    new Set([sceneId("MANUAL"), sceneId("BOUNDARY")]),
    "hand-edited summaries that no longer match need the user",
  );
  assert(!before.fixSceneIds.includes(sceneId("DELETED")), "a deleted summary is the user's choice, not a problem");

  // Without Fix, preparation still stops at the first hand-edited summary that needs review.
  await assert.rejects(memory.initialize(chat.id), /changed scene boundary/);
  assert.equal((await status()).job.status, "error");
  assert(advancedMemoryProblems(await status()).stopped);

  phase = "fix";
  calls.length = 0;
  await memory.initialize(chat.id, { fixAll: true });
  const fixed = await status();
  assert.equal(fixed.job.status, "ready", "Fix finishes every other scene instead of stopping");
  assert.deepEqual(
    calls.sort(),
    [
      "fix:audience:LEGACY_FAILS",
      "fix:audience:LEGACY_OK",
      "fix:audience:RECHECK_CLEARS",
      "fix:audience:STILL_UNCLEAR",
      "fix:summary:MISSING",
      "fix:summary:VISIBILITY",
    ],
    "Fix asks the helper only about flagged scenes and never about hand-edited or deleted ones",
  );
  const result = fixed.job.fixResult;
  assert(result, "Fix reports its result");
  assert.equal(result.jobId, fixed.job.id);
  assert.deepEqual(
    new Set(result.fixedSceneIds),
    new Set((["RECHECK_CLEARS", "VISIBILITY", "MISSING", "LEGACY_OK"] as const).map(sceneId)),
    "only scenes that were flagged and are healthy now count as fixed",
  );
  assert.deepEqual(
    new Set(result.reviewSceneIds),
    new Set((["STILL_UNCLEAR", "MANUAL", "LEGACY_FAILS", "BOUNDARY"] as const).map(sceneId)),
    "scenes Fix could not settle are listed for review",
  );

  const cleared = await scene("RECHECK_CLEARS");
  assert.deepEqual(cleared.audienceCharacterIds, ["maukie"], "the helper's clear answer is saved");
  assert(!has(cleared, "scene-audience-unmatched"), "a clear answer drops the flag");
  assert.equal(cleared.content, "Recap of RECHECK_CLEARS.", "a participant check keeps the paid summary");

  const unclear = await scene("STILL_UNCLEAR");
  assert.deepEqual(unclear.audienceCharacterIds, ["maukie", "pantalone"], "an unclear answer changes no access");
  assert(has(unclear, "scene-audience-unmatched") && has(unclear, "scene-audience-unresolved"));

  const redone = await scene("VISIBILITY");
  assert.equal(redone.content, "Fixed recap of VISIBILITY.", "a recap with changed visibility is redone");
  assert.notEqual(redone.embeddingStatus, "stale");
  assert.match(
    visibilityInputs[0] ?? "",
    /\[Message visibility: only \["maukie","narrator"\] can know this message\.\]/,
  );

  assert.equal((await scene("MANUAL")).content, "Hand-written MANUAL recap.", "hand-edited text is never rewritten");
  assert.equal((await scene("BOUNDARY")).content, "Hand-written BOUNDARY recap.");
  assert.equal((await scene("MISSING")).content, "Fixed recap of MISSING.", "a missing summary is prepared");

  const legacy = await scene("LEGACY_OK");
  assert.deepEqual(legacy.audienceCharacterIds, ["pantalone"], "an older scene gets the helper's participants");
  assert(has(legacy, "scene-audience"));

  const failed = await scene("LEGACY_FAILS");
  assert.equal(failed.content, "Recap of LEGACY_FAILS.", "a failed check keeps the summary");
  assert.deepEqual(failed.audienceCharacterIds, [], "a failed check grants no access");
  assert.equal(failed.enabled, true);
  assert(!has(failed, "scene-audience"), "a failed check stays unchecked");

  assert(
    !(await scenes()).some((record) => record.startMessageId === messages[14]!.id && record.content),
    "a deleted summary is not regenerated",
  );
  assert(fixed.unpreparedScenes?.some((item) => item.sceneId === sceneId("DELETED") && item.deleted));

  const after = advancedMemoryProblems(fixed);
  assert.deepEqual(after.fixSceneIds, [sceneId("LEGACY_FAILS")], "only the failed check is left to retry");
  assert.deepEqual(
    new Set(after.reviewSceneIds),
    new Set((["STILL_UNCLEAR", "MANUAL", "BOUNDARY"] as const).map(sceneId)),
    "the shared problem list agrees with the server's report",
  );

  // A second Fix doesn't ask again about participants the helper already couldn't decide.
  calls.length = 0;
  await memory.initialize(chat.id, { fixAll: true });
  assert.deepEqual(calls, ["fix:audience:LEGACY_FAILS"], "only the failed check is retried");
  assert.deepEqual((await status()).job.fixResult?.fixedSceneIds, []);

  // Saving access by hand settles the scene.
  await memory.updateRecord(chat.id, unclear.id, { audienceCharacterIds: ["maukie"] });
  assert(!advancedMemoryProblems(await status()).reviewSceneIds.includes(sceneId("STILL_UNCLEAR")));

  // A hand-edited summary is not rewritten even when it only needs a newly shown message added,
  // and an unclear answer keeps only characters both the old and the new answer include.
  const second = await chats.create({
    name: "Memory fix edges",
    mode: "roleplay",
    characterIds: ["maukie", "pantalone", "narrator"],
    connectionId: connection.id,
  });
  assert(second);
  await chats.patchMetadata(second.id, {
    groupChatMode: "individual",
    advancedMemory: {
      enabled: true,
      narratorCharacterId: "narrator",
      knowledgeStarts: { maukie: null, pantalone: null },
      knowledgeConfirmed: true,
    },
  });
  await chats.createMessagesBatch(second.id, [
    { role: "user", content: "GROWN Mari opens the GROWN chapter." },
    { role: "assistant", characterId: "maukie", content: "Maukie remembers the GROWN chapter." },
    { role: "user", content: "GROWN Mari adds an aside.", extra: { hiddenFromAICharacterIds: ["narrator"] } },
    { role: "user", content: "SCENE_CHANGE NARROWED Mari opens the NARROWED chapter." },
    { role: "assistant", characterId: "maukie", content: "Maukie remembers the NARROWED chapter." },
    { role: "user", content: "SCENE_CHANGE The story goes on." },
  ]);
  const secondMessages = await chats.listMessages(second.id);
  phase = "initial";
  await memory.initialize(second.id);
  const secondScene = async (index: number) =>
    (await memory.status(second.id)).records.find(
      (record) =>
        record.kind === "scene" && record.id !== record.sceneId && record.startMessageId === secondMessages[index]!.id,
    )!;
  const narrowed = await secondScene(3);
  assert.deepEqual(narrowed.audienceCharacterIds, ["maukie", "pantalone"]);
  assert(has(narrowed, "scene-audience-unmatched"), "an unknown name is flagged");
  const grown = await secondScene(0);
  await memory.updateRecord(second.id, grown.id, { content: "Hand-written GROWN recap." });
  // The aside is shown again, so the hand-edited summary no longer covers every message of its scene.
  await chats.updateMessageExtra(secondMessages[2]!.id, { hiddenFromAICharacterIds: [] });
  assert.deepEqual(advancedMemoryProblems(await memory.status(second.id)).reviewSceneIds, [grown.sceneId]);
  phase = "fix";
  calls.length = 0;
  await memory.initialize(second.id, { fixAll: true });
  assert.deepEqual(calls, ["fix:audience:NARROWED"], "Fix doesn't ask the helper to rewrite a hand edit");
  assert.equal((await secondScene(0)).content, "Hand-written GROWN recap.", "a hand edit is never rewritten");
  assert.deepEqual(
    (await secondScene(3)).audienceCharacterIds,
    ["maukie"],
    "an unclear answer never keeps a character the helper no longer names",
  );
  const edges = (await memory.status(second.id)).job.fixResult;
  assert.deepEqual(edges?.fixedSceneIds, []);
  assert.deepEqual(new Set(edges?.reviewSceneIds), new Set([grown.sceneId, narrowed.sceneId]));

  // A stopped continuity update that fails again doesn't keep Fix from repairing scenes.
  const compact = await chats.create({
    name: "Stopped continuity",
    mode: "roleplay",
    characterIds: ["maukie"],
    connectionId: connection.id,
  });
  assert(compact);
  await chats.patchMetadata(compact.id, {
    advancedMemory: { enabled: true, summaryBudgetTokens: 64 },
    summaryEntries: [createChatSummaryEntry({ content: "A long remembered journey. ".repeat(60), enabled: true })],
  });
  await chats.createMessagesBatch(compact.id, [
    { role: "user", content: "Mari begins the COMPACT chapter." },
    { role: "assistant", characterId: "maukie", content: "Maukie listens to the COMPACT chapter." },
    { role: "user", content: "SCENE_CHANGE The story goes on." },
  ]);
  const stopped = { status: "error", stage: "compacting", completed: 0, total: 1, error: "Earlier failure" };
  await chats.patchMetadata(compact.id, { advancedMemoryState: stopped });
  await assert.rejects(memory.initialize(compact.id), /did not complete/, "Resume still reports the failed update");
  await chats.patchMetadata(compact.id, { advancedMemoryState: stopped });
  const compactionsBefore = compactionCalls;
  await memory.initialize(compact.id, { fixAll: true });
  const compacted = await memory.status(compact.id);
  assert(compactionCalls > compactionsBefore, "Fix retries the stopped continuity update first");
  assert.equal(compacted.job.status, "ready");
  assert.equal(compacted.job.fixResult?.jobId, compacted.job.id);
  assert(
    compacted.records.some((record) => record.kind === "scene" && record.content === "Recap of the COMPACT chapter."),
    "scenes are repaired even though the continuity update failed again",
  );

  // An ordinary run after a stopped Fix is no longer marked as a Fix, so Resume continues it as itself.
  await chats.patchMetadata(compact.id, {
    advancedMemoryState: { ...stopped, stage: "summarizing", status: "cancelled", fixResult: null },
  });
  await memory.initialize(compact.id);
  assert.notEqual((await memory.status(compact.id)).job.fixResult, null, "an ordinary run clears the Fix marker");
  console.log("Advanced Memory Fix repairs flagged scenes, keeps hand edits and reports what changed.");
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
