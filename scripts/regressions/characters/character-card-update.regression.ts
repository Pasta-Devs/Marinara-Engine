// A newer release of a card you already have: the import finds the character it matches (same Card Browser page, or
// same name and creator) and can update it in place. The character keeps its id and what belongs to your copy
// (favorite, colors, your own tags), the old card stays in Version history, and the card's lorebook and regex
// scripts are refreshed instead of copied a second time. Runs on a fresh database in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-card-update-"));
process.env.FILE_STORAGE_DIR = storageRoot;
process.env.DATA_DIR = storageRoot;
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.DISABLE_REQUEST_LOGGING = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";

const { buildApp } = await import("../../../packages/server/src/app.js");
const { mergeCreatorNotes } = await import("../../../packages/server/src/services/import/st-character.importer.js");

// Creator's Notes merge: unedited notes become the card's; edited ones keep your text and CSS, gain the author's
// new lines before your first style block, and lose lines the author removed that you left as they were.
assert.equal(mergeCreatorNotes("Old blurb", "Old blurb", "New blurb"), "New blurb");
assert.equal(
  mergeCreatorNotes("By Ash.\nOld line", "My blurb\nOld line\n<style>.x{color:red}</style>", "By Ash.\nNew line"),
  "My blurb\n\nNew line\n\n<style>.x{color:red}</style>",
);
// Unknown base (imported before notes were remembered): only lines you don't have yet are added.
assert.equal(mergeCreatorNotes(null, "Mine\nShared", "Shared\nAdded"), "Mine\nShared\n\nAdded");
assert.equal(mergeCreatorNotes(null, "", "Card notes"), "Card notes");
assert.equal(mergeCreatorNotes("Base", "Mine", ""), "Mine");
// The author removed the only line you had merged in: no empty lines are left where it was.
assert.equal(
  mergeCreatorNotes("Blurb\nv1.2: new route", "Mine\n\nv1.2: new route\n\n<style>.x{}</style>", "Blurb"),
  "Mine\n\n<style>.x{}</style>",
);
const { closeDB } = await import("../../../packages/server/src/db/connection.js");

type Response = { statusCode: number; body: string };
const app = (await buildApp()) as unknown as {
  ready(): Promise<void>;
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<Response>;
};
await app.ready();

const send = async (method: string, url: string, payload?: unknown) => {
  const response = await app.inject({ method, url, payload });
  assert.equal(response.statusCode, 200, response.body);
  return JSON.parse(response.body) as any;
};
const post = (url: string, payload: unknown) => send("POST", url, payload);
const rows = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  const list = value?.items ?? value?.characters ?? value?.lorebooks ?? value?.data;
  assert.ok(Array.isArray(list), `expected a list, got ${Object.keys(value ?? {}).join(", ")}`);
  return list;
};
const get = (url: string) => send("GET", url);

const card = (version: string, description: string, entries: string[], extra: Record<string, unknown> = {}) => ({
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "Wren",
    description,
    personality: "Curious",
    first_mes: `Hello (${version})`,
    creator_notes: version === "1.0" ? "Made by Ash." : "Made by Ash.\nNow with a new route.",
    creator: "Ash",
    character_version: version,
    tags: ["fantasy"],
    character_book: {
      entries: entries.map((content, index) => ({
        keys: [`key${index}`],
        content,
        enabled: true,
        insertion_order: index,
      })),
    },
    extensions: {
      regex_scripts: [{ scriptName: "Trim", findRegex: "/foo/g", replaceString: "bar", placement: [2] }],
      ...extra,
    },
  },
});

try {
  const first = await post("/api/import/st-character", card("1.0", "Old description", ["Old lore"]));
  assert.equal(first.success, true, JSON.stringify(first));
  const id = first.characterId as string;
  const firstBookId = first.lorebook?.lorebookId as string;
  assert.ok(firstBookId);

  // Your own changes to the copy: favorite, a color, a tag of your own, notes with your CSS, versioning left on.
  const stored = JSON.parse((await get(`/api/characters/${id}`)).data);
  await send("PATCH", `/api/characters/${id}`, {
    data: {
      ...stored,
      creator_notes: "My short blurb\n<style>.wren{color:teal}</style>",
      tags: [...stored.tags, "mine"],
      extensions: { ...stored.extensions, fav: true, nameColor: "#abcdef" },
    },
  });

  // Matches: same name and creator, a blank creator on either side, but not another creator.
  const matches = async (body: Record<string, unknown>) =>
    ((await post("/api/import/st-character/matches", body)).matches as Array<{ id: string; reason: string }>) ?? [];
  assert.deepEqual(
    (await matches({ name: " wren ", creator: "ASH" })).map((m) => m.id),
    [id],
  );
  assert.deepEqual(
    (await matches({ name: "Wren", creator: "" })).map((m) => m.id),
    [id],
  );
  assert.deepEqual(await matches({ name: "Wren", creator: "Someone else" }), []);
  assert.deepEqual(await matches({ name: "Robin", creator: "Ash" }), []);

  // Update in place with the newer release.
  const updated = await post("/api/import/st-character", {
    ...card("1.2", "New description", ["New lore", "More lore"]),
    updateCharacterId: id,
    _botBrowserSource: "chub:ash/wren",
  });
  assert.equal(updated.success, true, JSON.stringify(updated));
  assert.equal(updated.updated, true);
  assert.equal(updated.characterId, id, "the update keeps the character id, so chats stay with it");

  const characters = rows(await get("/api/characters"));
  assert.equal(characters.length, 1, "no second copy");
  const after = JSON.parse((await get(`/api/characters/${id}`)).data);
  assert.equal(after.description, "New description");
  assert.equal(after.first_mes, "Hello (1.2)");
  assert.equal(after.character_version, "1.2");
  assert.equal(after.extensions.fav, true, "favorite kept");
  assert.equal(after.extensions.nameColor, "#abcdef", "your colors kept");
  assert.ok(after.tags.includes("mine") && after.tags.includes("fantasy"), JSON.stringify(after.tags));
  assert.equal(after.tags.filter((tag: string) => tag === "fantasy").length, 1);
  assert.equal(after.extensions.botBrowserSource, "chub:ash/wren", "the card is now linked to its Card Browser page");
  assert.equal(
    after.creator_notes,
    "My short blurb\n\nNow with a new route.\n\n<style>.wren{color:teal}</style>",
    "your notes and CSS stay; the author's new line goes in before your CSS",
  );

  // The old card is in Version history.
  const versions = (await get(`/api/characters/${id}/versions`)) as Array<{ isCurrent: boolean; data: any }>;
  assert.ok(versions.some((version) => !version.isCurrent && version.data.description === "Old description"));

  // The lorebook made from the card is refreshed, not copied.
  const books = rows(await get("/api/lorebooks"));
  assert.equal(books.length, 1, JSON.stringify(books.map((book: { id: string }) => book.id)));
  assert.equal(books[0]!.id, firstBookId);
  const entries = rows(await get(`/api/lorebooks/${firstBookId}/entries`));
  assert.deepEqual(entries.map((entry: { content: string }) => entry.content).sort(), ["More lore", "New lore"]);

  // The card's regex script is not added twice.
  const scripts = rows(await get("/api/regex-scripts"));
  assert.equal(scripts.filter((script: { name: string }) => script.name === "Trim").length, 1);

  // Now found by its Card Browser page even after a rename.
  await send("PATCH", `/api/characters/${id}`, { data: { ...after, name: "Wren (my copy)" } });
  assert.deepEqual(
    (await matches({ name: "Wren", creator: "Ash", botBrowserSource: "chub:ash/wren" })).map((m) => [m.id, m.reason]),
    [[id, "browser"]],
  );

  // With Automatic versioning off, the card before the update is still kept.
  const current = JSON.parse((await get(`/api/characters/${id}`)).data);
  await send("PATCH", `/api/characters/${id}`, {
    data: { ...current, extensions: { ...current.extensions, versioningEnabled: false } },
  });
  const countBefore = ((await get(`/api/characters/${id}/versions`)) as unknown[]).length;
  await post("/api/import/st-character", { ...card("1.3", "Newest description", ["New lore"]), updateCharacterId: id });
  const versionsAfter = (await get(`/api/characters/${id}/versions`)) as Array<{ isCurrent: boolean; data: any }>;
  assert.equal(versionsAfter.length, countBefore + 1);
  assert.ok(versionsAfter.some((version) => !version.isCurrent && version.data.description === "New description"));

  // A character that is gone is reported, and nothing new is created.
  const missing = await post("/api/import/st-character", { ...card("2.0", "x", []), updateCharacterId: "nope" });
  assert.equal(missing.success, false);
  assert.equal(rows(await get("/api/characters")).length, 1);
} finally {
  await app.close();
  await closeDB();
  rmSync(storageRoot, { recursive: true, force: true });
}
