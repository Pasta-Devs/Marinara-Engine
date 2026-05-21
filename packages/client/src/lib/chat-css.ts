// ──────────────────────────────────────────────
// Chat CSS: sanitisation & scoping utilities
// ──────────────────────────────────────────────

const CHAT_STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const CSS_SELECTOR_RE = /(^|[{}])\s*([^@{}][^{]*)\{/g;

// ── Theme-token blocklist ────────────────────
// App theme custom properties (shadcn / Tailwind) that card CSS must NOT
// override. Declarations like `--background: red;` are stripped so a card
// cannot repaint the application UI outside the chat surface.
//
// Card creators can still define their OWN custom properties
// (e.g. `--my-char-glow: cyan`) — only the tokens below are blocked.
const BLOCKED_THEME_TOKENS: readonly string[] = [
  // shadcn core design tokens
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "radius",
  // Sidebar tokens
  "sidebar",
  "sidebar-foreground",
  "sidebar-border",
  "sidebar-accent",
  "sidebar-accent-foreground",
  // Tailwind v4 `--color-*` aliases
  "color-background",
  "color-foreground",
  "color-card",
  "color-card-foreground",
  "color-popover",
  "color-popover-foreground",
  "color-primary",
  "color-primary-foreground",
  "color-secondary",
  "color-secondary-foreground",
  "color-muted",
  "color-muted-foreground",
  "color-accent",
  "color-accent-foreground",
  "color-destructive",
  "color-destructive-foreground",
  "color-border",
  "color-input",
  "color-ring",
  "color-sidebar",
  "color-sidebar-foreground",
  "color-sidebar-border",
  "color-sidebar-accent",
  "color-sidebar-accent-foreground",
] as const;

// Sort longest-first so regex alternation is greedy-safe.
const sortedTokens = [...BLOCKED_THEME_TOKENS].sort((a, b) => b.length - a.length);

// Matches `--<token>\s*:<value>;` — the `\s*:` ensures partial names like
// `--background-image` are not accidentally caught.
const THEME_TOKEN_RE = new RegExp(
  `--(?:${sortedTokens.join("|")})\\s*:[^;}]+;?`,
  "g",
);

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
 *
 * Also strips declarations of app theme custom properties (`--background`,
 * `--card`, `--foreground`, etc.) to prevent card CSS from repainting the
 * application UI outside the chat surface.
 */
export function sanitizeChatCss(css: string): string {
  return (
    css
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
      // Strip app theme token overrides
      .replace(THEME_TOKEN_RE, "/* [blocked] */")
      .trim()
  );
}

/**
 * Namespace `@keyframes` names with a prefix so card animations cannot
 * collide with (or override) application-level animations.
 * Also rewrites `animation` / `animation-name` property values to match.
 */
function namespaceKeyframes(css: string, prefix: string): string {
  const names: string[] = [];

  // 1. Rename @keyframes declarations
  let result = css.replace(/@keyframes\s+([\w-]+)/g, (_m, name: string) => {
    names.push(name);
    return `@keyframes ${prefix}${name}`;
  });

  if (!names.length) return result;

  // 2. Sort longest-first to prevent partial-name replacement issues
  names.sort((a, b) => b.length - a.length);

  // 3. Build a pattern matching any collected name bounded by CSS identifier edges
  //    (hyphens are part of CSS identifiers, so \b alone is insufficient)
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const nameRe = new RegExp(`(?<![\\w-])(${escaped.join("|")})(?![\\w-])`, "g");

  // 4. Rewrite animation / animation-name property values only
  result = result.replace(
    /(animation(?:-name)?\s*:[^;{}]*)/g,
    (_m, propDecl: string) => propDecl.replace(nameRe, `${prefix}$1`),
  );

  return result;
}

// Matches :root, html, or body at the start of a selector, followed by
// a CSS combinator/attachment boundary (space, [, :, ., #, >, +, ~, ,)
// or end-of-string.  This allows compound selectors like
// `:root[data-chat-mode="roleplay"]` to be rewritten correctly.
const ROOT_SELECTOR_RE = /^(:root|html|body)(?=$|[\s[:.#>+~,])/;

/**
 * Prefix every CSS selector with a scope class so the styles only apply
 * inside a designated container. Keyframe selectors (`from`, `to`, `%`)
 * are preserved as-is; `body`/`html`/`:root` are rewritten to the scope.
 *
 * Compound selectors like `:root[data-chat-mode="roleplay"] .foo` are
 * rewritten to `<scope>[data-chat-mode="roleplay"] .foo` so card creators
 * can target specific chat modes.
 *
 * Also namespaces `@keyframes` to prevent global animation-name collisions
 * and strips app theme custom-property overrides.
 */
export function scopeChatCss(css: string, scopeSelector: string): string {
  const sanitized = sanitizeChatCss(css);
  if (!sanitized) return "";

  // Namespace @keyframes before scoping selectors
  const withNsKeyframes = namespaceKeyframes(sanitized, "mc-");

  return withNsKeyframes.replace(CSS_SELECTOR_RE, (_match, boundary: string, selectors: string) => {
    const scopedSelectors = selectors
      .split(",")
      .map((selector) => {
        const trimmed = selector.trim();
        if (!trimmed) return "";
        if (/^(from|to|\d+(?:\.\d+)?%)$/i.test(trimmed)) return trimmed;
        if (trimmed.startsWith(scopeSelector)) return trimmed;
        // Replace :root / html / body prefix with the scope selector,
        // preserving any compound suffix (e.g. [data-chat-mode="game"])
        if (ROOT_SELECTOR_RE.test(trimmed)) {
          return trimmed.replace(ROOT_SELECTOR_RE, scopeSelector);
        }
        return `${scopeSelector} ${trimmed}`;
      })
      .filter(Boolean)
      .join(", ");
    return `${boundary} ${scopedSelectors}{`;
  });
}
