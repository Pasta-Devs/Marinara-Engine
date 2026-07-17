import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DB } from "../../packages/server/src/db/connection.js";
import { eq } from "../../packages/server/src/db/file-query.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { noodleAccounts } from "../../packages/server/src/db/schema/noodle.js";
import {
  noodleAccountSettingsPatchSchema,
  noodleAccountUpdateSchema,
} from "../../packages/shared/src/schemas/noodle.schema.js";
import { createNoodleStorage } from "../../packages/server/src/services/storage/noodle.storage.js";
import { resolveNoodleAvatarCropAfterProfileUpdate } from "../../packages/server/src/services/noodle/noodle-profile-avatar.js";

const sourceCrop = { x: 12, y: 18, width: 62, height: 62, unit: "%" as const };
assert.equal(
  resolveNoodleAvatarCropAfterProfileUpdate({
    currentAvatarUrl: "/avatar.png",
    nextAvatarUrl: undefined,
    currentCrop: sourceCrop,
  }),
  undefined,
);
assert.deepEqual(
  resolveNoodleAvatarCropAfterProfileUpdate({
    currentAvatarUrl: "/avatar.png",
    nextAvatarUrl: "/avatar.png",
    currentCrop: sourceCrop,
  }),
  sourceCrop,
);
assert.deepEqual(
  resolveNoodleAvatarCropAfterProfileUpdate({
    currentAvatarUrl: "/avatar.png",
    nextAvatarUrl: undefined,
    currentCrop: null,
    sourceAvatarUrl: "/avatar.png",
    sourceCrop,
  }),
  sourceCrop,
);
assert.deepEqual(
  resolveNoodleAvatarCropAfterProfileUpdate({
    currentAvatarUrl: "/avatar.png",
    nextAvatarUrl: "/avatar.png",
    currentCrop: null,
    sourceAvatarUrl: "/avatar.png",
    sourceCrop,
  }),
  sourceCrop,
);
assert.equal(
  resolveNoodleAvatarCropAfterProfileUpdate({
    currentAvatarUrl: "/avatar.png",
    nextAvatarUrl: "/replacement.png",
    currentCrop: sourceCrop,
  }),
  null,
);

const storageDir = mkdtempSync(join(tmpdir(), "marinara-noodle-settings-"));
process.env.FILE_STORAGE_DIR = storageDir;

try {
  const firstDb = await createFileNativeDB();
  const firstNoodle = createNoodleStorage(firstDb as unknown as DB);
  const updated = await firstNoodle.updateSettings({
    maxImagesPerRefresh: 9,
    allowRandomUsers: true,
    maxGeneratedPostsPerRefresh: 11,
  });
  assert.equal(updated.maxImagesPerRefresh, 9);
  assert.equal(updated.allowRandomUsers, true);
  assert.equal(updated.maxGeneratedPostsPerRefresh, 11);
  const concurrentAccount = await firstNoodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "concurrent-settings",
    displayName: "Concurrent Settings",
  });
  await Promise.all([
    firstNoodle.updateAccountProfile(concurrentAccount.id, { profile: { bannerUrl: "/banner.png" } }),
    firstNoodle.patchAccountSettings(concurrentAccount.id, {
      subtree: "social",
      patch: { notificationsReadAt: "2026-07-17T09:00:00.000Z" },
    }),
    firstNoodle.patchAccountSettings(concurrentAccount.id, { subtree: "scheduler", patch: {} }),
    firstNoodle.patchAccountSettings(concurrentAccount.id, { subtree: "privacy", patch: {} }),
  ]);
  const concurrentlyUpdatedAccount = await firstNoodle.getAccountById(concurrentAccount.id);
  assert.equal(concurrentlyUpdatedAccount?.settings.profile.bannerUrl, "/banner.png");
  assert.equal(concurrentlyUpdatedAccount?.settings.social.notificationsReadAt, "2026-07-17T09:00:00.000Z");
  assert.deepEqual(concurrentlyUpdatedAccount?.settings.scheduler, {});
  assert.deepEqual(concurrentlyUpdatedAccount?.settings.privacy, {});
  assert.equal(
    noodleAccountSettingsPatchSchema.safeParse({ subtree: "social", patch: { followingAccountIds: ["blocked"] } })
      .success,
    false,
  );
  assert.equal(
    noodleAccountSettingsPatchSchema.safeParse({ subtree: "scheduler", patch: { nextRunAt: null } }).success,
    false,
  );
  assert.equal(noodleAccountUpdateSchema.safeParse({ settings: { profile: {} } }).success, false);
  const legacyAccount = await firstNoodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "legacy-flat-settings",
    displayName: "Legacy Flat Settings",
  });
  await firstDb
    .update(noodleAccounts)
    .set({
      settings: JSON.stringify({
        avatarCrop: { zoom: 1.5, offsetX: 2, offsetY: -3 },
        bannerUrl: "/legacy-banner.png",
        location: "Legacy Location",
        profileGenerated: "true",
        profileManuallyEdited: false,
        followingAccountIds: '["legacy-follow"]',
        followingAccountTimestamps: { "legacy-follow": "2026-07-17T10:00:00.000Z" },
        notificationsReadAt: "2026-07-17T11:00:00.000Z",
      }),
    })
    .where(eq(noodleAccounts.id, legacyAccount.id));
  const normalizedLegacyAccount = await firstNoodle.getAccountById(legacyAccount.id);
  assert.deepEqual(normalizedLegacyAccount?.settings, {
    profile: {
      avatarCrop: { zoom: 1.5, offsetX: 2, offsetY: -3 },
      bannerUrl: "/legacy-banner.png",
      location: "Legacy Location",
      profileGenerated: true,
      profileManuallyEdited: false,
    },
    social: {
      followingAccountIds: ["legacy-follow"],
      followingAccountTimestamps: { "legacy-follow": "2026-07-17T10:00:00.000Z" },
      notificationsReadAt: "2026-07-17T11:00:00.000Z",
    },
    scheduler: {},
    privacy: {},
  });
  await firstDb
    .update(noodleAccounts)
    .set({
      settings: JSON.stringify({
        profile: { bannerUrl: "/valid-banner.png", location: 42 },
        social: {
          followingAccountIds: ["valid-follow"],
          followingAccountTimestamps: {
            "valid-follow": "2026-07-17T12:00:00.000Z",
            invalid: "not-a-date",
          },
          notificationsReadAt: "not-a-date",
        },
      }),
    })
    .where(eq(noodleAccounts.id, legacyAccount.id));
  const partiallyInvalidAccount = await firstNoodle.getAccountById(legacyAccount.id);
  assert.deepEqual(partiallyInvalidAccount?.settings, {
    profile: { bannerUrl: "/valid-banner.png" },
    social: {
      followingAccountIds: ["valid-follow"],
      followingAccountTimestamps: { "valid-follow": "2026-07-17T12:00:00.000Z" },
    },
    scheduler: {},
    privacy: {},
  });
  const followTargetA = await firstNoodle.upsertAccountFromProfile({
    kind: "character",
    entityId: "follow-target-a",
    displayName: "Follow Target A",
  });
  const followTargetB = await firstNoodle.upsertAccountFromProfile({
    kind: "character",
    entityId: "follow-target-b",
    displayName: "Follow Target B",
  });
  await Promise.all([
    firstNoodle.updateAccountFollow(concurrentAccount.id, followTargetA.id, true, "2026-07-17T13:00:00.000Z"),
    firstNoodle.updateAccountFollow(concurrentAccount.id, followTargetB.id, true, "2026-07-17T13:00:01.000Z"),
  ]);
  const concurrentlyFollowedAccount = await firstNoodle.getAccountById(concurrentAccount.id);
  assert.deepEqual(new Set(concurrentlyFollowedAccount?.settings.social.followingAccountIds), new Set([
    followTargetA.id,
    followTargetB.id,
  ]));
  assert.equal(
    concurrentlyFollowedAccount?.settings.social.followingAccountTimestamps?.[followTargetA.id],
    "2026-07-17T13:00:00.000Z",
  );
  assert.equal(
    concurrentlyFollowedAccount?.settings.social.followingAccountTimestamps?.[followTargetB.id],
    "2026-07-17T13:00:01.000Z",
  );
  await firstNoodle.patchAccountSettings(concurrentAccount.id, {
    subtree: "social",
    patch: { notificationsReadAt: "2026-07-17T14:00:00.000Z" },
  });
  const missingTimestampSettings = JSON.stringify({
    ...(await firstNoodle.getAccountById(concurrentAccount.id))!.settings,
    social: {
      ...(await firstNoodle.getAccountById(concurrentAccount.id))!.settings.social,
      followingAccountTimestamps: { [followTargetB.id]: "2026-07-17T13:00:01.000Z" },
    },
  });
  await firstDb
    .update(noodleAccounts)
    .set({ settings: missingTimestampSettings })
    .where(eq(noodleAccounts.id, concurrentAccount.id));
  const repairedFollow = await firstNoodle.updateAccountFollow(
    concurrentAccount.id,
    followTargetA.id,
    true,
    "2026-07-17T14:00:01.000Z",
  );
  assert.equal(repairedFollow?.changed, true);
  assert.equal(
    repairedFollow?.account.settings.social.followingAccountTimestamps?.[followTargetA.id],
    "2026-07-17T14:00:01.000Z",
  );
  const refreshRun = await firstNoodle.createRefreshRun({
    activeAccountIds: ["alpha"],
    prompt: "Generate a Noodle timeline.",
  });
  assert.deepEqual(refreshRun.attempts, []);
  const rejectedResponse = "{not valid timeline JSON";
  const rejectionReason = "the response was not valid timeline JSON (full parser detail)";
  await firstNoodle.recordRefreshAttempt(refreshRun.id, {
    sequence: 1,
    kind: "initial",
    response: rejectedResponse,
    rejectionReason,
    createdAt: "2026-07-15T19:00:00.000Z",
  });
  const correctedResponse = '{"posts":[{"authorHandle":"alpha","content":"Valid"}]}';
  await firstNoodle.recordRefreshAttempt(refreshRun.id, {
    sequence: 2,
    kind: "correction",
    response: correctedResponse,
    rejectionReason: null,
    createdAt: "2026-07-15T19:00:01.000Z",
  });
  await firstNoodle.finishRefreshRun(refreshRun.id, { status: "completed", result: correctedResponse });
  const legacyRefreshRun = await firstNoodle.createRefreshRun({
    activeAccountIds: ["legacy"],
    prompt: "Legacy refresh prompt.",
  });
  await firstNoodle.finishRefreshRun(legacyRefreshRun.id, { status: "completed", result: "legacy result" });
  const characterAccount = await firstNoodle.upsertAccountFromProfile({
    kind: "character",
    entityId: "renamed-character",
    displayName: "Old Card Name",
    avatarUrl: "/old-avatar.png",
    bio: "Generated Noodle biography",
    invited: true,
    syncIdentity: true,
  });
  await firstNoodle.updateAccountProfile(characterAccount.id, {
    displayName: "Generated Social Name",
    handle: "custom_handle",
    bio: "Keep this generated biography",
    profile: { profileGenerated: true, location: "Snezhnaya" },
  });
  const renamedCharacterAccount = await firstNoodle.upsertAccountFromProfile({
    kind: "character",
    entityId: "renamed-character",
    displayName: "New Card Name",
    avatarUrl: "/new-avatar.png",
    syncIdentity: true,
  });
  assert.equal(renamedCharacterAccount.displayName, "New Card Name");
  assert.equal(renamedCharacterAccount.avatarUrl, "/new-avatar.png");
  assert.equal(renamedCharacterAccount.handle, "custom_handle");
  assert.equal(renamedCharacterAccount.bio, "Keep this generated biography");
  assert.deepEqual(renamedCharacterAccount.settings, {
    profile: { profileGenerated: true, location: "Snezhnaya" },
    social: {},
    scheduler: {},
    privacy: {},
  });
  await firstDb._fileStore.close();

  const refreshRunsPath = join(storageDir, "tables", "noodle_refresh_runs.json");
  const persistedRefreshRuns = JSON.parse(readFileSync(refreshRunsPath, "utf8")) as Array<Record<string, unknown>>;
  const legacyPersistedRun = persistedRefreshRuns.find((entry) => entry.id === legacyRefreshRun.id);
  assert.ok(legacyPersistedRun);
  delete legacyPersistedRun.attempts;
  writeFileSync(refreshRunsPath, JSON.stringify(persistedRefreshRuns));

  const reopenedDb = await createFileNativeDB();
  const reopenedNoodle = createNoodleStorage(reopenedDb as unknown as DB);
  const reopenedSettings = await reopenedNoodle.getSettings();
  assert.equal(reopenedSettings.maxImagesPerRefresh, 9);
  assert.equal(reopenedSettings.allowRandomUsers, true);
  assert.equal(reopenedSettings.maxGeneratedPostsPerRefresh, 11);
  const reopenedConcurrentAccount = await reopenedNoodle.getAccountById(concurrentAccount.id);
  assert.equal(reopenedConcurrentAccount?.settings.profile.bannerUrl, "/banner.png");
  assert.deepEqual(new Set(reopenedConcurrentAccount?.settings.social.followingAccountIds), new Set([
    followTargetA.id,
    followTargetB.id,
  ]));
  const reopenedRuns = await reopenedNoodle.listRefreshRuns({ status: "completed", limit: 2 });
  const reopenedRun = reopenedRuns.find((entry) => entry.id === refreshRun.id);
  assert.equal(reopenedRun?.result, correctedResponse);
  assert.deepEqual(reopenedRun?.attempts, [
    {
      sequence: 1,
      kind: "initial",
      response: rejectedResponse,
      rejectionReason,
      createdAt: "2026-07-15T19:00:00.000Z",
    },
    {
      sequence: 2,
      kind: "correction",
      response: correctedResponse,
      rejectionReason: null,
      createdAt: "2026-07-15T19:00:01.000Z",
    },
  ]);
  assert.deepEqual(
    reopenedRuns.find((entry) => entry.id === legacyRefreshRun.id)?.attempts,
    [],
  );
  await reopenedDb._fileStore.close();
} finally {
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("Noodle settings persistence regression passed.\n");
