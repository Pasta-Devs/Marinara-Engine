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
// ──────────────────────────────────────────────
import type { ThemeGuardProblem } from "./theme-safety";

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
      const stops = gradientColors(style.backgroundImage);
      if (!stops) return null;
      const first = stops[0]!;
      const flat = stops.every(
        (stop) => Math.abs(stop[0] - first[0]) + Math.abs(stop[1] - first[1]) + Math.abs(stop[2] - first[2]) < 30,
      );
      if (!flat) return null;
      layers.push([first[0], first[1], first[2], Math.min(...stops.map((stop) => stop[3]))]);
    }
    const color = parseColor(style.backgroundColor);
    if (color && color[3] > 0) layers.push(color);
    if (layers.length && layers[layers.length - 1]![3] >= 0.99) break;
    node = node.parentElement;
  }
  let result: Rgba = [255, 255, 255, 1];
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
  for (const control of Array.from(element.querySelectorAll(CONTROL_SELECTOR)).slice(0, 8)) {
    const rect = control.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4 || !onScreen(rect)) continue;
    points.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, control });
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

/** Whether clicks still reach each sampled control, wherever the theme has moved it to. */
function hitTest(element: Element, points: SamplePoint[]) {
  return points.map((point) => {
    let { x, y } = point;
    const { control } = point;
    if (control) {
      const box = control.getBoundingClientRect();
      if (box.width < 4 || box.height < 4) return false;
      x = box.left + box.width / 2;
      y = box.top + box.height / 2;
    }
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    if (!hit) return false;
    if (hit.closest(OVERLAY_SELECTOR)) return true;
    return control ? control.contains(hit) : element.contains(hit);
  });
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
 * A plain colour or a gradient of opaque stops counts; masks, blend modes and pictures don't.
 */
function opaquePseudoOverlay(hosts: Element[]): boolean {
  const viewport = window.innerWidth * window.innerHeight;
  for (const host of hosts) {
    for (const pseudo of ["::before", "::after"] as const) {
      const style = getComputedStyle(host, pseudo) as CSSStyleDeclaration & { webkitMaskImage?: string };
      if (!style.content || style.content === "none" || style.content === "normal") continue;
      if (style.position !== "fixed" && style.position !== "absolute") continue;
      if (style.display === "none" || style.visibility !== "visible") continue;
      const width = Number.parseFloat(style.width);
      const height = Number.parseFloat(style.height);
      if (!(width * height >= viewport * 0.5)) continue;
      if (
        (style.maskImage && style.maskImage !== "none") ||
        (style.webkitMaskImage && style.webkitMaskImage !== "none")
      )
        continue;
      if (style.mixBlendMode && style.mixBlendMode !== "normal") continue;
      const opacity = Number.parseFloat(style.opacity || "1") * filterOpacity(style.filter);
      const background = parseColor(style.backgroundColor);
      let solid = background?.[3] ?? 0;
      if (style.backgroundImage && style.backgroundImage !== "none") {
        const stops = gradientColors(style.backgroundImage);
        if (stops) solid = Math.max(solid, Math.min(...stops.map((stop) => stop[3])));
      }
      if (solid * opacity >= 0.6) return true;
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
    } finally {
      active.forEach((sheet, index) => (sheet.media = previousMedia[index] ?? ""));
    }
    for (const { element } of targets) after.get(element)!.hitOk = hitTest(element, points.get(element) ?? []);
  } finally {
    delete root.dataset.mariGuardMeasure;
  }

  const problems: ThemeGuardProblem[] = [];
  if (overlayAfter && !overlayBefore) problems.push({ area: "app", kind: "overlay" });
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
