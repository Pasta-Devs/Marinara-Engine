import type { CombatMind, CombatRole } from "../combat-minds.js";
import type { RulesetCombatBehavior, RulesetDefinition } from "../../schemas/ruleset.schema.js";
import { rulesetAbilityScore, rulesetCombatConditions, rulesetCreatureKind } from "./encounter.js";
import type { RulesetCombatant, RulesetEncounterState } from "./types.js";

/**
 * How much thought a combatant puts into a fight (Capability API 1.761), as its own data says: its
 * stat block's `mind`, else its type's (`combat.creatureTypes.types[].mind`), else the tier its
 * `combat.minds` ability score reaches. One that takes legendary actions or has Legendary Resistance
 * is a `genius` where it would be `tactical`. A ruleset that says nothing of minds still knows an
 * animal and a thing that never thinks by the type ids every bestiary uses for them. Undefined when
 * nothing says, and the combatant is played as it always was.
 */
export function rulesetCombatantMind(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
): CombatMind | undefined {
  const own = combatant.block?.mind;
  if (own) return own;
  const kind = rulesetCreatureKind(definition, combatant);
  const types = definition.combat?.creatureTypes?.types ?? [];
  const typed = kind.type !== undefined ? types.find((one) => one.id === kind.type)?.mind : undefined;
  if (typed) return typed;
  const minds = definition.combat?.minds;
  const score = minds ? rulesetAbilityScore(definition, combatant, minds.ability) : undefined;
  let reached: CombatMind | undefined;
  if (minds && score !== undefined) for (const tier of minds.tiers) if (score >= tier.atLeast) reached = tier.mind;
  if (reached === undefined && !types.some((one) => one.mind) && kind.type !== undefined) {
    const id = kind.type.toLowerCase();
    if (id === "beast" || id === "animal") reached = "instinct";
    else if (id === "construct" || id === "ooze") reached = "mindless";
  }
  const legendary =
    combatant.block?.legendaryResistance !== undefined ||
    combatant.signature !== undefined ||
    combatant.actions.some((action) => action.signature !== undefined);
  if (reached === "tactical" && legendary) return "genius";
  return reached;
}

/**
 * Whether it thinks ahead about an opponent's blast (combat AI S1, 2026-10-24): keeping as far from
 * its own side as the blast reaches, no farther, when it deploys and as it closes in. A tactical or a
 * genius one always does, and one nothing gives a mind as it always did; a cunning one only
 * sometimes, about one in three, fixed for the fight by its seed and the combatant's id, so a replay
 * plays the same; an animal or a thing that never thinks never does.
 */
export function rulesetCombatantForesees(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  seed: number,
): boolean {
  const mind = rulesetCombatantMind(definition, combatant);
  if (mind === "mindless" || mind === "instinct") return false;
  if (mind !== "cunning") return true;
  // FNV-1a over the seed and the id: the same goblin in the same fight always decides the same.
  let hash = 0x811c9dc5 ^ (seed >>> 0);
  for (const char of combatant.id) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  return ((hash ^ (hash >>> 12)) >>> 0) % 3 === 0;
}

/**
 * How a combatant goes about a fight (Capability API 1.763), as its own data says: the ruleset's
 * `combat.behavior`, its type's over that, and its stat block's over both, each key on its own.
 * Undefined when nothing says.
 */
export function rulesetCombatantBehavior(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
): RulesetCombatBehavior | undefined {
  const kind = rulesetCreatureKind(definition, combatant);
  const typed =
    kind.type !== undefined
      ? definition.combat?.creatureTypes?.types.find((one) => one.id === kind.type)?.behavior
      : undefined;
  const layers = [definition.combat?.behavior, typed, combatant.block?.behavior].filter(
    (one): one is RulesetCombatBehavior => !!one,
  );
  return layers.length > 0 ? Object.assign({}, ...layers) : undefined;
}

/**
 * Whether an action is a spell, as far as a fight can tell: cast with words, gestures or things
 * (`components`), innately, from an item that casts, or held by concentration. A class feature (Second
 * Wind), a creature's own blow and a torch lit are none of these.
 */
export function rulesetActionIsSpell(action: RulesetCombatant["actions"][number]): boolean {
  return (
    !!action.components?.length ||
    !!action.innate ||
    action.castLevel !== undefined ||
    !!action.casts ||
    !!action.concentration
  );
}

/**
 * What a combatant is for in a fight, read off what it can do, for one whose data names no `role`
 * (combat AI A2): one with moves of its own between turns or legendary resistance a `solo`, one
 * that heals others a `supporter`, one with spells that only put things on people a `controller`,
 * one with spells a `spellcaster`, one whose best blow is a shot a `marksman`, one with a reaction
 * that keeps a friend from harm or turns a blow aside (a Shield Guardian's Shield, a knight's
 * Parry) a `bulwark`, one built to get in and out (a free Disengage or Hide, Flyby, or feet much
 * quicker than its side's on blows no harder than theirs) a `skirmisher`, and anybody else a
 * `bruiser`. Its fight, when given, is what its side's feet and blows are read from.
 */
export function rulesetCombatantRole(
  combatant: RulesetCombatant,
  definition?: RulesetDefinition,
  encounter?: RulesetEncounterState,
): CombatRole {
  if (combatant.signature || (combatant.block?.legendaryResistance ?? 0) > 0) return "solo";
  // Not what a condition would give it: those are on every list, offered only while held, and are no
  // part of what it is (5e's Potion of Animal Friendship would make everybody a controller).
  const actions = combatant.actions.filter((action) => !action.whileHolds);
  if (actions.some((action) => action.heal && action.targets.side !== "self")) return "supporter";
  const spells = actions.filter(rulesetActionIsSpell);
  if (spells.length > 0)
    // Holding people down is putting something on the other side: a ward on itself or a friend is
    // a caster's help, not control.
    return spells.filter(
      (action) =>
        action.applies?.length && !action.damage && action.targets.side !== "ally" && action.targets.side !== "self",
    ).length *
      2 >=
      spells.length
      ? "controller"
      : "spellcaster";
  const average = (action: (typeof actions)[number]) =>
    action.damage ? action.damage.count * ((action.damage.sides + 1) / 2) + action.damage.flat : 0;
  const best = [...actions].filter((action) => action.damage).sort((a, b) => average(b) - average(a))[0];
  if (best?.range && !best.reach) return "marksman";
  // Keeping a friend from harm first, then getting in and out, then turning a blow aside: a rogue's
  // Cunning Action makes it a skirmisher whatever its Uncanny Dodge does.
  if (actions.some((action) => action.reaction?.for === "ally" || action.reaction?.for === "any")) return "bulwark";
  if (actions.some((action) => action.standard?.actions.some((one) => one === "disengage" || one === "hide")))
    return "skirmisher";
  // Turning a blow aside: a reaction to being hit that harms nobody and at most raises its own
  // defence (5e's Parry, a condition worth +2 AC for that one attack).
  const raisesDefense = (condition: string) =>
    !!definition?.combat?.conditions
      ?.find((rule) => rule.condition === condition)
      ?.modifiers?.some((modifier) => modifier.to === "defense" && (modifier.flat ?? 0) > 0);
  if (
    actions.some(
      (action) =>
        action.reaction?.on === "hit" &&
        !action.damage &&
        (action.applies ?? []).every((one) => raisesDefense(one.condition)),
    )
  )
    return "bulwark";
  if (
    definition &&
    rulesetCombatConditions(definition, combatant).some(
      (id) => definition.combat?.conditions?.find((rule) => rule.condition === id)?.flyby,
    )
  )
    return "skirmisher";
  if (encounter) {
    const side = encounter.combatants.filter(
      (one) => one.side === combatant.side && !one.object && one.calledBy === undefined,
    );
    const hardest = (one: RulesetCombatant) =>
      Math.max(0, ...one.actions.filter((action) => !action.whileHolds && action.damage).map(average));
    const feet = side.reduce((sum, one) => sum + one.speed, 0) / Math.max(1, side.length);
    const blows = side.reduce((sum, one) => sum + hardest(one), 0) / Math.max(1, side.length);
    if (side.length > 1 && combatant.speed >= feet * 1.3 && hardest(combatant) <= blows) return "skirmisher";
  }
  return "bruiser";
}
