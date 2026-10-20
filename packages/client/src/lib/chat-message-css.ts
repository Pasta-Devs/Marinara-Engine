// Shared-message HTML may include author-supplied inline styles and <style>
// blocks. Keep that CSS useful, but prevent it from escaping the message box.

import postcss, { CssSyntaxError, type AtRule, type Node, type Root, type Rule } from "postcss";
import { remoteImageHref } from "./remote-images";

const STRING_OR_ESCAPE = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\\(?:[0-9a-fA-F]{1,6}\s?|[\s\S])/g;
const SAFE_POSITION_VALUES = new Set([
  "absolute",
  "inherit",
  "initial",
  "relative",
  "revert",
  "revert-layer",
  "static",
  "unset",
]);
const GLOBAL_AT_RULES = new Set([
  "charset",
  "color-profile",
  "counter-style",
  "custom-media",
  "custom-selector",
  "font-feature-values",
  "font-palette-values",
  "function",
  "page",
  "position-try",
  "view-transition",
]);

/** Remove CSS comments without treating comment-like text inside strings as syntax. */
function stripCssComments(css: string): string {
  let result = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index]!;
    const next = css[index + 1];
    if (quote) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      result += char;
      continue;
    }
    if (char !== "/" || next !== "*") {
      result += char;
      continue;
    }

    // A comment separates CSS tokens, so preserve one space while dropping its
    // contents. This keeps the browser and sanitizer token boundaries aligned.
    result += " ";
    index += 2;
    while (index < css.length && !(css[index] === "*" && css[index + 1] === "/")) index += 1;
    if (index < css.length) index += 1;
  }

  return result;
}

/** Decode CSS escape sequences (`\XX` hex, `\c` literal) to browser-parsed characters. */
function decodeCssEscapes(input: string): string {
  return input.replace(
    /\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g,
    (_match, hex: string | undefined, char: string | undefined) => {
      if (hex) {
        const codePoint = parseInt(hex, 16);
        return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "";
      }
      return char ?? "";
    },
  );
}

function canonicalizeKeywordEscapes(css: string): string {
  return css.replace(STRING_OR_ESCAPE, (match: string, stringLiteral: string | undefined) => {
    if (stringLiteral !== undefined) return stringLiteral;
    const decoded = decodeCssEscapes(match);
    return /^[-A-Za-z@]$/.test(decoded) ? decoded : match;
  });
}

function isCssNameCharacter(char: string | undefined): boolean {
  return char !== undefined && /[-_0-9A-Za-z\\\u0080-\uFFFF]/u.test(char);
}

function findAtRuleEnd(css: string, startIndex: number): number {
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let parenthesisDepth = 0;
  let blockDepth = 0;

  for (let index = startIndex; index < css.length; index += 1) {
    const char = css[index]!;
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") parenthesisDepth += 1;
    else if (char === ")" && parenthesisDepth > 0) parenthesisDepth -= 1;
    else if (parenthesisDepth === 0 && char === "{") blockDepth += 1;
    else if (parenthesisDepth === 0 && char === "}" && blockDepth > 0) {
      blockDepth -= 1;
      if (blockDepth === 0) return index + 1;
    } else if (parenthesisDepth === 0 && blockDepth === 0 && char === ";") {
      return index + 1;
    }
  }

  return css.length;
}

/** Remove document-global at-rules while retaining conditional and namespaced message-local rules. */
function stripGlobalAtRules(css: string): string {
  let result = "";
  let cursor = 0;
  let index = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;

  while (index < css.length) {
    const char = css[index]!;
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      index += 1;
      continue;
    }
    if (char !== "@") {
      index += 1;
      continue;
    }

    const nameMatch = /^@([-A-Za-z]+)/u.exec(css.slice(index));
    const name = nameMatch?.[1]?.toLowerCase();
    if (!name || !GLOBAL_AT_RULES.has(name)) {
      index += 1;
      continue;
    }

    result += `${css.slice(cursor, index)} `;
    index = findAtRuleEnd(css, index + name.length + 1);
    cursor = index;
  }

  return result + css.slice(cursor);
}

function hashCssScope(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function replaceCssIdentifier(input: string, identifier: string, replacement: string, flags = "g"): string {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return input.replace(new RegExp(`(^|[^-_A-Za-z0-9])${escaped}(?=$|[^-_A-Za-z0-9])`, flags), `$1${replacement}`);
}

/** Namespace the global names that CSS requires for otherwise message-local animations and fonts. */
function namespaceMessageCssGlobals(css: string, scopeSelector: string): string {
  const salt = hashCssScope(`${scopeSelector}\\0${css}`);
  const animationNames = new Map<string, string>();
  const fontNames = new Map<string, string>();
  const propertyNames = new Map<string, string>();
  try {
    const root = postcss.parse(css, { from: undefined });
    root.walkAtRules((atRule) => {
      const ruleName = atRule.name.toLowerCase();
      if (ruleName === "keyframes" || ruleName === "-webkit-keyframes") {
        const name = atRule.params.trim();
        if (!/^[-_A-Za-z][-_A-Za-z0-9]*$/u.test(name)) {
          atRule.remove();
          return;
        }
        const replacement = `mari-msg-${salt}-${name}`;
        animationNames.set(name, replacement);
        atRule.params = replacement;
        return;
      }
      if (ruleName === "property") {
        const name = atRule.params.trim();
        if (!/^--[-_A-Za-z0-9]+$/u.test(name)) {
          atRule.remove();
          return;
        }
        const replacement = `--mari-msg-${salt}-${name.slice(2)}`;
        propertyNames.set(name, replacement);
        atRule.params = replacement;
        return;
      }
      if (ruleName === "layer") {
        const name = atRule.params.trim();
        if (!atRule.nodes) {
          atRule.remove();
          return;
        }
        if (!name) return; // Anonymous layers do not create a document-global name.
        if (!/^[-_A-Za-z][-_A-Za-z0-9]*(?:\.[-_A-Za-z][-_A-Za-z0-9]*)*$/u.test(name)) {
          atRule.remove();
          return;
        }
        atRule.params = `mari-msg-layer-${salt}-${hashCssScope(name)}`;
        return;
      }
      if (ruleName !== "font-face") return;
      const families = atRule.nodes?.filter(
        (node): node is Extract<typeof node, { type: "decl" }> =>
          node.type === "decl" && node.prop.toLowerCase() === "font-family",
      );
      if (!families?.length) {
        atRule.remove();
        return;
      }
      for (const declaration of families) {
        const quoted = /^(?:"([^"]+)"|'([^']+)')$/u.exec(declaration.value.trim());
        const name = (quoted?.[1] ?? quoted?.[2] ?? declaration.value.trim()).trim();
        if (!name) {
          atRule.remove();
          return;
        }
        const replacement = `mari-msg-font-${salt}-${hashCssScope(name.toLowerCase())}`;
        fontNames.set(name.toLowerCase(), replacement);
        declaration.value = `"${replacement}"`;
      }
    });
    root.walkDecls((declaration) => {
      let value = declaration.value;
      const property = declaration.prop.toLowerCase();
      if (property === "animation" || property === "animation-name" || property.startsWith("--")) {
        for (const [name, replacement] of animationNames) value = replaceCssIdentifier(value, name, replacement);
      }
      if (property === "font" || property === "font-family" || property.startsWith("--")) {
        const orderedFontNames = [...fontNames].sort(([left], [right]) => right.length - left.length);
        for (const [name, replacement] of orderedFontNames) {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          value = value.replace(new RegExp(`(['"])${escaped}\\1`, "gi"), `"${replacement}"`);
          value = replaceCssIdentifier(value, name, `"${replacement}"`, "gi");
        }
      }
      for (const [name, replacement] of propertyNames) value = replaceCssIdentifier(value, name, replacement);
      declaration.value = value;
      for (const [name, replacement] of propertyNames) {
        declaration.prop = replaceCssIdentifier(declaration.prop, name, replacement);
      }
    });
    return root.toString();
  } catch {
    return "";
  }
}

const CONDITIONAL_AT_RULES = new Set(["container", "layer", "media", "scope", "starting-style", "supports"]);
const PRESERVED_GLOBAL_AT_RULES: ReadonlySet<string> = new Set([
  "font-face",
  "keyframes",
  "property",
  "-webkit-keyframes",
]);

function isInsideGlobalRule(node: Rule, globalAtRules: ReadonlySet<string>): boolean {
  for (let parent: Node | undefined = node.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule" && globalAtRules.has((parent as AtRule).name.toLowerCase())) return true;
  }
  return false;
}

function isNestedRule(node: Rule): boolean {
  for (let parent: Node | undefined = node.parent; parent; parent = parent.parent) {
    if (parent.type === "rule") return true;
  }
  return false;
}

/**
 * True when the scoped selector's first compound (the scope element itself) is followed by a
 * sibling combinator, so it would match elements next to the scope instead of inside it.
 */
function selectsScopeSibling(selector: string, scopeSelector: string): boolean {
  if (!selector.startsWith(scopeSelector)) return false;
  let depth = 0;
  let quote: string | null = null;
  let index = scopeSelector.length;
  for (; index < selector.length; index += 1) {
    const char = selector[index]!;
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "\\") index += 1;
    else if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[") depth += 1;
    else if ((char === ")" || char === "]") && depth > 0) depth -= 1;
    else if (depth === 0 && /[\s>~+|]/u.test(char)) break;
  }
  return /^\s*(?:[~+]|\|\|)/u.test(selector.slice(index));
}

function scopeMessageSelector(selector: string, scopeSelector: string): string {
  if (selector === ":root" || selector === "html" || selector === "body") return scopeSelector;
  return `${scopeSelector} ${selector}`;
}

/** Browsers close blocks left open at the end of a stylesheet; mirror that instead of dropping it all. */
function parseCss(css: string, closeUnclosedBlocks: boolean): Root {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return postcss.parse(css, { from: undefined });
    } catch (error) {
      if (!closeUnclosedBlocks || attempt >= 32) throw error;
      if (!(error instanceof CssSyntaxError) || error.reason !== "Unclosed block") throw error;
      css += "}";
    }
  }
}

export type ScopeCssRulesOptions = {
  /** Rewrites one trimmed selector to sit inside the scope. Defaults to message scoping. */
  mapSelector?: (selector: string, scopeSelector: string) => string;
  /** At-rules kept outside the scope because they hold no selectors (fonts, animations). */
  globalAtRules?: ReadonlySet<string>;
  closeUnclosedBlocks?: boolean;
};

/**
 * Parse complete rules so browser error recovery can never expose an unscoped selector.
 * Selectors that would reach a sibling of the scope element are dropped.
 */
export function scopeCssRules(css: string, scopeSelector: string, options: ScopeCssRulesOptions = {}): string {
  const mapSelector = options.mapSelector ?? scopeMessageSelector;
  const globalAtRules = options.globalAtRules ?? PRESERVED_GLOBAL_AT_RULES;
  try {
    const root = parseCss(css, options.closeUnclosedBlocks === true);
    root.walkAtRules((atRule) => {
      const name = atRule.name.toLowerCase();
      if (!atRule.nodes && CONDITIONAL_AT_RULES.has(name)) {
        atRule.remove();
        return;
      }
      if (!globalAtRules.has(name) && !CONDITIONAL_AT_RULES.has(name)) atRule.remove();
    });
    root.walkDecls((declaration) => {
      if (declaration.parent?.type === "root") declaration.remove();
    });
    root.walkRules((rule) => {
      if (isInsideGlobalRule(rule, globalAtRules)) return;
      if (isNestedRule(rule)) {
        // Native nesting can select outside its parent through `&`, root
        // selectors, or relative combinators. Authors can express the same
        // styling as an ordinary selector, which this scoper contains safely.
        rule.remove();
        return;
      }
      const selectors = rule.selectors
        .map((selector) => mapSelector(selector.trim(), scopeSelector))
        .filter((selector) => !selectsScopeSibling(selector, scopeSelector));
      if (selectors.length === 0) rule.remove();
      else rule.selectors = selectors;
    });
    return root.toString();
  } catch {
    return ""; // Malformed author CSS is safer to omit than to let the browser recover globally.
  }
}

/** Strip statement at-rules through their terminating semicolon, respecting strings and functions. */
function stripForbiddenStatementAtRules(css: string): string {
  let result = "";
  let cursor = 0;
  let index = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let parenthesisDepth = 0;

  while (index < css.length) {
    const char = css[index]!;
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      index += 1;
      continue;
    }
    if (char === "(") {
      parenthesisDepth += 1;
      index += 1;
      continue;
    }
    if (char === ")" && parenthesisDepth > 0) {
      parenthesisDepth -= 1;
      index += 1;
      continue;
    }

    const lower = parenthesisDepth === 0 ? css.slice(index, index + 10).toLowerCase() : "";
    const keyword = lower.startsWith("@import") ? "@import" : lower.startsWith("@namespace") ? "@namespace" : null;
    if (!keyword || isCssNameCharacter(css[index + keyword.length])) {
      index += 1;
      continue;
    }

    result += `${css.slice(cursor, index)} `;
    index += keyword.length;
    let depth = 0;
    let statementQuote: '"' | "'" | null = null;
    let statementEscaped = false;
    while (index < css.length) {
      const statementChar = css[index]!;
      if (statementQuote) {
        if (statementEscaped) statementEscaped = false;
        else if (statementChar === "\\") statementEscaped = true;
        else if (statementChar === statementQuote) statementQuote = null;
      } else if (statementChar === '"' || statementChar === "'") {
        statementQuote = statementChar;
      } else if (statementChar === "(") {
        depth += 1;
      } else if (statementChar === ")" && depth > 0) {
        depth -= 1;
      } else if (statementChar === ";" && depth === 0) {
        index += 1;
        break;
      }
      index += 1;
    }
    cursor = index;
  }

  return result + css.slice(cursor);
}

function sanitizePositionDeclarations(css: string): string {
  return css.replace(
    /(^|[;{])(\s*)position\s*:\s*([^;}]*)/gim,
    (_match, boundary: string, spacing: string, rawValue: string) => {
      const value = rawValue
        .replace(/!important/gi, "")
        .trim()
        .toLowerCase();
      const safeValue =
        value === "fixed" || value === "sticky" ? "absolute" : SAFE_POSITION_VALUES.has(value) ? value : "static";
      return `${boundary}${spacing}position:${safeValue}`;
    },
  );
}

/**
 * CSS Images also accepts a bare quoted URL inside image-set(). Keep an image-set only when every
 * source is an embedded data:image; anything else becomes an inert url().
 */
export function neutralizeUnsafeImageSets(css: string): string {
  const startPattern = /(?:-webkit-)?image-set\s*\(/giu;
  let result = "";
  let cursor = 0;
  for (let match = startPattern.exec(css); match; match = startPattern.exec(css)) {
    let quote: '"' | "'" | null = null;
    let escaped = false;
    let depth = 1;
    let index = startPattern.lastIndex;
    for (; index < css.length && depth > 0; index++) {
      const ch = css[index]!;
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    if (depth !== 0) break;
    const expression = css.slice(match.index, index);
    const sources = expression.match(/(?:url\s*\(\s*)?["']?data:image\/[^")'\s]+["']?\s*\)?/giu) ?? [];
    const remainder = expression
      .replace(/^(?:-webkit-)?image-set\s*\(/iu, "")
      .replace(/\)$/u, "")
      .replace(/(?:url\s*\(\s*)?["']?data:image\/[^")'\s]+["']?\s*\)?/giu, "")
      .replace(/\btype\s*\([^)]*\)/giu, "")
      .replace(/(?:\d+(?:\.\d+)?x|\d+dpi|\d+dpcm|\d+dppx)/giu, "")
      .replace(/[\s,]/gu, "");
    result += css.slice(cursor, match.index);
    result += sources.length > 0 && remainder.length === 0 ? expression : "url(about:invalid)";
    cursor = index;
    startPattern.lastIndex = index;
  }
  return result + css.slice(cursor);
}

/** Keep a url() only for embedded images and the app's own files (absolute, same origin). */
function isLocalCssUrl(body: string): boolean {
  let value = body.trim();
  const quote = value[0];
  if (quote === '"' || quote === "'") value = value.slice(1, value.endsWith(quote) ? -1 : undefined).trim();
  if (/^data:image\//iu.test(value)) return true;
  // Escapes are decoded by the browser, so a URL that needs them is not checked here.
  return /^https?:\/\//iu.test(value) && !value.includes("\\") && remoteImageHref(value) === null;
}

/** Drop every CSS source that would make the browser contact another site. */
function dropRemoteCssUrls(css: string): string {
  return neutralizeUnsafeImageSets(css.replace(/(?<![-\w])src\s*\(/giu, "url(")).replace(
    /url\s*\(([^)]*)\)/giu,
    (match: string, body: string) => (isLocalCssUrl(body) ? match : "none"),
  );
}

export type ChatMessageCssOptions = {
  /** False drops url() and image-set() sources on other sites. Defaults to true. */
  remoteUrls?: boolean;
};

export function sanitizeChatMessageCss(css: string, options: ChatMessageCssOptions = {}): string {
  let sanitized = canonicalizeKeywordEscapes(stripCssComments(css));
  sanitized = stripGlobalAtRules(stripForbiddenStatementAtRules(sanitized))
    .replace(/expression\s*\([^)]*\)/gi, " ")
    .replace(/javascript\s*:/gi, " ")
    .replace(/vbscript\s*:/gi, " ")
    .replace(/behavior\s*:/gi, "x-behavior:")
    .replace(/-moz-binding\s*:/gi, "x-moz-binding:")
    .replace(/url\s*\(\s*(?!['"]?(?:data:image\/|https?:\/\/))(['"]?)[^)]+\)/gi, "none")
    .replace(/!\s*important/gi, " ")
    .replace(/(?<![-\w])content\s*:[^;}]*/gi, " ")
    .replace(/</g, "\\3c ");
  if (options.remoteUrls === false) sanitized = dropRemoteCssUrls(sanitized);
  return sanitizePositionDeclarations(sanitized).trim();
}

export function scopeChatMessageCss(css: string, scopeSelector: string, options: ChatMessageCssOptions = {}): string {
  const sanitized = namespaceMessageCssGlobals(sanitizeChatMessageCss(css, options), scopeSelector);
  if (!sanitized) return "";
  return scopeCssRules(sanitized, scopeSelector).trim();
}
