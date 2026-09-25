export interface ChoiceOptionValue {
  value: string;
}

export function parseChoiceOptions(options: unknown): ChoiceOptionValue[] {
  try {
    const parsed = typeof options === "string" ? JSON.parse(options) : options;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((option) =>
      option && typeof option === "object" && typeof (option as { value?: unknown }).value === "string"
        ? [{ value: (option as { value: string }).value }]
        : [],
    );
  } catch {
    return [];
  }
}

function sanitizeChoiceSelection(
  selected: string | string[] | undefined,
  options: ChoiceOptionValue[],
  isMulti: boolean,
): string | string[] | undefined {
  if (selected === undefined) return undefined;
  const validValues = new Set(options.map((option) => option.value));
  const candidates = Array.isArray(selected) ? selected : [selected];

  if (isMulti) {
    return candidates.filter((value, index) => validValues.has(value) && candidates.indexOf(value) === index);
  }

  return candidates.find((value) => validValues.has(value));
}

function readChoiceFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function resolveChoiceVariableValue(input: {
  selected: string | string[] | undefined;
  options: ChoiceOptionValue[];
  multiSelect: unknown;
  randomPick: unknown;
  separator?: string | null;
  random?: () => number;
}): string {
  const isRandom = readChoiceFlag(input.randomPick);
  // Imported or legacy presets can carry Boolean/number flags, and a Random
  // Pick selection is necessarily multi-valued even if its companion flag was
  // normalized incorrectly during an older migration.
  const isMulti = readChoiceFlag(input.multiSelect) || (isRandom && Array.isArray(input.selected));

  // An explicit empty selection is the user's OFF value. Only a missing value
  // should fall back to the first option for legacy presets.
  if (input.selected === "" || (Array.isArray(input.selected) && input.selected.length === 0)) return "";

  const selected = sanitizeChoiceSelection(input.selected, input.options, isMulti);

  if (isMulti && Array.isArray(selected)) {
    if (selected.length === 0) return "";
    if (isRandom) {
      const random = input.random ?? Math.random;
      const roll = random();
      const unit = Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 0;
      const index = Math.min(selected.length - 1, Math.floor(unit * selected.length));
      return selected[index] ?? "";
    }
    return selected.join(input.separator ?? ", ");
  }

  if (selected !== undefined) {
    return Array.isArray(selected) ? (selected[0] ?? "") : selected;
  }
  return input.options[0]?.value ?? "";
}
