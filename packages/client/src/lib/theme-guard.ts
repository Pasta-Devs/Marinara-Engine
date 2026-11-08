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
import { cssImageUrls, peekImageSample, preloadImageSamples, prepareThemeCss, type ThemeImage } from "./theme-images";

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
  contrast: number | null;
}

interface SamplePoint {
  x: number;
  y: number;
  /** The control under the point; a hit must land on it (or inside it). Null = anywhere in the area. */
  control: Element | null;
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

/** The art behind everything: the app backdrop's colour, when a theme paints one. */
function backdropColor(): Rgba | null {
  const backdrop = document.querySelector('[data-mari-part="app-backdrop"]');
  if (!backdrop) return null;
  const style = getComputedStyle(backdrop);
  if (style.display === "none") return null;
  let result: Rgba | null = null;
  const color = parseColor(style.backgroundColor);
  if (color && color[3] > 0) result = color;
  for (const url of cssImageUrls(style.backgroundImage)) {
    const sample = peekImageSample(url);
    if (!sample) continue;
    const layer: Rgba = [...sample.average, sample.alpha];
    result = result ? over(layer, result) : layer;
  }
  const opacity = Number.parseFloat(style.opacity || "1");
  return result ? [result[0], result[1], result[2], result[3] * opacity] : null;
}

/**
 * The colour behind an element: translucent backgrounds are blended down to the first opaque one.
 * Null when a picture (or a gradient that isn't one flat colour) is in the way.
 */
function backgroundBehind(element: Element): Rgba | null {
  const layers: Rgba[] = [];
  let node: Element | null = element;
  while (node) {
    const style = getComputedStyle(node);
    if (style.backgroundImage && style.backgroundImage !== "none") {
      const urls = cssImageUrls(style.backgroundImage);
      if (urls.length) {
        // A picture: its sampled average colour, as opaque as its pixels are.
        for (const url of urls) {
          const sample = peekImageSample(url);
          if (!sample) return null;
          layers.push([...sample.average, sample.alpha]);
        }
      } else {
        const stops = gradientColors(style.backgroundImage);
        if (!stops) return null;
        const first = stops[0]!;
        const flat = stops.every(
          (stop) => Math.abs(stop[0] - first[0]) + Math.abs(stop[1] - first[1]) + Math.abs(stop[2] - first[2]) < 30,
        );
        if (!flat) return null;
        layers.push([first[0], first[1], first[2], Math.min(...stops.map((stop) => stop[3]))]);
      }
    }
    const color = parseColor(style.backgroundColor);
    if (color && color[3] > 0) layers.push(color);
    if (layers.length && layers[layers.length - 1]![3] >= 0.99) break;
    node = node.parentElement;
  }
  let result: Rgba = [255, 255, 255, 1];
  if (!layers.length || layers[layers.length - 1]![3] < 0.99) {
    const backdrop = backdropColor();
    if (backdrop) result = over(backdrop, result);
  }
  for (let index = layers.length - 1; index >= 0; index -= 1) result = over(layers[index]!, result);
  return result;
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

function textSample(element: Element): Element | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent && node.textContent.trim().length > 1 && node.parentElement) {
      const parent = node.parentElement;
      const rect = parent.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && onScreen(rect)) return parent;
    }
  }
  return null;
}

function pointFor(point: SamplePoint) {
  let { x, y } = point;
  const { control } = point;
  if (control) {
    const box = control.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) return null;
    x = box.left + box.width / 2;
    y = box.top + box.height / 2;
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
      if (target === hit || target.contains(hit)) break;
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

function snapshot(element: Element, points: SamplePoint[] | null): Snapshot {
  const rect = element.getBoundingClientRect();
  const shown = isShown(element);
  const hitOk = points ? hitTest(element, points) : [];
  let contrast: number | null = null;
  const sample = textSample(element);
  if (sample && !textIsClipped(sample)) {
    const style = getComputedStyle(sample);
    const fg = parseColor(style.webkitTextFillColor || style.color);
    const bg = backgroundBehind(sample);
    if (fg && fg[3] < 0.1) contrast = 1;
    else if (fg && bg) contrast = contrastRatio(over(fg, bg), bg);
  }
  let controls = 0;
  for (const control of Array.from(element.querySelectorAll(CONTROL_SELECTOR)).slice(0, 40)) {
    if (controlVisible(control)) controls += 1;
  }
  let rows = 0;
  for (const row of Array.from(element.querySelectorAll("[data-chat-row]")).slice(0, 12)) {
    if (controlVisible(row)) rows += 1;
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
function ambientTooSolid() {
  const ambient = document.querySelector('[data-mari-part="ambient"]');
  if (!ambient) return false;
  const style = getComputedStyle(ambient);
  if (style.display === "none") return false;
  const own = paintCoverage(style);
  return Math.max(own, pseudoCoverage(ambient) * Number.parseFloat(style.opacity || "1")) >= 0.6;
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

  // The protected layer reveals an auto-hidden top bar and stops transitions while this attribute is set.
  // The page is measured as it is first (so rules that only kick in after a delay, which restart
  // when the sheet is switched back on, are seen), then without the theme, then the theme's clicks.
  root.dataset.mariGuardMeasure = "true";
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
    after = new Map(targets.map(({ element }) => [element, snapshot(element, null)]));
    overlayAfter = opaquePseudoOverlay(hosts);
    textAfter = pseudoTexts(textElements);
    try {
      active.forEach((sheet) => (sheet.media = "not all"));
      overlayBefore = opaquePseudoOverlay(hosts);
      textBefore = pseudoTexts(textElements);
      before = new Map(
        targets.map(({ element }) => {
          const elementPoints = samplePoints(element);
          points.set(element, elementPoints);
          return [element, snapshot(element, elementPoints)];
        }),
      );
      root.dataset.mariGuardPierce = "true";
      try {
        for (const { element } of targets) {
          const seen = seeTest(element, points.get(element) ?? []);
          const snap = before.get(element)!;
          snap.hitOk = snap.hitOk.map((ok, index) => ok && seen[index] !== false);
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
    } finally {
      delete root.dataset.mariGuardPierce;
    }
    outset = outsetCovers(active, targets, points);
  } finally {
    delete root.dataset.mariGuardMeasure;
  }

  const problems: ThemeGuardProblem[] = [];
  if (overlayAfter && !overlayBefore) problems.push({ area: "app", kind: "overlay" });
  else if (ambientTooSolid()) problems.push({ area: "app", kind: "overlay" });
  for (const [element, text] of textAfter) {
    if (textBefore.get(element) === text || !looksLikeSecretRequest(text)) continue;
    problems.push({ area: "chat", kind: "fake-text", text: text.slice(0, 80) });
    break;
  }
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
    if (now.contrast !== null && now.contrast < 1.5 && (was.contrast ?? 4.5) >= 2.5) report("unreadable");
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
