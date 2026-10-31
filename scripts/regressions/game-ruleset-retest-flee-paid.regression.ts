/**
 * The companion-AI and laptop re-tests of 2026-10-23, the Engine's part outside the AI:
 *
 *   - A fight's summary counts the turns taken, so one left in its first round after somebody acted
 *     is not told as one that never began.
 *   - Damage or a spend the Game Master writes with a `now=` the sheet already reads was already paid
 *     (by the fight it follows): it is not taken twice.
 *   - An item used outside a fight reads its user's maximum with what they wear (an Amulet of Health).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applySheetCommandTags,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetEncounterSummary,
  rulesetItemBook,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(root, path), "utf8");
const parsed = (document: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(document);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const example = () => JSON.parse(readSource("docs/development/ruleset-5e-2014.example.json")) as Record<string, any>;

// ── Turns taken in the first round ──
{
  const definition = parsed(example());
  const block = {
    health: 10,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    actions: [],
  } as unknown as RulesetStatBlock;
  const encounter = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      { id: "ada", name: "Ada", side: "party", block },
      { id: "orc", name: "Orc", side: "enemy", block },
    ],
  });
  encounter.tookTurn = [];
  assert.equal(rulesetEncounterSummary(definition, encounter).turns, 0);
  encounter.tookTurn = ["ada", "orc"];
  const summary = rulesetEncounterSummary(definition, encounter);
  assert.equal(summary.rounds, 1);
  assert.equal(summary.turns, 2);
  // The recap says "during round 1" for it.
  const surface = readSource("packages/client/src/components/game/GameSurface.tsx");
  assert.match(surface, /turns \?\? 0\) > 1/u);
}

// ── Damage the fight already took ──
{
  const definition = parsed(example());
  const build = defaultRulesetSheetBuild(definition);
  build.fields = { ...build.fields, hp_max: 32 };
  const hp = (live: unknown) => readRulesetLive(definition, build, live).pools.find((p) => p.key === "hp")!.value;
  const tell = (text: string, value: number) =>
    applySheetCommandTags(text, {
      definition,
      cards: [{ name: "Isolde Venn", build }],
      playerName: "Isolde Venn",
      live: { "isolde venn": { pools: { hp: { value } } } } as never,
    });
  const again = tell(`[sheet: who="Isolde Venn" op="damage" pool="hp" amount="15" now="17/32"]`, 17);
  assert.equal(hp(again.live["isolde venn"]), 17, `not taken twice: ${JSON.stringify(again)}`);
  const fresh = tell(`[sheet: who="Isolde Venn" op="damage" pool="hp" amount="15" now="17/32"]`, 32);
  assert.equal(hp(fresh.live["isolde venn"]), 17, "taken once from full");
  const plain = tell(`[sheet: who="Isolde Venn" op="damage" pool="hp" amount="5"]`, 17);
  assert.equal(hp(plain.live["isolde venn"]), 12, "without now= it is taken as ever");
}

// ── An item's heal up to a worn maximum ──
{
  const doc = example();
  doc.sheet.live.pools.find((pool: { id: string }) => pool.id === "hp").max = { abilityScore: "con" };
  doc.items = {
    categories: [
      { id: "potion", label: "Potion" },
      { id: "wondrous", label: "Wondrous" },
    ],
    slots: [{ id: "neck", label: "Neck", count: 1 }],
  };
  doc.catalogs.push({
    id: "gear",
    label: "Gear",
    holds: "items",
    entries: [
      {
        id: "healing",
        label: "Potion of Healing",
        item: {
          category: "potion",
          use: { kind: "heal", budget: "action", targets: "self", amount: { flat: 30 }, consumes: true },
        },
      },
      {
        id: "amulet",
        label: "Amulet of Health",
        item: { category: "wondrous", slots: { neck: 1 }, worn: { abilities: { con: { set: 19 } } } },
      },
    ],
  });
  const definition = parsed(doc);
  const book = rulesetItemBook(
    definition,
    Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []])),
  );
  const build = defaultRulesetSheetBuild(definition);
  build.abilities = { ...build.abilities, con: 10 };
  const stacks: GameInventoryStack[] = [
    { id: "p", name: "Potion of Healing", item: "gear/healing", quantity: 1 },
    { id: "a", name: "Amulet of Health", item: "gear/amulet", quantity: 1, equipped: true },
  ];
  const used = useRulesetItemOutsideFight({
    definition,
    itemOf: book.itemOf,
    stacks,
    stackId: "p",
    user: { name: "Ada", build, live: { pools: { hp: { value: 5 } } } },
    roll: () => 1,
  });
  assert.ok(used.ok, JSON.stringify(used));
  const items = [{ item: book.itemOf("gear/amulet")!.entry.item!, quantity: 1, worn: true, name: "Amulet of Health" }];
  assert.equal(
    readRulesetLive(definition, build, used.live, items as never).pools.find((p) => p.key === "hp")!.value,
    19,
    `healed to the worn maximum: ${JSON.stringify(used)}`,
  );
  assert.match(JSON.stringify(used), /19\/19/u, "and the note says so");
}

// ── A companion's orders show while the party panel is closed ──
{
  const controls = readSource("packages/client/src/components/game/CombatAiControls.tsx");
  assert.match(controls, /\{orderLine && <span/u);
  assert.match(
    controls,
    /t\("game\.combat\.ai\.orderSummary", \{ name: member\.name, posture: postureLabel\(member\.orders\) \}\)/u,
  );
}

console.log(
  "Re-tests: turns in a summary, damage already paid, an item's heal up to a worn maximum, and orders in sight.",
);
