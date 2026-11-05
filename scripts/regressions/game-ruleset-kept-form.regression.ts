/**
 * A shape kept on the sheet (1.801, laptop party B 2026-10-25: a druid's Wild Shape used in the story
 * only added a condition, and the fight began with them in their own shape).
 *
 *   - Wild Shape used outside a fight names its form (`as=`), checked against the forms it offers:
 *     none above the sheet's cap, none that flies before it may; one left unnamed is refused with
 *     the forms it takes. Paid for once, and kept on the sheet.
 *   - The Game Master reads it on the sheet block, "In the shape of".
 *   - The next fight starts with them in it, not paid for again, even where the Game Master lists it.
 *   - Still in it as the fight ends: kept, with the form's health and the condition holding it. Out
 *     of it (beaten out of the form, or turned back): gone from the sheet. Taken in a fight and held
 *     as it ends: kept from then on.
 *   - The form's health carries into the next fight.
 *   - The `dismiss` sheet command ends it, and the condition holding them in it; the form's whole
 *     health is kept with what it has left, not rolled again; a story turn reads the forms' catalog.
 *   - Only the shape the sheet keeps starts a fight (laptop 2026-10-26: a druid came into a fight as a
 *     Swarm of Spiders with nothing in the story that turned him): the fight's own listing of a
 *     member's Wild Shape is not done, and the condition holding them in it taken off in the story
 *     ends it. Another form taken in a fight in its place and held as it ends is kept in its place.
 *   - A form keeps on what its creature keeps on, and gives it up with the shape: a swarm's sharing
 *     of spaces, without which its bite of no reach reached nobody.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applySheetCommandTags,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  renderRulesetSheetBlock,
  rowsFromCatalogEntry,
  rulesetKeptForm,
  rulesetSheetBuildSchema,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetLiveStates,
} from "../../packages/shared/src/index.js";
import { rulesetLeaveShape, rulesetTakeShape } from "../../packages/shared/src/features/ruleset-combat/shape.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-kept-form-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createRulesetFight, rulesetFightLiveStates } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
const { rulesetTurnCalledCatalogs } =
  await import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js");

try {
  const doc = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  );
  const beast = (id: string, label: string, cr: number, extra: Record<string, unknown> = {}) => ({
    id,
    label,
    filters: { kind: "Beast", cr },
    creature: {
      health: 30,
      defense: 13,
      initiativeModifier: 0,
      speed: 40,
      abilities: { str: 15, dex: 14, con: 14, int: 3, wis: 12, cha: 6 },
      tier: "cr_1",
      actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 4, damage: { dice: "2d4", flat: 2 }, reach: 5 }],
      ...extra,
    },
  });
  const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
  creatures.filters.push({ id: "cr", label: "Challenge", type: "number" });
  creatures.entries.push(
    beast("wolf", "Wolf", 0.25, { health: { dice: "2d8+2" } }),
    beast("brown-bear", "Brown Bear", 1),
    beast("giant-elk", "Giant Elk", 2),
    beast("eagle", "Eagle", 0, { speeds: { fly: 60 } }),
    beast("swarm-of-spiders", "Swarm of Spiders", 0.5, {
      keepsOn: ["swarming"],
      actions: [{ id: "bites", name: "Bites", budget: "action", toHit: 3, damage: { dice: "4d4" }, reach: 0 }],
    }),
  );
  doc.sheet.live.conditions.push({ id: "wild_shaped", label: "Wild Shape" });
  doc.combat.conditions.push({ condition: "wild_shaped", effects: [], shape: { revert: "bonus" } });
  doc.sheet.live.conditions.push({ id: "swarming", label: "Swarm (shares spaces)", pickable: false });
  doc.combat.conditions.push({ condition: "swarming", sharesSpace: true });
  doc.catalogs.push({
    id: "spells",
    label: "Spells",
    feeds: ["spells"],
    entries: [
      {
        id: "wild-shape",
        label: "Wild Shape",
        rows: [{ list: "spells", values: { name: "Wild Shape", level: 1, prepared: true } }],
        mechanics: {
          kind: "buff",
          targets: "self",
          budget: "action",
          cost: [{ pool: "slots_1", amount: 1 }],
          applies: [{ condition: "wild_shaped", duration: { rounds: 600 } }],
          forms: {
            from: { catalog: "creatures", filters: { kind: "Beast" } },
            upTo: { filter: "cr", at: { const: 1 } },
            without: [{ speed: "fly" }],
          },
        },
      },
    ],
  });
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;
  const spells = definition.catalogs!.find((entry) => entry.id === "spells")!.entries! as RulesetCatalogEntry[];
  const bestiary = { creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries! };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 10 },
    fields: { level: 4, ac: 12, speed: 30, hp_max: 28, race: "Human", spellcasting_ability: "wis", slots_max_1: 2 },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const cards = [{ name: "Rook", build }];
  const say = (content: string, live: RulesetLiveStates = {}) =>
    applySheetCommandTags(content, { definition, cards, playerName: "Rook", live, catalogs: { spells, ...bestiary } });
  const slots = (live: RulesetLiveStates) => live.rook?.pools?.slots_1?.value;

  // ── Outside a fight: the form is named, checked, paid for once and kept ──
  const unnamed = say(`[sheet: op="use" name="Wild Shape"]`);
  assert.equal(unnamed.outcomes[0]!.ok, false);
  assert.match(unnamed.outcomes[0]!.reason ?? "", /name the form Wild Shape takes.*Wolf, Brown Bear/);
  assert.doesNotMatch(unnamed.outcomes[0]!.reason ?? "", /Giant Elk|Eagle/, "none above the cap, none that flies");
  assert.equal(unnamed.changed, false, "nothing is paid for a refused shape");
  // A form it knows but may not take yet is refused with why (laptop 2026-10-26).
  for (const [form, why] of [
    ["Giant Elk", /cannot take the form Giant Elk now: it is above the most it takes now/],
    ["Eagle", /cannot take the form Eagle now: it has a fly speed, which it cannot take yet/],
    ["Dragon", /cannot take the form "Dragon" now/],
  ] as const) {
    const refused = say(`[sheet: op="use" name="Wild Shape" as="${form}"]`);
    assert.equal(refused.outcomes[0]!.ok, false, `${form} is refused`);
    assert.match(refused.outcomes[0]!.reason ?? "", why);
  }
  // Its kind said after its name is no part of it (laptop 2026-10-26: as="Reef Shark, Beast").
  for (const form of ["Wolf, Beast", "wolf (Beast)"])
    assert.equal(say(`[sheet: op="use" name="Wild Shape" as="${form}"]`).outcomes[0]!.ok, true, form);
  // An unknown one names the nearest it takes, not the whole list.
  assert.match(
    say(`[sheet: op="use" name="Wild Shape" as="Dire Wolf"]`).outcomes[0]!.reason ?? "",
    /cannot take the form "Dire Wolf" now; nearest Wolf$/,
  );
  const shaped = say(`[sheet: op="use" name="Wild Shape" as="wolf"]`);
  assert.equal(shaped.outcomes[0]!.ok, true, shaped.outcomes[0]!.reason);
  assert.match(shaped.outcomes[0]!.now ?? "", /in the shape of Wolf/);
  assert.equal(slots(shaped.live), 1, "paid for once");
  assert.deepEqual(rulesetKeptForm(shaped.live.rook), { entry: "Wild Shape", as: "Wolf" });
  // Another command after it leaves it be; used again, the new form takes its place.
  assert.deepEqual(rulesetKeptForm(say(`[sheet: op="damage" pool="hp" amount="2"]`, shaped.live).live.rook), {
    entry: "Wild Shape",
    as: "Wolf",
  });
  assert.equal(
    rulesetKeptForm(say(`[sheet: op="use" name="Wild Shape" as="Brown Bear"]`, shaped.live).live.rook)?.as,
    "Brown Bear",
  );

  // A story turn that uses it reads the forms' catalog too, so the form named is checked there.
  assert.deepEqual(rulesetTurnCalledCatalogs({ spells }, `[sheet: op="use" name="Wild Shape" as="Wolf"]`), [
    "creatures",
  ]);
  assert.deepEqual(rulesetTurnCalledCatalogs({ spells }, `[sheet: op="spend" pool="hp" amount="1"]`), []);

  // ── The Game Master reads it ──
  assert.match(
    renderRulesetSheetBlock(definition, cards[0]!, shaped.live.rook),
    /In the shape of: Wolf \(Wild Shape\)/,
  );

  // ── The next fight starts with them in it, not paid for again ──
  const fightWith = (live: RulesetLiveStates, standing?: Array<{ casterId: string; entry: string; mode?: string }>) => {
    const built = createRulesetFight({
      definition,
      seed: 3,
      party: [{ id: "rook", name: "Rook" }],
      enemies: [{ id: "lurker", name: "Thorn Lurker", creature: "creatures/thorn-lurker" }],
      cards: [{ name: "Rook", rulesetSheet: { v: 1, build } }],
      playerName: "Rook",
      live,
      partyCatalogs: { spells },
      bestiary,
      ...(standing ? { standing } : {}),
    });
    assert.ok(built.ok, built.ok ? "" : built.error);
    return built.fight;
  };
  const rookOf = (fight: ReturnType<typeof fightWith>) => fight.encounter.combatants.find((one) => one.id === "rook")!;
  const fight = fightWith(shaped.live, [{ casterId: "rook", entry: "Wild Shape" }]);
  const rook = rookOf(fight);
  assert.equal(rook.shape?.name, "Wolf", "the fight starts with them a wolf");
  assert.deepEqual(
    [rook.shape?.health?.value, rook.shape?.health?.max],
    [11, 11],
    "the form's listed average health, 2d8+2, not a roll",
  );
  assert.equal(
    (rook.sheet!.live as RulesetLiveStates[string]).pools?.slots_1?.value,
    1,
    "not paid for again, though the Game Master listed it too",
  );
  assert.deepEqual(fight.adjustments, []);

  // ── The fight's end does not run out a shape of their own they are still in ──
  {
    const ending = fightWith(shaped.live);
    const lifted = liftRulesetFightEffects(definition, ending.encounter);
    assert.ok(
      !lifted.some((event) => event.type === "condition" && event.condition === "wild_shaped"),
      JSON.stringify(lifted),
    );
    assert.ok(rookOf(ending).tracked.some((entry) => entry.condition === "wild_shaped"));
    assert.deepEqual(rulesetKeptForm(rulesetFightLiveStates(ending).rook), {
      entry: "Wild Shape",
      as: "Wolf",
      health: 11,
      max: 11,
    });
  }

  // ── A shape's condition on one in no shape holds them in nothing, and is taken off as it starts ──
  {
    const stray = fightWith({ rook: { conditions: ["wild_shaped"] } } as RulesetLiveStates);
    const one = rookOf(stray);
    assert.equal(one.shape, undefined);
    assert.ok(!one.tracked.some((entry) => entry.condition === "wild_shaped"));
    assert.ok(!(one.sheet!.live as RulesetLiveStates[string]).conditions?.includes("wild_shaped"));
  }

  // ── Naming the pool it pays from anyway asks for nothing different ──
  {
    const counted = rulesetSheetBuildSchema.parse({
      ...build,
      lists: { ...build.lists, counters: [{ name: "Wild Shape", max: 2, recharge: "short" }] },
    });
    const named = applySheetCommandTags(`[sheet: op="use" name="Wild Shape" as="Wolf" pool="Wild Shape"]`, {
      definition,
      cards: [{ name: "Rook", build: counted }],
      playerName: "Rook",
      live: {},
      catalogs: { spells, ...bestiary },
    });
    assert.equal(named.outcomes[0]!.ok, true, named.outcomes[0]!.reason);
  }

  // ── Still in it as the fight ends: kept, with the form's health and its condition ──
  rook.shape!.health!.value = 12;
  rook.tracked = rook.tracked.filter((entry) => entry.condition !== "wild_shaped");
  rook.shape!.health!.max = 33;
  const kept = rulesetFightLiveStates(fight).rook!;
  assert.deepEqual(rulesetKeptForm(kept), { entry: "Wild Shape", as: "Wolf", health: 12, max: 33 });
  assert.ok(kept.conditions?.includes("wild_shaped"), "the condition holding it stays on the sheet");
  // The form's health carries into the next fight.
  assert.equal(rookOf(fightWith({ rook: kept })).shape?.health?.value, 12);
  assert.equal(rookOf(fightWith({ rook: kept })).shape?.health?.max, 33, "its whole health is not rolled again");

  // ── Out of it as the fight ends: gone ──
  {
    const beaten = fightWith(shaped.live);
    rulesetLeaveShape(rookOf(beaten));
    assert.equal(rulesetKeptForm(rulesetFightLiveStates(beaten).rook), undefined);
  }
  // ── Taken in a fight and held as it ends: kept from then on ──
  {
    const plain = fightWith({});
    assert.equal(rookOf(plain).shape, undefined);
    const taken = fightWith(shaped.live);
    // The same fight as though the shape had been taken in it: nothing kept on the sheet before.
    const live = taken.encounter.combatants.find((one) => one.id === "rook")!.sheet!.live as RulesetLiveStates[string];
    delete live.shaped;
    assert.deepEqual(rulesetKeptForm(rulesetFightLiveStates(taken).rook), {
      entry: "Wild Shape",
      as: "Wolf",
      health: rookOf(taken).shape!.health!.value,
      max: rookOf(taken).shape!.health!.max,
    });
  }

  // ── Ended outside a fight ──
  const ended = say(`[sheet: op="dismiss" name="Wolf"]`, shaped.live);
  assert.equal(ended.outcomes[0]!.ok, true, ended.outcomes[0]!.reason);
  assert.match(ended.outcomes[0]!.now ?? "", /Wolf shape ended/);
  assert.equal(rulesetKeptForm(ended.live.rook), undefined);
  // The condition holding them in it (a fight's write-back, or the Game Master's tag) goes with it.
  const held = { rook: { ...shaped.live.rook, conditions: ["wild_shaped"] } } as RulesetLiveStates;
  assert.ok(!say(`[sheet: op="dismiss" name="Wolf"]`, held).live.rook?.conditions?.includes("wild_shaped"));
  assert.equal(say(`[sheet: op="dismiss" name="Wild Shape"]`, shaped.live).outcomes[0]!.ok, true);
  assert.equal(rookOf(fightWith(ended.live)).shape, undefined, "the next fight starts them in their own shape");

  // ── Only the shape the sheet keeps starts a fight ──
  {
    const listed = fightWith({}, [{ casterId: "rook", entry: "Wild Shape", mode: "Brown Bear" }]);
    assert.equal(rookOf(listed).shape, undefined, "a listed Wild Shape does not turn them");
    assert.deepEqual(listed.adjustments, [
      "Rook's Wild Shape changes their own shape, which only their sheet keeps, so it is not done.",
    ]);
    assert.equal((rookOf(listed).sheet!.live as RulesetLiveStates[string]).pools?.slots_1?.value, undefined);
    // Kept as a wolf, the listing of another form changes nothing: a wolf it is.
    const kept = fightWith(shaped.live, [{ casterId: "rook", entry: "Wild Shape", mode: "Brown Bear" }]);
    assert.equal(rookOf(kept).shape?.name, "Wolf");
  }
  // The condition holding them in it, taken off in the story, ends it.
  {
    const held = { rook: { ...shaped.live.rook, conditions: ["wild_shaped"] } } as RulesetLiveStates;
    const off = say(`[sheet: op="condition" condition="Wild Shape" state="off"]`, held);
    assert.equal(off.outcomes[0]!.ok, true, off.outcomes[0]!.reason);
    assert.match(off.outcomes[0]!.now ?? "", /Wild Shape off, Wolf shape ended/);
    assert.equal(rulesetKeptForm(off.live.rook), undefined);
    assert.equal(rookOf(fightWith(off.live)).shape, undefined, "the next fight starts them in their own shape");
    // Another condition off leaves it be.
    assert.ok(rulesetKeptForm(say(`[sheet: op="condition" condition="prone" state="off"]`, held).live.rook));
  }
  // Another form taken in the fight in its place, held as it ends, is kept in its place.
  {
    const swapped = fightWith(shaped.live);
    const one = rookOf(swapped);
    const form = [...(one.shape!.was.actions ?? [])]
      .flatMap((action) => action.modes ?? [])
      .find((mode) => mode.form?.name === "Brown Bear")!.form!;
    const rule = definition.combat!.conditions!.find((entry) => entry.condition === "wild_shaped")!.shape!;
    assert.ok(rulesetTakeShape(definition, swapped.encounter, one, "wild_shaped", rule, form, () => 1));
    assert.equal(rulesetKeptForm(rulesetFightLiveStates(swapped).rook)?.as, "Brown Bear");
  }

  // ── A form keeps on what its creature keeps on (laptop 2026-10-26: a swarm that never bit) ──
  {
    const swarm = say(`[sheet: op="use" name="Wild Shape" as="Swarm of Spiders"]`);
    assert.equal(swarm.outcomes[0]!.ok, true, swarm.outcomes[0]!.reason);
    const fought = fightWith(swarm.live);
    const one = rookOf(fought);
    assert.equal(one.shape?.name, "Swarm of Spiders");
    assert.ok(
      one.tracked.some((entry) => entry.condition === "swarming" && entry.kept),
      "it shares spaces, as a swarm does",
    );
    assert.deepEqual(one.shape?.keptOn, ["swarming"]);
    assert.ok(!rulesetFightLiveStates(fought).rook?.conditions?.includes("swarming"), "never written to the sheet");
    rulesetLeaveShape(one);
    assert.ok(!one.tracked.some((entry) => entry.condition === "swarming"), "and gives it up with the shape");
  }

  console.log("game-ruleset-kept-form: ok");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
