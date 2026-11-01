const WINDOWS_FILENAME_UNSAFE_RE = /[<>:"/\\|?*\u0000-\u001f]+/gu;
const SEPARATOR_RE = /[\s,;]+/gu;
const SPRITE_LABEL_UNSAFE_RE = /[^\p{L}\p{N}._-]+/gu;
const MULTI_UNDERSCORE_RE = /_+/g;
const TRIM_SPRITE_LABEL_RE = /^[.\s_-]+|[.\s_-]+$/gu;
const FULL_BODY_PREFIX_RE = /^full[_\s-]+/iu;
const COMBINING_MARK_RE = /\p{M}+/gu;

function normalizeForSpriteLabel(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

export function normalizeSpriteExpressionLabel(raw: string, options?: { fullBody?: boolean }): string {
  let label = normalizeForSpriteLabel(raw)
    .replace(WINDOWS_FILENAME_UNSAFE_RE, "_")
    .replace(SEPARATOR_RE, "_")
    .replace(SPRITE_LABEL_UNSAFE_RE, "_")
    .replace(MULTI_UNDERSCORE_RE, "_")
    .replace(TRIM_SPRITE_LABEL_RE, "");

  if (!label) return "";

  if (options?.fullBody) {
    return FULL_BODY_PREFIX_RE.test(label) ? label : `full_${label}`;
  }

  label = label.replace(FULL_BODY_PREFIX_RE, "").replace(TRIM_SPRITE_LABEL_RE, "");
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
    .replace(TRIM_SPRITE_LABEL_RE, "");
}

export function normalizeSpriteLookupToken(raw: string): string {
  return normalizeSpriteExpressionKey(raw).replace(/[._-]+/gu, "");
}
