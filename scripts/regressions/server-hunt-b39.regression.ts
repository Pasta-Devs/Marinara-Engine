// Regression: ST bulk import folder scan.
// 1. Preset folders listed under two spellings ("OpenAI Settings" / "openai settings") must not
//    produce duplicate presets when they resolve to the same directory (case-insensitive FS).
// 2. The chat scan reads only the header line instead of the whole JSONL file.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = await mkdtemp(join(tmpdir(), "marinara-b39-data-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = `${process.env.DATA_DIR}/storage`; // never the live store named in .env
process.env.LOG_LEVEL = "silent";

const stRoot = await mkdtemp(join(tmpdir(), "marinara-b39-st-"));
try {
  const user = join(stRoot, "data", "default-user");
  await mkdir(join(user, "characters"), { recursive: true });
  await mkdir(join(user, "OpenAI Settings"), { recursive: true });
  await mkdir(join(user, "TextGen Settings"), { recursive: true });
  await writeFile(join(user, "OpenAI Settings", "My Preset.json"), JSON.stringify({ name: "My Preset" }));
  await writeFile(join(user, "TextGen Settings", "Tg Preset.json"), JSON.stringify({ name: "Tg Preset" }));

  // Chat whose header is larger than 64KB, followed by a message line.
  await mkdir(join(user, "chats", "Alice"), { recursive: true });
  const header = { character_name: "Alice", chat_metadata: { note: "x".repeat(100_000) } };
  await writeFile(
    join(user, "chats", "Alice", "Big Chat.jsonl"),
    JSON.stringify(header) + "\r\n" + JSON.stringify({ name: "Alice", mes: "hi" }) + "\n",
  );

  // Review fix: a header holding raw U+2028 / U+2029 (JSON.stringify leaves them unescaped)
  // must still parse; readline would cut the line there and the chat would vanish from the scan.
  await mkdir(join(user, "chats", "Bob"), { recursive: true });
  const sepHeader = { character_name: "Bob", chat_metadata: { note: "line\u2028break\u2029para" } };
  const sepHeaderLine = JSON.stringify(sepHeader);
  assert.ok(sepHeaderLine.includes("\u2028"), "fixture keeps the raw separator");
  await writeFile(
    join(user, "chats", "Bob", "Separator Chat.jsonl"),
    sepHeaderLine + "\r\n" + JSON.stringify({ name: "Bob", mes: "hi" }) + "\n",
  );

  const { scanSTFolder } = await import("../../packages/server/src/services/import/st-bulk.importer.js");
  const result = await scanSTFolder(stRoot);
  assert.ok(result.success, "scan should succeed");

  const presetNames = result.presets.map((p) => p.name).sort();
  assert.deepEqual(
    presetNames,
    ["My Preset", "Tg Preset"],
    `each preset listed once, got ${JSON.stringify(presetNames)}`,
  );
  assert.equal(new Set(result.presets.map((p) => p.id)).size, result.presets.length);

  const chatNames = result.chats.map((c) => c.characterName).sort();
  assert.deepEqual(
    chatNames,
    ["Alice", "Bob"],
    `large-header and U+2028-header chats are scanned, got ${JSON.stringify(chatNames)}`,
  );

  const source = await readFile(
    fileURLToPath(new URL("../../packages/server/src/services/import/st-bulk.importer.ts", import.meta.url)),
    "utf-8",
  );
  assert.ok(!source.includes('content.split("\n")[0]'), "chat scan must not read the whole file to get the header");
  assert.ok(source.includes("readFirstLine(f)"), "chat scan reads only the first line");
  assert.ok(!source.includes("createInterface"), "first-line read must not use readline (it splits on U+2028)");

  console.log("server-hunt-b39 regression passed");
} finally {
  await rm(stRoot, { recursive: true, force: true });
  await rm(dataDir, { recursive: true, force: true });
}
