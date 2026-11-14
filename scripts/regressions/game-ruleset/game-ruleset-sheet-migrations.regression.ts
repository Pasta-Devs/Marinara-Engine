/**
 * Ruleset sheet migrations (C6e-0, Capability API 1.77): how a sheet stored on an older layout reads
 * on the current one.
 *
 *   - Builds are migrated on READ, gated by the stored `v`, and every step copies: what it read from
 *     stays, so an older version of the ruleset still reads the sheet as it did. A sheet a newer
 *     version wrote is read as it stands, and never labelled older than it was.
 *   - `route` sends one value to the field another's text names: exactly one case named, that one;
 *     none or several ("Fighter 3 / Wizard 2"), the fallback. `default` stands in for a missing value.
 *   - Live state has no version, so `routeLive` runs on every read, readers and writers alike: the
 *     old key always goes, and the value moves only while the new key is absent, to the one pool the
 *     migrated sheet shows. A spent die stays spent, and a rest that refills it does not bring the old
 *     value back.
 *   - Import checks: hops below the version and once each, targets on the sheet, sources gone from it,
 *     rename chains followed to where they end. The install gate is 1.77 (combat-cover pins the others).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  applyRulesetSheetOp,
  copyRulesetSheetForGame,
  migrateRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetLive,
  readRulesetSheetEnvelope,
  rulesetSheetBuildsByName,
  rulesetSheetStamp,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const fiveEText = read("../../../docs/development/ruleset-5e-2014.example.json");
const parsedOrThrow = (document: unknown): RulesetDefinition => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  return parsed.definition;
};
const refusal = (document: unknown): string => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(!parsed.ok, "this document was supposed to be refused");
  return parsed.issues.join("; ");
};

const CLASS_CASES = [
  { words: ["fighter"], to: "level_fighter" },
  { words: ["wizard"], to: "level_wizard" },
];
const DICE = [
  ["hit_dice_d10", "level_fighter"],
  ["hit_dice_d6", "level_wizard"],
  ["hit_dice_d8", "level_other"],
] as const;

/** The 5e example moved on one layout: a level for each class beside the old total, and a pool of
 *  hit dice for each die in place of the one pool. */
const layoutTwo = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(fiveEText) as Record<string, any>;
  doc.sheet.version = 2;
  for (const id of ["level_fighter", "level_wizard", "level_other"]) {
    doc.sheet.fields.push({ id, label: id, type: "number", min: 0, max: 20, default: 0 });
  }
  doc.sheet.live.pools = doc.sheet.live.pools.filter((pool: { id: string }) => pool.id !== "hit_dice");
  for (const [id, field] of DICE) doc.sheet.live.pools.push({ id, label: id, max: { field } });
  for (const rest of doc.rests) {
    rest.restore = (rest.restore ?? []).flatMap((entry: { pool?: string }) =>
      entry.pool === "hit_dice" ? DICE.map(([id]) => ({ pool: id, to: "max" })) : [entry],
    );
  }
  doc.sheet.migrations = [
    {
      from: 1,
      steps: [
        { route: "level", by: "class", cases: structuredClone(CLASS_CASES), else: "level_other", default: 1 },
        { routeLive: "pool", from: "hit_dice", cases: DICE.map(([id]) => id), else: "hit_dice_d8" },
      ],
    },
  ];
  edit(doc);
  return doc;
};
const two = parsedOrThrow(layoutTwo());
const stored = (fields: Record<string, unknown>, v = 1) => ({ v, build: { fields } });

// ── Builds: routed by the class text, copied, gated by `v` ──
{
  const fighter = readRulesetSheetEnvelope(two, stored({ level: 5, class: "Fighter (Champion)" }))!;
  assert.equal(fighter.v, 2);
  assert.equal(fighter.build.fields.level_fighter, 5);
  assert.equal(fighter.build.fields.level, 5, "copied, so an older version still reads its level");
  assert.equal(fighter.build.fields.level_wizard, undefined);
  // Whole words, ignoring case; several named, or none, is the fallback.
  assert.equal(readRulesetSheetEnvelope(two, stored({ level: 4, class: "WIZARD" }))!.build.fields.level_wizard, 4);
  const both = readRulesetSheetEnvelope(two, stored({ level: 5, class: "Fighter 3 / Wizard 2" }))!;
  assert.deepEqual([both.build.fields.level_other, both.build.fields.level_fighter], [5, undefined]);
  assert.equal(readRulesetSheetEnvelope(two, stored({ level: 3, class: "Firefighter" }))!.build.fields.level_other, 3);
  // Only letters join a word: a level written straight after the class still names it.
  assert.equal(readRulesetSheetEnvelope(two, stored({ level: 3, class: "Fighter3" }))!.build.fields.level_fighter, 3);
  // A sheet that never stored a level takes the step's default, not nothing.
  assert.equal(readRulesetSheetEnvelope(two, stored({ class: "Fighter" }))!.build.fields.level_fighter, 1);
  // A target already there is never overwritten.
  const kept = readRulesetSheetEnvelope(two, stored({ level: 9, class: "Fighter", level_fighter: 2 }))!;
  assert.equal(kept.build.fields.level_fighter, 2);
  // Already on this layout, or written by a newer one: read as it stands.
  const current = readRulesetSheetEnvelope(two, stored({ level: 9, class: "Fighter" }, 2))!;
  assert.equal(current.build.fields.level_fighter, undefined);
  const newer = readRulesetSheetEnvelope(two, stored({ level: 9 }, 7))!;
  assert.equal(newer.v, 7);
  // Nothing to take: the very build it was given.
  const plain = { abilities: {}, skills: {}, saves: {}, bonuses: {}, fields: { level: 2 }, lists: {} };
  assert.equal(migrateRulesetSheetBuild(two, plain, 2), plain);
  // A game's copy is migrated, and keeps a newer number.
  assert.equal(copyRulesetSheetForGame(two, stored({ level: 6, class: "Fighter" })).build.fields.level_fighter, 6);
  assert.equal(copyRulesetSheetForGame(two, stored({ level: 6 }, 9)).v, 9);
  assert.equal(rulesetSheetStamp(two, { v: 1 }), 2);
  assert.equal(rulesetSheetStamp(two, { v: 5 }), 5);
  // And every party card a fight reads.
  const builds = rulesetSheetBuildsByName(two, [
    { name: "Brenna", rulesetSheet: stored({ level: 7, class: "fighter" }) },
  ]);
  assert.equal(builds.get("brenna")?.fields.level_fighter, 7);
}

// ── Renames, across two hops ──
{
  const three = parsedOrThrow(
    layoutTwo((doc) => {
      doc.sheet.version = 3;
      const field = doc.sheet.fields.find((entry: { id: string }) => entry.id === "xp");
      field.id = "experience";
      const history = doc.sheet.skills.find((entry: { id: string }) => entry.id === "history");
      history.id = "lore";
      // xp became exp in layout 2 and experience in layout 3: the chain is followed to where it ends.
      doc.sheet.migrations[0].steps.push({ rename: "field", from: "xp", to: "exp" });
      doc.sheet.migrations.push({
        from: 2,
        steps: [
          { rename: "field", from: "exp", to: "experience" },
          { rename: "skill", from: "history", to: "lore" },
        ],
      });
    }),
  );
  const moved = readRulesetSheetEnvelope(three, {
    v: 1,
    build: { fields: { xp: 300 }, skills: { history: "proficient" }, bonuses: { history: 2 } },
  })!;
  assert.equal(moved.build.fields.experience, 300);
  assert.deepEqual([moved.build.skills.lore, moved.build.bonuses.lore], ["proficient", 2]);
  // A rename never overwrites a value the new id already holds.
  const already = readRulesetSheetEnvelope(three, { v: 1, build: { fields: { xp: 300, experience: 12 } } })!;
  assert.equal(already.build.fields.experience, 12);
  // Stored on layout 2, only the second hop runs.
  const second = readRulesetSheetEnvelope(three, { v: 2, build: { fields: { exp: 40, xp: 9 } } })!;
  assert.equal(second.build.fields.experience, 40);
}

// ── Live state: routed on every read, by readers and writers alike ──
{
  const build = readRulesetSheetEnvelope(two, stored({ level: 5, class: "Fighter" }))!.build;
  const dice = (live: unknown) =>
    Object.fromEntries(
      readRulesetLive(two, build, live)
        .pools.filter((pool) => pool.key.startsWith("hit_dice"))
        .map((pool) => [pool.key, `${pool.value}/${pool.max}`]),
    );
  const old = { pools: { hit_dice: { value: 1 } } };
  assert.deepEqual(dice(old), { hit_dice_d10: "1/5" }, "the old pool's value, on the die the sheet shows");
  // A writer sees the same: spending one leaves none, and the old key is gone from what it stores.
  const spent = applyRulesetSheetOp(two, build, old, { op: "spend", pool: "hit_dice_d10", amount: 1 });
  assert.ok(spent.ok);
  assert.deepEqual(spent.live.pools, { hit_dice_d10: { value: 0 } });
  assert.deepEqual(dice(spent.live), { hit_dice_d10: "0/5" });
  // A rest refills it to its default, which stores nothing; the old value never comes back.
  const rested = applyRulesetSheetOp(two, build, spent.live, { op: "rest", rest: "long" });
  assert.ok(rested.ok);
  assert.deepEqual(dice(rested.live), { hit_dice_d10: "5/5" });
  // Changing the class text later moves nothing: the old key went with the first write, so the
  // wizard's own die starts full and the spent d10 stays where it was stored.
  const wizard = readRulesetSheetEnvelope(two, stored({ level: 5, class: "Wizard" }))!.build;
  const asWizard = Object.fromEntries(
    readRulesetLive(two, wizard, spent.live)
      .pools.filter((pool) => pool.key.startsWith("hit_dice"))
      .map((pool) => [pool.key, pool.value]),
  );
  assert.deepEqual(asWizard, { hit_dice_d6: 5 });
  // Before any write, a value already on the new key wins, and the old one is dropped all the same.
  assert.deepEqual(dice({ pools: { hit_dice: { value: 1 }, hit_dice_d10: { value: 3 } } }), { hit_dice_d10: "3/5" });
  // A sheet that shows two dice (or none) sends the value to `else`, as what it stores says.
  const multi = { ...build, fields: { ...build.fields, level_wizard: 2 } };
  const split = applyRulesetSheetOp(two, multi, old, { op: "spend", pool: "hit_dice_d6", amount: 1 });
  assert.ok(split.ok);
  assert.deepEqual(split.live.pools, { hit_dice_d8: { value: 1 }, hit_dice_d6: { value: 1 } });
}

// ── A wound track's marks travel with it ──
{
  const harm = {
    id: "harm",
    label: "Harm",
    min: 0,
    max: 4,
    levels: [
      { label: "Scuffed", penalty: 0 },
      { label: "Winded", penalty: -1 },
      { label: "Bleeding", penalty: -3 },
      { label: "Down", penalty: -99 },
    ],
    kinds: [
      { id: "knock", label: "Knock", severity: 0 },
      { id: "tear", label: "Tear", severity: 1 },
    ],
  };
  const wounded = parsedOrThrow(
    layoutTwo((doc) => {
      doc.sheet.live.tracks.push(harm);
      doc.sheet.migrations[0].steps.push({ routeLive: "track", from: "wounds", cases: ["harm"], else: "harm" });
    }),
  );
  const build = readRulesetSheetEnvelope(wounded, stored({ level: 5, class: "Fighter" }))!.build;
  const old = { wounds: { wounds: { marks: ["tear", "knock"] } } };
  const read = readRulesetLive(wounded, build, old).tracks.find((track) => track.id === "harm")!;
  assert.deepEqual(read.wound?.marks, ["tear", "knock"]);
  const written = applyRulesetSheetOp(wounded, build, old, { op: "spend", pool: "hp", amount: 1 });
  assert.ok(written.ok);
  assert.deepEqual(written.live.wounds, { harm: { marks: ["tear", "knock"] } });
  // A plain number under the old id has nowhere to go on a wound track, and is dropped.
  const plain = applyRulesetSheetOp(wounded, build, { tracks: { wounds: 2 } }, { op: "spend", pool: "hp", amount: 1 });
  assert.ok(plain.ok);
  assert.equal(plain.live.tracks?.wounds, undefined);
  // The tracks a value goes to are of one shape.
  assert.match(
    refusal(
      layoutTwo((doc) => {
        doc.sheet.live.tracks.push(harm);
        doc.sheet.migrations[0].steps.push({
          routeLive: "track",
          from: "wounds",
          cases: ["harm"],
          else: "exhaustion",
        });
      }),
    ),
    /all wound tracks or all plain tracks/,
  );
}

// ── Chains through routes: a field renamed and then routed on, a target a later hop renames ──
{
  const chained = parsedOrThrow(
    layoutTwo((doc) => {
      doc.sheet.version = 3;
      const fighter = doc.sheet.fields.find((field: { id: string }) => field.id === "level_fighter");
      fighter.id = "fighter_level";
      doc.sheet.live.pools.find((pool: { id: string }) => pool.id === "hit_dice_d10").max = { field: "fighter_level" };
      // Layout 1 called the total "lvl", which layout 2 renames to "total" (no longer a field of the
      // sheet) and routes on; layout 3 renames the fighter's field.
      doc.sheet.migrations[0].steps.unshift({ rename: "field", from: "lvl", to: "total" });
      doc.sheet.migrations[0].steps[1].route = "total";
      doc.sheet.migrations.push({ from: 2, steps: [{ rename: "field", from: "level_fighter", to: "fighter_level" }] });
    }),
  );
  const moved = readRulesetSheetEnvelope(chained, stored({ lvl: 4, class: "Fighter" }))!;
  assert.equal(moved.build.fields.fighter_level, 4);
}

// ── A rest that shares a pool group's fraction (5e's half your total hit dice, one pool per die) ──
{
  const shared = parsedOrThrow(
    layoutTwo((doc) => {
      for (const pool of doc.sheet.live.pools) if (pool.id.startsWith("hit_dice_")) pool.group = "hit_dice";
      const long = doc.rests.find((rest: { id: string }) => rest.id === "long");
      long.restore = [
        ...long.restore.filter((entry: { pool?: string }) => !entry.pool?.startsWith("hit_dice_")),
        { poolGroup: "hit_dice", by: { fractionOfMax: 0.5, round: "down", min: 1 }, shared: true },
      ];
    }),
  );
  const restOf = (fields: Record<string, number>, spent: Record<string, number>) => {
    const build = readRulesetSheetEnvelope(shared, stored({ ...fields, class: "" }, 2))!.build;
    const pools = Object.fromEntries(Object.entries(spent).map(([id, value]) => [id, { value }]));
    const rested = applyRulesetSheetOp(shared, build, { pools }, { op: "rest", rest: "long" });
    assert.ok(rested.ok);
    return Object.fromEntries(
      readRulesetLive(shared, build, rested.live)
        .pools.filter((pool) => pool.key.startsWith("hit_dice_"))
        .map((pool) => [pool.key, pool.value]),
    );
  };
  // Fighter 3 / Wizard 3, every die spent: half of six is three, the d10s first (the order listed).
  assert.deepEqual(restOf({ level_fighter: 3, level_wizard: 3 }, { hit_dice_d10: 0, hit_dice_d6: 0 }), {
    hit_dice_d10: 3,
    hit_dice_d6: 0,
  });
  // Fighter 1 / Wizard 1: half of two is one, not one each.
  assert.deepEqual(restOf({ level_fighter: 1, level_wizard: 1 }, { hit_dice_d10: 0, hit_dice_d6: 0 }), {
    hit_dice_d10: 1,
    hit_dice_d6: 0,
  });
  // What is not missing takes none of the share: it passes on to the next pool.
  assert.deepEqual(restOf({ level_fighter: 4, level_wizard: 4 }, { hit_dice_d10: 3, hit_dice_d6: 0 }), {
    hit_dice_d10: 4,
    hit_dice_d6: 3,
  });
  assert.match(
    refusal(
      layoutTwo((doc) => {
        doc.rests[0].restore.push({ pool: "hp", by: { fractionOfMax: 0.5 }, shared: true });
      }),
    ),
    /"shared" shares a fraction of a pool group's maximum/,
  );
}

// ── Import checks ──
{
  const hop = (doc: Record<string, any>) => doc.sheet.migrations[0];
  for (const [edit, message] of [
    [(doc: Record<string, any>) => (hop(doc).from = 2), /A migration moves on from a version below 2/],
    [
      (doc: Record<string, any>) =>
        doc.sheet.migrations.push({ from: 1, steps: [{ rename: "field", from: "x", to: "xp" }] }),
      /Duplicate migration from version 1/,
    ],
    [
      (doc: Record<string, any>) => hop(doc).steps.push({ rename: "field", from: "xp", to: "level" }),
      /"xp" is still a field/,
    ],
    [
      (doc: Record<string, any>) => hop(doc).steps.push({ rename: "field", from: "old", to: "nowhere" }),
      /"nowhere" is not a field/,
    ],
    [(doc: Record<string, any>) => (hop(doc).steps[0].cases[0].to = "level_bard"), /Unknown field "level_bard"/],
    [(doc: Record<string, any>) => (hop(doc).steps[0].else = "nobody"), /Unknown field "nobody"/],
    [(doc: Record<string, any>) => (hop(doc).steps[1].from = "hp"), /"hp" is still a pool/],
    [(doc: Record<string, any>) => (hop(doc).steps[1].cases[0] = "hit_dice_d20"), /Unknown pool "hit_dice_d20"/],
    [(doc: Record<string, any>) => hop(doc).steps[1].cases.push("hit_dice_d10"), /Duplicate case "hit_dice_d10"/],
    [(doc: Record<string, any>) => (hop(doc).steps[0].by = "clas"), /Unknown field "clas"/],
    [
      (doc: Record<string, any>) => (hop(doc).steps[0].cases[0].to = "hit_die"),
      /"hit_die" is a number or text field with no default, or a default of 0 or empty/,
    ],
    [
      (doc: Record<string, any>) => {
        doc.sheet.fields.find((field: { id: string }) => field.id === "level_wizard").default = 1;
      },
      /"level_wizard" is a number or text field with no default/,
    ],
  ] as const) {
    assert.match(refusal(layoutTwo(edit)), message);
  }
}

console.log(
  "Ruleset sheet migrations: builds routed and renamed on read, live state routed for readers and writers, import checks.",
);
