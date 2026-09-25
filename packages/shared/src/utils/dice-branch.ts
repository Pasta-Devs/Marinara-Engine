// ──────────────────────────────────────────────
// Dice branch blocks — `[branch: id] [on success] … [on failure] … [/branch]`
//
// For a binary check the Game Master writes BOTH outcomes in one pass without seeing
// any number, and the engine keeps the half the real roll selects:
//
//   [skill_check: skill="Stealth" dc="15" branch="crates"]
//   [branch: crates]
//   [on success] The guard's gaze slides over the crates and away.
//   [on failure] A boot scuffs stone. He turns, and his hand is already moving.
//   [/branch]
//
// The check tag is the sparse shape `serializeSparseSkillCheckTag` already produces,
// plus a `branch=` label. `branch=` is an unknown attribute to every existing reader —
// `parseSkillCheckTagBody` builds an attribute map and reads only the keys it knows —
// so an older client reading a newer transcript ignores it, which is the same
// compatibility property `threshold=` relies on today.
//
// Three things in here are load-bearing.
//
// 1. NONE OF THE FOUR DELIMITERS IS REACHABLE BY A REMOVABLE-TAG SET. The server's
//    tag-head reader requires the character after the name to be `:` or `]`, so
//    `[on success]` (a space before the `]`) reads as null and every removable-tag set
//    is skipped before it is ever consulted; `[/branch]` is not a `[name:` or `[name]`
//    head at all. Only the literal patterns below reach either, which is why they are
//    exported rather than re-spelled in each stripper.
//
// 2. THE SCAN IS AN OPENER WALK, NOT A BOUNDED REGEX, for the same reason the
//    placeholder scan is: the malformed blocks the failure contract promises to handle
//    are exactly the ones a bounded pattern cannot match, and a block that is never
//    matched cannot be replaced. Every `[branch:` opener therefore produces a bounded
//    block, and every bounded block is either resolved or dropped.
//
// 3. A DROPPED BLOCK KEEPS THE ASK. A block the engine refuses to read loses both
//    halves of its prose — keeping one half without a roll is inventing an outcome —
//    but any `[skill_check:]` tag that sat inside it is re-emitted, because losing the
//    ask is the one thing a refusal may not do.
//
// Nothing here rolls anything, reads a sheet or decides an outcome. The roll belongs to
// the engine's check resolver, which is where every other check in the turn is rolled.
// ──────────────────────────────────────────────

import { createSkillCheckTagRegex, readGmTagAttributes } from "./skill-check-tag.js";

/** The block opener, as written. Exported so the stream filter and the scan agree. */
export const BRANCH_BLOCK_OPENER = "[branch:";
/** The block closer, as written. Not a `[name:` or `[name]` head, so nothing else sees it. */
export const BRANCH_BLOCK_CLOSER = "[/branch]";
/** The attribute that ties a check tag to its block. Unknown to every existing reader. */
export const SKILL_CHECK_BRANCH_ATTRIBUTE = "branch";

/**
 * The longest label an opener is read with. A label is a short word the model repeats
 * in the check tag's `branch=`; anything longer is not one, and the bound is what keeps
 * the pattern below linear.
 */
export const BRANCH_LABEL_MAX = 80;

/**
 * `[branch: id]`. The only one of the four delimiters that is an ordinary `[name:` head,
 * so it is the only one an unknown-tag catch-all already reaches.
 *
 * The label is bounded rather than `*`: an unbounded negated class in front of a literal
 * closer re-scans to the end of the turn from every unclosed opener, which is quadratic
 * on a turn made of nothing but `[branch:` openers, and a turn is model-written text.
 * The `{0,80}` spelling is `BRANCH_LABEL_MAX`; both change together.
 */
export function createBranchOpenerPattern(): RegExp {
  return /\[branch:[^\]\r\n]{0,80}\]/gi;
}

/**
 * `[on success]` / `[on failure]`. The space before the `]` is what makes this
 * unreachable by every name-set walk on both sides, so this literal pattern is the
 * only thing that strips it.
 */
export function createBranchHalfPattern(): RegExp {
  return /\[on\s+(?:success|failure)\]/gi;
}

/** `[/branch]`. Not a tag head at all; a dangling-closer sweep does not reach it either. */
export function createBranchCloserPattern(): RegExp {
  return /\[\/branch\]/gi;
}

/** Which half of a block a line of prose belongs to. */
export type GameBranchOutcome = "success" | "failure";

/** Why the engine would not read a branch block. Every one of these drops the block. */
export type GameBranchRefusal =
  /** No `[/branch]` after the opener. */
  | "unterminated"
  /** A second `[branch:` opener inside the block, or a `[skill_check:]` tag inside it. */
  | "nested"
  /** `[branch: ]` with nothing to match a check tag against. */
  | "empty-label"
  /** Fewer than both halves, or a half with no prose in it. */
  | "missing-half"
  /** The same half written twice. */
  | "duplicate-half";

/** One half of a block: the marker's outcome and the prose after it. */
export interface GameBranchHalf {
  outcome: GameBranchOutcome;
  /** The prose between this marker and the next one, trimmed. */
  text: string;
}

/** One bounded `[branch:` block, whether or not the engine can read it. */
export interface GameBranchBlock {
  /** Offset of the `[` in the scanned content. */
  start: number;
  /** Offset one past the end of the bounded block. */
  end: number;
  /** The block exactly as the model wrote it, for the audit log. */
  raw: string;
  /** The label as written, for the log line. */
  rawLabel: string;
  /** The label folded for matching: trimmed and lowercased. */
  label: string;
  /** The halves found, in reading order. */
  halves: GameBranchHalf[];
  /** Every `[skill_check:]` tag that sat inside the block, verbatim and in order. */
  innerCheckTags: string[];
  /** Set when the block cannot be read. A readable block has exactly two usable halves. */
  refusal: GameBranchRefusal | null;
}

/** Fold a label for matching, so `branch="Crates"` and `[branch: crates]` are one label. */
export function normalizeGameBranchLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * Read the `branch=` label off a `[skill_check: ...]` tag body, or `null`.
 *
 * Read through the same audited attribute walk `parseSkillCheckTagBody` uses, rather
 * than a regex of its own, so a label cannot be read out of a skill NAME and the two
 * readers cannot disagree about which attributes a tag carries.
 */
export function readSkillCheckBranchLabel(body: string): string | null {
  for (const attribute of readGmTagAttributes(body)) {
    if (attribute.key.trim().toLowerCase() !== SKILL_CHECK_BRANCH_ATTRIBUTE) continue;
    const label = normalizeGameBranchLabel(attribute.rawValue.trim().replace(/^['"]|['"]$/g, ""));
    return label || null;
  }
  return null;
}

/** Where a `[skill_check:` tag sits, without deciding anything about its body. */
export interface SkillCheckTagSpan {
  start: number;
  end: number;
  /** The tag exactly as written, delimiters included. */
  raw: string;
  /** The tag's body, for the attribute readers. */
  body: string;
}

/** Every `[skill_check: …]` span in the content, in reading order, on the shipped grammar. */
export function scanSkillCheckTagSpans(content: string): SkillCheckTagSpan[] {
  const pattern = createSkillCheckTagRegex();
  const spans: SkillCheckTagSpan[] = [];
  for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
    spans.push({ start: match.index, end: match.index + match[0].length, raw: match[0], body: match[1] ?? "" });
  }
  return spans;
}

/**
 * Bound one block, starting just past its opener.
 *
 *   1. The first `[/branch]` after the opener closes it.
 *   2. With no closer, the block runs to the end of the content — but ONLY when at
 *      least one half marker follows the opener. That condition is the whole guard: a
 *      stray `[branch:` written into the middle of ordinary prose would otherwise take
 *      the rest of the turn with it, and a truncated block genuinely IS the rest of the
 *      turn. With no half marker the block is the opener tag alone, removed as a stray
 *      delimiter with no prose lost.
 *
 * The cost of rule 2 is stated rather than hidden: an unterminated block that did write
 * a half marker loses every character after its opener. It is only reachable when the
 * model wrote a block it never closed, the raw block is logged verbatim, and the
 * alternative — keeping one unrolled outcome, or both — is asserting something no die
 * decided.
 */
/**
 * The two positions a bound depends on, remembered across openers. Both only ever move
 * right as the walk does, so a search that found nothing ahead of one opener has found
 * nothing ahead of the next either: without this memory a turn full of openers that never
 * close would re-scan its whole suffix from every one of them, which is quadratic.
 * Each entry is the match's start and end, `[-1, -1]` when there is none anywhere ahead,
 * and `null` when not yet searched.
 */
interface BranchScanMemory {
  closer: [number, number] | null;
  half: [number, number] | null;
}

function nextMatch(
  content: string,
  from: number,
  cached: [number, number] | null,
  pattern: () => RegExp,
): [number, number] {
  if (cached && (cached[0] === -1 || cached[0] >= from)) return cached;
  const regex = pattern();
  regex.lastIndex = from;
  const match = regex.exec(content);
  return match ? [match.index, match.index + match[0].length] : [-1, -1];
}

function boundBranchBlock(
  content: string,
  bodyStart: number,
  memory: BranchScanMemory,
): { end: number; closed: boolean } {
  // Matched case-insensitively ON THE ORIGINAL STRING rather than on a lowercased copy:
  // `toLowerCase()` is not length-preserving (`İ` U+0130 lowercases to two code units),
  // so an offset taken from the copy and applied here would drift by one per such
  // character and the block would end past its own closer, eating the prose after it.
  memory.closer = nextMatch(content, bodyStart, memory.closer, createBranchCloserPattern);
  if (memory.closer[0] !== -1) return { end: memory.closer[1], closed: true };
  memory.half = nextMatch(content, bodyStart, memory.half, createBranchHalfPattern);
  if (memory.half[0] !== -1) return { end: content.length, closed: false };
  return { end: bodyStart, closed: false };
}

/** Read the halves inside one block's interior, and say what is wrong with them. */
function readBranchHalves(interior: string): { halves: GameBranchHalf[]; refusal: GameBranchRefusal | null } {
  const pattern = createBranchHalfPattern();
  const markers: Array<{ outcome: GameBranchOutcome; start: number; end: number }> = [];
  for (let match = pattern.exec(interior); match; match = pattern.exec(interior)) {
    markers.push({
      outcome: match[0].toLowerCase().includes("success") ? "success" : "failure",
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const halves: GameBranchHalf[] = [];
  for (const [index, marker] of markers.entries()) {
    const stop = markers[index + 1]?.start ?? interior.length;
    halves.push({ outcome: marker.outcome, text: interior.slice(marker.end, stop).trim() });
  }

  if (halves.length < 2) return { halves, refusal: "missing-half" };
  if (halves.length > 2) return { halves, refusal: "duplicate-half" };
  if (halves[0]!.outcome === halves[1]!.outcome) return { halves, refusal: "duplicate-half" };
  if (halves.some((half) => half.text.length === 0)) return { halves, refusal: "missing-half" };
  return { halves, refusal: null };
}

/**
 * Walk every `[branch:` opener and bound its block. Malformed blocks are found, not
 * skipped, because a block that is never found is a block whose delimiters reach saved
 * content and whose two contradictory halves both stand as prose.
 */
export function scanGameBranchBlocks(content: string): GameBranchBlock[] {
  const opener = createBranchOpenerPattern();
  const blocks: GameBranchBlock[] = [];
  const memory: BranchScanMemory = { closer: null, half: null };
  for (let match = opener.exec(content); match; match = opener.exec(content)) {
    const start = match.index;
    const bodyStart = start + match[0].length;
    const bounded = boundBranchBlock(content, bodyStart, memory);
    const rawLabel = match[0].slice(BRANCH_BLOCK_OPENER.length, -1).trim();
    const interiorEnd = bounded.closed ? bounded.end - BRANCH_BLOCK_CLOSER.length : bounded.end;
    const interior = content.slice(bodyStart, Math.max(bodyStart, interiorEnd));
    const innerCheckTags = scanSkillCheckTagSpans(interior).map((span) => span.raw);

    // Reading order matters for the refusal reported, not for what happens: every
    // refusal drops the block. The first reason found is the one logged.
    let refusal: GameBranchRefusal | null = null;
    const halvesRead = readBranchHalves(interior);
    if (!bounded.closed) refusal = "unterminated";
    else if (rawLabel.length === 0) refusal = "empty-label";
    else if (createBranchOpenerPattern().test(interior)) refusal = "nested";
    else if (innerCheckTags.length > 0) refusal = "nested";
    else refusal = halvesRead.refusal;

    blocks.push({
      start,
      end: bounded.end,
      raw: content.slice(start, bounded.end),
      rawLabel,
      label: normalizeGameBranchLabel(rawLabel),
      halves: halvesRead.halves,
      innerCheckTags,
      refusal,
    });
    // A nested opener sits inside a block that was already consumed, so the walk resumes
    // past the whole block rather than inside it.
    opener.lastIndex = Math.max(bounded.end, bodyStart);
  }
  return blocks;
}

/** The half a real roll selects. A critical folds into its half by the `success` boolean. */
export function selectGameBranchHalf(block: GameBranchBlock, success: boolean): GameBranchHalf | null {
  if (block.refusal) return null;
  return block.halves.find((half) => half.outcome === (success ? "success" : "failure")) ?? null;
}

/**
 * Strip the four delimiters, keeping the prose between them.
 *
 * This is the DISPLAY sweep, and it is deliberately non-destructive: it runs in the
 * server's segment editor and the client's tag strippers over content that is already
 * saved, where deleting narration would be the worse failure. A block only ever reaches
 * a stripper when the chance pass never ran for it — the switch was off, or the turn
 * predates the feature — so what it is looking at is prose the player already read.
 */
export function stripGameBranchDelimiters(content: string): string {
  return content
    .replace(createBranchOpenerPattern(), "")
    .replace(createBranchHalfPattern(), "")
    .replace(createBranchCloserPattern(), "");
}

/**
 * Drop every branch block whole, keeping the check tags that sat inside one.
 *
 * This is the FAILURE sweep, used by the chance pass when it could not decide: keeping
 * both halves would save a turn asserting two contradictory outcomes, and keeping one
 * without a roll would invent the outcome. Any delimiter left over after the blocks are
 * gone — a half marker or a closer with no opener of its own — is stripped too, so
 * nothing survives for a downstream stripper to half-eat.
 */
export function dropGameBranchBlocks(content: string): { content: string; changed: boolean; blocks: string[] } {
  const blocks = scanGameBranchBlocks(content);
  let result = "";
  let cursor = 0;
  for (const block of blocks) {
    result += content.slice(cursor, block.start) + block.innerCheckTags.join(" ");
    cursor = block.end;
  }
  result += content.slice(cursor);
  const swept = stripGameBranchDelimiters(result);
  return { content: swept, changed: swept !== content, blocks: blocks.map((block) => block.raw) };
}
