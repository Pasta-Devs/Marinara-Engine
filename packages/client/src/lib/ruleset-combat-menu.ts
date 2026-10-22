// The rules a ruleset fight's menu is drawn and driven by, with no React in them.
//
// The server sends the only legal menu there is: every option on it can be taken right now, and
// each one lists exactly who it may be pointed at. Nothing here decides legality or does any
// arithmetic; it groups what arrived, spells what an option spends out of the words the option
// carries, and keeps a player's picking inside the option's own list and count.
import type { DirectedRulesetOption, DirectedRulesetView } from "@marinara-engine/shared";
import {
  RULESET_FLY_DOWN_OPTION,
  RULESET_FLY_UP_OPTION,
  RULESET_LAND_OPTION,
  RULESET_TAKE_OFF_OPTION,
  RULESET_MOVE_OPTION,
  RULESET_ZONE_OPTION_PREFIX,
  RULESET_ZONE_TURN_OPTION_PREFIX,
  RULESET_STAND_OPTION,
} from "@marinara-engine/shared";
import type { TFunction } from "i18next";
import { rulesetDistanceText, type RulesetBoardDistance, type RulesetCellChoice } from "./ruleset-combat-board";

/** The order a menu reads in: where you go, what you swing, what you cast, what a stat block can
 *  do, the contests it may start, the moves the kind implements, and finally ending the turn.
 *  Walking comes first because a turn on a board usually starts with it, and it may be taken again
 *  after an action. */
export const RULESET_MENU_KINDS = [
  "move",
  "attack",
  "reload",
  "ability",
  "item",
  "switch",
  "block",
  "contest",
  "standard",
  "end-turn",
] as const;

export type RulesetMenuKind = (typeof RULESET_MENU_KINDS)[number];

/** The Engine's own word for each move a board adds (walking, standing, flying up or down, taking off
 *  and landing), keyed by the resolver's own id.
 *  A key segment is built from the WORD and never from the id, which may carry punctuation a
 *  localization key may not. */
const MOVE_OPTION_WORDS: Record<string, "walk" | "stand" | "flyUp" | "flyDown" | "takeOff" | "land"> = {
  [RULESET_MOVE_OPTION]: "walk",
  [RULESET_STAND_OPTION]: "stand",
  [RULESET_FLY_UP_OPTION]: "flyUp",
  [RULESET_FLY_DOWN_OPTION]: "flyDown",
  [RULESET_TAKE_OFF_OPTION]: "takeOff",
  [RULESET_LAND_OPTION]: "land",
};

/** A half-made choice: deciding what pays for it, where it walks, who it is pointed at, or where
 *  the shape lands. The board holds this while it draws it, so the menu and the board are never
 *  two steps apart. */
export interface RulesetMenuStep {
  stage: "style" | "mode" | "alter" | "pay" | "amount" | "move" | "target" | "aim" | "spare" | "heighten";
  option: DirectedRulesetOption;
  /** The initiative style an attack is made in, where initiative is a number attacks move. */
  style?: string;
  /** The weapon's mode it is made in. */
  mode?: string;
  payWith?: string;
  /** How many uses it spends, where its user chooses (1.251): Lay on Hands' points. */
  amount?: number;
  /** The alterations it is used with (1.253): Metamagic. */
  alters?: string[];
  targets: string[];
  /** How a shape is being laid while it is aimed (1.177, 1.178). */
  lay?: RulesetAimLay;
  /** Where it was aimed, held while who it spares is picked (1.254). */
  cell?: RulesetCellChoice;
  /** Who of its user's side it could spare and how many at most, while that is picked (1.254). */
  spare?: { ids: string[]; most: number };
  /** Who it spares, once that was picked (1.254). */
  spared?: string[];
  /** Who it could heighten, while that is picked (1.255). */
  heighten?: { ids: string[] };
}

/** A shape half laid on the board: the cell it was first set down on, further copies of it, and for
 *  a wall whether it is a ring and which side faces out. */
export interface RulesetAimLay {
  at?: { x: number; y: number };
  also?: Array<{ x: number; y: number }>;
  ring?: boolean;
  side?: "near" | "far";
}

export interface RulesetMenuGroup {
  kind: RulesetMenuKind;
  /** The heading key for this group, so a caller never builds one by hand. */
  labelKey: string;
  options: DirectedRulesetOption[];
}

/** The menu in groups, in a fixed order, with empty groups left out. An option whose kind is not
 *  one this Engine knows is dropped rather than shown without a heading. */
export function rulesetMenuGroups(options: DirectedRulesetOption[] | undefined): RulesetMenuGroup[] {
  const groups: RulesetMenuGroup[] = [];
  for (const kind of RULESET_MENU_KINDS) {
    const found = (options ?? []).filter((option) => option.kind === kind);
    if (found.length === 0) continue;
    groups.push({
      kind,
      labelKey: `game.combat.ruleset.group.${kind === "end-turn" ? "endTurn" : kind}`,
      options: found,
    });
  }
  return groups;
}

/**
 * What an option is called on screen. An attack, an ability and a stat block's action are named by
 * the ruleset, so the label it sent is the label: nothing here touches them. The moves the KIND
 * implements are the Engine's own closed vocabulary and are named here, as is ending a turn.
 */
export function rulesetOptionLabel(option: DirectedRulesetOption, t: TFunction): string {
  if (option.shakeOff)
    return t("game.combat.ruleset.menu.shakeOff", {
      name: option.shakeOff.name,
      condition: option.shakeOff.label,
    });
  // A sphere rolled, picked up or put down (1.314).
  if (option.rollsSealed) return t("game.combat.ruleset.menu.rollSphere", { condition: option.rollsSealed.label });
  if (option.lifts)
    return t(option.lifts.down ? "game.combat.ruleset.menu.putDownSphere" : "game.combat.ruleset.menu.liftSphere", {
      name: option.lifts.name,
    });
  if (option.kind === "end-turn") return t("game.combat.ruleset.menu.endTurn", { defaultValue: option.label });
  // Walking and getting back up are the board's own two moves, named by this Engine for the same
  // reason the standard actions are: the closed list is the Engine's vocabulary, not the file's.
  // Which is which comes off the two exported ids, never off the spelling of one: the ids belong to
  // the resolver and have already changed once.
  if (option.kind === "move") {
    // Moving a lasting area (1.173), or turning one (1.182), is named by the area the ruleset named.
    if (option.id.startsWith(RULESET_ZONE_TURN_OPTION_PREFIX))
      return t("game.combat.ruleset.menu.turnZone", { zone: option.label });
    if (option.id.startsWith(RULESET_ZONE_OPTION_PREFIX))
      return t("game.combat.ruleset.menu.moveZone", { zone: option.label });
    const word = MOVE_OPTION_WORDS[option.id];
    return word ? t(`game.combat.ruleset.board.${word}`, { defaultValue: option.label }) : option.label;
  }
  // A reload is the Engine's own move made with the weapon the ruleset named, and so is a second
  // blow with a weapon in the off hand.
  if (option.kind === "reload") return t("game.combat.ruleset.menu.reload", { weapon: option.label });
  if (option.offHand) return t("game.combat.ruleset.menu.offHand", { weapon: option.label });
  // Putting away a weapon put in hand (1.308).
  if (option.dismiss) return t("game.combat.ruleset.menu.dismiss", { item: option.label });
  // A concentration entry made again (1.310): Vampiric Touch's later touches.
  if (option.again) return t("game.combat.ruleset.menu.again", { label: option.label });
  // A switch says which way it turns the item, which is the Engine's own word too.
  if (option.kind === "switch")
    return t(option.on ? "game.combat.ruleset.menu.switchOff" : "game.combat.ruleset.menu.switchOn", {
      item: option.label,
    });
  // Picking up what was dropped (1.266) is the Engine's own move too.
  if (option.pickUp) return t("game.combat.ruleset.menu.pickUp", { item: option.label });
  // Averting the eyes from a gaze (1.268), and looking again.
  if (option.avert)
    return t(option.avert.back ? "game.combat.ruleset.menu.lookBack" : "game.combat.ruleset.menu.avert", {
      target: option.label,
    });
  // Readying one of the others (1.288), and taking what was readied.
  if (option.ready)
    return t(
      option.ready.on === "comes" ? "game.combat.ruleset.menu.readyComes" : "game.combat.ruleset.menu.readyActs",
      {
        option: rulesetMenuReadyName(option.ready.label, option.ready.optionId, t),
      },
    );
  if (option.readied) return t("game.combat.ruleset.menu.readied", { option: option.label });
  if (option.kind !== "standard") return option.label;
  return t(`game.combat.ruleset.standard.${option.label}`, { defaultValue: option.label });
}

/** The name a readied option goes by (1.288): a walk is the Engine's own word. */
function rulesetMenuReadyName(label: string, optionId: string, t: TFunction): string {
  return optionId === RULESET_MOVE_OPTION ? t("game.combat.ruleset.board.walk", { defaultValue: label }) : label;
}

/** What one option spends, in the ruleset's own words: its budget, the pools it draws on, and how
 *  many times it is left. Every name comes off the option the server built. */
export function rulesetOptionCostText(
  option: DirectedRulesetOption,
  budgetLabel: (id: string) => string,
  t: TFunction,
  /** What one cell is worth here, for the one option that is priced in movement. */
  distance?: RulesetBoardDistance,
): string {
  const parts: string[] = [];
  if (option.budget) parts.push(t("game.combat.ruleset.option.spends", { budget: budgetLabel(option.budget) }));
  // A strike out of what a spend already bought costs no budget, and says how many are in hand.
  else if (typeof option.strikes === "number") {
    parts.push(t("game.combat.ruleset.option.freeStrike", { count: option.strikes }));
  }
  // The other half of an action already made this turn (1.280): a blink dog's bite after its teleport.
  else if (option.followUp) parts.push(t("game.combat.ruleset.option.followUp"));
  // A walk is priced in the ruleset's own distance rather than in a budget, so it is said beside
  // whichever of the two above applied.
  if (typeof option.movementCost === "number") {
    parts.push(
      t("game.combat.ruleset.board.movementCost", {
        amount: rulesetDistanceText(option.movementCost, distance, t),
      }),
    );
  }
  for (const cost of option.cost ?? []) {
    parts.push(t("game.combat.ruleset.option.cost", { amount: cost.amount, pool: cost.label }));
  }
  if (option.signature) {
    parts.push(
      t("game.combat.ruleset.option.signature", { cost: option.signature.cost, points: option.signature.points }),
    );
  }
  if (typeof option.left === "number") parts.push(t("game.combat.ruleset.option.left", { left: option.left }));
  // What a weapon has loaded, and what its holder carries of what it shoots.
  if (option.loaded) {
    parts.push(t("game.combat.ruleset.option.loaded", { now: option.loaded.now, max: option.loaded.max }));
  }
  if (typeof option.ammo === "number") {
    const key = option.kind === "reload" ? "game.combat.ruleset.option.ammoToLoad" : "game.combat.ruleset.option.ammo";
    parts.push(t(key, { count: option.ammo }));
  }
  return parts.join(" · ");
}

/** What one of a weapon's modes is expected to do, in words, and how many it may be aimed at. */
export function rulesetModeText(
  option: DirectedRulesetOption,
  mode: NonNullable<DirectedRulesetOption["modes"]>[number],
  t: TFunction,
): string {
  const expected = rulesetOptionForecastText({ ...option, forecast: mode.forecast }, t);
  const aimed = mode.targets > 1 ? t("game.combat.ruleset.mode.targets", { count: mode.targets }) : "";
  return [expected, aimed].filter(Boolean).join(" · ");
}

/** What the option is expected to do, in words. The server computed both numbers; a screen that
 *  worked out its own chance to hit could disagree with the fight it is describing. */
export function rulesetOptionForecastText(option: DirectedRulesetOption, t: TFunction): string {
  const parts: string[] = [];
  const forecast = option.forecast;
  if (typeof forecast?.hitChance === "number") {
    // A contest is not rolled against a defense: its chance is the share it would win.
    parts.push(
      t(
        option.kind === "contest" ? "game.combat.ruleset.option.forecastWin" : "game.combat.ruleset.option.forecastHit",
        {
          percent: Math.round(forecast.hitChance * 100),
        },
      ),
    );
  }
  // An attack made in a style does what its style does, which the style step says: the weapon's
  // own damage is neither what a taking style takes nor what a spending one throws.
  if (typeof forecast?.averageDamage === "number" && !option.styles?.length) {
    parts.push(
      t(option.heals ? "game.combat.ruleset.option.forecastHeal" : "game.combat.ruleset.option.forecastDamage", {
        amount: Math.round(forecast.averageDamage),
      }),
    );
  }
  return parts.join(", ");
}

/** What one initiative style of an attack is expected to do, in words: its chance to hit, and what
 *  it would take off the target's initiative or the harm it would do. The server computed each. */
export function rulesetStyleForecastText(
  style: NonNullable<DirectedRulesetOption["styles"]>[number],
  t: TFunction,
): string {
  const parts: string[] = [];
  const forecast = style.forecast;
  if (typeof forecast?.hitChance === "number") {
    parts.push(t("game.combat.ruleset.option.forecastHit", { percent: Math.round(forecast.hitChance * 100) }));
  }
  if (typeof forecast?.shift === "number") {
    parts.push(t("game.combat.ruleset.option.forecastShift", { amount: Math.round(forecast.shift) }));
  } else if (typeof forecast?.averageDamage === "number") {
    parts.push(t("game.combat.ruleset.option.forecastDamage", { amount: Math.round(forecast.averageDamage) }));
  }
  return parts.join(", ");
}

/** Whether taking this option asks the player to point it at anybody at all. An option with
 *  nothing legal to hit is still on the menu, and taking it simply sends no targets. */
export function rulesetOptionNeedsTargets(option: DirectedRulesetOption): boolean {
  // Something aimed at the actor themselves is not a choice, so it is never a picking step.
  if (option.targets.side === "self") return false;
  // A wall's section it may strike instead counts (1.200).
  return option.targets.count > 0 && (option.targetIds.length > 0 || (option.walls?.length ?? 0) > 0);
}

/** The targets a player has picked after clicking one more. Only ids the option itself lists can
 *  be picked, clicking a picked one takes it off again, and the option's own count is the ceiling. */
export function rulesetPickTarget(option: DirectedRulesetOption, picked: string[], id: string): string[] {
  if (!option.targetIds.includes(id)) return picked;
  // One that may be pointed at the same one again (1.305) adds another while there is room, and
  // once full a click on one already picked takes one of theirs off.
  if (option.targets.repeat) {
    if (picked.length < option.targets.count) return [...picked, id];
    const at = picked.lastIndexOf(id);
    return at < 0 ? picked : [...picked.slice(0, at), ...picked.slice(at + 1)];
  }
  if (picked.includes(id)) return picked.filter((entry) => entry !== id);
  if (picked.length >= option.targets.count) return picked;
  return [...picked, id];
}

/**
 * Who of its user's side an alteration it is used with could spare (1.254): Careful Spell. Null when
 * there is nothing to pick, because no alteration spares anybody or it catches no more of them than
 * it spares. An aimed shape catches who its aim says; a wall, whose aim the board does not hold,
 * could catch any of them.
 */
export function rulesetSparePick(
  view: DirectedRulesetView,
  step: Pick<RulesetMenuStep, "option" | "alters">,
  targets: string[],
  cell?: RulesetCellChoice,
): { ids: string[]; most: number } | null {
  const most = Math.max(
    0,
    ...(step.alters ?? []).map((id) => step.option.alters?.find((offer) => offer.id === id)?.spares ?? 0),
  );
  if (most === 0) return null;
  const user = rulesetMenuUser(view);
  if (!user) return null;
  const caught = rulesetCaught(view, step.option, targets, cell);
  const ids = view.combatants
    .filter((combatant) => combatant.side === user.side && caught.has(combatant.id))
    .map((combatant) => combatant.id);
  return ids.length > most ? { ids, most } : null;
}

/** Who is answering the menu: the actor, or whoever a window is asking. */
function rulesetMenuUser(view: DirectedRulesetView) {
  return view.combatants.find((combatant) => combatant.id === (view.window?.actorId ?? view.actorId));
}

/** Who a use catches: those it is pointed at, or for a shape who its aim says. A wall, whose aim
 *  the board does not hold, could catch anybody. */
function rulesetCaught(
  view: DirectedRulesetView,
  option: DirectedRulesetOption,
  targets: string[],
  cell?: RulesetCellChoice,
): Set<string> {
  const aims = cell?.at ? [cell.at, ...(cell.also ?? [])] : [];
  const aimed = aims.map((at) => option.aim?.find((one) => one.x === at.x && one.y === at.y));
  return new Set(
    aims.length === 0
      ? targets
      : aimed.every((one) => one)
        ? aimed.flatMap((one) => one!.targetIds)
        : view.combatants.map((combatant) => combatant.id),
  );
}

/**
 * Who an alteration it is used with could give disadvantage on their first save (1.255): Heightened
 * Spell. Null when there is nothing to pick: none heightens, or it catches one at most besides its
 * user.
 */
export function rulesetHeightenPick(
  view: DirectedRulesetView,
  step: Pick<RulesetMenuStep, "option" | "alters">,
  targets: string[],
  cell?: RulesetCellChoice,
): { ids: string[] } | null {
  const heightens = (step.alters ?? []).some((id) => step.option.alters?.find((offer) => offer.id === id)?.heightens);
  const user = rulesetMenuUser(view);
  if (!heightens || !user) return null;
  const caught = rulesetCaught(view, step.option, targets, cell);
  const ids = view.combatants
    .filter((combatant) => combatant.id !== user.id && caught.has(combatant.id))
    .map((combatant) => combatant.id);
  return ids.length > 1 ? { ids } : null;
}

/**
 * The step a use goes to once it is aimed or pointed, before it is sent (1.254, 1.255): who it
 * spares, then who it heightens. Null when there is nothing left to pick and it is sent.
 */
export function rulesetPicksStep(
  view: DirectedRulesetView,
  step: RulesetMenuStep,
  targets: string[],
  cell?: RulesetCellChoice,
): RulesetMenuStep | null {
  const held = { ...step, targets, ...(cell ? { cell } : {}) };
  if (step.spared === undefined) {
    const spare = rulesetSparePick(view, step, targets, cell);
    if (spare) return { ...held, stage: "spare", spare };
  }
  const heighten = rulesetHeightenPick(view, step, targets, cell);
  if (heighten) return { ...held, stage: "heighten", heighten };
  return null;
}

/** What is sent for an option that takes no picking: whoever it is already pointed at. */
export function rulesetDefaultTargets(option: DirectedRulesetOption): string[] {
  if (rulesetOptionNeedsTargets(option)) return [];
  return option.targetIds.slice(0, Math.max(0, option.targets.count));
}

/** Whether one more pick sends the choice on its own. One target and one allowed is a single tap;
 *  anything that may take several is confirmed, so a second target is still reachable. */
export function rulesetSendsOnPick(option: DirectedRulesetOption): boolean {
  return option.targets.count === 1;
}
