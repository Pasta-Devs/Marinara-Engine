// ──────────────────────────────────────────────
// Theme CSS utilities
// ──────────────────────────────────────────────
import { stripDangerousCss } from "./card-css";

/**
 * Accept CSS that was accidentally saved with escaped newlines, e.g.
 * `:root {\n  --background: #000;\n}` from JSON/string output, and turn it
 * back into browser-parseable CSS. Normal CSS is returned unchanged.
 */
export function normalizeThemeCss(css: string): string {
  if (!css.includes("\\n") && !css.includes("\\r") && !css.includes("\\t")) return css;
  if (css.includes("\n") || css.includes("\r")) return css;
  if (!/[{};]/.test(css)) return css;

  return css
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "  ");
}

export function sanitizeAppCss(css: string): string {
  return scopeDialogSelectors(migrateFocusFrameOutset(stripDangerousCss(normalizeThemeCss(css))));
}

/** Splits a value at top-level slashes (not inside url(), strings or other brackets). */
function splitSlashes(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const ch = value[index]!;
    if (quote) {
      if (ch === "\\") index += 1;
      else if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === "/" && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

/**
 * Theming round 6: since v1.5 the focus frame reaches past its surface only through
 * --mari-focus-frame-outset, so an outset written the old way, as the third part of
 * --mari-focus-frame (source slice / width / outset repeat), was silently dropped and the ring sat
 * on the text. When the theme doesn't set the outset token itself, that length moves into it.
 */
export function migrateFocusFrameOutset(css: string): string {
  if (!/--mari-focus-frame\s*:/.test(css) || /--mari-focus-frame-outset\s*:/.test(css)) return css;
  return css.replace(/(--mari-focus-frame\s*:)([^;{}]*)/g, (whole, prop: string, value: string) => {
    const parts = splitSlashes(value);
    if (parts.length < 3) return whole;
    const tokens = parts[2]!.trim().split(/\s+/);
    const lengths: string[] = [];
    while (tokens.length && /^-?[\d.]+(px|rem|em)$|^0$/i.test(tokens[0]!)) lengths.push(tokens.shift()!);
    const outset = lengths.find((length) => length !== "0");
    if (!outset) return whole;
    const repeat = tokens.join(" ");
    const kept = `${parts[0]}/${parts[1]}${repeat ? ` ${repeat}` : ""}`.trim();
    return `${prop} ${kept}; --mari-focus-frame-outset: ${outset}`;
  });
}

/**
 * Theming round 6: a rule on `[role="dialog"]` means a window. The app's full-screen overlays (the
 * chat help spotlight) are dialogs too, so such a rule used to paint a window title across the
 * whole screen and over the top bar. They carry data-mari-app-overlay and are left out of it.
 */
export function scopeDialogSelectors(css: string): string {
  return css.replace(
    /\[\s*role\s*=\s*(["']?)dialog\1\s*(?:[is]\s*)?\]/gi,
    '[role="dialog"]:not([data-mari-app-overlay])',
  );
}

/** Splits a declaration block at top-level semicolons (not inside strings or brackets). */
function splitDeclarations(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[") depth += 1;
    else if ((char === ")" || char === "]") && depth > 0) depth -= 1;
    else if (char === ";" && depth === 0) {
      out.push(text.slice(start, index));
      start = index + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((part) => part.trim()).filter(Boolean);
}

function importantDeclarations(style: CSSStyleDeclaration): string {
  const out: string[] = [];
  // A shorthand written with var() (`border-image: var(--frame) 40 fill !important`) leaves its
  // longhands empty until the variable is known, so getPropertyValue() returns "" for them. Those
  // are copied as the browser serialises them in cssText, which keeps the shorthand.
  const pending = new Set<string>();
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    if (style.getPropertyPriority(property) !== "important") continue;
    const value = style.getPropertyValue(property);
    if (value) out.push(`${property}: ${value} !important;`);
    else pending.add(property);
  }
  if (pending.size) {
    for (const declaration of splitDeclarations(style.cssText)) {
      if (!/!\s*important\s*$/i.test(declaration)) continue;
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      // Keep it when it is one of the empty longhands, or a shorthand that covers one.
      const covers = pending.has(property) || [...pending].some((longhand) => longhand.startsWith(`${property}-`));
      if (covers && !property.startsWith("--")) out.push(`${declaration};`);
    }
  }
  return out.join(" ");
}

function importantRules(rules: CSSRuleList): string {
  const out: string[] = [];
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const declarations = importantDeclarations(rule.style);
      const nested = "cssRules" in rule && rule.cssRules ? importantRules(rule.cssRules as CSSRuleList) : "";
      if (declarations || nested) out.push(`${rule.selectorText} { ${declarations} ${nested} }`);
    } else if (rule instanceof CSSMediaRule) {
      const inner = importantRules(rule.cssRules);
      if (inner) out.push(`@media ${rule.conditionText} { ${inner} }`);
    } else if (rule instanceof CSSSupportsRule) {
      const inner = importantRules(rule.cssRules);
      if (inner) out.push(`@supports ${rule.conditionText} { ${inner} }`);
    } else if (typeof CSSContainerRule !== "undefined" && rule instanceof CSSContainerRule) {
      const inner = importantRules(rule.cssRules);
      if (inner) out.push(`@container ${rule.conditionText} { ${inner} }`);
    } else if (typeof CSSLayerBlockRule !== "undefined" && rule instanceof CSSLayerBlockRule) {
      // A theme's own layers keep their order inside the theme's !important layer.
      const inner = importantRules(rule.cssRules);
      if (inner) out.push(rule.name ? `@layer ${rule.name} { ${inner} }` : inner);
    }
  }
  return out.join("\n");
}

/**
 * A theme's !important declarations, rewritten for the `mari-theme-important` cascade layer.
 *
 * The app's own CSS sits in cascade layers, and an unlayered !important loses to a layered one,
 * so a theme's !important would never beat Tailwind's `!rounded-full`. The theme's normal rules
 * stay unlayered (they already beat every layer); its !important ones also go into the early
 * mari-theme-important layer, where they beat the app's !important too. Only the protected-chrome
 * layer comes before it. Returns "" when the theme has none, or the browser can't parse it here.
 */
export function extractImportantThemeCss(css: string): string {
  if (!css.includes("!important") || typeof CSSStyleSheet === "undefined") return "";
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    const rules = importantRules(sheet.cssRules);
    return rules ? `@layer mari-theme-important {\n${rules}\n}` : "";
  } catch {
    return "";
  }
}

/** Whether a theme's CSS sets a custom property anywhere (outside comments). */
export function themeSetsVariable(css: string, name: string): boolean {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s;{])${escaped}\\s*:`, "m").test(clean);
}
