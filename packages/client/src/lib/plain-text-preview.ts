// ──────────────────────────────────────────────
// Plain-text preview of free-form card text (Creator's Notes) for small library previews.
// Card text often holds HTML, Markdown, images and macros. The preview keeps only readable words:
// tags and their attributes are dropped (never rendered), images and links reduce to their label,
// and the result is plain text that React escapes when it is shown.
// ──────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const value = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      // Only printable characters; control characters and invalid code points are dropped.
      if (!Number.isFinite(value) || value < 32 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) return "";
      return String.fromCodePoint(value);
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * The first few lines of `text` as plain text: no HTML, no Markdown images/links/emphasis, no blank lines.
 * `maxChars` keeps the work small for very long notes; CSS clamps the visible lines.
 */
export function plainTextPreview(text: string | null | undefined, maxChars = 360): string {
  if (!text) return "";
  let value = text.slice(0, 20_000);
  // Whole blocks whose content is never readable text.
  value = value.replace(/<(script|style|template|svg|iframe|object|noscript)\b[\s\S]*?<\/\1\s*>/gi, " ");
  value = value.replace(/<!--[\s\S]*?-->/g, " ");
  // Line-breaking tags become new lines, every other tag goes (attributes and all).
  value = value.replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr|hr)\b[^>]*>/gi, "\n");
  value = value.replace(/<\/?[a-z][^>]*>/gi, "");
  value = value.replace(/<[^>\n]*>/g, "");
  // Markdown: images vanish, links keep their label, code fences, headings, quotes, emphasis and rules go.
  value = value.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  value = value.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  value = value.replace(/```[^\n]*\n?/g, "");
  value = value.replace(/^[ \t]*(#{1,6}|>+|[-*+]|\d+[.)])[ \t]+/gm, "");
  value = value.replace(/^[ \t]*([-*_=])\1{2,}[ \t]*$/gm, "");
  value = value.replace(/(\*\*|__|~~|`)/g, "");
  value = value.replace(/(^|[\s(])[*_]([^\s*_][^*_\n]*?)[*_](?=[\s.,!?;:)]|$)/gm, "$1$2");
  value = decodeEntities(value);
  // A decoded "&lt;script&gt;" must not come back as markup either: the text is only ever shown as text,
  // but strip it the same way again so the preview reads cleanly.
  value = value.replace(/<(script|style|template|svg|iframe|object|noscript)\b[\s\S]*?<\/\1\s*>/gi, " ");
  value = value.replace(/<\/?[a-z][^>]*>/gi, "");
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t\u00a0 ]+/g, " ").trim())
    .filter(Boolean);
  const joined = lines.join("\n");
  return joined.length > maxChars ? `${joined.slice(0, maxChars).trimEnd()}…` : joined;
}
