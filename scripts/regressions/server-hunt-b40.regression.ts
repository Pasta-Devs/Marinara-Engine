// Server hunt batch 40 (st-character.importer.ts, st-chat.importer.ts):
//   - RisuAI-shaped cards whose regex scripts sit under data.regexScripts /
//     data.regex_scripts get those scripts imported (the importer reads the
//     normalized extensions, where convertRisuToV2 lifts them),
//   - the character_book mirror keeps outlet entries (position 7 and the
//     "outlet" string) together with their outletName,
//   - a corrupt .charx is caught by importCharacterBuffer like PNG/JSON,
//   - a JSONL chat with an invalid or null header returns { error } instead
//     of throwing, and the SillyTavern bulk import reports that error for a
//     group chat instead of counting it as imported (review fix).
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b40-"));
const saved = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  LOG_LEVEL: process.env.LOG_LEVEL,
};
process.env.DATA_DIR = storageRoot;
process.env.FILE_STORAGE_DIR = join(storageRoot, "storage");
process.env.LOG_LEVEL = "silent";

try {
  const [
    { getDB, closeDB },
    { importSTCharacter, importCharX },
    { importSTChat },
    { createRegexScriptsStorage },
    { createCharactersStorage },
    { runSTBulkImport },
  ] = await Promise.all([
    import("../../packages/server/src/db/connection.js"),
    import("../../packages/server/src/services/import/st-character.importer.js"),
    import("../../packages/server/src/services/import/st-chat.importer.js"),
    import("../../packages/server/src/services/storage/regex-scripts.storage.js"),
    import("../../packages/server/src/services/storage/characters.storage.js"),
    import("../../packages/server/src/services/import/st-bulk.importer.js"),
  ]);
  const db = await getDB();
  try {
    // ── Risu card regex scripts ──
    const risuCard: Record<string, unknown> = {
      type: "character",
      data: {
        name: "Risu Regex Tester",
        description: "desc",
        firstMessage: "hi",
        regexScripts: [{ scriptName: "Risu swap", findRegex: "/foo/g", replaceString: "bar" }],
      },
    };
    const risuResult = (await importSTCharacter(risuCard, db, { importEmbeddedLorebook: false })) as {
      characterId: string;
    };
    assert.ok(risuResult.characterId, "Risu card imported");
    const scripts = (await createRegexScriptsStorage(db).list()) as Array<Record<string, unknown>>;
    const forChar = scripts.filter((s) => JSON.stringify(s).includes(risuResult.characterId));
    assert.equal(forChar.length, 1, "Risu card's regexScripts become a regex script row");

    // V2 card path still imports its extensions.regex_scripts.
    const v2Card: Record<string, unknown> = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "V2 Regex Tester",
        description: "",
        first_mes: "hi",
        extensions: { regex_scripts: [{ scriptName: "V2 swap", findRegex: "/baz/g", replaceString: "qux" }] },
        character_book: {
          name: "book",
          entries: [
            { keys: ["a"], content: "numeric outlet", position: 7, outletName: "scene", enabled: true },
            { keys: ["b"], content: "string outlet", position: "outlet", outletName: "mood", enabled: true },
            { keys: ["c"], content: "after", position: "after_char", enabled: true },
          ],
        },
      },
    };
    const v2Result = (await importSTCharacter(v2Card, db, { importEmbeddedLorebook: false })) as {
      characterId: string;
    };
    const scriptsAfter = (await createRegexScriptsStorage(db).list()) as Array<Record<string, unknown>>;
    assert.equal(
      scriptsAfter.filter((s) => JSON.stringify(s).includes(v2Result.characterId)).length,
      1,
      "V2 card regex scripts still import",
    );

    // ── Outlet entries survive the character_book mirror ──
    const stored = (await createCharactersStorage(db).getById(v2Result.characterId)) as { data: unknown } | null;
    assert.ok(stored, "V2 character stored");
    const storedData = (typeof stored.data === "string" ? JSON.parse(stored.data) : stored.data) as {
      character_book: { entries: Array<Record<string, unknown>> };
    };
    const entries = storedData.character_book.entries;
    const byContent = (content: string) => entries.find((e) => e.content === content)!;
    assert.equal(byContent("numeric outlet").position, 7, "numeric outlet position kept");
    assert.equal(byContent("numeric outlet").outletName, "scene", "outletName kept");
    assert.equal(byContent("string outlet").position, 7, "string outlet position maps to 7");
    assert.equal(byContent("string outlet").outletName, "mood");
    assert.equal(byContent("after").position, "after_char", "other positions unchanged");

    // ── Corrupt .charx: importCharX throws, the route helper catches it ──
    await assert.rejects(() => importCharX(Buffer.from("not a zip at all"), db));
    const routeSource = readFileSync(
      new URL("../../packages/server/src/routes/import.routes.ts", import.meta.url),
      "utf8",
    );
    assert.match(
      routeSource,
      /endsWith\("\.charx"\)\) \{\s*try \{\s*return await importCharX\(/,
      "importCharacterBuffer wraps the .charx branch in try/catch",
    );

    // ── JSONL chat header guard ──
    const badJson = (await importSTChat('{not json\n{"mes":"hi"}\n', db)) as { error?: string };
    assert.match(badJson.error ?? "", /header is not valid JSON/);
    const nullHeader = (await importSTChat('null\n{"mes":"hi"}\n', db)) as { error?: string };
    assert.match(nullHeader.error ?? "", /header is not an object/);

    // ── Review fix: bulk import must not count a group chat with a bad header as imported ──
    const stRoot = join(storageRoot, "st");
    const stUser = join(stRoot, "data", "default-user");
    mkdirSync(join(stUser, "characters"), { recursive: true });
    mkdirSync(join(stUser, "groups"), { recursive: true });
    mkdirSync(join(stUser, "group chats"), { recursive: true });
    writeFileSync(
      join(stUser, "groups", "grp1.json"),
      JSON.stringify({ id: "grp1", name: "Broken Group", members: [], chats: ["broken-chat", "null-chat"] }),
    );
    writeFileSync(join(stUser, "group chats", "broken-chat.jsonl"), '{not json\n{"mes":"hi"}\n');
    writeFileSync(join(stUser, "group chats", "null-chat.jsonl"), 'null\n{"mes":"hi"}\n');
    const bulk = await runSTBulkImport(
      stRoot,
      {
        characters: false,
        chats: false,
        groupChats: true,
        presets: false,
        lorebooks: false,
        backgrounds: false,
        personas: false,
      },
      db,
    );
    assert.equal(bulk.imported.groupChats, 0, "bad group chats are not counted as imported");
    assert.equal(bulk.errors.length, 2, `both bad group chats reported: ${JSON.stringify(bulk.errors)}`);
    assert.ok(bulk.errors.some((e) => /Group chat "Broken Group": Invalid JSONL: header is not valid JSON/.test(e)));
    assert.ok(bulk.errors.some((e) => /Group chat "Broken Group": Invalid JSONL: header is not an object/.test(e)));
  } finally {
    await closeDB();
  }
  console.log("server-hunt-b40 regression passed");
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(storageRoot, { recursive: true, force: true });
}
