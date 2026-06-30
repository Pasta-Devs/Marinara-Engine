import type { WrapFormat } from "@marinara-engine/shared";

export function escapeXmlText(value: string): string {
  // XML text nodes only require escaping `&` and `<`. Keep plain `>` literal so
  // user-authored Markdown blockquotes do not become visible `&gt;` tokens.
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function neutralizeMarkdownHeadings(value: string): string {
  return value.replace(/^(\s{0,3})(#{1,6})(?=\s|$)/gm, "$1\\$2");
}

export function sanitizePromptLeaf(value: string, wrapFormat: WrapFormat): string {
  if (wrapFormat === "xml") return escapeXmlText(value);
  if (wrapFormat === "markdown") return neutralizeMarkdownHeadings(value);
  return value;
}
