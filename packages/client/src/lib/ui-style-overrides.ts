// ──────────────────────────────────────────────
// UI style overrides: user restyling of curated interface regions.
//
// Pure module (no React, no DOM imports) so regressions can import it. The
// normalizers are the trust boundary for the synced `uiStyleOverrides` blob: the
// CSS generator below only ever sees values they produced.
// ──────────────────────────────────────────────

/** Curated regions in paint order. Every selector targets a marker that already exists in the app. */
export const UI_STYLE_TARGETS = [
  { id: "top-bar", labelKey: "settings.appearance.uiStyles.regions.topBar", selector: '[data-component="TopBar"]' },
  { id: "sidebar", labelKey: "settings.appearance.uiStyles.regions.sidebar", selector: ".mari-sidebar" },
  {
    id: "center",
    labelKey: "settings.appearance.uiStyles.regions.center",
    selector: '[data-component="CenterContent"]',
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
  },
  {
    id: "roleplay-surface",
    labelKey: "settings.appearance.uiStyles.regions.roleplaySurface",
    selector: '[data-component="ChatArea.Roleplay"]',
  },
  {
    id: "user-message",
    labelKey: "settings.appearance.uiStyles.regions.userMessage",
    selector: '[data-message-role="user"] .mari-message-bubble',
  },
  {
    id: "assistant-message",
    labelKey: "settings.appearance.uiStyles.regions.assistantMessage",
    selector: '[data-message-role="assistant"] .mari-message-bubble',
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
] as const;

export type UiStyleTargetId = (typeof UI_STYLE_TARGETS)[number]["id"];

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

function buildDeclarations(override: UiStyleOverride): string {
  const declarations: string[] = [];
  if (override.background) declarations.push(`background:${override.background}`);
  if (override.color) declarations.push(`color:${override.color}`);
  if (override.borderColor) declarations.push(`border-color:${override.borderColor}`);
  if (override.borderRadius !== undefined) declarations.push(`border-radius:${override.borderRadius}px`);
  if (override.opacity !== undefined) declarations.push(`opacity:${override.opacity / 100}`);
  if (override.fontSize !== undefined) declarations.push(`font-size:${override.fontSize}px`);
  return declarations.join(";");
}

/**
 * One rule per region with at least one property, in registry order. The `:root ` prefix adds a class
 * of specificity so the rule beats equal-specificity theme rules whatever order the style tags are in.
 * Values are re-normalized here so a caller can never feed the stylesheet an unchecked shape.
 */
export function buildUiStyleOverridesCss(overrides: UiStyleOverrides): string {
  const clean = normalizeUiStyleOverrides(overrides);
  const rules: string[] = [];
  for (const target of UI_STYLE_TARGETS) {
    const override = clean[target.id];
    if (override) rules.push(`:root ${target.selector}{${buildDeclarations(override)}}`);
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
