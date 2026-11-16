// The key handling of a closed Select field, kept pure so a regression can check it: like a native
// <select>, the arrow keys step through the options and a letter jumps to the next one starting with it.

/** A Select shows a search box from this many options. */
export const SELECT_SEARCH_MIN = 8;

type StepOption<T extends string> = { value: T; label: string; disabledReason?: string };

const enabledOptions = <T extends string>(options: readonly StepOption<T>[]) =>
  options.filter((option) => option.disabledReason === undefined);

/** The option one step up or down from `value`, skipping disabled ones. Stops at the ends, like a native select. */
export function stepSelectOption<T extends string>(
  options: readonly StepOption<T>[],
  value: T | null,
  step: 1 | -1,
): T | undefined {
  const enabled = enabledOptions(options);
  if (enabled.length === 0) return undefined;
  const at = enabled.findIndex((option) => option.value === value);
  if (at < 0) return enabled[step > 0 ? 0 : enabled.length - 1]!.value;
  return enabled[Math.max(0, Math.min(enabled.length - 1, at + step))]!.value;
}

/** The next enabled option after `value` whose label starts with `key`, wrapping around. */
export function typeAheadSelectOption<T extends string>(
  options: readonly StepOption<T>[],
  value: T | null,
  key: string,
): T | undefined {
  const enabled = enabledOptions(options);
  const letter = key.toLocaleLowerCase();
  const at = enabled.findIndex((option) => option.value === value);
  for (let offset = 1; offset <= enabled.length; offset += 1) {
    const option = enabled[(at + offset + enabled.length) % enabled.length]!;
    if (option.label.trim().toLocaleLowerCase().startsWith(letter)) return option.value;
  }
  return undefined;
}
