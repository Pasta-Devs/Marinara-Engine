/** Capability API 1.220: a catalog borrowed from another installed ruleset, read against the borrower,
 *  with its own entries beside it; a creature that does not fit is left out, and its art matches as
 *  the lender's. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findCreatureArt,
  parseBorrowedRulesetCatalog,
  parseRulesetDefinition,
  type CreaturePack,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-borrowed-catalog-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const baseText = readFileSync(new URL("../../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8");
const lenderDoc = JSON.parse(baseText) as Record<string, any>;
const lenderCreatures = lenderDoc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures");
const ownCreature = { ...lenderCreatures.entries[0], id: "briar-hag", label: "Briar Hag" };
const borrower = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.id = "borrower-5e";
  doc.name = "Borrower 5e";
  const at = doc.catalogs.findIndex((catalog: { id: string }) => catalog.id === "creatures");
  doc.catalogs[at] = {
    id: "creatures",
    label: "Creatures",
    holds: "creatures",
    from: { ruleset: "5e-2014", catalog: "creatures" },
    // Its own entries are checked as the ruleset is read, so it names the filters they carry.
    filters: lenderCreatures.filters,
    entries: [ownCreature],
  };
  edit(doc);
  return doc;
};
const parse = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const issuesOf = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  return result.ok ? "" : result.issues.join("; ");
};

try {
  // ── The schema ──
  const definition = parse(borrower());
  assert.match(
    issuesOf(
      borrower((doc) => (doc.catalogs.find((c: any) => c.id === "creatures").asset = "catalogs/creatures.json")),
    ),
    /exactly one of "entries" or "asset", or "from"/,
  );
  assert.equal(
    issuesOf(borrower((doc) => delete doc.catalogs.find((c: any) => c.id === "creatures").entries)),
    "",
    "a borrowed catalog needs no entries of its own",
  );
  assert.match(
    issuesOf(borrower((doc) => (doc.catalogs.find((c: any) => c.id === "creatures").from.ruleset = "Not An Id"))),
    /A ruleset id is lowercase/,
  );

  // ── Reading the lender's file against the borrower ──
  const lenderFile = (entries: unknown[]) => ({ schemaVersion: 1, catalog: "creatures", entries });
  const read = parseBorrowedRulesetCatalog(
    definition,
    "creatures",
    lenderCreatures,
    lenderFile(lenderCreatures.entries),
  );
  assert.ok(read.ok, read.ok ? "" : read.issues.join("; "));
  assert.deepEqual(
    read.entries.map((entry) => entry.id),
    [...lenderCreatures.entries.map((entry: { id: string }) => entry.id), "briar-hag"],
    "every lender creature, then the borrower's own",
  );
  assert.deepEqual(read.dropped, []);
  // An own entry of the same id stands in for the lender's.
  const replaced = parseBorrowedRulesetCatalog(
    parse(
      borrower(
        (doc) =>
          (doc.catalogs.find((c: any) => c.id === "creatures").entries = [{ ...ownCreature, id: "thorn-lurker" }]),
      ),
    ),
    "creatures",
    lenderCreatures,
    lenderFile(lenderCreatures.entries),
  );
  assert.ok(replaced.ok);
  assert.equal(replaced.entries.length, lenderCreatures.entries.length);
  assert.equal(replaced.entries.find((entry) => entry.id === "thorn-lurker")?.label, "Briar Hag");
  // A creature that names what the borrower lacks is left out, and named; the rest still come.
  const odd = JSON.parse(JSON.stringify(lenderCreatures.entries[2]));
  odd.id = "dread-piper";
  // The grave piper's song puts on "frightened"; this one a condition nobody declares.
  const text = JSON.stringify(odd).replace(/"condition":"frightened"/g, '"condition":"dread_song"');
  const withOdd = parseBorrowedRulesetCatalog(
    definition,
    "creatures",
    lenderCreatures,
    lenderFile([...lenderCreatures.entries, JSON.parse(text)]),
  );
  assert.ok(withOdd.ok, withOdd.ok ? "" : withOdd.issues.join("; "));
  assert.equal(withOdd.entries.length, lenderCreatures.entries.length + 1);
  assert.equal(withOdd.dropped.length, 1);
  assert.match(withOdd.dropped[0]!, /^dread-piper \(.*dread_song/);
  // A sheet written in the lender's ids reads in the borrower's: a field left out, tiers renamed.
  const renamed = (sheet: unknown) =>
    parseBorrowedRulesetCatalog(
      parse(borrower((doc) => (doc.catalogs.find((c: any) => c.id === "creatures").from.sheet = sheet))),
      "creatures",
      lenderCreatures,
      lenderFile(lenderCreatures.entries),
    );
  const renaming = renamed({ fields: { attacks_per_action: null }, tiers: { none: "half" } });
  assert.ok(renaming.ok && renaming.dropped.length === 0, JSON.stringify(renaming).slice(0, 400));
  const sergeant = renaming.entries.find((entry) => entry.id === "toll-sergeant")!.creature!.sheet!;
  assert.equal(sergeant.fields?.attacks_per_action, undefined);
  assert.equal(sergeant.fields?.ac, 17);
  assert.equal(sergeant.skills?.athletics, "proficient");
  // A tier the borrower does not offer where it lands leaves the creature out, and says why.
  const expert = renamed({ tiers: { proficient: "expertise" } });
  assert.ok(expert.ok);
  assert.match(expert.dropped.join(" "), /^toll-sergeant \(creature\.sheet\.saves\.str_save: .*"expertise" for saves/);
  assert.match(
    issuesOf(
      borrower(
        (doc) => (doc.catalogs.find((c: any) => c.id === "creatures").from.sheet = { tiers: { proficient: 3 } }),
      ),
    ),
    /from\.sheet\.tiers/,
  );

  // An item written against the lender's sheet: its derived values read as the borrower's own
  // values (`refs`), and its slot under the borrower's name (`slots`).
  const plate = {
    id: "plate",
    label: "Plate",
    item: {
      category: "armor",
      slots: { body: 1 },
      requires: [{ value: { derived: "armor_speed_strength" }, atLeast: 15, otherwise: { vulnerable: ["slashing"] } }],
    },
  };
  const gear = (sheet?: unknown) =>
    parse(
      borrower((doc) => {
        doc.items = {
          categories: [{ id: "armor", label: "Armor" }],
          slots: [{ id: "armor", label: "Armor", count: 1 }],
        };
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          from: { ruleset: "5e-2014", catalog: "magic_items", ...(sheet ? { sheet } : {}) },
        });
      }),
    );
  const gearFile = { schemaVersion: 1, catalog: "magic_items", entries: [plate] };
  const unmapped = parseBorrowedRulesetCatalog(gear(), "gear", {}, gearFile);
  assert.ok(unmapped.ok && unmapped.entries.length === 0, JSON.stringify(unmapped).slice(0, 600));
  assert.match(unmapped.dropped[0]!, /^plate \(.*(body|armor_speed_strength)/);
  const mapped = parseBorrowedRulesetCatalog(
    gear({ refs: { armor_speed_strength: { abilityScore: "str" } }, slots: { body: "armor" } }),
    "gear",
    {},
    gearFile,
  );
  assert.ok(mapped.ok && mapped.dropped.length === 0, JSON.stringify(mapped).slice(0, 400));
  assert.deepEqual(mapped.entries[0]!.item!.slots, { armor: 1 });
  assert.deepEqual(mapped.entries[0]!.item!.requires![0]!.value, { abilityScore: "str" });

  // A tier an entry grants or asks for reads in the borrower's tiers too.
  const knack = {
    id: "knack",
    label: "Knack",
    grants: { trained: { tier: "master", choose: [{ what: "skills", count: 1, held: "skilled" }] } },
  };
  const knacks = parse(
    borrower((doc) => {
      const feats = doc.catalogs.find((c: any) => c.id === "feats");
      delete feats.entries;
      feats.from = {
        ruleset: "5e-2014",
        catalog: "feats",
        sheet: { tiers: { skilled: "proficient", master: "expertise" } },
      };
    }),
  );
  const tiered = parseBorrowedRulesetCatalog(
    knacks,
    "feats",
    {},
    { schemaVersion: 1, catalog: "feats", entries: [knack] },
  );
  assert.ok(tiered.ok && tiered.dropped.length === 0, JSON.stringify(tiered).slice(0, 400));
  assert.deepEqual(tiered.entries[0]!.grants, {
    trained: { tier: "expertise", choose: [{ what: "skills", count: 1, held: "proficient" }] },
  });

  // The file must be the catalog it borrows.
  const wrong = parseBorrowedRulesetCatalog(definition, "creatures", lenderCreatures, {
    schemaVersion: 1,
    catalog: "feats",
    entries: [],
  });
  assert.ok(!wrong.ok && /for "feats", not "creatures"/.test(wrong.issues[0]!));

  // ── Art: a borrowed creature is drawn as the lender's ──
  const pack = {
    creaturePackVersion: 1,
    id: "art",
    name: "Art",
    version: "1.0.0",
    tileSize: 48,
    sheets: [],
    creatures: [
      { id: "lurker", match: ["5e-2014/creatures/thorn-lurker"], size: "medium", w: 1, h: 2, frames: 1, variants: [] },
    ],
  } as unknown as CreaturePack;
  assert.equal(
    findCreatureArt(pack, {
      creature: { catalogId: "creatures", entryId: "thorn-lurker", from: { ruleset: "5e-2014", catalog: "creatures" } },
      rulesetId: "local/borrower-5e",
      name: "Thorn Lurker",
    })?.id,
    "lurker",
  );
  assert.equal(
    findCreatureArt(pack, {
      creature: { catalogId: "creatures", entryId: "thorn-lurker" },
      rulesetId: "local/borrower-5e",
      name: "x",
    }),
    null,
    "an own creature is matched as the borrower's",
  );

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "borrower-5e",
    name: "Borrower",
    version: "1.0.0",
    description: "Borrowed catalog proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(219, borrower()) ?? "", /1\.220/);
  assert.equal(gate(220, borrower()), null);

  // ── Played: the loader finds the lender among the installed rulesets ──
  const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
  const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
  const { setCustomAgentImportsEnabled } =
    await import("../../../packages/server/src/services/agents/custom-agent-import-policy.service.js");
  const { gameRulesetsRoutes } = await import("../../../packages/server/src/routes/game-rulesets.routes.js");
  const { loadRulesetCatalogEntries } =
    await import("../../../packages/server/src/services/game/ruleset-catalog.service.js");
  const { readRulesetRegistry } = await import("../../../packages/server/src/services/game/ruleset-registry.service.js");
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(gameRulesetsRoutes, { prefix: "/api/game-rulesets" });
  try {
    await setCustomAgentImportsEnabled(db, true);
    const load = async () => {
      const registered = (await readRulesetRegistry(db)).get("local/borrower-5e");
      assert.ok(registered, "the borrower is registered");
      const header = registered.definition.catalogs!.find((each) => each.id === "creatures")!;
      return loadRulesetCatalogEntries(registered.packageId, registered.definition, header);
    };
    const importText = async (doc: unknown) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game-rulesets/import",
        payload: { definition: JSON.stringify(doc) },
      });
      assert.ok(response.statusCode < 300, response.body);
    };
    await importText(borrower());
    const missing = await load();
    assert.ok(!missing.ok && /"5e-2014" this catalog borrows from is not installed/.test(missing.issues[0]!));
    await importText(lenderDoc);
    const loaded = await load();
    assert.ok(loaded.ok, loaded.ok ? "" : loaded.issues.join("; "));
    assert.equal(loaded.entries.length, lenderCreatures.entries.length + 1);
  } finally {
    await app.close();
    await closeDB();
  }

  console.log("game-ruleset-borrowed-catalog: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
