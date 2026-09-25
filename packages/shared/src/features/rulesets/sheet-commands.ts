// Every `[sheet: ...]` command in one reply, applied to the party's live state.
//
// The Game Master says what it wants to happen and the Engine decides whether it may: each command
// is checked against the state the ones before it left behind, applied or refused, and the tag is
// rewritten with the outcome. A refusal is kept in the reply on purpose — the narration has to be
// able to see that the spell was never cast.

import type { RulesetCatalogEntriesById, RulesetDefinition, RulesetSheetBuild } from "../../schemas/ruleset.schema.js";
import { normalizeCharacterLookupName } from "../../utils/character-lookup-name.js";
import {
  createSheetCommandTagRegex,
  parseSheetCommandTagBody,
  serializeSheetCommandTag,
  SHEET_COMMAND_NOW_MAX_LENGTH,
  truncateSheetSummary,
  type SheetCommandTagOutcome,
} from "../../utils/sheet-command-tag.js";
import {
  applyRulesetSheetOp,
  planRulesetUse,
  type RulesetLiveState,
  type RulesetLiveStates,
  type RulesetSheetOp,
  type RulesetSheetOpResult,
} from "./live-state.js";

export interface SheetCommandCard {
  name: string;
  build: RulesetSheetBuild;
}

export interface SheetCommandContext {
  definition: RulesetDefinition;
  cards: SheetCommandCard[];
  /** The player's own card, which a command that names nobody applies to. */
  playerName: string | null;
  live: RulesetLiveStates;
  /** The entries of the catalogs the party's rows point at, which the `use` command needs to know
   *  what an ability costs. Absent, every `use` is refused as naming nothing the Engine knows. */
  catalogs?: RulesetCatalogEntriesById;
}

export interface SheetCommandOutcome {
  who: string;
  ok: boolean;
  reason?: string;
  now?: string;
  /** The tag as it was written back into the reply. */
  tag: string;
}

/** One reply's worth of bookkeeping. Past this, a model is looping rather than narrating. */
const MAX_SHEET_COMMANDS = 40;
/** The word that addresses the whole party at once. */
const PARTY_TARGET = "party";
/** A party summary is capped again by the tag writer; this keeps the join itself bounded. */

type TargetMatch =
  { cards: SheetCommandCard[]; who: string } | { refusal: "unknown-character" | "ambiguous-character" };

/** Apply every sheet command in a reply, in order, and rewrite each tag with what happened.
 *  Pure: the context and its live state are never mutated, and nothing here throws. */
export function applySheetCommandTags(
  content: string,
  ctx: SheetCommandContext,
): { content: string; live: RulesetLiveStates; changed: boolean; outcomes: SheetCommandOutcome[] } {
  const live: RulesetLiveStates = { ...ctx.live };
  const outcomes: SheetCommandOutcome[] = [];
  let changed = false;
  let seen = 0;

  const byName = new Map<string, SheetCommandCard[]>();
  for (const card of ctx.cards) {
    const key = normalizeCharacterLookupName(card.name);
    const group = byName.get(key);
    if (group) group.push(card);
    else byName.set(key, [card]);
  }
  const playerKey = ctx.playerName ? normalizeCharacterLookupName(ctx.playerName) : null;
  const playerCard = (playerKey !== null ? byName.get(playerKey)?.[0] : undefined) ?? null;

  const findTargets = (who: string | undefined): TargetMatch => {
    if (who === undefined)
      return playerCard ? { cards: [playerCard], who: playerCard.name } : { refusal: "unknown-character" };
    const key = normalizeCharacterLookupName(who);
    if (key === PARTY_TARGET) {
      // One card per live-state key. Two cards under one name share one entry, so applying to both
      // would charge that character twice for one command. The same tie rule as a named target:
      // the player's own card stands for a name it shares, and any other shared name is left out
      // because the game cannot tell whose sheet it would be.
      const members = [...byName.entries()].flatMap(([groupKey, group]) =>
        group.length === 1 || groupKey === playerKey ? [group[0]!] : [],
      );
      return members.length > 0 ? { cards: members, who: PARTY_TARGET } : { refusal: "unknown-character" };
    }
    const group = byName.get(key) ?? [];
    if (group.length === 0) return { refusal: "unknown-character" };
    // Two cards under one name: only the player's own card breaks the tie, because that is the one
    // the game knows it has. Anything else would be picking a character at random.
    if (group.length > 1) {
      return key === playerKey && playerCard
        ? { cards: [playerCard], who: playerCard.name }
        : { refusal: "ambiguous-character" };
    }
    return { cards: [group[0]!], who: group[0]!.name };
  };

  const store = (key: string, state: RulesetLiveState) => {
    if (Object.keys(state).length > 0) live[key] = state;
    else delete live[key];
    changed = true;
  };

  // `use` is several spends at once, so it is all or nothing: every step goes onto a working copy
  // and the first refusal refuses the whole command, with the sheet exactly as it was.
  const useOn = (card: SheetCommandCard, key: string, op: Extract<RulesetSheetOp, { op: "use" }>) => {
    const plan = planRulesetUse(ctx.definition, card.build, live[key], ctx.catalogs ?? {}, op);
    if (!plan.ok) return { ok: false, reason: plan.reason } as const;
    let state = live[key] as RulesetLiveState | undefined;
    const paid: string[] = [];
    for (const step of plan.steps) {
      const result = applyRulesetSheetOp(ctx.definition, card.build, state, step.op);
      if (!result.ok) return result;
      state = result.live;
      paid.push(`${step.label} ${result.now}`);
    }
    // An ability that costs nothing, such as a cantrip or a passive feature, is fine and changes
    // nothing: it is the Game Master saying what happened, not asking to spend.
    if (!state || paid.length === 0) return { ok: true, live: {}, now: `${plan.label}: no cost` } as const;
    store(key, state);
    return { ok: true, live: state, now: paid.join(", ") } as const;
  };

  const applyTo = (card: SheetCommandCard, op: RulesetSheetOp): RulesetSheetOpResult => {
    const key = normalizeCharacterLookupName(card.name);
    try {
      if (op.op === "use") return useOn(card, key, op);
      const result = applyRulesetSheetOp(ctx.definition, card.build, live[key], op);
      if (result.ok) store(key, result.live);
      return result;
    } catch {
      // A turn is never lost to its bookkeeping; an impossible command is simply refused.
      return { ok: false, reason: "malformed" };
    }
  };

  const rewritten = content.replace(createSheetCommandTagRegex(), (_match, rawBody: string) => {
    const body = rawBody ?? "";
    const parsed = parseSheetCommandTagBody(body);
    // Once the target is known the tag says so, even where the Game Master left it implied: the
    // saved reply is the record, and "who did this happen to" is the first thing it has to answer.
    const record = (who: string, outcome: SheetCommandTagOutcome, named?: string): string => {
      const tag = serializeSheetCommandTag({ op: parsed.op, who: named ?? parsed.who, raw: body }, outcome);
      outcomes.push({
        who,
        ok: outcome.ok,
        ...(outcome.ok ? { now: outcome.now } : { reason: outcome.reason }),
        tag,
      });
      return tag;
    };

    seen += 1;
    const named = parsed.who ?? ctx.playerName ?? "";
    if (seen > MAX_SHEET_COMMANDS) return record(named, { ok: false, reason: "too-many" });
    if (!parsed.op) return record(named, { ok: false, reason: "malformed" });

    const targets = findTargets(parsed.who);
    if ("refusal" in targets) return record(named, { ok: false, reason: targets.refusal });

    const op = parsed.op;
    const results = targets.cards.map((card) => ({ card, result: applyTo(card, op) }));
    // One target reads as the value alone; a party tag has to say whose value each one is.
    const many = results.length > 1;
    const applied = results.flatMap((entry) =>
      entry.result.ok ? [many ? `${entry.card.name} ${entry.result.now}` : entry.result.now] : [],
    );
    // A party command can work for some members and not for others (a spend only some can afford).
    // The record names the ones it was refused for too, or the saved reply would read as if it had
    // applied to everyone.
    const refused = results.flatMap((entry) =>
      entry.result.ok ? [] : [`${entry.card.name} refused (${entry.result.reason})`],
    );
    if (applied.length === 0) {
      const first = results.find((entry) => !entry.result.ok);
      return record(
        targets.who,
        { ok: false, reason: first && !first.result.ok ? first.result.reason : "malformed" },
        targets.who,
      );
    }
    return record(
      targets.who,
      { ok: true, now: truncateSheetSummary([...applied, ...refused].join("; "), SHEET_COMMAND_NOW_MAX_LENGTH) },
      targets.who,
    );
  });

  return { content: rewritten, live, changed, outcomes };
}
