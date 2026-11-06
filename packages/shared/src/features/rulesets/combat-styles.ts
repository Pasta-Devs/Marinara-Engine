// Which combat styles a game on a ruleset may play (Capability API 1.379): `combat.styles`.
//
// A ruleset whose rules need a board (areas, reach, cover) loses them when its fights are played
// without one, so it may name the styles its games play. Everything here is pure and reads only the
// definition; a ruleset that names none allows every style, exactly as before.

import type { RulesetDefinition } from "../../schemas/ruleset.schema.js";
import { BUILT_IN_GAME_COMBAT_STYLES, type GameCombatStyle } from "../../types/game.js";

/** The styles this ruleset allows, in its own order, or null when it allows every one. */
export function rulesetCombatStyles(definition: RulesetDefinition | null | undefined): readonly string[] | null {
  const styles = definition?.combat?.styles;
  return styles?.length ? styles : null;
}

/** Whether a game on this ruleset may play `style`. A game that names no style plays classic. */
export function rulesetAllowsCombatStyle(
  definition: RulesetDefinition | null | undefined,
  style: GameCombatStyle | null | undefined,
): boolean {
  const styles = rulesetCombatStyles(definition);
  return !styles || styles.includes(style || "classic");
}

/**
 * The style a game on this ruleset plays when `style` is what it saved: that style when the ruleset
 * allows it (and `known` has it), otherwise the first style the ruleset lists that `known` has (a client passes the styles
 * it can draw), else the first built-in style it lists, which every client draws and a checked list
 * always holds. Without `known` (the server) it is the first style listed.
 */
export function rulesetCombatStyle(
  definition: RulesetDefinition | null | undefined,
  style: GameCombatStyle | null | undefined,
  known?: readonly string[],
): GameCombatStyle {
  const styles = rulesetCombatStyles(definition);
  const asked = style || "classic";
  if (!styles || (styles.includes(asked) && (!known || known.includes(asked)))) return asked;
  // The server knows no client's registrations, so it reads the list as written.
  if (!known) return styles[0]!;
  return (
    styles.find((id) => known.includes(id)) ??
    styles.find((id) => (BUILT_IN_GAME_COMBAT_STYLES as readonly string[]).includes(id)) ??
    styles[0]!
  );
}
