// The key handling of a closed Select field, kept pure so a regression can check it: like a native
// <select>, the arrow keys step through the options and a letter jumps to the next one starting with it.

/** A Select shows a search box from this many options. */
export const SELECT_SEARCH_MIN = 8;

type StepOption<T extends string> = { value: T; label: string; disabledReason?: string };

const enabled = <T extends string>(option: StepOption<T>) => option.disabledReason === undefined;

/** The option one step up or down from `value`, skipping disabled ones. Stops at the ends, like a native select. */
export function stepSelectOption<T extends string>(
  options: readonly StepOption<T>[],
  value: T | null,
  step: 1 | -1,
): T | undefined {
  // Walk from the current option, even a disabled one, so a step never jumps back to the start.
  const at = options.findIndex((option) => option.value === value);
  const start = at >= 0 ? at : step > 0 ? -1 : options.length;
  for (let i = start + step; i >= 0 && i < options.length; i += step)
    if (enabled(options[i]!)) return options[i]!.value;
  // Already on the last enabled option in that direction: stay put.
  return at >= 0 && enabled(options[at]!) ? options[at]!.value : undefined;
}

/** The next enabled option after `value` whose label starts with `key`, wrapping around. */
export function typeAheadSelectOption<T extends string>(
  options: readonly StepOption<T>[],
  value: T | null,
  key: string,
): T | undefined {
  const letter = key.toLocaleLowerCase();
  const at = options.findIndex((option) => option.value === value);
  for (let offset = 1; offset <= options.length; offset += 1) {
    const option = options[(at + offset + options.length) % options.length]!;
    if (enabled(option) && option.label.trim().toLocaleLowerCase().startsWith(letter)) return option.value;
  }
  return undefined;
}

/** Consecutive options sharing a `group` (or none), in order: the list shows a header per grouped run. */
export function groupSelectOptions<T extends { group?: string }>(
  options: readonly T[],
): { group: string | undefined; options: T[] }[] {
  const runs: { group: string | undefined; options: T[] }[] = [];
  for (const option of options) {
    const last = runs[runs.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else runs.push({ group: option.group, options: [option] });
  }
  return runs;
}
