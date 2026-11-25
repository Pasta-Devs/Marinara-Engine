import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { mkdtemp, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createImageTagDatasetStore,
  ImageTagDatasetError,
} from "../../../packages/server/src/services/image-tags/datasets.js";
import { writeFileAtomic } from "../../../packages/server/src/utils/atomic-write.js";
import { runNamedCases } from "../fixtures/named-cases.js";

type Store = ReturnType<typeof createImageTagDatasetStore>;

const FOUR_COL = [
  "tag_name,category,count,aliases",
  'Miku_Hatsune,1,100,"Hatsune Miku,初音ミク"',
  'Cat_Girl(Ver.2),0,42,"cat girl v2,neko"',
  "tag.with(punct)!,3,7,",
].join("\r\n");

const THREE_COL = ["tag_name,count,aliases", 'alpha,10,"a,b"', "beta,20,"].join("\r\n");

const REPLACEMENT_COL = ["tag_name,category,count,aliases", "Fresh_Tag,0,11,fresh alias", "Only_New,1,3,"].join("\r\n");

function csvBytes(text: string): Uint8Array {
  return Buffer.from(text, "utf8");
}

async function withTempRoot(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "marinara-image-tag-datasets-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
}

function artifactPath(root: string, id: string): string {
  return join(root, "image-tag-datasets", `${id}.json`);
}

async function searchOne(store: Store, query: string, mode: "exact" | "prefix" | "substring" = "exact") {
  const response = await store.search({ queries: [query], mode });
  const result = response.results[0];
  assert.ok(result);
  return result;
}

async function onlySource(store: Store) {
  const listed = await store.list();
  assert.equal(listed.sources.length, 1);
  return listed.sources[0]!;
}

await runNamedCases([
  {
    name: "imports four-column bytes, lists metadata, and a new store searches canonical, alias and punctuation",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const imported = await store.importCsv(csvBytes(FOUR_COL), {
          name: "Original Set",
          originalName: "original.csv",
          sourceUrl: "https://example.com/original.csv",
        });

        assert.equal(imported.name, "Original Set");
        assert.equal(imported.originalName, "original.csv");
        assert.equal(imported.sourceUrl, "https://example.com/original.csv");
        assert.equal(imported.scheme, "danbooru");
        assert.equal(imported.enabled, true);
        assert.deepEqual(imported.enabledCategories, [0, 1, 3, 4, 5]);
        assert.equal(imported.recordCount, 3);
        assert.deepEqual(imported.categoryCounts, { 0: 1, 1: 1, 3: 1 });
        assert.equal(imported.report.totalRows, 4);
        assert.equal(imported.report.headerRows, 1);
        assert.equal(imported.report.acceptedRows, 3);
        assert.equal(imported.report.invalidRows, 0);
        assert.match(imported.fingerprint, /^[a-f0-9]{64}$/);
        assert.ok(Number.isFinite(Date.parse(imported.importedAt)));
        assert.ok(Number.isFinite(Date.parse(imported.updatedAt)));

        assert.deepEqual(await store.list(), { sources: [imported], unavailableSources: [] });

        const reopened = createImageTagDatasetStore(root);
        assert.deepEqual(await reopened.list(), { sources: [imported], unavailableSources: [] });

        const canonical = await searchOne(reopened, "miku_hatsune");
        assert.deepEqual(canonical.matches, [
          { canonicalName: "Miku_Hatsune", category: 1, postCount: 100, sourceIds: [imported.id] },
        ]);
        assert.equal(canonical.totalMatches, 1);
        assert.equal(canonical.truncated, false);

        const alias = await searchOne(reopened, "HATSUNE MIKU");
        assert.equal(alias.matches[0]?.canonicalName, "Miku_Hatsune");
        assert.equal(alias.matches[0]?.matchedAlias, "Hatsune Miku");

        const punctuation = await searchOne(reopened, "TAG.WITH(PUNCT)!");
        assert.equal(punctuation.matches[0]?.canonicalName, "tag.with(punct)!");
        assert.equal(punctuation.matches[0]?.category, 3);
        assert.equal(punctuation.matches[0]?.postCount, 7);

        const withoutPunctuation = await searchOne(reopened, "tag with (punct)!");
        assert.equal(withoutPunctuation.totalMatches, 0);
      });
    },
  },
  {
    name: "requires a category for a three-column import and applies it to every row",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const bytes = csvBytes(THREE_COL);

        await assert.rejects(store.importCsv(bytes, { originalName: "split.csv" }), (error: unknown) => {
          assert.ok(error instanceof ImageTagDatasetError);
          assert.equal(error.statusCode, 400);
          assert.match(error.message, /explicit category/i);
          return true;
        });
        assert.deepEqual(await store.list(), { sources: [], unavailableSources: [] });

        const imported = await store.importCsv(bytes, { originalName: "split.csv", category: 4 });
        assert.equal(imported.recordCount, 2);
        assert.deepEqual(imported.categoryCounts, { 4: 2 });
        assert.equal(imported.report.headerRows, 1);

        const alpha = await searchOne(store, "alpha");
        assert.equal(alpha.matches[0]?.category, 4);
        assert.equal(alpha.matches[0]?.postCount, 10);
        assert.deepEqual(alpha.matches[0]?.sourceIds, [imported.id]);
      });
    },
  },
  {
    name: "enforces updated enabled state and category selection on search",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const imported = await store.importCsv(
          csvBytes(["name,category,count,aliases", "cat,0,5,", "dog,1,6,"].join("\r\n")),
          { originalName: "pets.csv" },
        );

        await store.update(imported.id, { enabled: false });
        assert.equal((await store.search({ queries: ["cat"] })).status, "disabled");
        assert.equal((await onlySource(store)).enabled, false);

        const updated = await store.update(imported.id, { enabled: true, enabledCategories: [0, 0, 1] });
        assert.deepEqual(updated.enabledCategories, [0, 1]);
        assert.equal((await searchOne(store, "dog")).totalMatches, 1);

        await store.update(imported.id, { enabledCategories: [0] });
        assert.equal((await searchOne(store, "dog")).totalMatches, 0);
        assert.equal((await searchOne(store, "cat")).totalMatches, 1);

        const requestNarrowedAway = await store.search({ queries: ["cat"], categories: [1] });
        assert.equal(requestNarrowedAway.status, "no_enabled_categories");
        assert.deepEqual(requestNarrowedAway.results[0]?.matches, []);
      });
    },
  },
  {
    name: "replacement removes old hits and preserves ID, name, source URL and settings",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const original = await store.importCsv(csvBytes(FOUR_COL), {
          name: "Kept Name",
          originalName: "original.csv",
          sourceUrl: "https://example.com/kept.csv",
        });
        const before = await store.update(original.id, { enabledCategories: [0, 1] });
        const replaced = await store.importCsv(csvBytes(REPLACEMENT_COL), {
          originalName: "replacement.csv",
          replaceId: original.id,
        });

        assert.equal(replaced.id, before.id);
        assert.equal(replaced.name, before.name);
        assert.equal(replaced.originalName, "replacement.csv");
        assert.equal(replaced.sourceUrl, before.sourceUrl);
        assert.equal(replaced.importedAt, before.importedAt);
        assert.equal(replaced.enabled, before.enabled);
        assert.deepEqual(replaced.enabledCategories, before.enabledCategories);
        assert.notEqual(replaced.fingerprint, before.fingerprint);
        assert.equal(replaced.recordCount, 2);
        assert.deepEqual(replaced.categoryCounts, { 0: 1, 1: 1 });

        const listed = await store.list();
        assert.equal(listed.sources.length, 1);
        assert.deepEqual(listed.sources[0], replaced);

        assert.equal((await searchOne(store, "Miku_Hatsune")).totalMatches, 0);
        assert.equal((await searchOne(store, "Hatsune Miku")).totalMatches, 0);
        const fresh = await searchOne(store, "Fresh_Tag");
        assert.equal(fresh.matches[0]?.canonicalName, "Fresh_Tag");
        assert.equal(fresh.matches[0]?.postCount, 11);

        const reopened = createImageTagDatasetStore(root);
        assert.equal((await searchOne(reopened, "Fresh_Tag")).totalMatches, 1);
        assert.equal((await searchOne(reopened, "Miku_Hatsune")).totalMatches, 0);
      });
    },
  },
  {
    name: "removing a dataset clears it for a new store and a repeat removal is 404",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const imported = await store.importCsv(csvBytes(FOUR_COL), { originalName: "original.csv" });
        await store.remove(imported.id);

        assert.deepEqual(await store.list(), { sources: [], unavailableSources: [] });
        const reopened = createImageTagDatasetStore(root);
        assert.deepEqual(await reopened.list(), { sources: [], unavailableSources: [] });
        assert.equal((await reopened.search({ queries: ["Miku_Hatsune"] })).status, "no_datasets");

        await assert.rejects(store.remove(imported.id), (error: unknown) => {
          assert.ok(error instanceof ImageTagDatasetError);
          assert.equal(error.statusCode, 404);
          return true;
        });
      });
    },
  },
  {
    name: "rejects a duplicate CSV import with 409 and keeps the first dataset",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const bytes = csvBytes(FOUR_COL);
        const first = await store.importCsv(bytes, { originalName: "first.csv" });

        await assert.rejects(store.importCsv(bytes, { originalName: "second.csv" }), (error: unknown) => {
          assert.ok(error instanceof ImageTagDatasetError);
          assert.equal(error.statusCode, 409);
          assert.match(error.message, /already imported/i);
          return true;
        });

        const listed = await store.list();
        assert.equal(listed.sources.length, 1);
        assert.equal(listed.sources[0]?.id, first.id);
      });
    },
  },
  {
    name: "a split-category option cannot bypass duplicate detection for four-column data",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const bytes = csvBytes(FOUR_COL);
        const first = await store.importCsv(bytes, { originalName: "first.csv" });

        await assert.rejects(
          store.importCsv(bytes, { originalName: "duplicate.csv", category: 4 }),
          (error: unknown) => {
            assert.ok(error instanceof ImageTagDatasetError);
            assert.equal(error.statusCode, 409);
            return true;
          },
        );
        assert.deepEqual(await store.list(), { sources: [first], unavailableSources: [] });
      });
    },
  },
  {
    name: "identical split CSV bytes may populate different effective categories",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const bytes = csvBytes(THREE_COL);
        const artist = await store.importCsv(bytes, { originalName: "artists.csv", category: 1 });
        const character = await store.importCsv(bytes, { originalName: "characters.csv", category: 4 });

        assert.notEqual(artist.id, character.id);
        assert.equal(artist.fingerprint, character.fingerprint);
        assert.deepEqual(artist.categoryCounts, { 1: 2 });
        assert.deepEqual(character.categoryCounts, { 4: 2 });
        const alpha = await searchOne(store, "alpha");
        assert.deepEqual(
          alpha.matches.map((match) => match.category),
          [1, 4],
        );
        assert.equal((await store.list()).sources.length, 2);
      });
    },
  },
  {
    name: "metadata updates respect the installed byte budget and preserve the old artifact",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const original = await store.importCsv(csvBytes("kept,0,1,"), { name: "a", originalName: "a.csv" });
        const originalBytes = await readFile(artifactPath(root, original.id));
        const unavailableId = randomUUID();
        // A sparse invalid artifact fills the budget without allocating a 128 MiB test string.
        const filler = await open(artifactPath(root, unavailableId), "w");
        try {
          await filler.write("!");
          await filler.truncate(128 * 1024 * 1024 - originalBytes.byteLength - 1);
        } finally {
          await filler.close();
        }

        await assert.rejects(store.update(original.id, { name: "n".repeat(256) }), (error: unknown) => {
          assert.ok(error instanceof ImageTagDatasetError);
          assert.match(error.message, /size limit/i);
          return true;
        });
        assert.deepEqual(await readFile(artifactPath(root, original.id)), originalBytes);
        await store.remove(unavailableId);
        assert.deepEqual(await store.list(), { sources: [original], unavailableSources: [] });
        assert.equal((await searchOne(store, "kept")).totalMatches, 1);
      });
    },
  },
  {
    name: "a failed replacement parse leaves the old dataset searchable",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const original = await store.importCsv(csvBytes(FOUR_COL), { originalName: "original.csv" });
        const before = await store.list();

        await assert.rejects(
          store.importCsv(csvBytes('"unterminated,0,1,'), {
            replaceId: original.id,
            originalName: "broken.csv",
          }),
          /Malformed CSV/,
        );

        assert.deepEqual(await store.list(), before);
        assert.equal((await searchOne(store, "Miku_Hatsune")).totalMatches, 1);
      });
    },
  },
  {
    name: "queued imports fingerprint the same immutable bytes they parsed",
    async run() {
      await withTempRoot(async (root) => {
        let entered!: () => void;
        let release!: () => void;
        const firstWriteStarted = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const firstWriteReleased = new Promise<void>((resolve) => {
          release = resolve;
        });
        let firstWrite = true;
        const writer: typeof writeFileAtomic = async (path, data, options) => {
          if (firstWrite) {
            firstWrite = false;
            entered();
            await firstWriteReleased;
          }
          await writeFileAtomic(path, data, options);
        };
        const store = createImageTagDatasetStore(root, writer);
        const first = store.importCsv(csvBytes("first,0,1,"), { originalName: "first.csv" });
        await firstWriteStarted;
        const bytes = Buffer.from("queued,0,2,");
        const expectedFingerprint = createHash("sha256").update(bytes).digest("hex");
        const second = store.importCsv(bytes, { originalName: "queued.csv" });
        bytes.fill(0x78);
        release();
        await first;
        const imported = await second;

        assert.equal(imported.fingerprint, expectedFingerprint);
        assert.equal((await searchOne(store, "queued")).matches[0]?.sourceIds[0], imported.id);
        const reopened = createImageTagDatasetStore(root);
        assert.equal(
          (await reopened.list()).sources.find((source) => source.id === imported.id)?.fingerprint,
          expectedFingerprint,
        );
      });
    },
  },
  {
    name: "undefined patch properties preserve required stored settings",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const imported = await store.importCsv(csvBytes("kept,0,1,"), { originalName: "kept.csv" });
        await store.update(imported.id, { enabled: false, enabledCategories: [0] });
        const updated = await store.update(imported.id, {
          name: undefined,
          enabled: undefined,
          enabledCategories: undefined,
        });

        assert.equal(updated.name, imported.name);
        assert.equal(updated.enabled, false);
        assert.deepEqual(updated.enabledCategories, [0]);
        const reopened = createImageTagDatasetStore(root);
        assert.deepEqual(await reopened.list(), { sources: [updated], unavailableSources: [] });
        assert.equal((await reopened.search({ queries: ["kept"] })).status, "disabled");
      });
    },
  },
  {
    name: "a source removed after directory listing is absent rather than unavailable",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const imported = await store.importCsv(csvBytes("removed,0,1,"), { originalName: "removed.csv" });
        const target = artifactPath(root, imported.id);
        const originalLstat = fs.lstat;
        let removed = false;
        Object.assign(fs, {
          lstat: async (path: Parameters<typeof fs.lstat>[0]) => {
            if (String(path) === target && !removed) {
              removed = true;
              await fs.unlink(target);
            }
            return originalLstat(path);
          },
        });
        syncBuiltinESMExports();
        try {
          assert.deepEqual(await store.list(), { sources: [], unavailableSources: [] });
          assert.equal(removed, true, "the fixture removed the source between readdir and lstat");
          assert.equal((await store.search({ queries: ["removed"] })).status, "no_datasets");
        } finally {
          Object.assign(fs, { lstat: originalLstat });
          syncBuiltinESMExports();
        }
      });
    },
  },
  {
    name: "a rejecting atomic writer leaves the old artifact and search intact",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const original = await store.importCsv(csvBytes(FOUR_COL), {
          name: "Original",
          originalName: "original.csv",
        });
        const artifact = artifactPath(root, original.id);
        const artifactBytes = await readFile(artifact);
        const before = await store.list();

        const rejectingWrite: typeof writeFileAtomic = async () => {
          throw new Error("simulated write failure");
        };
        const rejectingStore = createImageTagDatasetStore(root, rejectingWrite);

        await assert.rejects(rejectingStore.update(original.id, { name: "Broken" }), /simulated write failure/);
        await assert.rejects(
          rejectingStore.importCsv(csvBytes(REPLACEMENT_COL), {
            replaceId: original.id,
            originalName: "replacement.csv",
          }),
          /simulated write failure/,
        );
        await assert.rejects(
          rejectingStore.importCsv(csvBytes("New_Tag,0,9,"), { originalName: "new.csv" }),
          /simulated write failure/,
        );

        assert.deepEqual(await store.list(), before);
        assert.deepEqual(await readFile(artifact), artifactBytes);
        assert.equal((await searchOne(store, "Miku_Hatsune")).totalMatches, 1);
        assert.equal((await searchOne(store, "New_Tag")).totalMatches, 0);
      });
    },
  },
  {
    name: "the queue recovers from a rejected write and serializes overlapping updates and imports",
    async run() {
      await withTempRoot(async (root) => {
        let entered!: () => void;
        let release!: () => void;
        const firstWriteStarted = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const firstWriteReleased = new Promise<void>((resolve) => {
          release = resolve;
        });
        let failures = 1;
        const flakyWrite: typeof writeFileAtomic = async (path, data, options) => {
          if (failures > 0) {
            failures -= 1;
            entered();
            await firstWriteReleased;
            throw new Error("transient write failure");
          }
          await writeFileAtomic(path, data, options);
        };
        const store = createImageTagDatasetStore(root, flakyWrite);

        const rejected = assert.rejects(
          store.importCsv(csvBytes(FOUR_COL), { originalName: "first.csv" }),
          /transient write failure/,
        );
        await firstWriteStarted;
        const queuedRecovery = store.importCsv(csvBytes(FOUR_COL), { originalName: "first.csv" });
        release();
        await rejected;
        const first = await queuedRecovery;
        await Promise.all([
          store.update(first.id, { name: "Concurrent Name" }),
          store.update(first.id, { enabled: false }),
        ]);
        let summary = await onlySource(store);
        assert.equal(summary.name, "Concurrent Name");
        assert.equal(summary.enabled, false);

        await store.update(first.id, { enabled: true });
        await Promise.all([
          store.update(first.id, { name: "After Import" }),
          store.importCsv(csvBytes(REPLACEMENT_COL), {
            replaceId: first.id,
            originalName: "replacement.csv",
          }),
        ]);
        summary = await onlySource(store);
        assert.equal(summary.id, first.id);
        assert.equal(summary.name, "After Import");
        assert.equal(summary.recordCount, 2);
        assert.equal((await searchOne(store, "Miku_Hatsune")).totalMatches, 0);
        assert.equal((await searchOne(store, "Fresh_Tag")).totalMatches, 1);

        const [second, third] = await Promise.all([
          store.importCsv(csvBytes("Second_Tag,0,2,"), { originalName: "second.csv" }),
          store.importCsv(csvBytes("Third_Tag,0,3,"), { originalName: "third.csv" }),
        ]);
        const ids = (await store.list()).sources.map((source) => source.id).sort();
        assert.deepEqual(ids, [first.id, second.id, third.id].sort());
        assert.equal((await searchOne(store, "Second_Tag")).totalMatches, 1);
        assert.equal((await searchOne(store, "Third_Tag")).totalMatches, 1);
      });
    },
  },
  {
    name: "rejects invalid UTF-8 before it reaches storage or a replacement",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);

        await assert.rejects(store.importCsv(new Uint8Array([0xff, 0xfe, 0xfd]), { originalName: "bad.csv" }), /UTF-8/);
        assert.deepEqual(await store.list(), { sources: [], unavailableSources: [] });

        const original = await store.importCsv(csvBytes(FOUR_COL), { originalName: "original.csv" });
        const before = await store.list();
        await assert.rejects(
          store.importCsv(new Uint8Array([0xc3, 0x28]), {
            replaceId: original.id,
            originalName: "bad.csv",
          }),
          /UTF-8/,
        );

        assert.deepEqual(await store.list(), before);
        assert.equal((await searchOne(store, "Miku_Hatsune")).totalMatches, 1);
      });
    },
  },
  {
    name: "invalid and traversal-shaped IDs cannot read or remove files outside the dataset folder",
    async run() {
      await withTempRoot(async (root) => {
        const outside = join(root, "outside.json");
        await writeFile(outside, "sentinel");
        const store = createImageTagDatasetStore(root);
        await store.list();

        const invalidIds = [
          "../outside",
          "../../outside",
          "not-a-uuid",
          `${randomUUID()}/../../outside`,
          resolve(root, "outside"),
        ];
        for (const id of invalidIds) {
          await assert.rejects(store.update(id, { name: "nope" }), (error: unknown) => {
            assert.ok(error instanceof ImageTagDatasetError);
            assert.equal(error.statusCode, 400);
            assert.match(error.message, /Invalid image tag dataset ID/);
            return true;
          });
          await assert.rejects(store.remove(id), /Invalid image tag dataset ID/);
        }

        await assert.rejects(
          store.importCsv(csvBytes(FOUR_COL), {
            originalName: "traversal.csv",
            replaceId: "../outside",
          }),
          /Invalid image tag import options/,
        );

        assert.equal(await readFile(outside, "utf8"), "sentinel");
        assert.deepEqual(
          (await readdir(join(root, "image-tag-datasets"))).filter((name) => name.endsWith(".json")),
          [],
        );
      });
    },
  },
  {
    name: "reports corrupt JSON as unavailable, then lets it be removed or replaced",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        await store.list();

        const corruptId = randomUUID();
        await writeFileAtomic(artifactPath(root, corruptId), "{ not valid json");
        const unavailable = await store.list();
        assert.deepEqual(unavailable.sources, []);
        assert.deepEqual(unavailable.unavailableSources, [corruptId]);
        await assert.rejects(store.search({ queries: ["cat"] }), (error: unknown) => {
          assert.ok(error instanceof ImageTagDatasetError);
          assert.equal(error.statusCode, 503);
          assert.match(error.message, /unavailable/i);
          return true;
        });

        await store.remove(corruptId);
        assert.deepEqual(await store.list(), { sources: [], unavailableSources: [] });
        assert.equal((await store.search({ queries: ["cat"] })).status, "no_datasets");

        const repairedId = randomUUID();
        await writeFileAtomic(artifactPath(root, repairedId), "still not json");
        const repaired = await store.importCsv(csvBytes(FOUR_COL), {
          replaceId: repairedId,
          originalName: "repair.csv",
        });
        assert.equal(repaired.id, repairedId);
        assert.deepEqual(await store.list(), { sources: [repaired], unavailableSources: [] });
        assert.equal((await searchOne(store, "Miku_Hatsune")).totalMatches, 1);
      });
    },
  },
  {
    name: "an existing store notices artifact replacement, restore and deletion by another store",
    async run() {
      await withTempRoot(async (root) => {
        const store = createImageTagDatasetStore(root);
        const imported = await store.importCsv(csvBytes(FOUR_COL), { originalName: "original.csv" });
        const artifact = artifactPath(root, imported.id);
        const backup = await readFile(artifact);
        assert.deepEqual(await store.list(), { sources: [imported], unavailableSources: [] });

        const other = createImageTagDatasetStore(root);
        await other.update(imported.id, { name: "Renamed elsewhere" });
        assert.equal((await onlySource(store)).name, "Renamed elsewhere");

        await other.importCsv(csvBytes(REPLACEMENT_COL), {
          replaceId: imported.id,
          originalName: "replacement.csv",
        });
        assert.equal((await onlySource(store)).recordCount, 2);
        assert.equal((await searchOne(store, "Fresh_Tag")).totalMatches, 1);
        assert.equal((await searchOne(store, "Miku_Hatsune")).totalMatches, 0);

        await writeFileAtomic(artifact, backup);
        assert.deepEqual(await store.list(), { sources: [imported], unavailableSources: [] });
        assert.equal((await searchOne(store, "Miku_Hatsune")).totalMatches, 1);
        assert.equal((await searchOne(store, "Fresh_Tag")).totalMatches, 0);

        await other.remove(imported.id);
        assert.deepEqual(await store.list(), { sources: [], unavailableSources: [] });
        assert.equal((await store.search({ queries: ["Miku_Hatsune"] })).status, "no_datasets");
      });
    },
  },
]);
