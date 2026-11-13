// ──────────────────────────────────────────────
// Roleplay played by a ruleset: the Engine's records in a saved reply
//
// A Roleplay chat pinned to a ruleset saves its turns the way a game does: each check the narrator
// asked for is rewritten into a `[skill_check: ...]` record with the Engine's dice, and each sheet or
// clock command carries the Engine's outcome. Game narration has its own reader for those; this is
// Roleplay's. Sheet and clock commands are dropped from the text (the sheet shows their result, so
// leaving them in would tell the bookkeeping twice), and each settled check is lifted out with its
// place in what is left, so the message can show it as a dice card where it happened.
// ──────────────────────────────────────────────
import {
  createSkillCheckTagRegex,
  parseSkillCheckTagBody,
  stripClockCommandTags,
  stripSheetCommandTags,
  type SkillCheckResult,
} from "@marinara-engine/shared";

export interface RoleplayRulesetCheck {
  /** Where the check stood, as an offset into the returned text. */
  offset: number;
  result: SkillCheckResult;
}

export interface RoleplayRulesetRecords {
  text: string;
  checks: RoleplayRulesetCheck[];
}

/** The reply's prose with the Engine's records taken out, and the settled checks with their places. */
export function extractRoleplayRulesetRecords(content: string): RoleplayRulesetRecords {
  if (!content.includes("[")) return { text: content, checks: [] };
  // A command on a line of its own leaves an empty line behind; a paragraph break is all that stays.
  const stripped = stripClockCommandTags(stripSheetCommandTags(content)).replace(/\n{3,}/g, "\n\n");
  const checks: RoleplayRulesetCheck[] = [];
  let text = "";
  let last = 0;
  for (const match of stripped.matchAll(createSkillCheckTagRegex())) {
    const start = match.index ?? 0;
    text += stripped.slice(last, start);
    last = start + match[0].length;
    // A sparse request the Engine never settled says nothing worth showing, so it simply goes.
    const result = parseSkillCheckTagBody(match[1] ?? "")?.resolvedResult;
    if (result) checks.push({ offset: text.length, result });
  }
  text += stripped.slice(last);
  return { text: text.trimEnd(), checks };
}
