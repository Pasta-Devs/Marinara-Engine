import assert from "node:assert/strict";
import type { CharacterCatalogEntry } from "../../packages/shared/src/types/character-catalog.js";
import { toCharacterCatalogSummary } from "../../packages/server/src/services/storage/character-catalog.js";

process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

const full: CharacterCatalogEntry & { searchText: string; cardSpec: string; cardSpecVersion: string } = {
  id: "char-1",
  name: "Example",
  comment: "Alias",
  creator: "Creator",
  version: "2",
  tags: ["tag"],
  favorite: true,
  summary: `  ${"long ".repeat(60)}  `,
  explicitSummary: "private explicit summary",
  description: "private description",
  personality: "private personality",
  scenario: "private scenario",
  firstMessage: "private first message",
  creatorNotes: "private creator notes",
  tokenEstimate: 45,
  hasOnboarding: true,
  nameColor: "red",
  avatarPath: "/avatar.png",
  avatarCrop: { x: 1 },
  createdAt: "2026-01-01",
  updatedAt: "2026-01-02",
  cardSpec: "chara_card_v2",
  cardSpecVersion: "2.0",
  searchText: "private searchable text",
};

const summary = toCharacterCatalogSummary(full);
assert.equal(summary.summary.length, 200);
assert.equal(summary.summary.startsWith("long "), true);
assert.deepEqual(
  Object.keys(summary).sort(),
  [
    "id",
    "name",
    "comment",
    "creator",
    "version",
    "tags",
    "favorite",
    "summary",
    "tokenEstimate",
    "hasOnboarding",
    "nameColor",
    "avatarPath",
    "avatarCrop",
    "createdAt",
    "updatedAt",
    "cardSpec",
    "cardSpecVersion",
  ].sort(),
);
assert.equal(summary.cardSpec, "chara_card_v2");
assert.equal(full.description, "private description", "slimming does not mutate cached full rows");

const [{ buildApp }, { getDB }, { characters, characterGroups }] = await Promise.all([
  import("../../packages/server/src/app.js"),
  import("../../packages/server/src/db/connection.js"),
  import("../../packages/server/src/db/schema/index.js"),
]);
const app = await buildApp();
try {
  await app.ready();
  const db = await getDB();
  const timestamp = "2026-01-01T00:00:00.000Z";
  await db.insert(characters).values(
    Array.from({ length: 105 }, (_, index) => ({
      id: `summary-${String(index).padStart(3, "0")}`,
      data: JSON.stringify({
        name: `Character ${index}`,
        tags: index === 104 ? ["only-last"] : index === 103 ? ["ＲＰＧ", "Science  Fiction"] : [],
        description: index === 104 ? "needle hidden in long description" : "long card text ".repeat(200),
        extensions: { fav: index === 104 },
      }),
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );
  await db.insert(characterGroups).values({
    id: "summary-folder",
    name: "Folder",
    characterIds: JSON.stringify(["summary-104"]),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const get = async (query: string) => {
    const response = await app.inject({ method: "GET", url: `/api/characters/catalog?${query}` });
    assert.equal(response.statusCode, 200, response.body);
    return response.json() as {
      items: Array<{ id: string; summary: string; description?: string }>;
      total: number;
      limit: number;
      hasMore: boolean;
      favoriteFolderIds: string[];
    };
  };
  const fullPage = await get("limit=999");
  assert.equal(fullPage.items.length, 100, "default view retains its 100-row page limit");
  assert.equal(fullPage.hasMore, true);
  const all = await get("view=summary&limit=1&offset=1000");
  assert.equal(all.items.length, 105, "summary view ignores paging and returns the whole library");
  assert.equal(all.total, 105);
  assert.equal(all.hasMore, false);
  assert.equal(all.items[0]?.description, undefined);
  assert.deepEqual(all.favoriteFolderIds, ["summary-folder"]);
  const matched = await get("view=summary&search=needle&folder=any&tag=only-last");
  assert.deepEqual(
    matched.items.map((item) => item.id),
    ["summary-104"],
  );
  assert.equal(matched.total, 1);
  assert.equal(matched.items[0]?.description, undefined, "search matches full text before slimming");
  assert.deepEqual((await get("view=summary&search=needle&folder=none")).items, []);
  // Typed exclusions arrive normalized, so stored tags must be normalized the same way (NFKC, case, spaces).
  for (const tag of ["rpg", "science fiction"]) {
    const excluded = await get(`view=summary&excludeTag=${encodeURIComponent(tag)}`);
    assert.equal(excluded.total, 104, `excludeTag=${tag} drops the full-width / double-spaced tag`);
    assert.equal(
      excluded.items.some((item) => item.id === "summary-103"),
      false,
    );
  }
} finally {
  await app.close();
}

process.stdout.write("Character catalog summary regression passed.\n");
