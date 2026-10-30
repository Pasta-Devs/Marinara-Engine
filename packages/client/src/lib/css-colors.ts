export const MARINARA_GRADIENT_PRESET = "linear-gradient(90deg, #ec4b97, #f29744, #36cdde)";

export const RAINBOW_GRADIENT_PRESET =
  "linear-gradient(90deg, #ff4d6d, #ff9f1c, #ffe66d, #2ec4b6, #3a86ff, #8338ec, #ff4d6d)";

const CSS_GRADIENT_RE = /\b(?:linear|radial|conic|repeating-linear|repeating-radial|repeating-conic)-gradient\(/i;
const HEX_COLOR_RE = /#[0-9a-f]{3,8}\b/i;
const COLOR_FUNCTION_RE = /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|var)\(/i;
const CSS_DIRECTION_RE =
  /^(?:to\b|at\b|circle\b|ellipse\b|closest-side\b|closest-corner\b|farthest-side\b|farthest-corner\b)/i;
const CSS_ANGLE_RE = /^[-+]?(?:\d+|\d*\.\d+)(?:deg|grad|rad|turn)\b/i;

export function isCssGradient(value: string | null | undefined): value is string {
  return typeof value === "string" && CSS_GRADIENT_RE.test(value.trim());
}

export function getCssColorFallback(value: string | null | undefined, fallback: string) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return fallback;
  if (!isCssGradient(trimmed)) return trimmed;
  return getCssGradientColorStops(trimmed, fallback)[0] ?? fallback;
}

export function getCssBackgroundStyle(value: string) {
  return isCssGradient(value) ? { background: value } : { backgroundColor: value };
}

/** Replace authored alpha without changing the color channels or gradient geometry. */
export function withCssPaintAlpha(value: string, alpha: string): string {
  const colorWithAlpha = (color: string) => `rgb(from ${color} r g b / ${alpha})`;
  if (!isCssGradient(value)) return colorWithAlpha(value);

  const layers = splitTopLevelCommas(value);
  if (layers.length > 1) return layers.map((layer) => withCssPaintAlpha(layer, alpha)).join(", ");

  const open = value.indexOf("(");
  const close = value.lastIndexOf(")");
  const stops = splitTopLevelCommas(value.slice(open + 1, close)).map((stop) => {
    const color = readFunctionColor(stop, true) ?? stop.match(/^(?:#[0-9a-f]{3,8}\b|[a-z][a-z-]*)/i)?.[0];
    // Keep directions, interpolation spaces, positions and transition hints intact.
    if (!color || !CSS.supports("color", color)) return stop;
    return colorWithAlpha(color) + stop.slice(color.length);
  });
  return `${value.slice(0, open + 1)}${stops.join(", ")})`;
}

function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (char === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function readFunctionColor(value: string, anyFunction = false): string | null {
  if (!(anyFunction ? /^[a-z][a-z0-9-]*\(/i : COLOR_FUNCTION_RE).test(value)) return null;

  let depth = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) return value.slice(0, i + 1);
    }
  }

  return null;
}

function extractColorStopColor(stop: string): string | null {
  const trimmed = stop.trim();
  if (!trimmed || CSS_DIRECTION_RE.test(trimmed) || CSS_ANGLE_RE.test(trimmed)) return null;

  const hex = trimmed.match(HEX_COLOR_RE)?.[0];
  if (hex) return hex;

  const fn = readFunctionColor(trimmed);
  if (fn) return fn;

  const keyword = trimmed.match(/^[a-z][a-z-]*/i)?.[0];
  return keyword ?? null;
}

export function getCssGradientColorStops(value: string | null | undefined, fallback: string): string[] {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return [fallback];
  if (!isCssGradient(trimmed)) return [trimmed];

  const open = trimmed.indexOf("(");
  const close = trimmed.lastIndexOf(")");
  if (open < 0 || close <= open) return [fallback];

  const colors = splitTopLevelCommas(trimmed.slice(open + 1, close))
    .map(extractColorStopColor)
    .filter((color): color is string => Boolean(color));

  return colors.length > 0 ? colors : [fallback];
}
