// #9323: with many characters, character.list came back as one bare array the 32k command-output
// cap cut mid-row, and `offset` was ignored, so "the next page" returned the first page again and
// Mari searched letter by letter instead. The big lists now page as { items, total, offset,
// nextOffset }, a page stops before the output cap, and following nextOffset reaches every row.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-list-paging-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
try {
  const db = await getDB();
  const { MariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");
  const { WorkspaceCommands } =
    await import("../../../packages/server/src/services/professor-mari/workspace-commands.js");
  const { COMMAND_OUTPUT_LIMIT } =
    await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
  const mariDb = new MariDbService(db);
  type Page = {
    items: Array<{ id: string; name: string; summary?: string }>;
    total: number;
    offset: number;
    nextOffset: number | null;
  };
  type Result = { ok: boolean; error?: string; output?: unknown; notes?: string[] };
  const call = (args: Record<string, unknown>) => mariDb.executeAction(args as never) as Promise<Result>;
  const page = async (args: Record<string, unknown>) => {
    const result = await call(args);
    assert.equal(result.ok, true, result.error);
    return { page: result.output as Page, notes: result.notes ?? [] };
  };

  // 120 cards with long summaries: the reported library, too big for one output.
  const TOTAL = 120;
  for (let index = 0; index < TOTAL; index += 1) {
    const created = await call({
      action: "character.create",
      data: { name: `Card ${String(index).padStart(3, "0")}`, summary: `${index} `.repeat(200), description: "x" },
    });
    assert.equal(created.ok, true, created.error);
  }

  // The reported call: limit 100 from offset 0. The page stops under the budget and says where to go on.
  const first = await page({ action: "character.list", limit: 100, offset: 0 });
  assert.equal(first.page.total, TOTAL);
  assert.equal(first.page.offset, 0);
  assert.ok(
    first.page.items.length > 0 && first.page.items.length < 100,
    `budget cut the page (${first.page.items.length})`,
  );
  assert.equal(first.page.nextOffset, first.page.items.length);
  assert.ok(
    first.notes.some((note) => note.includes(`offset: ${first.page.nextOffset}`)),
    "the early stop is named",
  );
  assert.ok(
    first.page.items.every((row) => (row.summary ?? "").length >= 399),
    "summaries are not clipped",
  );

  // A different offset returns different rows, and following nextOffset reaches every card once.
  const second = await page({ action: "character.list", limit: 100, offset: first.page.nextOffset });
  assert.notEqual(second.page.items[0]!.id, first.page.items[0]!.id, "offset moves the page");
  const seen: string[] = [];
  let offset: number | null = 0;
  let pages = 0;
  while (offset !== null) {
    const { page: current } = await page({ action: "character.list", limit: 100, offset });
    assert.ok(JSON.stringify({ items: current.items }, null, 2).length < 24_000, "a page stays under the read budget");
    seen.push(...current.items.map((row) => row.id));
    offset = current.nextOffset;
    pages += 1;
    assert.ok(pages < 50, "paging ends");
  }
  assert.equal(seen.length, TOTAL);
  assert.equal(new Set(seen).size, TOTAL, "no card is listed twice");

  // Past the end: an empty page with no next.
  const past = await page({ action: "character.list", offset: TOTAL + 5 });
  assert.deepEqual(past.page.items, []);
  assert.equal(past.page.nextOffset, null);

  // Through the tool, a full page never reaches the command-output cap.
  const commands = new WorkspaceCommands({ db } as never, () => ({
    permissionsMode: "auto",
    manualSilentMutationBlocked: false,
    askLatchSilentMutationBlocked: false,
    decisionContext: null,
  }));
  const viaTool = await commands.executeWorkspaceCommand(
    { id: "call-1", name: "app_data", arguments: { action: "character.list", limit: 100 } },
    new AbortController().signal,
    [],
    () => {},
    [],
  );
  assert.equal(viaTool.success, true);
  assert.ok(viaTool.output.length < COMMAND_OUTPUT_LIMIT, "the page fits the output cap");
  assert.doesNotMatch(viaTool.output, /output truncated/);
  assert.match(viaTool.output, /"nextOffset": \d+/);

  // One card too big for a page on its own is still listed, cut, with a note.
  await call({ action: "character.create", data: { name: "Huge", summary: "y".repeat(40_000) } });
  const huge = await page({ action: "character.list", limit: 1 });
  assert.equal(huge.page.items[0]!.name, "Huge");
  assert.ok(huge.page.items[0]!.summary!.length <= 2_000);
  assert.ok(huge.notes.some((note) => note.includes("matching .get action")));
  // A huge string inside an array (a tag) is cut as well, so the row cannot stay over the budget.
  await call({ action: "character.create", data: { name: "Huge tag", tags: ["z".repeat(40_000)] } });
  const hugeTag = (await page({ action: "character.list", limit: 1 })).page.items[0] as {
    name: string;
    tags: string[];
  };
  assert.equal(hugeTag.name, "Huge tag");
  assert.ok(hugeTag.tags[0]!.length <= 2_000, "the tag was clipped");

  // The other big lists page the same way.
  for (let index = 0; index < 3; index += 1) {
    assert.equal((await call({ action: "persona.create", data: { name: `Persona ${index}` } })).ok, true);
    assert.equal((await call({ action: "lorebook.create", data: { name: `Book ${index}` } })).ok, true);
    assert.equal((await call({ action: "preset.create", data: { name: `Preset ${index}` } })).ok, true);
  }
  const chats = createChatsStorage(db);
  for (let index = 0; index < 3; index += 1) {
    await chats.create({ name: `Chat ${index}`, mode: "roleplay", characterIds: [] });
  }
  for (const action of ["persona.list", "lorebook.list", "preset.list", "chat.list"]) {
    const all = (await page({ action })).page;
    assert.ok(all.total >= 3, `${action} lists what was made`);
    const head = (await page({ action, limit: 2 })).page;
    assert.equal(head.nextOffset, 2, `${action} points at the next page`);
    const tail = (await page({ action, limit: 2, offset: 2 })).page;
    assert.equal(tail.offset, 2);
    assert.ok(
      tail.items.every((row) => !head.items.some((other) => other.id === row.id)),
      `${action} offset returns other rows`,
    );
    assert.deepEqual(
      [...head.items, ...tail.items].map((row) => row.id),
      all.items.slice(0, head.items.length + tail.items.length).map((row) => row.id),
      `${action} pages line up with the full list`,
    );
  }
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
}

console.log("Professor Mari list paging regression passed.");
