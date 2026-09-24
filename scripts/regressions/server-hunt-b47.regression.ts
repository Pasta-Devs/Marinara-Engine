import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-hunt-b47-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema, nameToXmlTag } = await import("../../packages/shared/dist/index.js");
const { wrapContent, wrapGroup } = await import("../../packages/server/src/services/prompt/format-engine.js");
const { expandMarker } = await import("../../packages/server/src/services/prompt/marker-expander.js");
const { extractCharacterReferenceIds, collectCharacterDepthPromptEntries, collectCharacterPostHistoryEntries } =
  await import("../../packages/server/src/services/prompt/macro-context.js");

const db = await getDB();
try {
  // 1. Final assembler filter keeps attachment-only and reasoning-metadata messages.
  const assemblerSource = readFileSync(
    new URL("../../packages/server/src/services/prompt/assembler.ts", import.meta.url),
    "utf8",
  );
  assert.equal(
    assemblerSource.includes("finalMessages = finalMessages.filter((m) => m.content?.trim());"),
    false,
    "final filter must not drop image/file-only messages",
  );
  assert.match(
    assemblerSource,
    /finalMessages = finalMessages\.filter\(\s*\(m\) =>\s*m\.content\?\.trim\(\) \|\| m\.images\?\.length \|\| m\.files\?\.length/,
  );

  // 2. Reference extraction skips excluded ids before counting toward the cap.
  const makeId = (n: number) => `ref${String(n).padStart(18, "0")}`;
  const known = Array.from({ length: 8 }, (_, i) => makeId(i));
  const fresh = makeId(99);
  const source = [...known, fresh].map((id) => `{{${id}}}`).join(" ");
  assert.deepEqual(extractCharacterReferenceIds([source], new Set(known)), [fresh]);
  assert.equal(extractCharacterReferenceIds([source]).length, 8);

  // 3. Wrapper tags survive non-ASCII and missing names.
  assert.equal(nameToXmlTag("דנה"), "דנה");
  assert.equal(nameToXmlTag("花子 Mori"), "花子_mori");
  assert.equal(nameToXmlTag(undefined), "");
  assert.equal(wrapContent("x", "", "xml"), "<section>\n    x\n</section>");
  assert.equal(wrapContent("x", "花子", "markdown", 1), "### 花子\nx");
  assert.equal(wrapContent("x", "!!", "markdown"), "## Section\nx");
  assert.equal(wrapGroup("x", "", "xml"), "<section>\n    x\n</section>");

  const characters = createCharactersStorage(db);
  const alpha = await characters.create(
    characterDataSchema.parse({
      name: "Alpha",
      first_mes: "",
      description: "ALPHA_DESC",
      extensions: { phoneticName: "Al-fah" },
    }),
  );
  const hebrew = await characters.create(
    characterDataSchema.parse({
      name: "דנה",
      first_mes: "",
      description: "DANA_DESC says {{charPhonetic}}",
      post_history_instructions: "POST {{charPhonetic}}",
      extensions: { depth_prompt: { prompt: "DEPTH {{charPhonetic}}", depth: 2, role: "system" } },
    }),
  );
  const phonetic = await characters.create(
    characterDataSchema.parse({
      name: "Beta",
      first_mes: "",
      description: "BETA_DESC says {{charPhonetic}}",
      extensions: { phoneticName: "Bay-tah" },
    }),
  );
  assert.ok(alpha && hebrew && phonetic);

  const macroCtx = {
    user: "Player",
    char: "Alpha",
    charPhonetic: "Al-fah",
    characters: ["Alpha", "דנה", "Beta"],
    variables: {},
  };

  // 4. Per-character depth and post-history prompts scope {{charPhonetic}} to that character.
  const depth = await collectCharacterDepthPromptEntries(db, [alpha.id, hebrew.id], macroCtx as never);
  assert.deepEqual(
    depth.map((entry) => entry.content),
    ["DEPTH דנה"],
  );
  const post = await collectCharacterPostHistoryEntries(db, [alpha.id, hebrew.id], macroCtx as never, "none");
  assert.equal(post.length, 1);
  assert.match(post[0]!.content, /POST דנה/);
  assert.equal(post[0]!.content.includes("Al-fah"), false);

  // 5. Character Info marker: non-empty per-character tags and scoped {{charPhonetic}}.
  const expanded = await expandMarker(
    { type: "character" },
    {
      db,
      chatId: "chat-b47",
      characterIds: [alpha.id, hebrew.id, phonetic.id],
      chatMessages: [],
      chatSummary: null,
      wrapFormat: "xml",
      enableAgents: false,
      activeAgentIds: [],
      activeLorebookIds: [],
      macroCtx: macroCtx as never,
    } as never,
  );
  assert.equal(expanded.content.includes("<>"), false, expanded.content);
  assert.match(expanded.content, /<דנה>[\s\S]*DANA_DESC says דנה[\s\S]*<\/דנה>/);
  assert.match(expanded.content, /<beta>[\s\S]*BETA_DESC says Bay-tah[\s\S]*<\/beta>/);
  assert.equal(expanded.content.includes("says Al-fah"), false);

  console.log("server-hunt-b47 regression passed");
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
