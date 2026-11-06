// ──────────────────────────────────────────────
// Game Master planning written out as prose
// ──────────────────────────────────────────────

/**
 * The labels only a plan uses. A run of planning paragraphs is lifted only when one of its lines carries one. "Hidden:"
 * and "GM notes:" name what the player must not read yet (playtest 2026-10-26: a "Location / Stakes / Hidden" block
 * opened the scene and gave its secret away).
 */
const PLAN_ONLY_LABEL =
  /^\s*(?:[*_#>-]+\s*)?(?:opening scene|scene plan|plan|planning|hidden(?: (?:facts?|info|information|truths?))?|gm notes?)(?:[*_]+)?\s*:/im;
/**
 * The labels a plan's other paragraphs open with, ahead of the plan or behind it, which no out-of-character answer
 * plausibly opens with. "Notes:", "Checks:", "Approach:", "Goals:", "Outline:" or "Next steps:" can open an answer or
 * a question to the player, so a paragraph opening with one of those ends the run.
 */
const PLAN_PART_LABEL =
  /^\s*(?:[*_#>-]+\s*)?(?:opening scene|scene plan|plan|planning|location|setting|beats?|stakes|hidden(?: (?:facts?|info|information|truths?))?|gm notes?)(?:[*_]+)?\s*:/i;

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
  if (planned === 0) return extractLabelledPlanBlock(text);
  const planning = paragraphs
    .slice(0, planned - 1)
    .join("")
    .trim();
  const content = paragraphs.slice(planned).join("").trimStart();
  if (!PLAN_ONLY_LABEL.test(planning)) return extractLabelledPlanBlock(text);
  return { content, planning };
}

/** One short `Label: ...` line, the label a few capitalized words; never a speaker's quoted line. */
const LABELLED_LINE = /^\s*(?:[*_#>-]+\s*)?([A-Z][\p{L}'’]*(?:[ /&][\p{L}'’]+){0,2})(?:[*_]+)?\s*:(?:[*_]+)?\s*(.*)$/u;
/** A numbered or bulleted beat under a label: "(1) ...", "2. ...", "- ...". */
const BEAT_LINE = /^\s*(?:\(?\d{1,2}[.)]|[-*•])\s+\S/;
/** What only a plan talks about: the reply's commands and tags, its beats, numbered steps. */
const PLAN_MENTION = /\b(?:commands?|tags?|beats?)\b|\[\w+:|\(\d{1,2}\)/i;
/** The longest line a plan's label line is read as. A long line is prose, whatever opens it. */
const MAX_PLAN_LINE = 400;

/**
 * A plan written with labels of its own (cheap-GM playtest 2026-10-26: "Location: ... / Beats: (1)...
 * / Commands: place, branch nature check..." opened the narration). The leading run of paragraphs
 * whose every line is a short `Label: ...` line or a beat under one is lifted when it carries at
 * least three different labels and talks like a plan: numbered beats, or the reply's commands or
 * tags. A scene that opens with a speaker's line, a single labelled line or a run of dialogue that
 * says nothing about commands, tags or beats stays, and so does a reply that would be left empty.
 */
function extractLabelledPlanBlock(text: string): LeadingPlanningExtraction {
  const paragraphs = text.trimStart().split(/(\n\s*\n)/);
  const labels = new Set<string>();
  let beats = false;
  let planned = 0;
  for (; planned < paragraphs.length; planned += 2) {
    const lines = (paragraphs[planned] ?? "").split("\n").filter((line) => line.trim());
    let labelled = 0;
    const ok =
      lines.length > 0 &&
      lines.every((line, index) => {
        if (line.length > MAX_PLAN_LINE) return false;
        const label = LABELLED_LINE.exec(line);
        // A speaker's quoted words are dialogue, whatever their name looks like.
        if (label && !/^["“«「『]/.test(label[2] ?? "")) {
          labels.add(label[1]!.toLowerCase());
          labelled += 1;
          return true;
        }
        if (index > 0 && BEAT_LINE.test(line)) return (beats = true);
        return false;
      });
    if (!ok || labelled === 0) break;
  }
  if (planned === 0) return extractFirstPersonPlan(text);
  const planning = paragraphs
    .slice(0, planned - 1)
    .join("")
    .trim();
  const content = paragraphs.slice(planned).join("").trimStart();
  const talksLikePlan = beats || PLAN_MENTION.test(planning);
  if (labels.size < 3 || !talksLikePlan || !content.trim()) return extractFirstPersonPlan(text);
  return { content, planning };
}

/** A sentence in which the Game Master says what it is about to do: "I'm carrying ...", "I'll ...", "Let me ...". */
const PLANNER_SENTENCE =
  /^(?:(?:okay|ok|alright|right|so|now|first|next|then),?\s+)?(?:i(?:'m|’m| am|'ll|’ll| will| need to| should| must| have to| want to| plan to| can)|let(?:'s|’s| me)|the players?(?:'s|’s)? (?:wants?|asks?|asked|is|are|has|have|chose|chooses|picked|requests?|requested|just))\b/i;
/**
 * What only talk about the reply itself names: the player or the sheets, the fight's report, the narration, the
 * reply's commands or tags, the rules it resolves. A scene can say "she checks the door"; it does not say "the
 * recorded sheets" or "the combat report".
 */
const REPLY_MENTION = new RegExp(
  [
    String.raw`\bthe players?\b(?!\s+piano)`,
    String.raw`\b(?:the|supplied|recorded|character|their|her|his|its) (?:\w+ )?sheets?\b(?! of)`,
    String.raw`\b(?:combat|battle|fight) (?:report|result|recap)\b`,
    String.raw`\bnarrat(?:e|es|ed|ing|ion)\b`,
    String.raw`\b(?:commands?|tags?|widgets?|memory panel)\b`,
    String.raw`\b(?:this|the|my|next) (?:reply|response)\b`,
    String.raw`\b(?:skill|ability) checks?\b|\bsaving throws?\b|\bspell slots?\b|\bhit dice\b`,
    String.raw`\b(?:out of character|in-character|mechanics?)\b`,
    String.raw`\breturn(?:s|ing)? control\b`,
  ].join("|"),
  "i",
);
/** A plan sentence run straight into the scene with no space: "...still unresolved.The water closes over...". */
const GLUED_SENTENCE = /[\p{Ll}\d)][.!?](?=\p{Lu}\p{Ll})/u;
/** The longest opening a first-person plan is read in. */
const MAX_FIRST_PERSON_PLAN = 1200;

/**
 * A first-person plan the Game Master wrote ahead of its scene (cheap-GM playtest 2026-10-26: "The combat report
 * leaves the party standing ... I'm carrying that damage into the aftermath ... rather than inventing any further
 * combat actions.The last maintenance frame collapses ..."). Only the opening is read: its first paragraph, or the
 * part of it before a line break or before a sentence glued to the next with no space. That opening is lifted when
 * every sentence in it is the model saying what it will do ("I'm ...", "I'll ...", "Let me ...", "The player wants
 * ...") or names the reply itself (the player, the sheets, the combat report, the narration, the commands), at least
 * one sentence of each kind is there, it quotes nobody and speaks for nobody, and narration is left behind it. A
 * story line in the first person ("I need to get out of here.") names nothing of the reply and stays.
 */
function extractFirstPersonPlan(text: string): LeadingPlanningExtraction {
  const kept = { content: text, planning: "" };
  const trimmed = text.trimStart();
  const blank = /\n[^\S\n]*\n/.exec(trimmed);
  const paragraph = blank ? trimmed.slice(0, blank.index) : trimmed;
  const glued = GLUED_SENTENCE.exec(paragraph);
  const lineBreak = paragraph.indexOf("\n");
  let end = paragraph.length;
  if (glued) end = glued.index + 2;
  if (lineBreak >= 0 && lineBreak < end) end = lineBreak;
  const opening = trimmed.slice(0, end).trim();
  const content = trimmed.slice(end).trimStart();
  if (!opening || !content || opening.length > MAX_FIRST_PERSON_PLAN) return kept;
  // A speaker's line, a quote or a tag is the scene, whatever it says; an out-of-character note is the
  // player's to read.
  if (/["“”«»「」『』]|\[|^\s*[\p{L} .'’-]{1,40}:/u.test(opening) || /^\s*\(|\bOOC\b/i.test(opening)) return kept;
  const sentences = opening.split(/(?<=[.!?…])\s+/).filter((one) => one.trim());
  let planner = false;
  let mention = false;
  for (const sentence of sentences) {
    const plans = PLANNER_SENTENCE.test(sentence.trim());
    const names = REPLY_MENTION.test(sentence);
    if (!plans && !names) return kept;
    planner ||= plans;
    mention ||= names;
  }
  if (!planner || !mention) return kept;
  return { content, planning: opening };
}

/** A line that is only a markdown rule: three or more `-`, `*` or `_`, spaced or not. */
const RULE_LINE = /^[^\S\r\n]*(?:(?:-[^\S\r\n]*){3,}|(?:\*[^\S\r\n]*){3,}|(?:_[^\S\r\n]*){3,})\r?$/;

/**
 * Drop the markdown rules (`---`, `***`, `___`) a Game Master writes between its notes and its scene (playtest
 * 2026-10-26: a stray `---` after an OOC note showed in the story). The narration screen has no rule to draw, so a
 * rule line is never story; a rule inside a bracket tag, such as a `[Book: ...]` the player reads, is kept.
 */
export function stripStrayRuleLines(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  let depth = 0;
  for (const line of lines) {
    if (depth === 0 && RULE_LINE.test(line)) continue;
    kept.push(line);
    for (const char of line) {
      if (char === "[") depth++;
      else if (char === "]" && depth > 0) depth--;
    }
  }
  if (kept.length === lines.length) return text;
  return kept
    .join("\n")
    .replace(/(?:\r?\n[^\S\r\n]*){3,}/g, "\n\n")
    .trim();
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
