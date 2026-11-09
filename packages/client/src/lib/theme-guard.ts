// ──────────────────────────────────────────────
// Chrome guard: themes may restyle the top bar, the chats sidebar, the Library sidebar, Ctrl+K and
// the message box, but never hide, move, cover or blank them, and never put fake text in the chat.
//
// The cheap, certain part is CSS (the mari-protected cascade layer in index.html, whose !important
// rules beat any theme). What CSS can't pin down (a theme that slides a sidebar off screen, lays an
// overlay over it, paints text the colour of its background, or writes "paste your API key" into
// the chat) is checked here: each area is measured with the custom CSS switched off and on, inside
// one task so nothing paints in between, and a theme that makes an area worse is reported.
//
// Guard v2 (theming panel round 2): effective opacity includes filter: opacity() and brightness(),
// any CSS colour is parsed (oklch, color(), named), translucent backgrounds are composited,
// controls count by their effective visibility and must still receive clicks, the auto-hidden
// top bar and animated bars are measured instead of skipped, gradient overlays count, and gradient
// text, masks and blend-mode overlays no longer cause false alarms.
//
// Guard v3 (theming panel round 3, pictures): a picture (url() layer) counts as covering unless
// its pixels are mostly see-through, pseudo-elements are hit-tested even with pointer-events: none
// and at any size (an overlay is judged by what it hides at each control, not by its area), a
// border-image outset that paints over a control counts, masks on controls count as hiding, the
// app's own backdrop never counts as an overlay, and text over art is checked against the art's
// sampled colours.
// ──────────────────────────────────────────────
import type { ThemeGuardProblem } from "./theme-safety";
import { extractImportantThemeCss, sanitizeAppCss } from "./theme-css";
import {
  cssImageUrls,
  peekImageSample,
  preloadImageSamples,
  prepareThemeCss,
  sampleRegion,
  type ThemeImage,
} from "./theme-images";

type Area = ThemeGuardProblem["area"];

const AREAS: { area: Area; selector: string }[] = [
  { area: "topbar", selector: '[data-component="TopBar"]' },
  { area: "chats", selector: '[data-component="ChatSidebarPanel"]' },
  { area: "library", selector: '[data-component="RightPanelDesktop"], [data-component="RightPanelMobile"]' },
  { area: "omnibar", selector: '[data-component="GlobalOmnibar.Panel"]' },
  { area: "composer", selector: '[data-mari-part="composer"]' },
];

const CONTROL_SELECTOR = "button, a[href], input, textarea, [role='tab'], [data-chat-row]";

/** App surfaces that may legitimately sit over the chrome (menus, dialogs, toasts, the tutorial). */
const OVERLAY_SELECTOR = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="tooltip"]',
  "[data-radix-popper-content-wrapper]",
  "[data-sonner-toaster]",
  ".mari-window",
  "[data-ov-tabmenu]",
  '[data-component="GlobalOmnibar"]',
  "[data-tour-overlay]",
  "[data-tutorial]",
  "mari-theme-safety",
].join(",");

/** Words that make added text in the chat look like a request for secrets. */
const SENSITIVE_TEXT =
  /\b(api[\s_-]*key|apikey|password|passcode|passphrase|token|secret|sk-|credit\s*card|card\s*number|cvv|log\s*in|login|sign\s*in|session|verify|wallet|seed\s*phrase|paste)\b/i;

type Rgba = [number, number, number, number];

interface Snapshot {
  rect: DOMRect;
  shown: boolean;
  /** How many of the area's controls are visible and on screen. */
  controls: number;
  /** Chat rows that are visible (the chats sidebar's list). */
  rows: number;
  hitOk: boolean[];
  /** Text contrast per sampled text element (the top bar and the message box sample several). */
  contrast: Map<Element, number>;
}

interface SamplePoint {
  x: number;
  y: number;
  /** The control under the point; a hit must land on it (or inside it). Null = anywhere in the area. */
  control: Element | null;
  /** Sample this far into the control's box instead of its centre (long message text, which may be
   *  taller than the screen). */
  offset?: { x: number; y: number };
}

// ── Colours ──

let colorCanvas: CanvasRenderingContext2D | null | undefined;
const colorCache = new Map<string, Rgba | null>();

/** Any CSS colour as sRGB 0-255 plus alpha 0-1, or null when it isn't a colour. */
export function parseColor(value: string): Rgba | null {
  const key = value.trim();
  if (!key) return null;
  if (colorCache.has(key)) return colorCache.get(key)!;
  let result: Rgba | null = null;
  const rgb = key.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const nums = rgb[1]!
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    if (nums.length >= 3 && nums.every((n) => Number.isFinite(n)))
      result = [nums[0]!, nums[1]!, nums[2]!, nums[3] ?? 1];
  } else if (key === "transparent") {
    result = [0, 0, 0, 0];
  } else {
    if (colorCanvas === undefined) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        colorCanvas = canvas.getContext("2d", { willReadFrequently: true });
      } catch {
        colorCanvas = null;
      }
    }
    if (colorCanvas && typeof CSS !== "undefined" && CSS.supports("color", key)) {
      colorCanvas.clearRect(0, 0, 1, 1);
      colorCanvas.fillStyle = "#000";
      colorCanvas.fillStyle = key;
      colorCanvas.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = colorCanvas.getImageData(0, 0, 1, 1).data;
      result = [r!, g!, b!, a! / 255];
    }
  }
  if (colorCache.size > 500) colorCache.clear();
  colorCache.set(key, result);
  return result;
}

function luminance([r, g, b]: Rgba) {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgba, b: Rgba) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3];
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
}

/** Colours inside a background-image value (gradient stops). */
function gradientColors(image: string): Rgba[] | null {
  if (/url\(/.test(image)) return null;
  const matches = image.match(
    /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)|#[0-9a-f]{3,8}\b|\btransparent\b/gi,
  );
  if (!matches || matches.length === 0) return null;
  const colors = matches.map(parseColor);
  return colors.every((color): color is Rgba => !!color) ? colors : null;
}

/** How opaque a background-image value is (0-1): gradients by their stops, pictures by their pixels. */
function imageCoverage(image: string): number {
  if (!image || image === "none") return 0;
  let coverage = 0;
  for (const url of cssImageUrls(image)) {
    const sample = peekImageSample(url);
    // A picture that can't be read yet counts as solid: guessing "see-through" is how art got in.
    coverage = Math.max(coverage, sample ? sample.alpha : 1);
  }
  const stops = gradientColors(image.replace(/url\([^)]*\)/g, ""));
  if (stops) coverage = Math.max(coverage, Math.min(...stops.map((stop) => stop[3])));
  return coverage;
}

/** How much a box (or a pseudo-element's computed style) hides what is under it, 0-1. */
function paintCoverage(style: CSSStyleDeclaration): number {
  if (style.display === "none" || style.visibility !== "visible") return 0;
  if (style.mixBlendMode && style.mixBlendMode !== "normal") return 0;
  let solid = parseColor(style.backgroundColor)?.[3] ?? 0;
  solid = Math.max(solid, imageCoverage(style.backgroundImage));
  const borderImage = style.borderImageSource;
  if (borderImage && borderImage !== "none" && /\bfill\b/.test(style.borderImageSlice))
    solid = Math.max(solid, imageCoverage(borderImage));
  if (style.content && /url\(/.test(style.content)) solid = Math.max(solid, imageCoverage(style.content));
  return solid * Number.parseFloat(style.opacity || "1") * filterOpacity(style.filter);
}

/** The most a pseudo-element of this element hides (pseudo-elements with no content don't paint). */
function pseudoCoverage(element: Element): number {
  let most = 0;
  for (const pseudo of ["::before", "::after"] as const) {
    const style = getComputedStyle(element, pseudo);
    if (!style.content || style.content === "none" || style.content === "normal") continue;
    most = Math.max(most, paintCoverage(style));
  }
  return most;
}

// ── What is painted behind a piece of text (guard v4, theming round 4) ──
// Background layers are read in order, top first, and each is weighted by the area it really paints
// under the text (a 1 px rule in a gradient layer, or a corner ornament, doesn't count as a plate).
// Pictures are sampled under the text's own box, not as a whole, and three versions of the stack are
// kept: the average, and the darkest and lightest the art gets there, so busy art behind a label can
// be judged by its worst spot.

interface Paint {
  avg: Rgba;
  dark: Rgba;
  light: Rgba;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Behind {
  avg: Rgba;
  dark: Rgba;
  light: Rgba;
}

/** A comma-separated CSS list split at its top level (commas inside parentheses stay). */
export function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Splits a value at top-level spaces ("calc(100% - 4px) 0%" → two parts). */
function splitSpaces(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value.trim()) {
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    if (/\s/.test(char) && depth === 0) {
      if (current) parts.push(current);
      current = "";
    } else current += char;
  }
  if (current) parts.push(current);
  return parts;
}

/** A length (px, %, or calc(P% ± Npx)) against a basis; null when it can't be read. */
function lengthPx(token: string | undefined, basis: number): number | null {
  if (!token) return null;
  const plain = /^(-?[\d.]+)(px|%)?$/.exec(token);
  if (plain) {
    const number = Number.parseFloat(plain[1]!);
    return plain[2] === "%" ? (number / 100) * basis : number;
  }
  const calc = /^calc\(\s*(-?[\d.]+)%\s*([+-])\s*(-?[\d.]+)px\s*\)$/.exec(token);
  if (calc) {
    const pct = (Number.parseFloat(calc[1]!) / 100) * basis;
    const px = Number.parseFloat(calc[3]!);
    return calc[2] === "+" ? pct + px : pct - px;
  }
  return null;
}

/** Where one background layer's tile sits (viewport px) and whether it repeats, per axis. */
function layerTile(
  style: CSSStyleDeclaration,
  index: number,
  box: Box,
  natural: { width: number; height: number } | null,
) {
  const pick = (list: string) => {
    const items = splitTopLevel(list);
    return items.length ? items[index % items.length]! : "";
  };
  const fixed = pick(style.backgroundAttachment) === "fixed";
  const area: Box = fixed ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } : box;
  const ratio = natural && natural.width > 0 && natural.height > 0 ? natural.width / natural.height : null;
  const size = pick(style.backgroundSize) || "auto";
  let width = natural?.width ?? area.width;
  let height = natural?.height ?? area.height;
  if (size === "cover" || size === "contain") {
    if (ratio) {
      const scale = (size === "cover" ? Math.max : Math.min)(
        area.width / natural!.width,
        area.height / natural!.height,
      );
      width = natural!.width * scale;
      height = natural!.height * scale;
    } else {
      width = area.width;
      height = area.height;
    }
  } else {
    const [sx, sy] = splitSpaces(size);
    const wx = sx && sx !== "auto" ? lengthPx(sx, area.width) : null;
    const hy = sy && sy !== "auto" ? lengthPx(sy, area.height) : null;
    if (wx !== null && hy !== null) {
      width = wx;
      height = hy;
    } else if (wx !== null) {
      width = wx;
      height = ratio ? wx / ratio : natural ? natural.height : area.height;
    } else if (hy !== null) {
      height = hy;
      width = ratio ? hy * ratio : natural ? natural.width : area.width;
    }
  }
  if (!(width > 0) || !(height > 0)) return null;
  const repeat = splitSpaces(pick(style.backgroundRepeat) || "repeat");
  const repeatsX =
    repeat.length === 1 ? repeat[0] !== "no-repeat" && repeat[0] !== "repeat-y" : repeat[0] !== "no-repeat";
  const repeatsY =
    repeat.length === 1 ? repeat[0] !== "no-repeat" && repeat[0] !== "repeat-x" : repeat[1] !== "no-repeat";
  const [px, py] = splitSpaces(pick(style.backgroundPosition) || "0% 0%");
  const offsetX = lengthPxAlong(px, area.width - width);
  const offsetY = lengthPxAlong(py, area.height - height);
  return { x: area.left + offsetX, y: area.top + offsetY, width, height, repeatsX, repeatsY };
}

/** A background-position part: percentages are of the free space; calc() mixes both. */
function lengthPxAlong(token: string | undefined, free: number) {
  return lengthPx(token, free) ?? free / 2;
}

/** The share of a box a layer's tile paints (0-1), and which part of the tile lies under it (u, v). */
function tileUnder(tile: NonNullable<ReturnType<typeof layerTile>>, rect: Box) {
  const axis = (start: number, length: number, at: number, size: number, repeats: boolean) => {
    if (repeats) {
      if (length >= size) return { share: 1, from: 0, to: 1 };
      const from = ((((start - at) % size) + size) % size) / size;
      const to = from + length / size;
      return to > 1 ? { share: 1, from: 0, to: 1 } : { share: 1, from, to };
    }
    const lo = Math.max(start, at);
    const hi = Math.min(start + length, at + size);
    if (hi <= lo) return { share: 0, from: 0, to: 0 };
    return { share: (hi - lo) / Math.max(1, length), from: (lo - at) / size, to: (hi - at) / size };
  };
  const x = axis(rect.left, rect.width, tile.x, tile.width, tile.repeatsX);
  const y = axis(rect.top, rect.height, tile.y, tile.height, tile.repeatsY);
  return { share: x.share * y.share, u0: x.from, u1: x.to, v0: y.from, v1: y.to };
}

function withAlpha([r, g, b]: [number, number, number] | Rgba, alpha: number): Rgba {
  return [r, g, b, alpha];
}

/** A gradient's paint: its stops' average, darkest and lightest (as see-through as its thinnest stop). */
function gradientPaint(image: string): Paint | null {
  const stops = gradientColors(image);
  if (!stops) return null;
  const alpha = Math.min(...stops.map((stop) => stop[3]));
  const opaque = stops.filter((stop) => stop[3] > 0.05);
  const pool = opaque.length ? opaque : stops;
  const avg: Rgba = [0, 1, 2].map(
    (channel) => pool.reduce((sum, stop) => sum + stop[channel]!, 0) / pool.length,
  ) as Rgba;
  const byLum = [...pool].sort((a, b) => luminance(a) - luminance(b));
  return {
    avg: withAlpha(avg, alpha),
    dark: withAlpha(byLum[0]!, alpha),
    light: withAlpha(byLum[byLum.length - 1]!, alpha),
  };
}

/** A picture's paint under a box; undefined while it hasn't been sampled (or can't be). */
function picturePaint(
  url: string,
  under: { u0: number; u1: number; v0: number; v1: number } | null,
): Paint | undefined {
  const sample = peekImageSample(url);
  if (!sample) return undefined;
  const region = under && sample.grid ? sampleRegion(sample, under.u0, under.v0, under.u1, under.v1) : null;
  const part = region ?? sample;
  return {
    avg: withAlpha(part.average, part.alpha),
    dark: withAlpha(part.dark, part.alpha),
    light: withAlpha(part.light, part.alpha),
  };
}

const SKIP = Symbol("skip");

/** The paint of one background-image layer under a box: SKIP when it paints too little of it, null when unknown. */
function layerPaint(
  style: CSSStyleDeclaration,
  layer: string,
  index: number,
  box: Box,
  rect: Box,
): Paint | null | typeof SKIP {
  const urls = cssImageUrls(layer);
  if (urls.length) {
    const sample = peekImageSample(urls[0]!);
    if (!sample) return null;
    const tile = layerTile(style, index, box, { width: sample.width, height: sample.height });
    if (!tile) return SKIP;
    const under = tileUnder(tile, rect);
    if (under.share < 0.5) return SKIP;
    return picturePaint(urls[0]!, under) ?? null;
  }
  if (layer === "none") return SKIP;
  const tile = layerTile(style, index, box, null);
  if (!tile || tileUnder(tile, rect).share < 0.5) return SKIP;
  return gradientPaint(layer);
}

/** Everything one element paints under a box, top first: border-image fill, picture/gradient layers, colour. */
function ownPaints(style: CSSStyleDeclaration, box: Box, rect: Box, opacity = 1): Paint[] | null {
  const paints: Paint[] = [];
  const add = (paint: Paint) =>
    paints.push(
      opacity >= 1
        ? paint
        : {
            avg: withAlpha(paint.avg, paint.avg[3] * opacity),
            dark: withAlpha(paint.dark, paint.dark[3] * opacity),
            light: withAlpha(paint.light, paint.light[3] * opacity),
          },
    );
  const borderImage = style.borderImageSource;
  if (borderImage && borderImage !== "none" && /\bfill\b/.test(style.borderImageSlice)) {
    const url = cssImageUrls(borderImage)[0];
    const paint = url ? picturePaint(url, null) : gradientPaint(borderImage);
    if (!paint) return null;
    add(paint);
  }
  const image = style.backgroundImage;
  if (image && image !== "none") {
    const layers = splitTopLevel(image);
    for (let index = 0; index < layers.length; index += 1) {
      const paint = layerPaint(style, layers[index]!, index, box, rect);
      if (paint === SKIP) continue;
      if (!paint) return null;
      add(paint);
    }
  }
  const color = parseColor(style.backgroundColor);
  if (color && color[3] > 0) add({ avg: color, dark: color, light: color });
  return paints;
}

/** A pseudo-element of an ancestor that paints a box-sized layer behind the text (art strips, plates). */
function pseudoPaints(node: Element, box: Box, rect: Box): Paint[] | null {
  const paints: Paint[] = [];
  for (const pseudo of ["::after", "::before"] as const) {
    const style = getComputedStyle(node, pseudo);
    if (!style.content || style.content === "none" || style.content === "normal") continue;
    if (style.display === "none" || style.visibility !== "visible") continue;
    if (style.position !== "absolute" && style.position !== "fixed") continue;
    if (style.mixBlendMode && style.mixBlendMode !== "normal") continue;
    const width = Number.parseFloat(style.width);
    const height = Number.parseFloat(style.height);
    if (!(width >= box.width * 0.5 && height >= box.height * 0.5)) continue;
    const pseudoBox: Box = { left: box.left, top: box.top, width, height };
    const own = ownPaints(
      style,
      pseudoBox,
      rect,
      Number.parseFloat(style.opacity || "1") * filterOpacity(style.filter),
    );
    if (!own) return null;
    paints.push(...own);
  }
  return paints;
}

/** The art behind everything: the app backdrop, when a theme paints one. */
function backdropPaint(rect: Box): Paint | null {
  const backdrop = document.querySelector('[data-mari-part="app-backdrop"]');
  if (!backdrop) return null;
  const style = getComputedStyle(backdrop);
  if (style.display === "none") return null;
  const box = backdrop.getBoundingClientRect();
  const paints = ownPaints(style, box, rect, Number.parseFloat(style.opacity || "1"));
  if (!paints || !paints.length) return null;
  return composite(paints, [255, 255, 255, 0]);
}

function composite(paints: Paint[], base: Rgba): Paint {
  let avg = base;
  let dark = base;
  let light = base;
  for (let index = paints.length - 1; index >= 0; index -= 1) {
    const paint = paints[index]!;
    avg = blend(paint.avg, avg);
    dark = blend(paint.dark, dark);
    light = blend(paint.light, light);
  }
  return { avg, dark, light };
}

/** `top` over `bottom`, keeping alpha (so a stack that never turns opaque can still sit on something). */
function blend(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3] + bottom[3] * (1 - top[3]);
  if (a <= 0) return [0, 0, 0, 0];
  const mix = (index: number) => (top[index]! * top[3] + bottom[index]! * bottom[3] * (1 - top[3])) / a;
  return [mix(0), mix(1), mix(2), a];
}

/**
 * What is painted behind a piece of text: every layer from the text's own element up to the first
 * opaque one (backgrounds, border-image fills, ancestors' art pseudo-elements), each weighted by the
 * area it paints under the text. Null when a picture in the way can't be read yet.
 */
export function paintBehind(element: Element, rectOverride?: Box): Behind | null {
  const rect: Box = rectOverride ?? element.getBoundingClientRect();
  const paints: Paint[] = [];
  let node: Element | null = element;
  const opaque = () => paints.length > 0 && paints[paints.length - 1]!.avg[3] >= 0.99;
  while (node) {
    const box = node.getBoundingClientRect();
    if (node !== element) {
      const pseudo = pseudoPaints(node, box, rect);
      if (!pseudo) return null;
      paints.push(...pseudo);
      if (opaque()) break;
    }
    const own = ownPaints(getComputedStyle(node), box, rect);
    if (!own) return null;
    paints.push(...own);
    if (opaque()) break;
    node = node.parentElement;
  }
  const base: Rgba = [255, 255, 255, 1];
  if (!opaque()) {
    const backdrop = backdropPaint(rect);
    if (backdrop) {
      const under = composite([backdrop], base);
      const stacked = composite(paints, under.avg);
      return {
        avg: stacked.avg,
        dark: composite(paints, under.dark).dark,
        light: composite(paints, under.light).light,
      };
    }
  }
  return composite(paints, base);
}

/** The lowest contrast of a text colour against what's behind it: the average, or the art's worst spot. */
function textContrast(fg: Rgba, behind: Behind, worst: boolean) {
  const against = worst ? [behind.avg, behind.dark, behind.light] : [behind.avg];
  return Math.min(...against.map((bg) => contrastRatio(over(fg, bg), bg)));
}

// ── Visibility ──

/** filter: opacity(x) and a near-black brightness() count as transparency. */
function filterOpacity(filter: string) {
  if (!filter || filter === "none") return 1;
  let factor = 1;
  for (const match of filter.matchAll(/(opacity|brightness)\(\s*([\d.]+)(%?)\s*\)/g)) {
    const value = Number.parseFloat(match[2]!) / (match[3] ? 100 : 1);
    if (!Number.isFinite(value)) continue;
    if (match[1] === "opacity") factor *= Math.min(1, value);
    else if (value < 0.15) factor *= value;
  }
  return factor;
}

function effectiveOpacity(element: Element) {
  let opacity = 1;
  let node: Element | null = element;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    opacity *= Number.parseFloat(style.opacity || "1") * filterOpacity(style.filter);
    if (opacity < 0.05) return opacity;
    node = node.parentElement;
  }
  return opacity;
}

function isShown(element: Element) {
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility !== "visible") return false;
  if (effectiveOpacity(element) < 0.35) return false;
  const rect = element.getBoundingClientRect();
  return rect.width >= 8 && rect.height >= 8;
}

function onScreen(box: DOMRect) {
  return box.right > 0 && box.bottom > 0 && box.left < window.innerWidth && box.top < window.innerHeight;
}

/** A control a person can see: on screen, visible, not faded out, with visible text or an icon. */
function controlVisible(control: Element) {
  const box = control.getBoundingClientRect();
  if (box.width < 4 || box.height < 4 || !onScreen(box)) return false;
  const style = getComputedStyle(control);
  if (style.visibility !== "visible" || effectiveOpacity(control) < 0.2) return false;
  if (maskedOut(control)) return false;
  if (Number.parseFloat(style.fontSize) < 3 && !control.querySelector("svg, img")) return false;
  const fill = parseColor(style.webkitTextFillColor || style.color);
  const hasText = (control.textContent ?? "").trim().length > 0;
  const icon = control.querySelector("svg, img");
  if (hasText && fill && fill[3] < 0.1 && !textIsClipped(control) && !icon) return false;
  if (!hasText && icon) {
    const iconStyle = getComputedStyle(icon);
    const iconBox = icon.getBoundingClientRect();
    if (iconStyle.visibility !== "visible" || iconBox.width < 3 || iconBox.height < 3) return false;
    if (Number.parseFloat(iconStyle.opacity || "1") * filterOpacity(iconStyle.filter) < 0.2) return false;
  }
  return true;
}

/** A picture mask on the control or close above it (a mask can erase a label as well as opacity can). */
function maskedOut(element: Element) {
  let node: Element | null = element;
  for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
    const style = getComputedStyle(node) as CSSStyleDeclaration & { webkitMaskImage?: string };
    const mask = style.maskImage || style.webkitMaskImage || "";
    if (/url\(/.test(mask)) return true;
  }
  return false;
}

/** Gradient-clipped text (background-clip: text) is painted by its background, not its colour. */
function textIsClipped(element: Element) {
  let node: Element | null = element;
  for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
    const style = getComputedStyle(node) as CSSStyleDeclaration & { webkitBackgroundClip?: string };
    if (style.backgroundClip === "text" || style.webkitBackgroundClip === "text") return true;
  }
  return false;
}

/**
 * How much a control's own ::before/::after hides its label: a positioned pseudo-element that stacks
 * above the control's content (z-index auto or 0 and up) and spans most of it, like a picture on a
 * chat row's ::after. One stacked under the content (a negative z-index) is a background and passes.
 */
function ownPseudoOver(control: Element): number {
  const box = control.getBoundingClientRect();
  let most = 0;
  for (const pseudo of ["::before", "::after"] as const) {
    const style = getComputedStyle(control, pseudo);
    if (!style.content || style.content === "none" || style.content === "normal") continue;
    if (style.position !== "absolute" && style.position !== "fixed") continue;
    const z = Number.parseInt(style.zIndex, 10);
    if (Number.isFinite(z) && z < 0) continue;
    const width = Number.parseFloat(style.width);
    const height = Number.parseFloat(style.height);
    if (!(width * height >= box.width * box.height * 0.5)) continue;
    most = Math.max(most, paintCoverage(style));
  }
  return most;
}

/** Points to hit-test: the centre of the first few controls, or the area's centre. */
function samplePoints(element: Element): SamplePoint[] {
  const points: SamplePoint[] = [];
  for (const control of Array.from(element.querySelectorAll(CONTROL_SELECTOR)).slice(0, 24)) {
    const rect = control.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4 || !onScreen(rect)) continue;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    // Only controls a person can reach without the theme (a sidebar's header can sit under the top bar).
    const hit = document.elementFromPoint(x, y);
    if (hit && !control.contains(hit) && !hit.closest(OVERLAY_SELECTOR)) continue;
    points.push({ x, y, control });
    if (points.length >= 5) break;
  }
  if (points.length === 0) {
    const rect = element.getBoundingClientRect();
    points.push({ x: rect.left + rect.width / 2, y: rect.top + Math.min(rect.height / 2, 40), control: null });
  }
  return points;
}

/** Elements holding visible text in an area (the first `limit` of them, one per element). */
function textSamples(element: Element, limit: number): Element[] {
  const found: Element[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && found.length < limit; node = walker.nextNode()) {
    if (!node.textContent || node.textContent.trim().length <= 1 || !node.parentElement) continue;
    const parent = node.parentElement;
    if (found.includes(parent)) continue;
    const rect = parent.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || !onScreen(rect)) continue;
    if (limit > 1 && (getComputedStyle(parent).visibility !== "visible" || effectiveOpacity(parent) < 0.35)) continue;
    found.push(parent);
  }
  return found;
}

/** Where people read in each area: the top bar's labels, the message box's text field, else the first text. */
function contrastSamples(element: Element, area: Area): Element[] {
  if (area === "composer") {
    const field = element.querySelector('textarea, [contenteditable="true"]');
    return field ? [field] : textSamples(element, 1);
  }
  return textSamples(element, area === "topbar" ? 8 : 1);
}

/** The top bar and the message box are judged by the worst spot of any art behind them, at 3:1. */
const STRICT_CONTRAST: ReadonlySet<Area> = new Set<Area>(["topbar", "composer"]);

function contrastMap(element: Element, area: Area) {
  const result = new Map<Element, number>();
  for (const sample of contrastSamples(element, area)) {
    if (textIsClipped(sample)) continue;
    const style = getComputedStyle(sample);
    const fg = parseColor(style.webkitTextFillColor || style.color);
    if (!fg) continue;
    if (fg[3] < 0.1) {
      result.set(sample, 1);
      continue;
    }
    const behind = paintBehind(sample);
    if (behind) result.set(sample, textContrast(fg, behind, STRICT_CONTRAST.has(area)));
  }
  return result;
}

function pointFor(point: SamplePoint) {
  let { x, y } = point;
  const { control } = point;
  if (control) {
    const box = control.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) return null;
    x = box.left + (point.offset ? Math.min(point.offset.x, box.width / 2) : box.width / 2);
    y = box.top + (point.offset ? Math.min(point.offset.y, box.height - 4) : box.height / 2);
  }
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
  return { x, y };
}

/** Whether clicks still reach each sampled control, wherever the theme has moved it to. */
function hitTest(element: Element, points: SamplePoint[]) {
  return points.map((point) => {
    const at = pointFor(point);
    if (!at) return false;
    const hit = document.elementFromPoint(at.x, at.y);
    if (!hit) return false;
    if (hit.closest(OVERLAY_SELECTOR)) return true;
    return point.control ? point.control.contains(hit) : element.contains(hit);
  });
}

/**
 * Whether each sampled control can still be SEEN. Run while the protected layer makes every
 * element and pseudo-element hit-testable (html[data-mari-guard-pierce]), so whatever paints on top
 * at the control's centre is what elementFromPoint returns, pointer-events: none or not. A pseudo-
 * element answers as its element; an ancestor answering means one of its pseudo-elements is on top.
 * Mostly see-through layers (scanlines, a vignette, a rain overlay with transparent pixels) pass.
 */
function seeTest(element: Element, points: SamplePoint[]) {
  return points.map((point) => {
    const at = pointFor(point);
    if (!at) return false;
    const target = point.control ?? element;
    // Everything painted at the point, top first. Layers above the control add up.
    let through = 1;
    for (const hit of document.elementsFromPoint(at.x, at.y)) {
      // The control itself answering can mean its own ::before/::after is on top of its label.
      if (hit === target) {
        through *= 1 - Math.min(1, ownPseudoOver(target));
        if (through <= 0.4) return false;
        break;
      }
      if (target.contains(hit)) break;
      if (hit.closest(OVERLAY_SELECTOR)) return true;
      const ancestor = hit.contains(target);
      const coverage = ancestor
        ? pseudoCoverage(hit)
        : Math.max(paintCoverage(getComputedStyle(hit)), pseudoCoverage(hit));
      through *= 1 - Math.min(1, coverage * effectiveOpacity(hit));
      if (through <= 0.4) return false;
    }
    return true;
  });
}

/** Rules in the given stylesheets whose declarations mention a border image (they may have an outset). */
function borderImageSelectors(sheets: HTMLStyleElement[]) {
  const selectors = new Set<string>();
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        if (/border-image/i.test(rule.style.cssText)) selectors.add(rule.selectorText);
        if ("cssRules" in rule && rule.cssRules) walk(rule.cssRules as CSSRuleList);
      } else if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) {
        walk((rule as CSSGroupingRule).cssRules);
      }
    }
  };
  for (const sheet of sheets) {
    try {
      if (sheet.sheet) walk(sheet.sheet.cssRules);
    } catch {
      /* unreadable sheet */
    }
  }
  return [...selectors];
}

function outsetPx(value: string, widths: number[]) {
  const parts = value.trim().split(/\s+/);
  const read = (part: string | undefined, width: number) => {
    if (!part) return 0;
    const number = Number.parseFloat(part);
    if (!Number.isFinite(number)) return 0;
    return /px$/.test(part) ? number : number * width;
  };
  const top = read(parts[0], widths[0]!);
  const right = read(parts[1] ?? parts[0], widths[1]!);
  const bottom = read(parts[2] ?? parts[0], widths[2]!);
  const left = read(parts[3] ?? parts[1] ?? parts[0], widths[3]!);
  return { top, right, bottom, left };
}

/**
 * Elements whose border-image outset paints over a protected control (outset paint takes no
 * clicks, so the hit tests can't see it). Returns the areas whose controls are painted over.
 */
function outsetCovers(
  sheets: HTMLStyleElement[],
  targets: Array<{ area: Area; element: Element }>,
  points: Map<Element, SamplePoint[]>,
) {
  const covered = new Set<Area>();
  const elements: Element[] = [];
  for (const selector of borderImageSelectors(sheets)) {
    const clean = selector.replace(/::?(before|after|marker|first-line|first-letter)\b/g, "");
    try {
      for (const element of Array.from(document.querySelectorAll(clean)).slice(0, 30)) elements.push(element);
    } catch {
      /* a selector this browser can't query */
    }
    if (elements.length > 120) break;
  }
  if (document.documentElement.hasAttribute("data-mari-focus-frame")) {
    for (const element of Array.from(document.querySelectorAll(FOCUS_SURFACES)).slice(0, 30)) elements.push(element);
  }
  for (const element of elements) {
    const style = getComputedStyle(element);
    if (!style.borderImageSource || style.borderImageSource === "none") continue;
    const widths = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(
      (width) => Number.parseFloat(width) || 0,
    );
    const outset = outsetPx(style.borderImageOutset, widths);
    if (Math.max(outset.top, outset.right, outset.bottom, outset.left) <= 2) continue;
    const box = element.getBoundingClientRect();
    const outer = {
      left: box.left - outset.left,
      right: box.right + outset.right,
      top: box.top - outset.top,
      bottom: box.bottom + outset.bottom,
    };
    for (const { area, element: target } of targets) {
      if (element.contains(target)) continue; // an ancestor's border paints under its contents
      for (const point of points.get(target) ?? []) {
        if (!point.control || element.contains(point.control) || point.control.contains(element)) continue;
        const at = pointFor(point);
        if (!at) continue;
        const inside = at.x >= outer.left && at.x <= outer.right && at.y >= outer.top && at.y <= outer.bottom;
        const inOwnBox = at.x >= box.left && at.x <= box.right && at.y >= box.top && at.y <= box.bottom;
        if (inside && !inOwnBox) covered.add(area);
      }
    }
  }
  return covered;
}

function snapshot(element: Element, area: Area, points: SamplePoint[] | null): Snapshot {
  const rect = element.getBoundingClientRect();
  const shown = isShown(element);
  const hitOk = points ? hitTest(element, points) : [];
  const contrast = contrastMap(element, area);
  let controls = 0;
  for (const control of Array.from(element.querySelectorAll(CONTROL_SELECTOR)).slice(0, 40)) {
    if (controlVisible(control) && ownPseudoOver(control) < 0.6) controls += 1;
  }
  let rows = 0;
  for (const row of Array.from(element.querySelectorAll("[data-chat-row]")).slice(0, 12)) {
    if (controlVisible(row) && ownPseudoOver(row) < 0.6) rows += 1;
  }
  return { rect, shown, hitOk, contrast, controls, rows };
}

function onScreenShare(rect: DOMRect) {
  const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
  const area = rect.width * rect.height;
  return area > 0 ? (width * height) / area : 0;
}

const PSEUDO_HOSTS =
  'html, body, #root, [data-component="AppShell"], [data-component="AppShell"] > *, [data-component="OverhaulShellRow"], [data-component="OverhaulShellRow"] > *, main';

/** Elements whose ::before/::after could be laid over the protected areas. */
function overlayHosts(targets: Element[]) {
  const hosts = new Set<Element>(Array.from(document.querySelectorAll(PSEUDO_HOSTS)));
  for (const target of targets) {
    for (let node: Element | null = target; node; node = node.parentElement) hosts.add(node);
  }
  return Array.from(hosts);
}

/**
 * A big, mostly opaque ::before/::after laid over the app (it takes no clicks, but hides everything).
 * Colours, gradients of opaque stops and pictures with mostly opaque pixels count; blend modes
 * don't. A layer with a negative z-index sits under the app (like the stock backdrop) and is skipped.
 */
function opaquePseudoOverlay(hosts: Element[]): boolean {
  const viewport = window.innerWidth * window.innerHeight;
  for (const host of hosts) {
    for (const pseudo of ["::before", "::after"] as const) {
      const style = getComputedStyle(host, pseudo);
      if (!style.content || style.content === "none" || style.content === "normal") continue;
      if (style.position !== "fixed" && style.position !== "absolute") continue;
      if (style.display === "none" || style.visibility !== "visible") continue;
      if (Number.parseInt(style.zIndex, 10) < 0) continue;
      const width = Number.parseFloat(style.width);
      const height = Number.parseFloat(style.height);
      if (!(width * height >= viewport * 0.5)) continue;
      if (paintCoverage(style) >= 0.6) return true;
    }
  }
  return false;
}

/**
 * The ambient overlay (rain, leaves, scanlines) sits over the chat and under the protected bars.
 * It has to stay mostly see-through: a solid picture there would hide the chat.
 */
/** Blend modes that keep the chat underneath recognisable; any other one repaints it (a negative, a burn). */
const GENTLE_BLENDS = new Set(["normal", "screen", "overlay", "soft-light", "multiply", "lighten", "darken"]);

function ambientTooSolid() {
  const ambient = document.querySelector('[data-mari-part="ambient"]');
  if (!ambient) return false;
  // Placed behind the cards it's part of the backdrop, not a layer over the text, but a solid one
  // blanks the whole chat area round the cards (names and times sit on it), so that still counts.
  const behind = document.documentElement.hasAttribute("data-mari-ambient-behind");
  const style = getComputedStyle(ambient);
  if (style.display === "none" || style.visibility !== "visible") return false;
  const opacity = Number.parseFloat(style.opacity || "1") * filterOpacity(style.filter);
  // paintCoverage ignores blended layers (fine for decorations); here a harsh blend counts like
  // a normal layer, since `difference` with white turns the whole chat into a negative.
  const blend = style.mixBlendMode || "normal";
  const solid = (layer: CSSStyleDeclaration) => {
    if (layer.display === "none" || layer.visibility !== "visible") return 0;
    let cover = parseColor(layer.backgroundColor)?.[3] ?? 0;
    cover = Math.max(cover, imageCoverage(layer.backgroundImage));
    return cover;
  };
  let coverage = solid(style) * opacity;
  for (const pseudo of ["::before", "::after"] as const) {
    const layer = getComputedStyle(ambient, pseudo);
    if (!layer.content || layer.content === "none" || layer.content === "normal") continue;
    coverage = Math.max(coverage, solid(layer) * Number.parseFloat(layer.opacity || "1") * opacity);
  }
  if (behind) return blend === "normal" && coverage >= 0.9;
  if (!GENTLE_BLENDS.has(blend)) return coverage > 0.5;
  if (blend !== "normal") return false;
  return coverage >= 0.6;
}

/** Surfaces the focus-frame slot paints (theme-tokens.css), checked for outsets like a theme's own border images. */
const FOCUS_SURFACES = [
  '[data-mari-part="message"][data-latest] .mari-message-bubble',
  '[data-mari-part="message"][data-latest]:not(:has(.mari-message-bubble))',
  '[data-component="GlobalOmnibar.Panel"]',
  '[role="dialog"]',
  '[data-home-widget-id="recent"] [data-mari-part="home-widget"]',
  "[data-mari-focus-surface]",
].join(",");

/**
 * Round 5: the chat itself. A point on the first line of each of the last few messages on screen;
 * whatever paints over them (an overlay, a fixed strip, a border-image outset) makes the chat
 * unreadable even though the bars still work.
 */
function chatTextPoints(): SamplePoint[] {
  const points: SamplePoint[] = [];
  const contents = Array.from(document.querySelectorAll(".mari-message-content")).slice(-8).reverse();
  for (const content of contents) {
    if (content.closest('[aria-hidden="true"], [inert]')) continue;
    const rect = content.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 8 || !onScreen(rect)) continue;
    // A line near the top of the part that's on screen (a long reply may start far above it).
    const scroller = content.closest("[data-chat-scroll]")?.getBoundingClientRect();
    // A name line the theme pins to the top of the reply (--mari-pinned-speaker) covers text by design.
    const pinned = content.closest(".mari-rp-bubble")?.querySelector(".ov-rpmsg__head")?.getBoundingClientRect();
    const visibleTop = Math.max(
      rect.top,
      scroller?.top ?? 0,
      0,
      pinned && pinned.bottom > rect.top ? pinned.bottom : 0,
    );
    const y = Math.min(visibleTop + 12, rect.top + rect.height / 2, rect.bottom - 4);
    if (y < visibleTop - 1 || y > window.innerHeight) continue;
    const x = rect.left + Math.min(rect.width / 2, 160);
    points.push({ x, y, control: content, offset: { x: x - rect.left, y: y - rect.top } });
    if (points.length >= 4) break;
  }
  return points;
}

/** Whether a chat sample point is inside the transcript's visible box (not scrolled under the top bar). */
function chatPointInView(host: Element, point: SamplePoint) {
  const at = pointFor(point);
  if (!at) return false;
  const inside = (box: DOMRect) => at.x >= box.left && at.x <= box.right && at.y >= box.top && at.y <= box.bottom;
  if (!inside(host.getBoundingClientRect())) return false;
  // Text that has scrolled up under the (protected) top bar is meant to be covered by it.
  const bar = document.querySelector('[data-component="TopBar"]');
  return !(bar && inside(bar.getBoundingClientRect()));
}

/**
 * Pictures a theme hangs on the top bar's own ::before/::after or on a strip inside it (not on one
 * control): that's bar art like --mari-top-bar-bg, so the tabs get their plates too.
 */
export function topBarPseudoArt(): boolean {
  const bar = document.querySelector('[data-component="TopBar"]');
  if (!bar) return false;
  const controls = "button, a, [role='tab'], .ov-tab, .ov-mark";
  const nodes = [bar, ...Array.from(bar.querySelectorAll("*")).slice(0, 200)];
  for (const node of nodes) {
    if (node !== bar && node.closest(controls)) continue;
    for (const pseudo of ["::before", "::after"] as const) {
      const style = getComputedStyle(node, pseudo);
      if (!style.content || style.content === "none" || style.content === "normal") continue;
      if (/url\(/.test(style.backgroundImage) || /url\(/.test(style.borderImageSource) || /url\(/.test(style.content))
        return true;
    }
  }
  return false;
}

/** Quoted strings in a computed `content` value. */
function contentText(value: string) {
  if (!value || value === "none" || value === "normal") return "";
  return Array.from(value.matchAll(/"((?:[^"\\]|\\.)*)"/g), (match) => match[1]!.replace(/\\(.)/g, "$1"))
    .join("")
    .trim();
}

/** The message box, the latest messages and the page around them: where fake prompts would go. */
function chatTextElements(): Element[] {
  const elements: Element[] = [];
  const add = (root: Element | null, limit: number) => {
    if (!root) return;
    elements.push(root);
    for (const child of Array.from(root.querySelectorAll("*")).slice(0, limit)) elements.push(child);
  };
  add(document.querySelector('[data-mari-part="composer"]'), 120);
  const messages = Array.from(document.querySelectorAll('[data-mari-part="message"]')).slice(-6);
  for (const message of messages) add(message, 60);
  const main = document.querySelector("main");
  if (main) {
    elements.push(main);
    for (const child of Array.from(main.children)) elements.push(child);
  }
  return elements;
}

function pseudoTexts(elements: Element[]) {
  const texts = new Map<Element, string>();
  for (const element of elements) {
    const text = ["::before", "::after"]
      .map((pseudo) => contentText(getComputedStyle(element, pseudo).content))
      .filter(Boolean)
      .join(" ");
    if (text) texts.set(element, text);
  }
  return texts;
}

/** Text a theme adds that asks for keys, passwords or sign-ins. */
export function looksLikeSecretRequest(text: string) {
  return text.replace(/\s+/g, " ").trim().length >= 6 && SENSITIVE_TEXT.test(text);
}

/**
 * Compare every protected area with and without the given stylesheets. Returns what the CSS broke.
 * Areas that are closed (or hidden by the app itself) are skipped.
 */
export function checkProtectedChrome(sheets: HTMLStyleElement[]): ThemeGuardProblem[] {
  const active = sheets.filter((sheet) => sheet.isConnected && sheet.textContent);
  if (active.length === 0 || typeof document === "undefined") return [];
  const root = document.documentElement;
  const targets = AREAS.flatMap(({ area, selector }) =>
    Array.from(document.querySelectorAll(selector))
      .filter((element) => !element.closest('[aria-hidden="true"], [inert]'))
      .map((element) => ({ area, element })),
  );
  if (targets.length === 0) return [];
  const hosts = overlayHosts(targets.map(({ element }) => element));
  const textElements = chatTextElements();
  const chatPoints = chatTextPoints();
  const chatHost = chatPoints[0]?.control?.closest("[data-chat-scroll], main") ?? null;
  let chatSeenBefore: boolean[] = [];
  let chatSeenAfter: boolean[] = [];
  let chatOnScreen: boolean[] = [];
  let chatInViewBefore: boolean[] = [];

  // The protected layer reveals an auto-hidden top bar and stops transitions while this attribute is set.
  // The page is measured as it is first (so rules that only kick in after a delay, which restart
  // when the sheet is switched back on, are seen), then without the theme, then the theme's clicks.
  root.dataset.mariGuardMeasure = "true";
  // Art on the bar's own pseudo-elements gets plates like --mari-top-bar-bg (CustomThemeInjector sets
  // this for the active theme; a theme being previewed or imported is measured the same way).
  const tempPlates = root.dataset.mariTopBarArt === undefined && topBarPseudoArt();
  if (tempPlates) root.dataset.mariTopBarArt = "";
  const previousMedia = active.map((sheet) => sheet.media);
  const points = new Map<Element, SamplePoint[]>();
  let before: Map<Element, Snapshot>;
  let after: Map<Element, Snapshot>;
  let overlayBefore: boolean;
  let overlayAfter: boolean;
  let textBefore: Map<Element, string>;
  let textAfter: Map<Element, string>;
  let outset: Set<Area>;
  try {
    after = new Map(targets.map(({ area, element }) => [element, snapshot(element, area, null)]));
    overlayAfter = opaquePseudoOverlay(hosts);
    textAfter = pseudoTexts(textElements);
    try {
      active.forEach((sheet) => (sheet.media = "not all"));
      overlayBefore = opaquePseudoOverlay(hosts);
      textBefore = pseudoTexts(textElements);
      before = new Map(
        targets.map(({ area, element }) => {
          const elementPoints = samplePoints(element);
          points.set(element, elementPoints);
          return [element, snapshot(element, area, elementPoints)];
        }),
      );
      root.dataset.mariGuardPierce = "true";
      try {
        for (const { element } of targets) {
          const seen = seeTest(element, points.get(element) ?? []);
          const snap = before.get(element)!;
          snap.hitOk = snap.hitOk.map((ok, index) => ok && seen[index] !== false);
        }
        if (chatHost) {
          chatSeenBefore = seeTest(chatHost, chatPoints);
          chatInViewBefore = chatPoints.map((point) => chatPointInView(chatHost, point));
        }
      } finally {
        delete root.dataset.mariGuardPierce;
      }
    } finally {
      active.forEach((sheet, index) => (sheet.media = previousMedia[index] ?? ""));
    }
    for (const { element } of targets) after.get(element)!.hitOk = hitTest(element, points.get(element) ?? []);
    root.dataset.mariGuardPierce = "true";
    try {
      for (const { element } of targets) {
        const seen = seeTest(element, points.get(element) ?? []);
        const snap = after.get(element)!;
        snap.hitOk = snap.hitOk.map((ok, index) => ok && seen[index] !== false);
      }
      if (chatHost) {
        chatSeenAfter = seeTest(chatHost, chatPoints);
        chatOnScreen = chatPoints.map((point) => chatPointInView(chatHost, point));
      }
    } finally {
      delete root.dataset.mariGuardPierce;
    }
    if (chatHost) points.set(chatHost, chatPoints);
    outset = outsetCovers(active, chatHost ? [...targets, { area: "chat", element: chatHost }] : targets, points);
  } finally {
    delete root.dataset.mariGuardMeasure;
    if (tempPlates) delete root.dataset.mariTopBarArt;
  }

  const problems: ThemeGuardProblem[] = [];
  if (overlayAfter && !overlayBefore) problems.push({ area: "app", kind: "overlay" });
  else if (ambientTooSolid()) problems.push({ area: "app", kind: "overlay" });
  for (const [element, text] of textAfter) {
    if (textBefore.get(element) === text || !looksLikeSecretRequest(text)) continue;
    problems.push({ area: "chat", kind: "fake-text", text: text.slice(0, 80) });
    break;
  }
  // The chat's text: painted over at half the sampled lines that were readable without the theme.
  const chatReadable = chatSeenBefore.filter((seen, index) => seen && chatInViewBefore[index]).length;
  // A line the theme's own layout moved off screen (a narrower column, taller lines) isn't painted over.
  const chatLost = chatSeenBefore.filter(
    (seen, index) => seen && chatInViewBefore[index] && chatSeenAfter[index] === false && chatOnScreen[index],
  ).length;
  if (outset.has("chat") || (chatReadable > 0 && chatLost * 2 >= chatReadable))
    problems.push({ area: "chat", kind: "unreadable" });
  for (const { area, element } of targets) {
    const was = before.get(element)!;
    const now = after.get(element)!;
    if (!was.shown) continue;
    const report = (kind: ThemeGuardProblem["kind"]) => {
      if (!problems.some((problem) => problem.area === area)) problems.push({ area, kind });
    };
    if (!now.shown) {
      report("hidden");
      continue;
    }
    if (onScreenShare(now.rect) < 0.6 && onScreenShare(was.rect) >= 0.9) {
      report("moved");
      continue;
    }
    const dx = Math.abs(now.rect.left - was.rect.left);
    const dy = Math.abs(now.rect.top - was.rect.top);
    const movedEdge =
      area === "topbar"
        ? dy > 24
        : area === "chats"
          ? dx > 40
          : area === "library"
            ? Math.abs(now.rect.right - was.rect.right) > 40
            : false;
    if (movedEdge) {
      report("moved");
      continue;
    }
    // A picture (list-style-image, content: url()) can blow the bar up and push its tabs away.
    if (area === "topbar" && now.rect.height > Math.max(was.rect.height * 2, was.rect.height + 64)) {
      report("moved");
      continue;
    }
    if (outset.has(area)) {
      report("covered");
      continue;
    }
    if (
      (area === "topbar" && now.rect.height < was.rect.height * 0.6) ||
      ((area === "chats" || area === "library") && now.rect.width < was.rect.width * 0.5)
    ) {
      report("too-small");
      continue;
    }
    if ((was.controls >= 2 && now.controls < was.controls * 0.6) || (was.rows >= 1 && now.rows === 0)) {
      report("hidden");
      continue;
    }
    const lostHits = was.hitOk.filter((ok, index) => ok && !now.hitOk[index]).length;
    const keptHits = was.hitOk.filter(Boolean).length;
    if (keptHits > 0 && lostHits * 2 >= keptHits) {
      report("covered");
      continue;
    }
    // Text that was readable without the theme and isn't with it. The top bar and the message box
    // must keep 3:1 against the worst spot of any art behind them; elsewhere 1.5:1 on average.
    const strict = STRICT_CONTRAST.has(area);
    let unreadable = false;
    for (const [sample, value] of now.contrast) {
      const before = was.contrast.get(sample) ?? (was.contrast.size ? null : 4.5);
      if (before === null) continue;
      if ((value < 1.5 && before >= 2.5) || (strict && value < 3 && before >= 3)) unreadable = true;
    }
    if (unreadable) report("unreadable");
  }
  return problems;
}

/** Theme CSS as it would be injected: sanitised, its pictures as blob: URLs, plus its !important copy. */
function injectableCss(css: string, images?: ThemeImage[] | null) {
  const sanitized = prepareThemeCss(sanitizeAppCss(css), images).css;
  return [sanitized, extractImportantThemeCss(sanitized)];
}

/**
 * Checks theme CSS that isn't applied yet (an import preview, the editor's Save): the CSS is
 * switched on for this one task, measured against the page without it, and removed again before
 * the browser paints, so nothing flashes. Pictures that haven't been sampled yet count as solid;
 * use checkThemeCssReady to sample them first.
 */
export function checkThemeCss(css: string, images?: ThemeImage[] | null): ThemeGuardProblem[] {
  if (typeof document === "undefined") return [];
  const sheets: HTMLStyleElement[] = [];
  try {
    for (const text of injectableCss(css, images)) {
      if (!text) continue;
      const style = document.createElement("style");
      style.dataset.mariCustomCss = "check";
      style.textContent = text;
      document.head.appendChild(style);
      sheets.push(style);
    }
    return checkProtectedChrome(sheets);
  } finally {
    sheets.forEach((sheet) => sheet.remove());
  }
}

/** checkThemeCss after the theme's pictures have been sampled (so see-through art isn't called solid). */
export async function checkThemeCssReady(css: string, images?: ThemeImage[] | null): Promise<ThemeGuardProblem[]> {
  if (typeof document === "undefined") return [];
  await preloadImageSamples(injectableCss(css, images)[0] ?? "");
  return checkThemeCss(css, images);
}
