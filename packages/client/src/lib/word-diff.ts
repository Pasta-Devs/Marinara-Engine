// Self-contained word-level diff for the Professor Mari "Easy Viewer" (no external diff dependency).
// Produces ordered segments describing how to turn `before` into `after`, so the UI can highlight
// removed text in red and added text in green inline.

export type DiffSegmentType = "equal" | "added" | "removed";

export interface DiffSegment {
  type: DiffSegmentType;
  value: string;
}

// Bound the O(m*n) LCS table so a pathologically large field can never freeze the tab; past this we
// fall back to a whole-value replace (the field still shows, just without intra-text highlighting).
const MAX_DIFF_CELLS = 1_000_000;

/** Split into word and whitespace runs, keeping both so the original text reconstructs exactly. */
function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

function wholeValueReplace(before: string, after: string): DiffSegment[] {
  const segments: DiffSegment[] = [];
  if (before) segments.push({ type: "removed", value: before });
  if (after) segments.push({ type: "added", value: after });
  return segments;
}

/**
 * Word-level diff via a longest-common-subsequence walk. Returns segments in reading order:
 * `equal` text is unchanged, `removed` text is only in `before`, `added` text is only in `after`.
 * Adjacent segments of the same type are merged so the result renders as few spans as possible.
 */
export function diffWords(before: string, after: string): DiffSegment[] {
  if (before === after) return before ? [{ type: "equal", value: before }] : [];
  const a = tokenize(before);
  const b = tokenize(after);
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0 || m * n > MAX_DIFF_CELLS) return wholeValueReplace(before, after);

  // dp[i][j] = LCS length of a[i:] and b[j:].
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  const push = (type: DiffSegmentType, value: string) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.value += value;
    else segments.push({ type, value });
  };

  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("removed", a[i]);
      i++;
    } else {
      push("added", b[j]);
      j++;
    }
  }
  while (i < m) push("removed", a[i++]);
  while (j < n) push("added", b[j++]);
  return segments;
}

// ── Line-level unified diff (GitHub-style) ──────────────────────────────────

export interface DiffLine {
  type: DiffSegmentType;
  text: string;
  /** Intra-line word diff, present only on a removed/added line paired with its counterpart. */
  segments?: DiffSegment[];
}

/** A run of rendered lines, preceded by `skipped` unchanged lines that are collapsed away. */
export interface DiffHunk {
  skipped: number;
  lines: DiffLine[];
}

const DEFAULT_CONTEXT_LINES = 3;

/** Below this share of unchanged text, a removed/added pair is two lines, not one edit. */
const MIN_PAIRED_LINE_SIMILARITY = 0.3;

/** "" is no lines at all, not one empty line — otherwise a create shows a phantom blank removal. */
function toLines(text: string): string[] {
  return text ? text.split("\n") : [];
}

/** LCS over whole lines. Returns lines in reading order; no intra-line detail yet. */
function lcsLines(a: string[], b: string[]): DiffLine[] {
  const m = a.length;
  const n = b.length;
  if (m * n > MAX_DIFF_CELLS) {
    return [
      ...a.map((text) => ({ type: "removed" as const, text })),
      ...b.map((text) => ({ type: "added" as const, text })),
    ];
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "equal", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: "removed", text: a[i++] });
    else out.push({ type: "added", text: b[j++] });
  }
  while (i < m) out.push({ type: "removed", text: a[i++] });
  while (j < n) out.push({ type: "added", text: b[j++] });
  return out;
}

/** Share of the two lines' text that is unchanged — how much of a rewrite this is. */
function equalShare(segments: readonly DiffSegment[]): number {
  let equal = 0;
  let total = 0;
  for (const seg of segments) {
    const length = seg.value.trim().length;
    total += length;
    if (seg.type === "equal") equal += length;
  }
  return total === 0 ? 1 : equal / total;
}

/**
 * Attach word-level segments to removed/added lines that pair up one-to-one inside a change block,
 * so a line that was edited highlights only the edited words instead of the whole line.
 */
function refineBlock(lines: DiffLine[], start: number, end: number): void {
  const removed: DiffLine[] = [];
  const added: DiffLine[] = [];
  for (let k = start; k < end; k++) {
    if (lines[k].type === "removed") removed.push(lines[k]);
    else added.push(lines[k]);
  }
  if (removed.length !== added.length) return;
  for (let k = 0; k < removed.length; k++) {
    const segments = diffWords(removed[k].text, added[k].text);
    // Two unrelated lines that happen to sit next to each other are not an edit
    // of one another; highlighting scattered shared words would invent a link.
    if (equalShare(segments) < MIN_PAIRED_LINE_SIMILARITY) continue;
    removed[k].segments = segments.filter((segment) => segment.type !== "added");
    added[k].segments = segments.filter((segment) => segment.type !== "removed");
  }
}

/**
 * Unified line diff: unchanged lines appear once as context, changed lines are marked, and runs of
 * unchanged lines longer than `contextLines * 2` collapse into a `skipped` count between hunks.
 */
export function diffLines(before: string, after: string, contextLines = DEFAULT_CONTEXT_LINES): DiffHunk[] {
  if (before === after)
    return before ? [{ skipped: 0, lines: toLines(before).map((text) => ({ type: "equal" as const, text })) }] : [];
  const lines = lcsLines(toLines(before), toLines(after));

  // Word-refine each contiguous run of changed lines.
  for (let i = 0; i < lines.length;) {
    if (lines[i].type === "equal") {
      i++;
      continue;
    }
    let j = i;
    while (j < lines.length && lines[j].type !== "equal") j++;
    refineBlock(lines, i, j);
    i = j;
  }

  // Keep `contextLines` of equal lines around every change; collapse the rest.
  const keep = new Array<boolean>(lines.length).fill(false);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type === "equal") continue;
    for (let k = Math.max(0, i - contextLines); k <= Math.min(lines.length - 1, i + contextLines); k++) keep[k] = true;
  }

  const hunks: DiffHunk[] = [];
  let skipped = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!keep[i]) {
      skipped++;
      continue;
    }
    const last = hunks[hunks.length - 1];
    if (skipped > 0 || hunks.length === 0) {
      hunks.push({ skipped, lines: [lines[i]] });
      skipped = 0;
    } else last.lines.push(lines[i]);
  }
  return hunks;
}
