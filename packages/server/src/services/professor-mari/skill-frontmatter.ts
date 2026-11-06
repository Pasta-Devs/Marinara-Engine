// ──────────────────────────────────────────────
// Professor Mari: skill file frontmatter.
//
// Shared by the user skill store and the shipped built-in skills, so the two
// cannot drift on how a `---` header is read or where the body starts.
// ──────────────────────────────────────────────

/** The body with its `---` frontmatter removed (not trimmed). */
export function stripSkillFrontmatter(content: string) {
  return content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*/, "").trimStart();
}

/** The instructions a skill carries: body only, trimmed. */
export function skillInstructions(content: string) {
  return stripSkillFrontmatter(content).trim();
}

/** Flat `key: value` pairs from a leading `---` block; quotes around a value are dropped. */
export function parseSkillFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*/);
  if (!match?.[1]) return {};
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    if (!key) continue;
    frontmatter[key] = raw.replace(/^["']|["']$/g, "");
  }
  return frontmatter;
}
