// Size sorts the libraries share (characters, personas, lorebooks, presets): server pages and panel lists order
// by the same estimate, so a page loaded later never reshuffles the rows above it.

export const TOKEN_SORT_OPTIONS = ["tokens-desc", "tokens-asc"] as const;

export type TokenSort = (typeof TOKEN_SORT_OPTIONS)[number];

export function isTokenSort(value: unknown): value is TokenSort {
  return TOKEN_SORT_OPTIONS.includes(value as TokenSort);
}

/**
 * Compare two token estimates for a size sort: largest first for `tokens-desc`, smallest first for `tokens-asc`.
 * Returns 0 on a tie so callers chain their own name/id tie-break.
 */
export function compareTokenEstimates(
  sort: TokenSort,
  left: number | null | undefined,
  right: number | null | undefined,
): number {
  const a = left ?? 0;
  const b = right ?? 0;
  return sort === "tokens-asc" ? a - b : b - a;
}
