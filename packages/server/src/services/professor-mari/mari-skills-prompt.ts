// ──────────────────────────────────────────────
// Professor Mari: custom-skill prompt injection.
//
// Mirrors the memory injection (#4851): only a title + one-liner index is always in
// context; a skill body (up to 200k chars each) is pulled on relevance with
// `app_data skill.get`. Pure renderer so the token-critical caps stay testable.
// ──────────────────────────────────────────────
import type { MariWorkspaceSkillDetail } from "@marinara-engine/shared";

export interface RenderMariSkillsOptions {
  maxIndexEntries?: number;
  maxIndexChars?: number;
  // A skill this short costs less than the round-trip to fetch it, so it is inlined.
  maxInlineSkillChars?: number;
  maxInlineTotalChars?: number;
}

const DEFAULT_MAX_INDEX_ENTRIES = 60;
const DEFAULT_MAX_INDEX_CHARS = 8_000;
const DEFAULT_MAX_INLINE_SKILL_CHARS = 1_500;
const DEFAULT_MAX_INLINE_TOTAL_CHARS = 6_000;

function flattenLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeXmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderMariSkillsPrompt(
  skills: MariWorkspaceSkillDetail[],
  diagnostics: string[] = [],
  options: RenderMariSkillsOptions = {},
): string | null {
  const maxIndexEntries = options.maxIndexEntries ?? DEFAULT_MAX_INDEX_ENTRIES;
  const maxIndexChars = options.maxIndexChars ?? DEFAULT_MAX_INDEX_CHARS;
  const maxInlineSkillChars = options.maxInlineSkillChars ?? DEFAULT_MAX_INLINE_SKILL_CHARS;
  let inlineBudget = options.maxInlineTotalChars ?? DEFAULT_MAX_INLINE_TOTAL_CHARS;

  const enabled = skills.filter((skill) => skill.enabled && skill.name.trim() && skill.content.trim());

  const indexLines: string[] = [];
  const inlineSections: string[] = [];
  let indexChars = 0;
  for (const skill of enabled) {
    if (indexLines.length >= maxIndexEntries) break;
    const body = skill.content.trim();
    const description = flattenLine(skill.description);
    const line = `- [${flattenLine(skill.id)}] ${flattenLine(skill.name)}${description ? `: ${description}` : ""}`;
    if (indexChars + line.length + 1 > maxIndexChars && indexLines.length > 0) break;
    indexLines.push(line);
    indexChars += line.length + 1;
    // Body is prompt LEAF content and reaches the model verbatim (CONTRIBUTING.md
    // "Prompt Leaf Content Is Verbatim"); structure comes from the fixed wrapper.
    const section = `<skill name="${escapeXmlAttribute(flattenLine(skill.name))}" id="${escapeXmlAttribute(flattenLine(skill.id))}">\n${body}\n</skill>`;
    if (body.length <= maxInlineSkillChars && section.length + 1 <= inlineBudget) {
      inlineSections.push(section);
      inlineBudget -= section.length + 1;
    }
  }

  const sections: string[] = [];
  if (indexLines.length > 0) {
    sections.push(`Index (\`skill.get\` an id for its full text):\n${indexLines.join("\n")}`);
    const trimmed = enabled.length - indexLines.length;
    if (trimmed > 0) sections.push(`(${trimmed} more skill(s) omitted from the index; use skill.list to page them.)`);
  }
  if (inlineSections.length > 0) sections.push(inlineSections.join("\n\n"));
  if (diagnostics.length > 0) sections.push(`<skill_diagnostics>\n${diagnostics.join("\n")}\n</skill_diagnostics>`);
  if (sections.length === 0) return null;

  return `<professor_mari_custom_skills>
Use these user-defined skills when relevant.

${sections.join("\n\n")}
</professor_mari_custom_skills>`;
}
