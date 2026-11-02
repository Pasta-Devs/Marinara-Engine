import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "../../packages/server/src/db/file-query.js";
import { appSettings, personas } from "../../packages/server/src/db/schema/index.js";
import {
  migrateLegacyPersonaRow,
  personaRowNeedsCardMigration,
} from "../../packages/server/src/db/persona-card-migration.js";
import { MariDbService } from "../../packages/server/src/services/mari-db/mari-db.service.js";
import { projectPersona } from "../../packages/server/src/services/personas/persona-projector.js";
import {
  completePersonaRow,
  personaRowFromStored,
  storedPersonaFromRow,
  type PersonaStorageRow,
  type StoredPersonaRow,
} from "../../packages/server/src/services/personas/persona-card-storage.js";

process.env.NODE_ENV = "production";
const { createFileNativeDB, encodeShardKey, STORAGE_VERSION, StorageFormatTooNewError } =
  await import("../../packages/server/src/db/file-backed-store.js");

const previousStorageDir = process.env.FILE_STORAGE_DIR;
const roots: string[] = [];

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "marinara-persona-v11-"));
  roots.push(root);
  process.env.FILE_STORAGE_DIR = root;
  return root;
}

const shardDir = (root: string) => join(root, "tables", "personas");
const shardPath = (root: string, id: string) => join(shardDir(root), `${encodeShardKey(id)}.json`);
const readManifest = (root: string) => JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

/** A flat format-10 persona row with every authored column set to a distinct value. */
function legacyRow(id: string, name: string): PersonaStorageRow {
  return completePersonaRow({
    id,
    name,
    comment: `${name} comment`,
    creator: "Ylli",
    personaVersion: "2.1",
    versioningEnabled: "true",
    creatorNotes: "notes",
    phoneticName: "fo-NET-ik",
    cardFieldAlternatives: JSON.stringify([
      { id: "alt-1", field: "description", label: "Short", value: "short", active: false },
    ]),
    summary: "a summary",
    mes_example: "<START>\n{{user}}: hi",
    description: `${name} description`,
    personality: "curious",
    scenario: "a scenario",
    backstory: "a backstory",
    appearance: "tall",
    imageAppearanceEnabled: "true",
    imageAppearance: "tall, red coat",
    avatarPath: `avatars/${id}.png`,
    characterSheetImageId: "sheet-1",
    useCharacterSheetAsReference: "true",
    avatarCrop: JSON.stringify({ zoom: 1.5, offsetX: 0.1, offsetY: -0.2 }),
    isActive: "true",
    nameColor: "#ff0000",
    dialogueColor: "#00ff00",
    boxColor: "#0000ff",
    trackerCardColors: JSON.stringify({ mode: "chat" }),
    personaStats: JSON.stringify({ enabled: false, bars: [] }),
    tags: JSON.stringify(["hero", "test"]),
    savedStatusOptions: JSON.stringify(["online"]),
    convoDisplayName: `${name} (convo)`,
    aboutMe: "about me",
    convoBehavior: "chatty",
    embedding: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  });
}

/** Build a booted store, then rewrite it on disk as format 10 with flat persona shards. */
async function writeFormat10Profile(rows: Array<Record<string, unknown>>) {
  const root = tempRoot();
  const db = await createFileNativeDB();
  // An untouched store writes no manifest; one row makes the first flush land it.
  await db.insert(appSettings).values({ key: "fixture", value: "v10", updatedAt: "2026-10-01" });
  await db._fileStore.close();
  mkdirSync(shardDir(root), { recursive: true });
  for (const row of rows) writeFileSync(shardPath(root, String(row.id)), JSON.stringify([row], null, 2));
  const manifest = readManifest(root);
  manifest.version = 10;
  manifest.tables = { ...manifest.tables, personas: rows.length };
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
  return root;
}

const preV11Files = (root: string) =>
  existsSync(shardDir(root))
    ? readdirSync(shardDir(root))
        .filter((name) => name.includes(".pre-v11"))
        .sort()
    : [];

try {
  assert.equal(STORAGE_VERSION, 11, "format 11 is the persona card format");

  // 1. A format-10 profile converts on boot: same flat view, originals preserved byte-for-byte.
  {
    const ada = legacyRow("persona-ada", "Ada");
    const bo = legacyRow("persona-bo", "Bo");
    const root = await writeFormat10Profile([ada, bo]);
    const originals = new Map([ada, bo].map((row) => [row.id, readFileSync(shardPath(root, row.id))]));

    const db = await createFileNativeDB();
    for (const row of [ada, bo]) {
      const [stored] = await db.select().from(personas).where(eq(personas.id, row.id));
      assert.ok(stored, `${row.id} survives the migration`);
      assert.equal(typeof stored.data, "string", "the row now carries a card");
      assert.deepEqual(
        projectPersona(personaRowFromStored(stored as StoredPersonaRow)),
        projectPersona(row),
        `${row.id} reads back with every authored field`,
      );
    }
    await db._fileStore.close();

    for (const [id, bytes] of originals) {
      const copy = `${shardPath(root, id)}.pre-v11`;
      assert.ok(existsSync(copy), `${id} keeps a .pre-v11 copy`);
      assert.ok(readFileSync(copy).equals(bytes), `${id}'s .pre-v11 copy is byte-identical to the original`);
      const [onDisk] = JSON.parse(readFileSync(shardPath(root, id), "utf8")) as Array<Record<string, unknown>>;
      assert.equal(typeof onDisk?.data, "string", `${id}'s shard is rewritten with a card`);
      assert.equal(onDisk?.description, undefined, `${id}'s shard no longer holds flat authored columns`);
    }
    assert.equal(readManifest(root).version, 11, "the manifest moves to format 11 after the flush");
    const check = await createFileNativeDB();
    const [noticeRow] = await check.select().from(appSettings).where(eq(appSettings.key, "storage-migration-notice"));
    await check._fileStore.close();
    const notice = JSON.parse(String(noticeRow?.value ?? "{}")) as { fromFormat?: number; migratedTables?: string[] };
    assert.equal(notice.fromFormat, 10, "the migration notice names the old format");
    assert.ok(notice.migratedTables?.includes("personas"), "the migration notice lists personas");

    // 2. A second boot changes nothing and makes no new copies.
    const copiesBefore = preV11Files(root);
    const shardBefore = readFileSync(shardPath(root, ada.id), "utf8");
    const again = await createFileNativeDB();
    await again._fileStore.close();
    assert.deepEqual(preV11Files(root), copiesBefore, "a second boot makes no new .pre-v11 copies");
    assert.equal(readFileSync(shardPath(root, ada.id), "utf8"), shardBefore, "a second boot leaves the shard alone");
  }

  // 3. A crash before the first flush re-runs the conversion without duplicating the copy.
  {
    const row = legacyRow("persona-crash", "Crash");
    const root = await writeFormat10Profile([row]);
    const original = readFileSync(shardPath(root, row.id));
    // Simulate the crashed boot: the copy was made, the shard was never rewritten.
    writeFileSync(`${shardPath(root, row.id)}.pre-v11`, original);
    const db = await createFileNativeDB();
    await db._fileStore.close();
    assert.deepEqual(
      preV11Files(root),
      [`${encodeShardKey(row.id)}.json.pre-v11`],
      "an identical existing copy is not duplicated",
    );
    assert.ok(readFileSync(`${shardPath(root, row.id)}.pre-v11`).equals(original));
  }

  // 4. A different existing copy is never clobbered; the new one gets a timestamped name.
  {
    const row = legacyRow("persona-clobber", "Clobber");
    const root = await writeFormat10Profile([row]);
    writeFileSync(`${shardPath(root, row.id)}.pre-v11`, "older copy");
    const db = await createFileNativeDB();
    await db._fileStore.close();
    const copies = preV11Files(root);
    assert.equal(copies.length, 2, "the older copy stays and a second one is added");
    assert.equal(readFileSync(`${shardPath(root, row.id)}.pre-v11`, "utf8"), "older copy");
  }

  // 5. Rows keyed by db column names (hand-edited or very old) convert too.
  {
    const flat = legacyRow("persona-snake", "Snake");
    const snake: Record<string, unknown> = {
      id: flat.id,
      name: flat.name,
      description: flat.description,
      creator_notes: flat.creatorNotes,
      mes_example: flat.mes_example,
      avatar_path: flat.avatarPath,
      is_active: flat.isActive,
      tags: ["parsed", "array"],
      created_at: flat.createdAt,
      updated_at: flat.updatedAt,
    };
    const migrated = migrateLegacyPersonaRow(snake) as StoredPersonaRow;
    const view = personaRowFromStored(migrated);
    assert.equal(view.creatorNotes, flat.creatorNotes);
    assert.equal(view.mes_example, flat.mes_example);
    assert.equal(view.avatarPath, flat.avatarPath);
    assert.equal(view.isActive, "true");
    assert.equal(view.createdAt, flat.createdAt);
    assert.deepEqual(JSON.parse(view.tags), ["parsed", "array"], "a parsed JSON value is stringified first");
  }

  // 6. The converter profile import calls (backup.routes.ts) is idempotent and keeps every field.
  {
    const flat = legacyRow("persona-import", "Import");
    assert.equal(personaRowNeedsCardMigration(flat), true);
    const migrated = migrateLegacyPersonaRow(flat);
    assert.equal(personaRowNeedsCardMigration(migrated), false);
    assert.equal(migrateLegacyPersonaRow(migrated), migrated, "the conversion is idempotent");
    assert.deepEqual(projectPersona(personaRowFromStored(migrated as StoredPersonaRow)), projectPersona(flat));
  }

  // 7. This build refuses a newer format than its own, as shipped format-10 builds refuse 11.
  {
    const root = await writeFormat10Profile([]);
    const manifest = readManifest(root);
    manifest.version = STORAGE_VERSION + 1;
    writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
    await assert.rejects(createFileNativeDB(), StorageFormatTooNewError, "a newer format is refused, not rewritten");
  }

  // 8. A save failing after the persona rewrite cannot leave format-11 shards under a format-10
  //    manifest: the version is raised before any persona shard is written.
  {
    const row = legacyRow("persona-failed-flush", "Failed");
    const root = await writeFormat10Profile([row]);
    let failed = false;
    try {
      const db = await createFileNativeDB({
        beforeTableWrite: (table) => {
          if (table.startsWith("personas")) throw new Error("injected persona write failure");
        },
      });
      await db._fileStore.close();
    } catch {
      failed = true;
    }
    assert.equal(failed, true, "the injected write failure stops the first boot");
    assert.equal(readManifest(root).version, 11, "the manifest already says 11, so older builds refuse the profile");
    const db = await createFileNativeDB();
    const [stored] = await db.select().from(personas).where(eq(personas.id, row.id));
    await db._fileStore.close();
    assert.deepEqual(
      projectPersona(personaRowFromStored(stored as StoredPersonaRow)),
      projectPersona(row),
      "the next boot finishes the conversion",
    );
    assert.deepEqual(preV11Files(root), [`${encodeShardKey(row.id)}.json.pre-v11`], "still one copy");
  }

  // 9. A shard's .bak gets its own byte-identical copy.
  {
    const row = legacyRow("persona-bak", "Bak");
    const root = await writeFormat10Profile([row]);
    const older = JSON.stringify([{ ...row, description: "older description" }], null, 2);
    writeFileSync(`${shardPath(root, row.id)}.bak`, older);
    const db = await createFileNativeDB();
    await db._fileStore.close();
    assert.equal(readFileSync(`${shardPath(root, row.id)}.bak.pre-v11`, "utf8"), older, "the .bak is preserved too");
  }

  // 10. A persona row without an id cannot be converted, so it never counts as a pending migration.
  {
    assert.equal(personaRowNeedsCardMigration({ name: "Ghost", description: "no id" }), false);
    const root = await writeFormat10Profile([]);
    writeFileSync(join(shardDir(root), "ghost.json"), JSON.stringify([{ name: "Ghost" }]));
    const db = await createFileNativeDB();
    await db._fileStore.close();
    assert.deepEqual(preV11Files(root), [], "an unconvertible row triggers no copy");
  }

  // 11. A Mari review saved before the upgrade holds flat persona snapshots; Restore must still
  //     bring back the authored fields, not just the record columns.
  {
    const row = legacyRow("persona-review", "Review");
    const root = tempRoot();
    const db = await createFileNativeDB();
    await db.insert(personas).values(storedPersonaFromRow(row));
    const mari = new MariDbService(db);
    const edited = await mari.executeAction({
      action: "persona.update",
      personaId: row.id,
      data: { description: "edited by Mari" },
      apply: true,
    });
    assert.equal(edited.ok, true);
    const reviewId = edited.approval?.id;
    assert.ok(reviewId, "the edit leaves a pending review");
    const sidecar = join(root, "journal", "pending", `${reviewId}.json`);
    const record = JSON.parse(readFileSync(sidecar, "utf8"));
    // Rewrite the sidecar as a format-10 build would have saved it.
    for (const change of record.plan.changes) {
      if (change.table !== "personas") continue;
      if (change.beforeRaw) change.beforeRaw = personaRowFromStored(change.beforeRaw);
      if (change.afterRaw) change.afterRaw = personaRowFromStored(change.afterRaw);
    }
    writeFileSync(sidecar, JSON.stringify(record));
    const restarted = new MariDbService(db);
    await restarted.restoreAppliedReview(reviewId);
    const [restored] = await db.select().from(personas).where(eq(personas.id, row.id));
    await db._fileStore.close();
    assert.equal(
      restored && personaRowFromStored(restored as StoredPersonaRow).description,
      row.description,
      "Restore of a pre-upgrade review brings back the authored description",
    );
  }

  console.info("Persona card migration regression passed.");
} finally {
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}
