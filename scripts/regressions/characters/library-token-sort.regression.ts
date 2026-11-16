import assert from "node:assert/strict";
import {
  compareTokenEstimates,
  isTokenSort,
  TOKEN_SORT_OPTIONS,
} from "../../../packages/shared/src/utils/token-sort.js";
import { sortFoldersByTokens, sortItemsByTokens } from "../../../packages/client/src/lib/panel-sort.js";

process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

// ── Shared comparator and panel helpers ──
assert.deepEqual([...TOKEN_SORT_OPTIONS], ["tokens-desc", "tokens-asc"]);
assert.equal(isTokenSort("tokens-desc"), true);
assert.equal(isTokenSort("tokens"), false, "the old lorebook value is not a size sort by itself");
assert.ok(compareTokenEstimates("tokens-desc", 10, 20) > 0, "most tokens puts the larger one first");
assert.ok(compareTokenEstimates("tokens-asc", 10, 20) < 0, "fewest tokens puts the smaller one first");
assert.equal(compareTokenEstimates("tokens-asc", undefined, 0), 0, "a missing estimate counts as zero");

const items = [
  { name: "Beta", tokens: 5 },
  { name: "Alpha", tokens: 5 },
  { name: "Gamma", tokens: 50 },
];
assert.deepEqual(
  sortItemsByTokens(
    items,
    "tokens-desc",
    (i) => i.tokens,
    (i) => i.name,
  ).map((i) => i.name),
  ["Gamma", "Alpha", "Beta"],
  "ties fall back to name order",
);
assert.deepEqual(
  sortItemsByTokens(
    items,
    "tokens-asc",
    (i) => i.tokens,
    (i) => i.name,
  ).map((i) => i.name),
  ["Alpha", "Beta", "Gamma"],
);
const totals: Record<string, number> = { small: 10, big: 900 };
assert.deepEqual(
  sortFoldersByTokens(
    [
      { id: "small", name: "A" },
      { id: "big", name: "B" },
      { id: "empty", name: "C" },
    ],
    "tokens-desc",
    (folder) => totals[folder.id] ?? 0,
  ).map((folder) => folder.id),
  ["big", "small", "empty"],
);

// ── Character catalog pages ──
const [{ buildApp }, { getDB }, { characters, characterGroups }] = await Promise.all([
  import("../../../packages/server/src/app.js"),
  import("../../../packages/server/src/db/connection.js"),
  import("../../../packages/server/src/db/schema/index.js"),
]);
const app = await buildApp();
try {
  await app.ready();
  const db = await getDB();
  const timestamp = "2026-01-01T00:00:00.000Z";
  // Sizes 1..6 hundred words, inserted out of order.
  const sizes = [3, 1, 6, 2, 5, 4];
  await db.insert(characters).values(
    sizes.map((size) => ({
      id: `size-${size}`,
      data: JSON.stringify({ name: `Card ${size}`, description: "word ".repeat(size * 100) }),
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );
  await db.insert(characterGroups).values([
    {
      id: "folder-small",
      name: "Small",
      characterIds: JSON.stringify(["size-1", "size-2"]),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "folder-big",
      name: "Big",
      characterIds: JSON.stringify(["size-6"]),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]);
  const get = async (query: string) => {
    const response = await app.inject({ method: "GET", url: `/api/characters/catalog?${query}` });
    assert.equal(response.statusCode, 200, response.body);
    return response.json() as {
      items: Array<{ id: string; tokenEstimate: number }>;
      hasMore: boolean;
      folderTokenTotals?: Record<string, number>;
    };
  };
  const ids = (page: { items: Array<{ id: string }> }) =>
    page.items.map((item) => item.id).filter((id) => id.startsWith("size-"));

  const desc = await get("view=summary&sort=tokens-desc");
  assert.deepEqual(ids(desc), ["size-6", "size-5", "size-4", "size-3", "size-2", "size-1"]);
  const asc = await get("view=summary&sort=tokens-asc");
  assert.deepEqual(ids(asc), ["size-1", "size-2", "size-3", "size-4", "size-5", "size-6"]);

  // Paged: the second page continues the order instead of restarting it.
  const first = await get("sort=tokens-desc&limit=3&offset=0");
  const second = await get("sort=tokens-desc&limit=3&offset=3");
  assert.deepEqual([...ids(first), ...ids(second)], ids(desc));

  const byId = new Map(desc.items.map((item) => [item.id, item.tokenEstimate]));
  assert.deepEqual(desc.folderTokenTotals, {
    "folder-small": byId.get("size-1")! + byId.get("size-2")!,
    "folder-big": byId.get("size-6")!,
  });
  assert.equal((await get("view=summary&sort=name-asc")).folderTokenTotals?.["folder-big"], undefined);
} finally {
  await app.close();
}

process.stdout.write("Library token sort regression passed.\n");
