import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProfileNoodleImportWarning } from "../../packages/server/src/services/import/profile-import-noodle.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-profile-import-noodle-"));
const fileStorageDir = join(dataDir, "storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = fileStorageDir;
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

try {
  const { getDB } = await import("../../packages/server/src/db/connection.js");
  const { noodleAccounts } = await import("../../packages/server/src/db/schema/noodle.js");
  const { ProfileImportRequestError } =
    await import("../../packages/server/src/services/import/profile-import-errors.js");
  const { planProfileNoodleImport } =
    await import("../../packages/server/src/services/import/profile-import-noodle.js");
  const db = await getDB();

  await db.insert(noodleAccounts).values({
    id: "destination-account",
    kind: "character",
    entityId: "character-1",
    handle: "source_handle",
    displayName: "Destination",
    bio: "",
    avatarUrl: null,
    invited: "false",
    settings: JSON.stringify({
      privacy: { access: { hiddenFromAccountIds: ["source-account"], subscriptionIncludesPpv: false } },
      social: { followingAccountIds: ["source-account"], followingAccountTimestamps: { "source-account": "now" } },
    }),
    platform: "noodle",
    noodleAccountId: null,
    visibility: "public",
    publicAccountId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const warnings: ProfileNoodleImportWarning[] = [];
  const unrelatedMessages = [{ id: "message-1" }];
  const planned = await planProfileNoodleImport(
    db,
    {
      tables: {
        noodle_accounts: [
          {
            id: "source-account",
            kind: "character",
            entityId: "character-1",
            handle: "source_handle",
            displayName: "Imported",
            bio: "",
            avatarUrl: null,
            invited: "false",
            settings: JSON.stringify({
              privacy: { access: { hiddenFromAccountIds: ["source-account"], subscriptionIncludesPpv: false } },
              social: {
                followingAccountIds: ["source-account"],
                followingAccountTimestamps: { "source-account": "now" },
              },
            }),
            platform: "noodle",
            noodleAccountId: null,
            visibility: "public",
            publicAccountId: null,
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
        ],
        noodle_posts: [{ id: "post-1", authorAccountId: "source-account" }],
        noodle_account_subscriptions: [
          { id: "subscription-1", viewerAccountId: "source-account", creatorAccountId: "source-account" },
        ],
        noodle_post_unlocks: [{ id: "unlock-1", viewerAccountId: "source-account", postId: "post-1" }],
        noodle_interactions: [{ id: "interaction-1", actorAccountId: "source-account" }],
        noodle_activity_digests: [{ id: "digest-1", accountIds: JSON.stringify(["source-account"]) }],
        noodle_refresh_runs: [{ id: "run-1", activeAccountIds: JSON.stringify(["source-account"]) }],
        noodler_prepared_posts: [
          {
            id: "prepared-1",
            creatorAccountId: "source-account",
            // The fingerprint embeds the linked source ID, so it has to be remapped with the
            // row or reconciliation discards the restored reserve on the very next poll.
            policyFingerprint: JSON.stringify({ sourceId: "source-account", stageProfileUpdatedAt: "x" }),
          },
        ],
        noodler_creator_reply_claims: [
          { id: "claim-1", creatorAccountId: "source-account", parentInteractionId: "interaction-1" },
        ],
        messages: unrelatedMessages,
      },
    },
    warnings,
  );

  assert.equal(planned.tables.noodle_accounts?.[0]?.id, "destination-account");
  const plannedSettings = JSON.parse(String(planned.tables.noodle_accounts?.[0]?.settings));
  assert.deepEqual(plannedSettings.privacy.access.hiddenFromAccountIds, ["destination-account"]);
  assert.deepEqual(plannedSettings.social.followingAccountIds, ["destination-account"]);
  assert.deepEqual(plannedSettings.social.followingAccountTimestamps, { "destination-account": "now" });
  assert.equal(planned.tables.noodle_posts?.[0]?.authorAccountId, "destination-account");
  assert.equal(planned.tables.noodle_account_subscriptions?.[0]?.viewerAccountId, "destination-account");
  assert.equal(planned.tables.noodle_account_subscriptions?.[0]?.creatorAccountId, "destination-account");
  assert.equal(planned.tables.noodle_post_unlocks?.[0]?.viewerAccountId, "destination-account");
  assert.equal(planned.tables.noodle_interactions?.[0]?.actorAccountId, "destination-account");
  assert.equal(planned.tables.noodle_activity_digests?.[0]?.accountIds, '["destination-account"]');
  assert.equal(planned.tables.noodle_refresh_runs?.[0]?.activeAccountIds, '["destination-account"]');
  assert.equal(planned.tables.noodler_prepared_posts?.[0]?.creatorAccountId, "destination-account");
  assert.deepEqual(JSON.parse(String(planned.tables.noodler_prepared_posts?.[0]?.policyFingerprint)), {
    sourceId: "destination-account",
    stageProfileUpdatedAt: "x",
  });
  assert.equal(planned.tables.noodler_creator_reply_claims?.[0]?.creatorAccountId, "destination-account");
  assert.equal(planned.tables.messages, unrelatedMessages);
  assert.equal(warnings.length, 0);

  const conflictWarnings: ProfileNoodleImportWarning[] = [];
  const conflict = await planProfileNoodleImport(
    db,
    {
      tables: {
        noodle_accounts: [
          {
            id: "different-account",
            kind: "persona",
            entityId: "persona-1",
            handle: "source_handle",
            displayName: "Persona",
            platform: "noodle",
            settings: "{}",
          },
        ],
      },
    },
    conflictWarnings,
  );
  assert.equal(conflict.tables.noodle_accounts?.[0]?.handle, "source_handle_2");
  assert.equal(conflictWarnings.length, 1);
  assert.equal(conflictWarnings[0]?.type, "noodle_handle_conflict");

  await db.insert(noodleAccounts).values({
    id: "destination-noodler",
    kind: "character",
    entityId: "character-2",
    handle: "source_handle",
    displayName: "Destination NoodleR",
    platform: "noodler",
    noodleAccountId: "destination-account",
    settings: "{}",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await assert.rejects(
    planProfileNoodleImport(
      db,
      {
        tables: {
          noodle_accounts: [
            {
              id: "source-account",
              kind: "character",
              entityId: "character-1",
              handle: "source_handle",
              displayName: "Imported",
              platform: "noodle",
              noodleAccountId: null,
              settings: "{}",
            },
            {
              id: "source-noodler",
              kind: "persona",
              entityId: "persona-2",
              handle: "source_handle",
              displayName: "Imported NoodleR",
              platform: "noodler",
              noodleAccountId: "source-account",
              settings: "{}",
            },
          ],
        },
      },
      [],
    ),
    ProfileImportRequestError,
  );

  const duplicateIdentity = {
    id: "duplicate-1",
    kind: "persona",
    entityId: "duplicate-persona",
    handle: "duplicate_handle",
    displayName: "Duplicate",
    platform: "noodle",
    settings: "{}",
  };
  await assert.rejects(
    planProfileNoodleImport(
      db,
      { tables: { noodle_accounts: [duplicateIdentity, { ...duplicateIdentity, id: "duplicate-2" }] } },
      [],
    ),
    ProfileImportRequestError,
  );
} finally {
  const { closeDB } = await import("../../packages/server/src/db/connection.js");
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("Profile import Noodle reconciliation regression passed");
