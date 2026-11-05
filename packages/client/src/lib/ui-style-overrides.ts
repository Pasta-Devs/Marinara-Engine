// ──────────────────────────────────────────────
// UI style overrides: user restyling of curated interface regions.
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
 * wins in CSS, so keep the broad "buttons" target after the specific ones. `surfaces` are descendant
 * layers that paint over the root and so take the region's background too. Messages match the bubble
 * in bubble layouts and the line body in the plain conversation layout.
 */
export const UI_STYLE_TARGETS: readonly UiStyleTarget[] = [
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
  { id: "floating-window", labelKey: "settings.appearance.uiStyles.regions.floatingWindow", selector: ".mari-window" },
  { id: "modal", labelKey: "settings.appearance.uiStyles.regions.modal", selector: ".mari-modal-panel" },
  {
    id: "omnibar",
    labelKey: "settings.appearance.uiStyles.regions.omnibar",
    selector: '[data-component="GlobalOmnibar.Panel"]',
  },
  {
    // Zero specificity beyond `:root`, so every specific region above wins on the same element.
    // Buttons with an inline background (color swatches) keep it.
    id: "buttons",
    labelKey: "settings.appearance.uiStyles.regions.buttons",
    selector: ':where(button:not([style*="background"]), [role="button"]:not([style*="background"]))',
  },
];

const UI_STYLE_TARGET_IDS = [
  "top-bar",
  "sidebar",
  "center",
  "right-panel",
  "tracker-panel",
  "conversation-surface",
  "roleplay-surface",
  "message-name",
  "user-message",
  "assistant-message",
  "composer",
  "toolbar-button",
  "floating-window",
  "modal",
  "omnibar",
  "buttons",
] as const;

export type UiStyleTargetId = (typeof UI_STYLE_TARGET_IDS)[number];

export interface UiStyleTarget {
  id: UiStyleTargetId;
  labelKey: string;
  selector: string;
  surfaces?: readonly string[];
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
}

export type UiStyleOverrides = Partial<Record<UiStyleTargetId, UiStyleOverride>>;

/** [min, max] for the numeric properties. The opacity floor keeps the settings surface (inside the right panel) usable. */
export const UI_STYLE_LIMITS = { borderRadius: [0, 48], opacity: [30, 100], fontSize: [8, 32] } as const;

const COLOR_KEYS = ["background", "color", "borderColor"] as const;
const NUMBER_KEYS = ["borderRadius", "opacity", "fontSize"] as const;
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
  return Object.keys(out).length > 0 ? out : null;
}

/** Drops unknown region ids and regions with nothing valid left. */
export function normalizeUiStyleOverrides(value: unknown): UiStyleOverrides {
  const out: UiStyleOverrides = {};
  if (!isRecord(value)) return out;
  for (const target of UI_STYLE_TARGETS) {
    if (!Object.prototype.hasOwnProperty.call(value, target.id)) continue;
    const override = normalizeUiStyleOverride(value[target.id]);
    if (override) out[target.id] = override;
  }
  return out;
}

/** Fixed key order, so equal overrides always compare equal (the editor's dirty check). */
export function serializeUiStyleOverride(value: UiStyleOverride | null | undefined): string {
  const clean = normalizeUiStyleOverride(value);
  if (!clean) return "";
  return JSON.stringify([...COLOR_KEYS, ...NUMBER_KEYS].map((key) => clean[key] ?? null));
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
  const rules = [
    `${root}{${declare([
      ["background", override.background],
      ["color", override.color],
      ["border-color", override.borderColor],
      ["border-radius", px(override.borderRadius)],
      ["opacity", override.opacity === undefined ? undefined : override.opacity / 100],
      ["font-size", px(override.fontSize)],
    ])}}`,
  ];
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
  if (override.borderColor) {
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
 * Rules for every region with at least one property, in registry order. Declarations are `!important`
 * because chat styles and themes set these properties with `!important` themselves; the `:root ` prefix
 * adds a class of specificity on top. Values are re-normalized here so a caller can never feed the
 * stylesheet an unchecked shape.
 */
export function buildUiStyleOverridesCss(overrides: UiStyleOverrides): string {
  const clean = normalizeUiStyleOverrides(overrides);
  const rules: string[] = [];
  for (const target of UI_STYLE_TARGETS) {
    const override = clean[target.id];
    if (override) rules.push(...targetRules(target, override));
  }
  return rules.join("\n");
}

/** The slice of `Element` the resolver needs; a real Element satisfies it. */
export interface UiStyleProbe {
  matches(selector: string): boolean;
  parentElement: UiStyleProbe | null;
}

/** Walks up from `start`; the first ancestor matching a region selector is the deepest region. */
export function resolveUiStyleTarget(start: UiStyleProbe | null): UiStyleTargetId | null {
  for (let node = start; node; node = node.parentElement) {
    for (const target of UI_STYLE_TARGETS) {
      if (node.matches(target.selector)) return target.id;
    }
  }
  return null;
}
