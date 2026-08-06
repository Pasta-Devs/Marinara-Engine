const FORCE_COLOR_VALUES = new Set(["", "1", "2", "3", "true"]);

export function forceColorValueEnablesColor(value: string | undefined): boolean {
  return value !== undefined && FORCE_COLOR_VALUES.has(value.toLowerCase());
}
