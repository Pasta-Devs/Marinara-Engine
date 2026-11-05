// ──────────────────────────────────────────────
// Professor Mari: shipped (built-in) skills.
//
// A built-in skill is a Markdown file under `src/assets/mari-skills/` that ships
// with the app: the task procedures Mari reads on demand instead of carrying in
// her permanent prompt. The assets folder is copied to `dist/assets` by
// `packages/server/scripts/build.mjs`, so this resolves the same way when the
// server runs from source (tsx) and from a build.
//
// These are read straight from disk on every list, exactly like the user's
// skills. That keeps a dev edit visible without restarting the server, and an
// app update replaces the text because nothing is ever copied into DATA_DIR.
// (Gunterlie's #7822 example skill is the opposite case: a user-space skill the
// user owns and may edit, so it must not be shipped this way.)
// ──────────────────────────────────────────────
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { logger } from "../../lib/logger.js";
import { parseSkillFrontmatter, skillInstructions } from "./skill-frontmatter.js";

/** Built-in ids never collide with a user id: user ids are normalized to `[a-z0-9-]` without this prefix. */
export const BUILTIN_SKILL_ID_PREFIX = "builtin-";

// Stable so a shipped skill never looks freshly edited in the panel's "updated" sort.
const BUILTIN_SKILL_TIMESTAMP = "2026-01-01T00:00:00.000Z";

const BUILTIN_SKILLS_DIR = new URL("../../assets/mari-skills/", import.meta.url);
const SAFE_SKILL_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export interface MariBuiltinSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  filePath: string;
}

export function builtinSkillTimestamp(): string {
  return BUILTIN_SKILL_TIMESTAMP;
}

function titleFromId(id: string): string {
  const words = id.replace(/[-_]+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : id;
}

export async function loadBuiltinSkills(): Promise<{ skills: MariBuiltinSkill[]; diagnostics: string[] }> {
  const skills: MariBuiltinSkill[] = [];
  const diagnostics: string[] = [];

  let files: string[];
  try {
    const entries = await readdir(BUILTIN_SKILLS_DIR, { withFileTypes: true });
    files = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    // A missing folder is a packaging bug, not a reason to fail her turn: she
    // simply has fewer skills, and the panel shows why.
    diagnostics.push(`Built-in skills could not be read: ${err instanceof Error ? err.message : String(err)}`);
    return { skills, diagnostics };
  }

  for (const file of files) {
    const base = file.replace(/\.md$/i, "").toLowerCase();
    if (!SAFE_SKILL_ID_PATTERN.test(base)) {
      diagnostics.push(
        `Built-in skill file ${file} is skipped: its name must be lowercase letters, digits and hyphens.`,
      );
      continue;
    }
    const id = `${BUILTIN_SKILL_ID_PREFIX}${base}`;
    const fileUrl = new URL(file, BUILTIN_SKILLS_DIR);
    const filePath = fileURLToPath(fileUrl);
    try {
      const raw = await readFile(fileUrl, "utf8");
      const frontmatter = parseSkillFrontmatter(raw);
      const content = skillInstructions(raw);
      if (!content) {
        diagnostics.push(`Built-in skill ${id} is skipped: it has no instructions below the frontmatter.`);
        continue;
      }
      const name = frontmatter.name?.trim() || titleFromId(base);
      const description = frontmatter.description?.trim() ?? "";
      if (!description) {
        // The description is the trigger line in her index; without it she cannot
        // tell what the skill is for. Keep the skill but make the gap visible.
        diagnostics.push(`Built-in skill ${id} has no description, so Mari cannot tell when to read it.`);
      }
      skills.push({ id, name, description, content, filePath });
    } catch (err) {
      logger.warn(err, "[Professor Mari] failed to read built-in skill %s", id);
      diagnostics.push(`Built-in skill ${id} could not be read: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { skills, diagnostics };
}
