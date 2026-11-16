import assert from "node:assert/strict";
import {
  compareTokenEstimates,
  isTokenSort,
  TOKEN_SORT_OPTIONS,
} from "../../../packages/shared/src/utils/token-sort.js";
import { estimatePersonaTokens } from "../../../packages/shared/src/utils/character-token-estimator.js";
import { normalizeLorebookPanelSort } from "../../../packages/client/src/stores/ui.store.js";
import {
  normalizeLibrarySort,
  sortFoldersByTokens,
  sortItemsByTokens,
} from "../../../packages/client/src/lib/panel-sort.js";

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

// The old Token Budget lorebook sort lands on the size sort that replaced it.
assert.equal(normalizeLorebookPanelSort("tokens"), "tokens-desc");
assert.equal(normalizeLorebookPanelSort("tokens-asc"), "tokens-asc");
assert.equal(normalizeLorebookPanelSort("bogus"), "name-asc");
// The old hidden persona "Tokens" sort lands on Most tokens too.
assert.equal(normalizeLibrarySort("tokens"), "tokens-desc");
assert.equal(normalizeLibrarySort("bogus"), "name-asc");

// One persona estimate counts the six text fields and ignores non-strings.
assert.equal(estimatePersonaTokens({ description: "abcd".repeat(4), mes_example: "abcd".repeat(4) }), 8);
assert.equal(estimatePersonaTokens({ description: 5, personality: null }), 0);

// ── Character catalog pages ──
const [{ buildApp }, { getDB }, schema] = await Promise.all([
  import("../../../packages/server/src/app.js"),
  import("../../../packages/server/src/db/connection.js"),
  import("../../../packages/server/src/db/schema/index.js"),
]);
const { characters, characterGroups, personas, lorebooks, lorebookEntries, promptPresets, promptSections } = schema;
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

  // ── Persona pages ──
  const personaSizes = [3, 1, 2];
  await db.insert(personas).values(
    personaSizes.map((size) => ({
      id: `psize-${size}`,
      data: JSON.stringify({ name: `Persona ${size}`, description: "word ".repeat(size * 100) }),
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );
  const personaPage = async (query: string) => {
    const response = await app.inject({ method: "GET", url: `/api/characters/personas/list?${query}` });
    assert.equal(response.statusCode, 200, response.body);
    return response.json() as { items: Array<{ id: string }>; hasMore: boolean };
  };
  const personaIds = (page: { items: Array<{ id: string }> }) => page.items.map((item) => item.id);
  assert.deepEqual(personaIds(await personaPage("sort=tokens-desc&limit=10&offset=0")), [
    "psize-3",
    "psize-2",
    "psize-1",
  ]);
  const personaFirst = await personaPage("sort=tokens-asc&limit=2&offset=0");
  const personaSecond = await personaPage("sort=tokens-asc&limit=2&offset=2");
  assert.deepEqual([...personaIds(personaFirst), ...personaIds(personaSecond)], ["psize-1", "psize-2", "psize-3"]);
  assert.equal(personaFirst.hasMore, true);

  // ── Lorebooks: size is the sum of every entry, enabled or not ──
  const bookSizes: Array<[string, number[], string]> = [
    ["book-mid", [100], "true"],
    ["book-big", [100, 300], "false"],
    ["book-small", [10], "true"],
  ];
  for (const [id, entrySizes] of bookSizes.map(([bookId, sizes]) => [bookId, sizes] as const)) {
    await db.insert(lorebooks).values({ id, name: id, createdAt: timestamp, updatedAt: timestamp });
    for (const [index, size] of entrySizes.entries()) {
      const disabled = id === "book-big" && index === 1;
      await db.insert(lorebookEntries).values({
        id: `${id}-entry-${index}`,
        lorebookId: id,
        name: `Entry ${index}`,
        content: "word ".repeat(size),
        enabled: disabled ? "false" : "true",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }
  const bookPage = async (query: string) => {
    const response = await app.inject({ method: "GET", url: `/api/lorebooks?${query}` });
    assert.equal(response.statusCode, 200, response.body);
    return response.json() as { items: Array<{ id: string; tokenEstimate: number; entryCount: number }> };
  };
  const everyBook = (await bookPage("sort=tokens-desc&limit=10&offset=0")).items;
  assert.deepEqual(
    everyBook.map((book) => book.id),
    ["book-big", "book-mid", "book-small"],
  );
  const bookTokens = new Map(everyBook.map((book) => [book.id, book.tokenEstimate]));
  assert.ok(bookTokens.get("book-big")! > bookTokens.get("book-mid")!, "the disabled entry still counts");
  assert.ok(bookTokens.get("book-mid")! > bookTokens.get("book-small")!);
  assert.equal(everyBook.find((book) => book.id === "book-big")?.entryCount, 2);
  const smallestFirst = await bookPage("sort=tokens-asc&limit=2&offset=0");
  assert.deepEqual(
    smallestFirst.items.map((book) => book.id),
    ["book-small", "book-mid"],
  );
  assert.deepEqual(
    (await bookPage("sort=tokens-asc&limit=2&offset=2")).items.map((book) => book.id),
    ["book-big"],
  );
  // A folder ranks by all its matching books, also the ones on a page not loaded yet.
  await db.insert(schema.libraryFolders).values({
    id: "lore-folder",
    scope: "lorebooks",
    name: "Lore folder",
    itemIds: JSON.stringify(["book-big", "book-small", "missing-book"]),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const firstSmallPage = (await bookPage("sort=tokens-asc&limit=1&offset=0")) as unknown as {
    folderTokenTotals?: Record<string, number>;
  };
  assert.equal(
    firstSmallPage.folderTokenTotals?.["lore-folder"],
    bookTokens.get("book-big")! + bookTokens.get("book-small")!,
  );

  // ── Presets: enabled static sections only ──
  await db
    .insert(promptPresets)
    .values({ id: "preset-sized", name: "Sized", createdAt: timestamp, updatedAt: timestamp });
  const sectionRows = [
    { id: "ps-text", content: "abcdefghijkl", enabled: "true", isMarker: "false" },
    { id: "ps-off", content: "abcdefghijkl".repeat(10), enabled: "false", isMarker: "false" },
    { id: "ps-marker", content: "abcdefghijkl".repeat(10), enabled: "true", isMarker: "true" },
  ];
  for (const row of sectionRows) {
    await db.insert(promptSections).values({
      ...row,
      presetId: "preset-sized",
      identifier: row.id,
      name: row.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  const presetList = await app.inject({ method: "GET", url: "/api/prompts" });
  assert.equal(presetList.statusCode, 200, presetList.body);
  const sized = (presetList.json() as Array<{ id: string; tokenEstimate?: number }>).find(
    (preset) => preset.id === "preset-sized",
  );
  assert.equal(sized?.tokenEstimate, 3, "an enabled text section counts; a disabled one and a marker do not");
} finally {
  await app.close();
}

process.stdout.write("Library token sort regression passed.\n");
