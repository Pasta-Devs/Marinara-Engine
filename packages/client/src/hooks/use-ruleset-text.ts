import { useMemo } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useRulesetStrings } from "./use-capability-packages";
import { rulesetTextLookup, type RulesetText } from "../lib/ruleset-text";

/**
 * A ruleset's own words in the player's language (1.811), as the fight screen reads them: its
 * translation for the language on screen, or every word as written. Only what is shown goes through
 * it; ids, and what goes back to the rules or onto a sheet, stay the ruleset's own.
 */
export function useRulesetDefinitionText(definition: { id: string; version: number }): RulesetText {
  const { i18n } = useUiTranslation();
  const strings = useRulesetStrings(definition.id, definition.version, i18n.resolvedLanguage ?? i18n.language);
  return useMemo(() => rulesetTextLookup(strings.data?.strings), [strings.data]);
}
