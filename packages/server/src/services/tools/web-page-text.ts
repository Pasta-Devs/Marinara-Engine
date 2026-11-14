// ──────────────────────────────────────────────
// Readable text from a fetched web page
// ──────────────────────────────────────────────
// The web_fetch tool hands the model page text, not markup. This is the same shape as the
// web-search MCP's extractor, minus its browser fallback: chrome and scripts are removed, the
// first real content container wins over the surrounding page, block boundaries become line
// breaks, and whitespace is collapsed. It reads the pages a model actually asks for (wikis,
// encyclopedias, news articles) well; a page that renders its prose entirely in client-side
// JavaScript still needs a browser, which this tool does not carry.

import * as cheerio from "cheerio";

/** The most page HTML extraction will look at. Fetching is bounded separately. */
const MAX_EXTRACTED_HTML_CHARS = 2 * 1024 * 1024;

/** A container shorter than this is page chrome, so the next candidate is tried. */
const MIN_CONTENT_CHARS = 200;

const DROPPED_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "iframe",
  "object",
  "canvas",
  "form",
  "select",
  "button",
  "nav",
  "footer",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  ".mw-editsection",
  ".catlinks",
  ".printfooter",
  ".noprint",
  ".metadata",
  "[class*='sidebar']",
  "[class*='breadcrumb']",
  "[class*='menu']",
  "[class*='nav-']",
  "[id*='navigation']",
  "[id*='sidebar']",
  "[id*='toc']",
].join(",");

const CONTENT_SELECTORS = [
  "article",
  "main",
  "[role='main']",
  ".mw-parser-output",
  "#mw-content-text",
  ".post-content",
  ".entry-content",
  ".article-content",
  ".content",
  "body",
];

const BLOCK_SELECTOR = "p,div,li,tr,h1,h2,h3,h4,h5,h6,blockquote,pre,section,article,table,dd,dt";

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
  /** The page's <title>, decoded and collapsed; empty when the page has none. */
  title: string;
  /** Readable text with line breaks between blocks and no markup. */
  text: string;
}

export function extractReadableText(html: string): ExtractedWebPage {
  const $ = cheerio.load(html.slice(0, MAX_EXTRACTED_HTML_CHARS));
  const title = $("title").first().text().replace(/\s+/g, " ").trim();

  // Pick the container before removing chrome: a skin can put a menu class on <body> itself, and
  // removing from the whole document would then delete the page. Removal is scoped to the container.
  let containerSelector = "body";
  let containerIndex = 0;
  for (const selector of CONTENT_SELECTORS) {
    const matches = $(selector);
    if (matches.length === 0) continue;
    let bestIndex = 0;
    let bestLength = 0;
    matches.each((index, element) => {
      const length = $(element).text().trim().length;
      if (length > bestLength) {
        bestLength = length;
        bestIndex = index;
      }
    });
    if (bestLength >= MIN_CONTENT_CHARS) {
      containerSelector = selector;
      containerIndex = bestIndex;
      break;
    }
  }
  const container = $(containerSelector).eq(containerIndex);

  container.find(DROPPED_SELECTORS).remove();

  container.find("br").replaceWith("\n");
  container.find(BLOCK_SELECTOR).each((_, element) => {
    $(element).append("\n");
  });

  const text = container
    .text()
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text };
}
