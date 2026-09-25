// ──────────────────────────────────────────────
// Game: the one-request dice stream filter
//
// A placeholder and a branch block both stream to the player before the chance pass
// runs. Without a guard the player watches `[[roll: 2d6+3]]` appear and then silently
// become `14`, and watches both halves of a branch appear before one of them is
// deleted. Neither is a view of the turn that ever existed.
//
// So the stream holds them. A `[[roll:` candidate is held until its closing `]]` and
// then emitted as nothing; everything from `[branch:` to `[/branch]` is held the same
// way. The real text arrives a moment later through the `content_replace` frame the
// pass already sets `contentReplaced` for, or through the rewrite path in a chat with
// a text-rewrite agent. A short gap in the streamed sentence is better than a
// placeholder that mutates in front of the player.
//
// Three properties are load-bearing, and each one is why this is a filter rather than
// a regex over the finished text:
//
//   1. A CANDIDATE IS NEVER PARTIALLY EMITTED. Tokens arrive six characters at a time,
//      so `[[ro` is a whole token on its own. The moment a `[` could still grow into a
//      claimed opener it is held, and it is released only when it provably cannot.
//   2. A MALFORMED CANDIDATE IS RELEASED VERBATIM. A placeholder never spans a line and
//      is bounded by the same cap the scanner bounds its span with, so a `[[roll:` with
//      no closer before the line ends stops being a candidate and the held text is
//      handed back exactly as the model wrote it. The streamed view is then the only
//      place a raw span is ever visible, and only until the replace frame lands: the
//      saved content is still corrected to a visible notice by the pass.
//   3. NOTHING HERE DECIDES ANYTHING. The filter reads no die, resolves no body and
//      changes no saved content. It only decides what the player watches while the
//      draft is still being written.
//
// The filter is inert in a chat with a text-rewrite agent, because `writeContentChunked`
// skips the token stream entirely in that case and the finished text reaches the player
// through the rewrite frame instead.
// ──────────────────────────────────────────────

import {
  BRANCH_BLOCK_OPENER,
  createBranchCloserPattern,
  PLACEHOLDER_BODY_MAX,
  ROLL_PLACEHOLDER_OPENER,
} from "@marinara-engine/shared";

/** `[[roll:` — the shared spelling, so the filter and the scanner can never disagree. */
const ROLL_OPENER = ROLL_PLACEHOLDER_OPENER;
const ROLL_CLOSER = "]]";
/** `[branch:` — the same shared spelling, for the same reason. The closer is a pattern. */
const BRANCH_OPENER = BRANCH_BLOCK_OPENER;

/** Every head this filter claims. A single-bracket `[roll:` is Roleplay's own command. */
const CLAIMED_OPENERS = [ROLL_OPENER, BRANCH_OPENER] as const;

/**
 * A placeholder never spans a line, so its hold is bounded the way the scanner bounds its
 * span: the opener plus the body cap, with a little slack because the scanner trims the
 * whitespace around a body before measuring it. A `]]` past this OFFSET closes nothing —
 * bounding by a position rather than by how much text has arrived is what keeps the
 * filter's output identical however the provider chunks its tokens.
 */
const ROLL_BODY_WHITESPACE_SLACK = 16;
const ROLL_HOLD_MAX = ROLL_OPENER.length + PLACEHOLDER_BODY_MAX + ROLL_BODY_WHITESPACE_SLACK;

/**
 * A branch block is multi-line by construction, so a newline cannot bound it and only a
 * length cap can. Same cap the spatial-directive filter uses, for the same reason.
 */
const BRANCH_HOLD_MAX = 8_192;

export interface GameChanceStreamFilter {
  /** Take a streamed chunk, return only what the player should watch right now. */
  push(content: string): string;
  /** End of stream: hand back whatever is still held, minus any span that closed cleanly. */
  flush(): string;
}

type ChanceStreamMode = "idle" | "roll" | "branch";

/** Where a run of `]` ends, starting at `from`. `[[roll: 2d6 [x]]]` closes on the last one. */
function endOfCloserRun(text: string, from: number): number {
  let end = from;
  while (end < text.length && text[end] === "]") end += 1;
  return end;
}

/** Hide one-request dice spans while they stream, before the finished text replaces them. */
export function createGameChanceStreamFilter(): GameChanceStreamFilter {
  /** Undecided text. In `idle` it always begins at a `[`; otherwise at the opener itself. */
  let carry = "";
  let mode: ChanceStreamMode = "idle";

  /**
   * Walk the carry as far as it can be decided.
   *
   * `final` is the end of the stream, and it is the only thing that turns "wait for more
   * input" into a decision: a partial candidate is released verbatim, and a span that
   * closed on the very last character is dropped rather than held forever.
   */
  function drain(final: boolean): string {
    let visible = "";
    for (;;) {
      if (mode === "idle") {
        const opener = carry.indexOf("[");
        if (opener === -1) {
          visible += carry;
          carry = "";
          return visible;
        }
        visible += carry.slice(0, opener);
        carry = carry.slice(opener);
        const lower = carry.toLowerCase();
        if (lower.startsWith(ROLL_OPENER)) {
          mode = "roll";
          continue;
        }
        if (lower.startsWith(BRANCH_OPENER)) {
          mode = "branch";
          continue;
        }
        if (CLAIMED_OPENERS.some((claimed) => claimed.startsWith(lower))) {
          // Still growing: `[`, `[[`, `[[r` could all become a claimed opener.
          if (!final) return visible;
          visible += carry;
          carry = "";
          return visible;
        }
        // Not a claimed head. Release the bracket alone, so a `[` that immediately
        // follows can still start a candidate of its own.
        visible += carry.slice(0, 1);
        carry = carry.slice(1);
        continue;
      }

      if (mode === "roll") {
        const closer = carry.indexOf(ROLL_CLOSER, ROLL_OPENER.length);
        const lineBreak = carry.search(/[\r\n]/);
        // A body the scanner would refuse as over-long is still HELD when it closes,
        // because a refused span becomes a visible notice in the saved content and so it
        // changes too. Only a candidate that never closes is handed back.
        if (closer !== -1 && closer <= ROLL_HOLD_MAX && (lineBreak === -1 || closer < lineBreak)) {
          const end = endOfCloserRun(carry, closer + ROLL_CLOSER.length);
          // A closer run sitting at the very end of the carry may still be growing, so
          // the span is only dropped once something after it proves the run has ended.
          if (end === carry.length && !final) return visible;
          carry = carry.slice(end);
          mode = "idle";
          continue;
        }
        if (lineBreak !== -1 || carry.length > ROLL_HOLD_MAX || final) {
          // Released verbatim, but only the failed candidate's OWN bounded prefix — the
          // same offset the scanner bounds a refused span with. Releasing the whole carry
          // and returning would hand back everything that happened to arrive in the same
          // chunk after it, so a well-formed placeholder behind a malformed one would
          // stream raw and then mutate, and the filter's output would depend on how the
          // provider chunked its tokens. The remainder stays in the carry and is
          // re-scanned. The pass still replaces this span in the saved content, so the
          // streamed view is the only place it is ever seen. Bounded by BOTH the line
          // break and the cap, the way the scanner bounds a refused span: a line break far
          // past the cap must not widen the release to everything before it.
          const cut = Math.max(1, Math.min(lineBreak !== -1 ? lineBreak : carry.length, ROLL_HOLD_MAX));
          visible += carry.slice(0, cut);
          carry = carry.slice(cut);
          mode = "idle";
          continue;
        }
        return visible;
      }

      // Same rule as the block scanner's closer, and for the same reason it is a
      // case-insensitive match on the carry itself rather than an index taken from a
      // lowercased copy: `toLowerCase()` is not length-preserving, so such an index would
      // drift and the filter would cut the held block in the wrong place.
      const closerPattern = createBranchCloserPattern();
      closerPattern.lastIndex = BRANCH_OPENER.length;
      const closer = closerPattern.exec(carry);
      if (closer) {
        carry = carry.slice(closer.index + closer[0].length);
        mode = "idle";
        continue;
      }
      if (carry.length > BRANCH_HOLD_MAX || final) {
        // Bounded release, for the same reason as the roll arm above.
        const cut = Math.max(1, Math.min(carry.length, BRANCH_HOLD_MAX));
        visible += carry.slice(0, cut);
        carry = carry.slice(cut);
        mode = "idle";
        continue;
      }
      return visible;
    }
  }

  return {
    push(content) {
      carry += content;
      return drain(false);
    },
    flush() {
      const remaining = drain(true);
      carry = "";
      mode = "idle";
      return remaining;
    },
  };
}
