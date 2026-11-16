// PlotLight Card Browser source (#7480): maps untrusted API items, follows
// `next_offset` instead of guessing pages, and honors rate limits — against a
// fake PlotLight server.
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createPlotLightClient,
  PLOTLIGHT_PAGE_SIZE,
  PlotLightError,
  type PlotLightItem,
} from "../../../packages/client/src/lib/plotlight-content.js";

const CARD_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const PERSONA_ID = "33333333-3333-4333-8333-333333333333";

const requests: URL[] = [];
const credentialModes: Array<RequestCredentials | undefined> = [];
let rateLimited = false;
let searchExhausted = false;
let slowSearch: Promise<void> | null = null;

// The tag catalog, served 100 per page like PlotLight. Names and slugs differ, one name has
// two slugs, and two tags are adult ("After Dark") labels.
const TAG_CATALOG = [
  { name: "Fantasy", slug: "genre-fantasy", rating: "all_hours", requires_after_dark: false },
  { name: "Horror", slug: "genre-horror", rating: "late_night", requires_after_dark: false },
  { name: "Elf", slug: "species_elf", rating: "all_hours", requires_after_dark: false },
  { name: "Superhero", slug: "genre-superhero", rating: "all_hours", requires_after_dark: false },
  { name: "Superhero", slug: "occupation_superhero", rating: "all_hours", requires_after_dark: false },
  { name: "Erotic", slug: "genre-erotic", rating: "after_dark", requires_after_dark: true },
  ...Array.from({ length: 150 }, (_, i) => ({ name: `Filler ${i}`, slug: `filler_${i}`, rating: "all_hours" })),
  { name: "Bondage", slug: "kink_bondage", rating: "after_dark", requires_after_dark: true },
];

function item(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: "characters",
    name: ` Card ${id.slice(0, 4)} `,
    description: "A mage who guards a forest.",
    image_url: "https://images.example/forest.webp",
    creator: { name: "Example Creator", username: "example" },
    tags: [{ id: "t1", name: "Fantasy", slug: "genre-fantasy", category: "genre" }],
    detail_url: `/discovery/characters/${id}`,
    downloads: {
      png3: `/api/v1/content/characters/${id}/download?format=png3`,
      json3: `/api/v1/content/characters/${id}/download?format=json3`,
    },
    ...extra,
  };
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", "http://fake.test");
  requests.push(url);
  if (rateLimited) return send(res, 429, { error: "Rate limited" }, { "Retry-After": "7" });

  if (url.pathname === "/api/v1/content/tags") {
    assert.equal(url.searchParams.get("include_after_dark"), "true", "the catalog lists adult tag labels");
    const offset = Number(url.searchParams.get("offset"));
    const limit = Number(url.searchParams.get("limit"));
    const end = offset + limit < TAG_CATALOG.length;
    return send(res, 200, {
      data: TAG_CATALOG.slice(offset, offset + limit),
      pagination: { limit, offset, has_more: end, next_offset: end ? offset + limit : null },
    });
  }

  if (url.pathname === "/api/v1/content/cards") {
    // Searching and exporting are limited separately.
    const searchHeaders: Record<string, string> = searchExhausted
      ? { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(Math.ceil((clock + 60_000) / 1000)) }
      : {};
    const query = url.searchParams.get("q");
    const offset = Number(url.searchParams.get("offset"));
    if (query === "slow") {
      await slowSearch;
      return send(res, 200, { data: [item(SECOND_ID)], pagination: { limit: 48, offset, next_offset: 500 } });
    }
    if (query === "fast") {
      return send(res, 200, { data: [item(CARD_ID)], pagination: { limit: 48, offset, next_offset: 48 } });
    }
    if (query === "empty") {
      // Empty pages past the automatic skips: paging must not end.
      return send(res, 200, { data: [], pagination: { limit: 48, offset, next_offset: offset + 48 } });
    }
    if (query === "adult") {
      return send(
        res,
        200,
        {
          data: [
            item(CARD_ID, { tags: [{ name: "Erotic", slug: "genre-erotic" }] }),
            item(SECOND_ID, { tags: [{ name: "Bondage", slug: "kink_bondage" }] }),
            item(PERSONA_ID, { tags: [{ name: "Horror", slug: "genre-horror" }] }),
          ],
          pagination: { limit: 48, offset: 0, next_offset: null },
        },
        searchHeaders,
      );
    }
    if (offset === 0) {
      return send(res, 200, {
        data: [
          item(CARD_ID),
          // Untrusted rows: a bad id and a nameless card are dropped; hostile links are discarded.
          item("not-a-uuid"),
          item(SECOND_ID, { name: "   " }),
          item(SECOND_ID, {
            image_url: "http://images.example/plain.png",
            detail_url: "javascript:alert(1)",
            creator: { name: "", username: "fallback-user" },
            downloads: { png3: "https://evil.example/card.png", json: "/api/v1/content/characters/x?format=json" },
            tags: [{ name: "No slug" }, "bogus"],
          }),
        ],
        // A short page still has more: PlotLight filters after paging.
        pagination: { limit: PLOTLIGHT_PAGE_SIZE, offset: 0, has_more: true, next_offset: 60 },
      });
    }
    if (offset === 60) {
      return send(res, 200, { data: [], pagination: { limit: 48, offset: 60, has_more: true, next_offset: 108 } });
    }
    if (offset === 108) {
      return send(res, 200, { data: [item(SECOND_ID)], pagination: { limit: 48, offset: 108, next_offset: null } });
    }
    return send(res, 400, { error: "unexpected offset" });
  }

  if (url.pathname === `/api/v1/content/characters/${CARD_ID}/download`) {
    // The preferred PNG is missing, so the download falls back to V3 JSON.
    if (url.searchParams.get("format") === "png3") return send(res, 404, { error: "Resource not found" });
    return send(res, 200, {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: { name: "Forest Mage", description: "Guards a forest.", tags: [], creator: "" },
    });
  }

  if (url.pathname === `/api/v1/content/personas/${PERSONA_ID}/download`) {
    return send(res, 403, { error: "Not exportable" });
  }

  return send(res, 404, { error: "Resource not found" });
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
let clock = 1_000_000;
const client = createPlotLightClient({
  baseUrl,
  now: () => clock,
  fetchImpl: (input, init) => {
    credentialModes.push(init?.credentials);
    return fetch(input, init);
  },
});

try {
  const search = {
    type: "cards" as const,
    query: " forest ",
    sort: "popular" as const,
    includeTags: [],
    excludeTags: [],
  };
  const searches = () => requests.filter((url) => url.pathname !== "/api/v1/content/tags");
  const first = await client.searchPage(search, 1);
  const firstRequest = searches().at(-1)!;
  assert.equal(firstRequest.searchParams.get("q"), "forest");
  assert.equal(firstRequest.searchParams.get("sort"), "popular");
  assert.equal(firstRequest.searchParams.get("limit"), String(PLOTLIGHT_PAGE_SIZE));
  assert.equal(firstRequest.searchParams.get("offset"), "0");
  assert.equal(firstRequest.searchParams.has("tags"), false, "empty tag lists are omitted");
  assert.ok(
    credentialModes.every((mode) => mode === "omit"),
    "PlotLight is called without credentials",
  );

  assert.equal(first.hasMore, true, "a short page with a next_offset is not the end");
  assert.deepEqual(
    first.items.map((card) => card.id),
    [CARD_ID, SECOND_ID],
    "rows with a bad id or no name are dropped",
  );
  const [mapped, hostile] = first.items as [PlotLightItem, PlotLightItem];
  assert.equal(mapped.name, `Card ${CARD_ID.slice(0, 4)}`);
  assert.equal(mapped.creator, "Example Creator");
  assert.equal(mapped.imageUrl, "https://images.example/forest.webp");
  assert.equal(mapped.detailUrl, `${baseUrl}/discovery/characters/${CARD_ID}`);
  assert.deepEqual(mapped.tags, [{ name: "Fantasy", slug: "genre-fantasy" }]);
  assert.equal(mapped.downloads.png3, `${baseUrl}/api/v1/content/characters/${CARD_ID}/download?format=png3`);
  assert.equal(hostile.imageUrl, "", "preview images must be https");
  assert.equal(hostile.detailUrl, baseUrl, "a link off PlotLight falls back to PlotLight itself");
  assert.equal(hostile.creator, "fallback-user");
  assert.deepEqual(hostile.tags, []);
  assert.deepEqual(
    hostile.downloads,
    { json: `${baseUrl}/api/v1/content/characters/x?format=json` },
    "downloads must stay on PlotLight",
  );

  // Page 2 starts at page 1's next_offset, and an empty page is skipped while more remain.
  const second = await client.searchPage(search, 2);
  assert.deepEqual(
    searches()
      .slice(-2)
      .map((url) => url.searchParams.get("offset")),
    ["60", "108"],
  );
  assert.deepEqual(
    second.items.map((card) => card.id),
    [SECOND_ID],
  );
  assert.equal(second.hasMore, false, "a null next_offset ends paging");

  // Empty pages beyond the automatic skips still report more, so the pager stays.
  assert.deepEqual(await client.searchPage({ ...search, query: "empty" }, 1), { items: [], hasMore: true });

  // Tag names, typed or from results, are sent as the catalog's slugs.
  await client.searchPage(
    { ...search, includeTags: ["fantasy", "elf"], excludeTags: ["Horror", "superhero", "kink_bondage"] },
    1,
  );
  assert.equal(searches().at(-1)!.searchParams.get("tags"), "genre-fantasy,species_elf");
  assert.equal(
    searches().at(-1)!.searchParams.get("exclude_tags"),
    "genre-horror,genre-superhero,occupation_superhero,kink_bondage",
    "an excluded name removes every slug it names",
  );
  // PlotLight has no "any of" filter, so a shared name includes one slug; unknown names match nothing.
  await client.searchPage({ ...search, includeTags: ["Superhero", "made-up"] }, 1);
  assert.equal(searches().at(-1)!.searchParams.get("tags"), "genre-superhero,made-up");

  // Results carrying an adult (After Dark) tag are marked; late-night tags are not adult.
  const adult = await client.searchPage({ ...search, query: "adult" }, 1);
  assert.deepEqual(
    adult.items.map((card) => card.adult),
    [true, true, false],
  );
  assert.equal(
    first.items.some((card) => card.adult),
    false,
  );

  // A slower, older search can't set the newer search's next page.
  let releaseSlow = () => {};
  slowSearch = new Promise<void>((resolve) => {
    releaseSlow = () => resolve();
  });
  const slow = client.searchPage({ ...search, query: "slow" }, 1);
  await client.searchPage({ ...search, query: "fast" }, 1);
  releaseSlow();
  await slow;
  await client.searchPage({ ...search, query: "fast" }, 2);
  assert.equal(searches().at(-1)!.searchParams.get("offset"), "48");

  // The catalog loads once per content type, a few pages at a time.
  assert.equal(requests.length - searches().length, 4);

  // An exhausted search allowance pauses searching but not downloads: PlotLight limits them separately.
  searchExhausted = true;
  await client.searchPage({ ...search, query: "adult" }, 1);
  searchExhausted = false;
  await assert.rejects(
    client.searchPage(search, 1),
    (error) => error instanceof PlotLightError && error.status === 429 && error.retryAfterSeconds === 60,
  );

  // Import prefers png3, falls back to JSON, and keeps the listing's attribution.
  const card = await client.downloadCard(mapped, ["png3", "json3", "json"]);
  assert.deepEqual(
    requests.slice(-2).map((url) => url.searchParams.get("format")),
    ["png3", "json3"],
  );
  const data = card.json.data as Record<string, unknown>;
  assert.equal(data.name, "Forest Mage");
  assert.equal(data.creator, "Example Creator", "a blank creator is filled from the listing");
  assert.deepEqual(data.tags, ["Fantasy"], "empty card tags are filled from the listing");
  assert.equal(card.imageDataUrl, undefined);

  // A refused export stops instead of trying the next format.
  const persona = {
    ...mapped,
    id: PERSONA_ID,
    downloads: { json: `${baseUrl}/api/v1/content/personas/${PERSONA_ID}/download?format=json` },
  };
  await assert.rejects(
    client.downloadCard(persona, ["json"]),
    (error) => error instanceof PlotLightError && error.status === 403,
  );

  // A 429 reports Retry-After and blocks further calls until it passes, without touching the network.
  clock += 60_000;
  rateLimited = true;
  await assert.rejects(
    client.searchPage(search, 1),
    (error) => error instanceof PlotLightError && error.status === 429 && error.retryAfterSeconds === 7,
  );
  const requestCount = requests.length;
  clock += 2_000;
  await assert.rejects(
    client.searchPage(search, 1),
    (error) => error instanceof PlotLightError && error.retryAfterSeconds === 5,
  );
  assert.equal(requests.length, requestCount, "no request is sent while PlotLight asked to wait");
  rateLimited = false;
  clock += 6_000;
  assert.equal((await client.searchPage(search, 1)).items.length, 2, "searching resumes after Retry-After");
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log("PlotLight Card Browser regression checks passed.");
