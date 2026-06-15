// ──────────────────────────────────────────────
// Theme CSS utilities
// ──────────────────────────────────────────────

/** Normalize CSS accidentally saved with escaped newlines from JSON/string output. */
export function normalizeThemeCss(css: string): string {
  if (!css.includes("\\n") && !css.includes("\\r") && !css.includes("\\t")) return css;
  if (css.includes("\n") || css.includes("\r")) return css;
  if (!/[{};]/.test(css)) return css;

  return css.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n").replace(/\\t/g, "  ");
}
