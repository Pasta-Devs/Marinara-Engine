// ──────────────────────────────────────────────
// Chrome guard: themes may restyle the top bar, the chats sidebar, the Library sidebar and
// Ctrl+K, but never hide, move, cover or blank them.
//
// The cheap, certain part is CSS (styles/protected-chrome.css, an early cascade layer whose
// !important rules beat any theme). What CSS can't pin down (a theme that slides a sidebar off
// screen, lays an overlay over it, or paints text the colour of its background) is checked here:
// each area is measured with the custom CSS switched off and on, inside one task so nothing paints
// in between, and a theme that makes an area worse is reported.
// ──────────────────────────────────────────────
import type { ThemeGuardProblem } from "./theme-safety";

type Area = ThemeGuardProblem["area"];

const AREAS: { area: Area; selector: string }[] = [
  { area: "topbar", selector: '[data-component="TopBar"]' },
  { area: "chats", selector: '[data-component="ChatSidebarPanel"]' },
  { area: "library", selector: '[data-component="RightPanelDesktop"], [data-component="RightPanelMobile"]' },
  { area: "omnibar", selector: '[data-component="GlobalOmnibar.Panel"]' },
];

/** App surfaces that may legitimately sit over the chrome (menus, dialogs, toasts, the tutorial). */
const OVERLAY_SELECTOR = [
  '[role="dialog"]',
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

interface Snapshot {
  rect: DOMRect;
  shown: boolean;
  /** How many of the area's controls are visible and on screen. */
  controls: number;
  hitOk: boolean[];
  contrast: number | null;
}

function parseColor(value: string): [number, number, number, number] | null {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
}

function luminance([r, g, b]: [number, number, number, number]) {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: [number, number, number, number], b: [number, number, number, number]) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** The first solid background behind an element, or null when an image or gradient is in the way. */
function backgroundBehind(element: Element): [number, number, number, number] | null {
  let node: Element | null = element;
  while (node) {
    const style = getComputedStyle(node);
    if (style.backgroundImage && style.backgroundImage !== "none") return null;
    const color = parseColor(style.backgroundColor);
    if (color && color[3] >= 0.85) return color;
    node = node.parentElement;
  }
  return [255, 255, 255, 1];
}

function effectiveOpacity(element: Element) {
  let opacity = 1;
  let node: Element | null = element;
  while (node && node !== document.documentElement) {
    opacity *= Number.parseFloat(getComputedStyle(node).opacity || "1");
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

/** Points to hit-test: the centre of the first few controls, or the area's centre. */
function samplePoints(element: Element): [number, number][] {
  const points: [number, number][] = [];
  const controls = element.querySelectorAll("button, a[href], input, [role='tab']");
  for (const control of Array.from(controls).slice(0, 4)) {
    const rect = control.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    points.push([rect.left + rect.width / 2, rect.top + rect.height / 2]);
  }
  if (points.length === 0) {
    const rect = element.getBoundingClientRect();
    points.push([rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, 40)]);
  }
  return points;
}

function textSample(element: Element): Element | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent && node.textContent.trim().length > 1 && node.parentElement) {
      const parent = node.parentElement;
      const rect = parent.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return parent;
    }
  }
  return element.querySelector("svg") ?? null;
}

function snapshot(element: Element, points: [number, number][]): Snapshot {
  const rect = element.getBoundingClientRect();
  const shown = isShown(element);
  const hitOk = points.map(([x, y]) => {
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    if (!hit) return false;
    return element.contains(hit) || !!hit.closest(OVERLAY_SELECTOR);
  });
  let contrast: number | null = null;
  const sample = textSample(element);
  if (sample) {
    const fg = parseColor(getComputedStyle(sample).color);
    const bg = backgroundBehind(sample);
    if (fg && bg && fg[3] > 0) contrast = contrastRatio(fg, bg);
    else if (fg && fg[3] === 0) contrast = 1;
  }
  let controls = 0;
  for (const control of Array.from(element.querySelectorAll("button, a[href], input, [role='tab']")).slice(0, 40)) {
    const box = control.getBoundingClientRect();
    if (box.width < 4 || box.height < 4 || box.right < 0 || box.bottom < 0) continue;
    if (box.left > window.innerWidth || box.top > window.innerHeight) continue;
    const style = getComputedStyle(control);
    if (style.visibility !== "visible" || Number.parseFloat(style.opacity || "1") < 0.2) continue;
    controls += 1;
  }
  return { rect, shown, hitOk, contrast, controls };
}

function onScreenShare(rect: DOMRect) {
  const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
  const area = rect.width * rect.height;
  return area > 0 ? (width * height) / area : 0;
}

const PSEUDO_HOSTS = 'html, body, #root, [data-component="AppShell"], [data-component="OverhaulShellRow"], main';

/** A big, mostly opaque ::before/::after laid over the app (it takes no clicks, but hides everything). */
function opaquePseudoOverlay(): boolean {
  const viewport = window.innerWidth * window.innerHeight;
  for (const host of Array.from(document.querySelectorAll(PSEUDO_HOSTS))) {
    for (const pseudo of ["::before", "::after"] as const) {
      const style = getComputedStyle(host, pseudo);
      if (!style.content || style.content === "none" || style.content === "normal") continue;
      if (style.position !== "fixed" && style.position !== "absolute") continue;
      if (style.display === "none" || style.visibility !== "visible") continue;
      const width = Number.parseFloat(style.width);
      const height = Number.parseFloat(style.height);
      if (!(width * height >= viewport * 0.5)) continue;
      const opacity = Number.parseFloat(style.opacity || "1");
      const background = parseColor(style.backgroundColor);
      const solid = (background?.[3] ?? 0) * opacity;
      if (solid >= 0.6) return true;
    }
  }
  return false;
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
      .filter(
        (element) =>
          !element.closest('[aria-hidden="true"], [inert]') &&
          !element.classList.contains("is-autohide") &&
          element.getAnimations({ subtree: false }).every((animation) => animation.playState !== "running"),
      )
      .map((element) => ({ area, element })),
  );
  if (targets.length === 0) return [];

  root.dataset.mariGuardMeasure = "true";
  const previousMedia = active.map((sheet) => sheet.media);
  let before: Map<Element, Snapshot>;
  let overlayBefore: boolean;
  let overlayAfter: boolean;
  let after: Map<Element, Snapshot>;
  const points = new Map<Element, [number, number][]>();
  try {
    active.forEach((sheet) => (sheet.media = "not all"));
    overlayBefore = opaquePseudoOverlay();
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
  try {
    after = new Map(targets.map(({ element }) => [element, snapshot(element, points.get(element) ?? [])]));
    overlayAfter = opaquePseudoOverlay();
  } finally {
    delete root.dataset.mariGuardMeasure;
  }

  const problems: ThemeGuardProblem[] = [];
  if (overlayAfter && !overlayBefore) problems.push({ area: "topbar", kind: "covered" });
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
      area === "topbar" ? dy > 24 : area === "chats" ? dx > 40 : area === "library" ? Math.abs(now.rect.right - was.rect.right) > 40 : false;
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
    if (was.controls >= 2 && now.controls < was.controls * 0.6) {
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
