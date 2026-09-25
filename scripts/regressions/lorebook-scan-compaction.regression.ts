import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Every generated message stores the full text of every activated lorebook entry, in the message and again in each
// swipe: in a chat of a few hundred messages that was most of a ~190 MB shard, kept resident and pushing the server
// towards its heap limit.
// LOREBOOK_COMPACT_STORED_SCANS=true (opt-in) keeps that text only on the newest generated message (row and swipes)
// and stores ids, keys and scores for older messages, in the background. Off by default: storage is unchanged.
const directory = mkdtempSync(join(tmpdir(), "marinara-lorebook-scan-compaction-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";
delete process.env.LOREBOOK_COMPACT_STORED_SCANS;

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage, settleLorebookScanCompactions } =
  await import("../../packages/server/src/services/storage/chats.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { lorebooksRoutes } = await import("../../packages/server/src/routes/lorebooks.routes.js");
const { compactLorebookScan, lorebookScanHasContent, storedContentForTextlessScanEntries } =
  await import("../../packages/server/src/services/lorebook/lorebook-scan-compaction.js");

const scan = (label: string, entryId = "entry-1") => ({
  activatedEntries: [
    {
      id: entryId,
      name: "Harbour",
      content: `${label} `.repeat(2000),
      matchedKeys: ["harbour"],
      activationSources: ["keyword"],
      matchType: "keyword",
    },
    { id: "entry-2", content: "Short", matchedKeys: [], activationSources: ["semantic"], semanticScore: 0.8 },
  ],
  budgetSkippedEntries: [],
  totalTokensEstimate: 1234,
  totalEntries: 2,
});

// ── The compaction rule itself ──
const compact = compactLorebookScan(scan("x"));
assert.equal(lorebookScanHasContent(compact), false);
assert.deepEqual(
  compact.activatedEntries.map((entry) => ({ ...entry })),
  [
    { id: "entry-1", name: "Harbour", matchedKeys: ["harbour"], activationSources: ["keyword"], matchType: "keyword" },
    { id: "entry-2", matchedKeys: [], activationSources: ["semantic"], semanticScore: 0.8 },
  ],
  "compaction keeps ids, names, keys, sources and scores",
);
assert.equal(compact.totalTokensEstimate, 1234);

// Agent retries read textless entries from the lorebook; entries with text and deleted entries are left alone.
const lookups: string[] = [];
const stored = await storedContentForTextlessScanEntries(
  { activatedEntries: [{ id: "entry-1" }, { id: "entry-2", content: "resolved" }, { id: "gone" }, { id: "entry-1" }] },
  async (id) => {
    lookups.push(id);
    return id === "entry-1" ? { content: "Stored text" } : null;
  },
);
assert.deepEqual([...stored], [["entry-1", "Stored text"]]);
assert.deepEqual(lookups, ["entry-1", "gone"], "only textless entries are looked up, once each");

const db = await getDB();
const chats = createChatsStorage(db);
const lorebooks = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
const extraOf = (row: { extra?: unknown } | null | undefined) =>
  JSON.parse(typeof row?.extra === "string" ? row.extra : "{}") as Record<string, any>;
const firstEntryText = (row: { extra?: unknown } | null | undefined) =>
  extraOf(row).lorebookScan?.activatedEntries?.[0]?.content as string | undefined;

try {
  // ── Default (setting unset): the stored shape is exactly what it was ──
  {
    const chat = await chats.create({ name: "Default chat", mode: "roleplay", characterIds: [] });
    assert(chat);
    const first = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "One", characterId: null });
    assert(first);
    await chats.updateMessageExtra(first.id, { lorebookScan: scan("first") });
    const second = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Two", characterId: null });
    assert(second);
    await chats.updateMessageExtra(second.id, { lorebookScan: scan("second") });
    await settleLorebookScanCompactions();
    assert.match(firstEntryText(await chats.getMessage(first.id)) ?? "", /^first /u, "older rows keep their text");
    assert.match(firstEntryText((await chats.getSwipes(first.id))[0]) ?? "", /^first /u, "swipes keep their text");
  }

  // ── Opt-in ──
  process.env.LOREBOOK_COMPACT_STORED_SCANS = "true";
  const book = await lorebooks.create({ name: "Harbour lore" });
  assert(book);
  const entry = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Harbour",
    content: "Stored harbour text",
    keys: ["harbour"],
  });
  assert(entry);

  const chat = await chats.create({ name: "Scan proof", mode: "roleplay", characterIds: [] });
  assert(chat);
  const first = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "One", characterId: null });
  assert(first);
  await chats.updateMessageExtra(first.id, { lorebookScan: scan("first", entry.id) });
  await settleLorebookScanCompactions();
  assert.match(firstEntryText(await chats.getMessage(first.id)) ?? "", /^first /u, "the newest message keeps text");
  assert.match(firstEntryText((await chats.getSwipes(first.id))[0]) ?? "", /^first /u, "and so does its swipe");

  // A regenerated swipe of the newest message: every swipe keeps the text that built it.
  await chats.addSwipe(first.id, "One, again");
  const regenerated = await chats.getMessage(first.id);
  await chats.updateMessageExtraForSwipe(first.id, regenerated!.activeSwipeIndex, {
    lorebookScan: scan("regen", entry.id),
  });
  await settleLorebookScanCompactions();
  const swipes = await chats.getSwipes(first.id);
  assert.match(firstEntryText(swipes[0]) ?? "", /^first /u, "swipe 0 keeps its own text");
  assert.match(firstEntryText(swipes[1]) ?? "", /^regen /u, "swipe 1 keeps its own text");

  // Swiping back restores the text that built swipe 0 on the message row, which Active Context shows.
  await chats.setActiveSwipe(first.id, 0);
  assert.match(firstEntryText(await chats.getMessage(first.id)) ?? "", /^first /u, "swiping back keeps the text");
  let active = await app.inject({ method: "GET", url: `/api/lorebooks/scan/${chat.id}` });
  assert.equal(active.statusCode, 200, active.body);
  assert.match(active.json().entries[0].content, /^first /u, "Active Context shows swipe 0's resolved text");
  await chats.setActiveSwipe(first.id, 1);

  // The next generation takes over: the older message's row and swipes are compacted in the background.
  const second = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Two", characterId: null });
  assert(second);
  await chats.updateMessageExtra(second.id, { lorebookScan: scan("second", entry.id), other: 1 });
  await settleLorebookScanCompactions();
  const firstRow = await chats.getMessage(first.id);
  assert.equal(lorebookScanHasContent(extraOf(firstRow).lorebookScan), false, "older message rows are compacted");
  assert.equal(extraOf(firstRow).lorebookScan.totalEntries, 2);
  for (const swipe of await chats.getSwipes(first.id))
    assert.equal(lorebookScanHasContent(extraOf(swipe).lorebookScan), false, `older swipe ${swipe.index} compacted`);
  const secondRow = await chats.getMessage(second.id);
  assert.match(firstEntryText(secondRow) ?? "", /^second /u);
  assert.equal(extraOf(secondRow).other, 1);
  assert.match(firstEntryText((await chats.getSwipes(second.id))[0]) ?? "", /^second /u);

  // A scan saved later on an older generated message (any message id reaches updateMessageExtra) does not take over:
  // the newest message by order keeps its text and the older one is compacted again.
  await chats.updateMessageExtra(first.id, { lorebookScan: scan("late", entry.id) });
  await settleLorebookScanCompactions();
  assert.match(firstEntryText(await chats.getMessage(second.id)) ?? "", /^second /u, "the newest message keeps text");
  assert.match(firstEntryText((await chats.getSwipes(second.id))[0]) ?? "", /^second /u);
  assert.equal(
    lorebookScanHasContent(extraOf(await chats.getMessage(first.id)).lorebookScan),
    false,
    "a late scan on an older message is compacted",
  );

  // An impersonated turn saves its scan on a user message. Active Context and agent retries still read the newest
  // assistant message, so that one keeps its text and the user message's scan is compacted instead.
  const impersonated = await chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: "Impersonated",
    characterId: null,
  });
  assert(impersonated);
  await chats.updateMessageExtra(impersonated.id, { lorebookScan: scan("impersonated", entry.id) });
  await settleLorebookScanCompactions();
  assert.match(
    firstEntryText(await chats.getMessage(second.id)) ?? "",
    /^second /u,
    "impersonation keeps the kept row",
  );
  assert.match(firstEntryText((await chats.getSwipes(second.id))[0]) ?? "", /^second /u);
  assert.equal(lorebookScanHasContent(extraOf(await chats.getMessage(impersonated.id)).lorebookScan), false);
  active = await app.inject({ method: "GET", url: `/api/lorebooks/scan/${chat.id}` });
  assert.match(active.json().entries[0].content, /^second /u, "Active Context still shows the resolved text");
  await chats.removeMessage(impersonated.id);

  // Unrelated extra updates do not touch other messages.
  await chats.updateMessageExtra(first.id, { hiddenFromAI: true });
  await settleLorebookScanCompactions();
  assert.match(firstEntryText(await chats.getMessage(second.id)) ?? "", /^second /u);

  // Active Context on the newest message shows its resolved text; once it is deleted, the compacted message that is
  // newest again falls back to the entry's stored text instead of an empty string.
  active = await app.inject({ method: "GET", url: `/api/lorebooks/scan/${chat.id}` });
  assert.match(active.json().entries[0].content, /^second /u);
  await chats.removeMessage(second.id);
  active = await app.inject({ method: "GET", url: `/api/lorebooks/scan/${chat.id}` });
  assert.equal(active.statusCode, 200, active.body);
  assert.equal(active.json().entries[0].content, "Stored harbour text");

  // The first save in a chat since start sweeps messages stored earlier (here: with the setting off). When that save
  // is an impersonated turn, the newest assistant/narrator message found by the sweep keeps its text.
  process.env.LOREBOOK_COMPACT_STORED_SCANS = "false";
  const oldChat = await chats.create({ name: "Stored earlier", mode: "roleplay", characterIds: [] });
  assert(oldChat);
  const older = await chats.createMessage({ chatId: oldChat.id, role: "assistant", content: "A", characterId: null });
  assert(older);
  await chats.updateMessageExtra(older.id, { lorebookScan: scan("older", entry.id) });
  const newest = await chats.createMessage({ chatId: oldChat.id, role: "narrator", content: "B", characterId: null });
  assert(newest);
  await chats.updateMessageExtra(newest.id, { lorebookScan: scan("newest", entry.id) });
  process.env.LOREBOOK_COMPACT_STORED_SCANS = "true";
  const userTurn = await chats.createMessage({ chatId: oldChat.id, role: "user", content: "C", characterId: null });
  assert(userTurn);
  await chats.updateMessageExtra(userTurn.id, { lorebookScan: scan("user", entry.id) });
  await settleLorebookScanCompactions();
  assert.equal(lorebookScanHasContent(extraOf(await chats.getMessage(older.id)).lorebookScan), false, "swept");
  for (const swipe of await chats.getSwipes(older.id))
    assert.equal(lorebookScanHasContent(extraOf(swipe).lorebookScan), false, "swept swipe");
  assert.match(firstEntryText(await chats.getMessage(newest.id)) ?? "", /^newest /u, "newest narrator row kept");
  assert.match(firstEntryText((await chats.getSwipes(newest.id))[0]) ?? "", /^newest /u);
  assert.equal(lorebookScanHasContent(extraOf(await chats.getMessage(userTurn.id)).lorebookScan), false);
} finally {
  delete process.env.LOREBOOK_COMPACT_STORED_SCANS;
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}

// ── The optional maintenance script applies the same rule to storage written before ──
const scriptDir = mkdtempSync(join(tmpdir(), "marinara-lorebook-scan-script-"));
try {
  const storage = join(scriptDir, "storage");
  mkdirSync(join(storage, "tables", "messages"), { recursive: true });
  const row = (id: string, chatId: string, createdAt: string, label: string, role = "assistant") => ({
    id,
    chatId,
    role,
    createdAt,
    extra: JSON.stringify({ lorebookScan: scan(label), keep: id }),
  });
  writeFileSync(
    join(storage, "tables", "messages", "chat-1.json"),
    JSON.stringify([
      row("m1", "chat-1", "2026-01-01T00:00:00.000Z", "old"),
      row("m2", "chat-1", "2026-01-02T00:00:00.000Z", "new"),
      // An impersonated user turn is newer but is not what readers use: it is compacted, m2 keeps its text.
      row("m3", "chat-1", "2026-01-03T00:00:00.000Z", "user", "user"),
    ]),
  );
  writeFileSync(
    join(storage, "tables", "message_swipes.json"),
    JSON.stringify([
      { ...row("s1", "", "", "oldswipe"), messageId: "m1" },
      { ...row("s2", "", "", "newswipe"), messageId: "m2" },
    ]),
  );
  const script = new URL("../compact-lorebook-scans.mjs", import.meta.url);
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [fileURLToPath(script), ...args], { encoding: "utf8" });

  const dry = run(storage);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Would compact 3 rows/u);
  assert.match(
    readFileSync(join(storage, "tables", "messages", "chat-1.json"), "utf8"),
    /old old/u,
    "dry run writes nothing",
  );

  writeFileSync(join(storage, ".writer-lease"), "");
  assert.equal(run(storage, "--apply").status, 1, "a writer lease blocks --apply");
  rmSync(join(storage, ".writer-lease"));

  const backupDir = join(scriptDir, "backup");
  const applied = run(scriptDir, "--apply", "--backup-dir", backupDir);
  assert.equal(applied.status, 0, applied.stderr);
  const messagesAfter = JSON.parse(readFileSync(join(storage, "tables", "messages", "chat-1.json"), "utf8"));
  const extraById = new Map(
    messagesAfter.map((entry: { id: string; extra: string }) => [entry.id, JSON.parse(entry.extra)]),
  );
  assert.equal(lorebookScanHasContent(extraById.get("m1").lorebookScan), false, "older message row compacted");
  assert.equal(lorebookScanHasContent(extraById.get("m2").lorebookScan), true, "newest message row keeps text");
  assert.equal(lorebookScanHasContent(extraById.get("m3").lorebookScan), false, "impersonated user row compacted");
  assert.equal(extraById.get("m1").keep, "m1", "other extra fields are untouched");
  const swipesAfter = JSON.parse(readFileSync(join(storage, "tables", "message_swipes.json"), "utf8"));
  const swipeScan = (id: string) =>
    JSON.parse(swipesAfter.find((swipe: { id: string }) => swipe.id === id).extra).lorebookScan;
  assert.equal(lorebookScanHasContent(swipeScan("s1")), false, "older message's swipes compacted");
  assert.equal(lorebookScanHasContent(swipeScan("s2")), true, "newest message's swipes keep text");
  assert.ok(existsSync(join(backupDir, "messages", "chat-1.json")), "sharded table backed up");
  assert.ok(existsSync(join(backupDir, "message_swipes", "message_swipes.json")), "flat table backed up");
  assert.deepEqual(readdirSync(join(storage, "tables", "messages")), ["chat-1.json"], "no temp files left behind");
} finally {
  rmSync(scriptDir, { recursive: true, force: true });
}

console.log("lorebook-scan-compaction regression passed");
