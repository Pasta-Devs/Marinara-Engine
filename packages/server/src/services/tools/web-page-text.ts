// ──────────────────────────────────────────────
// Readable text from a fetched web page
// ──────────────────────────────────────────────
// The web_fetch tool hands the model page text, not markup. This is the same shape as the
// web-search MCP's extractor, minus its browser fallback: chrome and scripts are removed, the
// first real content container wins over the surrounding page, block boundaries become line
// breaks, and whitespace is collapsed. It reads the pages a model actually asks for (wikis,
// encyclopedias, news articles) well; a page that renders its prose entirely in client-side
// JavaScript still needs a browser, which this tool does not carry.
//
// The page is untrusted input, so every step is bounded and iterative. Nothing recurses and
// nothing re-walks a subtree: one flat pass scores the content candidates, a second walk emits
// the text, and both stop at a fixed budget. Nesting is bounded before the tree is built, because
// tree construction is the one step whose cost grows with depth (see truncateDeepNesting).

import { parseDocument, Parser } from "htmlparser2";
import type { ChildNode, Document, Element, Text } from "domhandler";

/** The most page HTML extraction will look at. Fetching is bounded separately. */
const MAX_EXTRACTED_HTML_CHARS = 2 * 1024 * 1024;

/**
 * The deepest nesting a real page needs. Tree construction cost grows with depth, so a page that
 * nests further is cut at the chunk where it crosses this line.
 */
const MAX_NESTING_DEPTH = 256;

/** How much HTML the nesting scan feeds the tokenizer before checking the depth again. */
const NESTING_SCAN_CHUNK = 64 * 1024;

/** A ceiling on tree walking, so a pathological document cannot run the pass unbounded. */
const MAX_WALKED_NODES = 200_000;

/** A container shorter than this is page chrome, so the next candidate is tried. */
const MIN_CONTENT_CHARS = 200;

/** A page title is a label, not content; it is clipped before it reaches the model. */
const TITLE_MAX_CHARS = 300;

/** Default text budget when the caller does not pass one. */
const DEFAULT_MAX_CHARS = 12_000;

/** Removed everywhere: never prose, and some of it is executable. */
const ALWAYS_DROPPED_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "iframe",
  "object",
  "canvas",
  // The title is read separately, and a document-root fallback would otherwise put it in the body.
  "head",
]);

/** Removed only when a real content container was found, never from a bare <body> fallback. */
const CHROME_DROPPED_TAGS = new Set(["form", "select", "button", "nav", "footer"]);

const CHROME_DROPPED_ROLES = new Set(["navigation", "banner", "contentinfo"]);

/**
 * Whole class names that are chrome. Compound menu forms live here rather than as a bare `menu`
 * token, because `menu-guide` is a documentation page's content, not a menu.
 */
const CHROME_DROPPED_CLASSES = new Set([
  "mw-editsection",
  "catlinks",
  "printfooter",
  "noprint",
  "metadata",
  "menu-bar",
  "menu-item",
  "menu-list",
  "menu-toggle",
]);

/** Class tokens that are chrome on their own. Matched exactly, never as a substring. */
const CHROME_DROPPED_CLASS_TOKENS = new Set(["sidebar", "breadcrumb", "navigation", "toc", "nav"]);

/** Id tokens that are chrome on their own. `protocol-overview` must survive. */
const CHROME_DROPPED_ID_TOKENS = new Set(["navigation", "sidebar", "toc"]);

/** The share of a container's text chrome removal may take before the read is retried. */
const CHROME_RETRY_SHARE = 0.5;

/**
 * Elements that end a line. Table cells and captions are here so a wiki infobox reads as
 * "Release date" and "2016" on separate lines instead of running together.
 */
const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "caption",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "td",
  "th",
  "tr",
  "ul",
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  copy: "©",
  deg: "°",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  middot: "·",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  reg: "®",
  rsquo: "’",
  times: "×",
  trade: "™",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
      return String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export interface ExtractedWebPage {
  /** The page's <title>, decoded, collapsed and clipped; empty when the page has none. */
  title: string;
  /** Readable text with line breaks between blocks and no markup. */
  text: string;
  /** True when the page held more text than the budget allowed. */
  truncated: boolean;
}

export interface ExtractReadableTextOptions {
  /** The most text to emit. The walk stops here instead of building the whole page first. */
  maxChars?: number;
}

interface FlatEntry {
  node: ChildNode;
  parentIndex: number;
  ownTextLength: number;
  subtreeTextLength: number;
  /** The same total with script, style and head text left out, so a share measures prose. */
  readableTextLength: number;
}

function isElement(node: ChildNode): node is Element {
  return node.type === "tag" || node.type === "script" || node.type === "style";
}

function childrenOf(node: ChildNode): ChildNode[] {
  return "children" in node ? node.children : [];
}

function attribute(element: Element, name: string): string {
  return element.attribs[name] ?? "";
}

function classNames(element: Element): string[] {
  const value = attribute(element, "class").trim();
  return value ? value.split(/\s+/u) : [];
}

function hasClass(element: Element, name: string): boolean {
  return classNames(element).includes(name);
}

/**
 * Content containers, most specific first. A page that matches none of these falls back to the
 * document root, which still holds the body.
 */
const CONTENT_CANDIDATES: Array<(element: Element) => boolean> = [
  (element) => element.name === "article",
  (element) => element.name === "main",
  (element) => attribute(element, "role") === "main",
  (element) => hasClass(element, "mw-parser-output"),
  (element) => attribute(element, "id") === "mw-content-text",
  (element) => hasClass(element, "post-content"),
  (element) => hasClass(element, "entry-content"),
  (element) => hasClass(element, "article-content"),
  (element) => hasClass(element, "content"),
  (element) => element.name === "body",
];

/**
 * How much chrome to remove. `full` applies the class and id rules too; `minimal` drops only what
 * is never prose, for a page whose whole body sits inside a tag the rules would take.
 */
type ChromeMode = "full" | "minimal";

const CHROME_TOKEN_PATTERN = /[a-z0-9]+/gu;

/** True when any word in the value is in the set. Scans in place, without an array per class. */
function hasChromeToken(value: string, tokens: Set<string>): boolean {
  const lower = value.toLowerCase();
  CHROME_TOKEN_PATTERN.lastIndex = 0;
  for (let match = CHROME_TOKEN_PATTERN.exec(lower); match; match = CHROME_TOKEN_PATTERN.exec(lower)) {
    if (tokens.has(match[0])) return true;
  }
  return false;
}

/**
 * Why an element is dropped, or null to keep it. The two reasons are counted apart: a page trimmed
 * by a tag rule (a nav, a footer, a script) is ordinary, while one trimmed by a class or id rule may
 * have lost real prose.
 */
function dropReason(element: Element, mode: ChromeMode): "tag" | "rule" | null {
  if (ALWAYS_DROPPED_TAGS.has(element.name)) return "tag";
  if (mode === "minimal") return null;
  if (CHROME_DROPPED_TAGS.has(element.name)) return "tag";
  if (CHROME_DROPPED_ROLES.has(attribute(element, "role"))) return "tag";

  for (const name of classNames(element)) {
    const normalized = name.toLowerCase();
    if (CHROME_DROPPED_CLASSES.has(normalized)) return "rule";
    if (hasChromeToken(normalized, CHROME_DROPPED_CLASS_TOKENS)) return "rule";
  }

  if (hasChromeToken(attribute(element, "id"), CHROME_DROPPED_ID_TOKENS)) return "rule";
  return null;
}

/** How much text a dropped subtree held, so the caller can tell a trimmed page from a whole one. */
function textLengthOf(node: ChildNode): number {
  let total = 0;
  const stack: ChildNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    if (current.type === "text") {
      total += (current as Text).data.length;
      continue;
    }
    // Script, style and head text is not prose, so it never counts as text a rule removed.
    if (isElement(current) && ALWAYS_DROPPED_TAGS.has(current.name)) continue;
    for (const child of childrenOf(current)) stack.push(child);
  }
  return total;
}

/**
 * Cut a page that nests deeper than any real page before the tree is built. Measured on 1.9 MB of
 * nested <article>: 33 s with parse5, 4.8 s with htmlparser2, but 9 ms to tokenize until the depth
 * cap is crossed. Real pages nest a few dozen levels, so this only ever fires on a crafted page.
 */
function truncateDeepNesting(html: string): string {
  let depth = 0;
  let exceeded = false;
  const parser = new Parser({
    onopentag() {
      depth += 1;
      if (depth > MAX_NESTING_DEPTH) exceeded = true;
    },
    onclosetag() {
      if (depth > 0) depth -= 1;
    },
  });

  for (let offset = 0; offset < html.length; offset += NESTING_SCAN_CHUNK) {
    const end = Math.min(offset + NESTING_SCAN_CHUNK, html.length);
    parser.write(html.slice(offset, end));
    if (exceeded) return html.slice(0, end);
  }
  return html;
}

/**
 * Flatten the tree in document order and total each element's text length in one reverse pass.
 * Scoring containers from these totals is what keeps extraction linear: the old code called
 * `.text()` once per match per selector, rebuilding nested subtrees over and over.
 */
function flatten(root: Document): FlatEntry[] {
  const flat: FlatEntry[] = [];
  const stack: Array<{ node: ChildNode; parentIndex: number }> = [{ node: root, parentIndex: -1 }];

  while (stack.length > 0 && flat.length < MAX_WALKED_NODES) {
    const current = stack.pop();
    if (!current) break;
    const index = flat.length;
    flat.push({
      node: current.node,
      parentIndex: current.parentIndex,
      ownTextLength: current.node.type === "text" ? (current.node as Text).data.length : 0,
      subtreeTextLength: 0,
      readableTextLength: 0,
    });
    const children = childrenOf(current.node);
    for (let child = children.length - 1; child >= 0; child -= 1) {
      const next = children[child];
      if (next) stack.push({ node: next, parentIndex: index });
    }
  }

  for (let index = flat.length - 1; index >= 0; index -= 1) {
    const entry = flat[index];
    if (!entry) continue;
    entry.subtreeTextLength += entry.ownTextLength;
    entry.readableTextLength += entry.ownTextLength;
    // A script, style or head subtree is never prose, so it leaves the readable total entirely.
    if (isElement(entry.node) && ALWAYS_DROPPED_TAGS.has(entry.node.name)) entry.readableTextLength = 0;
    if (entry.parentIndex < 0) continue;
    const parent = flat[entry.parentIndex];
    if (parent) {
      parent.subtreeTextLength += entry.subtreeTextLength;
      parent.readableTextLength += entry.readableTextLength;
    }
  }

  return flat;
}

function selectContainer(flat: FlatEntry[]): number {
  const bestIndex = new Array<number>(CONTENT_CANDIDATES.length).fill(-1);
  const bestLength = new Array<number>(CONTENT_CANDIDATES.length).fill(0);

  for (let index = 0; index < flat.length; index += 1) {
    const entry = flat[index];
    if (!entry) continue;
    const node = entry.node;
    if (!isElement(node)) continue;
    for (let candidate = 0; candidate < CONTENT_CANDIDATES.length; candidate += 1) {
      const matches = CONTENT_CANDIDATES[candidate];
      const best = bestLength[candidate];
      if (!matches || best === undefined) continue;
      // Skip the predicate unless this node would actually improve the candidate's score.
      if (entry.subtreeTextLength <= best) continue;
      if (!matches(node)) continue;
      bestLength[candidate] = entry.subtreeTextLength;
      bestIndex[candidate] = index;
    }
  }

  for (let candidate = 0; candidate < CONTENT_CANDIDATES.length; candidate += 1) {
    const index = bestIndex[candidate];
    const length = bestLength[candidate];
    if (index !== undefined && length !== undefined && index >= 0 && length >= MIN_CONTENT_CHARS) return index;
  }
  return -1;
}

type WalkItem = { kind: "enter"; node: ChildNode } | { kind: "leave" };

/**
 * Emit text from one subtree with an explicit stack. Block elements contribute a line break on
 * both sides, <br> contributes one, and the walk stops as soon as the budget is spent. Consecutive
 * breaks collapse as they are emitted, so deeply nested blocks cannot spend the budget on newlines
 * before any prose is reached.
 */
function collectText(
  container: ChildNode,
  maxChars: number,
  mode: ChromeMode,
): { text: string; truncated: boolean; tagDroppedChars: number; ruleDroppedChars: number } {
  const parts: string[] = [];
  let length = 0;
  let truncated = false;
  let tagDroppedChars = 0;
  let ruleDroppedChars = 0;
  const stack: WalkItem[] = [{ kind: "enter", node: container }];

  const emit = (value: string) => {
    if (!value) return;
    if (length >= maxChars) {
      truncated = true;
      return;
    }
    const room = maxChars - length;
    if (value.length > room) {
      // Never cut between the halves of a surrogate pair; a lone half renders as a replacement mark.
      let end = room;
      const last = value.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) end -= 1;
      parts.push(value.slice(0, end));
      length += end;
      truncated = true;
      return;
    }
    parts.push(value);
    length += value.length;
  };

  const emitBreak = () => {
    const last = parts[parts.length - 1];
    if (length > 0 && last !== undefined && last.endsWith("\n")) return;
    emit("\n");
  };

  while (stack.length > 0) {
    if (length >= maxChars) {
      truncated = true;
      break;
    }
    const item = stack.pop();
    if (!item) break;
    if (item.kind === "leave") {
      emitBreak();
      continue;
    }

    const node = item.node;
    if (node.type === "text") {
      emit((node as Text).data);
      continue;
    }
    if (!isElement(node)) {
      const children = childrenOf(node);
      for (let child = children.length - 1; child >= 0; child -= 1) {
        const next = children[child];
        if (next) stack.push({ kind: "enter", node: next });
      }
      continue;
    }
    const reason = dropReason(node, mode);
    if (reason) {
      const dropped = textLengthOf(node);
      if (reason === "rule") ruleDroppedChars += dropped;
      else tagDroppedChars += dropped;
      continue;
    }
    if (node.name === "br") {
      emitBreak();
      continue;
    }

    if (BLOCK_TAGS.has(node.name)) {
      emitBreak();
      stack.push({ kind: "leave" });
    }
    for (let child = node.children.length - 1; child >= 0; child -= 1) {
      const next = node.children[child];
      if (next) stack.push({ kind: "enter", node: next });
    }
  }

  return { text: parts.join(""), truncated, tagDroppedChars, ruleDroppedChars };
}

function extractTitle(flat: FlatEntry[]): string {
  for (const entry of flat) {
    if (!isElement(entry.node) || entry.node.name !== "title") continue;
    const raw = collectText(entry.node, TITLE_MAX_CHARS, "minimal").text;
    return raw.replace(/\s+/gu, " ").trim();
  }
  return "";
}

export function extractReadableText(html: string, options: ExtractReadableTextOptions = {}): ExtractedWebPage {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const bounded = truncateDeepNesting(html.slice(0, MAX_EXTRACTED_HTML_CHARS));
  const document = parseDocument(bounded);
  const flat = flatten(document);
  const title = extractTitle(flat);

  const containerIndex = selectContainer(flat);
  const selected = containerIndex >= 0 ? flat[containerIndex] : undefined;
  const container: ChildNode = selected ? selected.node : document;
  const containerReadableLength = selected ? selected.readableTextLength : (flat[0]?.readableTextLength ?? 0);

  // Only the class and id rules are evidence about prose, and only prose is the scale. Script,
  // style, head and tag-dropped text leave both sides, so the share measures what a rule removed
  // against what the page actually offered to read.
  const ruleShare = (read: { ruleDroppedChars: number; tagDroppedChars: number }) => {
    const readable = containerReadableLength - read.tagDroppedChars;
    return readable > 0 ? read.ruleDroppedChars / readable : 0;
  };

  let extracted = collectText(container, maxChars, "full");
  let kept = extracted.text.trim();
  // A page-wide <form> (ASP.NET) is the last case: the tag rules take the whole page. Reading it
  // with only the always-dropped rules is the one retry that cannot re-admit class-dropped chrome,
  // because it only runs when nothing at all survived.
  if (!kept) {
    extracted = collectText(container, maxChars, "minimal");
    kept = extracted.text.trim();
  }

  // A page that still yields prose after the class and id rules took a sizeable share is not the
  // whole page, so say so rather than returning the remainder as complete.
  const trimmedByRules = kept.length > 0 && ruleShare(extracted) >= CHROME_RETRY_SHARE;

  const text = extracted.text
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t\f\v\u00a0]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();

  return { title, text, truncated: extracted.truncated || trimmedByRules };
}
