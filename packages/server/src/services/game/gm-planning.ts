// ──────────────────────────────────────────────
// Game Master planning written out as prose
// ──────────────────────────────────────────────

/** The labels only a plan uses. A run of planning paragraphs is lifted only when one of its lines carries one. */
const PLAN_ONLY_LABEL = /^\s*(?:[*_#>-]+\s*)?(?:opening scene|scene plan|plan|planning)(?:[*_]+)?\s*:/im;
/**
 * The labels a plan's other paragraphs open with, ahead of the plan or behind it, which no out-of-character answer
 * plausibly opens with. "Notes:", "Checks:", "Approach:", "Goals:", "Outline:" or "Next steps:" can open an answer or
 * a question to the player, so a paragraph opening with one of those ends the run.
 */
const PLAN_PART_LABEL =
  /^\s*(?:[*_#>-]+\s*)?(?:opening scene|scene plan|plan|planning|location|setting|beats?)(?:[*_]+)?\s*:/i;

export interface LeadingPlanningExtraction {
  content: string;
  planning: string;
}

/**
 * Lift the plan a Game Master wrote out before its scene ("Opening scene: ... / Location: ... / Plan: ...") off the
 * reply, so it goes with the turn's thinking instead of opening the narration. The leading run of paragraphs that
 * each open with a plan's label is lifted whole when one of them names itself a plan. A reply with no narration
 * leaves empty content for the caller's normal no-output handling; the first non-plan paragraph stays behind.
 */
export function extractLeadingGmPlanning(text: string): LeadingPlanningExtraction {
  const paragraphs = text.trimStart().split(/(\n\s*\n)/);
  let planned = 0;
  // Paragraphs sit at even indexes, the blank lines between them at odd ones.
  while (planned < paragraphs.length && PLAN_PART_LABEL.test(paragraphs[planned] ?? "")) planned += 2;
  if (planned === 0) return { content: text, planning: "" };
  const planning = paragraphs
    .slice(0, planned - 1)
    .join("")
    .trim();
  const content = paragraphs.slice(planned).join("").trimStart();
  if (!PLAN_ONLY_LABEL.test(planning)) return { content: text, planning: "" };
  return { content, planning };
}

/**
 * A Game Master that calls a tool mid-reply often announces it first ("... in the lamplight — let me get the
 * number."). The announcement is the model talking to itself, not the scene, so it is cut off the end of the text
 * written before the call. Only a final sentence or dash-led clause that is wholly that announcement is cut, and its
 * object has to be the roll itself or the result it waits on: "roll it", "roll for the healing", "roll the die",
 * "roll initiative", "roll to see how that goes", "get the number", "check the Dexterity save", "see what the dice
 * say", "see how much it heals", or nothing at all ("time to find out.", "let me check."). Any other object or
 * continuation ("see the damage", "check the cellar before the light goes") is scene content and stays.
 */
const FOR_TAIL = String.raw`(?:[ \t]+for(?:[ \t]+[^\s.!?,;:"“”—–]+){1,5})?`;
const DETERMINER = String.raw`(?:(?:the|a|an|my|your|his|her|their|its|this|that|our|some)[ \t]+)?`;
const ROLL_NOUN = String.raw`(?:dice|die|rolls?|\d*d\d+(?:[+-]\d+)?)`;
const RESULT_NOUN = String.raw`(?:numbers?|results?|totals?|outcomes?)`;
const ROLL_KIND = String.raw`(?:[^\s.!?,;:"“”—–]+[ \t]+)?(?:save|saving throw|check|roll)s?`;
// Only a roll may name what it rolls for; "see the damage" is a look at the scene.
const ROLLED_FOR = String.raw`(?:initiative|damage|healing|modifiers?)`;
const OUTCOME = String.raw`(?:what[ \t]+the[ \t]+(?:dice|die)[ \t]+says?|what[ \t]+(?:it|that|this|they)[ \t]+(?:does|do|says?)|how[ \t]+(?:much[ \t]+)?(?:it|that|this|they)[ \t]+(?:lands|goes|plays out|turns out|heals|hurts|does)|if[ \t]+(?:it|that|this|they)[ \t]+(?:lands|hits|works|succeeds|holds))`;
// What any announcing verb may be after; a roll may also name what it rolls for.
const ANNOUNCED_OBJECT = String.raw`(?:${DETERMINER}(?:${RESULT_NOUN}|${ROLL_NOUN})${FOR_TAIL}|${DETERMINER}${ROLL_KIND}|${OUTCOME})`;
const ROLL_OBJECT = String.raw`(?:(?:it|them|that|this)${FOR_TAIL}|${DETERMINER}${ROLLED_FOR}${FOR_TAIL}|${ANNOUNCED_OBJECT})`;
// Any announcement may go on to say what it waits to learn: "check and see how that goes", "roll the die, and see".
const OUTCOME_TAIL = String.raw`(?:,?[ \t]+(?:to|and)[ \t]+(?:see|find out)(?:[ \t]+${OUTCOME})?)?`;
const TOOL_ANNOUNCEMENT = new RegExp(
  String.raw`(?:^|(?<=[.!?…"'”’*_)\]])\s+|\s*[—–]\s*|\s+-{1,2}\s+)` +
    String.raw`(?:(?:okay|ok|alright|right|now|first|so),?\s+)*` +
    String.raw`(?:let(?:'s|’s| me| us)|i(?:'ll|’ll| will| need to| have to|'m going to|’m going to| am going to)|time to)\s+` +
    String.raw`(?:(?:roll|re-?roll|throw)(?:[ \t]+${ROLL_OBJECT})?${FOR_TAIL}` +
    String.raw`|(?:get|check|see|find out|call|look up|determine|work out|figure out)(?:[ \t]+${ANNOUNCED_OBJECT})?)` +
    OUTCOME_TAIL +
    String.raw`[ \t]*[.!?:…]*\s*$`,
  "i",
);

export function stripTrailingToolAnnouncement(text: string): string {
  const match = TOOL_ANNOUNCEMENT.exec(text);
  return match ? text.slice(0, match.index).trimEnd() : text;
}
