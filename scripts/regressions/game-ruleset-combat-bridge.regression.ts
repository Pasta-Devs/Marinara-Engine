/**
 * The ruleset combat bridge: the optional `battle` block, and the three pure helpers that lend a
 * battle the sheet's numbers and write the fight's outcome back.
 *
 * What is pinned here:
 *   - Nothing is 5e-shaped. Every pool, list, column and word comes from the ruleset that declares
 *     it, and the ruleset used for the skills half rolls 2d6 and has no slots at all.
 *   - A ruleset with no `battle` block gets nothing: no seed, no skills, no operations.
 *   - Health crosses as a SHARE of the maximum, both ways, on the Engine's own scale: a fight that
 *     did not move the combatant writes nothing, nobody above zero is rounded out of a fight or off
 *     a sheet, and zero stays zero. Energy and slots stay absolute counts.
 *   - Every name inside `battle` points at something that exists, and a pool cannot be two things.
 *   - Only a row a catalog wrote, whose entry carries `mechanics`, becomes a combat skill, and a
 *     cost the Engine cannot spend takes the skill away rather than making it free.
 *   - `power` never falls as the dice grow, and never leaves the range a generated skill lives in.
 *   - The operations are the deltas, they go through the same `applyRulesetSheetOp` a player's own
 *     buttons go through, and a refused one changes nothing and is reported.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  applyCombatResultToLive,
  buildTacticalSummary,
  carryHealthShare,
  combatSkillsFromSheet,
  createTacticalCombat,
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetSheetBuildSchema,
  seedCombatantFromSheet,
  sheetOpsFromCombatResult,
  type Combatant,
  type RulesetCatalogEntry,
  type RulesetCatalogMechanics,
  type RulesetCombatSeed,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const emberText = read("../../docs/examples/rulesets/ember-roads.json");
const fiveText = read("../../docs/development/ruleset-5e-2014.example.json");

/** A variant of one of the shipped example files: parse, edit, validate. */
function parsed(text: string, edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, `the example must stay usable: ${result.ok ? "" : result.issues.join("; ")}`);
  return result.definition;
}
const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);

const ember = parsed(emberText);
const fiveE = parsed(fiveText);

/** What the Engine itself builds a low-level combatant with, measured in a real battle: around 60
 *  hit points against 11 to 15 damage a hit. Every sheet in this file is an order of magnitude
 *  smaller, which is the whole reason health crosses as a share. */
const ENGINE_MAX_HP = 60;

// ── Both shipped examples opt in, and neither block is shaped like the other ──
{
  assert.deepEqual(ember.battle, {
    health: { pool: "grit" },
    energy: { pool: "luck" },
    skills: [{ list: "knacks" }],
  });
  assert.equal(fiveE.battle!.health.pool, "hp");
  assert.equal(fiveE.battle!.energy, undefined, "a system with slots and no energy pool is expressible");
  assert.equal(fiveE.battle!.slots!.length, 9);
  assert.deepEqual(fiveE.battle!.skills, [
    { list: "spells", onlyWhen: "prepared", alwaysWhen: { column: "level", equals: 0 } },
    { list: "attacks" },
  ]);
  // Both examples now resolve their own fights, so their coverage says so. The bridge is still
  // not what does it: it never reads the flag, and it stands aside for a `combat` block instead.
  assert.equal(ember.coverage.combat, true);
  assert.equal(fiveE.coverage.combat, true);
}

// ── Cross-reference refusals ──
{
  const refuses = (text: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) => {
    const doc = JSON.parse(text) as Record<string, any>;
    edit(doc);
    const result = parseRulesetDefinition(doc);
    assert.ok(!result.ok, `expected a refusal: ${why}`);
    assert.ok(
      result.issues.some((issue) => pattern.test(issue)),
      `${why}: ${result.issues.join("; ")}`,
    );
  };

  refuses(
    emberText,
    (doc) => (doc.battle.health.pool = "vigour"),
    /battle\.health\.pool: Unknown live pool "vigour"/,
    "hit points must be a pool the sheet declares",
  );
  refuses(
    emberText,
    (doc) => (doc.battle.health.pool = "tricks"),
    /battle\.health\.pool: "tricks" is a list whose rows are pools, not a live pool/,
    "a list row's pool comes and goes as the sheet is edited, so it cannot be hit points",
  );
  refuses(
    emberText,
    (doc) => (doc.battle.energy.pool = "grit"),
    /battle\.energy\.pool: The energy pool cannot also be the health pool/,
    "one pool cannot be both damaged and spent",
  );
  refuses(
    emberText,
    (doc) => (doc.battle.slots = [{ pool: "grit", level: 1 }]),
    /battle\.slots\.0\.pool: "grit" is already the health or energy pool/,
    "a slot pool is its own resource",
  );
  refuses(
    emberText,
    (doc) => (doc.battle.slots = [{ pool: "luck", level: 1 }]),
    /battle\.slots\.0\.pool: "luck" is already the health or energy pool/,
    "and it is not the energy pool either",
  );
  refuses(
    fiveText,
    (doc) => (doc.battle.slots[1].pool = "slots_1"),
    /battle\.slots\.1\.pool: Duplicate slot pool "slots_1"/,
    "two levels cannot spend the same pool",
  );
  refuses(
    fiveText,
    (doc) => (doc.battle.slots[1].level = 1),
    /battle\.slots\.1\.level: Duplicate slot level 1/,
    "two pools cannot be the same level",
  );
  refuses(
    fiveText,
    (doc) => (doc.battle.slots[0].pool = "cantrips"),
    /battle\.slots\.0\.pool: Unknown live pool "cantrips"/,
    "a slot pool must exist too",
  );
  refuses(fiveText, (doc) => (doc.battle.slots[0].level = 10), /battle\.slots\.0\.level/, "levels stop at nine");
  refuses(fiveText, (doc) => (doc.battle.slots[0].level = 1.5), /battle\.slots\.0\.level/, "a level is a whole number");
  refuses(
    emberText,
    (doc) => (doc.battle.skills = [{ list: "spells" }]),
    /battle\.skills\.0\.list: Unknown list "spells"/,
    "skills come from a list the sheet has",
  );
  refuses(
    emberText,
    (doc) => (doc.battle.skills = [{ list: "knacks", onlyWhen: "notes" }]),
    /battle\.skills\.0\.onlyWhen: Must name a boolean column/,
    "a gate is a yes or no on the row",
  );
  refuses(
    emberText,
    (doc) => (doc.battle.skills = [{ list: "knacks", alwaysWhen: { column: "tier", equals: 0 } }]),
    /battle\.skills\.0\.alwaysWhen\.column: Unknown column "tier"/,
    "the exception names a column of the same list",
  );
  refuses(
    emberText,
    (doc) => {
      doc.sheet.live.pools.find((pool: { id: string }) => pool.id === "grit").start = "empty";
    },
    /battle\.health\.pool: "grit" starts empty, so it cannot be the health pool/,
    "a pool that counts up from zero is not hit points",
  );
  refuses(
    emberText,
    (doc) => (doc.battle.skills = [{ list: "knacks", alwaysWhen: { column: "name", equals: "Road Sense" } }]),
    /battle\.skills\.0\.alwaysWhen: alwaysWhen is the exception to onlyWhen, so it needs onlyWhen beside it/,
    "alone it would gate nothing and let every row through",
  );
  refuses(
    emberText,
    (doc) => (doc.battle.skills = [{ list: "knacks", alwaysWhen: { column: "name", equals: 0 } }]),
    /battle\.skills\.0\.alwaysWhen\.equals: "name" is a text column, so equals must be a string/,
    "the exception compares against a value the column can hold",
  );
  refuses(
    emberText,
    (doc) => (doc.battle.spells = { pool: "luck" }),
    /battle: Unrecognized key\(s\) in object: 'spells'/,
    "the block is strict, like the rest of the file",
  );
}

// ── Health crosses as a share of the maximum, and never rounds anybody out ──
{
  // The headline case: a 5-of-9 sheet on a combatant the Engine gave 60 hit points.
  assert.equal(carryHealthShare(5, 9, 60), 33, "a sheet at 56 per cent starts 56 per cent up the Engine's bar");
  assert.equal(carryHealthShare(33, 60, 9), 5, "and reads straight back onto the sheet's own scale");

  assert.equal(carryHealthShare(0, 9, 60), 0, "down is down on either scale");
  assert.equal(carryHealthShare(-4, 9, 60), 0, "and so is a sheet somehow below zero");
  assert.equal(carryHealthShare(9, 9, 60), 60, "full is full");
  assert.equal(carryHealthShare(1, 60, 9), 1, "a combatant on one hit point of sixty is not rounded off the sheet");
  assert.equal(carryHealthShare(1, 9, 60), 7, "and the smallest sliver of a sheet is still a real health bar");
  // A maximum of zero cannot say what share anything is, so the whole amount crosses rather than a
  // division by nothing. No live pool reaches the seed this way (`listRulesetLivePools` drops a pool
  // whose maximum is not above zero), so this is the guard behind that, not a reachable sheet.
  assert.equal(carryHealthShare(0, 0, 60), 60, "a sheet with no maximum seeds the Engine's full hit points");
  assert.equal(carryHealthShare(30, 0, 9), 9);
}

// ── Seeding: the 5e example, with damaged hit points and a spent slot ──
{
  const caster = build({
    fields: { hp_max: 24, spellcasting_ability: "wis", slots_max_1: 4, slots_max_2: 3, slots_max_3: 2 },
  });
  const live = { pools: { hp: { value: 9 }, slots_1: { value: 1 }, slots_3: { value: 0 } } };
  assert.deepEqual(seedCombatantFromSheet(fiveE, caster, live, ENGINE_MAX_HP), {
    // 9 of the sheet's 24 hit points, on the 60 the Engine built this combatant with. The maximum
    // is the Engine's and is handed back untouched; the sheet's own numbers ride along for the
    // write-back to measure against.
    hp: 23,
    maxHp: 60,
    sheetHp: 9,
    sheetMaxHp: 24,
    // Levels 4 to 9 are absent, not zero: a character with no such slots must read as "no such
    // thing" rather than "none left", which is what stops the Engine from offering the spell.
    spellSlots: { "1": 1, "2": 3, "3": 0 },
  });

  const untouched = seedCombatantFromSheet(fiveE, caster, undefined, ENGINE_MAX_HP);
  assert.deepEqual(untouched, {
    hp: 60,
    maxHp: 60,
    sheetHp: 24,
    sheetMaxHp: 24,
    spellSlots: { "1": 4, "2": 3, "3": 2 },
  });
  assert.equal(untouched!.mp, undefined, "this ruleset has no energy pool, so the combatant gets none");

  const fighter = build({ fields: { hp_max: 30 } });
  assert.deepEqual(
    seedCombatantFromSheet(fiveE, fighter, undefined, ENGINE_MAX_HP),
    { hp: 60, maxHp: 60, sheetHp: 30, sheetMaxHp: 30 },
    "slots hidden from a character who casts nothing are not seeded",
  );

  // A temporary buffer stays where it is stored. The Engine has no temporary hit points, and the
  // write-back's `damage` drains the buffer first, so it still absorbs the fight's first hits.
  assert.equal(seedCombatantFromSheet(fiveE, fighter, { pools: { hp: { value: 30, temp: 5 } } }, 60)!.hp, 60);
}

// ── Seeding: Ember Roads, whose hit points are Grit and whose energy is Luck ──
{
  const traveller = build({ fields: { toughness: 2 } });
  assert.deepEqual(
    readRulesetLive(ember, traveller, undefined).pools.map((pool) => [pool.key, pool.max]),
    [
      ["grit", 6],
      ["luck", 3],
    ],
  );
  assert.deepEqual(
    seedCombatantFromSheet(ember, traveller, { pools: { grit: { value: 4 }, luck: { value: 1 } } }, ENGINE_MAX_HP),
    {
      // 4 Grit of 6, on the Engine's own 60.
      hp: 40,
      maxHp: 60,
      sheetHp: 4,
      sheetMaxHp: 6,
      // Energy is an absolute count, not a share: it is small, its costs come off the same sheet,
      // and the Engine spends it one point at a time.
      mp: 1,
      maxMp: 3,
    },
  );

  // Zero hit points is the real number. Every engine reads `hp > 0` for who may act and who is
  // still standing, so the member starts the fight down, exactly as a member knocked out inside one
  // is down. Inventing a hit point here would put a character into a fight they cannot be in.
  assert.equal(seedCombatantFromSheet(ember, traveller, { pools: { grit: { value: 0 } } }, ENGINE_MAX_HP)!.hp, 0);

  // A pool the sheet does not have right now is not a resource to lend.
  const hidden = parsed(emberText, (doc) => {
    doc.sheet.live.pools[0].hideWhen = { field: "calling", equals: "ghost" };
  });
  assert.equal(seedCombatantFromSheet(hidden, build({ fields: { calling: "ghost" } }), undefined, ENGINE_MAX_HP), null);
}

// ── No battle block: the bridge does nothing at all ──
{
  const plain = parsed(emberText, (doc) => delete doc.battle);
  assert.equal(plain.battle, undefined);
  assert.equal(seedCombatantFromSheet(plain, build({}), { pools: { grit: { value: 1 } } }, ENGINE_MAX_HP), null);
  assert.deepEqual(combatSkillsFromSheet(plain, build({}), {}), []);
  assert.deepEqual(sheetOpsFromCombatResult(plain, { hp: 60, maxHp: 60, sheetHp: 6, sheetMaxHp: 6 }, { hp: 1 }), []);
}

// ── Catalog-marked rows become combat skills ──
{
  const entries = ember.catalogs![0]!.entries!;
  const entry = (id: string) => entries.find((candidate) => candidate.id === id)!;
  const rowsOf = (id: string) => rowsFromCatalogEntry("knacks", entry(id)).filter((row) => row.list === "knacks");

  const picked = build({
    lists: {
      knacks: [
        ...rowsOf("road-sense").map((row) => row.row),
        ...rowsOf("last-ember").map((row) => row.row),
        ...rowsOf("coldfire-toss").map((row) => row.row),
        ...rowsOf("hold-the-line").map((row) => row.row),
        // Typed in by hand, so nothing says what it does in numbers.
        { name: "Shoulder Barge", notes: "Knock somebody off a ledge." },
      ],
    },
  });
  const skills = combatSkillsFromSheet(ember, picked, { knacks: entries });

  assert.deepEqual(
    skills.map((skill) => skill.id),
    ["knacks/coldfire-toss", "knacks/hold-the-line"],
    "a row with no mechanics, and one whose cost the Engine cannot spend, are both left out",
  );
  assert.deepEqual(skills[0], {
    id: "knacks/coldfire-toss",
    name: "Coldfire Toss",
    type: "attack",
    mpCost: 0,
    power: 1,
    description: "A jar of blue fire that burns cold and spreads.",
    // 12 paces and a 4-pace burst, at two paces to the cell.
    range: 6,
    areaRadius: 2,
    targetScope: "all-enemies",
    friendlyFire: true,
    element: "coldfire",
  });
  assert.equal(skills[1]!.mpCost, 1, "a cost on the energy pool is what the Engine spends");
  assert.equal(skills[1]!.slotLevel, undefined, "this ruleset has no slots");
  assert.equal(skills[1]!.spell, undefined);

  // The same knack picked twice is one skill.
  const twice = build({
    lists: { knacks: [...rowsOf("coldfire-toss"), ...rowsOf("coldfire-toss")].map((r) => r.row) },
  });
  assert.equal(combatSkillsFromSheet(ember, twice, { knacks: entries }).length, 1);

  // Entries the caller never fetched contribute nothing, rather than a skill with no numbers.
  assert.deepEqual(combatSkillsFromSheet(ember, picked, {}), []);
}

// ── `onlyWhen` and `alwaysWhen` ──
{
  const gated = parsed(emberText, (doc) => {
    const knacks = doc.sheet.lists.find((list: any) => list.id === "knacks");
    knacks.columns.push({ id: "ready", label: "Ready", type: "boolean", default: false });
    knacks.columns.push({ id: "tier", label: "Tier", type: "number", min: 0, max: 3, default: 1 });
    doc.battle.skills = [{ list: "knacks", onlyWhen: "ready", alwaysWhen: { column: "tier", equals: 0 } }];
  });
  const entries = gated.catalogs![0]!.entries!;
  const row = (id: string, cells: Record<string, unknown>) => ({
    ...rowsFromCatalogEntry("knacks", entries.find((entry) => entry.id === id)!)[0]!.row,
    ...cells,
  });
  const ids = (rows: Record<string, unknown>[]) =>
    combatSkillsFromSheet(gated, build({ lists: { knacks: rows } }), { knacks: entries }).map((skill) => skill.id);

  assert.deepEqual(ids([row("coldfire-toss", { ready: true, tier: 1 })]), ["knacks/coldfire-toss"]);
  assert.deepEqual(ids([row("coldfire-toss", { ready: false, tier: 1 })]), [], "the gate keeps an unready row out");
  assert.deepEqual(ids([row("coldfire-toss", {})]), [], "and a row that never set it stays out too");
  assert.deepEqual(
    ids([row("coldfire-toss", { ready: false, tier: 0 })]),
    ["knacks/coldfire-toss"],
    "the exception lets a row through whatever the gate says",
  );
}

// ── What a mechanics block becomes, one field at a time ──
{
  const synthetic = (mechanics: RulesetCatalogMechanics, catalogId = "knacks") => {
    const entry: RulesetCatalogEntry = {
      id: "probe",
      label: "Probe",
      rows: [{ list: "knacks", values: { name: "Probe" } }],
      mechanics,
    };
    const rows = [{ name: "Probe", _catalog: `${catalogId}/probe` }];
    return combatSkillsFromSheet(ember, build({ lists: { knacks: rows } }), { [catalogId]: [entry] })[0] ?? null;
  };

  assert.equal(synthetic({ kind: "utility" }), null, "there is no Engine action behind a utility entry");
  assert.equal(
    synthetic({ kind: "buff", reaction: true }),
    null,
    "a reaction is a timing window the combat handoff owns",
  );
  assert.equal(
    synthetic({ kind: "attack", cost: [{ pool: "grit", amount: 1 }] }),
    null,
    "hit points are not spendable as a cost, so the entry is not offered at all",
  );
  // The Engine charges one number of energy, or one slot. A price it cannot charge in full makes the
  // skill absent rather than cheaper than the sheet says.
  assert.equal(
    synthetic({
      kind: "attack",
      cost: [
        { pool: "luck", amount: 1 },
        { pool: "luck", amount: 2 },
      ],
    })!.mpCost,
    3,
    "several energy terms are one bill",
  );
  {
    // The 5e example declares slot pools but ships no catalogs, so the probe brings its own header.
    const withSpellCatalog = {
      ...fiveE,
      catalogs: [{ id: "spells", label: "Spells", feeds: ["spells"], entries: [] }],
    } as typeof fiveE;
    const slotProbe = (cost: RulesetCatalogMechanics["cost"]) => {
      const entry: RulesetCatalogEntry = {
        id: "probe",
        label: "Probe",
        rows: [{ list: "spells", values: { name: "Probe" } }],
        mechanics: { kind: "attack", cost },
      };
      const rows = [{ name: "Probe", level: 1, prepared: true, _catalog: "spells/probe" }];
      const sheet = build({ lists: { spells: rows } });
      return combatSkillsFromSheet(withSpellCatalog, sheet, { spells: [entry] })[0] ?? null;
    };
    assert.equal(
      slotProbe([{ pool: "slots_2", amount: 1 }])!.slotLevel,
      2,
      "exactly one slot is what the Engine spends",
    );
    assert.equal(slotProbe([{ pool: "slots_2", amount: 2 }]), null, "two slots of one level cannot be charged");
    assert.equal(
      slotProbe([
        { pool: "slots_1", amount: 1 },
        { pool: "slots_2", amount: 1 },
      ]),
      null,
      "slots of two levels cannot be charged",
    );
  }
  assert.equal(
    synthetic({ kind: "attack", cost: [{ pool: "tricks", amount: 1 }] }),
    null,
    "and neither is a class resource the Engine knows nothing about",
  );
  assert.equal(synthetic({ kind: "heal", amount: { flat: 3 } })!.type, "heal");
  assert.equal(synthetic({ kind: "debuff" })!.power, 1, "an entry with no amount is a plain multiplier");

  // Distances are the catalog's own unit divided by its own cell size, and never round to nothing.
  assert.equal(synthetic({ kind: "attack", range: 12 })!.range, 6);
  assert.equal(synthetic({ kind: "attack", range: 1 })!.range, 1);
  assert.equal(synthetic({ kind: "attack", range: 0 })!.range, 1);
  assert.equal(synthetic({ kind: "attack", area: { shape: "burst", size: 8 } })!.areaRadius, 4);
  assert.equal(synthetic({ kind: "attack", area: { shape: "cone", size: 8 } })!.areaRadius, 2);
  assert.equal(synthetic({ kind: "attack", area: { shape: "line", size: 40 } })!.areaRadius, 1);
  assert.equal(synthetic({ kind: "attack", area: { shape: "burst", size: 8 } })!.targetScope, "all-enemies");
  assert.equal(synthetic({ kind: "attack", range: 12 })!.targetScope, undefined);
  // The Engine has no "all allies" scope, so an area heal or buff must never borrow "all enemies".
  assert.equal(synthetic({ kind: "heal", area: { shape: "burst", size: 8 } })!.targetScope, undefined);
  assert.equal(synthetic({ kind: "buff", area: { shape: "burst", size: 8 } })!.targetScope, undefined);
  assert.equal(synthetic({ kind: "debuff", area: { shape: "burst", size: 8 } })!.targetScope, "all-enemies");
  // A catalog that declares no distance unit counts in cells already.
  assert.equal(synthetic({ kind: "attack", range: 12 }, "plain")!.range, 12);
}

// ── Power never falls as the dice grow, and never leaves the Engine's own range ──
{
  const entry = (amount: RulesetCatalogMechanics["amount"]): RulesetCatalogEntry => ({
    id: "probe",
    label: "Probe",
    rows: [{ list: "knacks", values: { name: "Probe" } }],
    mechanics: { kind: "attack", ...(amount ? { amount } : {}) },
  });
  const powerOf = (amount: RulesetCatalogMechanics["amount"]) =>
    combatSkillsFromSheet(ember, build({ lists: { knacks: [{ name: "Probe", _catalog: "knacks/probe" }] } }), {
      knacks: [entry(amount)],
    })[0]!.power;

  const pools = [{ flat: 1 }, { dice: "1d6" }, { dice: "2d6" }, { dice: "1d8+3" }, { dice: "2d6+3" }] as const;
  const growing = [{ dice: "1d6" }, { dice: "2d6" }, { dice: "4d6" }, { dice: "6d6" }, { dice: "8d6" }] as const;
  for (const [index, amount] of growing.entries()) {
    if (index > 0) assert.ok(powerOf(amount) >= powerOf(growing[index - 1]!), `${amount.dice} is not weaker`);
  }
  for (const amount of pools) assert.ok(powerOf(amount) >= 0.5 && powerOf(amount) <= 3, "power stays in range");

  // The calibration itself: a basic weapon lands where the Engine's own basic skills are (1.35 for
  // an attack, 1.15 for a heal), and a third-level area spell reaches the ceiling a generated skill
  // is clamped to.
  assert.equal(powerOf({ dice: "1d8+3" }), 1.07);
  assert.equal(powerOf({ dice: "2d6+3" }), 1.43);
  assert.equal(powerOf({ dice: "6d6" }), 3);
  assert.equal(powerOf({ dice: "8d6" }), 3, "and anything bigger clamps there rather than climbing");
  assert.equal(powerOf({ flat: 1 }), 0.5, "the floor is the one the heal path already applies");
  assert.equal(powerOf(undefined), 1);
}

// ── Operations are the deltas, and nothing else ──
{
  const traveller = build({ fields: { toughness: 2 } });
  const stored = { pools: { grit: { value: 4 }, luck: { value: 2 } } };
  const before = seedCombatantFromSheet(ember, traveller, stored, ENGINE_MAX_HP)!;
  assert.equal(before.hp, 40, "4 Grit of 6 is two thirds of the way up a 60-point health bar");

  assert.deepEqual(sheetOpsFromCombatResult(ember, before, { hp: 1, mp: 0 }), [
    // One hit point of sixty is a sliver of the bar, and a sliver of the bar is one Grit, never
    // zero: only a combatant who is actually down writes the sheet down.
    { op: "damage", pool: "grit", amount: 3 },
    { op: "spend", pool: "luck", amount: 2 },
  ]);
  assert.deepEqual(
    sheetOpsFromCombatResult(ember, before, { hp: 0, mp: 2 }),
    [{ op: "damage", pool: "grit", amount: 4 }],
    "a combatant who went down puts the sheet at zero",
  );
  assert.deepEqual(
    sheetOpsFromCombatResult(ember, before, { hp: 60, mp: 2 }),
    [{ op: "restore", pool: "grit", amount: 2 }],
    "a battle that ended better than it started gives the sheet back what it healed",
  );
  assert.deepEqual(
    sheetOpsFromCombatResult(ember, before, { hp: 40, mp: 2 }),
    [],
    "an untouched member writes nothing",
  );
  assert.deepEqual(sheetOpsFromCombatResult(ember, before, { hp: 40 }), [], "and neither does a summary without mp");
  // The share is deliberately not recomputed for a fight that did not move the combatant: 40 of 60
  // reads back as 4 Grit here, but a sheet whose share rounds the other way must not be nudged by
  // the conversion alone, so an unchanged hit point count writes no health operation at all.
  const rounded = seedCombatantFromSheet(
    ember,
    build({ fields: { toughness: 5 } }),
    { pools: { grit: { value: 5 } } },
    ENGINE_MAX_HP,
  )!;
  assert.equal(rounded.hp, 33, "5 Grit of 9, on the Engine's 60");
  assert.deepEqual(sheetOpsFromCombatResult(ember, rounded, { hp: 33 }), [], "a fight nobody was touched in is free");
  assert.deepEqual(sheetOpsFromCombatResult(ember, rounded, { hp: 0 }), [{ op: "damage", pool: "grit", amount: 5 }]);
  assert.deepEqual(sheetOpsFromCombatResult(ember, rounded, { hp: 1 }), [{ op: "damage", pool: "grit", amount: 4 }]);
  assert.deepEqual(sheetOpsFromCombatResult(ember, rounded, { hp: 60 }), [{ op: "restore", pool: "grit", amount: 4 }]);

  const caster = build({ fields: { hp_max: 24, spellcasting_ability: "wis", slots_max_1: 4, slots_max_3: 2 } });
  const casterBefore = seedCombatantFromSheet(fiveE, caster, undefined, ENGINE_MAX_HP)!;
  assert.deepEqual(sheetOpsFromCombatResult(fiveE, casterBefore, { hp: 60, spellSlots: { "1": 3, "3": 0 } }), [
    { op: "spend", pool: "slots_1", amount: 1 },
    { op: "spend", pool: "slots_3", amount: 2 },
  ]);
  assert.deepEqual(
    sheetOpsFromCombatResult(fiveE, casterBefore, { hp: 60, spellSlots: { "9": 0 } }),
    [],
    "a level the seed never carried is a level the battle could not spend",
  );
}

// ── Applying them reproduces the state the battle ended in ──
{
  const traveller = build({ fields: { toughness: 2 } });
  const stored = { pools: { grit: { value: 4 }, luck: { value: 2 } } };
  const before = seedCombatantFromSheet(ember, traveller, stored, ENGINE_MAX_HP)!;
  const after = { hp: 1, mp: 0 };

  const written = applyCombatResultToLive(ember, traveller, stored, sheetOpsFromCombatResult(ember, before, after));
  assert.deepEqual(written.refused, []);
  const seededAgain = seedCombatantFromSheet(ember, traveller, written.live, ENGINE_MAX_HP);
  assert.deepEqual(
    seededAgain,
    { hp: 10, maxHp: 60, sheetHp: 1, sheetMaxHp: 6, mp: 0, maxMp: 3 } satisfies RulesetCombatSeed,
    "the fight left one Grit of six, so the next fight starts a sixth of the way up the bar",
  );
  assert.deepEqual(stored, { pools: { grit: { value: 4 }, luck: { value: 2 } } }, "the input blob is never touched");

  assert.deepEqual(
    applyCombatResultToLive(ember, traveller, stored, []),
    { live: null, refused: [] },
    "nothing applied means nothing to write",
  );

  // Damage drains a temporary buffer first, which is why the seed leaves the buffer behind: the
  // fight's opening hits still come off the buffer where the sheet keeps it.
  const fighter = build({ fields: { hp_max: 24 } });
  const buffered = applyCombatResultToLive(fiveE, fighter, { pools: { hp: { value: 24, temp: 4 } } }, [
    { op: "damage", pool: "hp", amount: 3 },
  ]);
  assert.deepEqual(buffered.live!.pools!.hp, { value: 24, temp: 1 });
}

// ── A refused operation is reported, and changes nothing ──
{
  const traveller = build({ fields: { toughness: 2 } });
  const stored = { pools: { grit: { value: 4 }, luck: { value: 1 } } };
  const written = applyCombatResultToLive(ember, traveller, stored, [
    { op: "damage", pool: "grit", amount: 1 },
    { op: "spend", pool: "luck", amount: 5 },
  ]);
  assert.deepEqual(written.refused, [{ op: { op: "spend", pool: "luck", amount: 5 }, reason: "insufficient" }]);
  assert.deepEqual(written.live!.pools, { grit: { value: 3 }, luck: { value: 1 } }, "only the legal half applied");
}

// ── The tactical summary carries what a ruleset sheet has to be told about ──
{
  const member = (id: string, side: Combatant["side"]): Combatant => ({
    id,
    name: id,
    hp: 12,
    maxHp: 24,
    mp: 1,
    maxMp: 3,
    spellSlots: { "1": 2, "3": 0 },
    attack: 8,
    defense: 4,
    speed: 10,
    level: 3,
    side,
  });
  const summary = buildTacticalSummary(
    createTacticalCombat([member("traveller", "player")], [member("husk", "enemy")], {
      seed: 71,
      difficulty: "normal",
    }),
  );
  assert.deepEqual(summary.party[0]!.spellSlots, { "1": 2, "3": 0 });
  assert.equal(summary.party[0]!.mp, 1);
  assert.equal(summary.party[0]!.maxMp, 3);
  assert.equal(summary.party[0]!.hp, 12);
}

console.log("game ruleset combat bridge regressions passed.");
