// ──────────────────────────────────────────────
// Seed: Default Regex Scripts
// Ships built-in regex scripts for common text cleaning tasks.
// ──────────────────────────────────────────────
import type { DB } from "./connection.js";
import { regexScripts } from "./schema/index.js";
import { now } from "../utils/id-generator.js";
import { eq } from "./file-query.js";

export const CLEAN_HTML_ID = "default-clean-html";
const COLLAPSE_NEWLINES_ID = "default-collapse-newlines";

export const LEGACY_CLEAN_HTML_FIND_REGEX =
  String.raw`[ \t]?<(?!--)(?!\/?(?:font|lie|filter)\b)(?:"[^"]*"|'[^']*'|[^'">])*>`;

export const CLEAN_HTML_FIND_REGEX =
  String.raw`<(?:!DOCTYPE\b[^>]*|\/?(?!(?:font|lie|filter)\b)[A-Za-z][^>]*)>`;

export function shouldMigrateCleanHtmlPattern(row: { id: string; findRegex: string }): boolean {
  return row.id === CLEAN_HTML_ID && row.findRegex === LEGACY_CLEAN_HTML_FIND_REGEX;
}

export async function seedDefaultRegexScripts(db: DB) {
  const existing = await db
    .select({ id: regexScripts.id, findRegex: regexScripts.findRegex })
    .from(regexScripts);

  const existingIds = new Set(existing.map((r) => r.id));
  const timestamp = now();

  const defaults = [
    {
      id: CLEAN_HTML_ID,
      name: "Clean HTML (Outgoing Prompt)",
      enabled: "true",
      findRegex: CLEAN_HTML_FIND_REGEX,
      replaceString: "",
      trimStrings: "[]",
      placement: '["user_input","ai_output"]',
      flags: "g",
      promptOnly: "true",
      applyMode: "prompt",
      targetCharacterIds: "[]",
      targetPromptPresetIds: "[]",
      order: 0,
      minDepth: null,
      maxDepth: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: COLLAPSE_NEWLINES_ID,
      name: "Collapse Excess Newlines",
      enabled: "true",
      findRegex: "\\n{3,}",
      replaceString: "\n\n",
      trimStrings: "[]",
      placement: '["user_input","ai_output"]',
      flags: "g",
      promptOnly: "false",
      applyMode: "display",
      targetCharacterIds: "[]",
      targetPromptPresetIds: "[]",
      order: 10,
      minDepth: null,
      maxDepth: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  const toInsert = defaults.filter((d) => !existingIds.has(d.id));
  if (toInsert.length > 0) {
    await db.insert(regexScripts).values(toInsert);
  }

  const legacyCleanHtml = existing.find(shouldMigrateCleanHtmlPattern);
  if (legacyCleanHtml) {
    await db
      .update(regexScripts)
      .set({ findRegex: CLEAN_HTML_FIND_REGEX, updatedAt: timestamp })
      .where(eq(regexScripts.id, CLEAN_HTML_ID));
  }
}
