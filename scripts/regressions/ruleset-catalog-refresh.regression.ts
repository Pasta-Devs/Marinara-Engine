/**
 * Refresh from ruleset: which picked rows the ruleset now has different text for, and what applying
 * the review writes. Driven through the REAL exported helpers, the REAL example rulesets and the
 * localization file the editor reads, so nothing here can agree with a mistake the editor makes.
 *
 * What is pinned:
 *   - For a column the row HAS, only text-like ones are compared. A number or a switch is where the
 *     player's own state lives, so a difference there is never offered, and neither is a column the
 *     ruleset keeps up to date itself.
 *   - A column the row does not carry AT ALL is offered whatever its type, because a column the
 *     player has never seen is not their state. Tested on the key, so a 0, a false or an empty
 *     string the row already holds stays the player's.
 *   - A column the entry does not set is never touched, and neither is a value the column itself
 *     would refuse: a refresh must not write something the editor cannot then show.
 *   - A row is lined up with the entry row it came from by position when the counts agree, and
 *     otherwise only when the entry writes a single row for that list. A row whose entry is gone is
 *     skipped in silence.
 *   - Applying writes only the differing columns of the chosen rows: the `_catalog` mark, the
 *     player's own numbers and every other key of the row survive, and rows left unticked do not
 *     change at all.
 *   - Nothing is 5e-shaped: the same rules are proven on the authoring guide's 2d6 example and on
 *     the 5e example with a test catalog.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  RULESET_CATALOG_ROW_KEY,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import {
  applyCatalogRefresh,
  planCatalogRefresh,
  type CatalogRefreshRow,
} from "../../packages/client/src/lib/ruleset-catalog.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

const emberText = readSource("docs/examples/rulesets/ember-roads.json");
const fiveText = readSource("docs/development/ruleset-5e-2014.example.json");

/** A variant of one of the shipped example files: parse, edit, validate. */
function parsed(text: string, edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, `the example must stay usable: ${result.ok ? "" : result.issues.join("; ")}`);
  return result.definition;
}

type Lists = RulesetSheetBuild["lists"];
/** What the plan says, flattened to something an assertion can read at a glance. */
const summarize = (plans: ReturnType<typeof planCatalogRefresh>) =>
  plans.map((plan) => [
    plan.listId,
    plan.rows.map((row) => [row.index, row.name, row.columns.map((column) => column.columnId)]),
  ]);

// ── The 2d6 example: a knack whose text the author has rewritten ──

const ember = parsed(emberText);
const emberEntries = ember.catalogs![0]!.entries!;
const roadSense = emberEntries.find((entry) => entry.id === "road-sense")!;
const lastEmber = emberEntries.find((entry) => entry.id === "last-ember")!;
const emberRows = rowsFromCatalogEntry("knacks", lastEmber);
const plan = (entries: readonly RulesetCatalogEntry[], lists: Lists) =>
  planCatalogRefresh(ember, "knacks", entries, lists);

{
  // A row picked before the author rewrote what the knack does.
  const stale: Lists = {
    knacks: [{ name: "Road Sense", notes: "Older wording.", [RULESET_CATALOG_ROW_KEY]: "knacks/road-sense" }],
  };
  const plans = plan(emberEntries, stale);
  assert.equal(plans.length, 1);
  assert.equal(plans[0]!.listId, "knacks");
  assert.equal(plans[0]!.label, "Knacks");
  assert.deepEqual(plans[0]!.rows[0]!.columns, [
    {
      columnId: "notes",
      label: "What it does",
      current: "Older wording.",
      next: roadSense.rows![0]!.values.notes,
      // What applying writes. The same text, carried beside the display copy so a column the row is
      // GAINING can write a number or a switch without the applier stringifying it.
      value: roadSense.rows![0]!.values.notes,
    },
  ]);
  assert.equal(plans[0]!.rows[0]!.columns[0]!.added, undefined, "a column the row already has is not new to it");
  // The row is named by what the SHEET shows it as, so it can be found in the editor.
  assert.equal(plans[0]!.rows[0]!.name, "Road Sense");
  assert.equal(plans[0]!.rows[0]!.index, 0);

  // A row already holding the ruleset's text offers nothing at all: the editor draws no notice.
  const current: Lists = { knacks: [rowsFromCatalogEntry("knacks", roadSense)[0]!.row] };
  assert.deepEqual(plan(emberEntries, current), []);

  // A hand-typed row that happens to share the name is not the catalog's row.
  assert.deepEqual(plan(emberEntries, { knacks: [{ name: "Road Sense", notes: "Mine." }] }), []);

  // A mark naming an entry the catalog no longer has is skipped, silently.
  assert.deepEqual(plan(emberEntries, { knacks: [{ name: "Ghost", [RULESET_CATALOG_ROW_KEY]: "knacks/gone" }] }), []);

  // A catalog that could not be fetched is nothing to compare against.
  assert.deepEqual(plan([], stale), []);

  // A row renamed by the player still refreshes, and is named by the name the player gave it.
  const renamed: Lists = {
    knacks: [{ name: "My own name", notes: "Older wording.", [RULESET_CATALOG_ROW_KEY]: "knacks/road-sense" }],
  };
  assert.deepEqual(summarize(plan(emberEntries, renamed)), [["knacks", [[0, "My own name", ["name", "notes"]]]]]);
}

// ── The same mark twice, and the columns that are never compared ──

{
  // The entry writes ONE row for this list, so every copy of it on the sheet matches that one spec.
  const twice: Lists = {
    knacks: [
      { name: "Road Sense", notes: "Older wording.", [RULESET_CATALOG_ROW_KEY]: "knacks/road-sense" },
      { name: "Iron Stomach", [RULESET_CATALOG_ROW_KEY]: "knacks/iron-stomach" },
      { name: "Road Sense", notes: "Another older wording.", [RULESET_CATALOG_ROW_KEY]: "knacks/road-sense" },
    ],
  };
  // Rows come back in the sheet's own order, whichever entry they came from.
  assert.deepEqual(summarize(plan(emberEntries, twice)), [
    [
      "knacks",
      [
        [0, "Road Sense", ["notes"]],
        [1, "Iron Stomach", ["notes"]],
        [2, "Road Sense", ["notes"]],
      ],
    ],
  ]);

  // The trick row of the two-row entry: its uses are a number the ruleset keeps and the player has
  // spent a level-up on, and its recharge is an enum the author has changed. Only the enum shows.
  const trick = emberRows.find((row) => row.list === "tricks")!.row;
  const spent: Lists = { tricks: [{ ...trick, uses: 5, recharge: "scene" }] };
  assert.deepEqual(summarize(plan(emberEntries, spent)), [["tricks", [[0, "Last Ember", ["recharge"]]]]]);
  assert.equal(plan(emberEntries, spent)[0]!.rows[0]!.columns[0]!.next, "camp");

  // A scaled column is never part of a refresh, even were a file to name a text column: the schema
  // refuses that shape, and this is the second lock on it.
  const scaledText = [
    {
      id: "road-sense",
      label: "Road Sense",
      rows: [{ list: "knacks", values: { name: "Renamed", notes: "New." }, scaled: { name: { from: { const: 1 } } } }],
    },
  ] as unknown as RulesetCatalogEntry[];
  assert.deepEqual(
    summarize(plan(scaledText, { knacks: [{ name: "Road Sense", [RULESET_CATALOG_ROW_KEY]: "knacks/road-sense" }] })),
    [["knacks", [[0, "Road Sense", ["notes"]]]]],
  );
}

// ── The 5e example, with a test catalog: every column type, side by side ──

const fiveE = parsed(fiveText, (doc) => {
  doc.catalogs = [
    {
      id: "gear",
      label: "Weapons",
      feeds: ["attacks", "features"],
      entries: [
        {
          id: "longsword",
          label: "Longsword",
          rows: [
            {
              list: "attacks",
              values: {
                name: "Longsword",
                ability: "str",
                proficient: true,
                bonus: 0,
                damage: "1d8",
                damage_type: "slashing",
              },
            },
          ],
        },
        {
          id: "second-wind",
          label: "Second Wind",
          rows: [
            { list: "features", values: { name: "Second Wind", text: "Regain hit points once per short rest." } },
            { list: "features", values: { name: "Second Wind (note)", text: "It comes back on a short rest." } },
          ],
        },
      ],
    },
  ];
});
const fiveEntries = fiveE.catalogs![0]!.entries!;
const fivePlan = (lists: Lists, entries: readonly RulesetCatalogEntry[] = fiveEntries) =>
  planCatalogRefresh(fiveE, "gear", entries, lists);

{
  // A magic longsword: the player's own switch and bonus differ from the catalog's, and so do the
  // dice and the damage type. Only the two text-like columns are offered.
  const magic: Lists = {
    attacks: [
      {
        name: "Longsword",
        ability: "str",
        proficient: false,
        bonus: 3,
        damage: "1d10",
        damage_type: "piercing",
        [RULESET_CATALOG_ROW_KEY]: "gear/longsword",
      },
    ],
  };
  assert.deepEqual(summarize(fivePlan(magic)), [["attacks", [[0, "Longsword", ["damage", "damage_type"]]]]]);

  // An enum the player changed is text-like, so it IS offered. This row also carries NONE of the
  // other columns, so it is offered those too, whatever their type: see the block below for why.
  const finesse: Lists = {
    attacks: [{ name: "Longsword", ability: "dex", [RULESET_CATALOG_ROW_KEY]: "gear/longsword" }],
  };
  assert.deepEqual(summarize(fivePlan(finesse)), [
    ["attacks", [[0, "Longsword", ["ability", "proficient", "bonus", "damage", "damage_type"]]]],
  ]);

  // A column the entry does not set is never touched, whatever the sheet holds in it. The 5e
  // example's attacks list has no such column, so the entry is trimmed instead.
  const trimmed = [
    { id: "longsword", label: "Longsword", rows: [{ list: "attacks", values: { name: "Longsword" } }] },
  ] as unknown as RulesetCatalogEntry[];
  assert.deepEqual(fivePlan(magic, trimmed), []);

  // ── A column the row does NOT carry at all (#6400) ──
  //
  // The rule above protects the player's own state. A column the row has never had is not the
  // player's state: they have never seen it. Without this a ruleset that ADDS a column could only
  // reach an existing row by having the player delete it and pick it again.
  {
    // A longsword picked before the list grew a `proficient` switch and a `bonus` number.
    const older: Lists = {
      attacks: [
        {
          name: "Longsword",
          ability: "str",
          damage: "1d8",
          damage_type: "slashing",
          [RULESET_CATALOG_ROW_KEY]: "gear/longsword",
        },
      ],
    };
    const plans = fivePlan(older);
    assert.deepEqual(summarize(plans), [["attacks", [[0, "Longsword", ["proficient", "bonus"]]]]]);
    const [switchColumn, numberColumn] = plans[0]!.rows[0]!.columns;
    // Each is offered as its own reviewable line, worded as something the row gained.
    assert.equal(switchColumn!.added, true);
    assert.equal(switchColumn!.value, true, "a switch is written as a switch, not as the string 'true'");
    assert.equal(switchColumn!.current, "", "the row held nothing there");
    assert.equal(numberColumn!.added, true);
    assert.equal(numberColumn!.value, 0, "and a number as a number");

    // Accepting writes ONLY those columns. Everything else the row holds survives, the mark
    // included, and the values land with their own types rather than stringified.
    const applied = applyCatalogRefresh(older, plans[0]!.rows);
    assert.deepEqual(applied.attacks![0], {
      name: "Longsword",
      ability: "str",
      damage: "1d8",
      damage_type: "slashing",
      proficient: true,
      bonus: 0,
      [RULESET_CATALOG_ROW_KEY]: "gear/longsword",
    });

    // Declining leaves the row exactly as it was: a new column is as declinable as any other line.
    assert.deepEqual(applyCatalogRefresh(older, []), {});

    // A column whose value the row holds as 0, false or an empty string is a column the row HAS,
    // so it stays the player's. Tested on the KEY, never on the value.
    const held = [
      {
        id: "longsword",
        label: "Longsword",
        rows: [
          {
            list: "attacks",
            values: { name: "Longsword", ability: "str", proficient: true, bonus: 3, damage: "1d8" },
          },
        ],
      },
    ] as unknown as RulesetCatalogEntry[];
    const zeroed: Lists = {
      attacks: [
        {
          name: "Longsword",
          ability: "str",
          proficient: false,
          bonus: 0,
          damage: "1d8",
          [RULESET_CATALOG_ROW_KEY]: "gear/longsword",
        },
      ],
    };
    assert.deepEqual(fivePlan(zeroed, held), [], "a 0 and a false the row already holds are the player's");

    // A column the ruleset keeps up to date is recomputed by its own path, so it is not offered
    // twice, and that holds for a column the row does not carry either.
    const scaledNew = [
      {
        id: "longsword",
        label: "Longsword",
        rows: [
          {
            list: "attacks",
            values: { name: "Longsword", ability: "str", damage: "1d8", bonus: 4 },
            scaled: { bonus: { from: { const: 4 } } },
          },
        ],
      },
    ] as unknown as RulesetCatalogEntry[];
    const withoutBonus: Lists = {
      attacks: [{ name: "Longsword", ability: "str", damage: "1d8", [RULESET_CATALOG_ROW_KEY]: "gear/longsword" }],
    };
    assert.deepEqual(fivePlan(withoutBonus, scaledNew), [], "a scaled column is never offered, new or not");
  }

  // A value the column itself would refuse is left out: an enum value that is not offered, dice
  // text past its limit, and text past the column's own maxLength.
  const refused = [
    {
      id: "longsword",
      label: "Longsword",
      rows: [
        {
          list: "attacks",
          values: { ability: "luck", damage: "d".repeat(41), damage_type: "x".repeat(400), name: "Longsword" },
        },
      ],
    },
  ] as unknown as RulesetCatalogEntry[];
  assert.deepEqual(fivePlan(magic, refused), []);
}

{
  // Two rows for one list. The counts agree, so they are paired by position.
  const secondWind = rowsFromCatalogEntry("gear", fiveEntries.find((entry) => entry.id === "second-wind")!);
  const both: Lists = {
    features: [
      { ...secondWind[0]!.row, text: "Older first." },
      { ...secondWind[1]!.row, text: "Older second." },
    ],
  };
  const plans = fivePlan(both);
  assert.deepEqual(summarize(plans), [
    [
      "features",
      [
        [0, "Second Wind", ["text"]],
        [1, "Second Wind (note)", ["text"]],
      ],
    ],
  ]);
  assert.equal(plans[0]!.rows[0]!.columns[0]!.next, "Regain hit points once per short rest.");
  assert.equal(plans[0]!.rows[1]!.columns[0]!.next, "It comes back on a short rest.");

  // Counts that do not agree: the player deleted one of the two rows, so which spec the survivor
  // belongs to is a guess. Nothing is offered rather than rewriting the wrong row.
  assert.deepEqual(fivePlan({ features: [{ ...secondWind[0]!.row, text: "Older first." }] }), []);
  assert.deepEqual(
    fivePlan({
      features: [
        { ...secondWind[0]!.row, text: "Older." },
        { ...secondWind[1]!.row, text: "Older." },
        { ...secondWind[0]!.row, text: "Older." },
      ],
    }),
    [],
  );

  // A row the sheet never had a column for reads as empty rather than as missing.
  const blank: Lists = { features: [secondWind[0]!.row, { ...secondWind[1]!.row, text: undefined as never }] };
  const filling = fivePlan(blank);
  assert.equal(filling[0]!.rows.length, 1);
  assert.equal(filling[0]!.rows[0]!.columns[0]!.current, "");
}

// ── Applying the review ──

{
  const lists: Lists = {
    knacks: [
      { name: "Road Sense", notes: "Older wording.", extra: 7, [RULESET_CATALOG_ROW_KEY]: "knacks/road-sense" },
      { name: "Iron Stomach", notes: "Older too.", [RULESET_CATALOG_ROW_KEY]: "knacks/iron-stomach" },
    ],
    gear: [{ name: "Rope" }],
  };
  const plans = plan(emberEntries, lists);
  const rows = plans[0]!.rows;
  assert.equal(rows.length, 2);

  // Only the chosen row changes, and only in the column that differed: the mark, the player's own
  // key and every other column survive.
  const first = applyCatalogRefresh(lists, [rows[0]!]);
  assert.deepEqual(Object.keys(first), ["knacks"], "only the lists a refresh touches come back");
  assert.deepEqual(first.knacks![0], {
    name: "Road Sense",
    notes: roadSense.rows![0]!.values.notes,
    extra: 7,
    [RULESET_CATALOG_ROW_KEY]: "knacks/road-sense",
  });
  assert.equal(first.knacks![1], lists.knacks![1], "an unticked row is not even copied");
  assert.equal(lists.knacks![0]!.notes, "Older wording.", "the stored sheet itself is never mutated");

  // Both rows, in one change.
  const all = applyCatalogRefresh(lists, rows);
  assert.equal(all.knacks![0]!.notes, roadSense.rows![0]!.values.notes);
  assert.equal(
    all.knacks![1]!.notes,
    emberEntries.find((entry) => entry.id === "iron-stomach")!.rows![0]!.values.notes,
  );

  // Nothing chosen changes nothing.
  assert.deepEqual(applyCatalogRefresh(lists, []), {});

  // A row that is no longer where the plan said it was is left alone rather than written blind.
  const moved: CatalogRefreshRow = { ...rows[0]!, index: 9 };
  assert.deepEqual(applyCatalogRefresh(lists, [moved]), {});

  // A list stored as something other than rows reads as empty instead of throwing.
  const malformed = { knacks: "not rows" } as unknown as Lists;
  assert.deepEqual(plan(emberEntries, malformed), []);
  assert.deepEqual(applyCatalogRefresh(malformed, [rows[0]!]), {});
}

// ── Every key the editor and the review ask for exists ──

{
  const messages = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;
  const sources = [
    readSource("packages/client/src/components/rulesets/RulesetSheetEditor.tsx"),
    readSource("packages/client/src/components/rulesets/RulesetCatalogRefreshModal.tsx"),
  ];
  const referenced = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(/"(ui\.rulesets\.[a-zA-Z0-9_.]+)"/gu)) referenced.add(match[1]!);
  }
  assert.ok(referenced.size >= 15, "the sheet editor's localization keys were not found in the source");
  for (const key of referenced) {
    // A key used with a count resolves to its plural forms, and both have to exist.
    const present = key in messages || (`${key}_one` in messages && `${key}_other` in messages);
    assert.ok(present, `en.json is missing ${key}`);
  }
}

// ── The lane stays hooked up ──

assert.match(
  readSource("scripts/regressions/tsconfig.client-lanes.json"),
  /ruleset-catalog-refresh\.regression\.ts/u,
  "this lane needs DOM-free client types, so the client lint's lane tsconfig must include it",
);

console.log("Ruleset catalog refresh regressions passed.");
