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

/**
 * Scale a paint's own alpha by `factor` (0-1), keeping the color channels and gradient geometry, so an
 * authored `rgba(…, 0.25)` stays a quarter as strong as an opaque color. The Roleplay opacity slider
 * and an authored alpha then both apply instead of one silently replacing the other (#9063).
 */
export function withCssPaintAlpha(value: string, factor: string): string {
  return mapCssPaintColors(value, (color) => `rgb(from ${color} r g b / calc(alpha * ${factor}))`);
}

/** Replace a paint's own alpha outright, keeping its channels and gradient geometry. */
export function replacedCssPaintAlpha(value: string, alpha: string): string {
  return mapCssPaintColors(value, (color) => `rgb(from ${color} r g b / ${alpha})`);
}

function mapCssPaintColors(value: string, paint: (color: string) => string): string {
  if (!isCssGradient(value)) return paint(value);

  const layers = splitTopLevelCommas(value);
  if (layers.length > 1) return layers.map((layer) => mapCssPaintColors(layer, paint)).join(", ");

  const open = value.indexOf("(");
  const close = value.lastIndexOf(")");
  const stops = splitTopLevelCommas(value.slice(open + 1, close)).map((stop) => {
    const color = readFunctionColor(stop, true) ?? stop.match(/^(?:#[0-9a-f]{3,8}\b|[a-z][a-z-]*)/i)?.[0];
    // Keep directions, interpolation spaces, positions and transition hints intact.
    if (!color || !CSS.supports("color", color)) return stop;
    return paint(color) + stop.slice(color.length);
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

/** `#rrggbb` to unrounded [hue 0-360, saturation 0-100, brightness 0-100], so a round trip is exact. */
export function hexToHsv(value: string): [number, number, number] {
  const hex = value.slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const green = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  const hue =
    delta === 0
      ? 0
      : max === red
        ? 60 * (((green - blue) / delta) % 6)
        : max === green
          ? 60 * ((blue - red) / delta + 2)
          : 60 * ((red - green) / delta + 4);
  return [(hue + 360) % 360, max ? (delta / max) * 100 : 0, max * 100];
}

/** Hue 0-359, saturation and brightness 0-100 to `#rrggbb`. */
export function hsvToHex(hue: number, saturation: number, brightness: number) {
  const v = brightness / 100;
  const chroma = v * (saturation / 100);
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1
      ? [chroma, x, 0]
      : section < 2
        ? [x, chroma, 0]
        : section < 3
          ? [0, chroma, x]
          : section < 4
            ? [0, x, chroma]
            : section < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const match = v - chroma;
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` as lowercase `#rrggbb`, plus `aa` only when not opaque. */
export function normalizeHexColor(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  const short = normalized.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/);
  const long = short
    ? `#${short
        .slice(1)
        .map((digit) => (digit ? digit + digit : ""))
        .join("")}`
    : normalized;
  if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/.test(long)) return null;
  return long.endsWith("ff") && long.length === 9 ? long.slice(0, 7) : long;
}

const alphaHex = (alpha: number) =>
  Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
/** `#rrggbb` with the alpha appended when it is not fully opaque. */
export const withAlpha = (hex: string, alpha: number) => (alpha >= 1 ? hex : `${hex}${alphaHex(alpha)}`);
/** Alpha (0-1) of a `#rrggbb` or `#rrggbbaa` colour. */
export const hexAlpha = (hex: string) => (hex.length === 9 ? Number.parseInt(hex.slice(7), 16) / 255 : 1);

/** Two gradient stops starting from `color`: it, then a shade lighter (dark colours) or darker; null without a colour. */
export function gradientStopsFromColor(color: string | null | undefined): [string, string] | null {
  const hex = color ? normalizeHexColor(color) : null;
  if (!hex) return null;
  const [hue, saturation, brightness] = hexToHsv(hex);
  const shade = hsvToHex(hue, saturation, brightness < 50 ? brightness + 35 : brightness - 35);
  return [hex, withAlpha(shade, hexAlpha(hex))];
}
