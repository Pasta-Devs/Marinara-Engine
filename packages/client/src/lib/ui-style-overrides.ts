// ──────────────────────────────────────────────
// UI style overrides: user restyling of curated interface regions and of
// Engine blocks by their `mari-*` class (every block with that class, app-wide).
//
// Pure module (no React, no DOM imports) so regressions can import it. The
// normalizers are the trust boundary for the synced `uiStyleOverrides` blob: the
// CSS generator below only ever sees values they produced.
// ──────────────────────────────────────────────

/** Inner layers of the main and chat areas that repaint the region's background over its root. */
const CHAT_SURFACES = [".mari-chat-area", ".rpg-overlay"] as const;

/**
 * Curated regions. Every selector targets a marker that already exists in the app. When one element
 * matches several selectors, the picker takes the first in this order and the more specific selector
 * wins in CSS, so keep the broad "text-fields" and "buttons" targets last. Inner regions come after
 * the regions that contain them, so their inherited text color and size win. `surfaces` are
 * descendant layers that paint over the root and so take the region's background too. Messages match
 * the bubble in bubble layouts and the line body in the plain conversation layout.
 */
export const UI_STYLE_TARGETS: readonly UiStyleTarget[] = [
  {
    // The shell and every layer that repaints the app background (body included) read this variable,
    // so a gradient spans the app instead of restarting in each layer. App.tsx also derives the page
    // backing and theme colour from this part's background (it replaced the old Background Color).
    id: "app",
    labelKey: "settings.appearance.uiStyles.regions.app",
    selector: '[data-component="AppShell"]',
    paintVariable: "--marinara-app-background-paint",
  },
  { id: "top-bar", labelKey: "settings.appearance.uiStyles.regions.topBar", selector: '[data-component="TopBar"]' },
  { id: "sidebar", labelKey: "settings.appearance.uiStyles.regions.sidebar", selector: ".mari-sidebar" },
  {
    id: "center",
    labelKey: "settings.appearance.uiStyles.regions.center",
    selector: '[data-component="CenterContent"]',
    surfaces: [".mari-app-background-paint", ...CHAT_SURFACES],
  },
  { id: "right-panel", labelKey: "settings.appearance.uiStyles.regions.rightPanel", selector: ".mari-right-panel" },
  {
    id: "floating-window",
    labelKey: "settings.appearance.uiStyles.regions.floatingWindow",
    selector: ".mari-window",
    transient: true,
  },
  {
    id: "modal",
    labelKey: "settings.appearance.uiStyles.regions.modal",
    selector: ".mari-modal-panel",
    transient: true,
  },
  {
    id: "home",
    labelKey: "settings.appearance.uiStyles.regions.home",
    selector: '[data-component="HomeBrowserHub"]',
    surfaces: [".mari-home-page", ".mari-home-browser-chrome", ".mari-home-browser-address-row"],
  },
  {
    id: "professor-mari",
    labelKey: "settings.appearance.uiStyles.regions.professorMari",
    selector: '[data-component="HomeProfessorMariChat.Window"]',
  },
  { id: "editors", labelKey: "settings.appearance.uiStyles.regions.editors", selector: ".mari-editor-shell" },
  {
    id: "tracker-panel",
    labelKey: "settings.appearance.uiStyles.regions.trackerPanel",
    selector: '[data-component="TrackerDataSidebar"]',
  },
  {
    id: "conversation-surface",
    labelKey: "settings.appearance.uiStyles.regions.conversationSurface",
    selector: '[data-component="ChatArea.Conversation"]',
    surfaces: CHAT_SURFACES,
  },
  {
    id: "roleplay-surface",
    labelKey: "settings.appearance.uiStyles.regions.roleplaySurface",
    selector: '[data-component="ChatArea.Roleplay"]',
    surfaces: CHAT_SURFACES,
  },
  {
    id: "game-narration",
    labelKey: "settings.appearance.uiStyles.regions.gameNarration",
    selector: ".mari-game-narration-surface",
  },
  // Choices, inventory, journal, combat and the other game panels share this class.
  { id: "game-panels", labelKey: "settings.appearance.uiStyles.regions.gamePanels", selector: ".mari-game-section" },
  {
    id: "message-name",
    labelKey: "settings.appearance.uiStyles.regions.messageName",
    selector: ".mari-message-name",
  },
  {
    id: "user-message",
    labelKey: "settings.appearance.uiStyles.regions.userMessage",
    selector: '[data-message-role="user"] :is(.mari-message-bubble,.mari-message-line-body)',
  },
  {
    id: "assistant-message",
    labelKey: "settings.appearance.uiStyles.regions.assistantMessage",
    selector: '[data-message-role="assistant"] :is(.mari-message-bubble,.mari-message-line-body)',
  },
  { id: "composer", labelKey: "settings.appearance.uiStyles.regions.composer", selector: ".marinara-chat-input-shell" },
  {
    id: "toolbar-button",
    labelKey: "settings.appearance.uiStyles.regions.toolbarButton",
    selector: ".marinara-chat-toolbar-button",
  },
  {
    id: "menus",
    labelKey: "settings.appearance.uiStyles.regions.menus",
    selector: ':is(.mari-context-menu, .mari-chat-input-popup, [data-component="TopbarMoreMenu"])',
    transient: true,
  },
  {
    id: "omnibar",
    labelKey: "settings.appearance.uiStyles.regions.omnibar",
    selector: '[data-component="GlobalOmnibar.Panel"]',
    transient: true,
  },
  {
    id: "toasts",
    labelKey: "settings.appearance.uiStyles.regions.toasts",
    selector: "[data-sonner-toast]",
    transient: true,
  },
  {
    // Zero specificity beyond `:root`, like "buttons". The composer's own text box belongs to the composer.
    id: "text-fields",
    labelKey: "settings.appearance.uiStyles.regions.textFields",
    selector:
      ':where(:is(input:not([type="range"], [type="checkbox"], [type="radio"], [type="color"], [type="file"], [type="hidden"]), textarea, select):not(.marinara-chat-input-shell *))',
  },
  {
    // Zero specificity beyond `:root`, so every specific region above wins on the same element.
    // Buttons with an inline background (color swatches) keep it.
    id: "buttons",
    labelKey: "settings.appearance.uiStyles.regions.buttons",
    selector: ':where(button:not([style*="background"]), [role="button"]:not([style*="background"]))',
  },
];

export type UiStyleRegionId =
  | "app"
  | "top-bar"
  | "sidebar"
  | "center"
  | "right-panel"
  | "floating-window"
  | "modal"
  | "home"
  | "professor-mari"
  | "editors"
  | "tracker-panel"
  | "conversation-surface"
  | "roleplay-surface"
  | "game-narration"
  | "game-panels"
  | "message-name"
  | "user-message"
  | "assistant-message"
  | "composer"
  | "toolbar-button"
  | "menus"
  | "omnibar"
  | "toasts"
  | "text-fields"
  | "buttons";
/** A block target: every element with the class `mari-…`. */
export type UiStyleClassId = `class:mari-${string}`;
export type UiStyleTargetId = UiStyleRegionId | UiStyleClassId;

export interface UiStyleTarget {
  id: UiStyleTargetId;
  /** Curated regions only; blocks are named by `uiStyleTargetLabel`. */
  labelKey?: string;
  /** Blocks only: the `mari-*` class they restyle. */
  className?: string;
  selector: string;
  surfaces?: readonly string[];
  /** A custom property the region's background is painted from; set instead of the element's background. */
  paintVariable?: string;
  /** Opens on demand (pop-ups, toasts), so its absence never means "not on this screen". */
  transient?: boolean;
}

/** Lowercase words joined by single hyphens, so the class doubles as a safe CSS selector. */
const BLOCK_CLASS = /^mari-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const BLOCK_CLASS_MAX_LENGTH = 64;
/** At most this many restyled blocks are kept; regions are not counted. */
export const UI_STYLE_BLOCK_LIMIT = 100;

function isBlockClass(value: string): boolean {
  return value.length <= BLOCK_CLASS_MAX_LENGTH && BLOCK_CLASS.test(value);
}

/** The region or block for an id, or null for an unknown id or an invalid class. */
export function getUiStyleTarget(id: string | null | undefined): UiStyleTarget | null {
  if (!id) return null;
  const region = UI_STYLE_TARGETS.find((target) => target.id === id);
  if (region) return region;
  const className = id.startsWith("class:") ? id.slice("class:".length) : "";
  if (!isBlockClass(className)) return null;
  return { id: id as UiStyleClassId, className, selector: `.${className}` };
}

/** Translated names for common blocks; any other block is named from its class ("mari-editor-panel" → "Editor panel"). */
const BLOCK_LABEL_KEYS: Record<string, string> = {
  "mari-editor-panel": "settings.appearance.uiStyles.blocks.editorPanel",
  "mari-editor-field": "settings.appearance.uiStyles.blocks.editorField",
  "mari-editor-header": "settings.appearance.uiStyles.blocks.editorHeader",
  "mari-editor-action": "settings.appearance.uiStyles.blocks.editorAction",
  "mari-chrome-control": "settings.appearance.uiStyles.blocks.chromeControl",
};

export function uiStyleTargetLabel(
  target: UiStyleTarget,
  t: (key: string, options?: { defaultValue: string }) => string,
): string {
  if (target.labelKey) return t(target.labelKey);
  const words = (target.className ?? "").replace(/^mari-/u, "").replace(/-/gu, " ");
  const fallback = words.charAt(0).toUpperCase() + words.slice(1);
  const key = target.className ? BLOCK_LABEL_KEYS[target.className] : undefined;
  return key ? t(key, { defaultValue: fallback }) : fallback;
}

export interface UiStyleOverride {
  /** CSS color or gradient. */
  background?: string;
  color?: string;
  borderColor?: string;
  /** px */
  borderRadius?: number;
  /** percent */
  opacity?: number;
  /** px */
  fontSize?: number;
  /** px; with no border color the theme's border color draws it. */
  borderWidth?: number;
  /** px of backdrop blur; 0 removes a theme's blur. */
  blur?: number;
  shadow?: UiStyleShadow;
}

/** Shadow presets: a free-form box-shadow is too easy to get wrong for a picker. */
export const UI_STYLE_SHADOWS = {
  none: "none",
  soft: "0 1px 3px rgb(0 0 0 / 0.25)",
  medium: "0 4px 12px rgb(0 0 0 / 0.35)",
  strong: "0 12px 32px rgb(0 0 0 / 0.5)",
  glow: "0 0 14px color-mix(in srgb, var(--primary) 55%, transparent)",
} as const;
export type UiStyleShadow = keyof typeof UI_STYLE_SHADOWS;

export type UiStyleOverrides = Partial<Record<UiStyleTargetId, UiStyleOverride>>;

/** [min, max] for the numeric properties. The opacity floor keeps the settings surface (inside the right panel) usable. */
export const UI_STYLE_LIMITS = {
  borderRadius: [0, 48],
  opacity: [30, 100],
  fontSize: [8, 32],
  borderWidth: [0, 8],
  blur: [0, 40],
} as const;

const COLOR_KEYS = ["background", "color", "borderColor"] as const;
const NUMBER_KEYS = ["borderRadius", "opacity", "fontSize", "borderWidth", "blur"] as const;
const COLOR_MAX_LENGTH = 300;
const COLOR_ALLOWED = /^[\w#\s(),.%/+-]+$/u;
const COLOR_FORBIDDEN = /url\s*\(|expression|\/\*|\*\//iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasBalancedParens(value: string): boolean {
  let depth = 0;
  for (const char of value) {
    if (char === "(") depth += 1;
    else if (char === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

function normalizeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > COLOR_MAX_LENGTH) return null;
  if (!COLOR_ALLOWED.test(trimmed) || COLOR_FORBIDDEN.test(trimmed) || !hasBalancedParens(trimmed)) return null;
  return trimmed;
}

function normalizeNumber(value: unknown, [min, max]: readonly [number, number]): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Returns the valid subset of `value`, or null when nothing valid remains. Unknown keys are dropped. */
export function normalizeUiStyleOverride(value: unknown): UiStyleOverride | null {
  if (!isRecord(value)) return null;
  const out: UiStyleOverride = {};
  for (const key of COLOR_KEYS) {
    const color = normalizeColor(value[key]);
    if (color) out[key] = color;
  }
  for (const key of NUMBER_KEYS) {
    const number = normalizeNumber(value[key], UI_STYLE_LIMITS[key]);
    if (number !== null) out[key] = number;
  }
  if (typeof value.shadow === "string" && Object.prototype.hasOwnProperty.call(UI_STYLE_SHADOWS, value.shadow)) {
    out.shadow = value.shadow as UiStyleShadow;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Drops unknown region ids, invalid block classes and targets with nothing valid left. Regions come
 * first in registry order, then at most `UI_STYLE_BLOCK_LIMIT` blocks in their stored order.
 */
export function normalizeUiStyleOverrides(value: unknown): UiStyleOverrides {
  const out: UiStyleOverrides = {};
  if (!isRecord(value)) return out;
  for (const target of UI_STYLE_TARGETS) {
    if (!Object.prototype.hasOwnProperty.call(value, target.id)) continue;
    const override = normalizeUiStyleOverride(value[target.id]);
    if (override) out[target.id] = override;
  }
  let blocks = 0;
  for (const [id, raw] of Object.entries(value)) {
    if (blocks >= UI_STYLE_BLOCK_LIMIT) break;
    const target = getUiStyleTarget(id);
    if (!target?.className) continue;
    const override = normalizeUiStyleOverride(raw);
    if (!override) continue;
    out[target.id] = override;
    blocks += 1;
  }
  return out;
}

/**
 * Moves the retired Background Color setting into the Whole app part. A background already saved on that
 * part wins. The old field is cleared only once the part has a background; a value the part cannot hold
 * (`url(...)`, quotes, over-long) stays in `appBackgroundColor`, which App.tsx still paints.
 */
export function foldAppBackgroundColor(
  color: string,
  overrides: unknown,
): { uiStyleOverrides: UiStyleOverrides; appBackgroundColor: string } {
  let uiStyleOverrides = normalizeUiStyleOverrides(overrides);
  const background = normalizeColor(color);
  if (background && !uiStyleOverrides.app?.background) {
    uiStyleOverrides = normalizeUiStyleOverrides({ ...uiStyleOverrides, app: { ...uiStyleOverrides.app, background } });
  }
  return { uiStyleOverrides, appBackgroundColor: uiStyleOverrides.app?.background ? "" : color };
}

/** Every saved region and block, regions in registry order first. */
export function savedUiStyleTargets(overrides: UiStyleOverrides): UiStyleTarget[] {
  const regions = UI_STYLE_TARGETS.filter((target) => overrides[target.id]);
  const blocks = Object.keys(overrides)
    .map((id) => getUiStyleTarget(id))
    .filter((target): target is UiStyleTarget => !!target?.className && !!overrides[target.id]);
  return [...regions, ...blocks];
}

export interface UiStylePreset {
  id: string;
  name: string;
  /** A snapshot of every region's saved style. */
  overrides: UiStyleOverrides;
}

export const UI_STYLE_PRESET_LIMITS = { count: 30, nameLength: 40 } as const;
const PRESET_ID = /^[A-Za-z0-9_-]{1,64}$/u;

/** Control characters stripped, trimmed, capped; null when nothing is left. */
export function normalizeUiStylePresetName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value
    .replace(/\p{Cc}/gu, "")
    .trim()
    .slice(0, UI_STYLE_PRESET_LIMITS.nameLength)
    .trim();
  return name || null;
}

/** Keeps the valid presets (unique ids, at most 30) of a synced or persisted blob; anything else yields `[]`. */
export function normalizeUiStylePresets(value: unknown): UiStylePreset[] {
  if (!Array.isArray(value)) return [];
  const out: UiStylePreset[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (out.length >= UI_STYLE_PRESET_LIMITS.count) break;
    if (!isRecord(entry) || typeof entry.id !== "string" || !PRESET_ID.test(entry.id) || seen.has(entry.id)) continue;
    const name = normalizeUiStylePresetName(entry.name);
    const overrides = normalizeUiStyleOverrides(entry.overrides);
    if (!name || Object.keys(overrides).length === 0) continue;
    seen.add(entry.id);
    out.push({ id: entry.id, name, overrides });
  }
  return out;
}

/** Fixed key order, so equal overrides always compare equal (the editor's dirty check). */
export function serializeUiStyleOverride(value: UiStyleOverride | null | undefined): string {
  const clean = normalizeUiStyleOverride(value);
  if (!clean) return "";
  return JSON.stringify([...COLOR_KEYS, ...NUMBER_KEYS, "shadow" as const].map((key) => clean[key] ?? null));
}

function declare(declarations: [string, string | number | undefined][]): string {
  return declarations
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([property, value]) => `${property}:${value}!important`)
    .join(";");
}

function targetRules(target: UiStyleTarget, override: UiStyleOverride): string[] {
  const root = `:root ${target.selector}`;
  const px = (value: number | undefined) => (value === undefined ? undefined : `${value}px`);
  const blur = (value: number | undefined) =>
    value === undefined ? undefined : value > 0 ? `blur(${value}px)` : "none";
  const own = declare([
    ["background", target.paintVariable ? undefined : override.background],
    ["color", override.color],
    ["border-color", override.borderColor],
    ["border-radius", px(override.borderRadius)],
    ["opacity", override.opacity === undefined ? undefined : override.opacity / 100],
    ["font-size", px(override.fontSize)],
    ["border-width", px(override.borderWidth)],
    ["border-style", override.borderWidth === undefined ? undefined : "solid"],
    // Unset, the border would take the text color (currentColor).
    ["border-color", override.borderWidth !== undefined && !override.borderColor ? "var(--border)" : undefined],
    ["box-shadow", override.shadow && UI_STYLE_SHADOWS[override.shadow]],
    // Any value but none traps fixed-position descendants, so 0 means none rather than blur(0px).
    ["-webkit-backdrop-filter", blur(override.blur)],
    ["backdrop-filter", blur(override.blur)],
  ]);
  // A painted region with only a background has no rule of its own.
  const rules = own ? [`${root}{${own}}`] : [];
  if (override.background && target.paintVariable) {
    rules.push(`:root{${declare([[target.paintVariable, override.background]])}}`);
  }
  if (override.background && target.surfaces?.length) {
    rules.push(`${root} :is(${target.surfaces.join(", ")}){${declare([["background", override.background]])}}`);
  }
  // Most text sets its own color and size, so descendants inherit instead. Zero specificity lets any
  // region or button inside with its own override still win.
  const inherited = declare([
    ["color", override.color && "inherit"],
    ["font-size", override.fontSize === undefined ? undefined : "inherit"],
  ]);
  if (inherited) rules.push(`:where(${root} *){${inherited}}`);
  // Most regions have no border to recolor; an inset outline draws one without moving the layout.
  // A set border width draws the real border instead.
  if (override.borderColor && override.borderWidth === undefined) {
    rules.push(
      `${root}:not(:focus-visible){${declare([
        ["outline", `1px solid ${override.borderColor}`],
        ["outline-offset", "-1px"],
      ])}}`,
    );
  }
  return rules;
}

/**
 * Rules for every region with at least one property, in registry order, then every block (after the
 * regions, so a block inside a region keeps its own text color and size). Declarations are `!important`
 * because chat styles and themes set these properties with `!important` themselves; the `:root ` prefix
 * adds a class of specificity on top. Values are re-normalized here so a caller can never feed the
 * stylesheet an unchecked shape.
 */
export function buildUiStyleOverridesCss(overrides: UiStyleOverrides): string {
  const clean = normalizeUiStyleOverrides(overrides);
  const rules: string[] = [];
  for (const target of savedUiStyleTargets(clean)) {
    const override = clean[target.id];
    if (override) rules.push(...targetRules(target, override));
  }
  return rules.join("\n");
}

/** The slice of `Element` the resolver needs; a real Element satisfies it. */
export interface UiStyleProbe {
  matches(selector: string): boolean;
  getAttribute(name: string): string | null;
  parentElement: UiStyleProbe | null;
}

/** The app-wide text fields and buttons: an element's own block class names it better. */
const BROAD_REGIONS: ReadonlySet<UiStyleTargetId> = new Set<UiStyleTargetId>(["text-fields", "buttons"]);
/** Blocks offered between the region and the picked element; more would be layout wrappers. */
const MAX_BLOCK_LEVELS = 2;

function blockClassOf(node: UiStyleProbe): string | null {
  return (node.getAttribute("class") ?? "").split(/\s+/u).find(isBlockClass) ?? null;
}

/**
 * The levels a picked element can restyle, outermost first: its nearest region, then up to two
 * enclosing blocks (by their first `mari-*` class), the element's own block last. A broad region
 * (text fields, buttons) is offered only for an element with no block class.
 */
export function resolveUiStyleChain(start: UiStyleProbe | null): UiStyleTargetId[] {
  const levels: UiStyleTargetId[] = [];
  let blocks = 0;
  for (let node = start; node; node = node.parentElement) {
    const current = node;
    const region = UI_STYLE_TARGETS.find((target) => current.matches(target.selector));
    if (region && !BROAD_REGIONS.has(region.id)) {
      levels.push(region.id);
      break;
    }
    const className = blockClassOf(node);
    const id = className ? (`class:${className}` as UiStyleClassId) : null;
    if (id && blocks < MAX_BLOCK_LEVELS && !levels.includes(id)) {
      levels.push(id);
      blocks += 1;
    } else if (region && levels.length === 0) {
      levels.push(region.id);
    }
  }
  return levels.reverse();
}

/** The level a click picks: the innermost one. */
export function resolveUiStyleTarget(start: UiStyleProbe | null): UiStyleTargetId | null {
  return resolveUiStyleChain(start).at(-1) ?? null;
}
