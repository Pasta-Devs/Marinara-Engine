// ──────────────────────────────────────────────
// Theme CSS utilities
// ──────────────────────────────────────────────

/**
 * Accept CSS that was accidentally saved with escaped newlines, e.g.
 * `:root {\n  --background: #000;\n}` from JSON/string output, and turn it
 * back into browser-parseable CSS. Normal CSS is returned unchanged.
 */
export function normalizeThemeCss(css: string): string {
  if (!css.includes("\\n") && !css.includes("\\r") && !css.includes("\\t")) return css;
  if (css.includes("\n") || css.includes("\r")) return css;
  if (!/[{};]/.test(css)) return css;

  return css.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n").replace(/\\t/g, "  ");
}
