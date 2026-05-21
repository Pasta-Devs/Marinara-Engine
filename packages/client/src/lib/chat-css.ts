// ──────────────────────────────────────────────
// Chat CSS: sanitisation & scoping utilities
// ──────────────────────────────────────────────

const CHAT_STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const CSS_SELECTOR_RE = /(^|[{}])\s*([^@{}][^{]*)\{/g;

/** Extract `<style>` blocks from HTML and return the CSS + the HTML without them. */
export function extractChatStyleBlocks(html: string): { html: string; css: string } {
  const cssBlocks: string[] = [];
  const withoutStyles = html.replace(CHAT_STYLE_BLOCK_RE, (_match, css: string) => {
    cssBlocks.push(css);
    return "";
  });
  return { html: withoutStyles, css: cssBlocks.join("\n") };
}

/**
 * Strip known-dangerous CSS constructs while preserving visual features
 * like animations, gradients, pseudo-elements, and safe `url()` values.
 */
export function sanitizeChatCss(css: string): string {
  return css
    .replace(/<\/?style\b[^>]*>/gi, "")
    .replace(/@import\s+[^;]+;?/gi, "")
    .replace(/@namespace\s+[^;]+;?/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/vbscript\s*:/gi, "")
    .replace(/behavior\s*:/gi, "x-behavior:")
    .replace(/-moz-binding\s*:/gi, "x-moz-binding:")
    .replace(/url\s*\(\s*(['"]?)(?!data:image\/|https?:\/\/)[^)]+\)/gi, "none")
    .replace(/position\s*:\s*fixed/gi, "position: absolute")
    .replace(/<\/style/gi, "<\\/style")
    .trim();
}

/**
 * Prefix every CSS selector with a scope class so the styles only apply
 * inside a designated container. Keyframe selectors (`from`, `to`, `%`)
 * are preserved as-is; `body`/`html`/`:root` are rewritten to the scope.
 */
export function scopeChatCss(css: string, scopeSelector: string): string {
  const sanitized = sanitizeChatCss(css);
  if (!sanitized) return "";
  return sanitized.replace(CSS_SELECTOR_RE, (_match, boundary: string, selectors: string) => {
    const scopedSelectors = selectors
      .split(",")
      .map((selector) => {
        const trimmed = selector.trim();
        if (!trimmed) return "";
        if (/^(from|to|\d+(?:\.\d+)?%)$/i.test(trimmed)) return trimmed;
        if (trimmed.startsWith(scopeSelector)) return trimmed;
        if (trimmed === ":root" || trimmed === "html" || trimmed === "body") return scopeSelector;
        return `${scopeSelector} ${trimmed}`;
      })
      .filter(Boolean)
      .join(", ");
    return `${boundary} ${scopedSelectors}{`;
  });
}
