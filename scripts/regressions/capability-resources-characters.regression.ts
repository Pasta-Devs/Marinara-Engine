/**
 * Capability API 1.819 (Pasta-Devs/Marinara-Engine#9035): characters on `api.runtime.resources`, so packages stop
 * bundling the Engine's characters storage. Full rows, groups, the library page and summaries match storage; the
 * extensions write merges keys without touching the card's authored fields or taking a version, needs
 * `character-write`, and queues behind an Engine save of the same card. The bundled chats and lorebooks storage
 * reach characters only through the characters storage, never the tables.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CharacterData } from "../../packages/shared/src/index.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-resources-characters-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createCapabilityResourceHost } =
  await import("../../packages/server/src/services/capability-packages/capability-resources.service.js");
const { createCharactersStorage, withCharacterUpdateQueue } =
  await import("../../packages/server/src/services/storage/characters.storage.js");
const { supportedCapabilityApi, capabilityPackageManifestSchema } =
  await import("../../packages/shared/src/schemas/capability-package.schema.js");

assert.ok(supportedCapabilityApi.major === 1 && supportedCapabilityApi.minor >= 819, "characters ship as 1.819");

const db = await getDB();
try {
  const storage = createCharactersStorage(db);
  const card = (name: string, extensions: Record<string, unknown> = {}) =>
    ({ name, description: `${name} description`, extensions }) as unknown as CharacterData;
  const ada = await storage.create(card("Ada", { keep: "me", characterMemories: [] }), "avatars/ada.png", null, "c1");
  const bo = await storage.create(card("Bo"));
  assert.ok(ada && bo);
  const group = await storage.createGroup("Pair", "two of them", [ada.id, bo.id]);
  assert.ok(group);

  const reader = createCapabilityResourceHost(db, ["storage"]);
  const writer = createCapabilityResourceHost(db, ["character-write"]);

  // Full rows: the fields packages read, `data` as stored, unknown ids left out, requested order kept.
  const rows = await reader.getCharacters!([bo.id, "missing", ada.id]);
  assert.deepEqual(
    rows.map((row) => row.id),
    [bo.id, ada.id],
  );
  assert.deepEqual(rows[1], {
    id: ada.id,
    data: ada.data,
    comment: "c1",
    avatarPath: "avatars/ada.png",
    createdAt: ada.createdAt,
    updatedAt: ada.updatedAt,
  });
  const everyone = await reader.getCharacters!();
  assert.deepEqual(everyone.map((row) => row.id).sort(), (await storage.list()).map((row) => row.id).sort());

  // Groups, the library page and summaries are storage's own.
  const groups = await reader.listCharacterGroups!();
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.name, "Pair");
  assert.deepEqual(JSON.parse(groups[0]!.characterIds), [ada.id, bo.id]);
  const page = await reader.listCharactersPage!({ limit: 1, offset: 0, search: "Ada", sort: "name-asc" });
  assert.deepEqual(
    page.items.map((row) => row.id),
    [ada.id],
  );
  assert.equal(page.items[0]!.avatarPath, "avatars/ada.png");
  assert.deepEqual(
    await reader.listCharacterSummaries!([ada.id, bo.id]),
    await storage.listSummariesByIds([ada.id, bo.id]),
  );

  // The write needs `character-write`.
  await assert.rejects(reader.updateCharacterExtensions!(ada.id, { characterMemories: [1] }), /character-write/);

  // It merges keys: other extensions and the authored card stay, no version is taken.
  const versionsBefore = (await storage.listVersions(ada.id)).length;
  const updated = await writer.updateCharacterExtensions!(ada.id, { characterMemories: [{ summary: "met Bo" }] });
  assert.ok(updated);
  const updatedData = JSON.parse(updated.data) as {
    name: string;
    description: string;
    extensions: Record<string, unknown>;
  };
  assert.equal(updatedData.name, "Ada");
  assert.equal(updatedData.description, "Ada description");
  assert.equal(updatedData.extensions.keep, "me");
  assert.deepEqual(updatedData.extensions.characterMemories, [{ summary: "met Bo" }]);
  assert.equal((await storage.listVersions(ada.id)).length, versionsBefore);
  assert.equal(await writer.updateCharacterExtensions!("missing", { x: 1 }), null);

  // Queued behind an Engine save of the same card: both writes land.
  let releaseRouteSave!: () => void;
  const routeSave = withCharacterUpdateQueue(ada.id, async () => {
    await new Promise<void>((resolve) => (releaseRouteSave = resolve));
    const current = JSON.parse((await storage.getById(ada.id))!.data) as { extensions: Record<string, unknown> };
    await storage.update(ada.id, { extensions: { ...current.extensions, fromRoute: true } } as never);
  });
  const packageWrite = writer.updateCharacterExtensions!(ada.id, { fromPackage: true });
  releaseRouteSave();
  await Promise.all([routeSave, packageWrite]);
  const both = JSON.parse((await storage.getById(ada.id))!.data) as { extensions: Record<string, unknown> };
  assert.equal(both.extensions.fromRoute, true);
  assert.equal(both.extensions.fromPackage, true);

  // `onlyMissingKeys` (the legacy chat hoists) leaves a key the card already has, null included.
  const hoisted = await storage.updateExtensions(ada.id, { keep: "overwritten", fresh: 1 }, { onlyMissingKeys: true });
  assert.deepEqual(hoisted?.changedKeys, ["fresh"]);
  assert.equal((JSON.parse(hoisted!.row.data) as { extensions: Record<string, unknown> }).extensions.keep, "me");

  // The permission needs a manifest that declares 1.819.
  const manifest = {
    schemaVersion: 2 as const,
    id: "character-writer",
    name: "Character writer",
    version: "1.0.0",
    engine: { min: "2.4.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    capabilityApi: { major: 1, minor: 819 },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "a".repeat(40) },
    entrypoints: { server: "server.mjs" },
    files: [{ path: "server.mjs", sha256: "b".repeat(64), bytes: 10 }],
    permissions: ["character-write"],
  };
  assert.doesNotThrow(() => capabilityPackageManifestSchema.parse(manifest));
  assert.throws(
    () => capabilityPackageManifestSchema.parse({ ...manifest, capabilityApi: { major: 1, minor: 818 } }),
    /character-write\W+ permission requires schemaVersion 2 and capabilityApi 1\.819 or newer/,
  );

  // A package bundles chats and lorebooks storage; they must not read the character tables behind the storage's back.
  for (const file of ["chats.storage.ts", "lorebooks.storage.ts"]) {
    const source = readFileSync(join(import.meta.dirname, "../../packages/server/src/services/storage", file), "utf8");
    assert.doesNotMatch(
      source,
      /\.(?:from|update)\((?:characters|personas)\)/,
      `${file} reads a character table directly`,
    );
  }
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
