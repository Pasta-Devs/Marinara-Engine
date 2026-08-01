import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DB } from "../../packages/server/src/db/connection.js";
import { eq } from "../../packages/server/src/db/file-query.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { noodlePosts, noodlerAutomaticAttempts, noodlerReserveState } from "../../packages/server/src/db/schema/noodle.js";
import {
  noodleAccountSchedulerPatchSchema,
  noodleAutoPostingSettingsSchema,
} from "../../packages/shared/src/schemas/noodle.schema.js";
import {
  createNoodleStorage,
  noodlerReservePolicyFingerprint,
  normalizeScheduler,
} from "../../packages/server/src/services/storage/noodle.storage.js";
import {
  isNoodlerNightQuietTime,
} from "../../packages/server/src/services/noodle/noodle-noodler-reserve.operation.js";
import {
  beginForegroundConnection,
  resetConnectionAdmissionForTests,
  tryBackgroundConnection,
} from "../../packages/server/src/services/generation/connection-admission.js";

assert.deepEqual(noodleAutoPostingSettingsSchema.parse({}), { enabled: false, imagesEnabled: false });
assert.deepEqual(normalizeScheduler({}).autoPosting, { enabled: false, imagesEnabled: false });
assert.deepEqual(
  normalizeScheduler({ autoPosting: { enabled: true, imagesEnabled: true, intensity: 6, nextRunAt: "legacy" } }).autoPosting,
  { enabled: true, imagesEnabled: true },
);
assert.ok(noodleAccountSchedulerPatchSchema.safeParse({ autoPosting: { enabled: true, imagesEnabled: true } }).success);
assert.equal(noodleAccountSchedulerPatchSchema.safeParse({ autoPosting: { intensity: 3 } }).success, false);
assert.equal(noodleAccountSchedulerPatchSchema.safeParse({ autoPosting: { nextRunAt: new Date().toISOString() } }).success, false);
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

const storageDir = mkdtempSync(join(tmpdir(), "marinara-noodler-reserve-"));
process.env.FILE_STORAGE_DIR = storageDir;
const start = new Date("2026-07-29T10:00:00.000Z");

try {
  const db = (await createFileNativeDB()) as unknown as DB;
  const noodle = createNoodleStorage(db);
  await noodle.updateSettings({ enableNoodler: true, autoPostingScheduleEnabled: true, postsPerDay: 2 });
  const publicAccount = await noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "reserve-persona",
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
  await db.update(noodlerReserveState).set({ preparationNotBefore: releasedAt.toISOString() }).where(eq(noodlerReserveState.id, "noodler-reserve"));
  const first = await noodle.claimNoodlerAutomaticAttempt("text", 2, releasedAt);
  const second = await noodle.claimNoodlerAutomaticAttempt("text", 2, new Date(releasedAt.getTime() + 1));
  assert.equal(first.status, "claimed");
  assert.equal(second.status, "claimed");
  assert.deepEqual(await noodle.claimNoodlerAutomaticAttempt("text", 2, new Date(releasedAt.getTime() - 60_000)), { status: "exhausted" });
  assert.equal((await noodle.claimNoodlerAutomaticAttempt("image", 2, releasedAt)).status, "claimed");
  assert.equal((await noodle.getNoodlerReserveStatus(releasedAt)).imageAttemptsUsed, 1);

  const publishAt = "2026-07-30T12:00:00.000Z";
  const preparedId = await noodle.createNoodlerPreparedPost({
    creatorAccountId: creator!.id,
    generatedAt: releasedAt.toISOString(),
    publishAt,
    payload: { title: "Future", content: "Private until noon.", access: "locked", imagePrompt: null, metadata: {} },
    policyFingerprint: noodlerReservePolicyFingerprint(enabledCreator!, await noodle.getSettings(), publicAccount.updatedAt),
  });
  const before = await db.select().from(noodlePosts);
  assert.equal(before.some((post) => post.content === "Private until noon."), false);
  assert.equal((await noodle.getNoodlerReserveStatus(releasedAt)).preparedCount, 1);

  assert.equal(await noodle.publishDueNoodlerPreparedPosts(new Date(publishAt)), 1);
  assert.equal(await noodle.publishDueNoodlerPreparedPosts(new Date(publishAt)), 0);
  const published = (await db.select().from(noodlePosts)).find((post) => post.content === "Private until noon.");
  assert.equal(published?.createdAt, publishAt);
  assert.equal(JSON.parse(published?.metadata ?? "{}").noodlerPreparedPostId, preparedId);

  const pausedAt = "2026-07-30T13:00:00.000Z";
  await noodle.createNoodlerPreparedPost({
    creatorAccountId: creator!.id,
    generatedAt: releasedAt.toISOString(),
    publishAt: pausedAt,
    payload: { title: null, content: "Paused post", access: "locked", imagePrompt: null, metadata: {} },
    policyFingerprint: noodlerReservePolicyFingerprint(enabledCreator!, await noodle.getSettings(), publicAccount.updatedAt),
  });
  await noodle.updateSettings({ autoPostingScheduleEnabled: false });
  assert.equal(await noodle.publishDueNoodlerPreparedPosts(new Date(pausedAt)), 0);

  await noodle.updateSettings({ autoPostingScheduleEnabled: true });
  const manualAt = "2026-07-30T14:00:00.000Z";
  const boundaryIds = await Promise.all([
    noodle.createNoodlerPreparedPost({ creatorAccountId: creator!.id, generatedAt: releasedAt.toISOString(), publishAt: manualAt, payload: { title: null, content: "At start", access: "locked", imagePrompt: null, metadata: {} }, policyFingerprint: noodlerReservePolicyFingerprint(enabledCreator!, await noodle.getSettings(), publicAccount.updatedAt) }),
    noodle.createNoodlerPreparedPost({ creatorAccountId: creator!.id, generatedAt: releasedAt.toISOString(), publishAt: "2026-07-30T14:30:00.000Z", payload: { title: null, content: "Inside", access: "locked", imagePrompt: null, metadata: {} }, policyFingerprint: noodlerReservePolicyFingerprint(enabledCreator!, await noodle.getSettings(), publicAccount.updatedAt) }),
    noodle.createNoodlerPreparedPost({ creatorAccountId: creator!.id, generatedAt: releasedAt.toISOString(), publishAt: "2026-07-30T15:00:00.000Z", payload: { title: null, content: "At end", access: "locked", imagePrompt: null, metadata: {} }, policyFingerprint: noodlerReservePolicyFingerprint(enabledCreator!, await noodle.getSettings(), publicAccount.updatedAt) }),
    noodle.createNoodlerPreparedPost({ creatorAccountId: creator!.id, generatedAt: releasedAt.toISOString(), publishAt: "2026-07-30T15:00:00.001Z", payload: { title: null, content: "After end", access: "locked", imagePrompt: null, metadata: {} }, policyFingerprint: noodlerReservePolicyFingerprint(enabledCreator!, await noodle.getSettings(), publicAccount.updatedAt) }),
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

  await (db as unknown as { _fileStore: { close(): Promise<void> } })._fileStore.close();
} finally {
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("Noodle reserve regression passed.\n");
