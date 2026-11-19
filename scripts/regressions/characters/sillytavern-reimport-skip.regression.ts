// Running Import from SillyTavern again on the same folder must not add a second copy of every
// character and chat. A tester with about 3000 chats ran it several times because the first run
// looked stuck, and each run doubled the library. Covers chats imported before fingerprints existed
// (matched by name, file label and file time), changed files (imported again), and the opt-out.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DB } from "../../../packages/server/src/db/connection.js";

const fixtureRoot = mkdtempSync(join(tmpdir(), "marinara-st-reimport-"));
const dataDir = join(fixtureRoot, "data", "default-user");
process.env.DATA_DIR = join(fixtureRoot, "marinara-data");
process.env.FILE_STORAGE_DIR = join(fixtureRoot, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

let db: DB | null = null;

try {
  mkdirSync(join(dataDir, "characters"), { recursive: true });
  const card = (name: string, firstMes: string) => ({
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: { name, description: `${name} desc`, personality: "", scenario: "", first_mes: firstMes, mes_example: "" },
  });
  writeFileSync(join(dataDir, "characters", "Aria.json"), JSON.stringify(card("Aria", "Hello.")));
  writeFileSync(join(dataDir, "characters", "Bram.json"), JSON.stringify(card("Bram", "Hey.")));
  const chatFile = (character: string, file: string, lines: string[]) => {
    mkdirSync(join(dataDir, "chats", character), { recursive: true });
    const path = join(dataDir, "chats", character, file);
    writeFileSync(
      path,
      [
        { user_name: "You", character_name: character, chat_metadata: {} },
        ...lines.map((mes, index) => ({ name: index % 2 ? character : "You", is_user: index % 2 === 0, mes })),
      ]
        .map((line) => JSON.stringify(line))
        .join("\n"),
    );
    const time = new Date("2026-03-01T10:00:00.000Z");
    utimesSync(path, time, time);
    return path;
  };
  for (let index = 0; index < 5; index++) chatFile("Aria", `Aria - ${index}.jsonl`, [`hi ${index}`, `hello ${index}`]);
  chatFile("Bram", "Bram - 0.jsonl", ["yo", "sup"]);

  const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
  const { chats, characters } = await import("../../../packages/server/src/db/schema/index.js");
  const { eq } = await import("../../../packages/server/src/db/file-query.js");
  const { runSTBulkImport } = await import("../../../packages/server/src/services/import/st-bulk.importer.js");
  db = await createFileNativeDB();
  const everything = {
    characters: true,
    chats: true,
    groupChats: true,
    presets: false,
    lorebooks: false,
    backgrounds: false,
    personas: false,
  } as const;
  const count = async () => ({
    characters: (await db!.select().from(characters)).length,
    chats: (await db!.select().from(chats)).length,
  });

  const first = await runSTBulkImport(fixtureRoot, { ...everything }, db);
  assert.equal(first.success, true, first.error);
  assert.equal(first.imported.characters, 2);
  assert.equal(first.imported.chats, 6);
  const afterFirst = await count();

  const second = await runSTBulkImport(fixtureRoot, { ...everything }, db);
  assert.equal(second.imported.characters, 0, "unchanged cards are not imported twice");
  assert.equal(second.imported.chats, 0, "unchanged chat files are not imported twice");
  assert.deepEqual(second.skipped, { characters: 2, chats: 6, groupChats: 0 });
  assert.deepEqual(await count(), afterFirst, "the second run adds nothing");

  // Chats from before fingerprints: drop the stored fingerprint and they still match.
  for (const row of await db.select().from(chats)) {
    const metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    assert.equal(typeof metadata.importFingerprint, "string", "imported chats remember their file");
    delete metadata.importFingerprint;
    await db
      .update(chats)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(chats.id, row.id));
  }
  const legacy = await runSTBulkImport(fixtureRoot, { ...everything }, db);
  assert.equal(legacy.imported.chats, 0, "chats imported by older versions are recognized");

  // A chat that grew in SillyTavern since is new content and imports again.
  chatFile("Bram", "Bram - 0.jsonl", ["yo", "sup", "more"]);
  const changedPath = join(dataDir, "chats", "Bram", "Bram - 0.jsonl");
  const later = new Date("2026-04-01T10:00:00.000Z");
  utimesSync(changedPath, later, later);
  const changed = await runSTBulkImport(fixtureRoot, { ...everything }, db);
  assert.equal(changed.imported.chats, 1, "a changed chat file is imported");

  const forced = await runSTBulkImport(fixtureRoot, { ...everything, skipAlreadyImported: false }, db);
  assert.equal(forced.imported.chats, 6, "turning the option off imports everything again");
  assert.equal(forced.skipped, undefined);

  console.info("SillyTavern re-import skip regression passed.");
} finally {
  await db?._fileStore.close();
  rmSync(fixtureRoot, { recursive: true, force: true });
}
