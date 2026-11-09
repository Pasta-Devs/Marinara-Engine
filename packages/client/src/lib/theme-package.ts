// ──────────────────────────────────────────────
// Theme package v2: one file per theme (theming panel, batch 4)
//
// A theme file is JSON with kind "marinara.theme" and formatVersion 2: name, CSS, and optional
// author, version, description, colour schemes, thumbnail, suggested Appearance settings, embedded
// fonts and backgrounds. Older files still import: a bare .css file, { name, css }, and the
// "marinara.theme-folder" envelope that export used to write.
// ──────────────────────────────────────────────
import { looksLikeSecretRequest } from "./theme-guard";
import { CONFUSABLES, cssTextThreat, firstThreat, themeTextThreat } from "./theme-text-safety";
import { templateText } from "./theme-content-check";
import {
  MAX_THEME_META_BYTES,
  MAX_USER_CSS_BYTES,
  getFolderImportEntries,
  getFolderManifestConfig,
  themeBackgroundSchema,
  themeCreditSchema,
  themeFontSchema,
  themeImageSchema,
  themeMetaSchema,
  utf8ByteLength,
  type Theme,
  type ThemeMeta,
  type ThemeSettings,
} from "@marinara-engine/shared";
import { useUIStore, type VisualTheme } from "../stores/ui.store";
import { normalizeThemeCss } from "./theme-css";
import { themeHasHtml } from "./theme-template";
import {
  dataUrlByteSize,
  extractInlineThemeImages,
  missingThemeImages,
  shrinkThemeImage,
  summarizeThemeImages,
} from "./theme-images";

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
  | { kind: "bad-meta"; message: string }
  | { kind: "has-html" }
  | { kind: "animated"; count: number }
  | { kind: "missing-images"; names: string[] };

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

function sizeText(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : formatKiB(bytes);
}

/**
 * Keeps the parts of a file's metadata that pass the schema; drops the rest instead of failing the
 * import. Pictures, fonts and backgrounds are checked one by one, so one bad or oversized file only
 * drops itself, with a plain reason, and the rest are kept while they fit the 6 MiB budget.
 */
function readMeta(record: Record<string, unknown>): { meta: ThemeMeta; problems: string[] } {
  const raw: Record<string, unknown> = {
    author: str(record.author),
    version: str(record.version),
    description: str(record.description),
    colorScheme: record.colorScheme,
    thumbnail: record.thumbnail,
    settings: record.settings,
    templates: record.templates,
    license: str(record.license),
  };
  const meta: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    const single = themeMetaSchema.safeParse({ [key]: value });
    if (single.success) Object.assign(meta, single.data);
    else problems.push(`${key}: ${single.error.issues[0]?.message ?? "invalid"}`);
  }
  // Labels (theming round 6): kept one by one, minus any that claim to speak for the app or vouch
  // for the theme ("Official", "Verified by Marinara"): a label is the author's own words.
  if (record.labels !== undefined && record.labels !== null) {
    if (!Array.isArray(record.labels)) problems.push("labels: not a list");
    else {
      const labels: string[] = [];
      for (const item of record.labels) {
        const label = str(item);
        if (!label) continue;
        if (label.length > 40)
          problems.push(`Label "${label.slice(0, 40)}…" is longer than 40 characters, so it was left out.`);
        else if (isReservedThemeLabel(label))
          problems.push(`Label "${label}" was left out: labels can't claim a theme is official or verified.`);
        else if (labels.length >= 4) problems.push(`Label "${label}" was left out: a theme can have 4 labels.`);
        else if (!labels.includes(label)) labels.push(label);
      }
      if (labels.length) meta.labels = labels;
    }
  }
  let budget = MAX_THEME_META_BYTES - utf8ByteLength(JSON.stringify(meta));
  const lists = [
    ["images", themeImageSchema, (item: Record<string, unknown>) => item.name],
    ["fonts", themeFontSchema, (item: Record<string, unknown>) => item.family],
    ["backgrounds", themeBackgroundSchema, (item: Record<string, unknown>) => item.name],
    ["credits", themeCreditSchema, (item: Record<string, unknown>) => item.what],
  ] as const;
  for (const [key, schema, label] of lists) {
    const value = record[key];
    if (value === undefined || value === null) continue;
    if (!Array.isArray(value)) {
      problems.push(`${key}: not a list`);
      continue;
    }
    const kept: unknown[] = [];
    for (const item of value) {
      const name = String((item && typeof item === "object" && label(item as Record<string, unknown>)) || key);
      const parsed = schema.safeParse(item);
      if (!parsed.success) {
        const src = (item as { src?: unknown })?.src;
        const tooBig = typeof src === "string" && src.length > MAX_THEME_META_BYTES;
        problems.push(
          tooBig
            ? `${name} is ${sizeText(dataUrlByteSize(src))}; pictures, fonts and backgrounds can be ${MAX_THEME_META_BYTES / 1024 / 1024} MiB together. Save it as WebP.`
            : `${name}: ${parsed.error.issues[0]?.message ?? "invalid"}`,
        );
        continue;
      }
      const bytes = utf8ByteLength(JSON.stringify(parsed.data));
      if (bytes > budget) {
        problems.push(
          `${name} (${sizeText(bytes)}) doesn't fit: pictures, fonts and backgrounds can be ${MAX_THEME_META_BYTES / 1024 / 1024} MiB together.`,
        );
        continue;
      }
      budget -= bytes;
      kept.push(parsed.data);
    }
    if (kept.length) meta[key] = kept;
  }
  return { meta: meta as ThemeMeta, problems };
}

const RESERVED_LABEL =
  /\b(official|officially|verified|verify|certified|endorsed|approved|trusted|authentic|genuine|marinara|security|safe[\s-]?checked)\b|[\u2713\u2714\u2611\u2705\u{1F6E1}]/iu;

/** Whether a label would read as the app (or anyone) vouching for the theme, e.g. "Official",
 *  "Verified ✓", "Marinara pick". Checked on NFKC-folded text so look-alike letters don't slip by. */
export function isReservedThemeLabel(label: string) {
  const folded = label
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u2060\ufeff\u00ad]/g, "")
    .replace(/./gu, (ch) => CONFUSABLES[ch] ?? ch);
  return RESERVED_LABEL.test(folded);
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

/** Name, author, description or credit text that asks for secrets or pretends to be the app. A web
 *  address there is fine: it is plain text, never a link. */
function firstMetaThreat(texts: string[]) {
  for (const text of texts) {
    const threat = themeTextThreat(text, { lengthCap: null });
    if (threat === "secret" || threat === "scare") return text;
  }
  return undefined;
}

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
  // Anchored to the start of a declaration, so a selector like `.x--primary:not(…)` isn't read as one.
  return [...clean.matchAll(/(?:^|[;{])\s*(--[\w-]+)\s*:\s*([^;{}]+)/g)].map((match) => ({
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
  // Security audit: every string the theme could draw (not only `content:`), its templates and its
  // name, author, description and credits must not ask for secrets or pretend to be the app.
  const drawn = cssTextThreat(pkg.css);
  const metaText = firstMetaThreat(
    [
      pkg.name,
      pkg.meta.author,
      pkg.meta.description,
      pkg.meta.license,
      ...(pkg.meta.labels ?? []),
      ...(pkg.meta.credits ?? []).flatMap((credit) => [credit.what, credit.by, credit.license]),
      ...(pkg.meta.fonts ?? []).flatMap((font) => [font.family, font.credit, font.license]),
    ].filter((value): value is string => !!value),
  );
  const templateThreat = pkg.meta.templates
    ? firstThreat(
        Object.values(pkg.meta.templates)
          .filter((value): value is string => typeof value === "string")
          .map(templateText),
        { lengthCap: 400 },
      )
    : null;
  const secret =
    texts.find(looksLikeSecretRequest) ??
    (drawn && drawn.threat !== "long" ? drawn.text : undefined) ??
    // A web address in a description is a credit, not a trick: it is plain text, never a link.
    metaText ??
    templateThreat?.text;
  if (secret) issues.push({ kind: "asks-secrets", text: secret.slice(0, 120) });
  else if (texts.length) issues.push({ kind: "adds-text", texts: texts.slice(0, 3) });
  const a11y = accessibilityChanges(pkg.css);
  if (a11y.length) issues.push({ kind: "a11y", what: a11y });
  for (const message of pkg.metaProblems ?? []) issues.push({ kind: "bad-meta", message });
  if (themeHasHtml(pkg.meta)) issues.push({ kind: "has-html" });
  const animated = summarizeThemeImages(pkg.css, pkg.meta.images).filter((image) => image.animated).length;
  if (animated) issues.push({ kind: "animated", count: animated });
  const missing = missingThemeImages(pkg.css, [...(pkg.meta.images ?? []), ...(pkg.meta.backgrounds ?? [])]);
  if (missing.length) issues.push({ kind: "missing-images", names: missing });
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
  // Declarations only (start of a block or after a `;`), so `.mari-message-content :is(…)` in a
  // selector isn't read as a `content:` value (theming round 5).
  for (const match of clean.matchAll(/(?:^|[;{])\s*content\s*:\s*([^;{}]+)/gi)) {
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
  // Only the Accessibility tokens themselves: a theme's own line-height or letter-spacing on headings
  // and messages is styling, and the user's spacing settings win over it anyway.
  if (/(?:^|[;{\s])--mari-a11y-line-height\s*:/i.test(clean)) what.add("line spacing");
  if (/(?:^|[;{\s])--mari-a11y-letter-spacing\s*:/i.test(clean)) what.add("letter spacing");
  if (/--mari-cvd-[\w-]+\s*:/i.test(clean)) what.add("colour-blind-safe colours");
  // --mari-focus-ring-color is a theme token; only taking focus rings away is a change to flag.
  if (/--mari-focus-ring-(?!color\b)[\w-]+\s*:|:focus(-visible)?[^{]*\{[^}]*outline\s*:\s*(none|0)\b/i.test(clean))
    what.add("focus rings");
  return [...what];
}

/** `--x: 270 25% 8%` → `--x: hsl(270 25% 8%)` (the shadcn convention, which isn't a colour on its own). */
export function convertHslTriplets(css: string) {
  return css.replace(/((?:^|[;{])\s*--[\w-]+\s*:\s*)([^;{}]+)/g, (whole, head: string, value: string) => {
    const important = /!important\s*$/i.test(value);
    const bare = value.replace(/!important\s*$/i, "").trim();
    if (!HSL_TRIPLET.test(bare)) return whole;
    return `${head}hsl(${bare})${important ? " !important" : ""}`;
  });
}

export function formatKiB(bytes: number) {
  return bytes < 1024 ? "<1 KiB" : `${Math.round(bytes / 1024)} KiB`;
}

/** KiB below 1 MiB, then MiB with one decimal. */
export function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MiB` : formatKiB(bytes);
}

/** The whole package: its CSS plus every picture, font and background it carries. */
export function themePackageBytes(pkg: Pick<ThemePackage, "css" | "meta">) {
  const meta = pkg.meta ?? {};
  let bytes = utf8ByteLength(pkg.css);
  for (const image of meta.images ?? []) bytes += dataUrlByteSize(image.src);
  for (const font of meta.fonts ?? []) bytes += dataUrlByteSize(font.src);
  for (const background of meta.backgrounds ?? []) bytes += dataUrlByteSize(background.src);
  if (meta.thumbnail) bytes += dataUrlByteSize(meta.thumbnail);
  return bytes;
}

export interface OptimizedThemePackage {
  pkg: ThemePackage;
  /** Pictures that were written inline in the CSS and now sit in `images`. */
  moved: number;
  /** Pictures re-saved as WebP (or scaled down). */
  shrunk: number;
  before: number;
  after: number;
}

/**
 * Makes a theme lighter before it's installed: pictures written inline in its CSS move to its
 * `images` (so the 256 KiB CSS limit counts the CSS itself), and still PNG and JPEG pictures and
 * backgrounds become WebP, at most 2560 px on the longest side. Moving pictures, SVG and pictures
 * that wouldn't get smaller are left alone.
 */
export async function optimizeThemePackage(pkg: ThemePackage): Promise<OptimizedThemePackage> {
  const before = themePackageBytes(pkg);
  const extracted = await extractInlineThemeImages(pkg.css, pkg.meta.images);
  let shrunk = 0;
  const images = [];
  for (const image of extracted.images) {
    const src = (pkg.meta.images ?? []).includes(image) ? await shrinkThemeImage(image.src) : image.src;
    if (src !== image.src) shrunk += 1;
    images.push(src === image.src ? image : { ...image, src });
  }
  const backgrounds = [];
  for (const background of pkg.meta.backgrounds ?? []) {
    const src = await shrinkThemeImage(background.src);
    if (src !== background.src) shrunk += 1;
    // A WebP background keeps its name but gets the matching extension for the gallery.
    const name =
      src === background.src || !/\.(png|jpe?g|bmp)$/i.test(background.name)
        ? background.name
        : background.name.replace(/\.(png|jpe?g|bmp)$/i, ".webp");
    backgrounds.push(src === background.src ? background : { name, src });
  }
  const meta: ThemeMeta = { ...pkg.meta };
  if (images.length) meta.images = images;
  if (backgrounds.length) meta.backgrounds = backgrounds;
  const next: ThemePackage = { ...pkg, css: extracted.css, meta };
  return { pkg: next, moved: extracted.moved, shrunk, before, after: themePackageBytes(next) };
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
  // The day and night hours go with "Follow time of day", not as choices of their own.
  return (Object.keys(settings) as ThemeSettingKey[]).filter(
    (key) => settings[key] !== undefined && key !== "dayStart" && key !== "nightStart",
  );
}

/** Applies the chosen suggested settings through the normal Appearance setters (so they sync as usual). */
export function applyThemeSettings(settings: ThemeSettings, keys: ThemeSettingKey[]) {
  const ui = useUIStore.getState();
  for (const key of keys) {
    const value = settings[key];
    if (value === undefined) continue;
    switch (key) {
      case "colorScheme":
        if (value === "time" || value === "system") {
          ui.setThemeAuto(value);
          if (value === "time" && (settings.dayStart || settings.nightStart))
            ui.setThemeDayHours(settings.dayStart ?? ui.themeDayStart, settings.nightStart ?? ui.themeNightStart);
        } else ui.setTheme(value as "dark" | "light");
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
      case "fontSize":
        ui.setFontSize(value as Parameters<typeof ui.setFontSize>[0]);
        break;
      case "reduceMotion":
        ui.setReduceAmbientEffects(Boolean(value));
        break;
    }
  }
}

/** The touched settings as they are now, so Go back (or no answer) can put them back. */
export function snapshotThemeSettings(keys: ThemeSettingKey[]): { settings: ThemeSettings; keys: ThemeSettingKey[] } {
  const ui = useUIStore.getState();
  const settings: ThemeSettings = {};
  for (const key of keys) {
    switch (key) {
      case "colorScheme":
        if (ui.themeAuto !== "off") {
          settings.colorScheme = ui.themeAuto;
          settings.dayStart = ui.themeDayStart;
          settings.nightStart = ui.themeNightStart;
        } else settings.colorScheme = ui.theme === "light" ? "light" : "dark";
        break;
      case "visualStyle":
        settings.visualStyle = ui.visualTheme;
        break;
      case "accent":
        settings.accent = ui.appAccentColor;
        break;
      case "accentLight":
        settings.accentLight = ui.appAccentColorLight;
        break;
      case "background":
        settings.background = ui.appBackgroundColor;
        break;
      case "backgroundLight":
        settings.backgroundLight = ui.appBackgroundColorLight;
        break;
      case "fontFamily":
        settings.fontFamily = ui.fontFamily;
        break;
      case "accentPulse":
        settings.accentPulse = ui.appAccentPulseMode;
        break;
      case "fontSize":
        settings.fontSize = ui.fontSize as ThemeSettings["fontSize"];
        break;
      case "reduceMotion":
        settings.reduceMotion = ui.reduceAmbientEffects;
        break;
    }
  }
  return { settings, keys };
}

/** The current Appearance values, for "Include my Appearance settings" when packaging a theme. */
export function currentThemeSettings(): ThemeSettings {
  const ui = useUIStore.getState();
  const settings: ThemeSettings = {
    colorScheme: ui.themeAuto !== "off" ? ui.themeAuto : ui.theme === "light" ? "light" : "dark",
    visualStyle: ui.visualTheme,
  };
  if (ui.themeAuto === "time") {
    settings.dayStart = ui.themeDayStart;
    settings.nightStart = ui.themeNightStart;
  }
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

/**
 * A File from a data: URL, decoded in place. (fetch() can't be used: the app's security policy
 * doesn't let it load data: URLs.)
 */
export function dataUrlToFile(dataUrl: string, name: string) {
  const match = dataUrl.match(/^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,(.*)$/s);
  if (!match) throw new Error("Not a data: URL");
  const type = match[1] || "application/octet-stream";
  const payload = match[4] ?? "";
  let bytes: Uint8Array;
  if (match[3]) {
    const binary = atob(payload.replace(/\s+/g, ""));
    bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(payload));
  }
  const blob = new Blob([bytes as BlobPart], { type });
  const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "png";
  const fileName = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.${ext}`;
  return new File([blob], fileName, { type: blob.type });
}

// ── Font names ──

function dataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !/;base64$/i.test(dataUrl.slice(0, comma))) return null;
  const binary = atob(dataUrl.slice(comma + 1).replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function inflate(bytes: Uint8Array) {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The family name inside an OpenType "name" table (typographic family first, then family). */
function nameTableFamily(table: Uint8Array) {
  const view = new DataView(table.buffer, table.byteOffset, table.byteLength);
  const count = view.getUint16(2);
  const storage = view.getUint16(4);
  const found = new Map<number, string>();
  for (let index = 0; index < count; index += 1) {
    const record = 6 + index * 12;
    if (record + 12 > table.byteLength) break;
    const platform = view.getUint16(record);
    const nameId = view.getUint16(record + 6);
    const length = view.getUint16(record + 8);
    const offset = storage + view.getUint16(record + 10);
    if ((nameId !== 1 && nameId !== 16) || found.has(nameId) || offset + length > table.byteLength) continue;
    const raw = table.subarray(offset, offset + length);
    let text = "";
    if (platform === 3 || platform === 0) {
      for (let i = 0; i + 1 < raw.length; i += 2) text += String.fromCharCode((raw[i]! << 8) | raw[i + 1]!);
    } else {
      text = String.fromCharCode(...raw);
    }
    if (text.trim()) found.set(nameId, text.trim());
  }
  return found.get(16) ?? found.get(1) ?? null;
}

/**
 * The real family name of a bundled font (TTF, OTF or WOFF), so a theme's font is listed under the
 * name its CSS uses rather than the file name. Null when it can't be read (WOFF2, broken files).
 */
export async function readFontFamily(dataUrl: string): Promise<string | null> {
  try {
    const bytes = dataUrlBytes(dataUrl);
    if (!bytes || bytes.length < 12) return null;
    const view = new DataView(bytes.buffer);
    const signature = view.getUint32(0);
    if (signature === 0x774f4646) {
      // WOFF 1: a table directory of 20-byte entries after a 44-byte header; tables may be zlib'd.
      const tables = view.getUint16(12);
      for (let index = 0; index < tables; index += 1) {
        const entry = 44 + index * 20;
        if (view.getUint32(entry) !== 0x6e616d65) continue;
        const offset = view.getUint32(entry + 4);
        const compressed = view.getUint32(entry + 8);
        const original = view.getUint32(entry + 12);
        const data = bytes.subarray(offset, offset + compressed);
        return nameTableFamily(compressed < original ? await inflate(data) : data);
      }
      return null;
    }
    if (signature !== 0x00010000 && signature !== 0x4f54544f && signature !== 0x74727565) return null;
    const tables = view.getUint16(4);
    for (let index = 0; index < tables; index += 1) {
      const entry = 12 + index * 16;
      if (view.getUint32(entry) !== 0x6e616d65) continue;
      const offset = view.getUint32(entry + 8);
      const length = view.getUint32(entry + 12);
      return nameTableFamily(bytes.subarray(offset, offset + length));
    }
    return null;
  } catch {
    return null;
  }
}

/** A thumbnail scaled down to at most `maxWidth` pixels wide, as WebP (keeps theme files small). */
export function shrinkImageDataUrl(dataUrl: string, maxWidth = 480): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth <= maxWidth) return resolve(dataUrl);
      const canvas = document.createElement("canvas");
      canvas.width = maxWidth;
      canvas.height = Math.round((image.naturalHeight / image.naturalWidth) * maxWidth);
      const context = canvas.getContext("2d");
      if (!context) return resolve(dataUrl);
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const small = canvas.toDataURL("image/webp", 0.85);
      resolve(small.startsWith("data:image/webp") && small.length < dataUrl.length ? small : dataUrl);
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}
