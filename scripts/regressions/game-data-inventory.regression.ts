// #7743 slice 3 regression: a State Editor edit of a game's inventory becomes the ops
// POST /api/game/inventory applies (there is no replace-all op), matched by stack id.
//
// Two parts:
//   1) The pure diff: each kind of edit becomes its op, in an order that works (off before a move,
//      on after it); fields no op changes, unknown ids and bad quantities are refused before anything
//      is sent; only the stacks the ops touch count as stale.
//   2) End-to-end on a game saved before stacks had ids: the ids the client works out are the ones
//      the server applies the ops to, so the edit lands as made.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizeGameInventoryStacks,
  type GameInventoryStack,
} from "../../packages/shared/src/utils/game-inventory-stacks.js";
import {
  buildGameInventoryOps,
  findGameInventoryStacksChangedSince,
  gameInventoryOpsExpected,
} from "../../packages/client/src/lib/state-editor/game-data-inventory.js";

const opened: GameInventoryStack[] = [
  { id: "s-rope", name: "Rope", quantity: 2 },
  { id: "s-sword", name: "Sword", quantity: 1, item: "core/longsword" },
  { id: "s-ring", name: "Ring", quantity: 1, nickname: "Mum's ring", equipped: true },
];
const opsOf = (edited: unknown) => {
  const result = buildGameInventoryOps(opened, edited);
  assert.ok("ops" in result, `expected ops, got ${JSON.stringify(result)}`);
  return result.ops;
};
const issueOf = (edited: unknown) => {
  const result = buildGameInventoryOps(opened, edited);
  return "issue" in result ? result.issue : null;
};

// ── Part 1: the pure diff ──

assert.deepEqual(opsOf(opened), [], "an unchanged inventory sends nothing");
assert.deepEqual(
  opsOf([{ ...opened[0], quantity: 5 }, opened[1], opened[2]]),
  [{ op: "set", id: "s-rope", quantity: 5 }],
  "a quantity change is a set",
);
assert.deepEqual(
  opsOf([opened[0], opened[1]]),
  [{ op: "set", id: "s-ring", quantity: 0 }],
  "a stack left out is set to 0",
);
assert.deepEqual(
  opsOf([opened[0], { ...opened[1], nickname: "Oathkeeper" }, { ...opened[2], nickname: "" }]),
  [
    { op: "rename", id: "s-sword", name: "Oathkeeper" },
    { op: "rename", id: "s-ring", name: "Ring" },
  ],
  "a nickname is a rename, and clearing one renames it back to the item's own name",
);
assert.deepEqual(
  opsOf([
    opened[0],
    { ...opened[1], holder: "Gwendolyn", equipped: true },
    { id: "s-ring", name: "Ring", quantity: 1, nickname: "Mum's ring", holder: "Gwendolyn" },
  ]),
  [
    { op: "give", id: "s-sword", to: "Gwendolyn" },
    { op: "equip", id: "s-sword" },
    { op: "unequip", id: "s-ring" },
    { op: "give", id: "s-ring", to: "Gwendolyn" },
  ],
  "a move comes before putting it on and after taking it off; a worn item moved is taken off (the edit dropped `equipped`)",
);
assert.deepEqual(
  opsOf([...opened, { name: "Torch", quantity: 3, holder: "Bram" }]),
  [{ op: "add", name: "Torch", count: 3, holder: "Bram" }],
  "a stack without an id is added by name",
);
assert.deepEqual(
  opsOf([{ ...opened[0], quantity: 0, nickname: "Old rope" }, opened[1], opened[2]]),
  [{ op: "set", id: "s-rope", quantity: 0 }],
  "a stack set to 0 sends nothing else",
);

assert.deepEqual(
  issueOf([{ ...opened[0], name: "Silk rope" }, opened[1], opened[2]]),
  { kind: "fixed", name: "Rope", field: "name" },
  "a stack's own name never changes (a nickname does)",
);
assert.deepEqual(
  issueOf([opened[0], { ...opened[1], item: "core/dagger" }, opened[2]]),
  { kind: "fixed", name: "Sword", field: "item" },
  "a stack's ruleset item never changes",
);
assert.deepEqual(
  issueOf([{ ...opened[0], colour: "red" }, opened[1], opened[2]]),
  { kind: "fixed", name: "Rope", field: "colour" },
  "a field no stack has is refused, not silently dropped",
);
assert.deepEqual(issueOf([{ ...opened[0], id: "s-made-up" }]), { kind: "unknownStack", id: "s-made-up" });
assert.deepEqual(issueOf([opened[0], opened[0]]), { kind: "duplicateStack", id: "s-rope" });
assert.deepEqual(issueOf([{ ...opened[0], quantity: 1.5 }]), { kind: "quantity", name: "Rope" });
assert.deepEqual(issueOf([...opened, { quantity: 2 }]), { kind: "newStack", index: 3 }, "a new stack needs a name");
assert.deepEqual(
  issueOf([...opened, { name: "Torch", equipped: true }]),
  { kind: "newStack", index: 3 },
  "a new stack says only what the add op takes",
);
assert.deepEqual(issueOf({}), { kind: "notList" });
assert.deepEqual(
  issueOf([...opened, ...Array.from({ length: 41 }, (_, i) => ({ name: `Pebble ${i}` }))]),
  { kind: "tooMany", max: 40 },
  "more ops than the route takes at once are refused before sending",
);

const ops = opsOf([{ ...opened[0], quantity: 1 }, opened[1], opened[2]]);
assert.deepEqual(
  findGameInventoryStacksChangedSince(opened, [{ ...opened[0], quantity: 9 }, opened[1], opened[2]], ops),
  ["Rope"],
  "a stack the ops touch that changed since is stale",
);
assert.deepEqual(
  findGameInventoryStacksChangedSince(opened, [opened[0], { ...opened[1], quantity: 4 }, opened[2]], ops),
  [],
  "a stack the ops don't touch may have changed meanwhile",
);

// ── Part 2: end-to-end on a game saved before stacks had ids ──

// Its own store, so the run never touches a server's data folder.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-game-data-inventory-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const Fastify = (await import("../../packages/server/node_modules/fastify/fastify.js")).default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { gameInventoryRoutes } = await import("../../packages/server/src/routes/game-inventory.routes.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameInventoryRoutes, { prefix: "/api/game/inventory" });
const chats = createChatsStorage(db);
const chat = await chats.create({ name: "Game data inventory", mode: "game", characterIds: [] });
assert.ok(chat);
try {
  await chats.patchMetadata(chat.id, {
    gameInventory: [
      { name: "Apple", quantity: 3 },
      { name: "Rope", quantity: 1 },
    ],
  });
  const readStacks = async () => {
    const row = await chats.getById(chat.id);
    const metadata = typeof row!.metadata === "string" ? JSON.parse(row!.metadata) : row!.metadata;
    return normalizeGameInventoryStacks(metadata.gameInventory);
  };
  const stacks = await readStacks();
  const apple = stacks.find((stack) => stack.name === "Apple")!;
  const built = buildGameInventoryOps(stacks, [
    { ...apple, quantity: 5 },
    { name: "Torch", quantity: 2 },
  ]);
  assert.ok("ops" in built);
  const res = await app.inject({
    method: "POST",
    url: "/api/game/inventory",
    payload: { chatId: chat.id, ops: built.ops },
  });
  assert.equal(res.statusCode, 200, res.body);
  assert.ok(
    (res.json().results as Array<{ ok: boolean }>).every((result) => result.ok),
    `every op lands: ${res.body}`,
  );
  const after = (await readStacks()).map((stack) => `${stack.name}:${stack.quantity}`).sort();

  // The touched stacks as opened ride along, checked where the ops are applied: a stack the game
  // changed after the editor's own check is refused, and nothing is applied.
  const nowStacks = await readStacks();
  const appleNow = nowStacks.find((stack) => stack.name === "Apple")!;
  const editOps = buildGameInventoryOps(nowStacks, [
    { ...appleNow, quantity: 9 },
    ...nowStacks.filter((s) => s !== appleNow),
  ]);
  assert.ok("ops" in editOps);
  const expected = gameInventoryOpsExpected(nowStacks, editOps.ops);
  assert.deepEqual(Object.keys(expected), [appleNow.id], "only the touched stacks are sent");
  await app.inject({
    method: "POST",
    url: "/api/game/inventory",
    payload: { chatId: chat.id, ops: [{ op: "set", id: appleNow.id, quantity: 2 }] },
  });
  const raced = await app.inject({
    method: "POST",
    url: "/api/game/inventory",
    payload: { chatId: chat.id, ops: editOps.ops, expected },
  });
  assert.equal(raced.statusCode, 409, raced.body);
  assert.deepEqual(raced.json().stacks, [appleNow.id]);
  assert.equal((await readStacks()).find((s) => s.id === appleNow.id)!.quantity, 2, "the game's change is kept");
  const fresh = await readStacks();
  const retry = await app.inject({
    method: "POST",
    url: "/api/game/inventory",
    payload: { chatId: chat.id, ops: editOps.ops, expected: gameInventoryOpsExpected(fresh, editOps.ops) },
  });
  assert.equal(retry.statusCode, 200, retry.body);
  assert.deepEqual(
    after,
    ["Apple:5", "Torch:2"],
    "the ids worked out on the client are the server's: the edit lands as made",
  );
} finally {
  await chats.remove(chat.id).catch(() => {});
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log("game-data-inventory regression passed");
