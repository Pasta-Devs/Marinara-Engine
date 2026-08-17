export type PresetChoiceSelections = Record<string, string | string[]>;

interface PresetChoiceVariable {
  variableName: string;
  options: ReadonlyArray<{ value: string }>;
  multiSelect: boolean;
}

/**
 * Check whether every preset variable has a valid UI selection.
 *
 * An empty string is a valid single-select value: preset authors use blank
 * options to mean "insert nothing". Boolean variables and empty multi-select
 * arrays are also intentionally valid states.
 */
export function arePresetChoiceSelectionsComplete(
  variables: readonly PresetChoiceVariable[],
  selections: PresetChoiceSelections,
): boolean {
  return variables.every((variable) => {
    const selection = selections[variable.variableName];

    if (variable.multiSelect) return Array.isArray(selection);
    if (variable.options.length === 1) return typeof selection === "string";

    return typeof selection === "string" && variable.options.some((option) => option.value === selection);
  });
}
