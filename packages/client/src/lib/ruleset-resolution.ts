// How a ruleset's own numbers read on screen.
//
// One module, because the same ruleset must never be spelled two ways: the sheet editor, the
// in-game sheet, the import review and the setup wizard all ask here. Nothing is shaped around one
// game system; every number comes out of the definition the file declared.
import { formatRulesetCheckValue, type RulesetDefinition } from "@marinara-engine/shared";
import type { TFunction } from "i18next";

/**
 * One check number, spelled the way its resolution kind means it: a modifier added to the dice
 * ("+5"), or how many dice are thrown ("5 dice").
 *
 * The summed kind goes through the shared formatter, so a `dice-sum` ruleset shows exactly the
 * bytes it always has. A pool is worded here instead, because the shared helper also writes the
 * Game Master's prompt and therefore has to stay in English.
 */
export function rulesetCheckValueText(definition: RulesetDefinition, value: number, t: TFunction): string {
  if (definition.resolution.kind === "dice-pool") return t("game.ruleset.check.dice", { count: value });
  return formatRulesetCheckValue(definition, value);
}

/**
 * Plain sentences saying how this ruleset rolls a check: a headline, then one line per optional
 * rule the file turned on. A ruleset that turns none on is one line, exactly as before.
 */
export function rulesetRulesSummary(definition: RulesetDefinition, t: TFunction): string[] {
  const resolution = definition.resolution;
  if (resolution.kind === "dice-sum") {
    return [t("game.ruleset.import.resolutionDiceSum", { dice: `${resolution.dice.count}d${resolution.dice.sides}` })];
  }
  const sides = resolution.die.sides;
  const lines: string[] = [
    // A target the Game Master may move is reported as the range it may move in, so nobody reads
    // the default as a fixed rule.
    resolution.target.min < resolution.target.max
      ? t("game.ruleset.rules.poolTargetRange", { sides, min: resolution.target.min, max: resolution.target.max })
      : t("game.ruleset.rules.poolTarget", { sides, target: resolution.target.default }),
  ];
  if (resolution.double) lines.push(t("game.ruleset.rules.double", { from: resolution.double.from }));
  if (resolution.explode) lines.push(t("game.ruleset.rules.explode", { from: resolution.explode.from }));
  if (resolution.cancel) lines.push(t("game.ruleset.rules.cancel", { upTo: resolution.cancel.upTo }));
  if (resolution.botch) lines.push(t("game.ruleset.rules.botch", { upTo: resolution.botch.upTo }));
  if (resolution.exceptional) {
    lines.push(t("game.ruleset.rules.exceptional", { count: resolution.exceptional.successes }));
  }
  if (resolution.situationalDice) {
    lines.push(
      t("game.ruleset.rules.situational", {
        min: resolution.situationalDice.min,
        max: resolution.situationalDice.max,
      }),
    );
  }
  return lines;
}
