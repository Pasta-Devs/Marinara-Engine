// ──────────────────────────────────────────────
// Chat CSS — sanitization and scoping utilities
// ──────────────────────────────────────────────

export type ChatModeFilter = "roleplay" | "conversation" | "game";

const CHAT_MODE_RE = /@chat-mode\s+(roleplay|conversation|game)\s*\{/gi;

/**
 * Filter CSS by `@chat-mode <mode> { ... }` blocks.
 *
 * - `@chat-mode conversation { ... }` → included only in conversation mode
 * - `@chat-mode roleplay { ... }` → included only in roleplay mode
 * - `@chat-mode game { ... }` → included only in game mode
 * - CSS outside any `@chat-mode` block → included in ALL modes
 *
 * Card creators use this to target styles to specific surfaces while
 * keeping a shared base that applies everywhere.
 */
export function filterCssByMode(css: string, chatMode: ChatModeFilter): string {
  const chunks: string[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  CHAT_MODE_RE.lastIndex = 0;

  while ((match = CHAT_MODE_RE.exec(css)) !== null) {
    // Emit any CSS between the last block and this one (unscoped = all modes)
    if (match.index > cursor) {
      chunks.push(css.slice(cursor, match.index));
    }

    const targetMode = match[1].toLowerCase();
    const bodyStart = match.index + match[0].length;

    // Find the matching closing brace (handle one level of nesting)
    let depth = 1;
    let i = bodyStart;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    const body = css.slice(bodyStart, i - 1);
    cursor = i;
    CHAT_MODE_RE.lastIndex = i;

    if (targetMode === chatMode) {
      chunks.push(body);
    }
  }

  // Trailing CSS after the last @chat-mode block (unscoped = all modes)
  if (cursor < css.length) {
    chunks.push(css.slice(cursor));
  }

  return chunks.join("\n");
}

/** Theme tokens that card CSS must never override. */
const THEME_TOKEN_BLOCKLIST = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
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
  "--radius",
  "--sidebar-background",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--color-background",
  "--color-foreground",
  "--color-card",
  "--color-primary",
  "--color-secondary",
  "--color-muted",
  "--color-accent",
  "--color-destructive",
  "--color-border",
  "--color-input",
  "--color-ring",
];


/** Strip CSS comments */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Remove dangerous constructs from CSS. */
export function sanitizeChatCss(css: string): string {
  let out = stripComments(css);

  // Strip @import and @namespace
  out = out.replace(/@import\b[^;]*;/gi, "");
  out = out.replace(/@namespace\b[^;]*;/gi, "");

  // Strip expression()
  out = out.replace(/expression\s*\([^)]*\)/gi, "");

  // Strip javascript: / vbscript:
  out = out.replace(/javascript\s*:/gi, "");
  out = out.replace(/vbscript\s*:/gi, "");

  // Strip behavior:
  out = out.replace(/behavior\s*:[^;]*/gi, "");

  // Strip -moz-binding:
  out = out.replace(/-moz-binding\s*:[^;]*/gi, "");

  // Strip unsafe url() (only those with protocols or data:)
  out = out.replace(/url\s*\(\s*['"]?\s*(javascript|vbscript|data)\s*:/gi, "url(about:invalid");

  // Convert position:fixed to position:absolute
  out = out.replace(/position\s*:\s*fixed/gi, "position:absolute");

  // Strip </style (prevent injection breakout)
  out = out.replace(/<\/style/gi, "");

  // Strip theme token declarations (property: value pairs that set blocked tokens)
  out = out.replace(
    new RegExp(
      `(${THEME_TOKEN_BLOCKLIST.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*:[^;]*;?`,
      "gi",
    ),
    "",
  );

  // Strip !important
  out = out.replace(/!important/gi, "");

  return out;
}

const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

/** Extract `<style>` blocks from HTML, returning the CSS content. */
export function extractChatStyleBlocks(html: string): string {
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = STYLE_BLOCK_RE.exec(html)) !== null) {
    blocks.push(match[1]);
  }
  STYLE_BLOCK_RE.lastIndex = 0;
  return blocks.join("\n");
}

/**
 * Scope CSS rules under a given selector.
 * - Sanitizes input
 * - Namespaces @keyframes with "mc-" prefix
 * - Rewrites :root, html, body to the scope selector
 * - Prefixes all other selectors with the scope selector
 */
export function scopeChatCss(css: string, scopeSelector: string): string {
  let sanitized = sanitizeChatCss(css);

  // Namespace @keyframes: @keyframes foo -> @keyframes mc-foo
  sanitized = sanitized.replace(/@keyframes\s+([^\s{]+)/gi, (_match, name: string) => {
    return `@keyframes mc-${name}`;
  });

  // Rewrite animation-name references too
  sanitized = sanitized.replace(
    /animation(?:-name)?\s*:[^;{}]*/gi,
    (match) => {
      // For each animation name token that isn't a keyword, prefix with mc-
      return match.replace(
        /:\s*([^;{}]*)/,
        (_, value: string) => {
          const prefixed = value.replace(
            /(?:^|,\s*)([a-zA-Z_][\w-]*)/g,
            (full, name: string) => {
              const keywords = new Set([
                "none", "initial", "inherit", "unset", "infinite", "alternate",
                "reverse", "alternate-reverse", "normal", "forwards", "backwards",
                "both", "running", "paused", "ease", "ease-in", "ease-out",
                "ease-in-out", "linear", "step-start", "step-end",
              ]);
              if (keywords.has(name) || /^\d/.test(name)) return full;
              return full.replace(name, `mc-${name}`);
            },
          );
          return `: ${prefixed}`;
        },
      );
    },
  );

  // Split into rules and scope selectors
  const result: string[] = [];
  // Simple rule-level split: find selector { ... } blocks
  const ruleRe = /([^{}]+)\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let ruleMatch: RegExpExecArray | null;

  while ((ruleMatch = ruleRe.exec(sanitized)) !== null) {
    const selector = ruleMatch[1].trim();
    const body = ruleMatch[2];

    // Skip @keyframes — already namespaced, don't prefix their contents
    if (/^@keyframes\s/i.test(selector)) {
      result.push(`${selector} {${body}}`);
      continue;
    }

    // Handle @media and other at-rules that wrap rulesets
    if (/^@/.test(selector)) {
      // Recursively scope the inner rules
      const innerScoped = scopeChatCss(body, scopeSelector);
      result.push(`${selector} {${innerScoped}}`);
      continue;
    }

    // Scope each selector in the comma-separated list
    const scopedSelectors = selector.split(",").map((sel) => {
      const s = sel.trim();
      // :root, html, body -> scopeSelector
      if (/^(:root|html|body)$/i.test(s)) return scopeSelector;
      // Starts with :root, html, body -> replace with scope
      if (/^(:root|html|body)\s/i.test(s)) return s.replace(/^(:root|html|body)/i, scopeSelector);
      // Otherwise prefix
      return `${scopeSelector} ${s}`;
    });

    result.push(`${scopedSelectors.join(", ")} {${body}}`);
  }

  return result.join("\n");
}
