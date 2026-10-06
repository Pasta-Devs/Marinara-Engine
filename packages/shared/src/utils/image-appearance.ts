/**
 * Optional image-prompt appearance override stored on a character/persona card.
 *
 * A card keeps its authored `appearance` text by default. When
 * `extensions.imageAppearanceEnabled` is true and `extensions.imageAppearance`
 * has content, that text replaces the authored appearance in image prompts.
 */

/** Trim a candidate appearance value, treating blank input as absent. */
function normalizeAppearance(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Resolve the appearance text an image prompt should use for a card.
 *
 * Returns the trimmed override only when it is explicitly enabled and non-empty;
 * otherwise returns the normalized fallback (or null when neither is usable).
 */
export function readImageAppearanceOverride(
  extensions: Record<string, unknown> | undefined | null,
  fallbackAppearance: string | null | undefined,
): string | null {
  if (extensions && extensions.imageAppearanceEnabled === true) {
    const override = normalizeAppearance(extensions.imageAppearance);
    if (override) return override;
  }
  return normalizeAppearance(fallbackAppearance);
}
