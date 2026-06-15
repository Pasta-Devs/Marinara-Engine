export const RAINBOW_GRADIENT_PRESET =
  "linear-gradient(90deg, #ff4d6d, #ff9f1c, #ffe66d, #2ec4b6, #3a86ff, #8338ec, #ff4d6d)";

const CSS_GRADIENT_RE = /\b(?:linear|radial|conic|repeating-linear|repeating-radial|repeating-conic)-gradient\(/i;
const HEX_COLOR_RE = /#[0-9a-f]{3,8}\b/i;

export function isCssGradient(value: string | null | undefined): value is string {
  return typeof value === "string" && CSS_GRADIENT_RE.test(value.trim());
}

export function getCssColorFallback(value: string | null | undefined, fallback: string) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return fallback;
  if (!isCssGradient(trimmed)) return trimmed;
  return trimmed.match(HEX_COLOR_RE)?.[0] ?? fallback;
}

export function getCssBackgroundStyle(value: string) {
  return isCssGradient(value) ? { background: value } : { backgroundColor: value };
}
