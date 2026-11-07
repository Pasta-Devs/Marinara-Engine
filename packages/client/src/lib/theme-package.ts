// ──────────────────────────────────────────────
// Theme package v2: one file per theme (theming panel, batch 4)
//
// A theme file is JSON with kind "marinara.theme" and formatVersion 2: name, CSS, and optional
// author, version, description, colour schemes, thumbnail, suggested Appearance settings, embedded
// fonts and backgrounds. Older files still import: a bare .css file, { name, css }, and the
// "marinara.theme-folder" envelope that export used to write.
// ──────────────────────────────────────────────
import { looksLikeSecretRequest } from "./theme-guard";
import {
  MAX_THEME_META_BYTES,
  MAX_USER_CSS_BYTES,
  getFolderImportEntries,
  getFolderManifestConfig,
  themeMetaSchema,
  utf8ByteLength,
  type Theme,
  type ThemeMeta,
  type ThemeSettings,
} from "@marinara-engine/shared";
import { useUIStore, type VisualTheme } from "../stores/ui.store";
import { normalizeThemeCss } from "./theme-css";

export const THEME_FILE_KIND = "marinara.theme";
export const THEME_FORMAT_VERSION = 2;

export interface ThemePackage {
  name: string;
  css: string;
  meta: ThemeMeta;
}

export type ThemeIssue =
  | { kind: "css-too-big"; bytes: number; limit: number }
  | { kind: "meta-too-big"; bytes: number; limit: number }
  | { kind: "hsl-triplets"; names: string[] }
  | { kind: "bad-colors"; names: string[] }
  | { kind: "unknown-hook"; selector: string; suggestion: string }
  | { kind: "hides-protected"; selector: string }
  | { kind: "adds-text"; texts: string[] }
  | { kind: "asks-secrets"; text: string }
  | { kind: "a11y"; what: string[] }
  | { kind: "bad-meta"; message: string };

function parseJsonLenient(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    // Hand-written theme files often have raw newlines inside the css string.
    try {
      return JSON.parse(
        text.replace(/"([^"\\]|\\.)*"/g, (match) =>
          match.replace(/\r/g, "").replace(/\n/g, "\\n").replace(/\t/g, "\\t"),
        ),
      ) as unknown;
    } catch {
      throw error;
    }
  }
}

function str(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Keeps the parts of a file's metadata that pass the schema; drops the rest instead of failing the import. */
function readMeta(record: Record<string, unknown>): { meta: ThemeMeta; problems: string[] } {
  const raw: Record<string, unknown> = {
    author: str(record.author),
    version: str(record.version),
    description: str(record.description),
    colorScheme: record.colorScheme,
    thumbnail: record.thumbnail,
    settings: record.settings,
    fonts: record.fonts,
    backgrounds: record.backgrounds,
  };
  const meta: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    const single = themeMetaSchema.safeParse({ [key]: value });
    if (single.success) Object.assign(meta, single.data);
    else problems.push(`${key}: ${single.error.issues[0]?.message ?? "invalid"}`);
  }
  return { meta: meta as ThemeMeta, problems };
}

/** Reads a .css or .json theme file into one or more packages, with per-theme metadata problems. */
export async function readThemeFile(file: File): Promise<Array<ThemePackage & { metaProblems: string[] }>> {
  const text = await file.text();
  const baseName = file.name.replace(/\.(css|json)$/i, "");
  if (!/\.json$/i.test(file.name)) {
    return [{ name: baseName || "Imported theme", css: normalizeThemeCss(text), meta: {}, metaProblems: [] }];
  }
  const parsed = parseJsonLenient(text);
  const entries =
    parsed && typeof parsed === "object" && (parsed as { kind?: unknown }).kind === THEME_FILE_KIND
      ? [parsed]
      : getFolderImportEntries(parsed, ["themes"]);
  const packages: Array<ThemePackage & { metaProblems: string[] }> = [];
  for (const entry of entries) {
    const source = getFolderManifestConfig(entry);
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const record = source as Record<string, unknown>;
    if (typeof record.css !== "string") continue;
    const { meta, problems } = readMeta(record);
    packages.push({
      name: str(record.name) ?? baseName ?? "Imported theme",
      css: normalizeThemeCss(record.css),
      meta,
      metaProblems: problems,
    });
  }
  return packages;
}

// ── Validation ──

const HSL_TRIPLET = /^\s*-?\d+(?:\.\d+)?(?:deg)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%\s*(?:\/\s*[\d.]+%?\s*)?$/;
const COLOR_TOKENS = new Set([
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--border",
  "--input",
  "--ring",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-border",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
]);

/** Hooks other apps use that don't exist here, and what to use instead. */
const UNKNOWN_HOOKS: Array<[RegExp, string, string]> = [
  [/\[data-component=["']?ChatMessage["']?\]/, '[data-component="ChatMessage"]', '[data-mari-part="message"]'],
  [/\[data-component=["']?ChatInput["']?\]/, '[data-component="ChatInput"]', '[data-mari-part="composer"]'],
  [/(^|[\s,}])\.mes(?![\w-])/, ".mes", '[data-mari-part="message"]'],
  [/#send_form\b/, "#send_form", '[data-mari-part="composer"]'],
];

function declarations(css: string) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...clean.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)].map((match) => ({
    name: match[1]!,
    value: match[2]!.replace(/!important\s*$/i, "").trim(),
  }));
}

function isValidColor(value: string) {
  if (/var\(|color-mix\(|calc\(|env\(|attr\(/i.test(value)) return true;
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return true;
  return CSS.supports("color", value);
}

export function validateThemePackage(pkg: ThemePackage & { metaProblems?: string[] }): ThemeIssue[] {
  const issues: ThemeIssue[] = [];
  const cssBytes = utf8ByteLength(pkg.css);
  if (cssBytes > MAX_USER_CSS_BYTES) issues.push({ kind: "css-too-big", bytes: cssBytes, limit: MAX_USER_CSS_BYTES });
  const metaBytes = utf8ByteLength(JSON.stringify(pkg.meta));
  if (metaBytes > MAX_THEME_META_BYTES) {
    issues.push({ kind: "meta-too-big", bytes: metaBytes, limit: MAX_THEME_META_BYTES });
  }
  const triplets = new Set<string>();
  const bad = new Set<string>();
  for (const { name, value } of declarations(pkg.css)) {
    if (HSL_TRIPLET.test(value)) triplets.add(name);
    else if (COLOR_TOKENS.has(name) && !isValidColor(value)) bad.add(name);
  }
  if (triplets.size) issues.push({ kind: "hsl-triplets", names: [...triplets] });
  if (bad.size) issues.push({ kind: "bad-colors", names: [...bad] });
  for (const [pattern, selector, suggestion] of UNKNOWN_HOOKS) {
    if (pattern.test(pkg.css)) issues.push({ kind: "unknown-hook", selector, suggestion });
  }
  for (const selector of protectedHideAttempts(pkg.css)) issues.push({ kind: "hides-protected", selector });
  const texts = addedTexts(pkg.css);
  const secret = texts.find(looksLikeSecretRequest);
  if (secret) issues.push({ kind: "asks-secrets", text: secret });
  else if (texts.length) issues.push({ kind: "adds-text", texts: texts.slice(0, 3) });
  const a11y = accessibilityChanges(pkg.css);
  if (a11y.length) issues.push({ kind: "a11y", what: a11y });
  for (const message of pkg.metaProblems ?? []) issues.push({ kind: "bad-meta", message });
  return issues;
}

/** The top bar, the sidebars and Ctrl+K themselves (not things inside them). */
const PROTECTED_ROOT =
  /(\[data-component=["']?(TopBar|ChatSidebarPanel|ChatSidebar|ChatSidebarSlot|RightPanelDesktop|RightPanelDesktopSlot|RightPanelMobile|GlobalOmnibar|GlobalOmnibar\.Panel)["']?\]|\.ov-topbar|\.ov-libnav|header\[data-overhaul-topbar[^\]]*\])$/;
/** Values that hide or move something (not restyle it). */
const HIDING: RegExp[] = [
  /(?:^|;)\s*display\s*:\s*none/i,
  /(?:^|;)\s*visibility\s*:\s*(hidden|collapse)/i,
  /(?:^|;)\s*opacity\s*:\s*(0(\.[0-2]\d*)?|\.[0-2]\d*|[0-2]?\d%)\s*(!important)?\s*(;|$)/i,
  /(?:^|;)\s*transform\s*:\s*(?!none)[^;]*(translate|scale\(\s*0)/i,
  /(?:^|;)\s*translate\s*:\s*(?!none|0(?:px)?\s*(?:0(?:px)?)?\s*(?:;|$|!))/i,
  /(?:^|;)\s*clip-path\s*:\s*(?!none)/i,
  /(?:^|;)\s*(width|height)\s*:\s*0(?![.\d])/i,
  /(?:^|;)\s*filter\s*:[^;]*opacity\(\s*(0(\.[0-2]\d*)?|\.[0-2]\d*|[0-2]?\d%)\s*\)/i,
];

/** The element a selector styles: its last compound, without pseudo-classes like :hover. */
function selectorSubject(selector: string) {
  const parts = selector.trim().split(/\s*[\s>+~]\s*(?![^[]*\])/);
  return parts[parts.length - 1] ?? "";
}

/** Rules that try to hide or move the top bar, sidebars or Ctrl+K. The protected layer undoes them. */
function protectedHideAttempts(css: string) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found = new Set<string>();
  for (const match of clean.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
    const body = match[2]!;
    if (!HIDING.some((pattern) => pattern.test(body))) continue;
    for (const selector of match[1]!.split(",")) {
      const subject = selectorSubject(selector);
      // A hover lift or a pressed state is a restyle, not a hide.
      if (/:(hover|active|focus|focus-visible|focus-within)\b|::?(before|after)/.test(subject)) continue;
      if (PROTECTED_ROOT.test(subject.replace(/:not\([^)]*\)/g, ""))) found.add(selector.trim().slice(0, 80));
    }
    if (found.size >= 3) break;
  }
  return [...found];
}

/** Text a theme writes into the page with `content: "…"` (icons and single symbols left out). */
export function addedTexts(css: string) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const texts = new Set<string>();
  for (const match of clean.matchAll(/content\s*:\s*([^;{}]+)/gi)) {
    const text = Array.from(match[1]!.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g), (m) => m[1] ?? m[2] ?? "")
      .join("")
      .replace(/\\[0-9a-f]{1,6}\s?/gi, "")
      .replace(/\\(.)/g, "$1")
      .trim();
    if (text.replace(/[^\p{L}\p{N}]/gu, "").length >= 3) texts.add(text.slice(0, 80));
  }
  return [...texts];
}

/** What a theme's CSS tries to change about the Accessibility settings. */
function accessibilityChanges(css: string) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const what = new Set<string>();
  if (/--mari-a11y-line-height\s*:|line-height\s*:\s*(0?\.\d|1(\.[0-2]\d*)?)\s*!important/i.test(clean))
    what.add("line spacing");
  if (/--mari-a11y-letter-spacing\s*:|letter-spacing\s*:\s*-/i.test(clean)) what.add("letter spacing");
  if (/--mari-cvd-[\w-]+\s*:/i.test(clean)) what.add("colour-blind-safe colours");
  if (/--mari-focus-ring-[\w-]+\s*:/i.test(clean)) what.add("focus rings");
  return [...what];
}

/** `--x: 270 25% 8%` → `--x: hsl(270 25% 8%)` (the shadcn convention, which isn't a colour on its own). */
export function convertHslTriplets(css: string) {
  return css.replace(/(--[\w-]+\s*:\s*)([^;{}]+)/g, (whole, head: string, value: string) => {
    const important = /!important\s*$/i.test(value);
    const bare = value.replace(/!important\s*$/i, "").trim();
    if (!HSL_TRIPLET.test(bare)) return whole;
    return `${head}hsl(${bare})${important ? " !important" : ""}`;
  });
}

export function formatKiB(bytes: number) {
  return bytes < 1024 ? "<1 KiB" : `${Math.round(bytes / 1024)} KiB`;
}

// ── Fonts ──

function cssString(value: string) {
  return `"${value.replace(/["\\\n\r]/g, "")}"`;
}

/** @font-face rules for the fonts a theme carries; they load with the theme and go away with it. */
export function themeFontFaceCss(meta: ThemeMeta | null | undefined) {
  return (meta?.fonts ?? [])
    .map(
      (font) =>
        `@font-face { font-family: ${cssString(font.family)}; src: url(${cssString(font.src)}); ` +
        `font-weight: ${/^[\d\s]+$|^(normal|bold)$/.test(font.weight ?? "") ? font.weight : "100 900"}; ` +
        `font-style: ${font.style ?? "normal"}; font-display: swap; }`,
    )
    .join("\n");
}

// ── Settings ──

export type ThemeSettingKey = keyof ThemeSettings;

export function themeSettingKeys(settings: ThemeSettings | undefined): ThemeSettingKey[] {
  if (!settings) return [];
  return (Object.keys(settings) as ThemeSettingKey[]).filter((key) => settings[key] !== undefined);
}

/** Applies the chosen suggested settings through the normal Appearance setters (so they sync as usual). */
export function applyThemeSettings(settings: ThemeSettings, keys: ThemeSettingKey[]) {
  const ui = useUIStore.getState();
  for (const key of keys) {
    const value = settings[key];
    if (value === undefined) continue;
    switch (key) {
      case "colorScheme":
        ui.setTheme(value as "dark" | "light");
        break;
      case "visualStyle":
        ui.setVisualTheme(value as VisualTheme);
        break;
      case "accent":
        ui.setAppAccentColor(value as string);
        break;
      case "accentLight":
        ui.setAppAccentColorLight(value as string);
        break;
      case "background":
        ui.setAppBackgroundColor(value as string);
        break;
      case "backgroundLight":
        ui.setAppBackgroundColorLight(value as string);
        break;
      case "fontFamily":
        ui.setFontFamily(value as string);
        break;
      case "accentPulse":
        ui.setAppAccentPulseMode(Boolean(value));
        break;
    }
  }
}

/** The current Appearance values, for "Include my Appearance settings" when packaging a theme. */
export function currentThemeSettings(): ThemeSettings {
  const ui = useUIStore.getState();
  const settings: ThemeSettings = {
    colorScheme: ui.theme === "light" ? "light" : "dark",
    visualStyle: ui.visualTheme,
  };
  if (ui.appAccentColor) settings.accent = ui.appAccentColor;
  if (ui.appAccentColorLight) settings.accentLight = ui.appAccentColorLight;
  if (ui.appBackgroundColor) settings.background = ui.appBackgroundColor;
  if (ui.appBackgroundColorLight) settings.backgroundLight = ui.appBackgroundColorLight;
  if (ui.fontFamily) settings.fontFamily = ui.fontFamily;
  if (ui.appAccentPulseMode) settings.accentPulse = true;
  return settings;
}

// ── Export ──

export function buildThemeFile(theme: Pick<Theme, "name" | "css" | "meta">) {
  return {
    kind: THEME_FILE_KIND,
    formatVersion: THEME_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    name: theme.name,
    ...(theme.meta ?? {}),
    css: theme.css,
  };
}

/** A data: URL from a picked file, for thumbnails, fonts and backgrounds. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file"));
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToFile(dataUrl: string, name: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const fileName = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.${ext}`;
  return new File([blob], fileName, { type: blob.type });
}
