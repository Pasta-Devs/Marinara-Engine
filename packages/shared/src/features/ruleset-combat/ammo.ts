// What a weapon shoots and what it has loaded, and what using an item spends of it, as a fight counts
// them.
//
// A weapon's `ammo` draws from the items its holder carries with that tag, in the order the bag keeps
// them; its `clip` is a loaded count the weapon keeps on itself. Both are counted on the fighter
// (`itemsUsed`, `loaded`, `recoverable`), keyed by the item's place in the fighter's items, so what a
// step changed can be written back to exactly those inventory stacks.
//
// Pure, like the rest of the fight: each function changes the fighter it is handed and returns the
// event that says so.

import type { GameInventoryJournalEntry } from "../../utils/game-inventory-ops.js";
import {
  GAME_INVENTORY_MAX_QUANTITY,
  gameInventoryDrawPlan,
  newGameInventoryStackId,
  type GameInventoryDrawPlan,
  type GameInventoryStack,
} from "../../utils/game-inventory-stacks.js";
import type { RulesetDefinition } from "../../schemas/ruleset.schema.js";
import type { RulesetItemCallRoll, RulesetSheetItem, RulesetStoredEntry } from "../rulesets/sheet-math.js";
import type {
  RulesetCombatAction,
  RulesetCombatant,
  RulesetCombatMode,
  RulesetDroppedThing,
  RulesetCombatEvent,
  RulesetEncounterState,
} from "./types.js";

/** How many one attack shoots: what its mode says, else what its ammunition says, else one. */
function shotsPer(action: RulesetCombatAction): number {
  return action.shots ?? action.ammo?.per ?? 1;
}

/**
 * An attack made in one of its weapon's modes: named for it, adding what the mode adds to hit (dice
 * in a pool fight), moving a pool fight's per-die target (from the weapon's own, else the pool's),
 * aimed at as many as the mode says, and shooting what one attack in it shoots. Null for a mode the
 * weapon does not have.
 */
export function rulesetModedAction(
  definition: RulesetDefinition,
  action: RulesetCombatAction,
  modeId: string,
): RulesetCombatAction | null {
  const mode = action.modes?.find((entry) => entry.id === modeId);
  if (!mode) return null;
  const poolTarget = definition.resolution.kind === "dice-pool" ? definition.resolution.target.default : undefined;
  const base = action.target ?? poolTarget;
  return {
    ...action,
    label: `${action.label} (${mode.label})`,
    inMode: mode.id,
    ...(mode.toHit !== undefined && action.toHit !== undefined ? { toHit: action.toHit + mode.toHit } : {}),
    ...(mode.target !== undefined && base !== undefined ? { target: base + mode.target } : {}),
    ...(mode.targets !== undefined ? { targets: { ...action.targets, count: mode.targets } } : {}),
    // A sequence without the steps its maker left out (1.643).
    ...(mode.skips && action.sequence
      ? {
          sequence: action.sequence.map((step, index) =>
            mode.skips!.includes(index) ? { ...step, skipped: true as const } : step,
          ),
        }
      : {}),
    ...(mode.ammo !== undefined ? { shots: mode.ammo } : {}),
    // How long what it makes lasts, as picked (1.760): Creation's material.
    ...(mode.madeLasts !== undefined && action.makesItems
      ? { makesItems: { ...action.makesItems, lasts: mode.madeLasts } }
      : {}),
    // The familiarity picked (1.670), rolled on as it leaves the fight.
    ...(mode.familiar !== undefined && action.teleport
      ? { teleport: { ...action.teleport, familiar: mode.familiar } }
      : {}),
    // Out of the stack picked (1.657): an Arrow of Slaying.
    ...(mode.ammoFrom !== undefined ? { ammoFrom: mode.ammoFrom } : {}),
    // Its own reach and clauses (1.190): a javelin of lightning's bolt, 4d6 more on a hit.
    ...(mode.range ? { range: { ...mode.range } } : {}),
    ...(mode.plus?.length && action.damage
      ? { damage: { ...action.damage, plus: [...(action.damage.plus ?? []), ...mode.plus] } }
      : {}),
    // The one cure picked (1.204), in place of all of them.
    ...(mode.cure ? cureOnly(mode.cure) : {}),
    // The creature type picked (1.270), remembered by what it puts on: Antipathy/Sympathy.
    ...(mode.kind && action.applies ? { applies: action.applies.map((one) => ({ ...one, kind: mode.kind })) } : {}),
    // The form picked (1.392), taken by whoever what it puts on lands on, none above their cap.
    ...(mode.form && action.applies
      ? {
          applies: action.applies.map((one) => ({
            ...one,
            form: mode.form!,
            ...(action.formCap ? { cap: action.formCap } : {}),
          })),
        }
      : {}),
    // Who is called in this mode (1.394): Conjure Animals' picks.
    ...(mode.call ? { calls: mode.call } : {}),
    // The one of its applies picked (1.448), in place of all of them.
    ...(mode.appliesPick !== undefined && action.applies?.[mode.appliesPick]
      ? { applies: [action.applies[mode.appliesPick]!], appliesOneOf: undefined }
      : {}),
    // What a hit sets off around whoever it hit (1.312): a Hammer of Thunderbolts' clap.
    ...(mode.aroundHit ? { aroundHit: mode.aroundHit } : {}),
    // A contest won takes, and does nothing else (1.692): Telekinesis on a held object.
    ...(mode.takes && action.contested
      ? {
          contested: { ...action.contested, takes: structuredClone(mode.takes) },
          applies: undefined,
          movesTarget: undefined,
          damage: undefined,
        }
      : {}),
    // The damage type named (1.753): Forbiddance's radiant or necrotic.
    ...(mode.damageType && action.damage
      ? {
          damage: {
            ...action.damage,
            ...(mode.plus?.length ? { plus: [...(action.damage.plus ?? []), ...mode.plus] } : {}),
            type: mode.damageType,
          },
        }
      : {}),
  };
}

/** A cure that does one of its cures, narrowed to the one a mode names (1.204). */
function cureOnly(
  cure: NonNullable<RulesetCombatMode["cure"]>,
): Partial<RulesetCombatAction> & { cureOneOf: undefined } {
  return {
    cureOneOf: undefined,
    ends: cure.ends !== undefined ? { conditions: [cure.ends], count: 1 } : undefined,
    tracks: cure.track ? [{ ...cure.track }] : undefined,
    unseals: cure.unseals,
  };
}

/** What is left of an item's charges a weapon spends (1.187, 1.190): as this fight left them, else
 *  as its stack kept them, else full. */
export function rulesetItemChargesLeft(actor: RulesetCombatant, charges: { max: number; item: number }): number {
  return Math.min(
    charges.max,
    actor.charges?.[charges.item] ?? actor.sheet?.items?.[charges.item]?.charges ?? charges.max,
  );
}

/** Whether one of the fighter's items is switched on (1.170): as this fight left it, else as its stack
 *  kept it. Off unless something turned it on. */
export function rulesetItemOn(actor: RulesetCombatant, item: number): boolean {
  return actor.on?.[item] ?? actor.sheet?.items?.[item]?.on === true;
}

/** How many of the items with this tag the fighter still carries; with `plainOnly`, of those that are
 *  not magic ammunition with clauses of their own. */
export function rulesetAmmoLeft(actor: RulesetCombatant, tag: string, plainOnly = false): number {
  let left = 0;
  (actor.sheet?.items ?? []).forEach((held, index) => {
    if (held.item.tags?.includes(tag) && !(plainOnly && held.item.ammoRider))
      left += Math.max(0, held.quantity - (actor.itemsUsed?.[index] ?? 0));
  });
  return left;
}

/** The stack a weapon's holder chose for it to shoot first (2026-10-26), while it still has some of
 *  the weapon's ammunition left; else none, and it shoots in the bag's order. */
export function rulesetAmmoFirst(actor: RulesetCombatant, action: RulesetCombatAction): number | undefined {
  const weapon = rulesetActionItemIndex(action);
  const first = weapon !== undefined ? actor.ammoFirst?.[weapon] : undefined;
  if (first === undefined || !action.ammo) return undefined;
  const held = actor.sheet?.items?.[first];
  return held?.item.tags?.includes(action.ammo.tag) && rulesetStackLeft(actor, first) > 0 ? first : undefined;
}

/**
 * Which ammunition a shot takes first (1.657), lowest first: plain; then one whose clauses of its own
 * reach anybody (an Arrow +1); then one with a clause that reaches only some targets, kept for what
 * it is for (an Arrow of Undead Slaying). Pip, a companion, shot a slaying arrow at a humanoid with
 * four +1 arrows left (laptop 2026-10-26).
 */
export function rulesetAmmoRank(item: {
  ammoRider?: { plus: ReadonlyArray<{ targetIs?: unknown; not?: unknown; marked?: unknown }> };
}): number {
  if (!item.ammoRider) return 0;
  return item.ammoRider.plus.some((clause) => clause.targetIs || clause.not || clause.marked) ? 2 : 1;
}

/** The stack a weapon's next shot comes out of: the one its mode names, else the one its holder chose
 *  to shoot first, else the bag's first with some left by `rulesetAmmoRank`. Undefined for a weapon
 *  that shoots nothing from the bag, or with nothing left. */
export function rulesetNextShotStack(actor: RulesetCombatant, action: RulesetCombatAction): number | undefined {
  if (!action.ammo || action.clip) return undefined;
  if (action.ammoFrom !== undefined) return action.ammoFrom;
  const first = rulesetAmmoFirst(actor, action);
  if (first !== undefined) return first;
  const items = actor.sheet?.items ?? [];
  const tag = action.ammo.tag;
  return items
    .map((_, index) => index)
    .filter((index) => items[index]!.item.tags?.includes(tag) && rulesetStackLeft(actor, index) > 0)
    .sort((a, b) => rulesetAmmoRank(items[a]!.item) - rulesetAmmoRank(items[b]!.item))[0];
}

/** A shot as the ammunition it would be shot with makes it (2026-10-26, for a forecast): with the
 *  clauses of that stack's own (1.657) on its damage, as the blow resolves with them. */
export function rulesetShotAsLoaded(actor: RulesetCombatant, action: RulesetCombatAction): RulesetCombatAction {
  if (!action.ammo?.riders || !action.damage) return action;
  const stack = rulesetNextShotStack(actor, action);
  const rider = stack !== undefined ? action.ammo.riders[String(stack)] : undefined;
  if (!rider) return action;
  return { ...action, damage: { ...action.damage, plus: [...(action.damage.plus ?? []), ...rider.plus] } };
}

/** How many are left of one stack of the fighter's (1.657). */
export function rulesetStackLeft(actor: RulesetCombatant, index: number): number {
  return Math.max(0, (actor.sheet?.items?.[index]?.quantity ?? 0) - (actor.itemsUsed?.[index] ?? 0));
}

/** What a weapon has loaded now: what this fight has left in it, else what its stack kept, else a
 *  full clip, since a weapon nobody has fired yet is loaded. */
export function rulesetLoaded(actor: RulesetCombatant, clip: NonNullable<RulesetCombatAction["clip"]>): number {
  const now = actor.loaded?.[clip.item] ?? actor.sheet?.items?.[clip.item]?.loaded ?? clip.max;
  return Math.max(0, Math.min(clip.max, now));
}

/** How many uses an item has left in a fight: one per item still in its stack where a use takes one,
 *  and otherwise its charges now (what the fight left it, else what its stack kept, else all of them). */
export function rulesetItemUseLeft(actor: RulesetCombatant, use: NonNullable<RulesetCombatAction["itemUse"]>): number {
  const held = actor.sheet?.items?.[use.item];
  if (use.consumes) return Math.max(0, (held?.quantity ?? 0) - (actor.itemsUsed?.[use.item] ?? 0));
  // Its own uses (1.519): as this fight left them, else as its stack kept them, else all of them.
  if (use.ownUses) {
    const { more, max } = use.ownUses;
    const now = actor.usesLeft?.[`${use.item}:${more}`] ?? held?.usesLeft?.[String(more)] ?? max;
    return Math.max(0, Math.min(max, now));
  }
  if (!use.charges) return Number.POSITIVE_INFINITY;
  const now = actor.charges?.[use.item] ?? held?.charges ?? use.charges.max;
  return Math.max(0, Math.min(use.charges.max, now));
}

/** How many times an item has been used on with no charges left since they last came back (1.624):
 *  as this fight left the count, else as its stack kept it (under `usesLeft.o`), else none. */
export function rulesetItemOverused(actor: RulesetCombatant, item: number): number {
  return actor.usesLeft?.[`${item}:o`] ?? actor.sheet?.items?.[item]?.usesLeft?.o ?? 0;
}

/** How many times an item that costs something used again before a rest (1.744) has been used since
 *  its user last took that rest: as this fight left the count, else as its stack kept it (under
 *  `usesLeft.a`), else none. */
export function rulesetItemUsedSinceRest(actor: RulesetCombatant, item: number): number {
  return actor.usesLeft?.[`${item}:a`] ?? actor.sheet?.items?.[item]?.usesLeft?.a ?? 0;
}

/** Whether what an action shoots or loads lets it happen now: an attack needs a shot loaded or
 *  carried, a reload a clip with room in it and, where it loads from the bag, something to load. An
 *  item's use needs one of it left, or the charges it spends. */
export function rulesetShotsAvailable(actor: RulesetCombatant, action: RulesetCombatAction): boolean {
  if (action.itemUse) {
    // Broken, torn or blown apart (1.630), whatever it has left: a Horn of Blasting that exploded.
    if (actor.broken?.[action.itemUse.item]) return false;
    // Used on past its last charge while it holds together (1.624): a Wind Fan.
    if (action.itemUse.charges?.overuse && !action.itemUse.consumes && !action.itemUse.ownUses) return true;
    const left = rulesetItemUseLeft(actor, action.itemUse);
    return action.itemUse.consumes || action.itemUse.ownUses ? left >= 1 : left >= (action.itemUse.charges?.cost ?? 0);
  }
  if (action.kind === "reload") {
    if (!action.clip || rulesetLoaded(actor, action.clip) >= action.clip.max) return false;
    return !action.ammo || rulesetAmmoLeft(actor, action.ammo.tag) > 0;
  }
  const per = shotsPer(action);
  if (action.clip) return rulesetLoaded(actor, action.clip) >= per;
  if (action.ammo) {
    if (action.ammoFrom !== undefined) return rulesetStackLeft(actor, action.ammoFrom) >= per;
    return rulesetAmmoLeft(actor, action.ammo.tag) >= per;
  }
  return true;
}

/** Takes up to `count` of the items with this tag out of the fighter's bag, first stack first, and
 *  notes the share of them that comes back after a won fight. How many were taken. Ammunition goes in
 *  the order of `rulesetAmmoRank` (1.657), and `from` takes out of that stack alone. `first`
 *  is the stack its holder chose to shoot first (2026-10-26), before all the rest. */
function draw(
  actor: RulesetCombatant,
  tag: string,
  count: number,
  recover?: number,
  from?: number,
  first?: number,
): number {
  let wanted = count;
  const items = actor.sheet?.items ?? [];
  const order = items
    .map((_, index) => index)
    .filter((index) => from === undefined || index === from)
    .sort(
      (a, b) =>
        Number(b === first) - Number(a === first) || rulesetAmmoRank(items[a]!.item) - rulesetAmmoRank(items[b]!.item),
    );
  for (const index of order) {
    const held = items[index]!;
    if (wanted <= 0 || !held.item.tags?.includes(tag)) continue;
    const used = actor.itemsUsed?.[index] ?? 0;
    const take = Math.min(wanted, Math.max(0, held.quantity - used));
    if (take <= 0) continue;
    (actor.itemsUsed ??= {})[index] = used + take;
    // Where the shot came from (1.551), for ammunition destroyed as it hits.
    actor.lastShot = index;
    if (recover) {
      const recoverable = (actor.recoverable ??= {});
      recoverable[index] = (recoverable[index] ?? 0) + take * recover;
    }
    wanted -= take;
  }
  return count - wanted;
}

/** One attack's shots, spent: out of the clip where the weapon has one, and otherwise out of the
 *  bag. Null for an action that shoots nothing. */
export function spendRulesetShots(
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  /** More charges spent on it beyond its own (1.269). */
  more = 0,
): RulesetCombatEvent | null {
  if (action.kind === "reload") return null;
  const use = action.itemUse;
  if (use && (use.consumes || use.charges || use.ownUses)) {
    const said = { type: "uses" as const, actorId: actor.id, optionId: action.id, label: action.label };
    // One of its own uses (1.519), never the item's charges.
    if (use.ownUses) {
      const left = Math.max(0, rulesetItemUseLeft(actor, use) - 1);
      (actor.usesLeft ??= {})[`${use.item}:${use.ownUses.more}`] = left;
      return { ...said, left, of: use.ownUses.max };
    }
    if (use.consumes) {
      const quantity = actor.sheet?.items?.[use.item]?.quantity ?? 0;
      (actor.itemsUsed ??= {})[use.item] = (actor.itemsUsed?.[use.item] ?? 0) + 1;
      return { ...said, left: rulesetItemUseLeft(actor, use), of: quantity };
    }
    const left = Math.max(0, rulesetItemUseLeft(actor, use) - use.charges!.cost - more);
    (actor.charges ??= {})[use.item] = left;
    return { ...said, left, of: use.charges!.max };
  }
  const said = { type: "shot" as const, actorId: actor.id, optionId: action.id, label: action.label };
  const per = shotsPer(action);
  if (action.clip) {
    const left = Math.max(0, rulesetLoaded(actor, action.clip) - per);
    (actor.loaded ??= {})[action.clip.item] = left;
    return { ...said, left, of: action.clip.max };
  }
  if (!action.ammo) return null;
  draw(actor, action.ammo.tag, per, action.ammo.recover, action.ammoFrom, rulesetAmmoFirst(actor, action));
  // What is left of the stack it was shot out of, where one was picked, as its label names it. A
  // plain shot counts the plain ammunition only (laptop playtest 2026-10-30: "7 left" with 4 plain
  // arrows and 3 Arrows +1), and a magic stack once it shot one of those, the plain ones being out.
  const shotFrom = actor.lastShot !== undefined ? actor.sheet?.items?.[actor.lastShot] : undefined;
  return {
    ...said,
    left:
      action.ammoFrom !== undefined
        ? rulesetStackLeft(actor, action.ammoFrom)
        : shotFrom?.item.ammoRider
          ? rulesetStackLeft(actor, actor.lastShot!)
          : rulesetAmmoLeft(actor, action.ammo.tag, true),
  };
}

/** A clip filled to its most, out of what it shoots where it loads from the bag: as much as the bag
 *  still holds when that is less. */
export function reloadRulesetClip(actor: RulesetCombatant, action: RulesetCombatAction): RulesetCombatEvent | null {
  const clip = action.clip;
  if (!clip) return null;
  const now = rulesetLoaded(actor, clip);
  const drew = action.ammo
    ? draw(actor, action.ammo.tag, clip.max - now, undefined, undefined, rulesetAmmoFirst(actor, action))
    : undefined;
  const loaded = now + (drew ?? clip.max - now);
  (actor.loaded ??= {})[clip.item] = loaded;
  return {
    type: "reload",
    actorId: actor.id,
    optionId: action.id,
    label: action.label,
    loaded,
    of: clip.max,
    ...(drew !== undefined ? { drew } : {}),
  };
}

/** After a fight the party won: the share of what each of them shot that comes back, stack by stack,
 *  rounded down once for the whole fight. */
export function recoverRulesetAmmo(state: RulesetEncounterState): RulesetCombatEvent[] {
  const events: RulesetCombatEvent[] = [];
  for (const combatant of state.combatants) {
    if (!combatant.recoverable) continue;
    for (const [index, share] of Object.entries(combatant.recoverable)) {
      // A share summed in steps of a fraction may land a hair under the whole number it means.
      const back = Math.min(Math.floor(share + 1e-9), combatant.itemsUsed?.[index] ?? 0);
      if (back <= 0) continue;
      combatant.itemsUsed![index]! -= back;
      events.push({
        type: "recovered",
        actorId: combatant.id,
        label: combatant.sheet?.items?.[Number(index)]?.name ?? "",
        count: back,
      });
    }
    delete combatant.recoverable;
    // Ammunition spent as it struck (1.657), back as the plain ammunition it became: the stack grows.
    for (const [index, share] of Object.entries(combatant.recoverableInto ?? {})) {
      const back = Math.floor(share + 1e-9);
      if (back <= 0) continue;
      (combatant.itemsUsed ??= {})[index] = (combatant.itemsUsed[index] ?? 0) - back;
      events.push({
        type: "recovered",
        actorId: combatant.id,
        label: combatant.sheet?.items?.[Number(index)]?.name ?? "",
        count: back,
      });
    }
    delete combatant.recoverableInto;
  }
  return events;
}

/** An item whose use just spent its last charge rolls its `breaksOn` die, and at or under `atMost` it
 *  breaks: taken off its stack of one, so the fight's write-back removes it. Null when it holds on. */
export function breakRulesetItem(
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  roll: (sides: number) => number,
): RulesetCombatEvent | null {
  const use = action.itemUse;
  const breaks = use?.charges?.breaksOn;
  if (!use?.charges || !breaks || rulesetItemUseLeft(actor, use) > 0 || actor.broken?.[use.item]) return null;
  const face = roll(breaks.die);
  // A high face gives charges back instead (1.271): a Staff of the Magi's 20.
  if (breaks.regains && face >= breaks.regains.atLeast) {
    const amount = breaks.regains.amount;
    const rolls = Array.from({ length: Math.max(0, amount.count) }, () => roll(amount.sides));
    const back = Math.max(0, Math.min(use.charges.max, rolls.reduce((sum, one) => sum + one, 0) + amount.flat));
    (actor.charges ??= {})[use.item] = back;
    return {
      type: "recharged",
      actorId: actor.id,
      optionId: action.id,
      label: action.label,
      roll: face,
      rolls,
      amount: back,
    };
  }
  if (breaks.atMost === undefined || face > breaks.atMost) return null;
  // It becomes another item instead (1.272): a staff of striking's nonmagical quarterstaff, struck
  // and used as that from now on.
  const next = breaks.becomes !== undefined ? actor.becomes?.[use.item] : undefined;
  if (next) {
    const held = actor.sheet?.items?.[use.item];
    if (held && actor.sheet?.items) {
      const { charges: _charges, ...rest } = held;
      actor.sheet.items = actor.sheet.items.map((one, at) =>
        at === use.item ? { ...rest, item: next.item, name: next.name } : one,
      );
    }
    actor.actions = [
      ...actor.actions.filter((one) => rulesetActionItemIndex(one) !== use.item),
      ...structuredClone(next.actions),
    ];
    (actor.became ??= {})[use.item] = next.ref;
    delete actor.charges?.[use.item];
    return {
      type: "broke",
      actorId: actor.id,
      optionId: action.id,
      label: action.label,
      roll: face,
      becomes: next.name,
    };
  }
  (actor.itemsUsed ??= {})[use.item] = (actor.itemsUsed?.[use.item] ?? 0) + 1;
  (actor.broken ??= {})[use.item] = true;
  return { type: "broke", actorId: actor.id, optionId: action.id, label: action.label, roll: face };
}

/**
 * How a fighter draws the item at `index` of what they hold as they use it (Capability API 1.808), with
 * `drawn` the items the fight has drawn or put away since it began (`RulesetCombatant.drawn`): see
 * `gameInventoryDrawPlan`. What a call lends (1.739) and what hovers (1.706) hold no slot.
 */
export function rulesetHeldDrawPlan(
  definition: RulesetDefinition,
  items: readonly RulesetSheetItem[],
  index: number,
  drawn?: Readonly<Record<string, boolean>>,
): GameInventoryDrawPlan {
  return gameInventoryDrawPlan(
    items.map((held, at) => {
      const worn = drawn?.[at] ?? held.worn;
      return {
        slots: held.lent || (held.on && held.item.toggle?.freesSlots) ? {} : (held.item.slots ?? {}),
        quantity: at === index ? 1 : held.quantity,
        worn: !held.lent && worn,
        drawOnUse: held.drawOnUse === true,
        kept: worn && !!held.item.binds?.cursed,
      };
    }),
    index,
    Object.fromEntries((definition.items?.slots ?? []).map((slot) => [slot.id, slot.count])),
  );
}

/** Whether a fighter's held item is in their hands to use (1.808): worn, or drawn as it is used and
 *  either drawn by the fight already or one that could be drawn now. */
export function rulesetHeldReady(
  definition: RulesetDefinition,
  items: readonly RulesetSheetItem[],
  index: number,
  drawn?: Readonly<Record<string, boolean>>,
): boolean {
  const held = items[index];
  if (!held) return false;
  const worn = drawn?.[index] ?? held.worn;
  if (worn) return true;
  // Bound first where it binds: drawing never binds it.
  if (held.drawOnUse !== true || (held.item.binds && !held.bound)) return false;
  return "stow" in rulesetHeldDrawPlan(definition, items, index, drawn);
}

/** What one step of a fight did to one of the party's inventory stacks: how many it took out of it
 *  (fewer than none when a won fight gave some back) and what a weapon has loaded now. */
export interface RulesetFightItemChange {
  stack: { id: string; ref: string; holder?: string };
  /** The stack's own name, for the journal and for a stack made again. */
  name: string;
  taken: number;
  loaded?: number;
  /** What an item with charges holds now. */
  charges?: number;
  /** What a weapon has taken off its damage rolls for good now (1.551), corroded. */
  corroded?: number;
  /** The levels it has ever taken in now (1.571). */
  absorbedEver?: number;
  /** Its rolled call's lasting state now (1.591): an Efreeti Bottle. */
  callRoll?: RulesetItemCallRoll;
  /** The form it is in now (1.575), 0 as it was made, when the fight changed it. */
  form?: number;
  /** What is left of its further uses that count their own (1.519), by place in `moreUses`. */
  usesLeft?: Record<string, number>;
  /** What is stored in it now (1.524), when the fight stored or cast something. */
  storedEntries?: RulesetStoredEntry[];
  /** It broke when its last charge was spent: what was taken is lost, not used. */
  broke?: true;
  /** It became another item when its last charge was spent (1.272): that item, and its name. */
  becomes?: { ref: string; name: string };
  /** A fake's true name (1.79): what a use of it is written as. */
  truly?: string;
  /** Its switch as the fight left it, when the fight turned it (1.170). */
  on?: boolean;
  /** What was made to last only so long has this many minutes left (1.760). */
  vanishesIn?: number;
  /** Drawn as it was used (1.808), true; or put away to make room for another, false. */
  equipped?: boolean;
}

/**
 * What is left of what an opponent had on it as the fight began (1.795), each with how many it still
 * has: a sheet's items as it used them up, a plain block's by the uses its actions have left. What
 * it never had a way to use is all still there. Nothing for one that carried nothing.
 */
export function rulesetCarriedLeft(combatant: RulesetCombatant): Array<{ ref: string; name: string; count: number }> {
  return (combatant.carried ?? []).flatMap((one, index) => {
    const used = combatant.sheet
      ? (combatant.itemsUsed?.[index] ?? 0)
      : `carried:${index}` in (combatant.uses ?? {})
        ? one.count - (combatant.uses[`carried:${index}`] ?? one.count)
        : 0;
    const count = Math.max(0, one.count - used);
    return count > 0 ? [{ ...one, count }] : [];
  });
}

/**
 * What changed of the party's inventory between two states of one fight, stack by stack: every shot,
 * load and share won back since `before`, which is nothing at all when the fight is new. An item the
 * fight was handed without a stack (a test's, or one read from nowhere) is never written anywhere.
 */
export function rulesetFightItemChanges(
  before: RulesetEncounterState | undefined,
  after: RulesetEncounterState,
  roundSeconds?: number,
): RulesetFightItemChange[] {
  const changes: RulesetFightItemChange[] = [];
  for (const combatant of after.combatants) {
    const items = combatant.sheet?.items;
    if (
      combatant.side !== "party" ||
      !items ||
      (!combatant.itemsUsed &&
        !combatant.loaded &&
        !combatant.charges &&
        !combatant.corroded &&
        !combatant.absorbedEver &&
        !combatant.callRolls &&
        !combatant.itemForms &&
        !combatant.usesLeft &&
        !combatant.on &&
        !combatant.became &&
        !combatant.madeFor &&
        !combatant.drawn &&
        !combatant.actions.some((action) => action.storedIn?.item !== undefined))
    ) {
      continue;
    }
    const earlier = before?.combatants.find((entry) => entry.id === combatant.id);
    items.forEach((held, index) => {
      if (!held.stack) return;
      const taken = (combatant.itemsUsed?.[index] ?? 0) - (earlier?.itemsUsed?.[index] ?? 0);
      const loaded = combatant.loaded?.[index];
      const reloaded = loaded !== undefined && loaded !== earlier?.loaded?.[index];
      const charges = combatant.charges?.[index];
      const spent = charges !== undefined && charges !== earlier?.charges?.[index];
      // Corroded further (1.551), since `before`.
      const corroded = combatant.corroded?.[index];
      const rusted = corroded !== undefined && corroded !== (earlier?.corroded?.[index] ?? held.corroded);
      // Changed form (1.575), since `before`.
      const form = combatant.itemForms?.[index];
      const was = earlier ? (earlier.itemForms?.[index] ?? earlier.sheet?.items?.[index]?.form ?? 0) : undefined;
      const reformed = form !== undefined && form !== was;
      // Taken in further (1.571), since `before`.
      const absorbedEver = combatant.absorbedEver?.[index];
      const drank =
        absorbedEver !== undefined && absorbedEver !== (earlier?.absorbedEver?.[index] ?? held.absorbedEver);
      // Its rolled call kept, counted or spent (1.591), since `before`.
      const callRoll = combatant.callRolls?.[index];
      const opened =
        callRoll !== undefined &&
        JSON.stringify(callRoll) !== JSON.stringify(earlier?.callRolls?.[index] ?? held.callRoll ?? {});
      // Its own uses spent (1.519), since `before`.
      const usesLeft = Object.fromEntries(
        Object.entries(combatant.usesLeft ?? {}).flatMap(([key, left]) => {
          const [at, more] = key.split(":");
          return Number(at) === index && left !== earlier?.usesLeft?.[key] ? [[more!, left]] : [];
        }),
      );
      const usesSpent = Object.keys(usesLeft).length > 0;
      // What it stores (1.524), stored or cast since `before`.
      const storedNow = held.item.stores ? rulesetStoredNow(combatant, index) : [];
      const storedBefore = earlier ? rulesetStoredNow(earlier, index) : (held.storedEntries ?? []);
      const restored = !!held.item.stores && JSON.stringify(storedNow) !== JSON.stringify(storedBefore);
      const on = combatant.on?.[index];
      const switched = on !== undefined && on !== (earlier?.on?.[index] ?? held.on === true);
      // Become another item on its last charge (1.272), since `before`.
      const became = combatant.became?.[index];
      const turned = became !== undefined && earlier?.became?.[index] === undefined;
      // What is left of the time what was made lasts (1.760), in minutes, its turns as the fight counts.
      // Several makings on clocks of their own: the stack goes with the soonest of them.
      const batches = held.madeLasting ? combatant.madeFor?.[String(index)] : undefined;
      const madeLeft = batches?.length ? Math.min(...batches.map((batch) => batch.rounds)) : undefined;
      const vanishesIn =
        madeLeft !== undefined ? Math.max(1, Math.ceil((madeLeft * (roundSeconds ?? 6)) / 60)) : undefined;
      const ticked =
        madeLeft !== undefined && JSON.stringify(batches) !== JSON.stringify(earlier?.madeFor?.[String(index)]);
      // Drawn or put away (1.808), since `before`.
      const wornNow = combatant.drawn?.[index];
      const swapped = wornNow !== undefined && wornNow !== (earlier?.drawn?.[index] ?? held.worn);
      if (
        taken === 0 &&
        !reloaded &&
        !spent &&
        !rusted &&
        !drank &&
        !opened &&
        !reformed &&
        !usesSpent &&
        !restored &&
        !switched &&
        !turned &&
        !ticked &&
        !swapped
      ) {
        return;
      }
      // The stack holds what it became from the step after it turned, so later changes name that.
      const ref = earlier?.became?.[index] ?? held.stack.ref;
      changes.push({
        stack: { ...held.stack, ref },
        name: held.name ?? held.stack.ref,
        taken,
        ...(reloaded ? { loaded } : {}),
        ...(spent ? { charges } : {}),
        ...(rusted ? { corroded } : {}),
        ...(drank ? { absorbedEver } : {}),
        ...(opened ? { callRoll } : {}),
        ...(reformed ? { form } : {}),
        ...(usesSpent ? { usesLeft } : {}),
        ...(restored ? { storedEntries: storedNow } : {}),
        ...(switched ? { on } : {}),
        ...(combatant.broken?.[index] && !earlier?.broken?.[index] ? { broke: true as const } : {}),
        ...(turned ? { becomes: { ref: became, name: combatant.sheet?.items?.[index]?.name ?? became } } : {}),
        ...(held.truly ? { truly: held.truly.name } : {}),
        ...(vanishesIn !== undefined ? { vanishesIn } : {}),
        ...(swapped ? { equipped: wornNow } : {}),
      });
    });
  }
  return changes;
}

/**
 * A fight's changes written onto the inventory, by stack id: each stack takes what was shot or loaded
 * out of it (and is gone at none), a weapon keeps what it has loaded, and what a won fight gives back
 * to a stack it had emptied makes that stack again, where it was. Null when the inventory no longer
 * holds what the fight counted on (a stack gone, another item or another bag under its id, or fewer
 * in it than were shot), which the caller refuses the step for, as it does a spent item it cannot
 * find.
 */
export function applyRulesetFightItemChanges(
  stacks: readonly GameInventoryStack[],
  changes: readonly RulesetFightItemChange[],
): { stacks: GameInventoryStack[]; journal: GameInventoryJournalEntry[] } | null {
  let next = [...stacks];
  const journal: GameInventoryJournalEntry[] = [];
  for (const change of changes) {
    const at = next.findIndex((stack) => stack.id === change.stack.id);
    // A fake used is found out (1.79): written by its true name. What is left of it stays as it is, since
    // the fight still holds it by what it passes for.
    if (change.taken > 0) {
      const name = change.truly && !change.broke ? change.truly : change.name;
      journal.push({ item: name, action: change.broke ? "lost" : "used", quantity: change.taken });
    }
    if (change.taken < 0) journal.push({ item: change.name, action: "acquired", quantity: -change.taken });
    if (at < 0) {
      // Only what came back may land where nothing is left: a shot or a load needed the stack.
      if (change.taken >= 0 || change.loaded !== undefined) return null;
      next.push({
        id: change.stack.id,
        name: change.name,
        item: change.stack.ref,
        quantity: Math.min(GAME_INVENTORY_MAX_QUANTITY, -change.taken),
        ...(change.stack.holder !== undefined ? { holder: change.stack.holder } : {}),
        ...(change.vanishesIn !== undefined ? { vanishesIn: change.vanishesIn } : {}),
      });
      continue;
    }
    const stack = next[at]!;
    // Given to somebody else keeps a stack's id, and one fighter's shots never come out of another's bag.
    if (stack.item !== change.stack.ref || stack.holder !== change.stack.holder) return null;
    const quantity = Math.min(GAME_INVENTORY_MAX_QUANTITY, stack.quantity - change.taken);
    if (quantity < 0) return null;
    if (quantity === 0) {
      next = next.filter((_, index) => index !== at);
      continue;
    }
    const { on: wasOn, ...kept } = stack;
    const on = change.on ?? wasOn === true;
    // Become another item (1.272): the stack holds that item now, under its name, with no charges.
    if (change.becomes) {
      const {
        charges: _charges,
        corroded: _corroded,
        absorbedEver: _absorbedEver,
        callRoll: _callRoll,
        form: _form,
        loaded: _loaded,
        usesLeft: _usesLeft,
        storedEntries: _stored,
        ...plain
      } = kept;
      journal.push({ item: stack.name, action: "lost", quantity: 1 });
      journal.push({ item: change.becomes.name, action: "acquired", quantity: 1 });
      next[at] = { ...plain, item: change.becomes.ref, name: change.becomes.name, quantity };
      continue;
    }
    // What it stores (1.524), as the fight left it: nothing kept once it is empty.
    if (change.storedEntries) delete kept.storedEntries;
    // The form it was left in (1.575).
    if (change.form !== undefined) delete kept.form;
    next[at] = {
      ...kept,
      quantity,
      // Kept even empty (1.576), so an item found holding some is not found holding them again.
      ...(change.storedEntries && quantity === 1 ? { storedEntries: change.storedEntries } : {}),
      ...(change.loaded !== undefined ? { loaded: change.loaded } : {}),
      ...(change.charges !== undefined ? { charges: change.charges } : {}),
      ...(change.corroded && quantity === 1 ? { corroded: change.corroded } : {}),
      ...(change.absorbedEver && quantity === 1 ? { absorbedEver: change.absorbedEver } : {}),
      ...(change.callRoll && quantity === 1 ? { callRoll: change.callRoll } : {}),
      ...(change.form && quantity === 1 ? { form: change.form } : {}),
      ...(change.usesLeft && quantity === 1 ? { usesLeft: { ...kept.usesLeft, ...change.usesLeft } } : {}),
      ...(on && quantity === 1 ? { on: true as const } : {}),
      // What was made again lasts as long as the last of it made (1.760).
      ...(change.vanishesIn !== undefined ? { vanishesIn: change.vanishesIn } : {}),
    };
    // Drawn as it was used (1.808), or put away to make room for another: one of a larger stack is
    // drawn into a stack of its own, right after the rest of it.
    if (change.equipped === false) delete next[at]!.equipped;
    if (change.equipped === true && !stack.equipped) {
      if (quantity === 1) next[at] = { ...next[at]!, equipped: true };
      else {
        const one = { ...next[at]!, id: newGameInventoryStackId(next), quantity: 1, equipped: true as const };
        next[at] = { ...next[at]!, quantity: quantity - 1 };
        next.splice(at + 1, 0, one);
      }
    }
  }
  return { stacks: next, journal };
}

/** What an item a combatant holds stores now (1.524), at `item` on their sheet, or what a creature
 *  that stores holds, with no `item`: each stored entry not yet cast, in the order it was stored. */
export function rulesetStoredNow(combatant: RulesetCombatant, item?: number): RulesetStoredEntry[] {
  return combatant.actions.flatMap((action) =>
    action.storedIn && action.storedIn.item === item && (combatant.uses[action.id] ?? 0) > 0
      ? [{ ...action.storedIn.record }]
      : [],
  );
}

/** The option that picks something dropped back up (1.266), followed by what it picks up. */
export const RULESET_PICK_UP_OPTION_PREFIX = "pickup:";
/** Spending more of an item's charges on a use (1.269): `charges:<how many more>`, paid with as a
 *  higher pool is, a step of a higher cost each. */
export const RULESET_CHARGE_STEP_PREFIX = "charges:";

/** How many more charges a payment spends on this action (1.269), or null for a payment of another
 *  kind. Never past what its use allows. */
export function rulesetChargeSteps(action: RulesetCombatAction, payWith: string | undefined): number | null {
  const step = action.itemUse?.charges?.step;
  if (!step || !payWith?.startsWith(RULESET_CHARGE_STEP_PREFIX)) return null;
  const more = Number(payWith.slice(RULESET_CHARGE_STEP_PREFIX.length));
  return Number.isInteger(more) && more > 0 ? Math.min(more, step.max) : 0;
}

/** Paying a use of a pool group out of a worn item's charges, a charge a level (1.572):
 *  `itemslot:<item>:<pool>`, paid at that pool's level as the pool itself would be. */
export const RULESET_ITEM_SLOT_PREFIX = "itemslot:";

/** The item and the pool a payment out of an item's charges stands for (1.572), or null for a payment
 *  of another kind. */
export function rulesetItemSlotPayment(payWith: string | undefined): { item: number; pool: string } | null {
  if (!payWith?.startsWith(RULESET_ITEM_SLOT_PREFIX)) return null;
  const [item, ...pool] = payWith.slice(RULESET_ITEM_SLOT_PREFIX.length).split(":");
  const at = Number(item);
  return Number.isInteger(at) && at >= 0 && pool.length > 0 ? { item: at, pool: pool.join(":") } : null;
}

/** The most charges a held item holds (1.572): its own number, or its stat's; 0 without any. */
export function rulesetHeldChargesMax(held: { item: { charges?: unknown; stats?: Record<string, unknown> } }): number {
  const most = (held.item.charges as { max?: number | { stat: string } } | undefined)?.max;
  const read = typeof most === "number" ? most : most ? held.item.stats?.[most.stat] : undefined;
  return typeof read === "number" && Number.isFinite(read) ? Math.max(0, Math.trunc(read)) : 0;
}

/** Averting the eyes from a gaze's holder, or looking again (1.268): `avert:<holder id>`. */
export const RULESET_AVERT_OPTION_PREFIX = "avert:";
/** Slipping free of a condition (1.486): `slip:<condition>`. */
export const RULESET_SLIP_OPTION_PREFIX = "slip:";
/** An attack given up for one by a creature its maker called (1.488): `lend:<called id>:<action id>`. */
export const RULESET_LEND_OPTION_PREFIX = "lend:";

const ITEM_ACTION = /^(?:item|offhand|use|switch|reload|spend|form|shift|take):(\d+)(?::\d+)?$/;

/** The place in its holder's items of the item an action is made with, when it is one: a weapon's
 *  blow, its off-hand blow, a use, a switch, a reload or charges spent on a hit (1.273). */
export function rulesetActionItemIndex(action: Pick<RulesetCombatAction, "id">): number | undefined {
  const match = ITEM_ACTION.exec(action.id);
  return match ? Number(match[1]) : undefined;
}

/** Whether what an action is made with lies where its holder dropped it (1.266): a held item's
 *  every action, or a stat block's own. */
export function rulesetActionDropped(actor: RulesetCombatant, action: RulesetCombatAction): boolean {
  if (!actor.dropped?.length) return false;
  // A weapon put in hand (1.480), its every attack, though it may still be dismissed.
  const conjured =
    action.kind === "switch"
      ? undefined
      : Object.keys(actor.conjured ?? {}).find((id) => action.id.startsWith(`conjured:${id}:`));
  if (conjured !== undefined) return actor.dropped.some((thing) => thing.key === `conjured:${conjured}`);
  const index = actor.sheet ? rulesetActionItemIndex(action) : undefined;
  const key = index !== undefined ? `item:${index}` : action.id;
  return actor.dropped.some((thing) => thing.key === key);
}

/** The items a fighter holds that do nothing for them now, dropped (1.266), by their place. */
export function rulesetDroppedItems(actor: RulesetCombatant): Set<number> {
  const out = new Set<number>();
  if (!actor.sheet) return out;
  for (const thing of actor.dropped ?? []) {
    if (thing.key.startsWith("item:")) out.add(Number(thing.key.slice("item:".length)));
  }
  return out;
}

/** What a stat block's held things it has let fall (1.267) gave its defense. */
export function rulesetDroppedHeldDefense(actor: RulesetCombatant): number {
  if (!actor.block?.held || !actor.dropped?.length) return 0;
  let lost = 0;
  for (const thing of actor.dropped) {
    if (!thing.key.startsWith("held:")) continue;
    lost += actor.block.held[Number(thing.key.slice("held:".length))]?.defense ?? 0;
  }
  return lost;
}

/** What a fighter would let fall now (1.266): each worn item taking one of `slots` or carrying one of
 *  `tags`, and each of a stat block's actions carrying one of `tags`, that is not down already. */
export function rulesetThingsToDrop(
  actor: RulesetCombatant,
  drops: { slots?: string[]; tags?: string[]; pickUp?: string },
): RulesetDroppedThing[] {
  const down = new Set((actor.dropped ?? []).map((thing) => thing.key));
  const at = typeof actor.x === "number" && typeof actor.y === "number" ? { x: actor.x, y: actor.y } : undefined;
  const out: RulesetDroppedThing[] = [];
  const add = (key: string, label: string) => {
    if (down.has(key)) return;
    down.add(key);
    out.push({ key, label, ...(at ? { at } : {}), ...(drops.pickUp ? { pickUp: drops.pickUp } : {}) });
  };
  if (actor.sheet) {
    (actor.sheet.items ?? []).forEach((held, index) => {
      if (!held.worn) return;
      const slotted = drops.slots?.some((slot) => (held.item.slots?.[slot] ?? 0) > 0);
      const tagged = drops.tags?.some((tag) => held.item.tags?.includes(tag));
      if (!slotted && !tagged) return;
      const named = actor.actions.find((action) => rulesetActionItemIndex(action) === index)?.label;
      add(`item:${index}`, held.name ?? named ?? held.item.category);
    });
    // A weapon put in hand that is no item of theirs (1.480): a pact weapon, which a bound one is not.
    for (const [id, made] of Object.entries(actor.conjured ?? {})) {
      const weapon = actor.conjurable?.[`${id}|${made.mode}`];
      if (!weapon || weapon.bound !== undefined) continue;
      const slotted = drops.slots?.some((slot) => weapon.slots?.includes(slot));
      const tagged = drops.tags?.some((tag) => weapon.tags?.includes(tag));
      if (slotted || tagged) add(`conjured:${id}`, weapon.item);
    }
    return out;
  }
  for (const action of actor.actions) {
    if (drops.tags?.some((tag) => action.qualities?.includes(tag))) add(action.id, action.label);
  }
  // What it holds that is no action (1.267): a printed shield.
  actor.block?.held?.forEach((thing, index) => {
    if (drops.tags?.some((tag) => thing.tags.includes(tag))) add(`held:${index}`, thing.label);
  });
  return out;
}
