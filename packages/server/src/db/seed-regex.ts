// ──────────────────────────────────────────────
// Seed: Default Regex Scripts
// Ships built-in regex scripts for common text cleaning tasks.
// ──────────────────────────────────────────────
import type { DB } from "./connection.js";
import { regexScripts } from "./schema/index.js";
import { now } from "../utils/id-generator.js";

const CLEAN_HTML_ID = "default-clean-html";
const COLLAPSE_NEWLINES_ID = "default-collapse-newlines";

export async function seedDefaultRegexScripts(db: DB) {
  const existing = await db.select({ id: regexScripts.id }).from(regexScripts);

  const existingIds = new Set(existing.map((r) => r.id));
  const timestamp = now();

  const defaults = [
    {
      id: CLEAN_HTML_ID,
      name: "Clean HTML (Outgoing Prompt)",
      enabled: "true",
      findRegex: "[ \\t]?<(?!--)(?!\\/?(?:font|lie|filter)\\b)(?:\"[^\"]*\"|'[^']*'|[^'\">])*>",
      replaceString: "",
      trimStrings: "[]",
      placement: '["user_input","ai_output"]',
      flags: "g",
      promptOnly: "true",
      targetCharacterIds: "[]",
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
      targetCharacterIds: "[]",
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
}
