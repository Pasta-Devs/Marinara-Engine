// ──────────────────────────────────────────────
// Live CSS checks for the theme editor (theming round 2, batch 3)
//
// The browser drops CSS it can't read without a word, so a missing brace or a typo in a property
// just makes a theme "not work". This walks the CSS once and reports, with line numbers:
//   • structure: unclosed or extra braces, comments and strings;
//   • a selector the browser can't read;
//   • a property it doesn't know, or a value it won't accept (usually a missing ";");
//   • a core colour token set to a bare HSL triplet such as `270 25% 8%`.
// It only reads the text. Nothing is applied.
// ──────────────────────────────────────────────

export type CssLintCode =
  | "unclosed-block"
  | "extra-brace"
  | "unclosed-comment"
  | "unclosed-string"
  | "bad-selector"
  | "missing-colon"
  | "unknown-property"
  | "bad-value"
  | "missing-semicolon"
  | "hsl-triplet";

export interface CssLintIssue {
  line: number;
  code: CssLintCode;
  /** The selector, property or token concerned. */
  subject?: string;
}

export interface CssLintEnv {
  supports: (property: string, value: string) => boolean;
  selectorValid: (selector: string) => boolean;
}

/** At-rules whose block holds rules, not declarations. */
const RULE_CONTAINERS = new Set(["media", "supports", "layer", "container", "document", "scope", "starting-style"]);

/** Core tokens that must be full CSS colours (a bare `270 25% 8%` triplet paints nothing). */
const COLOR_TOKENS = new Set([
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
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
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-border",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
]);

const HSL_TRIPLET = /^-?\d+(\.\d+)?(deg)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/;

function browserEnv(): CssLintEnv | null {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function" || typeof document === "undefined") return null;
  const fragment = document.createDocumentFragment();
  return {
    supports: (property, value) => CSS.supports(property, value),
    selectorValid: (selector) => {
      try {
        fragment.querySelector(selector);
        return true;
      } catch {
        return false;
      }
    },
  };
}

type Context = { kind: "root" | "rules" | "declarations" | "keyframes"; line: number };

/** Splits a selector list on its top-level commas. */
function splitSelectors(prelude: string) {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of prelude) {
    if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function lintThemeCss(css: string, env: CssLintEnv | null = browserEnv()): CssLintIssue[] {
  const issues: CssLintIssue[] = [];
  const stack: Context[] = [{ kind: "root", line: 1 }];
  let buffer = "";
  let bufferLine = 0;
  let line = 1;
  let parens = 0;

  const top = () => stack[stack.length - 1]!;
  const push = (char: string) => {
    if (!bufferLine && char.trim()) bufferLine = line;
    buffer += char;
  };
  const reset = () => {
    buffer = "";
    bufferLine = 0;
    parens = 0;
  };

  const checkDeclaration = () => {
    const text = buffer.trim();
    if (!text) return;
    const at = bufferLine || line;
    const colon = text.indexOf(":");
    if (colon < 1) {
      issues.push({ line: at, code: "missing-colon", subject: text.slice(0, 40) });
      return;
    }
    const property = text.slice(0, colon).trim().toLowerCase();
    const value = text
      .slice(colon + 1)
      .replace(/!\s*important\s*$/i, "")
      .trim();
    if (property.startsWith("--")) {
      if (COLOR_TOKENS.has(property) && HSL_TRIPLET.test(value)) {
        issues.push({ line: at, code: "hsl-triplet", subject: property });
      }
      return;
    }
    if (!env || property.startsWith("-") || !/^[a-z-]+$/.test(property)) return;
    if (!env.supports(property, "inherit")) {
      issues.push({ line: at, code: "unknown-property", subject: property });
      return;
    }
    if (!value || /\b(var|env|attr)\(/i.test(value)) return;
    if (!env.supports(property, value)) {
      // `color: red` followed by a line with no ";" reads as one long value.
      const runOn = /\n\s*-{0,2}[a-z-]+\s*:/i.test(value);
      issues.push({ line: at, code: runOn ? "missing-semicolon" : "bad-value", subject: property });
    }
  };

  const openBlock = () => {
    const prelude = buffer.trim();
    const at = bufferLine || line;
    const parent = top();
    let kind: Context["kind"] = "declarations";
    if (prelude.startsWith("@")) {
      const name = /^@([a-z-]+)/i.exec(prelude)?.[1]?.toLowerCase() ?? "";
      if (RULE_CONTAINERS.has(name)) kind = "rules";
      else if (name.endsWith("keyframes")) kind = "keyframes";
    } else if (env && parent.kind !== "keyframes" && prelude) {
      for (const selector of splitSelectors(prelude)) {
        // Nested rules (`&:hover`) and relative ones (`> p`) only make sense inside a parent.
        if (parent.kind === "declarations" && /^[&>+~]/.test(selector)) continue;
        if (selector.includes("&")) continue;
        if (!env.selectorValid(selector)) {
          issues.push({ line: at, code: "bad-selector", subject: selector.slice(0, 60) });
          break;
        }
      }
    }
    stack.push({ kind, line: at });
    reset();
  };

  for (let i = 0; i < css.length; i++) {
    const char = css[i]!;
    const next = css[i + 1];

    if (char === "/" && next === "*") {
      const end = css.indexOf("*/", i + 2);
      const startLine = line;
      const body = end === -1 ? css.slice(i) : css.slice(i, end + 2);
      line += body.split("\n").length - 1;
      if (end === -1) {
        issues.push({ line: startLine, code: "unclosed-comment" });
        break;
      }
      i = end + 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const startLine = line;
      let j = i + 1;
      let closed = false;
      for (; j < css.length; j++) {
        const c = css[j];
        if (c === "\\") {
          j++;
          continue;
        }
        if (c === "\n") break;
        if (c === char) {
          closed = true;
          break;
        }
      }
      if (!closed) {
        issues.push({ line: startLine, code: "unclosed-string" });
        // The browser drops the declaration the stray quote is in and carries on at the next line,
        // so one quote doesn't hide everything after it.
        reset();
        i = j - 1;
        continue;
      }
      push(css.slice(i, j + 1));
      i = j;
      continue;
    }

    if (char === "\n") {
      line++;
      buffer += char;
      continue;
    }

    if (char === "(") parens++;
    else if (char === ")") parens = Math.max(0, parens - 1);

    if (parens > 0) {
      push(char);
      continue;
    }

    if (char === "{") {
      openBlock();
      continue;
    }

    if (char === "}") {
      if (top().kind === "declarations") checkDeclaration();
      reset();
      if (stack.length === 1) issues.push({ line, code: "extra-brace" });
      else stack.pop();
      continue;
    }

    if (char === ";") {
      if (top().kind === "declarations") checkDeclaration();
      reset();
      continue;
    }

    push(char);
  }

  if (top().kind === "declarations" && buffer.trim() && stack.length > 1) checkDeclaration();
  for (const open of stack.slice(1)) issues.push({ line: open.line, code: "unclosed-block" });

  return issues.sort((a, b) => a.line - b.line);
}
