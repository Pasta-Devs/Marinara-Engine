// ──────────────────────────────────────────────
// Game: what a dice rewrite may not drop
//
// A Game turn that rolls dice is written twice: the GM's draft asks for the
// checks, the engine rolls them, and the GM rewrites its narration around the
// real results. Only the commands in the rewrite execute, so a command the
// rewrite leaves out is never applied. That is right for a consequence the dice
// decide (harm, healing), and wrong for what the character spent to act at all:
// a druid's Wild Shape or a bard's Inspiration is spent whatever the roll says
// (laptop playtest 2026-10-25: a rewrite kept the two condition tags and dropped
// both spends). So the draft's costs are kept: every `spend` and `use` sheet
// command it wrote, unless the rewrite already carries the same command.
// ──────────────────────────────────────────────

import { createSheetCommandTagRegex, parseSheetCommandTagBody } from "@marinara-engine/shared";

/** The sheet ops that pay for doing something, which the dice outcome cannot take back. */
const COST_OPS = new Set(["spend", "use"]);

/** One cost command as a comparable key: whose sheet and the op, words compared without case. A
 *  command that names nobody is the player's, as the sheet pass reads it. One on another sheet (the
 *  party's) keeps whom it names apart, since the sheet pass refuses a party command that names
 *  anybody: that one never stands in for the draft's. */
function costKey(body: string, playerName?: string | null): string | null {
  const parsed = parseSheetCommandTagBody(body);
  if (!parsed.op || !COST_OPS.has(parsed.op.op)) return null;
  const plain = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : value);
  return JSON.stringify([
    plain(parsed.sheet !== undefined ? (parsed.who ?? "") : (parsed.who ?? playerName ?? "")),
    plain(parsed.sheet ?? ""),
    Object.entries(parsed.op)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, plain(value)]),
  ]);
}

/** The draft's `spend` and `use` sheet tags, as written. */
export function draftCostTags(draft: string): string[] {
  return [...draft.matchAll(createSheetCommandTagRegex())]
    .filter((match) => costKey(match[1] ?? "") !== null)
    .map((match) => match[0]);
}

/**
 * The rewrite with every cost its draft wrote and it left out put back in front, each on its own line.
 * A cost the rewrite repeats is kept once: one of the draft's is matched by one of the rewrite's, a
 * command naming nobody standing for `playerName`, the player the sheet pass applies it to.
 */
export function keepDraftCosts(draft: string, rewrite: string, playerName?: string | null): string {
  const carried = new Map<string, number>();
  for (const match of rewrite.matchAll(createSheetCommandTagRegex())) {
    const key = costKey(match[1] ?? "", playerName);
    if (key) carried.set(key, (carried.get(key) ?? 0) + 1);
  }
  const missing: string[] = [];
  for (const tag of draftCostTags(draft)) {
    const key = costKey(tag.slice("[sheet:".length, -1), playerName)!;
    const left = carried.get(key) ?? 0;
    if (left > 0) carried.set(key, left - 1);
    else missing.push(tag);
  }
  return missing.length ? [...missing, ...(rewrite ? [rewrite] : [])].join("\n") : rewrite;
}
