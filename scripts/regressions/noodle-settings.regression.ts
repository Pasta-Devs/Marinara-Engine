import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DB } from "../../packages/server/src/db/connection.js";
import { eq } from "../../packages/server/src/db/file-query.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { noodleAccounts } from "../../packages/server/src/db/schema/noodle.js";
import { createAppSettingsStorage } from "../../packages/server/src/services/storage/app-settings.storage.js";
import {
  DEFAULT_NOODLE_SETTINGS,
  AMBIENT_NOODLE_ENTITY_IDS,
  NOODLER_POSTS_PER_DAY_MAX,
  noodleAmbientProfileRerollSchema,
  noodleAccountSettingsPatchSchema,
  noodleAccountUpdateSchema,
  noodleBulkNoodlerAccountCreateSchema,
  noodlerTargetedRefreshSchema,
} from "../../packages/shared/src/schemas/noodle.schema.js";
import { resolveNoodlerOnboardingCompletion } from "../../packages/shared/src/utils/noodler-onboarding.js";
import {
  createNoodleStorage,
  normalizeNoodleSettings,
} from "../../packages/server/src/services/storage/noodle.storage.js";
import { resolveNoodleAvatarCropAfterProfileUpdate } from "../../packages/server/src/services/noodle/noodle-profile-avatar.js";
import {
  AMBIENT_NOODLE_PROFILES,
  ensureAmbientNoodleAccounts,
  isAmbientNoodleAccount,
} from "../../packages/server/src/services/noodle/noodle-ambient-profiles.js";
import {
  allocateAmbientProfileHandles,
  ambientGeneratedProfileChanged,
  nextAvailableAmbientHandle,
} from "../../packages/server/src/services/noodle/noodle-ambient-profile-generation.service.js";
import {
  claimNoodleOperation,
  isNoodleOperationActive,
  resetNoodleOperationsForTests,
} from "../../packages/server/src/services/noodle/noodle-operation-lock.js";

const generated = [{ status: "generated" }, { status: "generated" }];
// Nothing selected is a deliberate skip, not a failure.
assert.equal(
  resolveNoodlerOnboardingCompletion({ selectedCount: 0, createdCount: 0, createFailures: 0, outcomes: null }),
  "zero",
);
// Selections that produced no profiles are a failure, whatever generation would have done.
assert.equal(
  resolveNoodlerOnboardingCompletion({ selectedCount: 3, createdCount: 0, createFailures: 3, outcomes: null }),
  "failed",
);
// Profiles created, generation not attempted.
assert.equal(
  resolveNoodlerOnboardingCompletion({ selectedCount: 2, createdCount: 2, createFailures: 0, outcomes: null }),
  "declined",
);
assert.equal(
  resolveNoodlerOnboardingCompletion({ selectedCount: 2, createdCount: 2, createFailures: 0, outcomes: generated }),
  "generated",
);
// Every post generated, but a selection never became a profile: still only partial.
assert.equal(
  resolveNoodlerOnboardingCompletion({ selectedCount: 3, createdCount: 2, createFailures: 1, outcomes: generated }),
  "partial",
);
assert.equal(
  resolveNoodlerOnboardingCompletion({
    selectedCount: 2,
    createdCount: 2,
    createFailures: 0,
    outcomes: [{ status: "generated" }, { status: "error" }],
  }),
  "partial",
);
assert.equal(
  resolveNoodlerOnboardingCompletion({
    selectedCount: 2,
    createdCount: 2,
    createFailures: 0,
    outcomes: [{ status: "error" }, { status: "busy" }],
  }),
  "failed",
);
const bulkOnboarding = noodleBulkNoodlerAccountCreateSchema.parse({
  noodleAccountIds: [],
  disclosureMode: "hinted",
  autoPosting: { enabled: true, imagesEnabled: true },
});
assert.deepEqual(bulkOnboarding.noodleAccountIds, []);
assert.equal(bulkOnboarding.autoPosting.imagesEnabled, true);
assert.equal(normalizeNoodleSettings({ noodlerOnboardingComplete: true }).noodlerOnboardingState, "completed");
assert.equal(normalizeNoodleSettings({ noodlerOnboardingComplete: false }).noodlerOnboardingState, "incomplete");
assert.deepEqual(noodlerTargetedRefreshSchema.parse({ accountIds: ["creator-1"], executionId: "wizard-run-1" }), {
  accountIds: ["creator-1"],
  executionId: "wizard-run-1",
});
assert.equal(AMBIENT_NOODLE_ENTITY_IDS.length, 6);
assert.deepEqual(
  AMBIENT_NOODLE_PROFILES.map((profile) => profile.entityId),
  AMBIENT_NOODLE_ENTITY_IDS,
);
assert.equal(noodleAmbientProfileRerollSchema.safeParse({ accountIds: [] }).success, false);
assert.equal(noodleAmbientProfileRerollSchema.safeParse({ accountIds: ["ambient-1", "ambient-1"] }).success, false);
assert.deepEqual(noodleAmbientProfileRerollSchema.parse({ accountIds: ["ambient-1"] }), {
  accountIds: ["ambient-1"],
  debugMode: false,
});
const reservedAmbientHandles = new Set(["ambient_name"]);
assert.equal(nextAvailableAmbientHandle("@Ambient Name", reservedAmbientHandles), "ambient_name_2");
assert.equal(nextAvailableAmbientHandle("@Ambient Name", reservedAmbientHandles), "ambient_name_3");
assert.equal(nextAvailableAmbientHandle("A".repeat(50), new Set()).length, 36);
resetNoodleOperationsForTests();
const releaseIdentityOperation = claimNoodleOperation("identity");
assert.ok(releaseIdentityOperation);
assert.equal(isNoodleOperationActive("identity"), true);
assert.equal(claimNoodleOperation("identity"), null);
releaseIdentityOperation();
releaseIdentityOperation();
assert.equal(isNoodleOperationActive("identity"), false);
assert.ok(claimNoodleOperation("identity"));
resetNoodleOperationsForTests();

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

// One invalid stored field must not reset unrelated settings.
// used to wipe lorebook context, invited character folders, and the generation connection.
assert.equal(
  normalizeNoodleSettings({ postsPerDay: NOODLER_POSTS_PER_DAY_MAX }).postsPerDay,
  NOODLER_POSTS_PER_DAY_MAX,
);
const salvaged = normalizeNoodleSettings({
  postsPerDay: NOODLER_POSTS_PER_DAY_MAX + 1,
  enableLorebookContext: true,
  invitedCharacterGroupIds: ["folder-1"],
  generationConnectionId: "conn-1",
  refreshesPerDay: 6,
});
assert.equal(salvaged.enableLorebookContext, true);
assert.deepEqual(salvaged.invitedCharacterGroupIds, ["folder-1"]);
assert.equal(salvaged.generationConnectionId, "conn-1");
assert.equal(salvaged.refreshesPerDay, 6);
assert.equal(salvaged.postsPerDay, DEFAULT_NOODLE_SETTINGS.postsPerDay);
assert.equal(salvaged.noodlerOnboardingComplete, false);
assert.equal(salvaged.noodlerNightQuiet, true);

// The pre-rename guidance key must still be read (rename must not reset customized text).
assert.equal(
  normalizeNoodleSettings({ privateGenerationGuidance: "custom guidance" }).noodlerGenerationGuidance,
  "custom guidance",
);

const storageDir = mkdtempSync(join(tmpdir(), "marinara-noodle-settings-"));
process.env.FILE_STORAGE_DIR = storageDir;

try {
  const firstDb = await createFileNativeDB();
  const firstNoodle = createNoodleStorage(firstDb as unknown as DB);
  const [seededAmbient, concurrentlySeededAmbient] = await Promise.all([
    ensureAmbientNoodleAccounts(firstNoodle, false),
    ensureAmbientNoodleAccounts(firstNoodle, false),
  ]);
  assert.equal(seededAmbient.length, 6);
  assert.deepEqual(
    concurrentlySeededAmbient.map((account) => account.id),
    seededAmbient.map((account) => account.id),
  );
  assert.equal((await firstNoodle.listAccounts()).filter(isAmbientNoodleAccount).length, 6);
  assert.equal(seededAmbient.every(isAmbientNoodleAccount), true);
  assert.equal(
    seededAmbient.every((account) => account.invited === false),
    true,
  );
  const editedAmbient = seededAmbient[0]!;
  await firstNoodle.updateAccountProfile(editedAmbient.id, {
    handle: "keeper_handle",
    displayName: "Keeper Name",
    bio: "Keep this manually edited identity.",
    avatarUrl: "/custom-avatar.png",
    profile: {
      bannerUrl: "/custom-banner.png",
      avatarCrop: { x: 1, y: 2, width: 90, height: 90, unit: "%" },
      profileManuallyEdited: true,
    },
  });
  const reseededAmbient = await ensureAmbientNoodleAccounts(firstNoodle, true);
  const preservedAmbient = reseededAmbient.find((account) => account.id === editedAmbient.id)!;
  assert.equal(preservedAmbient.displayName, "Keeper Name");
  assert.equal(preservedAmbient.handle, "keeper_handle");
  assert.equal(preservedAmbient.bio, "Keep this manually edited identity.");
  assert.equal(preservedAmbient.invited, true);
  const swapTarget = reseededAmbient[1]!;
  const swappedHandles = allocateAmbientProfileHandles(
    [preservedAmbient, swapTarget],
    new Map([
      [
        preservedAmbient.entityId,
        {
          entityId: preservedAmbient.entityId,
          name: "First Swapped",
          handle: swapTarget.handle,
          bio: "First swap.",
          location: "One",
        },
      ],
      [
        swapTarget.entityId,
        {
          entityId: swapTarget.entityId,
          name: "Second Swapped",
          handle: preservedAmbient.handle,
          bio: "Second swap.",
          location: "Two",
        },
      ],
    ]),
    reseededAmbient.map((account) => account.handle),
  );
  // Neither account may be handed a handle the other still holds, or the write trips the unique index.
  assert.equal(swappedHandles.get(preservedAmbient.id), `${swapTarget.handle}_2`);
  assert.equal(swappedHandles.get(swapTarget.id), `${preservedAmbient.handle}_2`);
  for (const account of [preservedAmbient, swapTarget]) {
    const applied = await firstNoodle.updateAccountProfile(account.id, {
      handle: swappedHandles.get(account.id)!,
      displayName: `${account.displayName} Swapped`,
      bio: "Swapped identity.",
      avatarUrl: null,
      profile: { avatarCrop: null, profileGenerated: true, profileManuallyEdited: false },
    });
    assert.equal(applied?.handle, swappedHandles.get(account.id));
  }
  assert.equal(
    ambientGeneratedProfileChanged(preservedAmbient, {
      entityId: preservedAmbient.entityId,
      name: "Keeper Name",
      handle: "keeper_handle",
      bio: "Different bio alone is not a new identity.",
      location: "Elsewhere",
    }),
    false,
  );
  assert.equal(
    ambientGeneratedProfileChanged(preservedAmbient, {
      entityId: preservedAmbient.entityId,
      name: "New Name",
      handle: "new_handle",
      bio: "A genuinely new identity.",
      location: "Elsewhere",
    }),
    true,
  );
  const rerolledAmbient = await firstNoodle.updateAccountProfile(preservedAmbient.id, {
    handle: "new_handle",
    displayName: "New Name",
    bio: "A genuinely new identity.",
    avatarUrl: null,
    profile: {
      bannerUrl: "",
      avatarCrop: null,
      location: "Elsewhere",
      profileGenerated: true,
      profileManuallyEdited: false,
    },
  });
  assert.equal(rerolledAmbient?.id, editedAmbient.id);
  assert.equal(rerolledAmbient?.entityId, editedAmbient.entityId);
  assert.equal(rerolledAmbient?.avatarUrl, null);
  assert.equal(rerolledAmbient?.settings.profile.bannerUrl, "");
  assert.equal(rerolledAmbient?.settings.profile.avatarCrop, null);
  assert.equal(rerolledAmbient?.settings.profile.profileGenerated, true);
  assert.equal(rerolledAmbient?.settings.profile.profileManuallyEdited, false);
  await firstNoodle.updateSettings({ noodlerOnboardingComplete: true, noodlerOnboardingState: "zero" });
  assert.equal((await firstNoodle.getSettings()).noodlerOnboardingState, "zero");
  const updated = await firstNoodle.updateSettings({
    maxImagesPerRefresh: 9,
    allowRandomUsers: true,
    includeCharacterSchedules: true,
    maxGeneratedPostsPerRefresh: 11,
  });
  assert.equal(updated.maxImagesPerRefresh, 9);
  assert.equal(updated.allowRandomUsers, true);
  assert.equal(updated.includeCharacterSchedules, true);
  assert.equal(updated.maxGeneratedPostsPerRefresh, 11);
  // Legacy read → current write → downgrade read. Saving any setting must keep the old
  // guidance key mirrored, or a rollback to a pre-rename build loses the customized text.
  await firstNoodle.updateSettings({ noodlerGenerationGuidance: "custom guidance" });
  const persistedSettings = JSON.parse(
    (await createAppSettingsStorage(firstDb as unknown as DB).get("noodle.settings")) ?? "{}",
  ) as Record<string, unknown>;
  assert.equal(persistedSettings.noodlerGenerationGuidance, "custom guidance");
  assert.equal(persistedSettings.privateGenerationGuidance, "custom guidance");
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
  assert.deepEqual(concurrentlyUpdatedAccount?.settings.scheduler, {
    autoPosting: { enabled: false, imagesEnabled: false },
  });
  assert.deepEqual(concurrentlyUpdatedAccount?.settings.privacy, {
    access: { hiddenFromAccountIds: [] },
  });
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
    scheduler: { autoPosting: { enabled: false, imagesEnabled: false } },
    privacy: { access: { hiddenFromAccountIds: [] } },
    wallet: { coins: 999999 },
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
    scheduler: { autoPosting: { enabled: false, imagesEnabled: false } },
    privacy: { access: { hiddenFromAccountIds: [] } },
    wallet: { coins: 999999 },
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
  assert.deepEqual(
    new Set(concurrentlyFollowedAccount?.settings.social.followingAccountIds),
    new Set([followTargetA.id, followTargetB.id]),
  );
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
    scheduler: { autoPosting: { enabled: false, imagesEnabled: false } },
    privacy: { access: { hiddenFromAccountIds: [] } },
    wallet: { coins: 999999 },
  });
  const creatorSource = await firstNoodle.upsertAccountFromProfile({
    kind: "character",
    entityId: "access-creator",
    displayName: "Access Creator",
  });
  const noodlerCreator = await firstNoodle.createNoodlerAccount(creatorSource.id, {
    displayName: "After Hours",
    handle: "after_hours",
    bio: "",
    stagePersonality: "Reserved",
    disclosureMode: "secret",
  });
  assert.ok(noodlerCreator);
  const viewer = await firstNoodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "access-viewer",
    displayName: "Access Viewer",
  });
  assert.equal(viewer.settings.wallet.coins, 999999);
  await firstDb
    .update(noodleAccounts)
    .set({ settings: JSON.stringify({ wallet: { coins: -4 } }) })
    .where(eq(noodleAccounts.id, viewer.id));
  assert.equal((await firstNoodle.getAccountById(viewer.id))?.settings.wallet.coins, 999999);
  await firstDb
    .update(noodleAccounts)
    .set({ settings: JSON.stringify({ wallet: { coins: "not-a-number" } }) })
    .where(eq(noodleAccounts.id, viewer.id));
  assert.equal((await firstNoodle.getAccountById(viewer.id))?.settings.wallet.coins, 999999);
  const ppvPost = await firstNoodle.createNoodlerPost({
    authorAccountId: noodlerCreator.id,
    content: "Locked content",
    access: "locked",
  });
  assert.ok(ppvPost);
  const [firstSubscription, duplicateSubscription] = await Promise.all([
    firstNoodle.subscribe(viewer.id, noodlerCreator.id),
    firstNoodle.subscribe(viewer.id, noodlerCreator.id),
  ]);
  assert.ok(firstSubscription);
  assert.equal(firstSubscription?.id, duplicateSubscription?.id);
  const afterSubscription = await firstNoodle.getAccountById(viewer.id);
  assert.equal(afterSubscription?.settings.wallet.coins, 999994);
  assert.ok(afterSubscription?.settings.social.followingAccountIds?.includes(noodlerCreator.id));
  assert.equal(typeof afterSubscription?.settings.social.followingAccountTimestamps?.[noodlerCreator.id], "string");
  const [firstUnlock, duplicateUnlock] = await Promise.all([
    firstNoodle.unlockPost(viewer.id, ppvPost.id),
    firstNoodle.unlockPost(viewer.id, ppvPost.id),
  ]);
  assert.ok(firstUnlock);
  assert.equal(firstUnlock?.id, duplicateUnlock?.id);
  assert.equal((await firstNoodle.getAccountById(viewer.id))?.settings.wallet.coins, 999993);
  const zeroBalanceViewer = await firstNoodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "zero-balance-viewer",
    displayName: "Zero Balance Viewer",
  });
  await firstDb
    .update(noodleAccounts)
    .set({ settings: JSON.stringify({ ...zeroBalanceViewer.settings, wallet: { coins: 0 } }) })
    .where(eq(noodleAccounts.id, zeroBalanceViewer.id));
  assert.equal(await firstNoodle.subscribe(zeroBalanceViewer.id, noodlerCreator.id), null);
  assert.equal(await firstNoodle.unlockPost(zeroBalanceViewer.id, ppvPost.id), null);
  assert.equal((await firstNoodle.listSubscriptionsForViewer(zeroBalanceViewer.id)).length, 0);
  assert.equal((await firstNoodle.listPostUnlocksForViewer(zeroBalanceViewer.id)).length, 0);
  assert.equal((await firstNoodle.getAccountById(zeroBalanceViewer.id))?.settings.wallet.coins, 0);
  assert.equal(await firstNoodle.subscribe(creatorSource.id, noodlerCreator.id), null);
  const personaCreatorSource = await firstNoodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "access-persona-creator",
    displayName: "Persona Creator",
  });
  const personaNoodlerCreator = await firstNoodle.createNoodlerAccount(personaCreatorSource.id, {
    displayName: "Persona After Hours",
    handle: "persona_after_hours",
    bio: "",
    stagePersonality: "Reserved",
    disclosureMode: "secret",
  });
  assert.ok(personaNoodlerCreator);
  const personaPpvPost = await firstNoodle.createNoodlerPost({
    authorAccountId: personaNoodlerCreator!.id,
    content: "Persona locked content",
    access: "locked",
  });
  assert.ok(personaPpvPost);
  assert.equal(await firstNoodle.subscribe(personaCreatorSource.id, personaNoodlerCreator!.id), null);
  assert.equal(await firstNoodle.unlockPost(personaCreatorSource.id, personaPpvPost!.id), null);
  assert.equal(await firstNoodle.unlockPost(viewer.id, "missing-post"), null);
  assert.equal(await firstNoodle.updateAccount(noodlerCreator.id, { displayName: "Bypassed identity" }), null);
  const deletedNoodlerCreator = await firstNoodle.deleteNoodlerAccount(noodlerCreator.id);
  assert.equal(deletedNoodlerCreator?.id, noodlerCreator.id);
  assert.equal(await firstNoodle.getNoodlerAccountById(noodlerCreator.id), null);
  assert.equal(await firstNoodle.getNoodlerPostById(ppvPost.id), null);
  assert.equal((await firstNoodle.listSubscriptionsForViewer(viewer.id)).length, 0);
  assert.equal((await firstNoodle.listPostUnlocksForViewer(viewer.id)).length, 0);
  assert.ok(await firstNoodle.getAccountById(creatorSource.id));
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
  assert.equal(reopenedSettings.includeCharacterSchedules, true);
  assert.equal(reopenedSettings.maxGeneratedPostsPerRefresh, 11);
  assert.equal((await reopenedNoodle.listSubscriptionsForViewer(viewer.id)).length, 0);
  assert.equal((await reopenedNoodle.listPostUnlocksForViewer(viewer.id)).length, 0);
  const reopenedConcurrentAccount = await reopenedNoodle.getAccountById(concurrentAccount.id);
  assert.equal(reopenedConcurrentAccount?.settings.profile.bannerUrl, "/banner.png");
  assert.deepEqual(
    new Set(reopenedConcurrentAccount?.settings.social.followingAccountIds),
    new Set([followTargetA.id, followTargetB.id]),
  );
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
  assert.deepEqual(reopenedRuns.find((entry) => entry.id === legacyRefreshRun.id)?.attempts, []);
  await reopenedDb._fileStore.close();
} finally {
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("Noodle settings persistence regression passed.\n");
