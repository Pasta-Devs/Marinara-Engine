// ──────────────────────────────────────────────
// Chat CSS — sanitization and scoping utilities
// ──────────────────────────────────────────────

export type ChatModeFilter = "roleplay" | "conversation" | "game";

const CHAT_MODE_RE = /@chat-mode\s+(roleplay|conversation|game)\s*\{/gi;

function findCssBlockEnd(css: string, bodyStart: number): { end: number; closed: boolean } {
  let depth = 1;
  let i = bodyStart;
  let quote: string | null = null;
  let escaped = false;
  let inComment = false;

  while (i < css.length && depth > 0) {
    const ch = css[i]!;
    const next = css[i + 1];
    if (inComment) {
      if (ch === "*" && next === "/") {
        inComment = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inComment = true;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }

  return { end: i, closed: depth === 0 };
}

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

    const block = findCssBlockEnd(css, bodyStart);
    const body = css.slice(bodyStart, block.closed ? block.end - 1 : block.end);
    cursor = block.end;
    CHAT_MODE_RE.lastIndex = block.end;

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

/**
 * Heuristic: does this card CSS reference the typing-indicator hooks?
 * Used to decide whether a character's typing row should render on its own
 * (so its `.mari-typing-*` / `data-typing-name` rules apply in isolation) rather
 * than being folded into the combined "A, B are typing…" row. Callers should pass
 * the CSS already filtered to the active surface via `filterCssByMode`.
 *
 * Comments are stripped first so an explanatory note that merely mentions
 * `.mari-typing` or `data-typing-name` can't be mistaken for a real selector and
 * trigger a spurious per-character row.
 */
export function cssTargetsTypingIndicator(css: string): boolean {
  return /\.mari-typing|data-typing-name/i.test(stripQuotedStrings(stripComments(css)));
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

/** Replace quoted CSS strings with empty quotes so heuristic scanners ignore decorative text. */
function stripQuotedStrings(css: string): string {
  return css.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (match) => match[0]! + match[0]!);
}

function sanitizeContentText(text: string): string {
  const stripped = text.replace(/[<>]/g, "");
  return stripped.length > 200 ? stripped.slice(0, 200) : stripped;
}

function sanitizeContentQuotedSegments(value: string): string {
  return value.replace(/(['"])((?:\\.|(?!\1)[\s\S])*)\1/g, (_match, quote: string, text: string) => {
    return `${quote}${sanitizeContentText(text)}${quote}`;
  });
}

const CONTENT_TOKEN_RE =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|(?:counter|counters|attr)\s*\([^)]*\)|open-quote|close-quote|no-open-quote|no-close-quote|none|normal)\s*/gi;

function isAllowedContentExpression(value: string): boolean {
  return value.replace(CONTENT_TOKEN_RE, "").trim().length === 0;
}

function matchContentPropertyColon(css: string, index: number): number | null {
  if (css.slice(index, index + "content".length).toLowerCase() !== "content") return null;
  if (index > 0 && /[-_A-Za-z0-9]/.test(css[index - 1]!)) return null;
  let cursor = index + "content".length;
  while (cursor < css.length && /\s/.test(css[cursor]!)) cursor++;
  return css[cursor] === ":" ? cursor : null;
}

function findDeclarationEnd(css: string, valueStart: number): { valueEnd: number; terminator: string } {
  let quote: string | null = null;
  let escaped = false;
  for (let cursor = valueStart; cursor < css.length; cursor++) {
    const ch = css[cursor]!;
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ";" || ch === "}") return { valueEnd: cursor, terminator: ch };
  }
  return { valueEnd: css.length, terminator: "" };
}

function sanitizeContentDeclarationValue(value: string, terminator: string): string {
  const normalized = value.trim();
  // Allow empty string content (pseudo-element clearing)
  if (/^(['"])\s*\1$/.test(normalized)) {
    return `content: ${normalized}${terminator}`;
  }
  // Allow quoted text with sanitization
  const quoted = normalized.match(/^(['"])(.*)\1$/);
  if (quoted) {
    return `content: "${sanitizeContentText(quoted[2])}"${terminator}`;
  }
  // Allow CSS functions like counter(), attr(), etc.
  if (isAllowedContentExpression(normalized)) {
    return `content: ${sanitizeContentQuotedSegments(normalized)}${terminator}`;
  }
  return `content: ''${terminator}`;
}

function sanitizeContentDeclarations(css: string): string {
  let result = "";
  let lastAppend = 0;
  let cursor = 0;
  let quote: string | null = null;
  let escaped = false;

  while (cursor < css.length) {
    const ch = css[cursor]!;
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      cursor++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cursor++;
      continue;
    }

    const colonIndex = matchContentPropertyColon(css, cursor);
    if (colonIndex !== null) {
      const valueStart = colonIndex + 1;
      const { valueEnd, terminator } = findDeclarationEnd(css, valueStart);
      result += css.slice(lastAppend, cursor);
      result += sanitizeContentDeclarationValue(css.slice(valueStart, valueEnd), terminator);
      cursor = valueEnd + (terminator ? 1 : 0);
      lastAppend = cursor;
      continue;
    }
    cursor++;
  }

  return result + css.slice(lastAppend);
}

/** Decode CSS escape sequences (`\XX` hex, `\c` literal) to the characters a browser parses. */
function decodeCssEscapes(input: string): string {
  return input.replace(
    /\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g,
    (_m, hex: string | undefined, ch: string | undefined) => {
      if (hex) {
        const cp = parseInt(hex, 16);
        return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
      }
      return ch ?? "";
    },
  );
}

// Match a quoted string (group 1) OR a single CSS escape sequence. Strings come first so the
// scanner steps over them, leaving their contents untouched.
const STRING_OR_ESCAPE = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\\(?:[0-9a-fA-F]{1,6}\s?|[\s\S])/g;

/**
 * Canonicalize CSS escapes that spell a token character, so the literal-text guards in
 * sanitizeChatCss can't be evaded by escaping. CSS escapes are decoded by the engine, so
 * `po\73ition` is `position`, `\75rl(` is `url(`, `\40 import` is `@import`, and
 * `\2d-background` is `--background` — and the raw-text regexes below would otherwise miss
 * every one of them.
 *
 * We decode escapes resolving to ASCII letters, `@`, or `-`. Letters and `@` spell the keyword
 * guards (url, @import, @font-face, :has, position, content…). `-` is included because the only
 * punctuation-led forbidden tokens are hyphen-prefixed identifiers — custom-property / theme
 * tokens (`--…`) and the `-moz-binding` vendor prefix; no benign card CSS escapes a hyphen
 * (hyphens never need escaping in identifiers), so decoding it stays equivalent.
 *
 * Escapes resolving to other punctuation or digits are left byte-exact. They legitimately appear
 * in selectors (`.\32 xl`, `.w-1\/2`) where decoding would change meaning, and — crucially — they
 * cannot disguise a forbidden token: by CSS/HTML tokenization an escaped `:` / `!` / `/` becomes
 * an identifier character, not a declaration separator, an `!important` delimiter, or a `</style`
 * breakout. Escapes inside string literals are always preserved.
 */
function canonicalizeKeywordEscapes(css: string): string {
  return css.replace(STRING_OR_ESCAPE, (match: string, stringLiteral: string | undefined) => {
    if (stringLiteral !== undefined) return stringLiteral;
    const decoded = decodeCssEscapes(match);
    return /^[-A-Za-z@]$/.test(decoded) ? decoded : match;
  });
}

/**
 * Strip the CSS constructs that are dangerous no matter where the CSS is injected:
 * network exfiltration (url()/@import/@namespace/@font-face), script execution
 * (expression()/javascript:/vbscript:/behavior/-moz-binding), and browsing-history
 * probing (:visited).
 *
 * Unlike scoped card CSS, app-level theme and extension CSS is allowed to override
 * theme tokens, use !important, and position elements — so it must be run through
 * THIS function rather than sanitizeChatCss, which additionally applies card-only
 * scope/theme-protection passes that would neuter a legitimate theme.
 */
export function stripDangerousCss(css: string): string {
  let out = stripComments(css);

  // ── Escape normalization ──
  // Canonicalize escaped keyword characters up front so every literal-text guard below sees the
  // tokens a browser would actually parse (e.g. `\75rl(` → `url(`, `po\73ition` → `position`).
  // Benign escapes in selectors (digits/punctuation) and string contents are preserved (#1989).
  out = canonicalizeKeywordEscapes(out);

  // ── Network exfiltration prevention ──
  // Strip ALL url() except data: URIs for images and fonts (no external network requests).
  // Allowed MIME prefixes are intentionally narrow: image/*, font/*, and the font-specific
  // application/font* and application/x-font* (no generic application/octet-stream).
  out = out.replace(
    /url\s*\(\s*(['"]?)\s*(?!['"]?\s*data:(?:image\/|font\/|application\/(?:font|x-font)))[^)]*\)/gi,
    "url(about:invalid)",
  );
  // Strip @import (network request + CSS injection)
  out = out.replace(/@import\b[^;]*;/gi, "");
  // Strip @namespace
  out = out.replace(/@namespace\b[^;]*;/gi, "");
  // Keep an @font-face block only if every source is a FONT data: URI. The block must carry
  // at least one url() (an empty url() set would otherwise pass vacuously), every url() must
  // be a font data: URI, and local() sources are rejected — they reference installed fonts
  // (non-data, usable for fingerprinting) and fall outside the documented "embedded data:
  // fonts only" contract. External URLs were already neutralized to url(about:invalid) above,
  // and image/* data URIs (allowed for general url() use) are not valid font sources.
  out = out.replace(/@font-face\s*\{[^}]*\}/gi, (block) => {
    const urls = block.match(/url\s*\([^)]*\)/gi) ?? [];
    const allFontData =
      urls.length > 0 &&
      urls.every((u) => /url\s*\(\s*(['"]?)\s*data:(?:font\/|application\/(?:font|x-font))/i.test(u));
    const hasLocalSource = /\blocal\s*\(/i.test(block);
    return allFontData && !hasLocalSource ? block : "";
  });

  // ── Script/expression injection ──
  out = out.replace(/expression\s*\([^)]*\)/gi, "");
  out = out.replace(/javascript\s*:/gi, "");
  out = out.replace(/vbscript\s*:/gi, "");
  out = out.replace(/behavior\s*:[^;]*/gi, "");
  out = out.replace(/-moz-binding\s*:[^;]*/gi, "");

  // ── History probing ──
  // Strip :visited — can detect browsing history via style differences
  out = out.replace(/:visited/gi, ":link");

  return out;
}

/**
 * Remove dangerous constructs from CSS and additionally lock it down for use as
 * scoped card CSS.
 *
 * Security model: card CSS is untrusted user content shared between users.
 * A malicious card creator must not be able to:
 * - Make network requests (data exfiltration, IP tracking)
 * - Escape the scoped container to style/probe app UI
 * - Override application theme tokens
 * - Inject phishing content via `content` property
 * - Cause denial-of-service via resource-heavy rules
 */
function sanitizeChatCss(css: string): string {
  let out = stripDangerousCss(css);

  // ── Scope escape prevention ──
  // Strip :has() — can probe elements outside the scoped container
  out = out.replace(/:has\s*\([^)]*\)/gi, "");
  // Convert position:fixed to position:absolute (prevent viewport overlays)
  out = out.replace(/position\s*:\s*fixed/gi, "position:absolute");

  // ── Content injection prevention ──
  // Allow content property with sanitized text (for decorative labels in card CSS).
  // Strip HTML-like characters and cap length to prevent phishing/UI spoofing.
  out = sanitizeContentDeclarations(out);
  // Strip </style (prevent injection breakout)
  out = out.replace(/<\/style/gi, "");

  // ── Theme protection ──
  // Strip theme token declarations
  out = out.replace(
    new RegExp(
      `(${THEME_TOKEN_BLOCKLIST.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*:[^;]*;?`,
      "gi",
    ),
    "",
  );
  // Strip !important (prevent overriding app styles)
  out = out.replace(/!important/gi, "");

  return out;
}

/**
 * Stable, short, non-cryptographic hash (FNV-1a, base36). Used only to salt
 * generated identifiers so they can't collide between independent card CSS
 * specimens — it does not need to be secure, just deterministic.
 */
function hashCss(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
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
  sanitized = sanitized.replace(/animation(?:-name)?\s*:[^;{}]*/gi, (match) => {
    // For each animation name token that isn't a keyword, prefix with mc-
    return match.replace(/:\s*([^;{}]*)/, (_, value: string) => {
      const prefixed = value.replace(/(?:^|,\s*)([a-zA-Z_][\w-]*)/g, (full, name: string) => {
        const keywords = new Set([
          "none",
          "initial",
          "inherit",
          "unset",
          "infinite",
          "alternate",
          "reverse",
          "alternate-reverse",
          "normal",
          "forwards",
          "backwards",
          "both",
          "running",
          "paused",
          "ease",
          "ease-in",
          "ease-out",
          "ease-in-out",
          "linear",
          "step-start",
          "step-end",
        ]);
        if (keywords.has(name) || /^\d/.test(name)) return full;
        return full.replace(name, `mc-${name}`);
      });
      return `: ${prefixed}`;
    });
  });

  // Namespace @font-face families so an embedded font can't override an app-wide
  // family (e.g. "Inter") outside the card. We rewrite the declared family in each
  // kept @font-face block to a unique "mc-font-*" name, then rewrite the
  // font-family / font references that point at it — mirroring @keyframes handling.
  //
  // @font-face rules are global (they can't be scoped under a selector), so the
  // namespaced name is salted with a per-card hash (scope + source). Without the
  // salt, two different cards that both embed `font-family: Inter` would both map to
  // `mc-font-Inter` and silently clobber each other in the global cascade. The salt
  // is stable per card, so multiple faces of the same family within one card
  // (regular/bold/italic) still share a name and remain a single family.
  const fontSalt = hashCss(`${scopeSelector}\\0${css}`);
  const fontFamilyMap = new Map<string, string>();
  sanitized = sanitized.replace(/@font-face\s*\{([^}]*)\}/gi, (_block, body: string) => {
    const newBody = body.replace(
      /(font-family\s*:\s*)("[^"]*"|'[^']*'|[^;]+)/i,
      (_decl, prefix: string, rawValue: string) => {
        const name = rawValue
          .trim()
          .replace(/^['"]|['"]$/g, "")
          .trim();
        if (!name) return `${prefix}${rawValue}`;
        const namespaced = `mc-font-${name.replace(/[^a-zA-Z0-9_-]+/g, "-")}-${fontSalt}`;
        fontFamilyMap.set(name.toLowerCase(), namespaced);
        return `${prefix}"${namespaced}"`;
      },
    );
    return `@font-face {${newBody}}`;
  });
  if (fontFamilyMap.size > 0) {
    sanitized = sanitized.replace(/\bfont(?:-family)?\s*:\s*([^;{}]+)/gi, (decl: string, value: string) => {
      let next = value;
      for (const [orig, namespaced] of fontFamilyMap) {
        const escaped = orig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // quoted family occurrences: 'Inter' / "Inter"
        next = next.replace(new RegExp(`(['"])${escaped}\\1`, "gi"), `"${namespaced}"`);
        // unquoted single-token occurrences in a family list
        next = next.replace(new RegExp(`(^|,|\\s)${escaped}(?=\\s*(?:,|$))`, "gi"), `$1"${namespaced}"`);
      }
      return decl.slice(0, decl.length - value.length) + next;
    });
  }

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

    // Skip @font-face — contains declarations, not nested rules
    if (/^@font-face$/i.test(selector)) {
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
      // :root, html, body -> scopeSelector (targets the scope element itself)
      if (/^(:root|html|body)$/i.test(s)) return scopeSelector;
      // Starts with :root, html, body (descendant or chained) -> replace prefix with scope
      if (/^(:root|html|body)[\s:.[]/i.test(s)) return s.replace(/^(:root|html|body)/i, scopeSelector);
      // [data-card-css] alone -> scopeSelector (self-reference in exclusive mode)
      if (/^\[data-card-css\]$/i.test(s)) return scopeSelector;
      // [data-card-css] with descendant -> replace with scope
      if (/^\[data-card-css\]\s/i.test(s)) return s.replace(/^\[data-card-css\]/i, scopeSelector);
      // [data-card-css] with chained pseudo-classes or attribute selectors
      // e.g. [data-card-css]:not([data-grouped]), [data-card-css][data-grouped]
      // In exclusive mode the scope IS the element, so chain on it.
      // In chat mode the scope is a container, so keep as descendant (default).
      if (/^\[data-card-css\][:[.]/.test(s) && scopeSelector.includes("[data-card-css=")) {
        return s.replace(/^\[data-card-css\]/i, scopeSelector);
      }
      // Otherwise prefix
      return `${scopeSelector} ${s}`;
    });

    result.push(`${scopedSelectors.join(", ")} {${body}}`);
  }

  return result.join("\n");
}
