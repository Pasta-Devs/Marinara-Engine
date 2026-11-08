/**
 * Gear lab: checks Classic Marinara's weapon and armour families against the class lab's budget
 * (2026-10-31). For each archetype, at the middle level of each tier, with expected stats:
 *
 *   - weapons: damage over time of a basic attack with every family the archetype can carry,
 *     against a same-level foe of every archetype, as a share of the tree's standard family
 *     (hit × damage × crit × actions, where actions follow Speed after weight);
 *   - armour: damage taken from same-level attackers in each family, as a share of no armour;
 *   - budget: the standard gear's power next to the lab's level × powerPerLevel.
 *
 *   node packages/server/node_modules/tsx/dist/cli.mjs scripts/class-lab/gear-lab.ts [out.md]
 */
import { writeFileSync } from "node:fs";
import {
  MARINARA_ARCHETYPES,
  expectedMarinaraStats,
  type MarinaraArchetype,
  type MarinaraStats,
} from "../../packages/shared/src/features/marinara-classes.js";
import {
  MARINARA_ARMOUR_FAMILIES,
  MARINARA_STANDARD_GEAR,
  MARINARA_TIERS,
  MARINARA_WEAPON_FAMILIES,
  marinaraGearBonus,
  marinaraStandardEquipment,
  type MarinaraEquipment,
  type MarinaraTier,
} from "../../packages/shared/src/features/marinara-items.js";
import { TUNING } from "./combat.js";

const CASTERS: ReadonlySet<MarinaraArchetype> = new Set(["channeler", "hexer", "mender"]);
const midLevel = (tier: MarinaraTier) => (tier - 1) * 5 + 3;

function withGear(stats: MarinaraStats, equipment: MarinaraEquipment) {
  const bonus = marinaraGearBonus(equipment, { strength: stats.strength });
  const out = { ...stats };
  for (const [stat, value] of Object.entries(bonus.stats)) out[stat as keyof MarinaraStats] += value ?? 0;
  return { stats: out, bonus };
}

/** Expected damage per unit of time of a basic attack (FE math from combat.ts). */
function dps(attacker: MarinaraArchetype, equipment: MarinaraEquipment, level: number, defender: MarinaraArchetype) {
  const { stats, bonus } = withGear(expectedMarinaraStats(attacker, level), equipment);
  const tier = Math.ceil(level / 5) as MarinaraTier;
  const foe = withGear(expectedMarinaraStats(defender, level), marinaraStandardEquipment(defender, tier)).stats;
  const magic = CASTERS.has(attacker);
  const attack = magic ? stats.magic : stats.strength;
  const guard = (magic ? foe.resistance : foe.defense) * (1 - (magic ? 0 : (bonus.effects.pierce ?? 0)));
  const power = TUNING.basicPower + (magic ? bonus.spellPower : bonus.power);
  const damage = Math.max(TUNING.minDamage, attack + power - guard);
  const hit = Math.max(
    25,
    Math.min(
      100,
      TUNING.hitBase + stats.skill * 2 + stats.luck / 2 + (bonus.effects.hit ?? 0) - (foe.speed * 2 + foe.luck),
    ),
  );
  const crit = Math.max(0, Math.min(100, stats.skill / 2 + (bonus.effects.crit ?? 0) - foe.luck));
  const actions = Math.max(1, stats.speed) + TUNING.speedFloor;
  return (hit / 100) * damage * (1 + (crit / 100) * (TUNING.critMultiplier - 1)) * actions;
}

/** Expected damage taken per hit from a same-level attacker using its standard gear. */
function taken(defender: MarinaraArchetype, equipment: MarinaraEquipment, level: number, attacker: MarinaraArchetype) {
  const tier = Math.ceil(level / 5) as MarinaraTier;
  const me = withGear(expectedMarinaraStats(defender, level), equipment).stats;
  const { stats, bonus } = withGear(expectedMarinaraStats(attacker, level), marinaraStandardEquipment(attacker, tier));
  const magic = CASTERS.has(attacker);
  const guard = magic ? me.resistance : me.defense * (1 - (bonus.effects.pierce ?? 0));
  const damage = Math.max(
    1,
    (magic ? stats.magic : stats.strength) + TUNING.basicPower + (magic ? bonus.spellPower : bonus.power) - guard,
  );
  const hit = Math.max(25, Math.min(100, TUNING.hitBase + stats.skill * 2 + stats.luck / 2 - (me.speed * 2 + me.luck)));
  return (hit / 100) * damage;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;
const lines: string[] = ["# Gear lab", ""];

lines.push("## Budget: standard gear power vs the lab's level × powerPerLevel", "");
lines.push(
  "| Tier | Mid level | Lab power | Weapon power | Spell power | Plate Def | Mail Def/Res | Leathers Def/Res | Robes Res |",
);
lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const tier of MARINARA_TIERS) {
  const level = midLevel(tier);
  const blade = marinaraGearBonus(marinaraStandardEquipment("blade", tier));
  const caster = marinaraGearBonus(marinaraStandardEquipment("channeler", tier));
  const armour = (id: string) => marinaraGearBonus({ armor: `${id}-t${tier}` }).stats;
  const mail = armour("mail");
  const leathers = armour("leathers");
  lines.push(
    `| T${tier} | ${level} | ${(level * TUNING.powerPerLevel).toFixed(1)} | ${blade.power} | ${caster.spellPower} | ${armour("plate").defense} | ${mail.defense}/${mail.resistance} | ${leathers.defense}/${leathers.resistance} | ${armour("robes").resistance} |`,
  );
}

lines.push("", "## Weapons: damage over time vs the tree's standard family (100%)", "");
lines.push("Average over every foe archetype; the range is the lowest and highest tier.", "");
lines.push("| Archetype | Family | T1 | T3 | T6 | Range |", "| --- | --- | --- | --- | --- | --- |");
const outliers: string[] = [];
for (const archetype of MARINARA_ARCHETYPES) {
  const standard = MARINARA_STANDARD_GEAR[archetype];
  for (const family of MARINARA_WEAPON_FAMILIES.filter((each) => each.archetypes.includes(archetype))) {
    const ratios = MARINARA_TIERS.map((tier) => {
      const level = midLevel(tier);
      const mine = MARINARA_ARCHETYPES.reduce(
        (sum, foe) =>
          sum + dps(archetype, { weapon: `${family.id}-t${tier}`, armor: `${standard.armour}-t${tier}` }, level, foe),
        0,
      );
      const base = MARINARA_ARCHETYPES.reduce(
        (sum, foe) => sum + dps(archetype, marinaraStandardEquipment(archetype, tier), level, foe),
        0,
      );
      return mine / base;
    });
    const low = Math.min(...ratios);
    const high = Math.max(...ratios);
    if (low < 0.85 || high > 1.15) outliers.push(`${archetype}/${family.id} ${pct(low)}-${pct(high)}`);
    lines.push(
      `| ${archetype} | ${family.id} | ${pct(ratios[0]!)} | ${pct(ratios[2]!)} | ${pct(ratios[5]!)} | ${pct(low)}-${pct(high)} |`,
    );
  }
}

lines.push("", "## Armour: damage taken vs no armour", "");
lines.push("Average per hit from every attacker archetype (casters hit Resistance).", "");
lines.push("| Archetype | Armour | T1 | T3 | T6 |", "| --- | --- | --- | --- | --- |");
for (const archetype of MARINARA_ARCHETYPES) {
  for (const family of MARINARA_ARMOUR_FAMILIES.filter((each) => each.archetypes.includes(archetype))) {
    const ratios = MARINARA_TIERS.map((tier) => {
      const level = midLevel(tier);
      const weapon = marinaraStandardEquipment(archetype, tier).weapon;
      const worn = MARINARA_ARCHETYPES.reduce(
        (sum, foe) => sum + taken(archetype, { weapon, armor: `${family.id}-t${tier}` }, level, foe),
        0,
      );
      const bare = MARINARA_ARCHETYPES.reduce((sum, foe) => sum + taken(archetype, { weapon }, level, foe), 0);
      return worn / bare;
    });
    lines.push(`| ${archetype} | ${family.id} | ${pct(ratios[0]!)} | ${pct(ratios[2]!)} | ${pct(ratios[5]!)} |`);
  }
}

lines.push("", `Weapon outliers (outside 85-115% at some tier): ${outliers.length ? outliers.join("; ") : "none"}`);
const out = process.argv[2];
if (out) writeFileSync(out, `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
