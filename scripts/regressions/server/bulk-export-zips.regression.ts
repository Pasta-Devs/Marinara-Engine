// Bulk export ZIPs keep every selected item: items that share a name get numbered files instead of
// replacing each other, and the bulk chat export streams one transcript at a time (#7115) with the
// same files and manifest as before.
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.DISABLE_REQUEST_LOGGING = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";

const { default: AdmZip } = await import("../../../packages/server/node_modules/adm-zip/adm-zip.js");
const { buildApp } = await import("../../../packages/server/src/app.js");
const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema } = await import("../../../packages/shared/src/index.ts");

type Response = { statusCode: number; headers: Record<string, unknown>; rawPayload: Buffer; body: string };
const app = (await buildApp()) as unknown as {
  ready(): Promise<void>;
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<Response>;
};
await app.ready();
const entriesOf = (response: Response) => {
  assert.equal(response.statusCode, 200, response.body);
  return new AdmZip(response.rawPayload).getEntries().map((entry) => ({
    name: entry.entryName,
    text: entry.getData().toString("utf8"),
  }));
};
try {
  const db = await getDB();

  // ── Lorebooks: two books named "World" both reach the archive, in both formats ──
  const lorebooks = createLorebooksStorage(db);
  const worlds = [];
  for (const content of ["First world", "Second world"]) {
    const book = (await lorebooks.create({ name: "World" }))!;
    await lorebooks.createEntry({ lorebookId: book.id, name: "Place", keys: ["place"], content });
    worlds.push(book.id);
  }
  for (const [format, extension] of [
    ["native", "marinara.json"],
    ["compatible", "json"],
  ] as const) {
    const files = entriesOf(
      await app.inject({ method: "POST", url: "/api/lorebooks/export-bulk", payload: { ids: worlds, format } }),
    );
    const byName = new Map(files.map((file) => [file.name, file.text]));
    assert.equal(byName.size, 2, `${format} lorebook export keeps both books`);
    assert.match(byName.get(`World.${extension}`)!, /First world/);
    assert.match(byName.get(`World (2).${extension}`)!, /Second world/);
  }

  // ── Presets: two presets named "My Preset" get separate folders ──
  const prompts = createPromptsStorage(db);
  const presetIds = [];
  for (const description of ["First preset", "Second preset"]) {
    presetIds.push((await prompts.create({ name: "My Preset", description }))!.id);
  }
  const presetFiles = entriesOf(
    await app.inject({ method: "POST", url: "/api/prompts/export-bulk", payload: { ids: presetIds } }),
  );
  const presetsByName = new Map(presetFiles.map((file) => [file.name, file.text]));
  assert.equal(presetsByName.size, 2, "preset export keeps both presets");
  assert.match(presetsByName.get("Presets/My-Preset/manifest.json")!, /First preset/);
  assert.match(presetsByName.get("Presets/My-Preset-2/manifest.json")!, /Second preset/);

  // ── Compatible profile ZIP: two characters named "Alice" and both "World" books are kept ──
  const characters = createCharactersStorage(db);
  for (const description of ["Alice one", "Alice two"]) {
    await characters.create(characterDataSchema.parse({ name: "Alice", description }));
  }
  const profileFiles = entriesOf(
    await app.inject({ method: "GET", url: "/api/backup/export-profile?format=compatible" }),
  );
  const profileNames = profileFiles.map((file) => file.name);
  assert.ok(profileNames.includes("characters/Alice.json") && profileNames.includes("characters/Alice (2).json"));
  assert.ok(profileNames.includes("lorebooks/World.json") && profileNames.includes("lorebooks/World (2).json"));
  assert.equal(new Set(profileNames).size, profileNames.length);
  const alices = profileFiles.filter((file) => file.name.startsWith("characters/Alice"));
  assert.deepEqual(alices.map((file) => JSON.parse(file.text).data.description).sort(), ["Alice one", "Alice two"]);

  // ── Chats: the bulk export streams, with one file per chat and the manifest last ──
  const chats = createChatsStorage(db);
  const chatIds = [];
  for (const name of ["Tavern", "Tavern", "Harbor"]) {
    const chat = (await chats.create({ name, mode: "conversation", characterIds: [] }))!;
    await chats.createMessage({ chatId: chat.id, role: "user", characterId: null, content: `Hello from ${name}` });
    await chats.createMessage({ chatId: chat.id, role: "assistant", characterId: null, content: `Reply in ${name}` });
    chatIds.push(chat.id);
  }
  const chatResponse = await app.inject({
    method: "POST",
    url: "/api/chats/export/bulk",
    payload: { chatIds, format: "jsonl", scope: "selected" },
  });
  assert.equal(chatResponse.headers["content-length"], undefined, "the chat ZIP is streamed, not buffered");
  assert.equal(chatResponse.headers["content-type"], "application/zip");
  const chatFiles = entriesOf(chatResponse);
  assert.equal(chatFiles.length, chatIds.length + 1);
  assert.equal(chatFiles.at(-1)!.name, "manifest.json", "the manifest is written last");
  const manifest = JSON.parse(chatFiles.at(-1)!.text);
  assert.equal(manifest.count, chatIds.length);
  assert.equal(manifest.format, "jsonl");
  assert.deepEqual(
    manifest.chats.map((record: { file: string }) => record.file),
    chatFiles.slice(0, -1).map((file) => file.name),
    "the manifest names every file in the archive",
  );
  for (const [index, chatId] of chatIds.entries()) {
    const file = chatFiles[index]!;
    assert.match(file.name, new RegExp(`^0${index + 1}__.*__${chatId.slice(0, 8)}\\.jsonl$`));
    const single = await app.inject({ method: "GET", url: `/api/chats/${chatId}/export?format=jsonl` });
    assert.equal(file.text, single.body, "each bulk file matches the single-chat export");
    assert.equal(manifest.chats[index].messageCount, 2);
  }
  console.info("Bulk export ZIP regression passed");
} finally {
  await app.close();
  await closeDB();
}
