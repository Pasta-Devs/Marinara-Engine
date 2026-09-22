// The client half of the combat bridge: whose sheet a party combatant reads, what the battle it
// starts is made of, and what its ending writes back. Driven through the REAL exported helpers and
// the REAL example rulesets, so nothing here can agree with a mistake the client also makes.
//
// What it pins: seeding replaces only what the sheet owns and adds its skills without duplicating
// one; the combatant keeps the maximum hit points the Engine gave it and starts at the share of it
// the sheet is at, both on the way in and on the way back; a member with no readable sheet, an
// enemy, and every member of a game whose ruleset has no `battle` block come back untouched, array
// reference included; a card is found by the SAME normalized key live state is stored under, with
// the persona winning a name it shares; write-back merges several members into one live object,
// leaves everybody else's entry alone, and gives back what a battle healed rather than taking it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetSheetBuildSchema,
  type Combatant,
  type CombatSummary,
  type RulesetDefinition,
  type RulesetLiveStates,
} from "../../packages/shared/src/index.js";
import {
  applyRulesetBattleResult,
  rulesetBattleCatalogIds,
  seedRulesetBattleParty,
} from "../../packages/client/src/lib/ruleset-combat-bridge.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

const messages = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;

/** A variant of one of the shipped example files: parse, edit, validate. */
function parsed(text: string, edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, `the example must stay usable: ${result.ok ? "" : result.issues.join("; ")}`);
  return result.definition;
}

const emberText = readSource("docs/examples/rulesets/ember-roads.json");
const ember = parsed(emberText);
const fiveE = parsed(readSource("docs/development/ruleset-5e-2014.example.json"));
const emberEntries = ember.catalogs![0]!.entries!;
const emberCatalogs = { knacks: emberEntries };

/** One card as a game stores it: the name the party knows and the sheet the wizard copied. */
const card = (name: string, build: Record<string, unknown>) => ({
  name,
  rulesetSheet: { v: 1, build: rulesetSheetBuildSchema.parse(build) },
});

/** The knacks rows a player would have picked, exactly as the catalog picker writes them. */
const knackRows = (...ids: string[]) =>
  ids.flatMap((id) =>
    rowsFromCatalogEntry("knacks", emberEntries.find((entry) => entry.id === id)!)
      .filter((row) => row.list === "knacks")
      .map((row) => row.row),
  );

const combatant = (name: string, over: Partial<Combatant> = {}): Combatant => ({
  id: `party-${name.toLowerCase()}`,
  name,
  hp: 80,
  maxHp: 80,
  mp: 12,
  maxMp: 12,
  attack: 14,
  defense: 6,
  speed: 9,
  level: 3,
  side: "player",
  skills: [{ id: "cleave-0", name: "Cleave", type: "attack", mpCost: 8, power: 1.35 }],
  ...over,
});

/** A member as the Engine's summary reports them: on the ENGINE's scale, untouched by default, so
 *  every fight below says what it did to somebody by overriding it. */
const summaryMember = (
  name: string,
  over: Partial<CombatSummary["party"][number]> = {},
): CombatSummary["party"][number] => ({ name, hp: 80, maxHp: 80, ko: false, statusEffects: [], ...over });

// ── Only the catalogs a battle actually reads are asked for ──

assert.deepEqual(rulesetBattleCatalogIds(ember), ["knacks"]);
assert.deepEqual(rulesetBattleCatalogIds(fiveE), [], "a ruleset that ships no catalog asks for nothing");
assert.deepEqual(
  rulesetBattleCatalogIds(parsed(emberText, (doc) => delete doc.battle.skills)),
  [],
  "and neither does one whose battles build no skills from the sheet",
);

// ── Seeding replaces what the sheet owns, and nothing else ──
{
  const cards = [card("Sable", { fields: { toughness: 2 }, lists: { knacks: knackRows("coldfire-toss") } })];
  const live: RulesetLiveStates = { sable: { pools: { grit: { value: 4 }, luck: { value: 1 } } } };
  const before = combatant("Sable");
  const seeded = seedRulesetBattleParty(ember, cards, live, emberCatalogs, [before]);

  const after = seeded.party[0]!;
  assert.deepEqual(
    { hp: after.hp, maxHp: after.maxHp, mp: after.mp, maxMp: after.maxMp },
    // 4 Grit of 6, on the 80 hit points the Engine built this combatant with. The maximum is the
    // Engine's, because the damage the fight deals is the Engine's; energy is an absolute count.
    { hp: 53, maxHp: 80, mp: 1, maxMp: 3 },
  );
  assert.deepEqual(
    { attack: after.attack, defense: after.defense, speed: after.speed, level: after.level, id: after.id },
    { attack: 14, defense: 6, speed: 9, level: 3, id: "party-sable" },
    "attack, defence, speed, level and identity stay the Engine's",
  );
  // The card's own generated skill is still there, with the sheet's knack behind it.
  assert.deepEqual(
    after.skills!.map((skill) => skill.id),
    ["cleave-0", "knacks/coldfire-toss"],
  );
  assert.deepEqual(seeded.seeds, { sable: { hp: 53, maxHp: 80, sheetHp: 4, sheetMaxHp: 6, mp: 1, maxMp: 3 } });
  assert.equal(before.hp, 80, "the combatant handed in is never mutated");

  // A skill the combatant already carries is not added a second time.
  const already = seedRulesetBattleParty(ember, cards, live, emberCatalogs, [
    combatant("Sable", {
      skills: [{ id: "knacks/coldfire-toss", name: "Coldfire Toss", type: "attack", mpCost: 0, power: 1 }],
    }),
  ]);
  assert.deepEqual(
    already.party[0]!.skills!.map((skill) => skill.id),
    ["knacks/coldfire-toss"],
  );

  // A catalog that would not load costs the skills it holds and nothing else.
  const noCatalog = seedRulesetBattleParty(ember, cards, live, {}, [combatant("Sable")]);
  assert.equal(noCatalog.party[0]!.hp, 53);
  assert.deepEqual(
    noCatalog.party[0]!.skills!.map((skill) => skill.id),
    ["cleave-0"],
  );
}

// ── A member the sheets say nothing about is handed back exactly as it came ──
{
  const cards = [card("Sable", { fields: { toughness: 2 } })];
  const stranger = combatant("Rook");
  const enemy = combatant("Husk", { side: "enemy", name: "Sable" });
  const seeded = seedRulesetBattleParty(ember, cards, undefined, emberCatalogs, [stranger, enemy]);
  assert.equal(seeded.party[0], stranger, "no card, no sheet, no change");
  assert.equal(seeded.party[1], enemy, "an enemy has no sheet to read, whatever it is called");
  assert.deepEqual(seeded.seeds, {});

  // A card whose stored sheet this version cannot read is the same as no card at all. The fighter
  // carries the card's own name, so the lookup really does reach the unreadable sheet.
  const sable = combatant("Sable");
  const unreadable = seedRulesetBattleParty(
    ember,
    [{ name: "Sable", rulesetSheet: { v: 1, build: { fields: "not a sheet" } } }],
    undefined,
    emberCatalogs,
    [sable],
  );
  assert.deepEqual(unreadable.seeds, {});
  assert.equal(unreadable.party[0], sable, "an unreadable sheet leaves the fighter untouched");
}

// ── A ruleset with no battle block changes nothing at all ──
{
  const plain = parsed(emberText, (doc) => delete doc.battle);
  const party = [combatant("Sable")];
  const cards = [card("Sable", { fields: { toughness: 2 }, lists: { knacks: knackRows("coldfire-toss") } })];
  const live: RulesetLiveStates = { sable: { pools: { grit: { value: 1 } } } };

  const seeded = seedRulesetBattleParty(plain, cards, live, emberCatalogs, party);
  assert.equal(seeded.party, party, "the very array handed in comes back");
  assert.equal(seeded.party[0], party[0]);
  assert.deepEqual(seeded.seeds, {});
  assert.deepEqual(applyRulesetBattleResult(plain, cards, live, null, [summaryMember("Sable")]), {
    live: null,
    updated: [],
    refused: [],
  });

  // A party nobody on it has a sheet for is handed back the same way.
  const noSheets = seedRulesetBattleParty(ember, [], live, emberCatalogs, party);
  assert.equal(noSheets.party, party);
}

// ── The card is found by the normalized key, and the persona wins a name they share ──
{
  // Two names that are one name once accents and punctuation are folded away, which is the key
  // live state is stored under.
  const cards = [card("Sablé", { fields: { toughness: 3 } }), card("Sable", { fields: { toughness: 1 } })];
  assert.equal(
    readRulesetLive(ember, rulesetSheetBuildSchema.parse({ fields: { toughness: 3 } }), undefined).pools[0]!.max,
    7,
  );

  // Which card answered shows in the seed's own numbers, not on the combatant: maximum hit points
  // are the Engine's whichever sheet was read.
  const anybody = seedRulesetBattleParty(ember, cards, undefined, emberCatalogs, [combatant("  SABLE  ")]);
  assert.equal(anybody.party[0]!.maxHp, 80, "the Engine's maximum is never replaced by a sheet's");
  assert.equal(anybody.seeds.sable!.sheetMaxHp, 7, "with no player named, the first card holding that name answers");
  assert.deepEqual(Object.keys(anybody.seeds), ["sable"], "and it is stored under the key live state uses");

  const player = seedRulesetBattleParty(ember, cards, undefined, emberCatalogs, [combatant("Sable")], "Sable");
  assert.equal(player.seeds.sable!.sheetMaxHp, 5, "the persona's own card wins the name it shares with a party member");
}

// ── Write-back: one live object for the whole game ──
{
  const cards = [card("Sable", { fields: { toughness: 2 } }), card("Rook", { fields: { toughness: 2 } })];
  const live: RulesetLiveStates = {
    sable: { pools: { grit: { value: 4 }, luck: { value: 2 } } },
    rook: { pools: { grit: { value: 6 } } },
    // Somebody who was not in the fight at all.
    wren: { pools: { grit: { value: 1 } }, conditions: ["wounded"] },
  };
  const seeds = seedRulesetBattleParty(ember, cards, live, emberCatalogs, [
    combatant("Sable"),
    combatant("Rook"),
  ]).seeds;

  const written = applyRulesetBattleResult(ember, cards, live, seeds, [
    // 13 hit points of 80 is a sliver of the bar, and a sliver of six Grit is one, never zero.
    summaryMember("Sable", { hp: 13, mp: 0, maxMp: 3 }),
    summaryMember("Rook"),
    // In the fight, but nobody the sheets know.
    summaryMember("Ash", { hp: 3, maxHp: 40 }),
  ]);

  assert.deepEqual(written.updated, ["Sable"], "an untouched member writes nothing, and a stranger cannot");
  assert.deepEqual(written.refused, []);
  assert.deepEqual(written.live, {
    sable: { pools: { grit: { value: 1 }, luck: { value: 0 } } },
    rook: { pools: { grit: { value: 6 } } },
    wren: { pools: { grit: { value: 1 } }, conditions: ["wounded"] },
  });
  assert.deepEqual(live.sable, { pools: { grit: { value: 4 }, luck: { value: 2 } } }, "the stored blob is not touched");

  // Several members at once merge into ONE object, each against their own sheet.
  const both = applyRulesetBattleResult(ember, cards, live, seeds, [
    // 27 of 80 reads back as 2 Grit of 6, and 40 of 80 as 3.
    summaryMember("Sable", { hp: 27, mp: 2, maxMp: 3 }),
    summaryMember("Rook", { hp: 40 }),
  ]);
  assert.deepEqual(both.updated, ["Sable", "Rook"]);
  assert.deepEqual(both.live!.sable!.pools, { grit: { value: 2 }, luck: { value: 2 } });
  assert.deepEqual(both.live!.rook!.pools, { grit: { value: 3 } });
  assert.deepEqual(both.live!.wren, live.wren, "everybody else's entry is carried through untouched");
}

// ── A battle that ended better than it started gives the sheet back what it healed ──
{
  const cards = [card("Sable", { fields: { toughness: 2 } })];
  const live: RulesetLiveStates = { sable: { pools: { grit: { value: 2 } } } };
  const seeds = seedRulesetBattleParty(ember, cards, live, emberCatalogs, [combatant("Sable")]).seeds;
  // The fight began on 2 Grit of 6, which is 27 of the Engine's 80, and ended on 67 of them.
  assert.equal(seeds.sable!.hp, 27);
  const healed = applyRulesetBattleResult(ember, cards, live, seeds, [summaryMember("Sable", { hp: 67 })]);
  assert.deepEqual(healed.live!.sable!.pools, { grit: { value: 5 } });
}

// ── A battle this session never seeded ──
{
  // What a battle restored after a reload looks like: nothing was remembered, and the sheet has not
  // moved since the fight began, so what it holds now is what the fight started from.
  // With nothing remembered, the share the fight began on is recomputed against the maximum the
  // summary still reports for the combatant, so the conversion back has the same scale it went in
  // on: 20 of the sheet's 24 was 50 of the Engine's 60, and 27 of 60 reads back as 11 of 24.
  const cards = [card("Vex", { fields: { hp_max: 24, spellcasting_ability: "wis", slots_max_1: 4, slots_max_2: 2 } })];
  const live: RulesetLiveStates = { vex: { pools: { hp: { value: 20 }, slots_1: { value: 3 } } } };
  const ended = summaryMember("Vex", { hp: 27, maxHp: 60, spellSlots: { "1": 1, "2": 2 } });
  const restored = applyRulesetBattleResult(fiveE, cards, live, null, [ended]);
  assert.deepEqual(restored.updated, ["Vex"]);
  assert.deepEqual(restored.live!.vex!.pools, { hp: { value: 11 }, slots_1: { value: 1 } });

  // A battle this session DID start but seeded nobody in (the live state was not ready) writes
  // nothing at all, rather than measuring the Engine's own numbers against a sheet.
  assert.deepEqual(applyRulesetBattleResult(fiveE, cards, live, {}, [ended]), {
    live: null,
    updated: [],
    refused: [],
  });

  // The remembered seed still wins when there is one: a sheet edited mid-fight keeps that edit, and
  // only the battle's own delta is written on top of it.
  const edited: RulesetLiveStates = { vex: { pools: { hp: { value: 16 }, slots_1: { value: 3 } } } };
  const remembered = applyRulesetBattleResult(
    fiveE,
    cards,
    edited,
    { vex: { hp: 50, maxHp: 60, sheetHp: 20, sheetMaxHp: 24, spellSlots: { "1": 3, "2": 2 } } },
    [ended],
  );
  assert.deepEqual(remembered.live!.vex!.pools, { hp: { value: 7 }, slots_1: { value: 1 } });
}

// ── The honesty line is a localization key, and it exists ──
{
  const source = readSource("packages/client/src/components/game/GameSurface.tsx");
  const keys = [...source.matchAll(/"(game\.ruleset\.battle\.[a-zA-Z0-9_.]+)"/gu)].map((match) => match[1]!);
  assert.ok(keys.length > 0, "the battle bridge's user-facing line was not found in the source");
  for (const key of keys) assert.ok(key in messages, `en.json is missing ${key}`);
  assert.ok(messages["game.ruleset.battle.sheetNotice"]!.includes("{{ruleset}}"), "the notice names the ruleset");
}

// ── The lane stays hooked up ──

assert.match(
  readSource("scripts/regressions/tsconfig.client-lanes.json"),
  /ruleset-combat-bridge-client\.regression\.ts/u,
  "this lane needs DOM-free client types, so the client lint's lane tsconfig must include it",
);

console.log("Ruleset combat bridge client regressions passed.");
