import assert from "node:assert/strict";

// #9114: GET /api/characters returned the whole library as one JSON string when no paging parameters were given.
// On a 21k-card library that single string passed V8's maximum length, JSON.stringify threw, and the client's
// character pickers showed "No characters available". Every response is one bounded page now, and callers that
// want the library drain the pages.
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
const [{ buildApp }, { getDB }, { characters }, { PROFESSOR_MARI_ID }] = await Promise.all([
  import("../../packages/server/src/app.js"),
  import("../../packages/server/src/db/connection.js"),
  import("../../packages/server/src/db/schema/index.js"),
  import("../../packages/shared/src/constants/defaults.js"),
]);
const app = await buildApp();
try {
  await app.ready();
  const db = await getDB();
  const timestamp = "2020-01-01T00:00:00.000Z";
  const count = 250;
  await db.insert(characters).values(
    Array.from({ length: count }, (_, index) => ({
      id: `paged-card-${String(index).padStart(3, "0")}`,
      // One card nearly a megabyte: a whole library of these is what made the unpaged response impossible.
      data: JSON.stringify({ name: `Paged ${index}`, description: "x".repeat(900_000) }),
      createdAt: timestamp,
      updatedAt: new Date(Date.parse(timestamp) + index * 1000).toISOString(),
    })),
  );
  // The built-in is on disk from startup in some builds and absent in others; either way it must be there.
  const mari = await app.inject({ method: "GET", url: `/api/characters/${PROFESSOR_MARI_ID}` });
  if (mari.statusCode !== 200) {
    await db.insert(characters).values({
      id: PROFESSOR_MARI_ID,
      data: JSON.stringify({ name: "Professor Mari" }),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const page = (query: string) => app.inject({ method: "GET", url: `/api/characters${query}` });
  const first = await page("");
  assert.equal(first.statusCode, 200, first.body.slice(0, 200));
  const firstPage = first.json() as { items: Array<{ id: string }>; limit: number; offset: number; hasMore: boolean };
  assert.equal(Array.isArray(firstPage.items), true, "a bare request answers a page, not the whole library");
  assert.equal(firstPage.items.length, 100, "a page is capped at the library page size");
  assert.equal(firstPage.hasMore, true);
  assert.equal(
    firstPage.items.some((item) => item.id === PROFESSOR_MARI_ID),
    false,
    "the built-in stays out unless it is asked for",
  );

  // Draining the pages the way the client does yields the whole library, once each, newest first.
  const ids: string[] = [];
  for (let offset = 0; ;) {
    const response = await page(`?limit=100&offset=${offset}`);
    assert.equal(response.statusCode, 200, response.body.slice(0, 200));
    const current = response.json() as { items: Array<{ id: string }>; offset: number; hasMore: boolean };
    ids.push(...current.items.map((item) => item.id));
    if (!current.hasMore) break;
    offset = current.offset + current.items.length;
  }
  assert.equal(ids.length, count, "every card arrives across the pages");
  assert.equal(new Set(ids).size, count, "no card arrives twice");
  const stamps = ids.map((id) => Number(id.slice("paged-card-".length)));
  assert.deepEqual(
    stamps,
    [...stamps].sort((a, b) => b - a),
    "the pages keep the newest-first order the list always had",
  );

  const withBuiltIn = await page("?includeBuiltIn=true&limit=100");
  assert.equal(
    (withBuiltIn.json() as { items: Array<{ id: string }> }).items.some((item) => item.id === PROFESSOR_MARI_ID),
    true,
    "the built-in is included when it is asked for",
  );

  // A card's own route still carries its whole body; only the list is bounded.
  const detail = await app.inject({ method: "GET", url: "/api/characters/paged-card-007" });
  assert.equal(detail.statusCode, 200);
  assert.equal((detail.json() as { data: string }).data.length > 800_000, true, "the by-id route is unchanged");

  console.info(`Character list pages: ${count} cards drained in ${Math.ceil(count / 100)} bounded pages.`);
} finally {
  await app.close();
}
