/**
 * The 5e ship-readiness playtest of 2026-10-23, the Engine's part:
 *
 *   - A pool's maximum follows what the character wears: an Amulet of Health's Constitution raises the
 *     hit points a heal and a rest go up to, on the sheet, from the Game Master and in a fight.
 *   - A rest spends dice picked pool by pool first (a multiclass Short rest's hit dice) and heals.
 *   - A rest, an item use and a sheet edit before the game's first state make that state.
 *   - The guided builder reads each step's offers and picks once a pass, to the same sheet as before.
 *   - A class picked in a field is never "already known" for rows another class shares, and its
 *     name on the sheet leaves out what only sets it apart in the catalog.
 *   - Worn save bonuses show on the sheet's trained saves, and a party member the setup left out
 *     still gets a card.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetBuilder,
  applyRulesetSheetOp,
  defaultRulesetSheetBuild,
  listRulesetLivePools,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetBuilderOptions,
  rulesetBuilderPicks,
  withRulesetPlanMemo,
  type RulesetDefinition,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(root, path), "utf8");
const parsed = (document: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(document);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const example = () => JSON.parse(readSource("docs/development/ruleset-5e-2014.example.json")) as Record<string, any>;

// ── Hit points at their most follow a worn Constitution ──
{
  const doc = example();
  doc.sheet.live.pools.find((pool: { id: string }) => pool.id === "hp").max = { abilityScore: "con" };
  const definition = parsed(doc);
  const build = defaultRulesetSheetBuild(definition);
  build.abilities = { ...build.abilities, con: 10 };
  const amulet: RulesetSheetItem = {
    item: { worn: { abilities: { con: { set: 19 } } } } as never,
    quantity: 1,
    worn: true,
    name: "Amulet of Health",
  };
  const max = (items?: RulesetSheetItem[]) =>
    listRulesetLivePools(definition, build, items).find((p) => p.key === "hp")!;
  assert.equal(max().max, 10, "without it");
  assert.equal(max([amulet]).max, 19, "with it on");
  assert.equal(readRulesetLive(definition, build, {}, [amulet]).pools.find((p) => p.key === "hp")!.max, 19);
  const hurt = applyRulesetSheetOp(definition, build, {}, { op: "damage", pool: "hp", amount: 15 }, undefined, [
    amulet,
  ]);
  assert.ok(hurt.ok);
  const healed = applyRulesetSheetOp(
    definition,
    build,
    hurt.live,
    { op: "restore", pool: "hp", amount: 30 },
    undefined,
    [amulet],
  );
  assert.ok(healed.ok);
  assert.equal(readRulesetLive(definition, build, healed.live, [amulet]).pools.find((p) => p.key === "hp")!.value, 19);
}

// ── A rest's dice, picked pool by pool ──
{
  const doc = example();
  doc.sheet.live.pools.push({ id: "hit_dice_small", label: "Hit dice (d6)", max: { const: 2 } });
  const short = doc.rests.find((rest: { id: string }) => rest.id === "short");
  short.dice = [
    { pool: "hit_dice", die: { const: 10 }, heals: "hp" },
    { pool: "hit_dice_small", die: { const: 6 }, heals: "hp" },
  ];
  const definition = parsed(doc);
  const build = defaultRulesetSheetBuild(definition);
  build.fields = { ...build.fields, hp_max: 30, level: 3 };
  const rested = applyRulesetSheetOp(
    definition,
    build,
    { pools: { hp: { value: 10 } } },
    { op: "rest", rest: "short", diceFrom: { hit_dice: 1, hit_dice_small: 2 } },
    () => 3,
  );
  assert.ok(rested.ok, rested.ok ? "" : rested.reason);
  const after = readRulesetLive(definition, build, rested.live).pools;
  assert.equal(after.find((p) => p.key === "hp")!.value, 19, "three dice of 3 heal 9");
  assert.equal(after.find((p) => p.key === "hit_dice")!.value, 2);
  assert.equal(after.find((p) => p.key === "hit_dice_small")!.value, 0);
  // Below full health, so the dice are wanted (at full a rest spends none).
  const tooMany = applyRulesetSheetOp(
    definition,
    build,
    { pools: { hp: { value: 10 } } },
    { op: "rest", rest: "short", diceFrom: { hit_dice_small: 3 } },
    () => 3,
  );
  assert.equal(tooMany.ok, false, "never more than the pool holds");
  const nothing = applyRulesetSheetOp(definition, build, {}, { op: "rest", rest: "short", diceFrom: { hit_dice: 0 } });
  assert.ok(nothing.ok, "none picked is the rest alone");
  // The sheet asks for them, and the server's rest takes them.
  const sheet = readSource("packages/client/src/components/game/GameRulesetSheet.tsx");
  assert.match(sheet, /"game\.ruleset\.sheet\.restDice"/u);
  assert.match(sheet, /apply\(\{ op: "rest", rest: rest\.id, \.\.\.\(diceFrom \? \{ diceFrom \} : \{\}\) \}\)/u);
  const routes = readSource("packages/server/src/routes/game-inventory.routes.ts");
  assert.match(routes, /diceFrom: z/u);
}

// ── Before the game's first state ──
{
  const service = readSource("packages/server/src/services/game/game-item-use.service.ts");
  assert.doesNotMatch(service, /if \(!row\) throw new ItemUseRefused\("no-state"\)/u, "no row is a fresh sheet");
  assert.match(service, /async function writeGameRulesetLive/u);
  assert.match(service, /export async function setGameRulesetLive/u);
  const surface = readSource("packages/client/src/components/game/GameSurface.tsx");
  assert.match(surface, /"\/game\/inventory\/live"/u);
  const messages = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;
  for (const key of [
    "game.ruleset.sheet.restDice",
    "game.ruleset.sheet.restDiceAria",
    "game.ruleset.sheet.stateNotReady",
    "ui.rulesets.builder.rollAll",
  ])
    assert.ok(messages[key], `en.json is missing ${key}`);
}

// ── The builder: read once a pass, and names on the sheet ──
{
  // "Cleric (second class)" is Cleric on the sheet, where the catalog has a Cleric too.
  const doc = example();
  doc.sheet.builder = {
    steps: [{ id: "class", label: "Class", kind: "catalog", catalog: "classes_test", field: "class", max: 2 }],
  };
  doc.catalogs.push({
    id: "classes_test",
    label: "Classes",
    feeds: ["features"],
    entries: [
      { id: "fighter", label: "Fighter", rows: [{ list: "features", values: { name: "Armor: All armor" } }] },
      { id: "cleric", label: "Cleric", rows: [{ list: "features", values: { name: "Armor: Medium" } }] },
      {
        id: "cleric-2",
        label: "Cleric (second class)",
        rows: [{ list: "features", values: { name: "Armor: Light" } }],
      },
      { id: "monk-2", label: "Monk (way of things)", rows: [{ list: "features", values: { name: "Martial arts" } }] },
    ],
  });
  const definition2 = parsed(doc);
  const catalogs2 = { classes_test: definition2.catalogs!.find((one) => one.id === "classes_test")!.entries! };
  const made = applyRulesetBuilder(
    definition2,
    defaultRulesetSheetBuild(definition2),
    { picks: { class: ["fighter", "cleric-2"] } },
    catalogs2,
  );
  assert.equal(made.build.fields.class, "Fighter, Cleric");
  const other = applyRulesetBuilder(
    definition2,
    defaultRulesetSheetBuild(definition2),
    { picks: { class: ["fighter", "monk-2"] } },
    catalogs2,
  );
  assert.equal(other.build.fields.class, "Fighter, Monk (way of things)", "kept where nothing else bears the name");
  // Read once a pass, and afresh outside one.
  {
    const step = definition2.sheet.builder!.steps[0]!;
    assert.equal(step.kind, "catalog");
    if (step.kind === "catalog") {
      const state = { picks: { class: ["fighter"] } };
      const build = defaultRulesetSheetBuild(definition2);
      withRulesetPlanMemo(() => {
        const first = rulesetBuilderOptions(definition2, step, state, catalogs2, build);
        assert.equal(first.length, 4);
        assert.equal(rulesetBuilderOptions(definition2, step, state, catalogs2, build), first, "once a pass");
        assert.equal(
          rulesetBuilderPicks(definition2, step.id, state, catalogs2, build),
          rulesetBuilderPicks(definition2, step.id, state, catalogs2, build),
        );
      });
      assert.notEqual(
        rulesetBuilderOptions(definition2, step, state, catalogs2, build),
        rulesetBuilderOptions(definition2, step, state, catalogs2, build),
        "and afresh outside one",
      );
    }
  }
  const builder = readSource("packages/client/src/components/rulesets/RulesetSheetBuilder.tsx");
  assert.match(builder, /!current\.field &&\s+rulesetBuilderEntryHeld/u);
  assert.match(builder, /\/\^\[a-z0-9_-\]\+\$\/u\.test\(value\)/u);
  // A rows step throws its rolled cells (hit point rolls) as All fields does, one or all at once.
  assert.match(
    builder,
    /<RollCellButton\s+notation=\{rulesetListRollNotation\(definition, build, column, row, evaluated\)\}/u,
  );
  assert.match(builder, /Promise\.all\(rollable\.map\(\(cell\) => rollRulesetCell\(cell\.notation\)\)\)/u);
  const editorSource = readSource("packages/client/src/components/rulesets/RulesetSheetEditor.tsx");
  assert.match(editorSource, /import \{ RollCellButton \} from "\.\/RulesetRollCellButton";/u);
}

// ── The sheet's saves, and the setup's cards ──
{
  const sheet = readSource("packages/client/src/components/game/GameRulesetSheet.tsx");
  assert.match(sheet, /rulesetCheckEffects\(checkSources, \{ type: "save", id: save\.id, label: save\.label \}\)/u);
  const routes = readSource("packages/server/src/routes/game.routes.ts");
  assert.match(routes, /const missing = \[\.\.\.\(rulesetSheets\?\.names/u);
  // The guided tab's summary has the pools and the gear note the All fields tab has.
  const builder = readSource("packages/client/src/components/rulesets/RulesetSheetBuilder.tsx");
  assert.match(builder, /outsideGame \? listRulesetLivePools\(definition, build\) : \[\]/u);
  assert.match(builder, /\{gearNote && /u);
  const editor = readSource("packages/client/src/components/rulesets/RulesetSheetEditor.tsx");
  assert.match(editor, /outsideGame=\{live === undefined\}/u);
  // A carried torch is never offered to put out in daylight, where it was never lit.
  const options = readSource("packages/shared/src/features/ruleset-combat/options.ts");
  assert.match(options, /rulesetCarriesLight\(definition, actor, state\) \|\| rulesetDaylit\(actor, state\)/u);
}

console.log(
  "Ship readiness: hit points follow a worn CON, a rest's dice pool by pool, sheets before the first state, the builder read once a pass, class names, worn saves, every party card.",
);
