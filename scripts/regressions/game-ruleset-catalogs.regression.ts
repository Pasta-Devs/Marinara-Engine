/**
 * Ruleset catalogs: collections of ready-made entries a ruleset ships so nobody types a list row by
 * row, inline in `ruleset.json` or as a hash-pinned `catalogs/<id>.json` package asset.
 *
 * What is pinned here:
 *   - Nothing about the format is 5e-shaped. Every id, column, filter and word in this file comes
 *     from the ruleset that declares it, and the ruleset used throughout rolls 2d6.
 *   - A catalog can never write a row the sheet could not hold: `rulesetListRowIssues` runs over
 *     every entry, inline at parse time and again over an asset file at read time.
 *   - The picked rows are copies carrying one reserved mark, `_catalog`.
 *   - `GET /rulesets` never carries inline entries, and a ruleset without catalogs is untouched.
 *   - `GET /rulesets/catalog` serves an inline community catalog at the version asked for, and a
 *     package asset only when it is declared, hash-pinned, inside its ceiling and valid.
 *   - Catalogs are Capability API 1.21: a package that ships them on an older declaration is
 *     refused at install rather than installed half-working.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  capabilityPackageManifestSchema,
  catalogRowRef,
  isRulesetCatalogAssetPath,
  parseRulesetCatalogFile,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCatalogAssetPath,
  rulesetListRowIssues,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  RULESET_CATALOG_MAX_BYTES,
  RULESET_CATALOG_ROW_KEY,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const exampleUrl = new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url);
const exampleText = readFileSync(fileURLToPath(exampleUrl), "utf8");

/** A variant of the authoring guide's example: parse, edit, serialize. */
function ruleset(edit: (doc: Record<string, any>) => void = () => {}): string {
  const doc = JSON.parse(exampleText) as Record<string, any>;
  edit(doc);
  return JSON.stringify(doc, null, 2);
}
/** The example's Toll Warden picks a knack out of the knacks catalog by its id, so a case that
 *  replaces those entries takes the creature out too, rather than leave it pointing at nothing. */
function withoutSheetCreatures(doc: Record<string, any>): void {
  for (const catalog of doc.catalogs ?? []) {
    catalog.entries = catalog.entries?.filter((entry: Record<string, any>) => !entry.creature?.sheet);
  }
}
/** The keys of the example that gate on a LATER declaration than the case at hand is about, so a
 *  case about catalogs is not answered by the gate that came after them. */
function withoutLaterGates(doc: Record<string, any>): void {
  delete doc.layers;
  // The 1.37 sheet keys: a track always shown and a summary list's columns.
  for (const track of doc.sheet?.live?.tracks ?? []) delete track.alwaysShow;
  for (const list of doc.gm?.sheetSummary?.lists ?? []) delete list.columns;
  // And 1.38's modifier off the sheet, with 1.39's list sum it reads.
  delete doc.resolution?.adjust;
  doc.sheet.derived = (doc.sheet?.derived ?? []).filter(
    (entry: { id: string }) => !["burden", "burdened"].includes(entry.id),
  );
  // And 1.40's track of numbered boxes.
  doc.sheet.live.tracks = (doc.sheet?.live?.tracks ?? []).filter((track: { id: string }) => track.id !== "strain");
  // The combat block goes whole, and with it the 1.28 keys that give a fight a board.
  delete doc.combat;
  // The bestiary is a 1.27 declaration of its own, and a catalog of creatures needs the combat
  // block that just went, so it leaves with it.
  doc.catalogs = (doc.catalogs ?? []).filter((catalog: Record<string, any>) => catalog.holds !== "creatures");
  if (doc.catalogs.length === 0) delete doc.catalogs;
  // And the 1.29 keys that say what one turn can do, for the same reason.
  for (const catalog of doc.catalogs ?? []) {
    catalog.entries = (catalog.entries ?? []).filter((entry: Record<string, any>) => entry.mechanics?.kind !== "rider");
  }
  for (const entry of doc.catalogs?.[0]?.entries ?? []) {
    for (const key of [
      "targetCount",
      "autoHit",
      "applies",
      "temporary",
      "budget",
      "plus",
      "free",
      "gives",
      "standard",
      "rider",
    ]) {
      delete entry.mechanics?.[key];
    }
  }
}

const parsedOrThrow = (text: string): RulesetDefinition => {
  const parsed = parseRulesetDefinition(JSON.parse(text));
  assert.ok(parsed.ok, `the example must stay usable: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.definition;
};
const ember = parsedOrThrow(ruleset());
const emberEntries = ember.catalogs![0]!.entries!;

/** The same catalog, shipped as an asset beside the ruleset instead of inline. */
function asAsset(doc: Record<string, any>): void {
  delete doc.catalogs[0].entries;
  doc.catalogs[0].asset = "catalogs/knacks.json";
}
const catalogFile = (entries: unknown[], catalog = "knacks") =>
  JSON.stringify({ schemaVersion: 1, catalog, entries }, null, 2);

// ── The example ships a real catalog, and it is not 5e-shaped ──
{
  assert.deepEqual(ember.resolution.dice, { count: 2, sides: 6 }, "the catalog example is not a d20 system");
  const catalog = ember.catalogs![0]!;
  assert.equal(catalog.id, "knacks");
  assert.deepEqual(catalog.feeds, ["knacks", "tricks"]);
  assert.equal(catalog.entries!.length, 7);
  assert.equal(
    catalog.entries!.filter((entry) => entry.rows.length > 1).length,
    2,
    "an entry may fill two lists: the knack and the limited use that tracks it",
  );
  assert.ok(
    catalog.entries!.filter((entry) => entry.mechanics).length >= 2,
    "the example shows the mechanics block the later combat bridge reads",
  );
  assert.equal(catalog.entries!.find((entry) => entry.id === "last-ember")!.mechanics!.cost![0]!.pool, "grit");
  assert.equal(catalog.entries!.find((entry) => entry.id === "coldfire-toss")!.mechanics!.area!.shape, "burst");
  assert.deepEqual(catalog.units, { distance: { label: "paces", perCell: 2 } });
}

// ── Header cross-references ──
{
  const refuses = (edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) => {
    const parsed = parseRulesetDefinition(JSON.parse(ruleset(edit)));
    assert.ok(!parsed.ok, `expected a refusal: ${why}`);
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${why}: ${parsed.issues.join("; ")}`,
    );
  };

  refuses(
    (doc) => doc.catalogs[0].feeds.push("spells"),
    /catalogs\.0\.feeds\.2: Unknown list "spells"/,
    "a catalog can only feed a list the sheet declares",
  );
  refuses(
    (doc) => doc.catalogs[0].filters.push({ id: "road", label: "Road again", type: "text" }),
    /catalogs\.0\.filters\.3\.id: Duplicate catalog filter id "road"/,
    "two filters cannot share an id",
  );
  refuses(
    (doc) => (doc.catalogs[0].filters[2].startFrom = { field: "vocation" }),
    /catalogs\.0\.filters\.2\.startFrom\.field: Unknown field "vocation"/,
    "a filter can only start from a field the sheet has",
  );
  refuses(
    (doc) => (doc.catalogs[0].asset = "catalogs/knacks.json"),
    /catalogs\.0: A catalog has exactly one of "entries" or "asset"/,
    "a catalog cannot ship its entries both ways",
  );
  refuses(
    (doc) => delete doc.catalogs[0].entries,
    /catalogs\.0: A catalog has exactly one of "entries" or "asset"/,
    "a catalog with neither is not a catalog",
  );
  refuses(
    (doc) => {
      asAsset(doc);
      doc.catalogs[0].asset = "catalogs/everything.json";
    },
    /catalogs\.0\.asset: A catalog asset is "catalogs\/knacks\.json"/,
    "the asset path is the catalog's own id, so nothing can name another catalog's file",
  );
  refuses(
    (doc) => doc.catalogs.push({ ...doc.catalogs[0] }),
    /catalogs\.\d+\.id: Duplicate catalog id "knacks"/,
    "two catalogs cannot share an id",
  );

  const withAsset = parsedOrThrow(ruleset(asAsset));
  assert.equal(withAsset.catalogs![0]!.asset, "catalogs/knacks.json");
  assert.equal(withAsset.catalogs![0]!.entries, undefined);
}

// ── Entry checks, inline ──
{
  /** Replace the catalog's entries with one hand-made entry and report what the schema says. */
  const withEntry = (entry: Record<string, any>, extra: (doc: Record<string, any>) => void = () => {}) => {
    const parsed = parseRulesetDefinition(
      JSON.parse(
        ruleset((doc) => {
          doc.catalogs[0].entries = [entry];
          withoutSheetCreatures(doc);
          extra(doc);
        }),
      ),
    );
    return parsed.ok ? [] : parsed.issues;
  };
  const base = {
    id: "try-it",
    label: "Try it",
    rows: [{ list: "knacks", values: { name: "Try it" } }],
  };
  const refuses = (entry: Record<string, any>, pattern: RegExp, why: string, extra?: (doc: any) => void) => {
    const issues = withEntry(entry, extra);
    assert.ok(
      issues.some((issue) => pattern.test(issue)),
      `${why}: ${issues.join("; ") || "(accepted)"}`,
    );
  };

  assert.deepEqual(withEntry(base), [], "the plainest possible entry is usable");

  refuses(
    { ...base, rows: [{ list: "knacks", values: { name: "Try it", level: 3 } }] },
    /catalogs\.0\.entries\.0\.rows\.0\.values: Unknown column "level"/,
    "a catalog cannot invent a column",
  );
  refuses(
    { ...base, rows: [{ list: "tricks", values: { name: "Try it", uses: "one" } }] },
    /rows\.0\.values: Column "uses" takes a number/,
    "a column's type is the column's, not the entry's",
  );
  refuses(
    { ...base, rows: [{ list: "tricks", values: { name: "Try it", uses: 40 } }] },
    /rows\.0\.values: Column "uses" is outside 0 to 9/,
    "a number outside the column's range is refused",
  );
  refuses(
    { ...base, rows: [{ list: "tricks", values: { name: "Try it", uses: 1.5 } }] },
    /rows\.0\.values: Column "uses" takes a whole number/,
    "an integer column refuses a fraction",
  );
  refuses(
    { ...base, rows: [{ list: "knacks", values: { notes: "no name" } }] },
    /rows\.0\.values: Column "name" is required/,
    "a required column has to be filled",
  );
  refuses(
    { ...base, rows: [{ list: "tricks", values: { name: "Try it", recharge: "yearly" } }] },
    /rows\.0\.values: Column "recharge" takes one of its declared values/,
    "an enum column takes only what it declares",
  );
  refuses(
    { ...base, rows: [{ list: "gear", values: { name: "Try it" } }] },
    /rows\.0\.list: "gear" is not one of this catalog's feeds/,
    "an entry can only write into the lists its catalog feeds",
  );
  refuses(
    { ...base, filters: { school: "Evocation" } },
    /entries\.0\.filters\.school: Unknown filter "school"/,
    "a filter value needs a declared filter",
  );
  refuses(
    { ...base, filters: { grit: "one" } },
    /entries\.0\.filters\.grit: Filter "grit" takes a number/,
    "a number filter takes a number",
  );
  refuses(
    { ...base, filters: { callings: "Scout" } },
    /entries\.0\.filters\.callings: Filter "callings" takes a list of words/,
    "a tags filter takes a list",
  );
  refuses(
    { ...base, mechanics: { kind: "attack", save: { save: "nerve", onSuccess: "half" } } },
    /entries\.0\.mechanics\.save\.save: Unknown save "nerve"/,
    "a save on the mechanics block must be a save the sheet has",
  );
  refuses(
    { ...base, mechanics: { kind: "utility", cost: [{ pool: "favours", amount: 1 }] } },
    /entries\.0\.mechanics\.cost\.0\.pool: Unknown pool or pool group "favours"/,
    "a cost must name something the sheet can spend",
  );
  refuses(
    { ...base, mechanics: { kind: "attack", amount: { dice: "a fistful" } } },
    /entries\.0\.mechanics\.amount\.dice: Dice look like 2d6 or 1d8\+3/,
    "the mechanics dice are read by the Engine later, so they have a shape",
  );
  refuses(
    { ...base, mechanics: { kind: "ritual" } },
    /entries\.0\.mechanics\.kind/,
    "the mechanics vocabulary is closed, so a typo surfaces now",
  );

  const duplicates = withEntry(base, (doc) => doc.catalogs[0].entries.push({ ...base, label: "Again" }));
  assert.ok(
    duplicates.some((issue) => /entries\.1\.id: Duplicate entry id "try-it"/.test(issue)),
    `two entries cannot share an id: ${duplicates.join("; ")}`,
  );

  // The same names, declared, are accepted: the checks above fail on the sheet, not on the words.
  const declared = withEntry(
    {
      ...base,
      mechanics: { kind: "heal", save: { save: "nerve", onSuccess: "negates" }, cost: [{ pool: "embers", amount: 1 }] },
    },
    (doc) => {
      doc.sheet.saves = [{ id: "nerve", label: "Nerve", ability: "heart" }];
      doc.sheet.live.pools[0].group = "embers";
      // A fight has to have something to roll that save against, so a ruleset that gains saves
      // says what that is on the list the entry lands in.
      for (const source of doc.combat?.abilities ?? []) source.saveDifficulty = { const: 8 };
    },
  );
  assert.deepEqual(declared, [], "a save the sheet declares and a pool group are both usable costs");
}

// ── `rulesetListRowIssues` on its own, which is what the client runs when it splices picked rows ──
{
  const tricks = ember.sheet.lists.find((list) => list.id === "tricks")!;
  assert.deepEqual(rulesetListRowIssues(tricks, { name: "Last Ember", uses: 1, recharge: "camp" }), []);
  assert.deepEqual(rulesetListRowIssues(tricks, { uses: 1 }), ['Column "name" is required']);
  assert.deepEqual(rulesetListRowIssues(tricks, { name: "x", uses: true }), ['Column "uses" takes a number']);
  assert.deepEqual(rulesetListRowIssues(tricks, { name: 7 }), ['Column "name" takes text']);
  assert.deepEqual(rulesetListRowIssues(tricks, { name: "x", [RULESET_CATALOG_ROW_KEY]: "knacks/x" }), [
    `Unknown column "${RULESET_CATALOG_ROW_KEY}"`,
  ]);
  const knacks = ember.sheet.lists.find((list) => list.id === "knacks")!;
  assert.deepEqual(rulesetListRowIssues(knacks, { name: "x", notes: "n".repeat(201) }), [
    'Column "notes" is longer than 200 characters',
  ]);
}

// ── Picked rows are copies carrying one mark ──
{
  const entry = emberEntries.find((item) => item.id === "last-ember")!;
  const rows = rowsFromCatalogEntry("knacks", entry);
  assert.deepEqual(
    rows.map((row) => row.list),
    ["knacks", "tricks"],
    "one pick fills both lists the entry names",
  );
  assert.equal(catalogRowRef("knacks", "last-ember"), "knacks/last-ember");
  for (const row of rows) {
    assert.equal(row.row[RULESET_CATALOG_ROW_KEY], "knacks/last-ember");
    // The mark is the only key the entry did not write, and a column id can never look like it.
    const listed = ember.sheet.lists.find((list) => list.id === row.list)!;
    assert.deepEqual(
      rulesetListRowIssues(
        listed,
        Object.fromEntries(Object.entries(row.row).filter(([key]) => key !== RULESET_CATALOG_ROW_KEY)),
      ),
      [],
    );
  }
  assert.deepEqual(entry.rows[0]!.values[RULESET_CATALOG_ROW_KEY], undefined, "the entry itself is not modified");
}

// ── A catalog asset file goes through the same checks ──
{
  const withAsset = parsedOrThrow(ruleset(asAsset));
  const good = parseRulesetCatalogFile(withAsset, "knacks", JSON.parse(catalogFile(emberEntries)));
  assert.ok(good.ok, `the same entries are usable from a file: ${good.ok ? "" : good.issues.join("; ")}`);
  assert.equal(good.ok && good.entries.length, 7);

  const wrongName = parseRulesetCatalogFile(withAsset, "knacks", JSON.parse(catalogFile(emberEntries, "tricks")));
  assert.ok(!wrongName.ok && /this file is for "tricks"/.test(wrongName.issues[0]!));

  const unknown = parseRulesetCatalogFile(withAsset, "spells", JSON.parse(catalogFile(emberEntries, "spells")));
  assert.ok(!unknown.ok && /is not a catalog of this ruleset/.test(unknown.issues[0]!));

  const badEntry = parseRulesetCatalogFile(
    withAsset,
    "knacks",
    JSON.parse(catalogFile([{ id: "bad", label: "Bad", rows: [{ list: "knacks", values: { level: 3 } }] }])),
  );
  assert.ok(!badEntry.ok, "an asset file cannot write what an inline entry could not");
  assert.ok(
    badEntry.issues.some((issue) => /entries\.0\.rows\.0\.values: Unknown column "level"/.test(issue)),
    badEntry.issues.join("; "),
  );

  const notACatalog = parseRulesetCatalogFile(withAsset, "knacks", {
    schemaVersion: 2,
    catalog: "knacks",
    entries: [],
  });
  assert.ok(!notACatalog.ok && notACatalog.issues.some((issue) => /schemaVersion/.test(issue)));
}

// ── The reserved asset family ──
{
  assert.equal(rulesetCatalogAssetPath("knacks"), "catalogs/knacks.json");
  assert.ok(isRulesetCatalogAssetPath("catalogs/knacks.json"));
  assert.ok(!isRulesetCatalogAssetPath("catalogs/Knacks.json"));
  assert.ok(!isRulesetCatalogAssetPath("catalogs/deeper/knacks.json"));
  assert.ok(!isRulesetCatalogAssetPath("catalogs/knacks.json.png"));
  assert.ok(!isRulesetCatalogAssetPath("ruleset.json"));
}

// ── Capability API 1.21 ──
{
  assert.ok(
    supportedCapabilityApi.major > 1 || supportedCapabilityApi.minor >= 21,
    "the host still advertises the catalog seam introduced in API 1.21",
  );
  const manifest = (capabilityApi: { major: number; minor: number }, paths: string[]) => ({
    schemaVersion: 2,
    capabilityApi,
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-ember-roads",
    name: "Ember Roads",
    version: "0.1.0",
    description: "A ruleset package with a catalog.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths } },
    files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
    permissions: [],
    restartRequired: false,
  });
  const both = ["ruleset.json", "catalogs/knacks.json"];
  assert.ok(capabilityPackageManifestSchema.safeParse(manifest({ major: 1, minor: 21 }, both)).success);
  assert.throws(
    () => capabilityPackageManifestSchema.parse(manifest({ major: 1, minor: 20 }, both)),
    /catalogs\/<id>\.json requires schemaVersion 2 and capabilityApi 1\.21 or newer/,
    "a package cannot ship catalogs on the declaration that predates them",
  );
  assert.throws(
    () => capabilityPackageManifestSchema.parse(manifest({ major: 1, minor: 21 }, ["catalogs/knacks.json"])),
    /must ship beside the ruleset\.json that declares it/,
    "a catalog file on its own is a document nothing would read",
  );
  // 1.20 still installs a ruleset without catalogs, which is every ruleset package shipped so far.
  assert.ok(capabilityPackageManifestSchema.safeParse(manifest({ major: 1, minor: 20 }, ["ruleset.json"])).success);
}

// ── A really installed package, written before the server loads ──
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-catalogs-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

type Fixture = { id: string; ruleset: string; catalog: string; catalogBytes?: number };
const packages = [
  // Serves its catalog from a hash-pinned asset.
  { id: "ember-roads", ruleset: ruleset(asAsset), catalog: catalogFile(emberEntries) },
  // Declares a catalog larger than the ceiling, so it is refused before anything reads it.
  {
    id: "cinder-wastes",
    ruleset: ruleset((doc) => {
      asAsset(doc);
      doc.id = "cinder-wastes";
      doc.name = "Cinder Wastes";
    }),
    catalog: catalogFile(emberEntries),
    catalogBytes: RULESET_CATALOG_MAX_BYTES + 1,
  },
  // Ships a catalog file whose entry the sheet could not hold.
  {
    id: "glass-roads",
    ruleset: ruleset((doc) => {
      asAsset(doc);
      doc.id = "glass-roads";
      doc.name = "Glass Roads";
    }),
    catalog: catalogFile([{ id: "bad", label: "Bad", rows: [{ list: "knacks", values: { level: 3 } }] }]),
  },
] satisfies Fixture[];

const installedPackages = packages.map((fixture) => {
  const packageId = `ruleset-${fixture.id}`;
  const files = [
    { path: "ruleset.json", data: Buffer.from(fixture.ruleset, "utf8") },
    { path: "catalogs/knacks.json", data: Buffer.from(fixture.catalog, "utf8"), bytes: fixture.catalogBytes },
  ];
  const manifest = {
    schemaVersion: 2,
    // 1.37, because the example ruleset carries the combat bridge's battle block, a scaled catalog
    // row, a layer, a combat block, catalog mechanics a fight reads, a catalog of creatures, the
    // keys that give that fight a board, the ones that say what one turn of it can do, a creature
    // written in the ruleset's own terms, a track always shown, a summary list's columns, a
    // modifier off the sheet, a list added up and a track of numbered boxes.
    capabilityApi: { major: 1, minor: 40 },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: packageId,
    name: fixture.id,
    version: "0.1.0",
    description: "A packaged ruleset with a catalog.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: files.map((file) => file.path) } },
    files: files.map((file) => ({
      path: file.path,
      sha256: createHash("sha256").update(file.data).digest("hex"),
      bytes: file.bytes ?? file.data.length,
    })),
    permissions: [],
    restartRequired: false,
  };
  const packageDir = join(dataDir, "capability-packages", "versions", packageId, manifest.version);
  mkdirSync(join(packageDir, "catalogs"), { recursive: true });
  for (const file of files) writeFileSync(join(packageDir, file.path), file.data);
  return {
    id: packageId,
    version: manifest.version,
    manifest,
    installedAt: "2026-09-18T00:00:00.000Z",
    status: "active",
    error: null,
    legacy: false,
  };
});
writeFileSync(
  join(dataDir, "capability-packages", "installed.json"),
  JSON.stringify({ schemaVersion: 1, packages: installedPackages }),
);

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { capabilityPackagesRoutes } = await import("../../packages/server/src/routes/capability-packages.routes.js");
const { gameRulesetsRoutes } = await import("../../packages/server/src/routes/game-rulesets.routes.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
// The app's own handler, so a bad query answers here exactly as it does in the running server.
app.setErrorHandler(errorHandler);
await app.register(capabilityPackagesRoutes, { prefix: "/api/capability-packages" });
await app.register(gameRulesetsRoutes, { prefix: "/api/game-rulesets" });

const importRuleset = (definition: string) =>
  app.inject({ method: "POST", url: "/api/game-rulesets/import", payload: { definition } });
const catalogRequest = (query: Record<string, string>) =>
  app.inject({
    method: "GET",
    url: `/api/capability-packages/rulesets/catalog?${new URLSearchParams(query).toString()}`,
  });

try {
  // ── Install refuses a ruleset with catalogs on a declaration that predates them ──
  {
    const manifest = installedPackages[0]!.manifest;
    const olderManifest = { ...manifest, capabilityApi: { major: 1, minor: 20 } };
    assert.equal(
      getCapabilityPackageInstallIssue(manifest as any, JSON.parse(packages[0]!.ruleset)),
      null,
      "a current package with catalogs installs",
    );
    assert.match(
      getCapabilityPackageInstallIssue(olderManifest as any, JSON.parse(packages[0]!.ruleset)) ?? "",
      /requires schemaVersion 2 and capabilityApi 1\.21 or newer/,
      "the gate reads the ruleset file, because catalogs live inside it and not in the manifest",
    );
    assert.equal(
      getCapabilityPackageInstallIssue(
        olderManifest as any,
        JSON.parse(
          ruleset((doc) => {
            delete doc.catalogs;
            delete doc.battle;
            // Layers and combat have gates of their own, proven in their own regressions.
            withoutLaterGates(doc);
          }),
        ),
      ),
      null,
      "the same package without catalogs is unaffected",
    );
    assert.equal(
      getCapabilityPackageInstallIssue(olderManifest as any, undefined),
      null,
      "an unreadable ruleset is the registry's story, not a failed install",
    );
    // A catalog file the ruleset names but the package never declared would install and then leave
    // the picker with nothing to open, so it is refused where the author can still fix it.
    const undeclaredAsset = JSON.parse(packages[0]!.ruleset);
    undeclaredAsset.catalogs = [{ ...undeclaredAsset.catalogs[0], asset: "catalogs/never_declared.json" }];
    delete undeclaredAsset.catalogs[0].entries;
    assert.match(
      getCapabilityPackageInstallIssue(manifest as any, undeclaredAsset) ?? "",
      /catalogs\/never_declared\.json, which is not listed in contributions\.assets\.paths/,
    );
    // A path that cannot be normalized matches nothing, even when the manifest declares one that
    // cannot be normalized either.
    const unusablePath = JSON.parse(JSON.stringify(undeclaredAsset));
    unusablePath.catalogs[0].asset = "../outside.json";
    const manifestWithUnusablePath = {
      ...manifest,
      contributions: {
        ...manifest.contributions,
        assets: { paths: [...(manifest.contributions?.assets?.paths ?? []), "../also-outside.json"] },
      },
    };
    assert.match(
      getCapabilityPackageInstallIssue(manifestWithUnusablePath as any, unusablePath) ?? "",
      /which is not listed in contributions\.assets\.paths/,
    );

    // ── A scaled row needs 1.23, inline or in the catalog file ──
    const before123 = { ...manifest, capabilityApi: { major: 1, minor: 22 } };
    const scaledIssue = /scaled catalog rows requires schemaVersion 2 and capabilityApi 1\.23 or newer/;
    assert.match(
      getCapabilityPackageInstallIssue(before123 as any, JSON.parse(ruleset())) ?? "",
      scaledIssue,
      "the example's scaled trick row is read out of the inline catalog",
    );
    const withoutScaled = JSON.parse(
      ruleset((doc) => {
        for (const entry of doc.catalogs[0].entries) for (const row of entry.rows) delete row.scaled;
        withoutLaterGates(doc);
      }),
    );
    assert.equal(
      getCapabilityPackageInstallIssue(before123 as any, withoutScaled),
      null,
      "the same ruleset without a scaled row installs on 1.22",
    );
    // The install path holds the verified bytes of every declared asset, so the same gate reads a
    // scaled row out of a catalog FILE rather than only out of the ruleset.
    const assetRuleset = JSON.parse(packages[0]!.ruleset);
    // Layers and combat gate on their own declarations, which these cases are not about.
    withoutLaterGates(assetRuleset);
    const assetPath = rulesetCatalogAssetPath("knacks");
    const scaledFile = JSON.parse(packages[0]!.catalog);
    // The entries in the FILE gate on their own later declarations too, and these cases are about
    // the scaled row and nothing else.
    scaledFile.entries = (scaledFile.entries ?? []).filter(
      (entry: Record<string, any>) => entry.mechanics?.kind !== "rider",
    );
    for (const entry of scaledFile.entries) {
      for (const key of ["plus", "free", "gives", "standard", "rider"]) delete entry.mechanics?.[key];
    }
    assert.match(
      getCapabilityPackageInstallIssue(before123 as any, assetRuleset, new Map([[assetPath, scaledFile]])) ?? "",
      scaledIssue,
    );
    assert.equal(
      getCapabilityPackageInstallIssue(manifest as any, assetRuleset, new Map([[assetPath, scaledFile]])),
      null,
      "the same file installs once the package declares 1.23",
    );
    assert.equal(
      getCapabilityPackageInstallIssue(before123 as any, assetRuleset),
      null,
      "a catalog file the caller did not hand over is not guessed at",
    );
  }

  // ── A community ruleset carries its catalogs inline, through the ordinary import ──
  const plainRoads = ruleset((doc) => {
    doc.id = "plain-roads";
    doc.name = "Plain Roads";
    delete doc.catalogs;
    // The example's layer hides entries out of the catalog this one does not have.
    delete doc.layers;
  });
  for (const definition of [
    ruleset(),
    ruleset((doc) => {
      doc.version = 2;
      doc.catalogs[0].entries = doc.catalogs[0].entries.slice(0, 2);
      withoutSheetCreatures(doc);
    }),
    plainRoads,
  ]) {
    const imported = await importRuleset(definition);
    assert.equal(imported.statusCode, 200, imported.body);
    assert.equal(imported.json().status, "added", "a file with an inline catalog imports like any other");
  }

  // ── The list never carries entries ──
  {
    const listed = await app.inject({ method: "GET", url: "/api/capability-packages/rulesets" });
    assert.equal(listed.statusCode, 200, listed.body);
    const entries = listed.json() as Array<{ definition: Record<string, any> }>;
    const byId = new Map(entries.map((entry) => [entry.definition.id as string, entry.definition]));

    const inline = byId.get("local/ember-roads")!;
    assert.equal(inline.catalogs[0].entries, undefined, "inline entries never ride in the list");
    assert.equal(inline.catalogs[0].entryCount, 2, "the list says how many there are instead");
    assert.deepEqual(inline.catalogs[0].feeds, ["knacks", "tricks"], "the rest of the header is intact");
    assert.equal(inline.catalogs[0].filters.length, 3);

    const packaged = byId.get("ember-roads")!;
    assert.equal(packaged.catalogs[0].asset, "catalogs/knacks.json");
    assert.equal(packaged.catalogs[0].entryCount, undefined, "an asset catalog has nothing to count yet");

    const plain = byId.get("local/plain-roads")!;
    assert.equal("catalogs" in plain, false, "a ruleset without catalogs gains no key");
    assert.deepEqual(
      plain,
      { ...parsedOrThrow(plainRoads), id: "local/plain-roads" },
      "and is listed exactly as it was before catalogs existed",
    );
  }

  // ── The catalog route: an inline community catalog, at the version asked for ──
  {
    const latest = await catalogRequest({ rulesetId: "local/ember-roads", catalogId: "knacks" });
    assert.equal(latest.statusCode, 200, latest.body);
    const payload = latest.json();
    assert.equal(payload.rulesetId, "local/ember-roads");
    assert.equal(payload.version, 2, "no version asked for means the newest installed one");
    assert.equal(payload.entries.length, 2);
    assert.equal(payload.catalog.id, "knacks");
    assert.equal("entries" in payload.catalog, false, "the header does not repeat the entries");
    assert.equal("asset" in payload.catalog, false);

    const pinned = await catalogRequest({ rulesetId: "local/ember-roads", catalogId: "knacks", version: "1" });
    assert.equal(pinned.statusCode, 200, pinned.body);
    assert.equal(pinned.json().version, 1);
    assert.equal(pinned.json().entries.length, 7, "a game on version 1 picks from version 1's catalog");

    const gone = await catalogRequest({ rulesetId: "local/ember-roads", catalogId: "knacks", version: "9" });
    assert.equal(gone.statusCode, 404, gone.body);
    assert.equal(gone.json().code, "ruleset_version_missing");
  }

  // ── The catalog route: a package asset, hash-pinned ──
  {
    const served = await catalogRequest({ rulesetId: "ember-roads", catalogId: "knacks" });
    assert.equal(served.statusCode, 200, served.body);
    const payload = served.json();
    assert.equal(payload.entries.length, 7);
    assert.equal(payload.version, 1);
    assert.deepEqual(
      payload.entries.map((entry: RulesetCatalogEntry) => entry.id),
      emberEntries.map((entry) => entry.id),
      "the asset's entries are the ones the file holds",
    );
    assert.equal(payload.entries[3].rows.length, 2, "an asset entry may fill two lists too");

    // A packaged catalog is named by its pinned hash, so a browser that already holds it is told so
    // without the file being read and checked again.
    const etag = served.headers.etag;
    assert.match(
      String(etag),
      /^"[a-f0-9]{64}\.1\.[a-f0-9]{16}"$/u,
      "the hash of the file, the ruleset version, and a digest of the catalog's header",
    );
    assert.equal(served.headers["cache-control"], "no-cache");
    const unchanged = await app.inject({
      method: "GET",
      url: "/api/capability-packages/rulesets/catalog?rulesetId=ember-roads&catalogId=knacks",
      headers: { "if-none-match": String(etag) },
    });
    assert.equal(unchanged.statusCode, 304, unchanged.body);
    assert.equal(unchanged.body, "");
  }

  // ── A turn reads the same asset, through the service both callers share ──
  // Only when the reply actually asks to use something, and only the catalogs the party's own rows
  // point at, because a catalog can be a megabyte and most turns need none of it.
  {
    const { loadTurnRulesetCatalogs } =
      await import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js");
    const definition = parsedOrThrow(packages[0]!.ruleset);
    const build = rulesetSheetBuildSchema.parse({
      lists: { tricks: [rowsFromCatalogEntry("knacks", emberEntries[3]!).find((row) => row.list === "tricks")!.row] },
    });
    const context = {
      definition,
      packageId: "ruleset-ember-roads",
      cards: [{ name: "Vex", build }],
      playerName: "Vex",
    };
    assert.deepEqual(
      await loadTurnRulesetCatalogs(context, 'She thinks about it. [sheet: op="spend" pool="grit" amount="1"]'),
      {},
      "a turn with no use command reads no catalog at all",
    );
    const loaded = await loadTurnRulesetCatalogs(context, '[sheet: op="cast" spell="Last Ember"]');
    assert.deepEqual(Object.keys(loaded), ["knacks"]);
    assert.deepEqual(
      loaded.knacks!.map((entry) => entry.id),
      emberEntries.map((entry) => entry.id),
    );
    // A sheet whose rows point at no catalog asks for none, even with a use command in the reply.
    assert.deepEqual(
      await loadTurnRulesetCatalogs(
        { ...context, cards: [{ name: "Vex", build: rulesetSheetBuildSchema.parse({}) }] },
        '[sheet: op="use" name="Last Ember"]',
      ),
      {},
    );
    // A package that no longer holds the file loses the command, not the turn.
    assert.deepEqual(
      await loadTurnRulesetCatalogs({ ...context, packageId: "gone" }, '[sheet: op="use" name="x"]'),
      {},
    );
  }

  // ── What the route refuses ──
  {
    const overCap = await catalogRequest({ rulesetId: "cinder-wastes", catalogId: "knacks" });
    assert.equal(overCap.statusCode, 422, overCap.body);
    assert.equal(overCap.json().code, "ruleset_catalog_unusable");
    assert.match(overCap.json().issues[0], new RegExp(`over the ${RULESET_CATALOG_MAX_BYTES}-byte limit`));

    const badEntry = await catalogRequest({ rulesetId: "glass-roads", catalogId: "knacks" });
    assert.equal(badEntry.statusCode, 422, badEntry.body);
    assert.equal(badEntry.json().code, "ruleset_catalog_unusable");
    assert.match(badEntry.json().issues[0], /Unknown column "level"/);

    const noRuleset = await catalogRequest({ rulesetId: "nowhere-roads", catalogId: "knacks" });
    assert.equal(noRuleset.statusCode, 404, noRuleset.body);
    assert.equal(noRuleset.json().code, "ruleset_not_installed");

    const noCatalog = await catalogRequest({ rulesetId: "ember-roads", catalogId: "spells" });
    assert.equal(noCatalog.statusCode, 404, noCatalog.body);
    assert.equal(noCatalog.json().code, "ruleset_catalog_missing");

    const noQuery = await app.inject({ method: "GET", url: "/api/capability-packages/rulesets/catalog" });
    assert.equal(noQuery.statusCode, 400, "the query is validated, never guessed");
  }

  console.info("game ruleset catalog regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
