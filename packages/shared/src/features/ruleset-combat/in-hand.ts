// What a party member holds in hand in a ruleset fight, and what they may take in hand on their own
// turn (2026-10-26, owner-approved: the fight screen's In hand row), with the ammunition each of their
// weapons shoots first.
//
// The hands are the slots the fighter's weapons take ("hands" in Ember Roads). Taking a carried weapon
// or shield in hand follows the rule an item drawn as it is used follows (1.808, `gameInventoryDrawPlan`):
// it takes its slots, and where they are full the fewest weapons in them are put away to make room.
// Nothing else is ever taken off for it (a buckler, gauntlets, a cursed weapon): then it is refused,
// naming what is in the way. It spends the turn's one free interaction with an object, the one a
// dropped thing is picked up with for nothing (1.266), so a second in one turn is refused.
//
// What it changes is the fighter's `drawn`, which the fight already writes back to the inventory stack
// by stack (`rulesetFightItemChanges`), and the menu is read again from it (`rulesetSyncHeldItems`).
// The ammunition picked is `ammoFirst`, which only changes which stack a shot is taken out of.

import { gameInventoryDrawPlan, type GameInventoryDrawPlan } from "../../utils/game-inventory-stacks.js";
import type { RulesetDefinition } from "../../schemas/ruleset.schema.js";
import type { RulesetSheetItem } from "../rulesets/sheet-math.js";
import {
  rulesetActionItemIndex,
  rulesetAmmoFirst,
  rulesetAmmoRank,
  rulesetHeldDrawPlan,
  rulesetItemOn,
  rulesetStackLeft,
} from "./ammo.js";
import { rulesetSyncHeldItems } from "./encounter.js";
import type { RulesetCombatAction, RulesetCombatant, RulesetCombatEvent } from "./types.js";

/** What a fighter holds in hand and could take in hand, by their items' places. */
export interface RulesetInHand {
  /** The slots their weapons take, with the ruleset's label and how many of each they have. */
  slots: Array<{ id: string; label: string; count: number }>;
  /** What is in those slots now, and how many of them each takes. */
  holding: Array<{ item: number; name: string; takes: number }>;
  /** What they carry that goes in those slots. `blockedBy` names what stands in the way where
   *  nothing could be put away for it, empty when they have too few of a slot at all. */
  carried: Array<{ item: number; name: string; blockedBy?: string[] }>;
  /** Each weapon on their menu that shoots from the bag: the stacks it may shoot, each with how many
   *  are left, and the one it shoots first. */
  ammo: Array<{
    weapon: number;
    name: string;
    first: number;
    stacks: Array<{ item: number; name: string; left: number }>;
  }>;
  /** The turn's free interaction is still theirs: taking something in hand costs nothing more. */
  free: boolean;
}

/** Why something could not be taken in hand: it is no carried weapon or shield of theirs, its slots
 *  are held by what may not be put away for it (`by`, empty with too few of a slot at all), or the
 *  turn's free interaction is already spent. */
export type RulesetDrawRefusal =
  { reason: "not-carried" } | { reason: "slots-full"; by: string[] } | { reason: "interaction-spent" };

/** What an item is called: its stack's name, else its category's label. */
function heldName(definition: RulesetDefinition, held: RulesetSheetItem): string {
  return (
    held.name ??
    definition.items?.categories.find((category) => category.id === held.item.category)?.label ??
    held.item.category
  );
}

/** Whether the item at `index` is on its holder now: as the fight left it, else as it began, and
 *  never while it lies where it was dropped (1.266). */
function wornNow(actor: RulesetCombatant, index: number): boolean {
  const held = actor.sheet?.items?.[index];
  if (!held || held.lent) return false;
  if ((actor.dropped ?? []).some((thing) => thing.key === `item:${index}`)) return false;
  return actor.drawn?.[index] ?? held.worn;
}

/** The slots a fighter's weapons take: their hands. */
function handSlots(items: readonly RulesetSheetItem[]): Set<string> {
  const hands = new Set<string>();
  for (const held of items) {
    if (!held.item.attack || held.lent) continue;
    for (const [slot, count] of Object.entries(held.item.slots ?? {})) if (count > 0) hands.add(slot);
  }
  return hands;
}

/** How many of the hand slots an item takes, 0 for one that takes none of them, or any other slot. */
function handsTaken(held: RulesetSheetItem, hands: ReadonlySet<string>): number {
  const taken = Object.entries(held.item.slots ?? {}).filter(([, count]) => count > 0);
  if (!taken.length || taken.some(([slot]) => !hands.has(slot))) return 0;
  return taken.reduce((sum, [, count]) => sum + count, 0);
}

/** How taking the item at `index` in hand goes: as an item drawn as it is used is drawn (1.808), with
 *  every weapon in the way one that may be put away for it. */
function inHandPlan(definition: RulesetDefinition, actor: RulesetCombatant, index: number): GameInventoryDrawPlan {
  const items = actor.sheet?.items ?? [];
  return gameInventoryDrawPlan(
    items.map((held, at) => {
      const worn = wornNow(actor, at);
      return {
        // Hovering, on (1.706): its hand is free.
        slots: held.lent || (rulesetItemOn(actor, at) && held.item.toggle?.freesSlots) ? {} : (held.item.slots ?? {}),
        quantity: at === index ? 1 : held.quantity,
        worn,
        drawOnUse: held.drawOnUse === true || !!held.item.attack,
        kept: worn && !!held.item.binds?.cursed,
      };
    }),
    index,
    Object.fromEntries((definition.items?.slots ?? []).map((slot) => [slot.id, slot.count])),
  );
}

/** Whether the item at `index` is one the fighter carries and could take in hand: one of it still
 *  theirs, not on, not broken, bound where it binds, and going in their hands. */
function carriedForHand(actor: RulesetCombatant, index: number, hands: ReadonlySet<string>): boolean {
  const held = actor.sheet?.items?.[index];
  if (!held || held.lent || held.made !== undefined || wornNow(actor, index) || actor.broken?.[index]) return false;
  if ((actor.dropped ?? []).some((thing) => thing.key === `item:${index}`)) return false;
  if (held.item.binds && !held.bound) return false;
  return held.quantity - (actor.itemsUsed?.[index] ?? 0) >= 1 && handsTaken(held, hands) > 0;
}

/** The stacks an ammunition tag may be shot from, in the order a shot takes them (`rulesetAmmoRank`),
 *  each with some left. */
function ammoStacks(actor: RulesetCombatant, tag: string): number[] {
  const items = actor.sheet?.items ?? [];
  return items
    .map((_, index) => index)
    .filter((index) => items[index]!.item.tags?.includes(tag) && rulesetStackLeft(actor, index) > 0)
    .sort((a, b) => rulesetAmmoRank(items[a]!.item) - rulesetAmmoRank(items[b]!.item));
}

/** A weapon's blow that shoots from the bag, at its place: its first such action on the menu. */
function shootingAction(actor: RulesetCombatant, weapon: number): RulesetCombatAction | undefined {
  return actor.actions.find(
    (action) =>
      action.kind !== "reload" &&
      action.ammo !== undefined &&
      action.ammoFrom === undefined &&
      rulesetActionItemIndex(action) === weapon &&
      action.id.startsWith("item:"),
  );
}

/** What a sheet fighter holds in hand and could take in hand, with their weapons' ammunition.
 *  Undefined for one with no sheet items, or no weapon to give them hands. */
export function rulesetInHand(definition: RulesetDefinition, actor: RulesetCombatant): RulesetInHand | undefined {
  const items = actor.sheet?.items;
  if (!items?.length) return undefined;
  const hands = handSlots(items);
  if (!hands.size) return undefined;
  const slots = (definition.items?.slots ?? [])
    .filter((slot) => hands.has(slot.id))
    .map((slot) => ({ id: slot.id, label: slot.label, count: slot.count }));
  const holding: RulesetInHand["holding"] = [];
  const carried: RulesetInHand["carried"] = [];
  items.forEach((held, index) => {
    const takes = handsTaken(held, hands);
    if (takes > 0 && wornNow(actor, index)) holding.push({ item: index, name: heldName(definition, held), takes });
    if (!carriedForHand(actor, index, hands)) return;
    const plan = inHandPlan(definition, actor, index);
    carried.push({
      item: index,
      name: heldName(definition, held),
      ...("blockedBy" in plan ? { blockedBy: plan.blockedBy.map((at) => heldName(definition, items[at]!)) } : {}),
    });
  });
  const ammo: RulesetInHand["ammo"] = [];
  const seen = new Set<number>();
  for (const action of actor.actions) {
    const weapon = rulesetActionItemIndex(action);
    if (weapon === undefined || seen.has(weapon) || shootingAction(actor, weapon) !== action) continue;
    seen.add(weapon);
    const order = ammoStacks(actor, action.ammo!.tag);
    if (!order.length) continue;
    ammo.push({
      weapon,
      name: heldName(definition, items[weapon]!),
      first: rulesetAmmoFirst(actor, action) ?? order[0]!,
      stacks: order.map((index) => ({
        item: index,
        name: heldName(definition, items[index]!),
        left: rulesetStackLeft(actor, index),
      })),
    });
  }
  return { slots, holding, carried, ammo, free: !actor.flags.pickedUp };
}

/**
 * The fighter takes the carried item at `index` in hand, on their own turn, for the turn's one free
 * interaction: the fewest weapons in its way are put away, and their menu is read again from what
 * they hold now. The fighter is changed in place; the event says what was taken and put away.
 */
export function rulesetDrawInHand(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  index: number,
): { ok: true; event: RulesetCombatEvent } | ({ ok: false } & RulesetDrawRefusal) {
  const items = actor.sheet?.items ?? [];
  if (!carriedForHand(actor, index, handSlots(items))) return { ok: false, reason: "not-carried" };
  if (actor.flags.pickedUp) return { ok: false, reason: "interaction-spent" };
  const plan = inHandPlan(definition, actor, index);
  if ("blockedBy" in plan)
    return { ok: false, reason: "slots-full", by: plan.blockedBy.map((at) => heldName(definition, items[at]!)) };
  actor.drawn = { ...actor.drawn, [index]: true, ...Object.fromEntries(plan.stow.map((at) => [at, false])) };
  actor.flags.pickedUp = true;
  rulesetSyncHeldItems(definition, actor);
  return {
    ok: true,
    event: {
      type: "drew",
      actorId: actor.id,
      label: heldName(definition, items[index]!),
      stowed: plan.stow.map((at) => heldName(definition, items[at]!)),
    },
  };
}

/**
 * The item at `index`, drawn as it is used (1.808), goes in its user's hands as they use it: taken in
 * hand as `rulesetDrawInHand` takes it, the fewest weapons in its slots put away (playtest 2026-10-26:
 * a Longsword drawn past Shield and Shortsword left all three in hand by the next fight), and the menu
 * read again from what they hold now. It is a free swap, so the turn's free interaction stays theirs.
 * The fighter is changed in place; undefined, and nothing changed, for one already in hand, one not
 * drawn as it is used, or one that could not be drawn (which the menu never offers).
 */
export function rulesetDrawAsUsed(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  index: number,
): Extract<RulesetCombatEvent, { type: "drew" }> | undefined {
  const items = actor.sheet?.items ?? [];
  const held = items[index];
  if (!held?.drawOnUse || held.lent || wornNow(actor, index)) return undefined;
  // In its user's hands: as the In hand row takes it. Anything else (1.808): as the bag draws it.
  const plan = carriedForHand(actor, index, handSlots(items))
    ? inHandPlan(definition, actor, index)
    : rulesetHeldDrawPlan(definition, items, index, actor.drawn);
  if ("blockedBy" in plan) return undefined;
  actor.drawn = { ...actor.drawn, [index]: true, ...Object.fromEntries(plan.stow.map((at) => [at, false])) };
  rulesetSyncHeldItems(definition, actor);
  return {
    type: "drew",
    actorId: actor.id,
    label: heldName(definition, held),
    stowed: plan.stow.map((at) => heldName(definition, items[at]!)),
  };
}

/** The stack at `stack` is what the weapon at `weapon` shoots first from now on. False, and nothing
 *  changed, for a weapon on the fighter's menu that shoots nothing from the bag, or a stack it cannot
 *  shoot. */
export function rulesetChooseAmmo(actor: RulesetCombatant, weapon: number, stack: number): boolean {
  const action = shootingAction(actor, weapon);
  if (!action || !ammoStacks(actor, action.ammo!.tag).includes(stack)) return false;
  actor.ammoFirst = { ...actor.ammoFirst, [weapon]: stack };
  return true;
}
