// ──────────────────────────────────────────────
// Theme content check (theme security audit, 2026-11-09)
//
// Runs on every theme before it is applied, wherever it came from (an imported file, the editor,
// the API, Professor Mari, a backup, a per-chat pick on another device), and in the import preview:
//   • text the theme would draw (CSS strings, the message box placeholder, message templates, the
//     words inside its SVG pictures) must pass lib/theme-text-safety.ts;
//   • the stylesheet as the browser parses it may only point at the theme's own pictures (blob:
//     URLs this tab made), embedded data: pictures and fonts, #fragments and about:invalid. That
//     re-checks the text sanitiser (lib/card-css.ts) with the browser's own parser, so a trick that
//     slips past the sanitiser's patterns still can't reach the network;
//   • SVG pictures must survive the SVG rebuild (lib/theme-svg.ts), and raster pictures must not
//     decode to a giant bitmap.
// A theme that fails is not applied at all; the safety bar says why.
// ──────────────────────────────────────────────
import type { ThemeMeta } from "@marinara-engine/shared";
import type { ThemeGuardProblem } from "./theme-safety";
import { cssTextThreat, firstThreat, themeTextThreat, type ThemeTextThreat } from "./theme-text-safety";
import { sanitizeSvg } from "./theme-svg";
import { INLINE_IMAGE, dataUrlParts, isSvgPicture, pictureSizeAllowed, type ThemeImage } from "./theme-images";

export type ThemeContentProblem =
  | { kind: "text"; where: "css" | "template" | "picture" | "name"; text: string; threat: ThemeTextThreat }
  | { kind: "url"; url: string }
  | { kind: "picture"; name: string; why: "too-big" };

/** Strings a stylesheet points at with url() or image-set(), as the browser parsed them. */
function parsedUrls(css: string): string[] | null {
  if (typeof CSSStyleSheet === "undefined") return [];
  let sheet: CSSStyleSheet;
  try {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
  } catch {
    return null;
  }
  const urls: string[] = [];
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      const nested = (rule as CSSGroupingRule).cssRules;
      // Grouping rules (@media, @supports, @layer, @container, nesting) are walked; their own
      // text repeats their children, so only their prelude is read.
      const text = nested && nested.length ? rule.cssText.slice(0, rule.cssText.indexOf("{")) : rule.cssText;
      for (const match of text.matchAll(/url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)]*))\s*\)/gi))
        urls.push((match[1] ?? match[2] ?? match[3] ?? "").trim());
      for (const match of text.matchAll(/image-set\(([^)]*)\)/gi))
        for (const str of match[1]!.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g))
          urls.push(str[1] ?? str[2] ?? "");
      if (nested) walk(nested);
    }
  };
  walk(sheet.cssRules);
  return urls;
}

function urlAllowed(url: string) {
  const value = url.replace(/\\(.)/g, "$1").trim();
  if (!value || value === "about:invalid" || value.startsWith("#")) return true;
  if (/^data:(?:image\/|font\/|application\/(?:font|x-font|octet-stream))/i.test(value)) return true;
  if (typeof location !== "undefined" && value.startsWith(`blob:${location.origin}/`)) return true;
  return false;
}

/**
 * Problems with a theme's content. `css` is the stylesheet as it will be injected (sanitised, its
 * pictures already turned into blob: URLs); `rawCss` the theme's own text.
 */
export function checkThemeContent(input: {
  css: string;
  rawCss: string;
  meta?: ThemeMeta | null;
  /** Whether the theme's message templates would render (the user allows themes with HTML). */
  templates?: boolean;
  name?: string;
}): ThemeContentProblem[] {
  const problems: ThemeContentProblem[] = [];
  const text = cssTextThreat(input.rawCss);
  if (text) problems.push({ kind: "text", where: "css", ...text });
  if (input.name) {
    const threat = themeTextThreat(input.name, { lengthCap: null });
    if (threat && threat !== "long") problems.push({ kind: "text", where: "name", text: input.name, threat });
  }
  const urls = parsedUrls(input.css);
  if (urls === null) problems.push({ kind: "url", url: "(unparsable stylesheet)" });
  else {
    const bad = urls.find((url) => !urlAllowed(url));
    if (bad !== undefined) problems.push({ kind: "url", url: bad.slice(0, 120) });
  }
  const pictures: ThemeImage[] = [...(input.meta?.images ?? []), ...(input.meta?.backgrounds ?? [])];
  // Inline pictures written in the CSS count too.
  for (const match of input.rawCss.matchAll(INLINE_IMAGE)) {
    const src = match[1] ?? match[2] ?? match[3] ?? "";
    if (/^data:image\/svg/i.test(src)) pictures.push({ name: "inline.svg", src });
  }
  for (const picture of pictures) {
    const parts = dataUrlParts(picture.src);
    if (!parts) continue;
    if (isSvgPicture(parts.mime, parts.bytes)) {
      // An SVG that doesn't parse is simply not shown (lib/theme-images.ts), so it is no risk.
      const clean = sanitizeSvg(new TextDecoder().decode(parts.bytes));
      if (!clean) continue;
      const threat = clean.text ? themeTextThreat(clean.text) : null;
      if (threat) problems.push({ kind: "text", where: "picture", text: clean.text.slice(0, 120), threat });
    } else if (!pictureSizeAllowed(parts.bytes)) problems.push({ kind: "picture", name: picture.name, why: "too-big" });
  }
  if (input.templates && input.meta?.templates) {
    const found = firstThreat(
      Object.values(input.meta.templates)
        .filter((value): value is string => typeof value === "string")
        .map(templateText),
      { lengthCap: 400 },
    );
    if (found) problems.push({ kind: "text", where: "template", ...found });
  }
  return problems;
}

/** A template's words and the attributes people read (title="…" shows as a tooltip). */
export function templateText(html: string) {
  const attributes = Array.from(
    html.matchAll(/\s(?:title|aria-label|alt|placeholder)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g),
    (m) => m[1] ?? m[2] ?? m[3] ?? "",
  );
  const words = html.replace(/<[^>]*>/g, " ").replace(/\{\{\s*[a-z]+\s*\}\}/gi, " ");
  return `${words} ${attributes.join(" ")}`
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The same problems in the safety bar's words (lib/theme-safety.ts). */
export function contentProblemsAsGuard(input: Parameters<typeof checkThemeContent>[0]): ThemeGuardProblem[] {
  return checkThemeContent(input).map((problem): ThemeGuardProblem => {
    if (problem.kind === "url") return { area: "app", kind: "unsafe-url", text: problem.url };
    if (problem.kind === "picture") return { area: "app", kind: "unsafe-picture", text: problem.name };
    return {
      area: problem.where === "css" || problem.where === "picture" ? "app" : "chat",
      kind: problem.threat === "long" ? "long-text" : "fake-text",
      text: problem.text.length > 80 ? `${problem.text.slice(0, 79)}…` : problem.text,
    };
  });
}
