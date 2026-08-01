import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateLegacyNoodleAccountRow } from "../../packages/server/src/db/noodle-platform-migration.js";
import { migrateLegacyNoodlePostAccessRow } from "../../packages/server/src/db/noodle-access-migration.js";

// ── Pure migration ────────────────────────────────────────────────
// A legacy NoodleR profile must survive as one. Without the rename it would fall
// back to the schema default and leak into the public Noodle timeline.
// The legacy keys must SURVIVE: an older build reads them, and stripping them would make a
// downgrade republish NoodleR accounts onto the public Noodle timeline.
assert.deepEqual(migrateLegacyNoodleAccountRow({ id: "a", visibility: "private", publicAccountId: "pub-1" }), {
  id: "a",
  platform: "noodler",
  noodleAccountId: "pub-1",
  visibility: "private",
  publicAccountId: "pub-1",
});
assert.deepEqual(migrateLegacyNoodleAccountRow({ id: "b", visibility: "public", publicAccountId: null }), {
  id: "b",
  platform: "noodle",
  noodleAccountId: null,
  visibility: "public",
  publicAccountId: null,
});
// A row with neither key predates the split entirely: it is a Noodle account.
assert.deepEqual(migrateLegacyNoodleAccountRow({ id: "c" }), { id: "c", platform: "noodle" });
// Idempotent: already-migrated rows are returned untouched.
const migrated = { id: "d", platform: "noodler", noodleAccountId: "pub-2" };
assert.equal(migrateLegacyNoodleAccountRow(migrated), migrated);

assert.deepEqual(
  migrateLegacyNoodlePostAccessRow({ id: "public", access: "public", ppvPrice: 5 }),
  { id: "public", access: "public" },
);
assert.deepEqual(
  migrateLegacyNoodlePostAccessRow({ id: "subscriber", access: "subscriber", ppvPrice: 5 }),
  { id: "subscriber", access: "locked" },
);
assert.deepEqual(
  migrateLegacyNoodlePostAccessRow({ id: "ppv", access: "ppv", ppv_price: 7 }),
  { id: "ppv", access: "locked" },
);
assert.deepEqual(
  migrateLegacyNoodlePostAccessRow({ id: "unknown", access: "corrupt" }),
  { id: "unknown", access: "locked" },
);

// ── End to end through the file store ─────────────────────────────
const storageDir = mkdtempSync(join(tmpdir(), "marinara-noodle-platform-"));
process.env.FILE_STORAGE_DIR = storageDir;
// Closed in `finally`, not on the success path: a failed assertion must not leave the file
// store holding the temp dir rmSync is about to delete.
let closeStore: (() => Promise<void>) | null = null;
try {
  mkdirSync(join(storageDir, "tables"), { recursive: true });
  writeFileSync(
    join(storageDir, "tables", "noodle_accounts.json"),
    JSON.stringify([
      {
        id: "acct-noodle",
        kind: "persona",
        entityId: "p1",
        handle: "shared_handle",
        displayName: "Public",
        bio: "",
        invited: "true",
        settings: "{}",
        visibility: "public",
        publicAccountId: null,
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "acct-noodler",
        kind: "persona",
        entityId: "p1",
        handle: "shared_handle",
        displayName: "Stage",
        bio: "",
        invited: "false",
        settings: "{}",
        visibility: "private",
        publicAccountId: "acct-noodle",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ]),
  );

  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const { createNoodleStorage } = await import("../../packages/server/src/services/storage/noodle.storage.js");
  const db = await createFileNativeDB();
  closeStore = () => db._fileStore.close();
  const noodle = createNoodleStorage(db as never);

  // The legacy private row must not appear as a Noodle account...
  const noodleAccountIds = (await noodle.listAccounts()).map((account) => account.id);
  assert.deepEqual(noodleAccountIds, ["acct-noodle"]);
  // ...and must still resolve as the NoodleR profile linked to its Noodle account.
  const stageProfile = await noodle.getNoodlerAccountForNoodleAccount("acct-noodle");
  assert.equal(stageProfile?.id, "acct-noodler");
  assert.equal(stageProfile?.platform, "noodler");
  assert.equal(stageProfile?.noodleAccountId, "acct-noodle");

  // Restore path: the backup importer inserts snapshot rows directly, bypassing the loader
  // migration. Without migrating there, a restored pre-rename NoodleR account picks up the
  // `platform: "noodle"` column default and lands on the Noodle timeline.
  const { noodleAccounts } = await import("../../packages/server/src/db/schema/noodle.js");
  const importedLegacyRow = {
    id: "acct-imported",
    kind: "persona",
    entityId: "p2",
    handle: "imported_handle",
    displayName: "Imported Stage",
    bio: "",
    invited: "false",
    settings: "{}",
    visibility: "private",
    publicAccountId: null,
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  };
  await db
    .insert(noodleAccounts)
    .values(migrateLegacyNoodleAccountRow(importedLegacyRow) as never)
    .onConflictDoUpdate({
      target: noodleAccounts.id,
      set: migrateLegacyNoodleAccountRow(importedLegacyRow) as never,
    });
  const idsAfterImport = (await noodle.listAccounts()).map((account) => account.id);
  assert.deepEqual(idsAfterImport, ["acct-noodle"]);
  assert.equal((await noodle.getNoodlerAccountById("acct-imported"))?.platform, "noodler");
} finally {
  await closeStore?.();
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("Noodle platform migration regression passed.\n");
