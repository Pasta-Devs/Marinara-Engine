// Imports mark what they brought in with tags ("Imported" and its source, such as "ST"), not by renaming it
// ("Imported: X", "X (imported)") or by writing "Imported from SillyTavern" into the description. Both tags
// are optional: the import windows send { imported, source } and leaving a box unchecked leaves its tag off.
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.DISABLE_REQUEST_LOGGING = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";

const shared = await import("../../packages/shared/src/utils/import-tags.js");
const { buildApp } = await import("../../packages/server/src/app.js");
const { closeDB } = await import("../../packages/server/src/db/connection.js");

// The helpers: both tags by default, either one alone, no duplicates in any letter case.
assert.deepEqual(shared.importTagsFor("st"), ["Imported", "ST"]);
assert.deepEqual(shared.importTagsFor("backup", { imported: false }), ["Backup"]);
assert.deepEqual(shared.importTagsFor("marinara", { source: false }), ["Imported"]);
assert.deepEqual(shared.importTagsFor("st", { imported: false, source: false }), []);
assert.deepEqual(shared.withImportTags(["imported", "Fantasy"], "st"), ["imported", "Fantasy", "ST"]);
assert.deepEqual(shared.readImportTagOptions('{"imported":false}'), { imported: false, source: true });
assert.deepEqual(shared.readImportTagOptions(undefined), { imported: true, source: true });
assert.equal(shared.botBrowserSourceTag("chub:abc/123"), "Chub");
assert.equal(shared.botBrowserSourceTag("janny"), "JannyAI");

type Response = { statusCode: number; body: string };
const app = (await buildApp()) as unknown as {
  ready(): Promise<void>;
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<Response>;
};
await app.ready();

const post = async (url: string, payload: unknown) => {
  const response = await app.inject({ method: "POST", url, payload });
  assert.equal(response.statusCode, 200, response.body);
  return JSON.parse(response.body) as Record<string, any>;
};
const get = async (url: string) => {
  const response = await app.inject({ method: "GET", url });
  assert.equal(response.statusCode, 200, response.body);
  return JSON.parse(response.body) as any;
};
const tagsOf = (value: unknown) => shared.parseTagList(value);

try {
  // A SillyTavern preset keeps its own name and gets no description note.
  const stPreset = { prompts: [{ identifier: "main", name: "Main", content: "Hi", role: "system" }] };
  const preset = await post("/api/import/st-preset", { ...stPreset, __filename: "Kolache Preset" });
  assert.equal(preset.success, true, JSON.stringify(preset));
  const presetRow = await get(`/api/prompts/${preset.presetId ?? preset.id}`).catch(() => null);
  const presets = (await get("/api/prompts")) as Array<Record<string, unknown>>;
  const imported = presets.find((row) => row.name === "Kolache Preset") ?? presetRow?.preset;
  assert.ok(imported, "the preset keeps its file name, without an Imported: prefix");
  assert.equal(imported.description, "");
  assert.deepEqual(tagsOf(imported.tags), ["Imported", "ST"]);

  // Unchecking "Tag source" leaves only "Imported"; unchecking both leaves no tags.
  await post("/api/import/st-preset", { ...stPreset, __filename: "Only Imported", importTags: { source: false } });
  await post("/api/import/st-preset", {
    ...stPreset,
    __filename: "No Tags",
    importTags: { imported: false, source: false },
  });
  const after = (await get("/api/prompts")) as Array<Record<string, unknown>>;
  assert.deepEqual(tagsOf(after.find((row) => row.name === "Only Imported")?.tags), ["Imported"]);
  assert.deepEqual(tagsOf(after.find((row) => row.name === "No Tags")?.tags), []);

  // A SillyTavern World Info book: no "Imported from SillyTavern" description, tags instead.
  const book = await post("/api/import/st-lorebook", {
    entries: { 0: { key: ["castle"], content: "A castle." } },
    __filename: "Castle Lore",
  });
  assert.equal(book.success, true, JSON.stringify(book));
  const storedBook = await get(`/api/lorebooks/${book.lorebookId}`);
  assert.equal(storedBook.description, "");
  assert.deepEqual(storedBook.tags, ["Imported", "ST"]);

  // A SillyTavern card keeps its own tags and gains the import ones once.
  const card = await post("/api/import/st-character", {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: { name: "Tagged Card", description: "d", first_mes: "hi", tags: ["fantasy", "imported"] },
    importTags: { imported: true, source: true },
  });
  assert.equal(card.success, true, JSON.stringify(card));
  const storedCard = await get(`/api/characters/${card.characterId}`);
  const cardData = typeof storedCard.data === "string" ? JSON.parse(storedCard.data) : storedCard.data;
  assert.deepEqual(cardData.tags, ["fantasy", "imported", "ST"]);

  // A Marinara export is tagged with its own source.
  const envelope = {
    type: "marinara_lorebook",
    version: 1,
    data: { lorebook: { name: "Native Book", tags: ["mine"] }, entries: [] },
  };
  const native = await post("/api/import/marinara", envelope);
  assert.equal(native.success, true, JSON.stringify(native));
  assert.deepEqual((await get(`/api/lorebooks/${native.id}`)).tags, ["mine", "Imported", "Marinara"]);
} finally {
  await app.close();
  await closeDB();
}
