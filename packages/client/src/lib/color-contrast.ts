// ──────────────────────────────────────────────
// Colour contrast for the Appearance pickers (theming panel batch 2)
//
// Any CSS colour (hex, rgb, hsl, oklch, a named colour, or a gradient's first stop) is turned into
// sRGB by painting one canvas pixel, then checked with the WCAG contrast ratio. "Fix for me"
// keeps the hue and saturation and walks the lightness until the ratio is met.
// ──────────────────────────────────────────────
import { getCssColorFallback } from "./css-colors";

export type Rgba = [number, number, number, number];

let context: CanvasRenderingContext2D | null | undefined;

/** sRGB channels (0-255) and alpha (0-1) of a CSS colour, or null when the browser can't read it. */
export function cssColorToRgb(value: string | null | undefined): Rgba | null {
  if (typeof document === "undefined") return null;
  const color = getCssColorFallback(value, "").trim();
  if (!color || color.includes("var(")) return null;
  if (context === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    context = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!context) return null;
  try {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "#010203";
    context.fillStyle = color;
    // An unparseable colour leaves the sentinel in place.
    if (context.fillStyle === "#010203" && !/^#0?10?20?3$/i.test(color)) return null;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return [r!, g!, b!, a! / 255];
  } catch {
    return null;
  }
}

function channel(value: number) {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]: Rgba) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgba, b: Rgba) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Contrast between two CSS colours, or null when either can't be read. */
export function cssContrast(foreground: string, background: string): number | null {
  const fg = cssColorToRgb(foreground);
  const bg = cssColorToRgb(background);
  return fg && bg ? contrastRatio(fg, bg) : null;
}

function rgbToHsl([r, g, b]: Rgba): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * The nearest colour to `color` (same hue and saturation) that reaches `target` against `against`.
 * It moves away from the other colour's lightness: lighter on a dark background, darker on a light one.
 */
export function fixContrast(color: string, against: string, target: number): string | null {
  const rgb = cssColorToRgb(color);
  const other = cssColorToRgb(against);
  if (!rgb || !other) return null;
  if (contrastRatio(rgb, other) >= target) return null;
  const [h, s, l] = rgbToHsl(rgb);
  const darker = relativeLuminance(other) > 0.4;
  for (let step = 1; step <= 100; step += 1) {
    const next = Math.max(0, Math.min(1, darker ? l - step / 100 : l + step / 100));
    const hex = hslToHex(h, s, next);
    const candidate = cssColorToRgb(hex);
    if (candidate && contrastRatio(candidate, other) >= target) return hex;
    if (next === 0 || next === 1) break;
  }
  return darker ? "#000000" : "#ffffff";
}
