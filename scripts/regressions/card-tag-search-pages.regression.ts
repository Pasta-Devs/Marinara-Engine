import assert from "node:assert/strict";

// The regression runner supplies a disposable DATA_DIR. Exercise the actual routes,
// including storage filtering before pagination, rather than mock search results.
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
const [{ buildApp }, { getDB }, { characters, characterGroups, personas }] = await Promise.all([
  import("../../packages/server/src/app.js"),
  import("../../packages/server/src/db/connection.js"),
  import("../../packages/server/src/db/schema/index.js"),
]);
const app = await buildApp();
try {
  await app.ready();
  const db = await getDB();
  const timestamp = "2020-01-01T00:00:00.000Z";
  const fixtures = [
    ...Array.from({ length: 110 }, (_, index) => ({
      id: `tag-search-noise-${String(index).padStart(3, "0")}`,
      name: `Noise ${index}`,
      tags: index % 2 ? ["female", "genshin"] : ["male", "romance"],
    })),
    { id: "tag-search-target-a", name: "Target A", tags: ["Male", "Genshin", "Modern AU", "fatui, harbinger"] },
    { id: "tag-search-target-b", name: "Target B", tags: ["Genshin", "ＭＡＬＥ", "Modern AU"] },
    { id: "tag-search-text", name: "male genshin", tags: [] },
  ];
  await db.insert(characters).values(
    fixtures.map((row) => ({
      id: row.id,
      data: JSON.stringify({ name: row.name, tags: row.tags, extensions: { fav: row.id.endsWith("-a") } }),
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );
  await db.insert(personas).values(
    fixtures.map((row) => ({
      id: row.id,
      name: row.name,
      tags: JSON.stringify(row.tags),
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );

  // Corrupt or older storage rows must not throw or acquire tag matches.
  const invalidTags = [null, {}, "male", [], ["female", "genshin"], ["male", 12], ["genshin", false]];
  await db.insert(characters).values(
    invalidTags.map((tags, index) => ({
      id: `tag-search-invalid-${index}`,
      data: JSON.stringify({ name: "Malformed tag fixture", tags }),
      createdAt: "2022-01-01T00:00:00.000Z",
      updatedAt: timestamp,
    })),
  );
  await db.insert(personas).values(
    invalidTags.map((tags, index) => ({
      id: `tag-search-invalid-${index}`,
      name: "Malformed tag fixture",
      tags: JSON.stringify(tags),
      createdAt: "2022-01-01T00:00:00.000Z",
      updatedAt: timestamp,
    })),
  );
  await db
    .insert(characters)
    .values({ id: "tag-search-invalid-json", data: "{", createdAt: timestamp, updatedAt: timestamp });
  await db.insert(personas).values({
    id: "tag-search-invalid-json",
    name: "Malformed JSON fixture",
    tags: "{",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const getPage = async (endpoint: string, search: string, limit = 100, offset = 0, extra = "") => {
    const response = await app.inject({
      method: "GET",
      url: `${endpoint}?search=${encodeURIComponent(search)}&sort=oldest&limit=${limit}&offset=${offset}${extra}`,
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json() as { items: { id: string }[]; hasMore: boolean; offset: number; limit: number };
  };
  for (const endpoint of ["/api/characters/catalog", "/api/characters", "/api/characters/personas/list"]) {
    const first = await getPage(endpoint, "");
    assert.equal(first.items.length, 100);
    assert.equal(
      first.items.some((row) => row.id.startsWith("tag-search-target")),
      false,
    );
    const all = await getPage(endpoint, "male genshin");
    assert.deepEqual(all.items.map((row) => row.id).sort(), [
      "tag-search-target-a",
      "tag-search-target-b",
      "tag-search-text",
    ]);
    assert.equal(all.hasMore, false);
    const page1 = await getPage(endpoint, "male,genshin", 1);
    const page2 = await getPage(endpoint, "male,genshin", 1, 1);
    assert.deepEqual(
      page1.items.map((row) => row.id),
      ["tag-search-target-a"],
    );
    assert.equal(page1.hasMore, true);
    assert.deepEqual(
      page2.items.map((row) => row.id),
      ["tag-search-target-b"],
    );
    assert.equal(page2.hasMore, false);
    assert.equal(page2.offset, 1);
    for (const query of ['male "Modern AU"', "MALE,genshin", "male，genshin", "male ＂Modern AU＂"]) {
      assert.deepEqual(
        (await getPage(endpoint, query)).items.map((row) => row.id),
        ["tag-search-target-a", "tag-search-target-b"],
      );
    }
    assert.deepEqual(
      (await getPage(endpoint, 'male "fatui, harbinger"')).items.map((row) => row.id),
      ["tag-search-target-a"],
    );
    assert.deepEqual(
      (await getPage(endpoint, "Target A")).items.map((row) => row.id),
      ["tag-search-target-a"],
    );
    assert.deepEqual((await getPage(endpoint, "male missingtag")).items, []);
    assert.deepEqual((await getPage(endpoint, ",,,")).items, []);
    if (!endpoint.endsWith("personas/list")) {
      assert.deepEqual(
        (await getPage(endpoint, "male genshin", 100, 0, "&favoriteFilter=favorites")).items.map((row) => row.id),
        ["tag-search-target-a"],
      );
    }
  }

  // Tag chips, excluded tags and folders filter on the server, so they cover cards outside loaded pages.
  type CatalogBody = { items: { id: string }[]; total: number; favoriteFolderIds: string[] };
  const catalog = async (search: string, extra: string) =>
    (await getPage("/api/characters/catalog", search, 100, 0, extra)) as unknown as CatalogBody;
  const ids = (body: CatalogBody) => body.items.map((row) => row.id);
  const modernAu = await catalog("", "&tag=modern%20au");
  assert.deepEqual(ids(modernAu).sort(), ["tag-search-target-a", "tag-search-target-b"]);
  assert.equal(modernAu.total, 2);
  assert.equal(ids(await catalog("", "&tag=Genshin&tag=FATUI%2C%20HARBINGER"))[0], "tag-search-target-a");
  assert.deepEqual(ids(await catalog("Target", "&excludeTag=Fatui%2C%20Harbinger")), ["tag-search-target-b"]);
  await db.insert(characterGroups).values({
    id: "tag-search-folder",
    name: "Folder",
    characterIds: JSON.stringify(["tag-search-target-a"]),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const rootOnly = await catalog("Target", "&folder=none");
  assert.deepEqual(ids(rootOnly), ["tag-search-target-b"]);
  assert.deepEqual(rootOnly.favoriteFolderIds, ["tag-search-folder"]);
  assert.deepEqual(ids(await catalog("Target", "&folder=any")), ["tag-search-target-a"]);
  assert.deepEqual(ids(await catalog("", "&folder=tag-search-folder")), ["tag-search-target-a"]);
  const tags = await app.inject({ method: "GET", url: "/api/characters/catalog/tags" });
  assert.ok((tags.json() as string[]).includes("Modern AU"));
} finally {
  await app.close();
}
console.info("Card tag search pagination routes passed (113 characters and personas).");
