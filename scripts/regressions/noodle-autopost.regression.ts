import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DB } from "../../packages/server/src/db/connection.js";
import { eq } from "../../packages/server/src/db/file-query.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import {
  noodlePosts,
  noodlerAutomaticAttempts,
  noodlerReserveState,
} from "../../packages/server/src/db/schema/noodle.js";
import {
  noodleAccountSchedulerPatchSchema,
  noodleAutoPostingSettingsSchema,
} from "../../packages/shared/src/schemas/noodle.schema.js";
import {
  createNoodleStorage,
  noodlerReservePolicyFingerprint,
  normalizeScheduler,
} from "../../packages/server/src/services/storage/noodle.storage.js";
import { isNoodlerNightQuietTime } from "../../packages/server/src/services/noodle/noodle-noodler-reserve.operation.js";
import {
  BACKGROUND_CONNECTION_FAILURE_COOLDOWN_MS,
  BACKGROUND_CONNECTION_FAILURE_THRESHOLD,
  BACKGROUND_CONNECTION_IDLE_MS,
  beginForegroundConnection,
  resetConnectionAdmissionForTests,
  tryBackgroundConnection,
  withConnectionAdmission,
} from "../../packages/server/src/services/generation/connection-admission.js";

assert.deepEqual(noodleAutoPostingSettingsSchema.parse({}), { enabled: false, imagesEnabled: false });
assert.deepEqual(normalizeScheduler({}).autoPosting, { enabled: false, imagesEnabled: false });
assert.deepEqual(
  normalizeScheduler({ autoPosting: { enabled: true, imagesEnabled: true, intensity: 6, nextRunAt: "legacy" } })
    .autoPosting,
  { enabled: true, imagesEnabled: true },
);
assert.ok(noodleAccountSchedulerPatchSchema.safeParse({ autoPosting: { enabled: true, imagesEnabled: true } }).success);
assert.equal(noodleAccountSchedulerPatchSchema.safeParse({ autoPosting: { intensity: 3 } }).success, false);
assert.equal(
  noodleAccountSchedulerPatchSchema.safeParse({ autoPosting: { nextRunAt: new Date().toISOString() } }).success,
  false,
);
assert.equal(isNoodlerNightQuietTime(new Date(2026, 6, 29, 23, 0)), true);
assert.equal(isNoodlerNightQuietTime(new Date(2026, 6, 29, 6, 59)), true);
assert.equal(isNoodlerNightQuietTime(new Date(2026, 6, 29, 7, 0)), false);
assert.equal(isNoodlerNightQuietTime(new Date(2026, 6, 29, 22, 59)), false);

const reserveOperationSource = readFileSync(
  new URL("../../packages/server/src/services/noodle/noodle-noodler-reserve.operation.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  reserveOperationSource,
  /createChatsStorage|scheduledCharacterIds|characterSchedules|conversationSchedulesEnabled/u,
  "Noodler reserve selection must not consume source chat schedules without per-creator opt-in",
);

resetConnectionAdmissionForTests();
const releaseForeground = beginForegroundConnection("connection-1");
assert.equal(tryBackgroundConnection("connection-1", new Date()).acquired, false);
releaseForeground();
assert.equal(tryBackgroundConnection("connection-1", new Date(Date.now() + 29_999)).acquired, false);
const admitted = tryBackgroundConnection("connection-1", new Date(Date.now() + 30_001));
assert.equal(admitted.acquired, true);
if (admitted.acquired) admitted.release();

resetConnectionAdmissionForTests();
const duplicateRelease = tryBackgroundConnection("duplicate-release-connection", new Date());
assert.equal(duplicateRelease.acquired, true);
if (duplicateRelease.acquired) {
  duplicateRelease.release("failed");
  duplicateRelease.release("failed");
}
await assert.rejects(
  withConnectionAdmission("duplicate-release-connection", { kind: "background" }, async () => {
    throw new Error("second provider failure");
  }),
  /second provider failure/u,
);
const beforeThreshold = tryBackgroundConnection("duplicate-release-connection", new Date());
assert.equal(beforeThreshold.acquired, true, "Releasing one attempt twice must record only one provider failure");
if (beforeThreshold.acquired) beforeThreshold.release("completed");

resetConnectionAdmissionForTests();
const recordBackgroundFailures = async (connectionId: string) => {
  for (let attempt = 0; attempt < BACKGROUND_CONNECTION_FAILURE_THRESHOLD; attempt += 1) {
    await assert.rejects(
      withConnectionAdmission(connectionId, { kind: "background" }, async () => {
        throw new Error("provider unavailable");
      }),
      /provider unavailable/u,
    );
  }
};
await recordBackgroundFailures("failing-background-connection");
assert.equal(
  tryBackgroundConnection("failing-background-connection", new Date()).acquired,
  false,
  "Repeated automatic provider failures must quarantine the connection",
);
const foregroundResult = await withConnectionAdmission(
  "failing-background-connection",
  { kind: "foreground" },
  async () => "foreground-ok",
);
assert.equal(foregroundResult, "foreground-ok", "Background quarantine must not reject foreground chats");
const admittedAfterForegroundRecovery = tryBackgroundConnection(
  "failing-background-connection",
  new Date(Date.now() + BACKGROUND_CONNECTION_IDLE_MS + 1),
);
assert.equal(
  admittedAfterForegroundRecovery.acquired,
  true,
  "A successful foreground chat must clear the longer background quarantine",
);
if (admittedAfterForegroundRecovery.acquired) admittedAfterForegroundRecovery.release("completed");

resetConnectionAdmissionForTests();
await recordBackgroundFailures("failing-background-connection");
const recoveredAdmission = tryBackgroundConnection(
  "failing-background-connection",
  new Date(Date.now() + BACKGROUND_CONNECTION_FAILURE_COOLDOWN_MS + 1),
);
assert.equal(recoveredAdmission.acquired, true, "The automatic connection must be probed again after its cooldown");
if (recoveredAdmission.acquired) recoveredAdmission.release("completed");

const storageDir = mkdtempSync(join(tmpdir(), "marinara-noodler-reserve-"));
process.env.FILE_STORAGE_DIR = storageDir;
const start = new Date("2026-07-29T10:00:00.000Z");

try {
  const db = (await createFileNativeDB()) as unknown as DB;
  const noodle = createNoodleStorage(db);
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const characters = createCharactersStorage(db);
  const sourcePersona = await characters.createPersona("Reserve Persona", "A source persona", undefined, {
    personality: "Quiet",
  });
  await noodle.updateSettings({ enableNoodler: true, autoPostingScheduleEnabled: true, postsPerDay: 2 });
  const publicAccount = await noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: sourcePersona.id,
    displayName: "Reserve Persona",
  });
  const creator = await noodle.createNoodlerAccount(publicAccount.id, {
    handle: "reserve_creator",
    displayName: "Reserve Creator",
    bio: "Prepared privately.",
    disclosureMode: "secret",
    stagePersonality: "Quiet and concise.",
  });
  assert.ok(creator);
  await noodle.patchAccountSettings(creator!.id, {
    subtree: "scheduler",
    patch: { autoPosting: { enabled: true } },
  });
  const enabledCreator = await noodle.getNoodlerAccountById(creator!.id);
  assert.ok(enabledCreator);

  const state = await noodle.ensureNoodlerReserveState(start);
  assert.equal(Date.parse(state.preparationNotBefore) - start.getTime(), 24 * 60 * 60 * 1000);
  assert.deepEqual(await noodle.claimNoodlerAutomaticAttempt("text", 2, start), { status: "holding" });

  const releasedAt = new Date("2026-07-30T10:00:00.000Z");
  await db
    .update(noodlerReserveState)
    .set({ preparationNotBefore: releasedAt.toISOString() })
    .where(eq(noodlerReserveState.id, "noodler-reserve"));
  const first = await noodle.claimNoodlerAutomaticAttempt("text", 2, releasedAt);
  const second = await noodle.claimNoodlerAutomaticAttempt("text", 2, new Date(releasedAt.getTime() + 1));
  assert.equal(first.status, "claimed");
  assert.equal(second.status, "claimed");
  assert.deepEqual(await noodle.claimNoodlerAutomaticAttempt("text", 2, new Date(releasedAt.getTime() - 60_000)), {
    status: "exhausted",
  });
  assert.equal((await noodle.claimNoodlerAutomaticAttempt("image", 2, releasedAt)).status, "claimed");
  assert.equal((await noodle.getNoodlerReserveStatus(releasedAt)).imageAttemptsUsed, 1);

  const publishAt = "2026-07-30T12:00:00.000Z";
  const preparedId = await noodle.createNoodlerPreparedPost({
    creatorAccountId: creator!.id,
    generatedAt: releasedAt.toISOString(),
    publishAt,
    payload: { title: "Future", content: "Private until noon.", access: "locked", imagePrompt: null, metadata: {} },
    policyFingerprint: noodlerReservePolicyFingerprint(
      enabledCreator!,
      await noodle.getSettings(),
      publicAccount.updatedAt,
    ),
  });
  const before = await db.select().from(noodlePosts);
  assert.equal(
    before.some((post) => post.content === "Private until noon."),
    false,
  );
  assert.equal((await noodle.getNoodlerReserveStatus(releasedAt)).preparedCount, 1);

  assert.equal(await noodle.publishDueNoodlerPreparedPosts(new Date(publishAt)), 1);
  assert.equal(await noodle.publishDueNoodlerPreparedPosts(new Date(publishAt)), 0);
  const published = (await db.select().from(noodlePosts)).find((post) => post.content === "Private until noon.");
  assert.equal(published?.createdAt, publishAt);
  assert.equal(JSON.parse(published?.metadata ?? "{}").noodlerPreparedPostId, preparedId);

  // A slot published late — inside the grace window — is stamped when it actually published, not
  // with its planned time, or it files behind everything the feed received during the delay.
  const lateSlotAt = "2026-07-30T12:10:00.000Z";
  const lateRunAt = new Date("2026-07-30T12:40:00.000Z");
  await noodle.createNoodlerPreparedPost({
    creatorAccountId: creator!.id,
    generatedAt: releasedAt.toISOString(),
    publishAt: lateSlotAt,
    payload: { title: null, content: "Slightly late", access: "locked", imagePrompt: null, metadata: {} },
    policyFingerprint: noodlerReservePolicyFingerprint(
      enabledCreator!,
      await noodle.getSettings(),
      publicAccount.updatedAt,
    ),
  });
  assert.equal(await noodle.publishDueNoodlerPreparedPosts(lateRunAt), 1);
  const late = (await db.select().from(noodlePosts)).find((post) => post.content === "Slightly late");
  assert.equal(late?.createdAt, lateRunAt.toISOString(), "a late publish is not backdated to its planned slot");

  // A slot the server slept through is retired, not published hours late with a backdated time.
  const elapsedId = await noodle.createNoodlerPreparedPost({
    creatorAccountId: creator!.id,
    generatedAt: releasedAt.toISOString(),
    publishAt: "2026-07-30T12:30:00.000Z",
    payload: { title: null, content: "Missed while down", access: "locked", imagePrompt: null, metadata: {} },
    policyFingerprint: noodlerReservePolicyFingerprint(
      enabledCreator!,
      await noodle.getSettings(),
      publicAccount.updatedAt,
    ),
  });
  assert.equal(await noodle.publishDueNoodlerPreparedPosts(new Date("2026-07-30T18:00:00.000Z")), 0);
  assert.equal((await noodle.listNoodlerPreparedPosts()).find((item) => item.id === elapsedId)?.state, "discarded");
  assert.equal(
    (await db.select().from(noodlePosts)).some((post) => post.content === "Missed while down"),
    false,
  );

  const pausedAt = "2026-07-30T13:00:00.000Z";
  await noodle.createNoodlerPreparedPost({
    creatorAccountId: creator!.id,
    generatedAt: releasedAt.toISOString(),
    publishAt: pausedAt,
    payload: { title: null, content: "Paused post", access: "locked", imagePrompt: null, metadata: {} },
    policyFingerprint: noodlerReservePolicyFingerprint(
      enabledCreator!,
      await noodle.getSettings(),
      publicAccount.updatedAt,
    ),
  });
  await noodle.updateSettings({ autoPostingScheduleEnabled: false });
  assert.equal(await noodle.publishDueNoodlerPreparedPosts(new Date(pausedAt)), 0);

  await noodle.updateSettings({ autoPostingScheduleEnabled: true });
  const manualAt = "2026-07-30T14:00:00.000Z";
  const boundaryIds = await Promise.all([
    noodle.createNoodlerPreparedPost({
      creatorAccountId: creator!.id,
      generatedAt: releasedAt.toISOString(),
      publishAt: manualAt,
      payload: { title: null, content: "At start", access: "locked", imagePrompt: null, metadata: {} },
      policyFingerprint: noodlerReservePolicyFingerprint(
        enabledCreator!,
        await noodle.getSettings(),
        publicAccount.updatedAt,
      ),
    }),
    noodle.createNoodlerPreparedPost({
      creatorAccountId: creator!.id,
      generatedAt: releasedAt.toISOString(),
      publishAt: "2026-07-30T14:30:00.000Z",
      payload: { title: null, content: "Inside", access: "locked", imagePrompt: null, metadata: {} },
      policyFingerprint: noodlerReservePolicyFingerprint(
        enabledCreator!,
        await noodle.getSettings(),
        publicAccount.updatedAt,
      ),
    }),
    noodle.createNoodlerPreparedPost({
      creatorAccountId: creator!.id,
      generatedAt: releasedAt.toISOString(),
      publishAt: "2026-07-30T15:00:00.000Z",
      payload: { title: null, content: "At end", access: "locked", imagePrompt: null, metadata: {} },
      policyFingerprint: noodlerReservePolicyFingerprint(
        enabledCreator!,
        await noodle.getSettings(),
        publicAccount.updatedAt,
      ),
    }),
    noodle.createNoodlerPreparedPost({
      creatorAccountId: creator!.id,
      generatedAt: releasedAt.toISOString(),
      publishAt: "2026-07-30T15:00:00.001Z",
      payload: { title: null, content: "After end", access: "locked", imagePrompt: null, metadata: {} },
      policyFingerprint: noodlerReservePolicyFingerprint(
        enabledCreator!,
        await noodle.getSettings(),
        publicAccount.updatedAt,
      ),
    }),
  ]);
  assert.equal(await noodle.discardPreparedPostsAfterManualPost(creator!.id, manualAt), 2);
  const boundary = await noodle.listNoodlerPreparedPosts();
  assert.equal(boundary.find((item) => item.id === boundaryIds[0])?.state, "prepared");
  assert.equal(boundary.find((item) => item.id === boundaryIds[1])?.state, "discarded");
  assert.equal(boundary.find((item) => item.id === boundaryIds[2])?.state, "discarded");
  assert.equal(boundary.find((item) => item.id === boundaryIds[3])?.state, "prepared");

  // An unrelated NoodleR setting change must not invalidate the reserve: only the policy
  // fields the prepared content actually depended on belong in the fingerprint.
  const policyBefore = noodlerReservePolicyFingerprint(
    enabledCreator!,
    await noodle.getSettings(),
    publicAccount.updatedAt,
  );
  await noodle.updateSettings({ noodlerOnboardingState: "completed", refreshesPerDay: 5 });
  assert.equal(
    noodlerReservePolicyFingerprint(enabledCreator!, await noodle.getSettings(), publicAccount.updatedAt),
    policyBefore,
    "unrelated settings must not invalidate prepared posts",
  );
  await noodle.updateSettings({ noodlerNightQuiet: false });
  assert.notEqual(
    noodlerReservePolicyFingerprint(enabledCreator!, await noodle.getSettings(), publicAccount.updatedAt),
    policyBefore,
    "night quiet is a selection input and must invalidate",
  );
  await noodle.updateSettings({ noodlerNightQuiet: true });

  // Lowering postsPerDay discards the latest excess items and keeps the imminent ones.
  const trimAt = new Date("2026-07-30T16:00:00.000Z");
  const fingerprint = noodlerReservePolicyFingerprint(
    enabledCreator!,
    await noodle.getSettings(),
    publicAccount.updatedAt,
  );
  const trimIds = await Promise.all(
    ["17:00", "18:00", "19:00"].map((time) =>
      noodle.createNoodlerPreparedPost({
        creatorAccountId: creator!.id,
        generatedAt: trimAt.toISOString(),
        publishAt: `2026-07-30T${time}:00.000Z`,
        payload: { title: null, content: `Slot ${time}`, access: "locked", imagePrompt: null, metadata: {} },
        policyFingerprint: fingerprint,
      }),
    ),
  );
  await noodle.updateSettings({ postsPerDay: 2 });
  await noodle.reconcileNoodlerPreparedPosts(trimAt);
  const trimmed = await noodle.listNoodlerPreparedPosts();
  assert.equal(trimmed.find((item) => item.id === trimIds[0])?.state, "prepared");
  assert.equal(trimmed.find((item) => item.id === trimIds[1])?.state, "prepared");
  assert.equal(trimmed.find((item) => item.id === trimIds[2])?.state, "discarded");

  // Claims that have left the rolling window are pruned rather than scanned forever.
  const pruneAt = new Date("2026-08-02T10:00:00.000Z");
  assert.equal((await noodle.claimNoodlerAutomaticAttempt("text", 2, pruneAt)).status, "claimed");
  const remaining = await db.select().from(noodlerAutomaticAttempts);
  assert.equal(remaining.length, 1, "expired attempt claims must be pruned");
  assert.equal((await noodle.getNoodlerReserveStatus(pruneAt)).textAttemptsUsed, 1);

  // Refresh ordering reads real posting activity, not account.updatedAt: editing a profile is
  // not activity and must not push a creator to the back of the queue.
  const activity = await noodle.getNoodlerCreatorActivityTimes();
  const creatorPosts = (await db.select().from(noodlePosts)).filter((post) => post.authorAccountId === creator!.id);
  assert.ok(creatorPosts.length > 0);
  const newestPost = creatorPosts.reduce((latest, post) => (post.createdAt > latest ? post.createdAt : latest), "");
  const newestPrepared = (await noodle.listNoodlerPreparedPosts())
    .filter((item) => item.creatorAccountId === creator!.id && item.state !== "discarded")
    .reduce((latest, item) => (item.publishAt > latest ? item.publishAt : latest), "");
  assert.equal(
    activity.get(creator!.id),
    newestPost > newestPrepared ? newestPost : newestPrepared,
    "creator activity is the newest published post or prepared slot",
  );

  // A row whose timestamps do not parse can never come due, so reconciliation retires it
  // instead of leaving every later status read and publish pass tripping over it.
  const poisonedId = await noodle.createNoodlerPreparedPost({
    creatorAccountId: creator!.id,
    generatedAt: releasedAt.toISOString(),
    publishAt: "not-a-timestamp",
    payload: { title: null, content: "Poisoned slot", access: "locked", imagePrompt: null, metadata: {} },
    policyFingerprint: noodlerReservePolicyFingerprint(
      enabledCreator!,
      await noodle.getSettings(),
      publicAccount.updatedAt,
    ),
  });
  await noodle.reconcileNoodlerPreparedPosts(pruneAt);
  assert.equal(
    (await noodle.listNoodlerPreparedPosts()).find((item) => item.id === poisonedId)?.state,
    "discarded",
    "an unparseable reserve timestamp must not poison automatic posting",
  );
  assert.ok(await noodle.getNoodlerReserveStatus(pruneAt), "status stays readable with a poisoned row present");

  // Terminal rows are read on every poll, so they are pruned once they are far past any
  // recovery use. Recent ones stay.
  const longAfter = new Date("2026-10-15T10:00:00.000Z");
  const beforePrune = (await noodle.listNoodlerPreparedPosts()).length;
  assert.ok(beforePrune > 0);
  await noodle.reconcileNoodlerPreparedPosts(longAfter);
  assert.equal(
    (await noodle.listNoodlerPreparedPosts()).filter((item) => item.state !== "prepared").length,
    0,
    "aged terminal prepared rows must be pruned",
  );

  const deletedSourcePreparedId = await noodle.createNoodlerPreparedPost({
    creatorAccountId: creator!.id,
    generatedAt: "2026-10-15T09:30:00.000Z",
    publishAt: "2026-10-15T10:00:00.000Z",
    payload: { title: null, content: "Must not publish.", access: "locked", imagePrompt: null, metadata: {} },
    policyFingerprint: noodlerReservePolicyFingerprint(
      creator!,
      await noodle.getSettings(),
      publicAccount.updatedAt,
    ),
  });

  // A replay must return its persisted post even after the linked source has been deleted.
  const replayExecutionId = "replay-after-source-delete";
  const replayPost = await noodle.createNoodlerPost({
    authorAccountId: creator!.id,
    title: "Replay",
    content: "Already persisted.",
    source: "generated",
    access: "locked",
    metadata: { noodlerWizardExecutionId: replayExecutionId },
  });
  assert.ok(replayPost);
  await characters.removePersona(sourcePersona.id);
  const { generateAndApplyNoodlerPost } =
    await import("../../packages/server/src/services/noodle/noodle-noodler-post.operation.js");
  const replay = await generateAndApplyNoodlerPost(db, {
    mode: "noodler",
    targetAccountId: creator!.id,
    access: "locked",
    executionId: replayExecutionId,
  });
  assert.equal(replay.status, "generated");
  if (replay.status === "generated") assert.equal(replay.post.id, replayPost!.id);
  assert.equal(await noodle.publishDueNoodlerPreparedPosts(new Date("2026-10-15T10:00:00.000Z")), 0);
  assert.equal((await noodle.listNoodlerPreparedPosts()).find((item) => item.id === deletedSourcePreparedId)?.state, "discarded");

  await (db as unknown as { _fileStore: { close(): Promise<void> } })._fileStore.close();
} finally {
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("Noodle reserve regression passed.\n");
