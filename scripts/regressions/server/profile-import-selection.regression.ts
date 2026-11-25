// Import Profile's "Choose what to import": the preview lists what the file holds, by kind and item,
// and the import writes only the kinds and items that were ticked, with their messages and files.
// The choice is checked on the server, and Undo Last Import covers only what was written.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await fs.mkdtemp(join(tmpdir(), "marinara-profile-import-selection-"));
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");

// The safety copy checks free space; give it plenty.
const originalStatfs = fs.statfs;
Object.assign(fs, {
  statfs: async (path: string) => ({ ...(await originalStatfs(path)), bsize: 1, bavail: 1024 ** 4 }),
});
syncBuiltinESMExports();

const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { backupRoutes } = await import("../../../packages/server/src/routes/backup.routes.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
const appSettingsModule = await import("../../../packages/server/src/services/storage/app-settings.storage.js");
const selectionModule = await import("../../../packages/server/src/services/backup/profile-import-selection.js");
const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");

const db = await getDB();
const characters = createCharactersStorage(db);
const chats = createChatsStorage(db);
const lorebooks = createLorebooksStorage(db);
const settings = appSettingsModule.createAppSettingsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(backupRoutes, { prefix: "/api/backup" });
await app.ready();

const descriptionOf = async (id: string) => JSON.parse((await characters.getById(id))!.data as string).description;
const setDescription = (id: string, description: string) => characters.update(id, { description } as any);
// Sprites must be real images; an "old" and a "new" one-pixel PNG tell versions apart.
const OLD_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
const NEW_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYPgPAAEDAQAIicLsAAAAAElFTkSuQmCC";
const readData = async (path: string) => {
  const bytes = await fs.readFile(join(root, path)).catch(() => null);
  if (!bytes) return "missing";
  const base64 = bytes.toString("base64");
  return base64 === OLD_PNG ? "old image" : base64 === NEW_PNG ? "new image" : bytes.toString("utf8");
};
const writeData = async (path: string, text: string) => {
  await fs.mkdir(join(root, path, ".."), { recursive: true });
  const image = text === "old image" ? OLD_PNG : text === "new image" ? NEW_PNG : null;
  await fs.writeFile(join(root, path), image ? Buffer.from(image, "base64") : text);
};

const preview = async (profile: string, keep = false) => {
  const res = await app.inject({
    method: "POST",
    url: `/api/backup/import-profile?preview=true${keep ? "&keepExisting=true" : ""}`,
    headers: { "content-type": "application/json" },
    payload: profile,
  });
  assert.equal(res.statusCode, 200, res.body);
  return res.json();
};
const importChosen = (token: string, selection: unknown, keep = false) =>
  app.inject({
    method: "POST",
    url: `/api/backup/import-profile${keep ? "?keepExisting=true" : ""}`,
    headers: { "x-profile-preview-token": token, "content-type": "application/json" },
    payload: JSON.stringify({ selection }),
  });

try {
  // The profile: Ada and Bea with sprites, a persona, two chats, a lorebook, a knowledge file.
  const ada = (await characters.create({ name: "Ada", description: "old" } as any))!.id;
  const bea = (await characters.create({ name: "Bea", description: "old" } as any))!.id;
  await characters.createPersona("Pia", "persona");
  const first = (await chats.create({ name: "First chat", mode: "conversation", characterIds: [ada] } as any))!;
  const second = (await chats.create({ name: "Second chat", mode: "roleplay", characterIds: [bea] } as any))!;
  await chats.createMessage({ chatId: first.id, role: "user", characterId: null, content: "one" } as any);
  await chats.createMessage({ chatId: first.id, role: "assistant", characterId: null, content: "two" } as any);
  const secondMessage = (await chats.createMessage({
    chatId: second.id,
    role: "user",
    characterId: null,
    content: "second chat message",
  } as any))!;
  await lorebooks.create({ name: "World", characterIds: [] } as any);
  await writeData(`sprites/${ada}/happy.png`, "old image");
  await writeData(`sprites/${bea}/sad.png`, "old image");
  await writeData("knowledge-sources/notes.txt", "old notes");

  const exported = await app.inject({ method: "GET", url: "/api/backup/export-profile" });
  assert.equal(exported.statusCode, 200, exported.body);

  // The preview lists what the file holds, with items for the kinds that can be picked one by one.
  const listed = await preview(exported.body);
  const kinds = Object.fromEntries(listed.contents.kinds.map((kind: any) => [kind.key, kind]));
  assert.equal(kinds.characters.count, 2);
  assert.deepEqual(kinds.characters.items.map((item: any) => item.name).sort(), ["Ada", "Bea"]);
  assert.equal(kinds.characters.files, 2, "each character's sprite goes with Characters");
  assert.equal(kinds.personas.count, 1);
  assert.equal(kinds.chats.count, 2);
  assert.equal(kinds.chats.messages, 3);
  const firstItem = kinds.chats.items.find((item: any) => item.id === first.id);
  assert.equal(firstItem.mode, "conversation");
  assert.equal(firstItem.messages, 2);
  assert.equal(kinds.lorebooks.count, 1);
  assert.equal(kinds.memory.files, 1, "knowledge files are listed with memory");
  assert.ok(!listed.contents.kinds.some((kind: any) => kind.count === 0 && kind.files === 0), "no empty kinds");

  // Since the export, everything changed: Ada, Bea, both sprites and the notes were edited, the second
  // chat deleted.
  await setDescription(ada, "new");
  await setDescription(bea, "new");
  await writeData(`sprites/${ada}/happy.png`, "new image");
  await writeData(`sprites/${bea}/sad.png`, "new image");
  await writeData("knowledge-sources/notes.txt", "new notes");
  await chats.remove(second.id);

  // A choice the server can't trust is refused, and nothing is written. The preview stays usable.
  for (const bad of [
    { kinds: ["characters", "everything"] },
    { kinds: "characters" },
    { kinds: ["connections"], items: { connections: ["x"] } },
    { kinds: ["characters"], items: { characters: [42] } },
    { kinds: [] },
    { kinds: ["characters"], items: { characters: [] } },
  ]) {
    const refused = await importChosen(listed.previewToken, bad);
    assert.equal(refused.statusCode, 400, `refused: ${JSON.stringify(bad)}`);
  }
  assert.equal(await descriptionOf(ada), "new", "a refused choice wrote nothing");

  // Only Ada and the second chat: Ada and her sprite go back, Bea, her sprite, the notes and the
  // first chat are left as they are now. An id that isn't in the file changes nothing.
  const chosen = await importChosen(listed.previewToken, {
    kinds: ["characters", "chats"],
    items: { characters: [ada, "not-in-the-file"], chats: [second.id] },
  });
  assert.equal(chosen.statusCode, 200, chosen.body);
  assert.equal(chosen.json().imported.characters, 1);
  assert.equal(chosen.json().imported.chats, 1);
  assert.equal(chosen.json().imported.messages, 1, "only the chosen chat's messages");
  assert.equal(await descriptionOf(ada), "old", "the chosen character was imported");
  assert.equal(await descriptionOf(bea), "new", "a character left out keeps today's version");
  assert.equal(await readData(`sprites/${ada}/happy.png`), "old image", "the chosen character's files came too");
  assert.equal(await readData(`sprites/${bea}/sad.png`), "new image", "a left-out character's files stay");
  assert.equal(await readData("knowledge-sources/notes.txt"), "new notes", "a kind left out writes no files");
  assert.equal((await chats.getMessage(secondMessage.id))?.content, "second chat message", "the chosen chat is back");
  assert.equal((await chats.listMessages(first.id)).length, 2, "the chat left out is unchanged");

  // Undo covers only what this import wrote.
  const record = JSON.parse((await settings.get("profile_import_undo")) ?? "null");
  assert.deepEqual(record.rows.characters, [ada]);
  assert.ok(!(record.rows.personas ?? []).length, "personas weren't chosen, so Undo has none");
  assert.ok(
    record.files.every((file: string) => file.startsWith(`sprites/${ada}/`)),
    "only Ada's files are listed",
  );

  // The preview token is used up after a successful import.
  assert.equal((await importChosen(listed.previewToken, { kinds: ["personas"] })).statusCode, 410);

  // "Keep my current versions" with a choice: the preview counts only what is missing, and the
  // chosen kind adds that and nothing else.
  await chats.remove(second.id);
  await setDescription(ada, "kept");
  const keepPreview = await preview(exported.body, true);
  const keepKinds = Object.fromEntries(keepPreview.contents.kinds.map((kind: any) => [kind.key, kind]));
  assert.ok(!keepKinds.characters, "every character is already here");
  assert.equal(keepKinds.chats.count, 1, "only the missing chat is offered");
  const kept = await importChosen(keepPreview.previewToken, { kinds: ["chats"] }, true);
  assert.equal(kept.statusCode, 200, kept.body);
  assert.equal(await descriptionOf(ada), "kept");
  assert.equal((await chats.getMessage(secondMessage.id))?.content, "second chat message");

  // Older profiles hold plain lists; they can be chosen whole.
  const legacy = { characters: [{}, {}], themes: [{}], presets: [] };
  assert.deepEqual(selectionModule.describeLegacyProfileContents(legacy).kinds, [
    { key: "characters", count: 2, files: 0 },
    { key: "themes", count: 1, files: 0 },
  ]);
  const legacyChoice = selectionModule.parseProfileImportSelection({ kinds: ["themes"] })!;
  assert.deepEqual(Object.keys(selectionModule.applyLegacyProfileImportSelection(legacy, legacyChoice)), ["themes"]);

  // Without a choice, the import takes everything, as before.
  assert.equal(selectionModule.parseProfileImportSelection(undefined), null);

  console.log("profile-import-selection: ok");
} finally {
  await app.close();
  await closeDB();
  await fs.rm(root, { recursive: true, force: true });
}
