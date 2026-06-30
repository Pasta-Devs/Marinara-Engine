// Static safety heuristic for user-supplied regex patterns.
//
// Catches the most common ReDoS shapes — nested quantifiers like (a+)+, (a*)*,
// (a+|b)+, and ambiguous quantified alternatives like (a|ab)* — plus oversized
// sources, before the pattern is ever handed to RegExp.
//
// Not a full safe-regex replacement: false negatives are possible against
// expert-crafted patterns that pass star-height inspection but still backtrack
// catastrophically. The server-side timeout executor in
// packages/server/src/services/lorebook/regex-timeout.ts is the second line of
// defense for those cases.

export interface PatternSafetyOptions {
  /** Reject any source string longer than this. Default 1000. */
  maxLength?: number;
  /** Reject star height greater than this. 1 allows `a+`, `(a+)`, `(a)+`; rejects `(a+)+`. Default 1. */
  maxStarHeight?: number;
  /** Reject `{n,m}` (or `{n,}`) where m (or the unbounded upper) exceeds this. Default Infinity. */
  maxRepetition?: number;
}

const DEFAULTS: Required<PatternSafetyOptions> = {
  maxLength: 1000,
  maxStarHeight: 1,
  maxRepetition: Infinity,
};

const INVALID_QUANTIFIER = Symbol("invalid-quantifier");

interface ConsumedQuantifier {
  end: number;
  addsStarHeight: boolean;
}

/**
 * Decide whether a regex source string is safe to compile and run against
 * untrusted input. Returns false for patterns likely to cause catastrophic
 * backtracking; the caller should fall back to literal substring matching.
 */
export function isPatternSafe(source: string, options: PatternSafetyOptions = {}): boolean {
  const { maxLength, maxStarHeight, maxRepetition } = { ...DEFAULTS, ...options };

  if (typeof source !== "string") return false;
  if (source.length === 0) return true;
  if (source.length > maxLength) return false;

  // Walk the source once, tracking:
  //   - whether we are inside a character class (where quantifier semantics differ)
  //   - whether the previous character is escaped
  //   - the stack of group "has-repetition-quantifier-after-close" markers, to compute star height
  //
  // Star height here is the maximum number of nested groups whose closing `)`
  // is followed by a repeating quantifier (`*`, `+`, `{n,m}`), counted along with
  // immediate repeating-quantifier atoms. A bare `a+` has star height 1; `(a+)+` has 2.
  //
  // The walker is deliberately conservative — it does not need to be a full
  // regex parser to catch the common ReDoS shapes.

  let i = 0;
  let groupDepth = 0;
  // For each open group, the running max star height of atoms inside it.
  const groupInnerHeight: number[] = [];
  const groupBodyStart: number[] = [];
  let topLevelHeight = 0;

  const recordAtomHeight = (h: number) => {
    if (groupDepth > 0) {
      const idx = groupInnerHeight.length - 1;
      if (h > groupInnerHeight[idx]!) groupInnerHeight[idx] = h;
    } else if (h > topLevelHeight) {
      topLevelHeight = h;
    }
  };

  while (i < source.length) {
    const c = source[i]!;

    if (c === "\\") {
      const atomEnd = consumeEscapedAtom(source, i);
      if (atomEnd === null) return false;
      const consumed = consumeQuantifier(source, atomEnd, maxRepetition);
      if (consumed === INVALID_QUANTIFIER) return false;
      recordAtomHeight(consumed?.addsStarHeight ? 1 : 0);
      i = consumed?.end ?? atomEnd;
      continue;
    }

    if (c === "[") {
      // Character class is one atom; consume the whole class via lookahead and
      // pick up any quantifier sitting after the closing `]`.
      const closeIdx = findCharClassClose(source, i);
      if (closeIdx === -1) return false;
      const atomEnd = closeIdx + 1;
      const consumed = consumeQuantifier(source, atomEnd, maxRepetition);
      if (consumed === INVALID_QUANTIFIER) return false;
      recordAtomHeight(consumed?.addsStarHeight ? 1 : 0);
      i = consumed?.end ?? atomEnd;
      continue;
    }

    if (c === "(") {
      groupDepth += 1;
      groupInnerHeight.push(0);
      const bodyStart = getGroupBodyStart(source, i);
      if (bodyStart === null) return false;
      groupBodyStart.push(bodyStart);
      i = bodyStart;
      continue;
    }

    if (c === ")") {
      if (groupDepth === 0) return false;
      const innerHeight = groupInnerHeight.pop() ?? 0;
      const bodyStart = groupBodyStart.pop() ?? i;
      groupDepth -= 1;
      const consumed = consumeQuantifier(source, i + 1, maxRepetition);
      if (consumed === INVALID_QUANTIFIER) return false;
      const quantified = consumed?.addsStarHeight === true;
      if (quantified && hasUnsafeQuantifiedAlternation(source.slice(bodyStart, i))) return false;
      const groupHeight = innerHeight + (quantified ? 1 : 0);
      if (groupHeight > maxStarHeight) return false;
      recordAtomHeight(groupHeight);
      i = consumed?.end ?? i + 1;
      continue;
    }

    // Plain literal character: atom of height 0 unless quantified, then 1.
    const atomEnd = i + 1;
    const consumed = consumeQuantifier(source, atomEnd, maxRepetition);
    if (consumed === INVALID_QUANTIFIER) return false;
    recordAtomHeight(consumed?.addsStarHeight ? 1 : 0);
    i = consumed?.end ?? atomEnd;
  }

  if (groupDepth !== 0) return false; // Unbalanced
  if (topLevelHeight > maxStarHeight) return false;
  return true;
}

/** Advance past a quantifier starting at `i`. Invalid `{...}` bodies are literals in JS regex syntax. */
function consumeQuantifier(
  source: string,
  i: number,
  maxRepetition: number,
): ConsumedQuantifier | null | typeof INVALID_QUANTIFIER {
  const c = source[i];
  if (c === "*" || c === "+" || c === "?") {
    // JS has lazy quantifiers, not possessive quantifiers.
    const next = source[i + 1];
    if (next === "+") return INVALID_QUANTIFIER;
    return {
      end: next === "?" ? i + 2 : i + 1,
      addsStarHeight: c !== "?",
    };
  }
  if (c === "{") {
    const close = source.indexOf("}", i + 1);
    if (close === -1) return null;
    const body = source.slice(i + 1, close);
    const m = /^(\d+)(,(\d*))?$/.exec(body);
    if (!m) return null;
    const lo = Number(m[1]);
    const upperRaw = m[3];
    const hi = m[2] === undefined ? lo : upperRaw === "" || upperRaw === undefined ? Infinity : Number(upperRaw);
    if (!Number.isFinite(lo) || lo > maxRepetition) return INVALID_QUANTIFIER;
    if (Number.isFinite(hi) && hi > maxRepetition) return INVALID_QUANTIFIER;
    if (!Number.isFinite(hi) && Number.isFinite(maxRepetition)) return INVALID_QUANTIFIER;
    let next = close + 1;
    if (source[next] === "+") return INVALID_QUANTIFIER;
    if (source[next] === "?") next += 1;
    return { end: next, addsStarHeight: true };
  }
  return null;
}

function consumeEscapedAtom(source: string, i: number): number | null {
  const next = source[i + 1];
  if (next === undefined) return null;
  if ((next === "p" || next === "P" || next === "u") && source[i + 2] === "{") {
    const close = source.indexOf("}", i + 3);
    return close === -1 ? null : close + 1;
  }
  return i + 2;
}

function getGroupBodyStart(source: string, openIdx: number): number | null {
  if (source[openIdx + 1] !== "?") return openIdx + 1;
  const kind = source[openIdx + 2];
  if (kind === ":" || kind === "=" || kind === "!") return openIdx + 3;
  if (kind === "<") {
    const lookbehindKind = source[openIdx + 3];
    if (lookbehindKind === "=" || lookbehindKind === "!") return openIdx + 4;
    const close = source.indexOf(">", openIdx + 3);
    return close === -1 ? null : close + 1;
  }
  return null;
}

function findCharClassClose(source: string, openIdx: number): number {
  // The first ] after [ closes the class, except for an immediate `]` which is literal in many
  // dialects. Account for `[]...]` and escape sequences.
  let j = openIdx + 1;
  if (source[j] === "^") j += 1;
  if (source[j] === "]") j += 1; // Leading ] is literal
  while (j < source.length) {
    const c = source[j]!;
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === "]") return j;
    j += 1;
  }
  return -1;
}

function hasUnsafeQuantifiedAlternation(body: string): boolean {
  const alternatives = splitTopLevelAlternatives(body);
  if (alternatives.length < 2) return false;
  const tokenized = alternatives.map(tokenizeAlternative);
  if (tokenized.some((tokens) => tokens.length === 0)) return true;

  for (let i = 0; i < tokenized.length; i += 1) {
    for (let j = i + 1; j < tokenized.length; j += 1) {
      const a = tokenized[i]!;
      const b = tokenized[j]!;
      if (isTokenPrefix(a, b) || isTokenPrefix(b, a)) return true;
    }
  }
  return false;
}

function splitTopLevelAlternatives(body: string): string[] {
  const alternatives: string[] = [];
  let start = 0;
  let depth = 0;
  let inClass = false;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i]!;
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") {
      inClass = true;
      continue;
    }
    if (c === "(") {
      depth += 1;
      continue;
    }
    if (c === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (c === "|" && depth === 0) {
      alternatives.push(body.slice(start, i));
      start = i + 1;
    }
  }
  alternatives.push(body.slice(start));
  return alternatives;
}

function tokenizeAlternative(alternative: string): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < alternative.length; i += 1) {
    const c = alternative[i]!;
    if (c === "\\") {
      const end = consumeEscapedAtom(alternative, i);
      if (end === null) return tokens;
      tokens.push(alternative.slice(i, end));
      i = end - 1;
      continue;
    }
    if (c === "[") {
      const close = findCharClassClose(alternative, i);
      if (close === -1) return tokens;
      tokens.push(alternative.slice(i, close + 1));
      i = close;
      continue;
    }
    if ("(){}*+?|^$.".includes(c)) {
      return tokens;
    }
    tokens.push(c);
  }
  return tokens;
}

function isTokenPrefix(prefix: string[], candidate: string[]): boolean {
  if (prefix.length > candidate.length) return false;
  return prefix.every((token, index) => candidate[index] === token);
}
