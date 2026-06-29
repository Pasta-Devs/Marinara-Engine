// ──────────────────────────────────────────────
// Format Engine — XML / Markdown auto-wrapping
// ──────────────────────────────────────────────
import type { WrapFormat } from "@marinara-engine/shared";
import { nameToXmlTag } from "@marinara-engine/shared";

/**
 * Convert a display name to a Markdown heading slug.
 * "World Info (Before)" → "World Info Before"
 */
function nameToMarkdownHeading(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s_-]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Indent every line of a block by a given level of whitespace.
 */
function indent(text: string, level: number): string {
  if (level <= 0) return text;
  const pad = "    ".repeat(level);
  return text
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

/**
 * Wrap a section's content in the preset's chosen format.
 *
 * XML:      <section_name>\n    content\n</section_name>
 * Markdown: ## Section Name\ncontent
 *
 * If the content is empty (after trimming), returns empty string.
 */
export function wrapContent(content: string, sectionName: string, format: WrapFormat, depth: number = 0): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  if (format === "none") return trimmed;

  if (format === "xml") {
    const tag = nameToXmlTag(sectionName);
    const indented = indent(trimmed, 1);
    return `<${tag}>\n${indented}\n</${tag}>`;
  }

  // Markdown — depth determines heading level: 0 → ##, 1 → ###, 2 → ####
  const heading = nameToMarkdownHeading(sectionName);
  const hashes = "#".repeat(Math.min(depth + 2, 6));
  return `${hashes} ${heading}\n${trimmed}`;
}

/**
 * Wrap a group (container) around multiple children's content.
 *
 * XML:      <group_name>\n    ...children...\n</group_name>
 * Markdown: # Group Name\n...children...
 * None:     Raw content with no wrapping
 */
export function wrapGroup(childrenContent: string, groupName: string, format: WrapFormat): string {
  const trimmed = childrenContent.trim();
  if (!trimmed) return "";

  if (format === "none") return trimmed;

  if (format === "xml") {
    const tag = nameToXmlTag(groupName);
    const indented = indent(trimmed, 1);
    return `<${tag}>\n${indented}\n</${tag}>`;
  }

  const heading = nameToMarkdownHeading(groupName);
  return `# ${heading}\n${trimmed}`;
}
