import type { ChatBranchGraphEntry } from "@marinara-engine/shared";
import { parseChatMetadata } from "./chat-display";
import type { BranchTreeChat, BranchTreeRow } from "./chat-branch-tree";

/** Horizontal room per visible message, and for a collapsed run's "··· N ···" pill. */
export const BRANCH_GRAPH_STEP = 16;
export const BRANCH_GRAPH_GAP_WIDTH = 64;
export const BRANCH_GRAPH_LANE_HEIGHT = 28;
/** How far a roomy window may zoom a small graph in, and then spread its dots out. */
const MAX_SCALE = 2;
const MAX_STEP = 48;
/** How far a graph a little too wide for its window may shrink to fit, before it scrolls instead. */
const MIN_SCALE = 0.75;
const PAD_X = 12;
/** Messages kept visible on each side of a fork, a lane's start and a tip. */
const CONTEXT = 3;
/** Shorter runs than this stay expanded: a pill that hides five dots saves nothing. */
const MIN_GAP = 10;

export type BranchGraphLane<T extends BranchTreeChat> = {
  chat: T;
  depth: number;
  entry: ChatBranchGraphEntry | null;
  /** Index of the lane's first own message; everything before it is history it shares with its anchor. */
  start: number;
  /** Index of its latest message, or -1 when it has none of its own. */
  tip: number;
  /** One role code per own message, `start..tip`. */
  roles: string;
  /** The lane this one branches off; null for the chat at the top. */
  anchorLane: number | null;
  /**
   * Where on the anchor lane it forks: a message index, or -1 for "before the first message". The top chat
   * has one only when it was branched from a chat that left the group; that fork sits on its own lane.
   */
  forkAt: number | null;
  /** False when the drawn fork is a best guess: an older branch, a deleted parent, or copies that disagree. */
  lineageKnown: boolean;
};

/** A run of message indices the reader unfolded; it stays open even if a new fork cuts it in two. */
export type BranchGraphSpan = { from: number; to: number };

/** The room the timeline has, in pixels. */
export type BranchGraphFit = { width: number; height: number };

export type BranchGraphColumn =
  { kind: "message"; index: number; x: number } | { kind: "gap"; from: number; to: number; x: number };

export type BranchGraphLayout<T extends BranchTreeChat> = {
  lanes: BranchGraphLane<T>[];
  columns: BranchGraphColumn[];
  /** Collapsed runs, by their first index. */
  gaps: Array<{ from: number; to: number }>;
  /** Sizes and positions are in drawing units; `scale` turns them into pixels. */
  width: number;
  height: number;
  laneHeight: number;
  scale: number;
  /** x of a message index; an index inside a collapsed run sits on its pill, -1 on the start column. */
  xOf: (index: number) => number;
  laneY: (lane: number) => number;
};

/**
 * Lanes in tree order (from `buildChatBranchRows`), one shared message axis, and the columns to draw.
 *
 * Branches copy their history, so each lane draws only its own messages and joins the lane that holds
 * the fork. Long runs collapse on the shared axis rather than per lane, so a fork still lines up with
 * the message it came from. A run never contains a lane's start or tip, so every lane either spans a
 * collapsed run completely or doesn't touch it. With a `fit`, the graph uses the room it is given: the
 * more there is, the fewer runs fold; a graph that still has room left zooms in, then spreads out, and one a
 * little too wide shrinks, down to `MIN_SCALE`, before it scrolls. The lanes share the height, but never get
 * shorter than `BRANCH_GRAPH_LANE_HEIGHT`: too many of them scroll instead.
 */
export function layoutChatBranchGraph<T extends BranchTreeChat>(
  rows: readonly BranchTreeRow<T>[],
  entries: ReadonlyMap<string, ChatBranchGraphEntry>,
  expanded: readonly BranchGraphSpan[] | "all",
  fit: BranchGraphFit | null = null,
): BranchGraphLayout<T> {
  const lanes: BranchGraphLane<T>[] = [];
  const lastAtDepth: number[] = [];
  for (const [laneIndex, row] of rows.entries()) {
    const entry = entries.get(row.chat.id) ?? null;
    lastAtDepth[row.depth] = laneIndex;
    lastAtDepth.length = row.depth + 1;
    const treeParent = row.depth > 0 ? (lastAtDepth[row.depth - 1] ?? null) : null;
    const messageCount = entry?.messageCount ?? 0;

    if (treeParent === null) {
      // The top chat owns its whole transcript. If it was itself branched from a chat that has left the
      // group, the server sent roles only after its fork: the copied part is drawn as unknown.
      const ownRoles = entry?.roles ?? "";
      const ownFork = entry?.forkIndex ?? null;
      lanes.push({
        chat: row.chat,
        depth: row.depth,
        entry,
        start: 0,
        tip: messageCount - 1,
        roles: "?".repeat(Math.max(0, messageCount - ownRoles.length)) + ownRoles,
        anchorLane: null,
        forkAt: ownFork !== null && ownFork >= 0 ? ownFork : null,
        lineageKnown: true,
      });
      continue;
    }

    // The tree flattens a branch whose parent is gone under the top chat; it is drawn there, dashed.
    const realParent = lanes[treeParent]!.chat.id === readParentChatId(row.chat);
    const forkIndex = entry?.forkIndex ?? null;
    // The branch's lane starts after its own copy of the fork, so that copy places it. The parent's index
    // for the same message only confirms it: a delete above the fork in either chat makes them disagree.
    const forkAt = forkIndex ?? -1;
    const lineageKnown = forkIndex !== null && realParent && entry?.parentForkIndex === forkIndex;
    // A fork inside history the parent copied belongs on the lane that actually holds that message.
    let anchorLane = treeParent;
    while (forkAt >= 0 && lanes[anchorLane]!.start > forkAt && lanes[anchorLane]!.anchorLane !== null) {
      anchorLane = lanes[anchorLane]!.anchorLane!;
    }
    const start = forkIndex === null ? 0 : forkIndex + 1;
    lanes.push({
      chat: row.chat,
      depth: row.depth,
      entry,
      start,
      tip: messageCount - 1,
      roles: entry?.roles ?? "",
      anchorLane,
      forkAt,
      lineageKnown,
    });
  }

  const maxIndex = Math.max(0, ...lanes.map((lane) => Math.max(lane.tip, lane.start)));
  const kept = new Set<number>();
  const keep = (index: number) => {
    for (let offset = -CONTEXT; offset <= CONTEXT; offset += 1) {
      const near = index + offset;
      if (near >= 0 && near <= maxIndex) kept.add(near);
    }
  };
  keep(0);
  for (const lane of lanes) {
    keep(lane.start);
    if (lane.tip >= 0) keep(lane.tip);
    if (lane.forkAt !== null && lane.forkAt >= 0) keep(lane.forkAt);
  }

  // Runs no fork, start or tip comes near. Short ones, and ones the reader opened, always show.
  const runs: BranchGraphSpan[] = [];
  for (let index = 0; index <= maxIndex;) {
    if (kept.has(index)) {
      index += 1;
      continue;
    }
    let to = index;
    while (to + 1 <= maxIndex && !kept.has(to + 1)) to += 1;
    const opened = expanded === "all" || expanded.some((span) => span.from <= to && span.to >= index);
    if (to - index + 1 >= MIN_GAP && !opened) runs.push({ from: index, to });
    index = to + 1;
  }

  // Given room, unfold the shortest runs first, as many as fit, then spread the dots over what is left.
  const startColumn = lanes.some((lane) => lane.forkAt === -1);
  const slots = (folded: readonly BranchGraphSpan[]) =>
    maxIndex + 1 + (startColumn ? 1 : 0) - folded.reduce((sum, run) => sum + run.to - run.from + 1, 0);
  const widthAt = (step: number, folded: readonly BranchGraphSpan[]) =>
    2 * PAD_X + slots(folded) * step + folded.length * BRANCH_GRAPH_GAP_WIDTH;
  let folded = runs;
  let step = BRANCH_GRAPH_STEP;
  let laneHeight = BRANCH_GRAPH_LANE_HEIGHT;
  let scale = 1;
  if (fit) {
    const stillFolded = [...runs].sort((a, b) => a.to - a.from - (b.to - b.from));
    while (stillFolded.length > 0 && widthAt(BRANCH_GRAPH_STEP, stillFolded.slice(1)) <= fit.width) {
      stillFolded.shift();
    }
    folded = runs.filter((run) => stillFolded.includes(run));
    // Shrink a graph a little too wide to fit, or zoom a small one in as a whole; then spread its dots over the
    // width that is left, and its lanes over the height, down to their base height.
    const lanesAt = Math.max(1, lanes.length);
    const widthRatio = fit.width / widthAt(BRANCH_GRAPH_STEP, folded);
    const heightRatio = fit.height / (lanesAt * BRANCH_GRAPH_LANE_HEIGHT);
    scale = widthRatio < 1 ? Math.max(MIN_SCALE, widthRatio) : clamp(Math.min(widthRatio, heightRatio), 1, MAX_SCALE);
    const room = fit.width / scale - 2 * PAD_X - folded.length * BRANCH_GRAPH_GAP_WIDTH;
    step = clamp(Math.floor(room / slots(folded)), BRANCH_GRAPH_STEP, MAX_STEP);
    laneHeight = Math.max(BRANCH_GRAPH_LANE_HEIGHT, Math.floor(fit.height / scale / lanesAt));
  }
  const foldedFrom = new Map(folded.map((run) => [run.from, run]));

  const columns: BranchGraphColumn[] = [];
  const gaps: Array<{ from: number; to: number }> = [];
  const positions = new Array<number>(maxIndex + 1);
  let x = PAD_X;
  const startX = x + step / 2;
  if (startColumn) x += step;
  for (let index = 0; index <= maxIndex;) {
    const run = foldedFrom.get(index);
    if (!run) {
      positions[index] = x + step / 2;
      columns.push({ kind: "message", index, x: positions[index]! });
      x += step;
      index += 1;
      continue;
    }
    const center = x + BRANCH_GRAPH_GAP_WIDTH / 2;
    for (let hidden = run.from; hidden <= run.to; hidden += 1) positions[hidden] = center;
    columns.push({ kind: "gap", from: run.from, to: run.to, x: center });
    gaps.push({ from: run.from, to: run.to });
    x += BRANCH_GRAPH_GAP_WIDTH;
    index = run.to + 1;
  }

  return {
    lanes,
    columns,
    gaps,
    width: x + PAD_X,
    height: lanes.length * laneHeight,
    laneHeight,
    scale,
    xOf: (index) => (index < 0 ? startX : (positions[Math.min(index, maxIndex)] ?? startX)),
    laneY: (lane) => lane * laneHeight + laneHeight / 2,
  };
}

/** Whether a lane draws a collapsed run's pill: runs never hold a lane's start or tip, so it's all or nothing. */
export function laneSpansGap(lane: { start: number; tip: number }, gap: { from: number; to: number }) {
  return lane.start <= gap.from && lane.tip >= gap.to;
}

function readParentChatId(chat: BranchTreeChat): string | null {
  const value = parseChatMetadata(chat.metadata).branchParentChatId;
  return typeof value === "string" && value.trim() ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
