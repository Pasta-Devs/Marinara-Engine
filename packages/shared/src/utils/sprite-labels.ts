const WINDOWS_FILENAME_UNSAFE_RE = /[<>:"/\\|?*\u0000-\u001f]+/gu;
const SEPARATOR_RE = /[\s,;]+/gu;
const SPRITE_LABEL_UNSAFE_RE = /[^\p{L}\p{N}._-]+/gu;
const MULTI_UNDERSCORE_RE = /_+/g;
const SPRITE_LABEL_EDGE_RUN_RE = /[.\s_-]+/gu;
const FULL_BODY_PREFIX_RE = /^full[_\s-]+/iu;
const COMBINING_MARK_RE = /\p{M}+/gu;

/** Drops a separator run at either end and keeps inner ones; `^…|…$` backtracks quadratically on a long inner run. */
function dropEdgeRun(run: string, offset: number, label: string): string {
  return offset === 0 || offset + run.length === label.length ? "" : run;
}

function normalizeForSpriteLabel(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

export function normalizeSpriteExpressionLabel(raw: string, options?: { fullBody?: boolean }): string {
  let label = normalizeForSpriteLabel(raw)
    .replace(WINDOWS_FILENAME_UNSAFE_RE, "_")
    .replace(SEPARATOR_RE, "_")
    .replace(SPRITE_LABEL_UNSAFE_RE, "_")
    .replace(MULTI_UNDERSCORE_RE, "_")
    .replace(SPRITE_LABEL_EDGE_RUN_RE, dropEdgeRun);

  if (!label) return "";

  if (options?.fullBody) {
    return FULL_BODY_PREFIX_RE.test(label) ? label : `full_${label}`;
  }

  label = label.replace(FULL_BODY_PREFIX_RE, "").replace(SPRITE_LABEL_EDGE_RUN_RE, dropEdgeRun);
  return label;
}

export function normalizeSpriteExpressionKey(raw: string): string {
  return normalizeForSpriteLabel(raw.replace(/_sprite_[a-f0-9]{12}$/iu, ""))
    .normalize("NFKD")
    .replace(COMBINING_MARK_RE, "")
    .replace(FULL_BODY_PREFIX_RE, "")
    .replace(WINDOWS_FILENAME_UNSAFE_RE, "_")
    .replace(SEPARATOR_RE, "_")
    .replace(SPRITE_LABEL_UNSAFE_RE, "_")
    .replace(/[._-]+/gu, "_")
    .replace(MULTI_UNDERSCORE_RE, "_")
    .replace(SPRITE_LABEL_EDGE_RUN_RE, dropEdgeRun);
}

export function normalizeSpriteLookupToken(raw: string): string {
  return normalizeSpriteExpressionKey(raw).replace(/[._-]+/gu, "");
}

/** PNGTuber talk and blink picture suffixes (`happy_talk`, `happy_blink`): frames of another face, not faces. */
export const SPRITE_MOUTH_OPEN_SUFFIXES = ["mouth_open", "open_mouth", "talking", "talk", "speaking", "speak"] as const;
export const SPRITE_EYES_CLOSED_SUFFIXES = ["eyes_closed", "closed_eyes", "eyes_shut", "blinking", "blink"] as const;

/** Whether a normalized sprite key is a PNGTuber talk or blink frame rather than a face of its own. */
export function isSpriteTalkOrBlinkFrame(key: string): boolean {
  return [...SPRITE_MOUTH_OPEN_SUFFIXES, ...SPRITE_EYES_CLOSED_SUFFIXES].some(
    (suffix) => key.length > suffix.length + 1 && key.endsWith(`_${suffix}`),
  );
}

const SPRITE_VARIANT_NUMBER_RE = /(?:_\d+)+$/u;

/**
 * A sprite's faceted name, without its variant number (#8637): `angry_formalwear_soaked_01` becomes
 * `angry_formalwear_soaked`, and `happy_01` becomes the plain group key `happy`.
 */
export function spriteExpressionFacetKey(raw: string): string {
  return normalizeSpriteExpressionKey(raw).replace(SPRITE_VARIANT_NUMBER_RE, "");
}

/**
 * The items a faceted request such as `happy_pajamas_wounded` selects (#8637), or none for a plain group key.
 *
 * The first token stays the group key, as it is for variant groups. The facets after it are read in the
 * priority they are written in, so a library named `emotion_outfit_condition` keeps the outfit over the
 * condition. A request first matches sprites with exactly its facets (any variant number), then sprites with
 * further facets (never a PNGTuber talk or blink frame). With neither, the last facet is dropped and the shorter
 * name is tried, down to two tokens.
 * An empty result leaves the group key to the caller's existing group and variant resolution, so
 * `happy_pajamas_wounded` falls back to `happy_pajamas` and then to `happy`. The rule only depends on the names.
 */
export function findSpriteExpressionFacetMatches<T>(
  items: readonly T[],
  requested: string,
  nameOf: (item: T) => string,
): T[] {
  const tokens = spriteExpressionFacetKey(requested).split("_");
  if (tokens.length < 2) return [];
  const keys = items.map((item) => spriteExpressionFacetKey(nameOf(item)));
  for (let size = tokens.length; size >= 2; size--) {
    const facet = tokens.slice(0, size).join("_");
    const same = items.filter((_, index) => keys[index] === facet);
    if (same.length > 0) return same;
    const further = items.filter(
      (_, index) => keys[index]!.startsWith(`${facet}_`) && !isSpriteTalkOrBlinkFrame(keys[index]!),
    );
    if (further.length > 0) return further;
  }
  return [];
}
