/**
 * An item's use that takes longer than a fight lasts (`beforeFight`, Capability API 1.462 on any entry
 * an item use is built from): 5e's Oil of Slipperiness, "Applying the oil takes 10 minutes".
 *
 *   - Never on the fight menu, as its first use or as one of its further uses.
 *   - Set up before the fight, it stands as the fight starts, named as the menu would or by its own
 *     name alone, and spends the oil.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetStandingAtStart,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const doc = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)), "utf8"),
) as Record<string, any>;
const apply = {
  kind: "buff",
  budget: "action",
  range: 5,
  targets: "ally",
  applies: [{ condition: "invisible", duration: { rounds: 100 } }],
  beforeFight: true,
  consumes: true,
};
doc.items = { categories: [{ id: "gear", label: "Gear" }] };
doc.catalogs.push({
  id: "kit",
  label: "Kit",
  holds: "items",
  entries: [
    { id: "oil", label: "Oil of Slipperiness", item: { category: "gear", use: { ...apply, label: "Apply the Oil" } } },
    {
      id: "flask",
      label: "Two-Way Flask",
      item: {
        category: "gear",
        use: {
          kind: "buff",
          budget: "bonus",
          label: "Sip",
          targets: "self",
          applies: [{ condition: "invisible", duration: { rounds: 1 } }],
        },
        moreUses: [{ label: "Coat", use: apply }],
      },
    },
  ],
});
const parsed = parseRulesetDefinition(doc);
assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
const definition = parsed.definition;
const [oil, flask] = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries!.map((entry) => entry.item!);
const start = () =>
  createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "rogue",
        name: "Rogue",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
          fields: { level: 3, ac: 14, speed: 30, hp_max: 20 },
        }),
        items: [
          { item: oil!, quantity: 1, worn: false, name: "Oil of Slipperiness" },
          { item: flask!, quantity: 1, worn: false, name: "Two-Way Flask" },
        ],
      },
      {
        id: "goblin",
        name: "Goblin",
        side: "enemy",
        block: { health: 7, defense: 13, initiativeModifier: 0, speed: 30, actions: [] } as unknown as RulesetStatBlock,
      },
    ],
  });

// ── Never on the fight menu ──
{
  const labels = rulesetCombatOptions(definition, start(), "rogue").map((one) => one.label);
  assert.ok(labels.includes("Two-Way Flask: Sip"), labels.join(", "));
  assert.ok(!labels.some((label) => label.includes("Apply the Oil")), labels.join(", "));
  assert.ok(!labels.some((label) => label.includes("Coat")), labels.join(", "));
}

// ── Set up before the fight, by either name, it stands as the fight starts and spends the oil ──
for (const entry of ["Oil of Slipperiness: Apply the Oil", "Apply the Oil"]) {
  const out = rulesetStandingAtStart(definition, start(), [{ casterId: "rogue", entry, on: ["rogue"] } as never]);
  assert.deepEqual(out.skipped, [], entry);
  const rogue = rulesetCombatant(out.state, "rogue")!;
  assert.ok(rulesetCombatConditions(definition, rogue).includes("invisible"), entry);
  assert.equal(rogue.itemsUsed?.[0], 1, `${entry}: the oil is spent`);
}

console.log(
  "Oil of Slipperiness: an item use set up before a fight is never on its menu, and stands as it starts by either name.",
);
