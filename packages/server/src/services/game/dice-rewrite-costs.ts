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
// The place the trades were made at goes in front of them: a rewrite that left
// out the draft's place had every kept buy refused as made nowhere.
// ──────────────────────────────────────────────

import {
  createInventoryTagRegex,
  createPlaceTagRegex,
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

/** One inventory cost as a comparable key: whose bag, the action, the items and to whom, words
 *  compared without case. A tag naming nobody is the player's. The count is left out, so a rewrite
 *  that re-emits a trade with another count stands in for the draft's instead of trading twice. */
function tradeKey(body: string, playerName?: string | null): string | null {
  const parsed = parseInventoryTagBody(body);
  if (!parsed || !COST_ACTIONS.has(parsed.action)) return null;
  const plain = (value: string | undefined) => (value ?? "").trim().toLowerCase();
  return JSON.stringify([
    plain(parsed.who ?? playerName ?? ""),
    parsed.action,
    parsed.items.map(plain),
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

/** What the rewrite prompt tells the GM about the commands kept from its draft, so it neither counts
 *  on dropping one nor repeats it. The sheet wording is for games with a ruleset, whose sheet pass
 *  runs; the trades are kept in every game. */
export function rewriteKeptCommandsNote(sheets: boolean): string {
  const trades =
    "The trade and gear inventory commands of your draft (buy, sell, pay, give, equip, unequip, bind, unbind, use) are kept as written whatever the results: do not change or repeat them.";
  const sheet = sheets
    ? " The sheet spend and use commands of your draft are kept as written too. The check pass has already applied any accepted purchases and check-entry costs to the sheets: do not re-emit already-applied check-pass sheet effects or charge those costs again. Write sheet commands for new harm, healing and genuinely additional resource costs these results decide, using the rolled totals: narration alone applies none of these new consequences."
    : "";
  return ` ${trades}${sheet} Apart from these kept commands${sheets ? " and the already-applied check costs" : ""}, only commands in your revised output will execute.`;
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
  // The trades kept were made where the draft last said the scene was before them (laptop playtest
  // 2026-10-25: a rolled turn's buys refused as made nowhere, the rewrite having left the place out).
  const trades = missing.filter((tag) => /^\[inventory:/i.test(tag));
  if (trades.length > 0) {
    const last = Math.max(...trades.map((tag) => draft.lastIndexOf(tag)));
    let place: string | undefined;
    for (const match of draft.matchAll(createPlaceTagRegex())) if (match.index < last) place = match[0];
    if (place) missing.unshift(place);
  }
  return missing.length ? [...missing, ...(rewrite ? [rewrite] : [])].join("\n") : rewrite;
}
