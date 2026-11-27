// ──────────────────────────────────────────────
// UI check: which CSS rules a change touched, and what each one needs on a page to apply
// ──────────────────────────────────────────────
// Used by affected.mjs. Both versions of a stylesheet are parsed (postcss, nesting and @media included) and
// compared rule by rule, so a one-line change in the 19,000-line overhaul.css is one rule, not "all of the CSS".
// A rule can only style a page whose DOM has every class, id, tag and attribute its selector names (outside
// :not()), so each changed rule becomes a list of "tokens" that the screen map (screen-map.mjs) looks up.
import { createRequire } from "node:module";
import { join } from "node:path";

/** postcss comes with the client's build tools; nothing new to install. */
export function loadPostcss(repoRoot) {
  const require = createRequire(join(repoRoot, "packages/client/package.json"));
  return require("postcss");
}

// ── Tokens: the same spelling the page-side collector (screen-map.mjs collectDomTokens) writes ──

/** Attribute values kept as their own token (others count as "has the attribute"). Must match the collector. */
export function keepsAttributeValue(name, value) {
  return (
    (name.startsWith("data-") ||
      name.startsWith("aria-") ||
      ["role", "type", "dir", "lang", "name", "open", "disabled", "hidden", "inert", "contenteditable"].includes(
        name,
      )) &&
    value.length <= 40 &&
    !/[0-9a-f]{8}-[0-9a-f]{4}|^\d+$|^[0-9a-z]{20,}$/i.test(value)
  );
}

/** An id the collector keeps (React's generated ids and the like are counted only as "has an id"). */
export function keepsId(value) {
  return !/:|\d{3}/.test(value) && value.length <= 60;
}

function unescapeIdent(text) {
  return text.replace(/\\([0-9a-f]{1,6}\s?|.)/gi, (_, ch) =>
    /^[0-9a-f]{1,6}\s?$/i.test(ch) && ch.trim().length > 1 ? String.fromCodePoint(parseInt(ch, 16)) : ch.trim() || ch,
  );
}

/** Splits on commas that are not inside brackets or parentheses. */
export function splitTopLevel(text, separator = ",") {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Reads the inside of a (...) starting at text[open] === "(". Returns [inside, indexAfter]. */
function readParens(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return [text.slice(open + 1, i), i + 1];
  }
  return [text.slice(open + 1), text.length];
}

const IDENT = /^-?(?:[_a-zA-Z -￿]|\\.)(?:[-\w -￿]|\\.)*/;

/**
 * The tokens an element tree must have for one selector (no top-level commas) to match anything. Sound, not
 * exact: :not() adds nothing, :is()/:where() add only what every alternative needs.
 */
export function selectorTokens(selector) {
  const tokens = new Set();
  let i = 0;
  const s = selector;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ".") {
      const m = s.slice(i + 1).match(IDENT);
      if (m) tokens.add(`.${unescapeIdent(m[0])}`);
      i += 1 + (m ? m[0].length : 0);
    } else if (ch === "#") {
      const m = s.slice(i + 1).match(IDENT);
      if (m) {
        const id = unescapeIdent(m[0]);
        tokens.add(keepsId(id) ? `#${id}` : "[id]");
      }
      i += 1 + (m ? m[0].length : 0);
    } else if (ch === "[") {
      const end = s.indexOf("]", i);
      const inside = s.slice(i + 1, end < 0 ? s.length : end).trim();
      i = end < 0 ? s.length : end + 1;
      const m = inside.match(/^([-\w:|*\\]+?)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))\s*([is])?)?$/);
      if (!m) continue;
      const name = unescapeIdent(m[1].replace(/^.*\|/, "")).toLowerCase();
      if (name === "*") continue;
      const value = m[3] ?? m[4] ?? m[5];
      if (m[2] === "=" && value !== undefined && !m[6] && name !== "class" && name !== "style") {
        if (name === "id") tokens.add(keepsId(value) ? `#${value}` : "[id]");
        else tokens.add(keepsAttributeValue(name, value) ? `[${name}=${value}]` : `[${name}]`);
      } else if (m[2] === "~=" && name === "class" && value) tokens.add(`.${value}`);
      else if (name === "id") tokens.add("[id]");
      else tokens.add(`[${name}]`);
    } else if (ch === ":") {
      const element = s[i + 1] === ":";
      i += element ? 2 : 1;
      const m = s.slice(i).match(IDENT);
      const name = (m?.[0] ?? "").toLowerCase();
      i += name.length;
      if (s[i] === "(") {
        const [inside, after] = readParens(s, i);
        i = after;
        if (element) continue;
        if (["is", "where", "matches", "-webkit-any", "-moz-any", "has"].includes(name)) {
          const alternatives = splitTopLevel(inside).map((alt) => selectorTokens(alt.replace(/^[>+~]\s*/, "")));
          const common = alternatives.length ? [...alternatives[0]] : [];
          for (const token of common) if (alternatives.every((set) => set.has(token))) tokens.add(token);
        }
        // :not(), :nth-child(… of …), :host(), :lang(), … add nothing.
      } else if (name === "root" && !element) tokens.add("html");
    } else if (/[\s>+~*&]/.test(ch)) {
      i++;
    } else if (ch === "|") {
      i++;
    } else {
      const m = s.slice(i).match(IDENT);
      if (m) {
        // A type selector (ns|tag handled by skipping the "ns|").
        if (s[i + m[0].length] !== "|") tokens.add(unescapeIdent(m[0]).toLowerCase());
        i += m[0].length;
      } else i++;
    }
  }
  return tokens;
}

// ── Media queries, evaluated against the check's window sizes ──

/** Does one media query list possibly match this size? Anything it can't read counts as a match. */
export function mediaMatches(query, size) {
  if (!query || !query.trim()) return true;
  return splitTopLevel(query).some((one) => singleQueryMatches(one, size));
}

function lengthPx(text) {
  const m = String(text)
    .trim()
    .match(/^(-?[\d.]+)(px|em|rem)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === "em" || m[2] === "rem" ? n * 16 : n;
}

function featureMatches(feature, size) {
  const f = feature.trim().replace(/\s+/g, " ");
  const { width, height, touch } = size;
  const dims = { width, height, "device-width": width, "device-height": height };
  // Range syntax: (width <= 767px), (600px < width <= 900px), (767px >= width)
  const range = f.match(/^([\w.-]+)\s*(<=|>=|<|>|=)\s*([\w.-]+)(?:\s*(<=|>=|<|>|=)\s*([\w.-]+))?$/);
  if (range) {
    const compare = (a, op, b) =>
      op === "<=" ? a <= b : op === ">=" ? a >= b : op === "<" ? a < b : op === ">" ? a > b : a === b;
    const value = (t) => (t in dims ? dims[t] : lengthPx(t));
    const [, a, op1, b, op2, c] = range;
    const va = value(a);
    const vb = value(b);
    if (va == null || vb == null) return null;
    if (!compare(va, op1, vb)) return false;
    if (op2) {
      const vc = value(c);
      return vc == null ? null : compare(vb, op2, vc);
    }
    return true;
  }
  const [rawName, rawValue] = f.split(":").map((p) => p?.trim());
  const name = (rawName ?? "").toLowerCase();
  const value = (rawValue ?? "").toLowerCase();
  const px = lengthPx(value);
  // null = can't tell for this size (counts as a match, and as a match for "not" too).
  const known = (ok) => (px == null ? null : ok);
  switch (name) {
    case "min-width":
      return known(width >= px);
    case "max-width":
      return known(width <= px);
    case "min-height":
      return known(height >= px);
    case "max-height":
      return known(height <= px);
    case "width":
      return known(width === px);
    case "height":
      return known(height === px);
    case "orientation":
      return value === (height >= width ? "portrait" : "landscape");
    // A mouse computer is certain; a touch size is checked both in Chromium (touch emulation) and in WebKit
    // (which keeps mouse-like media queries), so on touch sizes either answer is possible.
    case "hover":
    case "any-hover":
      return touch ? null : value !== "none";
    case "pointer":
    case "any-pointer":
      return touch ? null : value !== "coarse" && value !== "none";
    case "display-mode":
      return value === "browser" || !value ? true : null;
    default:
      return null;
  }
}

function singleQueryMatches(query, size) {
  let q = query.trim().toLowerCase();
  let negate = false;
  if (q.startsWith("not ")) {
    negate = true;
    q = q.slice(4);
  }
  q = q.replace(/^only\s+/, "");
  if (/^print\b/.test(q)) return negate;
  q = q.replace(/^(screen|all)\s*(and\s*)?/, "");
  if (/\bor\b/.test(q) && !q.includes("(")) return true;
  // (a) and (b) and not (c): every feature in parentheses must match.
  const features = [];
  for (let i = 0; i < q.length; i++) {
    if (q[i] === "(") {
      const [inside, after] = readParens(q, i);
      features.push(inside);
      i = after - 1;
    }
  }
  if (/\b(or|not)\s*\(/.test(q)) return true; // Level 4 boolean logic: don't guess.
  const answers = features.map((f) => (f.includes("(") ? null : featureMatches(f, size)));
  const result = answers.includes(false) ? false : answers.includes(null) ? null : true;
  // Unknown counts as a match either way: a size is only left out when the query surely skips it.
  if (result === null) return true;
  return negate ? !result : result;
}

// ── Rules: flatten a sheet and compare two versions ──

/**
 * Every style rule of a stylesheet with its full selector (nesting resolved), the media queries around it, and
 * its declarations as text. At-rules that aren't containers (@keyframes, @font-face, @property, @theme…) are
 * listed by name. Returns { rules: Map<key, {selector, media, body}>, atRules: Map<key, body> }.
 */
export function flattenSheet(postcss, css, from) {
  const root = postcss.parse(css, { from });
  const rules = new Map();
  const atRules = new Map();
  const add = (map, key, value) => {
    const existing = map.get(key);
    if (!existing) map.set(key, value);
    else if (typeof existing === "string") map.set(key, `${existing}\n---\n${value}`);
    else existing.body += `\n---\n${value.body}`;
  };
  const walk = (node, parents, media) => {
    for (const child of node.nodes ?? []) {
      if (child.type === "rule") {
        let selectors = splitTopLevel(child.selector);
        if (parents.length) {
          selectors = parents.flatMap((p) =>
            selectors.map((s) => (s.includes("&") ? s.replaceAll("&", `:is(${p})`) : `:is(${p}) ${s}`)),
          );
        }
        const body = (child.nodes ?? [])
          .filter((n) => n.type !== "rule" && !(n.type === "atrule" && n.nodes))
          .map((n) => n.toString().replace(/\s+/g, " ").trim())
          .join(";");
        if (body) {
          const key = `${media.join(" && ")} @@ ${selectors.join(", ")}`;
          add(rules, key, { selector: selectors.join(", "), selectors, media: [...media], body });
        }
        walk(child, selectors, media);
      } else if (child.type === "atrule") {
        const name = child.name.toLowerCase();
        if (name === "media") walk(child, parents, [...media, child.params]);
        else if (["supports", "layer", "container", "scope", "document", "starting-style"].includes(name))
          walk(child, parents, media);
        else if (child.nodes && parents.length) {
          // A nested at-rule with declarations (e.g. @apply inside a rule) belongs to the rule: handled above.
          walk(child, parents, media);
        } else {
          add(atRules, `@${name} ${child.params}`.trim(), child.toString().replace(/\s+/g, " ").trim());
        }
      } else if (child.type === "decl" && !parents.length) {
        add(atRules, `(top-level) ${child.prop}`, child.toString());
      }
    }
  };
  walk(root, [], []);
  return { rules, atRules };
}

/** The rules and at-rules that differ between two versions of a stylesheet. */
export function diffSheets(postcss, before, after, from) {
  const a = flattenSheet(postcss, before ?? "", from);
  const b = flattenSheet(postcss, after ?? "", from);
  const changedRules = [];
  for (const [key, rule] of b.rules) if (a.rules.get(key)?.body !== rule.body) changedRules.push(rule);
  for (const [key, rule] of a.rules) if (!b.rules.has(key)) changedRules.push(rule);
  const changedAtRules = [];
  for (const [key, body] of b.atRules) if (a.atRules.get(key) !== body) changedAtRules.push(key);
  for (const key of a.atRules.keys()) if (!b.atRules.has(key)) changedAtRules.push(key);
  return { changedRules, changedAtRules, flat: b };
}
