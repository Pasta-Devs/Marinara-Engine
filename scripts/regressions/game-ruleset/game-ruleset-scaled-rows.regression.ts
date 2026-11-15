/**
 * Scaled row values: the number columns of a catalog-picked row that the RULESET keeps up to date,
 * so a maximum can follow a level or an ability without anyone editing the sheet.
 *
 * What is pinned here:
 *   - Nothing is 5e-shaped. The rule is proven on the authoring guide's 2d6 example, whose trick
 *     uses follow an ability score with no table at all, and on the 5e example, where a test
 *     catalog's class resource follows the level through a step table.
 *   - Every name a `scaled` map uses is checked where the catalog is: a column that is not there, a
 *     column that is not a number, a reference that points at nothing, and two rows for one list.
 *   - The recompute is on EDIT and never on read: it returns the same build when nothing changed,
 *     so a sheet that was only opened is never rewritten.
 *   - The value is fitted to the column it lands in: clamped to its range and floored when the
 *     column is whole numbers, so it can never write something the editor would then refuse.
 *   - A row with no mark, an unknown catalog and an unknown entry are all left exactly as they are.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  parseRulesetDefinition,
  recomputeScaledRows,
  rowsFromCatalogEntry,
  rulesetCatalogIdsForBuild,
  rulesetSheetBuildSchema,
  rulesetCatalogEntriesByRef,
  scaledRowColumns,
  RULESET_CATALOG_ROW_KEY,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../../packages/shared/src/index.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const emberText = read("../../../docs/examples/rulesets/ember-roads.json");
const fiveText = read("../../../docs/development/ruleset-5e-2014.example.json");

/** A variant of one of the shipped example files: parse, edit, validate. */
function parsed(text: string, edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, `the example must stay usable: ${result.ok ? "" : result.issues.join("; ")}`);
  return result.definition;
}
/** The issues a variant is refused with, for the checks that are supposed to fail. */
function issuesOf(text: string, edit: (doc: Record<string, any>) => void): string[] {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  const result = parseRulesetDefinition(doc);
  assert.equal(result.ok, false, "this variant must be refused");
  return result.ok ? [] : result.issues;
}
const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);

const ember = parsed(emberText);
const emberCatalogs: RulesetCatalogEntriesById = { knacks: ember.catalogs![0]!.entries! };
/** The trick row the example scales, plus the knack row that comes with the same pick. */
const emberRows = rowsFromCatalogEntry(
  "knacks",
  ember.catalogs![0]!.entries!.find((e) => e.id === "last-ember")!,
);
const emberBuild = (heart: number, uses = 1) =>
  build({
    abilities: { brawn: 0, wits: 0, heart },
    lists: {
      knacks: [emberRows.find((row) => row.list === "knacks")!.row],
      tricks: [{ ...emberRows.find((row) => row.list === "tricks")!.row, uses }],
    },
  });

// ── The shipped 2d6 example carries one, and it does not read a level ──
{
  const trick = ember
    .catalogs![0]!.entries!.find((entry) => entry.id === "last-ember")!
    .rows.find((row) => row.list === "tricks")!;
  assert.deepEqual(trick.scaled, { uses: { from: { abilityScore: "heart" } } });
  assert.equal(trick.values.uses, 1, "the row still holds what it is before any sheet is known");
  assert.equal(ember.resolution.dice.count, 2, "the scaled example is not a d20 system");
  // The fight's own `levels` are rungs of a track (Heat), not a character level, so they are left out.
  assert.equal(
    JSON.stringify({ ...ember, combat: { ...ember.combat, levels: undefined } }).includes("level"),
    false,
    "nothing about scaled values needs the word level; this system has none",
  );
}

// ── The catalog checks: a scaled column has to name something real ──
{
  const scaleTrick = (doc: Record<string, any>, scaled: unknown) => {
    const entry = doc.catalogs[0].entries.find((candidate: any) => candidate.id === "last-ember");
    entry.rows.find((row: any) => row.list === "tricks").scaled = scaled;
  };
  const refusedWith = (scaled: unknown) => issuesOf(emberText, (doc) => scaleTrick(doc, scaled)).join("; ");

  assert.match(refusedWith({ heat: { from: { abilityScore: "heart" } } }), /Unknown column "heat"/);
  assert.match(refusedWith({ name: { from: { abilityScore: "heart" } } }), /Column "name" is not a number/);
  assert.match(refusedWith({ uses: { from: { abilityScore: "charm" } } }), /Unknown ability "charm"/);
  assert.match(refusedWith({ uses: { from: { field: "calling" } } }), /Field "calling" is not a number/);
  assert.match(refusedWith({ uses: { from: { derived: "nope" } } }), /Unknown derived value "nope"/);
  // A derived value may be named whatever its position is: a scaled column sits outside the sheet's
  // own top-to-bottom order, exactly like a live pool's maximum.
  assert.ok(parsed(emberText, (doc) => scaleTrick(doc, { uses: { from: { derived: "grit_max" } } })));
  const one = { from: { const: 1 } };
  assert.match(refusedWith({ a: one, b: one, c: one, d: one, e: one }), /At most 4 columns of a row can be scaled/);
  // An empty map scales nothing, so it is a mistake rather than a harmless extra.
  assert.match(refusedWith({}), /scaled names at least one column, or is left out/);
  assert.match(refusedWith({ "Not An Id": { from: { const: 1 } } }), /An id is lowercase letters/);

  // The row has to hold a starting number for a column it scales: an entry is picked before any
  // sheet is known, and a reader without the catalog never sees the recompute.
  const noStart = issuesOf(emberText, (doc) => {
    const entry = doc.catalogs[0].entries.find((candidate: any) => candidate.id === "last-ember");
    delete entry.rows.find((row: any) => row.list === "tricks").values.uses;
  }).join("; ");
  assert.match(noStart, /Scaled column "uses" needs a starting value in values/);

  // Two rows for one list under ONE name, so a marked row on a sheet could not be matched to its spec.
  const twoRows = issuesOf(emberText, (doc) => {
    const entry = doc.catalogs[0].entries.find((candidate: any) => candidate.id === "last-ember");
    entry.rows.push({ list: "tricks", values: { name: "Last Ember", uses: 1, recharge: "camp" } });
  }).join("; ");
  assert.match(
    twoRows,
    /A scaled row must be this entry's only row for the list "tricks", or every row there must have its own name/,
  );
  // Under two names they are told apart (1.92).
  assert.ok(
    parsed(emberText, (doc) => {
      const entry = doc.catalogs[0].entries.find((candidate: any) => candidate.id === "last-ember");
      entry.rows.push({ list: "tricks", values: { name: "Second Ember", uses: 1, recharge: "camp" } });
    }),
  );
  // The same entry with both rows and NO scaled map is fine: the rule is about the spec, not rows.
  assert.ok(
    parsed(emberText, (doc) => {
      const entry = doc.catalogs[0].entries.find((candidate: any) => candidate.id === "last-ember");
      delete entry.rows.find((row: any) => row.list === "tricks").scaled;
      entry.rows.push({ list: "tricks", values: { name: "Second Ember", uses: 1, recharge: "camp" } });
    }),
  );
}

// ── Two scaled rows of one list, told apart by name (1.92) ──
{
  const twin = parsed(emberText, (doc) => {
    const entry = doc.catalogs[0].entries.find((candidate: any) => candidate.id === "last-ember");
    entry.rows.push({
      list: "tricks",
      values: { name: "Second Ember", uses: 0, recharge: "camp" },
      scaled: {
        uses: {
          from: { abilityScore: "heart" },
          table: [
            [0, 0],
            [3, 1],
          ],
        },
      },
    });
  });
  const twinCatalogs: RulesetCatalogEntriesById = { knacks: twin.catalogs![0]!.entries! };
  const twinRows = rowsFromCatalogEntry(
    "knacks",
    twin.catalogs![0]!.entries!.find((e) => e.id === "last-ember")!,
  );
  const tricks = twinRows.filter((row) => row.list === "tricks").map((row) => row.row);
  assert.deepEqual(
    tricks.map((row) => row.name),
    ["Last Ember", "Second Ember"],
  );
  const at = (heart: number) =>
    recomputeScaledRows(
      twin,
      build({ abilities: { brawn: 0, wits: 0, heart }, lists: { tricks } }),
      twinCatalogs,
    ).lists.tricks!.map((row) => [row.name, row.uses]);
  assert.deepEqual(
    at(2),
    [
      ["Last Ember", 2],
      ["Second Ember", 0],
    ],
    "each row follows its own spec",
  );
  assert.deepEqual(
    at(4),
    [
      ["Last Ember", 4],
      ["Second Ember", 1],
    ],
    "and the second opens at Heart 3",
  );
  // A row the player renamed matches no spec, and is left as it is.
  const renamed = build({
    abilities: { brawn: 0, wits: 0, heart: 4 },
    lists: { tricks: [tricks[0]!, { ...tricks[1]!, name: "My Ember", uses: 7 }] },
  });
  assert.equal(recomputeScaledRows(twin, renamed, twinCatalogs).lists.tricks![1]!.uses, 7);
  // An entry's only scaled row is matched as it always was, renamed or not.
  const ownName = build({
    abilities: { brawn: 0, wits: 0, heart: 2 },
    lists: { tricks: [{ ...emberRows.find((row) => row.list === "tricks")!.row, name: "Hearth Ember", uses: 7 }] },
  });
  assert.equal(recomputeScaledRows(ember, ownName, emberCatalogs).lists.tricks![0]!.uses, 2);
  assert.deepEqual(
    scaledRowColumns(twin, "tricks", tricks[1]!, twinCatalogs),
    ["uses"],
    "the second row's cell is locked",
  );
}

// ── The recompute on the 2d6 example: the ability, fitted to the column ──
{
  assert.deepEqual(rulesetCatalogIdsForBuild(ember, emberBuild(2)), ["knacks"]);

  const raised = recomputeScaledRows(ember, emberBuild(2), emberCatalogs);
  assert.equal(raised.lists.tricks![0]!.uses, 2, "the trick's uses follow Heart");
  assert.equal(raised.lists.knacks![0]!.name, "Last Ember", "the row that is not scaled is untouched");

  // Same reference when nothing changed, so an editor can store the result unconditionally.
  assert.equal(recomputeScaledRows(ember, raised, emberCatalogs), raised);
  assert.equal(recomputeScaledRows(ember, emberBuild(1), emberCatalogs).lists.tricks![0]!.uses, 1);

  // Clamped to the column's own range, both ends.
  assert.equal(recomputeScaledRows(ember, emberBuild(-1), emberCatalogs).lists.tricks![0]!.uses, 0);
  const generous = parsed(emberText, (doc) => {
    doc.catalogs[0].entries
      .find((entry: any) => entry.id === "last-ember")
      .rows.find((row: any) => row.list === "tricks").scaled = { uses: { from: { const: 40 } } };
  });
  const generousCatalogs = { knacks: generous.catalogs![0]!.entries! };
  assert.equal(recomputeScaledRows(generous, emberBuild(0), generousCatalogs).lists.tricks![0]!.uses, 9);

  // Floored, because the column takes whole numbers. `const` is the shortest way to a fraction.
  const fractional = parsed(emberText, (doc) => {
    doc.catalogs[0].entries
      .find((entry: any) => entry.id === "last-ember")
      .rows.find((row: any) => row.list === "tricks").scaled = { uses: { from: { const: 2.7 } } };
  });
  assert.equal(
    recomputeScaledRows(fractional, emberBuild(0), { knacks: fractional.catalogs![0]!.entries! }).lists.tricks![0]!
      .uses,
    2,
  );

  assert.deepEqual(scaledRowColumns(ember, "tricks", raised.lists.tricks![0]!, emberCatalogs), ["uses"]);
  assert.deepEqual(scaledRowColumns(ember, "knacks", raised.lists.knacks![0]!, emberCatalogs), []);
  // A caller drawing many rows builds the lookup once and hands it over; the answer is the same.
  assert.deepEqual(
    scaledRowColumns(ember, "tricks", raised.lists.tricks![0]!, rulesetCatalogEntriesByRef(emberCatalogs)),
    ["uses"],
  );
}

// ── Nothing the ruleset did not write is ever touched ──
{
  const handTyped = build({
    abilities: { heart: 3 },
    lists: { tricks: [{ name: "Home-made", uses: 1, recharge: "camp" }] },
  });
  assert.equal(recomputeScaledRows(ember, handTyped, emberCatalogs), handTyped, "a row with no mark is left alone");
  assert.deepEqual(scaledRowColumns(ember, "tricks", handTyped.lists.tricks![0]!, emberCatalogs), []);

  // A catalog the caller could not fetch, and a mark naming an entry that is gone.
  const unfetched = emberBuild(3);
  assert.equal(recomputeScaledRows(ember, unfetched, {}), unfetched);
  const stale = build({
    abilities: { heart: 3 },
    lists: { tricks: [{ name: "Last Ember", uses: 1, [RULESET_CATALOG_ROW_KEY]: "knacks/gone" }] },
  });
  assert.equal(recomputeScaledRows(ember, stale, emberCatalogs), stale);
  assert.deepEqual(rulesetCatalogIdsForBuild(ember, stale), ["knacks"], "the catalog is still the one to fetch");
}

// ── The 5e example, with a test catalog whose class resource follows the level ──
// The shipped 5e file has no catalogs of its own; the first-party package ships them. The point of
// this half is the OTHER shape: a step table, on a list whose rows are pools.
{
  const withCatalog = (edit: (entry: Record<string, any>) => void = () => {}) =>
    parsed(fiveText, (doc) => {
      const entry: Record<string, any> = {
        id: "rage",
        label: "Rage",
        rows: [
          {
            list: "counters",
            values: { name: "Rage", max: 2, recharge: "long" },
            scaled: {
              max: {
                from: { field: "level" },
                table: [
                  [1, 2],
                  [3, 3],
                  [6, 4],
                  [12, 5],
                  [17, 6],
                ],
              },
            },
          },
        ],
      };
      edit(entry);
      doc.catalogs = [{ id: "features", label: "Class features", feeds: ["counters"], entries: [entry] }];
    });
  const fiveE = withCatalog();
  const catalogs: RulesetCatalogEntriesById = { features: fiveE.catalogs![0]!.entries! };
  const rows = rowsFromCatalogEntry("features", fiveE.catalogs![0]!.entries![0]!);
  const barbarian = (level: number) =>
    rulesetSheetBuildSchema.parse({ fields: { level }, lists: { counters: [rows[0]!.row] } });

  for (const [level, max] of [
    [1, 2],
    [2, 2],
    [3, 3],
    [11, 4],
    [20, 6],
  ] as const) {
    assert.equal(recomputeScaledRows(fiveE, barbarian(level), catalogs).lists.counters![0]!.max, max, `level ${level}`);
  }
  const atFive = recomputeScaledRows(fiveE, barbarian(5), catalogs);
  assert.equal(recomputeScaledRows(fiveE, atFive, catalogs), atFive, "a sheet that did not change is not rewritten");
  assert.deepEqual(scaledRowColumns(fiveE, "counters", atFive.lists.counters![0]!, catalogs), ["max"]);
  assert.deepEqual(rulesetCatalogIdsForBuild(fiveE, atFive), ["features"]);

  // The same checks apply on this side of the format too.
  assert.match(
    issuesOf(fiveText, (doc) => {
      doc.catalogs = [
        {
          id: "features",
          label: "Class features",
          feeds: ["counters"],
          entries: [
            {
              id: "rage",
              label: "Rage",
              rows: [
                {
                  list: "counters",
                  values: { name: "Rage", max: 2 },
                  scaled: { recharge: { from: { field: "level" } } },
                },
              ],
            },
          ],
        },
      ];
    }).join("; "),
    /Column "recharge" is not a number/,
  );
}

console.log("game ruleset scaled-row regressions passed.");
