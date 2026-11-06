// Using one of a ruleset's items outside a fight: the Use button and the Game Master's
// `[inventory: action="use"]`.
//
// What the item's `use` does to its user lands on their sheet, with the Engine's dice: health given
// back, temporary points, a pool restored and the conditions it puts on. What it does to somebody
// else is left to the story, since outside a fight nobody else has a place on the board to be hit
// in: the item is still used, and the words say what it does. Either way it takes one off its stack
// or spends its charges, through the same write a fight uses.

import type { GameInventoryJournalEntry } from "../../utils/game-inventory-ops.js";
import {
  drawGameInventoryStack,
  gameInventoryBagKey,
  gameInventoryStackLabel,
  gameInventoryWearMet,
  gameInventoryWearNeeds,
  type GameInventoryItemRules,
  type GameInventoryStack,
} from "../../utils/game-inventory-stacks.js";
import type {
  RulesetCatalogItem,
  RulesetDefinition,
  RulesetItemRechargeRule,
  RulesetSheetBuild,
} from "../../schemas/ruleset.schema.js";
import { applyRulesetFightItemChanges } from "../ruleset-combat/ammo.js";
import { rulesetSheetDead } from "./combat-bridge.js";
import {
  parseRulesetCombatDice,
  rulesetChargesStart,
  rulesetMoreUsesOf,
  rulesetOwnUsesMax,
} from "../ruleset-combat/dice.js";
import { rulesetPoolMaxSuccesses } from "../../schemas/ruleset.schema.js";
import {
  rollRulesetCheckModifiers,
  rulesetCheckEffects,
  rulesetCheckRollMode,
  rulesetCheckSources,
  rulesetItemGateCheck,
  rulesetTierAddsProficiency,
} from "./check-effects.js";
import type { RulesetItemBookEntry } from "./item-book.js";
import { rulesetItemFacts, rulesetItemGateDifficulty, rulesetItemUseDoes, rulesetSheetItems } from "./item-book.js";
import {
  applyRulesetSheetOp,
  evaluateRulesetSheetLive,
  raiseRulesetLiveAbilities,
  readRulesetLive,
  readRulesetWoundPenalty,
  rulesetLiveWithDayClock,
  rulesetLiveWithWornFrom,
  rulesetItemNeedsMet,
  rulesetRecoverPicks,
  type RulesetLiveState,
  type RulesetSheetOp,
} from "./live-state.js";
import {
  resolveRulesetValueRef,
  rulesetCheckAdjust,
  rulesetCheckModifier,
  rulesetSymbolPoolRatings,
  rollSymbolPoolCheck,
  rollDiceHighestCheck,
  rollDicePoolCheck,
  rollDiceSumCheck,
} from "./sheet-math.js";

/** Why an item could not be used. */
export type RulesetItemUseRefusal =
  /** No stack of that id in the bag. */
  | "no-stack"
  /** The stack is a plain item, or one of an item the ruleset no longer has. */
  | "not-ruleset-item"
  /** The item has no `use`. */
  | "no-use"
  /** It takes a slot or binds, and is not worn (and bound). */
  | "not-worn"
  /** None of its charges are left, or not as many as one use spends. */
  | "none-left"
  /** A condition its user holds forbids using it (1.525): Feeblemind's magic items. */
  | "forbidden"
  /** Its user's sheet does not meet what it asks (1.667): a scroll off another class's list. */
  | "needs-unmet"
  /** Its user is dead on their sheet, and it does not bring back the dead. */
  | "dead"
  /** It is drawn as it is used (1.808), and the slots it needs are held by what is not put away for
   *  it (a shield, armor, a cursed weapon), or its user has too few of them at all. */
  | "slots-full";

/** One thing a use did to its user's sheet. */
export interface RulesetItemUsePart {
  kind: "heal" | "temporary" | "restore" | "condition" | "raise" | "harm";
  /** What was rolled and added up, for everything but a condition. */
  amount?: number;
  rolls?: number[];
  /** The pool's or the condition's label. */
  label?: string;
  /** The sheet's own words for where it now stands ("Grit 6/11"). */
  now?: string;
  /** Harm's save, as said ("Constitution save 9 against 13, failed"). */
  save?: string;
}

export interface RulesetItemUseSaid {
  user: string;
  item: string;
  parts: RulesetItemUsePart[];
  /** What it does to somebody else, which the Engine leaves to the story. */
  aimed?: string;
  /** What is left of it: how many in the stack, its charges, or the uses of its own (1.519). */
  left: { count: number } | { charges: number; max: number } | { uses: number; max: number };
  /** It spent its last charge and its `breaksOn` die said it breaks: the face rolled. */
  broke?: number;
  /** It spent its last charge and its `breaksOn` die gave some back (1.271): the face, and how many. */
  recharged?: { roll: number; amount: number };
  /** It spent its last charge and became another item (1.272): that item's name, and the face. */
  becomes?: { name: string; roll: number };
  /** Its gate, when its user rolled one: what was rolled, the total (a pool's successes) against the
   *  difficulty, and whether it passed. Failed, nothing it does happened. */
  gate?: { check: string; total: number; difficulty: number; success: boolean; rolls: number[] };
  /** What its use made (1.745), into its user's bag: a scroll of Goodberry's berries. */
  made?: { name: string; count: number };
  /** Drawn as it was used (1.808): it is on now, and these were put away to make room. */
  drawn?: { stowed: string[] };
  /** Used again before its user rested (1.744): the save they rolled, and what failing it did. */
  again?: { save: string; total: number; difficulty: number; success: boolean; rolls: number[]; harms: string[] };
}

export type RulesetItemUseOutcome =
  | {
      ok: true;
      stacks: GameInventoryStack[];
      journal: GameInventoryJournalEntry[];
      live: RulesetLiveState;
      said: RulesetItemUseSaid;
    }
  | {
      ok: false;
      reason: RulesetItemUseRefusal;
      /** For `slots-full`: what holds the slots it needs, by name (none where its user has too few). */
      heldBy?: string[];
    };

/** What an item's use reads off the ruleset's items to draw it as it is used (1.808): every item, and
 *  the slots every character has. A bound cursed item stays where it is. */
export function rulesetItemDrawRules(
  definition: RulesetDefinition,
  itemOf: (ref: string) => RulesetItemBookEntry | undefined,
): GameInventoryItemRules {
  return {
    itemOf,
    itemNamed: () => undefined,
    offers: () => false,
    actor: "player",
    ...(definition.items?.slots?.length
      ? { slots: definition.items.slots.map(({ id, label, count }) => ({ id, label, count })) }
      : {}),
  };
}

type RulesetItemUseInput = {
  definition: RulesetDefinition;
  itemOf: (ref: string) => RulesetItemBookEntry | undefined;
  stacks: readonly GameInventoryStack[];
  stackId: string;
  user: { name: string; build: RulesetSheetBuild; live: unknown };
  roll: (sides: number) => number;
  /** One of its further uses (1.267), by its place in `moreUses` from 1; its first use without it. */
  more?: number;
  /** How long what it makes lasts (1.760), by its place in `makesItems.lasts` from 1; the first without it. */
  lasts?: number;
};

/**
 * Use the item on one stack, for whoever carries it. `live` is that character's stored live state and
 * `build` their sheet; `roll` throws one die of the given sides. Nothing is changed on a refusal. An
 * item drawn as it is used (1.808) is put on first, as a free swap that puts away the fewest other
 * such items holding its slots, and the use is made with it on; where nothing may be put away to make
 * room it is refused as `slots-full` (laptop v3 2026-10-26: a carried Longbow was never offered).
 */
export function useRulesetItemOutsideFight(input: RulesetItemUseInput): RulesetItemUseOutcome {
  const stack = input.stacks.find((each) => each.id === input.stackId);
  const entry = stack?.item ? input.itemOf(stack.item) : undefined;
  if (!stack || !entry?.drawOnUse || stack.equipped || !entry.entry.item?.use) return useHeldRulesetItem(input);
  const drawn = drawGameInventoryStack(
    [...input.stacks],
    stack.id,
    rulesetItemDrawRules(input.definition, input.itemOf),
  );
  if (!drawn) return { ok: false, reason: "no-stack" };
  if ("refused" in drawn)
    return { ok: false, reason: "slots-full", heldBy: drawn.refused === "hands-full" ? drawn.by : [] };
  const used = useHeldRulesetItem({ ...input, stacks: drawn.stacks, stackId: drawn.id });
  return used.ok ? { ...used, said: { ...used.said, drawn: { stowed: drawn.stowed } } } : used;
}

function useHeldRulesetItem(input: RulesetItemUseInput): RulesetItemUseOutcome {
  const { definition, stacks, user, roll } = input;
  const stack = stacks.find((each) => each.id === input.stackId);
  if (!stack) return { ok: false, reason: "no-stack" };
  const entry = stack.item ? input.itemOf(stack.item) : undefined;
  const item = entry?.entry.item;
  if (!stack.item || !item) return { ok: false, reason: "not-ruleset-item" };
  // One of its further uses, as its own menu choice in a fight is (1.267).
  const chosen = input.more !== undefined ? item.moreUses?.[input.more - 1] : undefined;
  if (input.more !== undefined && (!chosen || (!item.use && !item.moreUsesRolled)))
    return { ok: false, reason: "no-use" };
  const use = chosen?.use ?? item.use;
  if (!use) return { ok: false, reason: "no-use" };
  // How long what it makes lasts (1.760), as its user picked.
  if (input.lasts !== undefined && !use.makesItems?.lasts?.[input.lasts - 1]) return { ok: false, reason: "no-use" };
  // Used while worn where it takes a slot or binds, as a fight uses it; worn means bound too there.
  // One drawn as it is used (1.808) was put on above, where it could be.
  if (!gameInventoryWearMet(stack, gameInventoryWearNeeds(entry!))) return { ok: false, reason: "not-worn" };
  // Bound by somebody who does not meet what it asks, it is not worn; nor used by them (1.667).
  if (item.binds?.needs || item.userNeeds) {
    const bare = evaluateRulesetSheetLive(definition, user.build, user.live);
    if (item.binds?.needs && !rulesetItemNeedsMet(definition, user.build, bare, item.binds.needs, item.binds.needsAny))
      return { ok: false, reason: "not-worn" };
    if (!rulesetItemNeedsMet(definition, user.build, bare, item.userNeeds, item.userNeedsAny))
      return { ok: false, reason: "needs-unmet" };
  }
  // Nor by the dead, unless it brings them back (laptop pass 6 2026-10-26: a Potion of Healing stood
  // up a hero with every death save failed).
  if (
    !use.revives &&
    rulesetSheetDead(
      definition,
      user.build,
      user.live,
      rulesetSheetItems({ itemOf: input.itemOf }, stacks, stack.holder),
    )
  )
    return { ok: false, reason: "dead" };
  // Nor while a condition they hold forbids it (1.525), as a fight keeps it off the menu.
  const holding = readRulesetLive(definition, user.build, user.live).conditions.filter((one) => one.active);
  const forbidding = (definition.combat?.conditions ?? []).some(
    (entry) =>
      !!entry.forbids?.items &&
      holding.some((one) => one.id === entry.condition) &&
      (!entry.forbids.items.tags || entry.forbids.items.tags.some((tag) => item.tags?.includes(tag))),
  );
  if (forbidding) return { ok: false, reason: "forbidden" };
  const facts = rulesetItemFacts(definition, chosen ? { ...item, use } : item).use;
  const max = facts?.charges?.max;
  if (use.charges !== undefined) {
    if (max === undefined) return { ok: false, reason: "none-left" };
    // A stack found with rolled charges (1.573) holds that many until something changes them.
    const now = Math.min(max, stack.charges ?? rulesetChargesStart(facts!.charges!, max, stack.id));
    if (now < use.charges) return { ok: false, reason: "none-left" };
  }
  // Its own uses (1.519), kept on the stack by its place, or another's it spends (1.747).
  const ownPlace = chosen?.usesOf ? rulesetMoreUsesOf(item, chosen) + 1 : input.more;
  if (chosen?.usesOf && !ownPlace) return { ok: false, reason: "no-use" };
  const own = chosen?.usesOf ? item.moreUses![ownPlace! - 1]!.uses : chosen?.uses;
  // Its most, rolled for this stack where it is (1.536).
  const ownMax = own ? rulesetOwnUsesMax(own, stack.id, ownPlace!, item.moreUsesRolled) : undefined;
  const ownNow = own ? Math.min(ownMax!, stack.usesLeft?.[String(ownPlace)] ?? ownMax!) : undefined;
  if (ownNow !== undefined && ownNow < 1) return { ok: false, reason: "none-left" };

  // Its gate first, as a fight rolls it once the item is spent: failed, the item is spent below and
  // nothing it does happens. A difficulty read off a stat the item does not give is a use the Engine
  // cannot make, as a fight leaves it off the menu.
  const gate = rollRulesetItemGate({ ...input, holder: stack.holder, item });
  if (gate === undefined) return { ok: false, reason: "no-use" };
  const works = gate?.success !== false;

  // What it does to its user: a heal or a buff not aimed at the other side, or harm aimed at the
  // user itself (a Potion of Poison drunk). Anything else is for somebody else, and outside a fight
  // that is the story's to tell.
  const onUser = works && (use.kind === "heal" || use.kind === "buff") && use.targets !== "enemy";
  const harmsUser = works && use.kind === "attack" && use.targets === "self";
  let live = user.live;
  const parts: RulesetItemUsePart[] = [];
  const sheetValue = (ref: Parameters<typeof resolveRulesetValueRef>[2]) =>
    Math.trunc(
      resolveRulesetValueRef(
        definition,
        user.build,
        ref,
        evaluateRulesetSheetLive(
          definition,
          user.build,
          live,
          rulesetSheetItems({ itemOf: input.itemOf }, stacks, stack.holder),
        ),
      ),
    );
  const sheetWithin = (bounds: NonNullable<NonNullable<typeof use.applies>[number]["when"]>) => {
    const held = rulesetSheetItems({ itemOf: input.itemOf }, stacks, stack.holder);
    const value = resolveRulesetValueRef(
      definition,
      user.build,
      bounds.value,
      evaluateRulesetSheetLive(definition, user.build, live, held),
    );
    return (
      (bounds.atLeast === undefined || value >= bounds.atLeast) &&
      (bounds.atMost === undefined || value <= bounds.atMost)
    );
  };
  // What they carry counts on the sheet the use writes to (an Amulet of Health's maximum).
  const carried = rulesetSheetItems({ itemOf: input.itemOf }, stacks, stack.holder);
  const write = (op: RulesetSheetOp): string | undefined => {
    const result = applyRulesetSheetOp(definition, user.build, live, op, undefined, carried);
    if (!result.ok) return undefined;
    live = result.live;
    return result.now;
  };
  const rolled = (amount: { dice?: string; flat?: number } | undefined) => {
    if (!amount) return null;
    const dice = amount.dice ? parseRulesetCombatDice(amount.dice) : null;
    if (!dice && amount.flat === undefined) return null;
    const rolls = Array.from({ length: dice?.count ?? 0 }, () => roll(dice!.sides));
    return {
      rolls,
      total: Math.max(0, rolls.reduce((sum, face) => sum + face, 0) + (dice?.flat ?? 0) + (amount.flat ?? 0)),
    };
  };
  if (onUser) {
    const health = definition.combat?.health ?? definition.battle?.health;
    // A pool's own words are only its numbers, so they are said with its name ("Grit 6/11").
    const named = (pool: string, now: string | undefined) =>
      now === undefined
        ? undefined
        : `${definition.sheet.live.pools.find((entry) => entry.id === pool)?.label ?? pool} ${now}`;
    const healed = use.kind === "heal" ? rolled(use.amount) : null;
    // What its holder's sheet adds (1.271): a Staff of Healing's spellcasting modifier.
    const added = healed && use.amountAdd ? sheetValue(use.amountAdd) : 0;
    const heal = healed ? { ...healed, total: Math.max(0, healed.total + (Number.isFinite(added) ? added : 0)) } : null;
    if (heal && health) {
      // A wound track clears one mark, as a heal in a fight does; a pool, or a plain track that fills
      // up (1.383), takes the amount.
      const plainTrack =
        "track" in health && !definition.sheet.live.tracks.find((track) => track.id === health.track)?.kinds;
      const now =
        "track" in health
          ? heal.total > 0
            ? write(
                plainTrack
                  ? { op: "track", track: health.track, by: -heal.total }
                  : { op: "damage", track: health.track, kind: "", amount: -1 },
              )
            : undefined
          : heal.total > 0
            ? named(
                health.pool,
                write({
                  op: "restore",
                  pool: health.pool,
                  amount: heal.total,
                  // A potion tagged magical is a magical heal (1.261), as its use in a fight is.
                  ...(item.tags?.includes("magical") ? { magical: true as const } : {}),
                }),
              )
            : undefined;
      // Only what landed is said: a heal of nothing, or one the sheet refused, says nothing.
      if (now !== undefined) parts.push({ kind: "heal", amount: heal.total, rolls: heal.rolls, now });
    }
    const temporary = rolled(use.temporary);
    if (temporary && health && "pool" in health) {
      const now =
        temporary.total > 0
          ? named(health.pool, write({ op: "temp", pool: health.pool, amount: temporary.total }))
          : undefined;
      // A pool with no temporary buffer takes none.
      if (now !== undefined) parts.push({ kind: "temporary", amount: temporary.total, rolls: temporary.rolls, now });
    }
    const restore = use.restore ? rolled(use.restore.amount) : null;
    if (restore && use.restore) {
      const now =
        restore.total > 0 ? write({ op: "restore", pool: use.restore.pool, amount: restore.total }) : undefined;
      if (now !== undefined) {
        parts.push({
          kind: "restore",
          amount: restore.total,
          rolls: restore.rolls,
          label: facts?.restore?.pool ?? use.restore.pool,
          now,
        });
      }
    }
    // Spent pools given back (1.656): a Pearl of Power's slot.
    if (use.recovers) {
      for (const pool of rulesetRecoverPicks(definition, user.build, live, use.recovers)) {
        const now = write({ op: "restore", pool, amount: 1 });
        if (now === undefined) continue;
        const label = definition.sheet.live.pools.find((entry) => entry.id === pool)?.label ?? pool;
        parts.push({ kind: "restore", amount: 1, rolls: [], label, now });
      }
    }
    // Abilities raised for good (1.516): a manual read, a tome studied.
    if (use.raises) {
      live = raiseRulesetLiveAbilities(live, use.raises);
      const scores = evaluateRulesetSheetLive(definition, user.build, live).abilityScores;
      for (const [id, raise] of Object.entries(use.raises)) {
        const ability = definition.sheet.abilities.find((entry) => entry.id === id);
        parts.push({ kind: "raise", amount: raise.by, label: ability?.label ?? id, now: String(scores[id]) });
      }
    }
    for (const applies of use.applies ?? []) {
      // Read off the user as it applies (1.167), what came before it included.
      if (applies.when && !sheetWithin(applies.when)) continue;
      if (!write({ op: "condition", condition: applies.condition, active: true })) continue;
      // Kept on while the item is worn (1.664), by its stack.
      const needs = gameInventoryWearNeeds(item);
      if (applies.whileItemWorn && (needs.equipped || needs.bound))
        live = rulesetLiveWithWornFrom(live, applies.condition, stack.id);
      // Its days (1.663), off its user's sheet, or until midnight (1.751), counted as days pass.
      if (applies.lastsDays !== undefined) {
        const ref = applies.lastsDays;
        // Rolled as it goes on (1.756), resting days counting more.
        const days =
          ref === "midnight"
            ? 1
            : typeof ref === "object" && "dice" in ref
              ? (rolled(ref)?.total ?? 0)
              : sheetValue(ref);
        const resting = typeof ref === "object" && "dice" in ref ? ref.restingCounts : undefined;
        if (days >= 1) live = rulesetLiveWithDayClock(live, applies.condition, days, resting);
      }
      const label =
        definition.sheet.live.conditions.find((condition) => condition.id === applies.condition)?.label ??
        applies.condition;
      parts.push({ kind: "condition", label });
    }
  }

  // Harm on its user (2026-10-23 playtest): its save against its difficulty, then its damage (all of it,
  // half or none on a made save, as its onSuccess says) and, failed, what it applies. A Potion of
  // Poison's 3d6 and DC 13.
  if (harmsUser) {
    const health = definition.combat?.health ?? definition.battle?.health;
    let saved = false;
    let saveSaid: string | undefined;
    if (use.save && use.saveDifficulty !== undefined) {
      const held = rulesetSheetItems({ itemOf: input.itemOf }, stacks, stack.holder);
      const evaluated = evaluateRulesetSheetLive(definition, user.build, live, held);
      const save = definition.sheet.saves.find((one) => one.id === use.save!.save);
      const target = save
        ? { type: "save" as const, id: save.id, label: save.label, ...(save.ability ? { ability: save.ability } : {}) }
        : null;
      const modifier =
        Math.trunc(rulesetCheckModifier(evaluated, target)) +
        rulesetCheckAdjust(definition, user.build, evaluated, target);
      const thrown = rollGateOutsideFight(
        definition,
        { build: user.build, live },
        held,
        {
          target,
          modifier,
          difficulty:
            typeof use.saveDifficulty === "number"
              ? use.saveDifficulty
              : Number(item?.stats?.[use.saveDifficulty.stat]) || 0,
        },
        roll,
      );
      saved = thrown.success;
      const named = save?.label ?? use.save.save;
      saveSaid = `${/\bsave$/iu.test(named) ? named : `${named} save`} ${thrown.total} against ${thrown.difficulty}, ${saved ? "made" : "failed"}`;
    }
    const dealt = rolled(use.amount);
    // As a fight reads a save (2026-10-23): "negates" takes nothing, "half" half, and "none" leaves the
    // damage as it is and only keeps off what it applies (a Potion of Poison's 3d6 always lands).
    const amount = dealt
      ? saved
        ? use.save?.onSuccess === "half"
          ? Math.floor(dealt.total / 2)
          : use.save?.onSuccess === "negates"
            ? 0
            : dealt.total
        : dealt.total
      : 0;
    if (dealt && health && amount > 0) {
      const now =
        "track" in health
          ? write({ op: "damage", track: health.track, kind: "", amount: 1 })
          : write({ op: "damage", pool: health.pool, amount });
      if (now !== undefined) {
        const pool = "pool" in health ? health.pool : health.track;
        const label = definition.sheet.live.pools.find((entry) => entry.id === pool)?.label ?? pool;
        parts.push({
          kind: "harm",
          amount,
          rolls: dealt.rolls,
          ...(use.damageType ? { label: use.damageType } : {}),
          now: "pool" in health ? `${label} ${now}` : now,
          ...(saveSaid ? { save: saveSaid } : {}),
        });
      }
    } else if (saveSaid) parts.push({ kind: "harm", amount: 0, rolls: dealt?.rolls ?? [], save: saveSaid });
    if (!saved)
      for (const applies of use.applies ?? []) {
        if (applies.when && !sheetWithin(applies.when)) continue;
        if (!write({ op: "condition", condition: applies.condition, active: true })) continue;
        const label =
          definition.sheet.live.conditions.find((condition) => condition.id === applies.condition)?.label ??
          applies.condition;
        parts.push({ kind: "condition", label });
      }
  }

  // Used again before its user rested (1.744): past the first such use, its save, failed costing them.
  const again = use.againBeforeRest;
  const usedBefore = again ? Math.min(100, stack.usesLeft?.a ?? 0) : 0;
  let againSaid: RulesetItemUseSaid["again"];
  if (again && usedBefore >= 1) {
    const held = rulesetSheetItems({ itemOf: input.itemOf }, stacks, stack.holder);
    const evaluated = evaluateRulesetSheetLive(definition, user.build, live, held);
    const save = definition.sheet.saves.find((one) => one.id === again.save.save);
    const target = save
      ? { type: "save" as const, id: save.id, label: save.label, ...(save.ability ? { ability: save.ability } : {}) }
      : null;
    const modifier =
      Math.trunc(rulesetCheckModifier(evaluated, target)) +
      rulesetCheckAdjust(definition, user.build, evaluated, target);
    const rolled = rollGateOutsideFight(
      definition,
      { build: user.build, live },
      held,
      { target, modifier, difficulty: again.save.difficulty },
      roll,
    );
    const harms: string[] = [];
    if (!rolled.success) {
      for (const moved of again.tracks ?? []) {
        const now = write({ op: "track", track: moved.track, by: moved.by });
        if (now === undefined) continue;
        const label = definition.sheet.live.tracks.find((one) => one.id === moved.track)?.label ?? moved.track;
        harms.push(`${label} ${now}`);
      }
      for (const condition of again.conditions ?? []) {
        if (!write({ op: "condition", condition, active: true })) continue;
        harms.push(definition.sheet.live.conditions.find((one) => one.id === condition)?.label ?? condition);
      }
    }
    againSaid = { save: save?.label ?? again.save.save, ...rolled, harms };
  }
  const usesLeftNow = {
    ...(ownNow !== undefined ? { [String(ownPlace)]: ownNow - 1 } : {}),
    ...(again ? { a: Math.min(100, usedBefore + 1) } : {}),
  };

  // Spent the way a fight spends it, on the stack by its id.
  const charges =
    use.charges !== undefined && max !== undefined ? Math.min(max, stack.charges ?? max) - use.charges : undefined;
  // The last charge spent: an item that may break rolls for it, as it would in a fight.
  const breaks = charges === 0 ? item.charges?.breaksOn : undefined;
  const face = breaks ? roll(breaks.die) : undefined;
  // A high face gives charges back instead (1.271), as it would in a fight.
  const regained =
    breaks?.regains && face !== undefined && face >= breaks.regains.atLeast ? rolled(breaks.regains.amount) : null;
  const recharged = regained && max !== undefined ? { roll: face!, amount: Math.min(max, regained.total) } : undefined;
  const cracked =
    !recharged && breaks?.atMost !== undefined && face !== undefined && face <= breaks.atMost ? face : undefined;
  // Or it becomes another item instead (1.272).
  const turnsInto = cracked !== undefined && breaks?.becomes ? input.itemOf(breaks.becomes) : undefined;
  const becomes = turnsInto && breaks?.becomes ? { ref: breaks.becomes, name: turnsInto.name } : undefined;
  const broke = becomes ? undefined : cracked;
  const after = recharged ? recharged.amount : charges;
  // What it makes (1.745), into its user's bag beside it, as a fight writes what a cast made.
  const makes = works ? use.makesItems : undefined;
  const madeEntry = makes ? input.itemOf(makes.item) : undefined;
  const madeLasts = makes?.lasts?.[(input.lasts ?? 1) - 1]?.minutes;
  // What vanishes is a stack of its own, never one it tops up (1.760).
  const lastingId = (n: number): string =>
    `${stack.id}-made-${makes!.item.replace(/[^a-zA-Z0-9_-]/g, "-")}-lasting-${n}`;
  const madeInto =
    makes && madeEntry && madeLasts !== undefined
      ? lastingId(
          Array.from({ length: stacks.length + 1 }, (_, n) => n + 1).find(
            (n) => !stacks.some((one) => one.id === lastingId(n)),
          )!,
        )
      : makes && madeEntry
        ? (stacks.find(
            (one) => one.item === makes.item && gameInventoryBagKey(one.holder) === gameInventoryBagKey(stack.holder),
          )?.id ?? `${stack.id}-made-${makes.item.replace(/[^a-zA-Z0-9_-]/g, "-")}`)
        : undefined;
  const spent = applyRulesetFightItemChanges(stacks, [
    ...(makes && madeEntry && madeInto
      ? [
          {
            stack: { id: madeInto, ref: makes.item, ...(stack.holder ? { holder: stack.holder } : {}) },
            name: madeEntry.name,
            taken: -makes.count,
            ...(madeLasts !== undefined ? { vanishesIn: madeLasts } : {}),
          },
        ]
      : []),
    {
      stack: { id: stack.id, ref: stack.item, ...(stack.holder ? { holder: stack.holder } : {}) },
      name: stack.name,
      taken: use.consumes || broke !== undefined ? 1 : 0,
      ...(after !== undefined ? { charges: after } : {}),
      ...(Object.keys(usesLeftNow).length > 0 ? { usesLeft: usesLeftNow } : {}),
      ...(broke !== undefined ? { broke: true as const } : {}),
      ...(becomes ? { becomes } : {}),
    },
  ]);
  if (!spent) return { ok: false, reason: "no-stack" };
  // Charges spent write no journal line of their own, so the use is said as one.
  const journal =
    spent.journal.length > 0 ? spent.journal : [{ item: stack.name, action: "used" as const, quantity: 1 }];
  const aimed = works && !onUser && !harmsUser && facts ? rulesetItemUseDoes(facts).join(", ") : undefined;
  return {
    ok: true,
    stacks: spent.stacks,
    journal,
    // A user with no live state yet, whom nothing changed, is still a state (a made save, 2026-10-23).
    live: (live ?? {}) as RulesetLiveState,
    said: {
      user: user.name,
      item: chosen ? `${entry.name}: ${chosen.label}` : entry.name,
      parts,
      ...(aimed ? { aimed } : {}),
      ...(broke !== undefined ? { broke } : {}),
      ...(recharged ? { recharged } : {}),
      ...(becomes ? { becomes: { name: becomes.name, roll: cracked! } } : {}),
      ...(gate ? { gate } : {}),
      ...(againSaid ? { again: againSaid } : {}),
      ...(makes && madeEntry ? { made: { name: madeEntry.name, count: makes.count } } : {}),
      left:
        ownNow !== undefined && own
          ? { uses: ownNow - 1, max: ownMax! }
          : after !== undefined && max !== undefined
            ? { charges: after, max }
            : {
                // Every stack of it in the bag, as the tag's count reads, not this stack alone (5e
                // ship-readiness re-test 2026-10-24: "7 left" beside now="9").
                count: spent.stacks.reduce(
                  (total, one) =>
                    total +
                    (one.item === stack.item && gameInventoryBagKey(one.holder) === gameInventoryBagKey(stack.holder)
                      ? one.quantity
                      : 0),
                  0,
                ),
              },
    },
  };
}

/**
 * The check one of the ruleset's items asks before it works (`gate`), rolled for its user as a check
 * is outside a fight: from the Use button, and when the item is used in the Engine's own Classic and
 * Tactical battles (#6909), which have no dice of the ruleset's own. Null when the item asks none, or
 * its `unless` holds; undefined when its difficulty is read off a stat the item does not give, a use
 * the Engine cannot make. `holder` is the bag whose worn items count toward the check.
 */
/** What an item deals whoever it comes into the hands of (Capability API 1.701), on their sheet
 *  outside a fight: the first of its `touchHarms` lines whose needs they meet, rolled, off their
 *  health pool (or one mark of a wound track's lightest kind). Null when nothing lands. */
export function rulesetItemTouchHarm(input: {
  definition: RulesetDefinition;
  item: RulesetCatalogItem;
  user: { build: RulesetSheetBuild; live: unknown };
  roll: (sides: number) => number;
}): { amount: number; type?: string; rolls: number[]; live: RulesetLiveState; now?: string } | null {
  const { definition, item, user, roll } = input;
  if (!item.touchHarms?.length) return null;
  const evaluated = evaluateRulesetSheetLive(definition, user.build, user.live);
  const line = item.touchHarms.find((one) =>
    rulesetItemNeedsMet(definition, user.build, evaluated, one.needs, one.needsAny),
  );
  const health = definition.combat?.health ?? definition.battle?.health;
  if (!line || !health) return null;
  const dice = line.dice ? parseRulesetCombatDice(line.dice) : null;
  const rolls = Array.from({ length: dice?.count ?? 0 }, () => roll(dice!.sides));
  const amount = Math.max(0, rolls.reduce((sum, face) => sum + face, 0) + (dice?.flat ?? 0) + (line.flat ?? 0));
  if (amount < 1) return null;
  let op: RulesetSheetOp;
  if ("track" in health) {
    const declared = definition.sheet.live.tracks.find((entry) => entry.id === health.track);
    const lightest = [...(declared?.kinds ?? [])].sort((a, b) => a.severity - b.severity)[0];
    if (!lightest) return null;
    op = { op: "damage", track: health.track, kind: lightest.id, amount: 1 };
  } else op = { op: "damage", pool: health.pool, amount };
  const result = applyRulesetSheetOp(definition, user.build, user.live, op);
  if (!result.ok) return null;
  return {
    amount,
    ...(line.type !== undefined ? { type: line.type } : {}),
    rolls,
    live: result.live,
    ...(result.now !== undefined ? { now: result.now } : {}),
  };
}

export function rollRulesetItemGate(input: {
  definition: RulesetDefinition;
  itemOf: (ref: string) => RulesetItemBookEntry | undefined;
  stacks: readonly GameInventoryStack[];
  holder: string | undefined;
  item: RulesetCatalogItem;
  user: { build: RulesetSheetBuild; live: unknown };
  roll: (sides: number) => number;
}): RulesetItemUseSaid["gate"] | null | undefined {
  const { definition, item, user } = input;
  const gate = item.use?.gate;
  if (!gate) return null;
  const difficulty = rulesetItemGateDifficulty(item, gate);
  if (difficulty === undefined) return undefined;
  const held = rulesetSheetItems({ itemOf: input.itemOf }, input.stacks, input.holder);
  const evaluated = evaluateRulesetSheetLive(definition, user.build, user.live, held);
  const ask = rulesetItemGateCheck(definition, user.build, evaluated, gate, difficulty);
  if (!ask) return null;
  const check = rulesetItemFacts(definition, item).use?.gate?.check ?? "";
  return { check, ...rollGateOutsideFight(definition, user, held, ask, input.roll) };
}

/** A check rolled outside a fight as a use's gate is (1.802): a fake's tell or a seller's manner. */
export const rollRulesetCheckOutsideFight = rollGateOutsideFight;

/** A gate rolled as a check is outside a fight: the ruleset's own dice with the sheet's number, the
 *  user's wound penalty and what their conditions and items do to that check, and the lean they give
 *  it. A pool's difficulty is the successes it needs, never fewer than one nor more than it can count. */
function rollGateOutsideFight(
  definition: RulesetDefinition,
  user: { build: RulesetSheetBuild; live: unknown },
  held: ReturnType<typeof rulesetSheetItems>,
  ask: NonNullable<ReturnType<typeof rulesetItemGateCheck>>,
  roll: (sides: number) => number,
  /** A lean the check is made with besides what the sheet gives it (1.802): a tell's `advantageIf`. */
  lean?: "advantage" | "disadvantage",
): Omit<NonNullable<RulesetItemUseSaid["gate"]>, "check"> {
  const resolution = definition.resolution;
  // The sheet as it stands, for what a change reads off it (1.429).
  const evaluated = evaluateRulesetSheetLive(definition, user.build, user.live, held);
  const trained =
    ask.target?.type === "skill" && rulesetTierAddsProficiency(definition, evaluated.skillTiers[ask.target.id]);
  const effects = rulesetCheckEffects(
    rulesetCheckSources(definition, user.build, user.live, held),
    ask.target,
    trained,
  );
  const penalty = resolution.penaltyFrom
    ? readRulesetWoundPenalty(definition, user.build, user.live, resolution.penaltyFrom)
    : 0;
  const modifier =
    ask.modifier +
    penalty +
    rollRulesetCheckModifiers(effects.modifiers, roll, (ref) =>
      resolveRulesetValueRef(definition, user.build, ref, evaluated),
    ).total;
  if (resolution.kind === "dice-pool") {
    const required = Math.min(rulesetPoolMaxSuccesses(resolution), Math.max(1, ask.difficulty));
    const rolled = rollDicePoolCheck(definition, { modifier, required, isSave: false }, roll);
    return { total: rolled.total, difficulty: required, success: rolled.success, rolls: rolled.rolls };
  }
  if (resolution.kind === "dice-highest") {
    const dc = Math.min(resolution.keep * resolution.die.sides, Math.max(1, ask.difficulty));
    const rolled = rollDiceHighestCheck(definition, { modifier, dc, isSave: false }, roll);
    return { total: rolled.total, difficulty: dc, success: rolled.success, rolls: rolled.rolls };
  }
  if (resolution.kind === "symbol-pool") {
    const ratings = rulesetSymbolPoolRatings(
      definition,
      evaluateRulesetSheetLive(definition, user.build, user.live, held),
      ask.target,
    );
    const difficulty = Math.min(resolution.difficulty.max, Math.max(0, ask.difficulty));
    const rolled = rollSymbolPoolCheck(
      definition,
      {
        ...ratings,
        difficulty,
        isSave: false,
        bonusDice: modifier - ratings.ability - ratings.rank,
      },
      roll,
    );
    return { total: rolled.total, difficulty, success: rolled.success, rolls: rolled.rolls };
  }
  const mode = rulesetCheckRollMode(lean ? { [lean]: true } : {}, effects);
  const rolled = rollDiceSumCheck(
    definition,
    {
      modifier,
      dc: ask.difficulty,
      isSave: false,
      advantage: mode === "advantage",
      disadvantage: mode === "disadvantage",
    },
    roll,
  );
  return { total: rolled.total, difficulty: ask.difficulty, success: rolled.success, rolls: rolled.rolls };
}

/** What happened, in one line for the Game Master: "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." */
export function rulesetItemUseLine(said: RulesetItemUseSaid): string {
  const parts = said.parts.map((part) => {
    const now = part.now ? ` (${part.now})` : "";
    if (part.kind === "heal") return `heals ${part.amount}${now}`;
    if (part.kind === "temporary") return `${part.amount} temporary points${now}`;
    if (part.kind === "restore") return `restores ${part.amount} ${part.label}${now}`;
    if (part.kind === "raise") return `raises ${part.label} by ${part.amount} for good${now}`;
    if (part.kind === "harm")
      return `${part.save ? `${part.save}, ` : ""}${part.amount ? `takes ${part.amount}${part.label ? ` ${part.label}` : ""}${now}` : "takes nothing"}`;
    return `${part.label}`;
  });
  const gate = said.gate
    ? `${said.gate.check} check ${said.gate.total} against ${said.gate.difficulty}, ${said.gate.success ? "passed" : "failed"}; `
    : "";
  const again = said.again
    ? `used again before a rest, ${said.again.save} save ${said.again.total} against ${said.again.difficulty}, ${
        said.again.success ? "made" : `failed${said.again.harms.length ? ` (${said.again.harms.join(", ")})` : ""}`
      }; `
    : "";
  const does =
    said.gate?.success === false
      ? "it is used up for nothing"
      : said.aimed
        ? `aimed at somebody else, so nothing was applied: ${said.aimed}`
        : parts.length > 0 || said.made
          ? [...parts, ...(said.made ? [`makes ${said.made.count} ${said.made.name}`] : [])].join(", ")
          : "nothing changed";
  const left =
    said.broke !== undefined
      ? `Its last charge spent, it breaks (a ${said.broke} on its die).`
      : said.becomes
        ? `Its last charge spent, it becomes ${said.becomes.name} (a ${said.becomes.roll} on its die).`
        : said.recharged
          ? `Its last charge spent, it gets ${said.recharged.amount} back (a ${said.recharged.roll} on its die).`
          : "charges" in said.left
            ? `${said.left.charges} of ${said.left.max} charges left.`
            : "uses" in said.left
              ? `${said.left.uses} of ${said.left.max} uses of it left.`
              : said.left.count > 0
                ? `${said.left.count} left.`
                : "None left.";
  const drawn = said.drawn
    ? ` ${said.item} is drawn${said.drawn.stowed.length ? `, and ${said.drawn.stowed.join(", ")} put away` : ""}.`
    : "";
  return `${said.user} uses ${said.item}: ${gate}${again}${does}. ${left}${drawn}`;
}

/** What a rest gave back to one item. */
export interface RulesetItemRecharge {
  item: string;
  now: number;
  max: number;
  /** A further use's own uses (1.519), not the item's charges. */
  uses?: true;
}

/**
 * The charges a rest brings back to the items one character carries: each item in their bag whose
 * `charges.recharge` names that rest regains all of them (`"max"`) or an amount rolled with `roll`,
 * never past its most. A full item is left alone, and a count back at its most is dropped from the
 * stack, which reads as full. `holder` is the bag's, absent for the player's own.
 */
export function rechargeRulesetItems(input: {
  definition: RulesetDefinition;
  itemOf: (ref: string) => RulesetItemBookEntry | undefined;
  stacks: readonly GameInventoryStack[];
  holder: string | undefined;
  rest: string;
  roll: (sides: number) => number;
}): { stacks: GameInventoryStack[]; recharged: RulesetItemRecharge[]; reset: boolean } {
  const bag = gameInventoryBagKey(input.holder);
  const recharged: RulesetItemRecharge[] = [];
  let reset = false;
  const stacks = input.stacks.map((stack) => {
    if (!stack.item || gameInventoryBagKey(stack.holder) !== bag) return stack;
    const entry = input.itemOf(stack.item);
    const item = entry?.entry.item;
    if (!item) return stack;
    const gain = (amount: "max" | { dice?: string; flat?: number }, max: number) => {
      if (amount === "max") return max;
      const dice = amount.dice ? parseRulesetCombatDice(amount.dice) : null;
      const rolls = Array.from({ length: dice?.count ?? 0 }, () => input.roll(dice!.sides));
      return rolls.reduce((sum, face) => sum + face, 0) + (dice?.flat ?? 0) + (amount.flat ?? 0);
    };
    let next = stack;
    // Each further use's own uses (1.519), on the rests its own recharge names.
    item.moreUses?.forEach((more, n) => {
      const own = more.uses;
      const key = String(n + 1);
      if (!own?.recharge?.rests.includes(input.rest)) return;
      // Back to its stack's own count, rolled where it is (1.536).
      const most = rulesetOwnUsesMax(own, stack.id, n + 1, item.moreUsesRolled);
      const before = Math.min(most, next.usesLeft?.[key] ?? most);
      if (before >= most) return;
      const now = Math.max(before, Math.min(most, before + gain(own.recharge.amount, most)));
      if (now === before) return;
      recharged.push({ item: `${entry!.name}: ${more.label}`, now, max: most, uses: true });
      const { [key]: _was, ...others } = next.usesLeft ?? {};
      const usesLeft = now >= most ? others : { ...others, [key]: now };
      const { usesLeft: _usesLeft, ...plain } = next;
      next = Object.keys(usesLeft).length > 0 ? { ...plain, usesLeft } : plain;
    });
    // And each hit's own uses (1.534), under "h" and its place among the spends.
    item.attack?.spends?.forEach((spend, n) => {
      const own = spend.uses;
      const key = `h${n + 1}`;
      if (!own?.recharge?.rests.includes(input.rest)) return;
      const before = Math.min(own.max, next.usesLeft?.[key] ?? own.max);
      if (before >= own.max) return;
      const now = Math.max(before, Math.min(own.max, before + gain(own.recharge.amount, own.max)));
      if (now === before) return;
      recharged.push({ item: `${entry!.name}: ${spend.label}`, now, max: own.max, uses: true });
      const { [key]: _was, ...others } = next.usesLeft ?? {};
      const usesLeft = now >= own.max ? others : { ...others, [key]: now };
      const { usesLeft: _usesLeft, ...plain } = next;
      next = Object.keys(usesLeft).length > 0 ? { ...plain, usesLeft } : plain;
    });
    // Its count of uses since a rest (1.744), cleared by a rest it names.
    const again = [item.use, ...(item.moreUses ?? []).map((more) => more.use)].some((one) =>
      one?.againBeforeRest?.rests.includes(input.rest),
    );
    if (again && next.usesLeft?.a !== undefined) {
      const { a: _a, ...others } = next.usesLeft;
      const { usesLeft: _usesLeft, ...plain } = next;
      next = Object.keys(others).length > 0 ? { ...plain, usesLeft: others } : plain;
      reset = true;
    }
    const recharge = item.charges?.recharge;
    if (!recharge?.rests.includes(input.rest)) return next;
    const facts = rulesetItemFacts(input.definition, item).use?.charges;
    const max = facts?.max;
    if (max === undefined) return next;
    const before = Math.min(max, next.charges ?? rulesetChargesStart(facts!, max, next.id));
    if (before >= max) return next;
    const now = Math.max(before, Math.min(max, before + gain(recharge.amount, max)));
    if (now === before) return next;
    recharged.push({ item: entry!.name, now, max });
    const { charges: _charges, ...rest } = withoutOveruse(next);
    return now >= max ? rest : { ...rest, charges: now };
  });
  return { stacks: recharged.length > 0 || reset ? stacks : [...input.stacks], recharged, reset };
}

/** A stack whose charges came back counts its uses on none from nothing again (1.624). */
function withoutOveruse(stack: GameInventoryStack): GameInventoryStack {
  if (stack.usesLeft?.o === undefined) return stack;
  const { o: _o, ...others } = stack.usesLeft;
  const { usesLeft: _usesLeft, ...plain } = stack;
  return Object.keys(others).length > 0 ? { ...plain, usesLeft: others } : plain;
}

/** How long a wait counted in game time runs, in minutes (1.556), its hours rolled where they are
 *  dice. */
function rulesetItemWaitMinutes(
  after: NonNullable<RulesetItemRechargeRule["after"]>,
  roll: (sides: number) => number,
): number {
  const dice = after.hours?.dice ? parseRulesetCombatDice(after.hours.dice) : null;
  const hours =
    Array.from({ length: dice?.count ?? 0 }, () => roll(dice!.sides)).reduce((sum, face) => sum + face, 0) +
    (dice?.flat ?? 0) +
    (after.hours?.flat ?? 0);
  return Math.max(1, (after.days ?? 0) * 24 * 60 + Math.max(0, hours) * 60);
}

/**
 * What `minutes` of game time passing brings back to the items in every bag (1.556): charges, or a
 * use's own uses, whose `recharge` comes back `after` a wait. A count run out starts waiting the first
 * time game time passes, its wait rolled then; once it has waited it all, it gets back its `amount`
 * (all of them for `"max"`). A count that is no longer out (a rest or the Game Master gave some
 * back) waits no more.
 */
export function passRulesetItemTime(input: {
  definition: RulesetDefinition;
  itemOf: (ref: string) => RulesetItemBookEntry | undefined;
  stacks: readonly GameInventoryStack[];
  minutes: number;
  roll: (sides: number) => number;
}): {
  stacks: GameInventoryStack[];
  recharged: RulesetItemRecharge[];
  changed: boolean;
  /** What vanished as its time ran out (1.760), by what it is called. */
  vanished: Array<{ name: string; count: number; holder?: string }>;
} {
  const recharged: RulesetItemRecharge[] = [];
  let changed = false;
  const minutes = Math.max(0, Math.floor(input.minutes));
  // What was made to vanish counts the time down, and goes once it has run out (1.760): Creation.
  const vanished: Array<{ name: string; count: number; holder?: string }> = [];
  const lasting: GameInventoryStack[] = [];
  for (const stack of input.stacks) {
    if (!stack.vanishesIn || minutes <= 0) {
      lasting.push(stack);
      continue;
    }
    changed = true;
    if (stack.vanishesIn > minutes) lasting.push({ ...stack, vanishesIn: stack.vanishesIn - minutes });
    else
      vanished.push({
        name: gameInventoryStackLabel(stack),
        count: stack.quantity,
        ...(stack.holder ? { holder: stack.holder } : {}),
      });
  }
  const stacks = lasting.map((stack) => {
    if (!stack.item || stack.quantity !== 1) return stack;
    const entry = input.itemOf(stack.item);
    const item = entry?.entry.item;
    if (!item) return stack;
    const counts: Array<{ key: string; rule: RulesetItemRechargeRule; max: number; label: string; uses?: true }> = [];
    const charges = item.charges?.recharge;
    const chargesMax = rulesetItemFacts(input.definition, item).use?.charges?.max;
    if (charges?.after && chargesMax !== undefined)
      counts.push({ key: "charges", rule: charges, max: chargesMax, label: entry!.name });
    item.moreUses?.forEach((more, n) => {
      if (more.uses?.recharge?.after)
        counts.push({
          key: String(n + 1),
          rule: more.uses.recharge,
          max: rulesetOwnUsesMax(more.uses, stack.id, n + 1, item.moreUsesRolled),
          label: `${entry!.name}: ${more.label}`,
          uses: true,
        });
    });
    item.attack?.spends?.forEach((spend, n) => {
      if (spend.uses?.recharge?.after)
        counts.push({
          key: `h${n + 1}`,
          rule: spend.uses.recharge,
          max: spend.uses.max,
          label: `${entry!.name}: ${spend.label}`,
          uses: true,
        });
    });
    if (counts.length === 0 && !stack.waits) return stack;
    let next = stack;
    const waits = { ...(stack.waits ?? {}) };
    // What its call still keeps out past a fight (1.612): a wait from its departure starts after it.
    const roundSeconds = input.definition.combat?.roundSeconds;
    const outRounds = stack.callRoll?.outRounds ?? 0;
    const stayMinutes = roundSeconds && outRounds > 0 ? Math.ceil((outRounds * roundSeconds) / 60) : 0;
    const stayed = Math.min(stayMinutes, minutes);
    if (stayMinutes > 0) {
      const { outRounds: _out, ...rest } = next.callRoll ?? {};
      const left = Math.ceil(((stayMinutes - stayed) * 60) / roundSeconds!);
      const callRoll = left > 0 ? { ...rest, outRounds: left } : rest;
      const { callRoll: _was, ...plain } = next;
      next = Object.keys(callRoll).length > 0 ? { ...plain, callRoll } : plain;
    }
    for (const count of counts) {
      const left = Math.min(
        count.max,
        (count.key === "charges" ? next.charges : next.usesLeft?.[count.key]) ?? count.max,
      );
      if (left > 0) {
        delete waits[count.key];
        continue;
      }
      const wait = waits[count.key] ?? { waited: 0, for: rulesetItemWaitMinutes(count.rule.after!, input.roll) };
      // Counted only from the departure of what it called (1.612).
      const passing = count.rule.after?.fromDeparture ? minutes - stayed : minutes;
      if (passing <= 0) continue;
      const waited = Math.min(wait.for, wait.waited + passing);
      if (waited < wait.for) {
        waits[count.key] = { waited, for: wait.for };
        continue;
      }
      delete waits[count.key];
      const amount = count.rule.amount;
      const dice = amount !== "max" && amount.dice ? parseRulesetCombatDice(amount.dice) : null;
      const gained =
        amount === "max"
          ? count.max
          : Array.from({ length: dice?.count ?? 0 }, () => input.roll(dice!.sides)).reduce(
              (sum, face) => sum + face,
              0,
            ) +
            (dice?.flat ?? 0) +
            (amount.flat ?? 0);
      const now = Math.max(0, Math.min(count.max, gained));
      if (now === 0) continue;
      recharged.push({ item: count.label, now, max: count.max, ...(count.uses ? { uses: true as const } : {}) });
      if (count.key === "charges") {
        const { charges: _charges, ...rest } = withoutOveruse(next);
        next = now >= count.max ? rest : { ...rest, charges: now };
      } else {
        const { [count.key]: _was, ...others } = next.usesLeft ?? {};
        const usesLeft = now >= count.max ? others : { ...others, [count.key]: now };
        const { usesLeft: _usesLeft, ...plain } = next;
        next = Object.keys(usesLeft).length > 0 ? { ...plain, usesLeft } : plain;
      }
    }
    // Only what still waits, and only on what has a wait.
    for (const key of Object.keys(waits)) if (!counts.some((count) => count.key === key)) delete waits[key];
    const { waits: _waits, ...plain } = next;
    const after = Object.keys(waits).length > 0 ? { ...plain, waits } : plain;
    if (JSON.stringify(after) === JSON.stringify(stack)) return stack;
    changed = true;
    return after;
  });
  return { stacks: changed ? stacks : [...input.stacks], recharged, changed, vanished };
}

/** What vanished, in words for the Game Master (1.760): "Rope (2, Bram's) vanished". */
export function rulesetItemVanishedLine(
  vanished: ReadonlyArray<{ name: string; count: number; holder?: string }>,
): string {
  return vanished
    .map((one) => `${one.name} (${one.count}${one.holder ? `, ${one.holder}'s` : ""}) vanished`)
    .join(", ");
}

/** What a rest gave back, in words for the Game Master: "Dawn bell regains its charges (3 of 3)". */
export function rulesetItemRechargeLine(recharged: readonly RulesetItemRecharge[]): string {
  return recharged
    .map((entry) => `${entry.item} regains ${entry.uses ? "uses" : "charges"} (${entry.now} of ${entry.max})`)
    .join(", ");
}
