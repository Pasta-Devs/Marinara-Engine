// The rules a ruleset fight's menu is drawn and driven by, with no React in them.
//
// The server sends the only legal menu there is: every option on it can be taken right now, and
// each one lists exactly who it may be pointed at. Nothing here decides legality or does any
// arithmetic; it groups what arrived, spells what an option spends out of the words the option
// carries, and keeps a player's picking inside the option's own list and count.
import type { DirectedRulesetOption } from "@marinara-engine/shared";
import { RULESET_MOVE_OPTION, RULESET_STAND_OPTION } from "@marinara-engine/shared";
import type { TFunction } from "i18next";
import { rulesetDistanceText, type RulesetBoardDistance } from "./ruleset-combat-board";

/** The order a menu reads in: where you go, what you swing, what you cast, what a stat block can
 *  do, the moves the kind implements, and finally ending the turn. Walking comes first because a
 *  turn on a board usually starts with it, and it may be taken again after an action. */
export const RULESET_MENU_KINDS = ["move", "attack", "ability", "block", "standard", "end-turn"] as const;

export type RulesetMenuKind = (typeof RULESET_MENU_KINDS)[number];

/** A half-made choice: deciding what pays for it, where it walks, who it is pointed at, or where
 *  the shape lands. The board holds this while it draws it, so the menu and the board are never
 *  two steps apart. */
/** The Engine's own word for each of the two moves a board adds, keyed by the resolver's own id.
 *  A key segment is built from the WORD and never from the id, which may carry punctuation a
 *  localization key may not. */
const MOVE_OPTION_WORDS: Record<string, "walk" | "stand"> = {
  [RULESET_MOVE_OPTION]: "walk",
  [RULESET_STAND_OPTION]: "stand",
};

export interface RulesetMenuStep {
  stage: "pay" | "move" | "target" | "aim";
  option: DirectedRulesetOption;
  payWith?: string;
  targets: string[];
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
  if (option.kind === "end-turn") return t("game.combat.ruleset.menu.endTurn", { defaultValue: option.label });
  // Walking and getting back up are the board's own two moves, named by this Engine for the same
  // reason the standard actions are: the closed list is the Engine's vocabulary, not the file's.
  // Which is which comes off the two exported ids, never off the spelling of one: the ids belong to
  // the resolver and have already changed once.
  if (option.kind === "move") {
    const word = MOVE_OPTION_WORDS[option.id];
    return word ? t(`game.combat.ruleset.board.${word}`, { defaultValue: option.label }) : option.label;
  }
  if (option.kind !== "standard") return option.label;
  return t(`game.combat.ruleset.standard.${option.label}`, { defaultValue: option.label });
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
  return parts.join(" · ");
}

/** What the option is expected to do, in words. The server computed both numbers; a screen that
 *  worked out its own chance to hit could disagree with the fight it is describing. */
export function rulesetOptionForecastText(option: DirectedRulesetOption, t: TFunction): string {
  const parts: string[] = [];
  const forecast = option.forecast;
  if (typeof forecast?.hitChance === "number") {
    parts.push(t("game.combat.ruleset.option.forecastHit", { percent: Math.round(forecast.hitChance * 100) }));
  }
  if (typeof forecast?.averageDamage === "number") {
    parts.push(
      t(option.heals ? "game.combat.ruleset.option.forecastHeal" : "game.combat.ruleset.option.forecastDamage", {
        amount: Math.round(forecast.averageDamage),
      }),
    );
  }
  return parts.join(", ");
}

/** Whether taking this option asks the player to point it at anybody at all. An option with
 *  nothing legal to hit is still on the menu, and taking it simply sends no targets. */
export function rulesetOptionNeedsTargets(option: DirectedRulesetOption): boolean {
  // Something aimed at the actor themselves is not a choice, so it is never a picking step.
  if (option.targets.side === "self") return false;
  return option.targets.count > 0 && option.targetIds.length > 0;
}

/** The targets a player has picked after clicking one more. Only ids the option itself lists can
 *  be picked, clicking a picked one takes it off again, and the option's own count is the ceiling. */
export function rulesetPickTarget(option: DirectedRulesetOption, picked: string[], id: string): string[] {
  if (!option.targetIds.includes(id)) return picked;
  if (picked.includes(id)) return picked.filter((entry) => entry !== id);
  if (picked.length >= option.targets.count) return picked;
  return [...picked, id];
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
