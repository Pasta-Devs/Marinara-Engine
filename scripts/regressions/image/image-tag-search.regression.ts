import assert from "node:assert/strict";
import {
  type ImageTagCategory,
  type ImageTagDatasetSummary,
  type ImageTagRecord,
  type ImageTagSearchRequest,
} from "@marinara-engine/shared";
import { searchImageTagRecords } from "../../../packages/server/src/services/image-tags/search.js";
import { runNamedCases } from "../fixtures/named-cases.js";

const ALL_CATEGORIES: ImageTagCategory[] = [0, 1, 3, 4, 5];

type Source = { summary: ImageTagDatasetSummary; records: ImageTagRecord[] };

function makeSource(
  id: string,
  records: ImageTagRecord[],
  options: { enabled?: boolean; categories?: ImageTagCategory[] } = {},
): Source {
  return {
    summary: {
      id,
      name: `Dataset ${id}`,
      originalName: `${id}.csv`,
      importedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      fingerprint: `fingerprint-${id}`,
      scheme: "danbooru",
      enabled: options.enabled ?? true,
      enabledCategories: [...(options.categories ?? ALL_CATEGORIES)],
      recordCount: records.length,
      categoryCounts: {},
      report: {
        totalRows: records.length,
        acceptedRows: records.length,
        blankRows: 0,
        invalidRows: 0,
        duplicateRows: 0,
        headerRows: 0,
        issues: [],
        omittedIssues: 0,
      },
    },
    records,
  };
}

await runNamedCases([
  {
    name: "ranks exact before prefix before substring, and canonical before alias",
    run: () => {
      const source = makeSource("ranking", [
        { name: "cat", category: 0, postCount: 1, aliases: [] },
        { name: "kitty", category: 0, postCount: 100, aliases: ["cat"] },
        { name: "feline", category: 0, postCount: 50, aliases: ["Cat"] },
        { name: "cat_face", category: 0, postCount: 10, aliases: [] },
        { name: "cat_ears", category: 0, postCount: 2, aliases: [] },
        { name: "tail", category: 0, postCount: 99, aliases: ["cat_tail"] },
        { name: "bobcat", category: 0, postCount: 3, aliases: [] },
        { name: "wild", category: 0, postCount: 98, aliases: ["wild_cat"] },
        { name: "dog", category: 0, postCount: 1000, aliases: [] },
      ]);

      const exact = searchImageTagRecords([source], { queries: ["cat"], mode: "exact" });
      assert.deepEqual(
        exact.results[0]?.matches.map((match) => match.canonicalName),
        ["cat", "kitty", "feline"],
      );
      assert.equal(exact.results[0]?.totalMatches, 3);

      const prefix = searchImageTagRecords([source], { queries: ["cat"], mode: "prefix" });
      assert.deepEqual(
        prefix.results[0]?.matches.map((match) => match.canonicalName),
        ["cat", "kitty", "feline", "cat_face", "cat_ears", "tail"],
      );
      assert.equal(prefix.results[0]?.totalMatches, 6);

      const substring = searchImageTagRecords([source], { queries: ["cat"], mode: "substring" });
      assert.deepEqual(
        substring.results[0]?.matches.map((match) => match.canonicalName),
        ["cat", "kitty", "feline", "cat_face", "cat_ears", "tail", "bobcat", "wild"],
      );
      assert.equal(substring.results[0]?.matches[1]?.matchedAlias, "cat");
      assert.equal(substring.results[0]?.matches[2]?.matchedAlias, "Cat");
      assert.equal(substring.results[0]?.matches[5]?.matchedAlias, "cat_tail");
      assert.equal(substring.results[0]?.matches[7]?.matchedAlias, "wild_cat");
      assert.equal(substring.results[0]?.totalMatches, 8);
    },
  },
  {
    name: "normalizes spaces, underscores, and case but keeps punctuation distinct",
    run: () => {
      const source = makeSource("normalization", [
        { name: "cat_girl", category: 0, postCount: 2, aliases: [] },
        { name: "cat girl", category: 0, postCount: 1, aliases: [] },
        { name: "cat-girl", category: 0, postCount: 9, aliases: [] },
        { name: "catgirl", category: 0, postCount: 8, aliases: [] },
      ]);

      const spaced = searchImageTagRecords([source], { queries: ["CAT GIRL"], mode: "exact" });
      assert.equal(spaced.results[0]?.query, "CAT GIRL");
      assert.deepEqual(
        spaced.results[0]?.matches.map((match) => match.canonicalName),
        ["cat_girl", "cat girl"],
      );

      const punctuated = searchImageTagRecords([source], { queries: ["cat-girl"], mode: "exact" });
      assert.deepEqual(
        punctuated.results[0]?.matches.map((match) => match.canonicalName),
        ["cat-girl"],
      );
    },
  },
  {
    name: "dedupes raw name and category across sources with max count and all provenance",
    run: () => {
      const sources = [
        makeSource("source-a", [{ name: "Cat_Girl", category: 0, postCount: 5, aliases: [] }]),
        makeSource("source-b", [{ name: "Cat_Girl", category: 0, postCount: 9, aliases: ["kitty"] }]),
        makeSource("source-c", [{ name: "Cat_Girl", category: 1, postCount: 12, aliases: [] }]),
        makeSource("source-d", [{ name: "Cat_Girl", category: 0, postCount: 7, aliases: [] }]),
      ];

      assert.deepEqual(searchImageTagRecords(sources, { queries: ["kitty"], mode: "exact" }).results[0]?.matches, [
        {
          canonicalName: "Cat_Girl",
          category: 0,
          postCount: 9,
          sourceIds: ["source-a", "source-b", "source-d"],
          matchedAlias: "kitty",
        },
      ]);
      assert.deepEqual(searchImageTagRecords(sources, { queries: ["cat_girl"], mode: "exact" }), {
        status: "ready",
        results: [
          {
            query: "cat_girl",
            matches: [
              { canonicalName: "Cat_Girl", category: 1, postCount: 12, sourceIds: ["source-c"] },
              {
                canonicalName: "Cat_Girl",
                category: 0,
                postCount: 9,
                sourceIds: ["source-a", "source-b", "source-d"],
              },
            ],
            totalMatches: 2,
            truncated: false,
          },
        ],
      });
    },
  },
  {
    name: "does not re-enable disabled sources, per-source categories, or narrower filters",
    run: () => {
      const enabled = makeSource(
        "enabled",
        [
          { name: "dog", category: 1, postCount: 5, aliases: [] },
          { name: "cat", category: 0, postCount: 5, aliases: [] },
        ],
        { categories: [0] },
      );
      const disabled = makeSource("off", [{ name: "cat", category: 0, postCount: 100, aliases: [] }], {
        enabled: false,
      });

      const narrowed = searchImageTagRecords([enabled, disabled], {
        queries: ["cat"],
        mode: "exact",
        sourceIds: ["enabled", "off"],
        categories: [0, 1],
      });
      assert.equal(narrowed.status, "ready");
      assert.deepEqual(narrowed.results[0]?.matches, [
        { canonicalName: "cat", category: 0, postCount: 5, sourceIds: ["enabled"] },
      ]);

      const disabledSourceOnly = searchImageTagRecords([enabled, disabled], {
        queries: ["cat"],
        sourceIds: ["off"],
      });
      assert.equal(disabledSourceOnly.status, "disabled");

      const disabledCategoryOnly = searchImageTagRecords([enabled, disabled], {
        queries: ["dog"],
        sourceIds: ["enabled"],
        categories: [1],
      });
      assert.equal(disabledCategoryOnly.status, "no_enabled_categories");

      const existingCategoryCannotMatchDisabledRecord = searchImageTagRecords([enabled, disabled], {
        queries: ["dog"],
        sourceIds: ["enabled"],
        categories: [0, 1],
      });
      assert.equal(existingCategoryCannotMatchDisabledRecord.status, "ready");
      assert.equal(existingCategoryCannotMatchDisabledRecord.results[0]?.totalMatches, 0);
    },
  },
  {
    name: "returns the four statuses with one entry per query",
    run: () => {
      const noDatasets = searchImageTagRecords([], { queries: ["cat"] });
      assert.equal(noDatasets.status, "no_datasets");
      assert.deepEqual(noDatasets.results, [{ query: "cat", matches: [], totalMatches: 0, truncated: false }]);

      const disabled = searchImageTagRecords(
        [makeSource("off", [{ name: "cat", category: 0, postCount: 1, aliases: [] }], { enabled: false })],
        { queries: ["cat"] },
      );
      assert.equal(disabled.status, "disabled");
      assert.equal(disabled.results.length, 1);

      const noCategories = searchImageTagRecords([makeSource("empty", [], { categories: [] })], {
        queries: ["cat"],
      });
      assert.equal(noCategories.status, "no_enabled_categories");
      assert.equal(noCategories.results.length, 1);

      const readyZero = searchImageTagRecords(
        [makeSource("one", [{ name: "dog", category: 0, postCount: 1, aliases: [] }])],
        { queries: ["cat"] },
      );
      assert.equal(readyZero.status, "ready");
      assert.deepEqual(readyZero.results[0], { query: "cat", matches: [], totalMatches: 0, truncated: false });
    },
  },
  {
    name: "caps per-query matches, then the call-wide result count",
    run: () => {
      const records: ImageTagRecord[] = Array.from({ length: 30 }, (_, index) => ({
        name: `cat_${String(index).padStart(2, "0")}`,
        category: 0,
        postCount: 30 - index,
        aliases: [],
      }));
      const source = makeSource("batch", records);

      const limited = searchImageTagRecords([source], { queries: ["cat"], mode: "prefix", limit: 5 });
      assert.equal(limited.results[0]?.matches.length, 5);
      assert.equal(limited.results[0]?.totalMatches, 30);
      assert.equal(limited.results[0]?.truncated, true);

      const response = searchImageTagRecords([source], {
        queries: Array.from({ length: 6 }, () => "cat"),
        mode: "prefix",
      });
      assert.equal(response.status, "ready");
      assert.equal(response.results.length, 6);
      assert.equal(
        response.results.reduce((count, result) => count + result.matches.length, 0),
        100,
      );
      for (const result of response.results) {
        assert.equal(result.totalMatches, 30);
        assert.equal(result.truncated, true);
      }
      assert.equal(response.results[5]?.matches.length, 0);
    },
  },
  {
    name: "keeps every query entry and count under the 48 KiB serialized cap",
    run: () => {
      const sources = Array.from({ length: 20 }, (_, sourceIndex) =>
        makeSource(
          `source-${String(sourceIndex).padStart(2, "0")}-${"s".repeat(170)}`,
          Array.from({ length: 20 }, (_, recordIndex): ImageTagRecord => ({
            name: `tag_${String(recordIndex).padStart(2, "0")}_${"n".repeat(170)}`,
            category: 0,
            postCount: 100 - recordIndex,
            aliases: [],
          })),
          { categories: [0] },
        ),
      );

      const response = searchImageTagRecords(sources, { queries: ["tag", "TAG"], mode: "prefix" });
      assert.equal(response.results.length, 2);
      assert.ok(Buffer.byteLength(JSON.stringify(response), "utf8") <= 48 * 1024);
      for (const result of response.results) {
        assert.equal(result.totalMatches, 20);
        assert.equal(result.truncated, true);
        assert.ok(result.matches.length < 20);
      }
      assert.ok(response.results.some((result) => result.matches.length > 0));
    },
  },
  {
    name: "rejects invalid requests before scanning sources",
    run: () => {
      const invalid: Array<{ name: string; message: string; request: ImageTagSearchRequest }> = [
        { name: "empty queries", message: "queries", request: { queries: [] } },
        {
          name: "too many queries",
          message: "queries",
          request: { queries: Array.from({ length: 21 }, () => "cat") },
        },
        { name: "blank query", message: "queries[0]", request: { queries: ["   "] } },
        { name: "huge query", message: "queries[0]", request: { queries: ["x".repeat(201)] } },
        {
          name: "unknown mode",
          message: "mode",
          request: { queries: ["cat"], mode: "regex" as unknown as ImageTagSearchRequest["mode"] },
        },
        { name: "zero limit", message: "limit", request: { queries: ["cat"], limit: 0 } },
        { name: "fractional limit", message: "limit", request: { queries: ["cat"], limit: 1.5 } },
        { name: "huge limit", message: "limit", request: { queries: ["cat"], limit: 21 } },
        {
          name: "too many source IDs",
          message: "sourceIds",
          request: { queries: ["cat"], sourceIds: Array.from({ length: 21 }, (_, index) => `s-${index}`) },
        },
        {
          name: "huge source ID",
          message: "sourceIds[0]",
          request: { queries: ["cat"], sourceIds: ["x".repeat(513)] },
        },
        {
          name: "unknown category",
          message: "categories[0]",
          request: { queries: ["cat"], categories: [2 as unknown as ImageTagCategory] },
        },
      ];

      for (const item of invalid) {
        assert.throws(
          () => searchImageTagRecords([], item.request),
          (error: unknown) => error instanceof Error && error.message.includes(item.message),
          item.name,
        );
      }
      assert.throws(
        () => searchImageTagRecords([], null as unknown as ImageTagSearchRequest),
        (error: unknown) => error instanceof Error && error.message.includes("request must be an object"),
      );
    },
  },
]);
