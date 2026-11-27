import assert from "node:assert/strict";

// The overhaul Characters page sends its search, tag selector and Favorites to the catalog route, so a card
// past the first loaded page is found without "Load all", whatever the letter case of the search.
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
const [{ buildApp }, { getDB }, { characters }] = await Promise.all([
  import("../../../packages/server/src/app.js"),
  import("../../../packages/server/src/db/connection.js"),
  import("../../../packages/server/src/db/schema/index.js"),
]);
const app = await buildApp();
try {
  await app.ready();
  const db = await getDB();
  const timestamp = "2020-01-01T00:00:00.000Z";
  const rows = [
    // 150 cards whose names sort before the target, so it is not on the first page of 100.
    ...Array.from({ length: 150 }, (_, index) => ({
      id: `name-search-noise-${String(index).padStart(3, "0")}`,
      data: { name: `Aaron ${index}`, description: "Mentions Zion in passing.", tags: ["noise"] },
    })),
    {
      id: "name-search-zion",
      data: { name: "Zion", tags: ["Male", "Dominant"], extensions: { fav: true, nameAliases: ["The Lion"] } },
    },
    { id: "name-search-untagged", data: { name: "Zz Untagged", tags: [] } },
  ];
  await db
    .insert(characters)
    .values(
      rows.map((row) => ({ id: row.id, data: JSON.stringify(row.data), createdAt: timestamp, updatedAt: timestamp })),
    );

  type CatalogBody = { items: { id: string }[]; total: number; hasMore: boolean };
  const catalog = async (query: string) => {
    const response = await app.inject({
      method: "GET",
      url: `/api/characters/catalog?limit=100&offset=0&sort=name-asc&${query}`,
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json() as CatalogBody;
  };
  const ids = (body: CatalogBody) => body.items.map((row) => row.id);

  // Without a search the first page stops before the target: paging stays for the plain list.
  const plain = await catalog("");
  assert.equal(plain.hasMore, true);
  assert.ok(!ids(plain).includes("name-search-zion"));

  // Names search: any case, and other names; card text that only mentions the name does not count.
  for (const search of ["Zion", "zion", "ZION", "ｚｉｏｎ"]) {
    const body = await catalog(`searchIn=names&search=${encodeURIComponent(search)}`);
    assert.deepEqual(ids(body), ["name-search-zion"], search);
    assert.equal(body.hasMore, false);
  }
  assert.deepEqual(ids(await catalog("searchIn=names&search=the%20lion")), ["name-search-zion"]);
  assert.deepEqual(ids(await catalog("searchIn=names&search=tag%3Adomin")), ["name-search-zion"]);
  // A tag word matches like on the page (substring of a tag).
  assert.deepEqual(ids(await catalog("searchIn=names&search=domin")), ["name-search-zion"]);
  // The classic full-text search is unchanged.
  assert.equal((await catalog("search=zion")).total, 151);

  // Tag selector: every picked tag (any case), untagged, and Favorites, all past the first page.
  assert.deepEqual(ids(await catalog("tag=male&tag=DOMINANT&tagMatch=all")), ["name-search-zion"]);
  assert.deepEqual(ids(await catalog("tag=male&tag=noise&tagMatch=all")), []);
  assert.equal((await catalog("tag=male&tag=noise")).total, 151);
  assert.deepEqual(ids(await catalog("untagged=true")), ["name-search-untagged"]);
  assert.deepEqual(ids(await catalog("favoriteFilter=favorites")), ["name-search-zion"]);

  const counts = (await app.inject({ method: "GET", url: "/api/characters/catalog/tag-counts" })).json() as {
    tags: { tag: string; count: number }[];
    untagged: number;
    favorites: number;
    total: number;
  };
  assert.deepEqual(
    counts.tags.find((entry) => entry.tag === "noise"),
    { tag: "noise", count: 150 },
  );
  assert.equal(counts.untagged, 1);
  assert.equal(counts.favorites, 1);
  assert.equal(counts.total, 152);
} finally {
  await app.close();
}
console.info("Character library names search reaches every page (152 characters).");
