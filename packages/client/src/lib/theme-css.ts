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
  return stripDangerousCss(normalizeThemeCss(css));
}

function importantDeclarations(style: CSSStyleDeclaration): string {
  const out: string[] = [];
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    if (style.getPropertyPriority(property) !== "important") continue;
    out.push(`${property}: ${style.getPropertyValue(property)} !important;`);
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
