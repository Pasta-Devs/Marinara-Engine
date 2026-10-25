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
// command it wrote, unless the rewrite already carries the same command. So are
// its trades and handling of gear: a buy, a sale, a payment, a gift, gear worn
// or bound, an item used (a rewrite dropped a whole shopping trip the same day,
// and the player was never told). An item found or coin earned is the dice's.
// ──────────────────────────────────────────────

import {
  createInventoryTagRegex,
  createSheetCommandTagRegex,
  parseInventoryTagBody,
  parseSheetCommandTagBody,
} from "@marinara-engine/shared";

/** The sheet ops that pay for doing something, which the dice outcome cannot take back. */
const COST_OPS = new Set(["spend", "use"]);
/** The inventory actions a character chooses, which the dice outcome does not decide. */
const COST_ACTIONS = new Set(["buy", "sell", "pay", "give", "equip", "unequip", "bind", "unbind", "use"]);

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

/** One inventory cost as a comparable key: whose bag, the action, the items and the count, words
 *  compared without case. A tag naming nobody is the player's. */
function tradeKey(body: string, playerName?: string | null): string | null {
  const parsed = parseInventoryTagBody(body);
  if (!parsed || !COST_ACTIONS.has(parsed.action)) return null;
  const plain = (value: string | undefined) => (value ?? "").trim().toLowerCase();
  return JSON.stringify([
    plain(parsed.who ?? playerName ?? ""),
    parsed.action,
    parsed.items.map(plain),
    parsed.count,
    plain(parsed.to),
  ]);
}

/** Every cost tag in `text` with its key, in order: sheet costs, then inventory ones. */
function costTags(text: string, playerName?: string | null, sheets = true): Array<{ tag: string; key: string }> {
  const read = (regex: RegExp, keyOf: (body: string) => string | null) =>
    [...text.matchAll(regex)].flatMap((match) => {
      const key = keyOf(match[1] ?? "");
      return key ? [{ tag: match[0], key }] : [];
    });
  return [
    ...(sheets ? read(createSheetCommandTagRegex(), (body) => costKey(body, playerName)) : []),
    ...read(createInventoryTagRegex(), (body) => tradeKey(body, playerName)),
  ];
}

/** The draft's `spend` and `use` sheet tags and its trade inventory tags, as written. */
export function draftCostTags(draft: string): string[] {
  return costTags(draft).map((entry) => entry.tag);
}

/**
 * The rewrite with every cost its draft wrote and it left out put back in front, each on its own line.
 * A cost the rewrite repeats is kept once: one of the draft's is matched by one of the rewrite's, a
 * command naming nobody standing for `playerName`, the player the sheet pass applies it to. Without
 * `sheets` (a game with no ruleset, where no sheet pass runs) only trades are kept.
 */
export function keepDraftCosts(draft: string, rewrite: string, playerName?: string | null, sheets = true): string {
  const carried = new Map<string, number>();
  for (const { key } of costTags(rewrite, playerName, sheets)) carried.set(key, (carried.get(key) ?? 0) + 1);
  const missing: string[] = [];
  for (const { tag, key } of costTags(draft, playerName, sheets)) {
    const left = carried.get(key) ?? 0;
    if (left > 0) carried.set(key, left - 1);
    else missing.push(tag);
  }
  return missing.length ? [...missing, ...(rewrite ? [rewrite] : [])].join("\n") : rewrite;
}
