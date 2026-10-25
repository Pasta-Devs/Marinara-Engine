// Every `[sheet: ...]` command in one reply, applied to the party's live state.
//
// The Game Master says what it wants to happen and the Engine decides whether it may: each command
// is checked against the state the ones before it left behind, applied or refused, and the tag is
// rewritten with the outcome. A refusal is kept in the reply on purpose — the narration has to be
// able to see that the spell was never cast.

import {
  RULESET_PARTY_KEY,
  rulesetPartyDefinition,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../schemas/ruleset.schema.js";
import { defaultRulesetSheetBuild, type RulesetSheetItem } from "./sheet-math.js";
import { normalizeCharacterLookupName } from "../../utils/character-lookup-name.js";
import {
  createSheetCommandTagRegex,
  joinSheetSummary,
  parseSheetCommandTagBody,
  serializeSheetCommandTag,
  type SheetCommandTagOutcome,
} from "../../utils/sheet-command-tag.js";
import {
  applyRulesetSheetOp,
  rulesetRestDiceEntries,
  rulesetRestExtraDie,
  planRulesetUse,
  type RulesetLiveState,
  type RulesetLiveStates,
  type RulesetSheetOp,
  type RulesetSheetOpResult,
} from "./live-state.js";

export interface SheetCommandCard {
  name: string;
  build: RulesetSheetBuild;
  /** What they carry, which a rest's dice read for an `itemStat` (1.337): Pell's Teapot. */
  items?: ReadonlyArray<RulesetSheetItem>;
}

export interface SheetCommandContext {
  definition: RulesetDefinition;
  /** Null means a stored party sheet could not be read. */
  partyBuild?: RulesetSheetBuild | null;
  cards: SheetCommandCard[];
  /** The player's own card, which a command that names nobody applies to. */
  playerName: string | null;
  /** Re-evaluate a saved reply after its permanent build write failed. */
  advancementRefusal?: "save-failed";
  live: RulesetLiveStates;
  /** The entries of the catalogs the party's rows point at, which the `use` command needs to know
   *  what an ability costs. Absent, every `use` is refused as naming nothing the Engine knows. */
  catalogs?: RulesetCatalogEntriesById;
  /** What a rest rolls for a condition that lowers health's maximum (1.260). Absent, its dice count
   *  their average. */
  roll?: (sides: number) => number;
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
): {
  content: string;
  live: RulesetLiveStates;
  changed: boolean;
  outcomes: SheetCommandOutcome[];
  builds: Record<string, RulesetSheetBuild>;
  /** Each rest a character took, by card name: what a rest does to the items they carry follows it. */
  rests: Array<{ who: string; rest: string }>;
} {
  const builds: Record<string, RulesetSheetBuild> = {};
  const partyDefinition = rulesetPartyDefinition(ctx.definition);
  let partyBuild =
    ctx.partyBuild === null
      ? null
      : (ctx.partyBuild ?? (partyDefinition ? defaultRulesetSheetBuild(partyDefinition) : null));
  const cards = ctx.cards.map((card) => ({ ...card }));
  const live: RulesetLiveStates = { ...ctx.live };
  const outcomes: SheetCommandOutcome[] = [];
  const rests: Array<{ who: string; rest: string }> = [];
  let changed = false;
  let seen = 0;

  const byName = new Map<string, SheetCommandCard[]>();
  for (const card of cards) {
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

  const partyExtra = (restId: string): { extra?: { sides: number; add: number } } => {
    const rest = ctx.definition.rests.find(
      (entry) => entry.id === restId || entry.label.trim().toLowerCase() === restId.trim().toLowerCase(),
    );
    let best: { sides: number; add: number } | null = null;
    for (const member of rulesetRestDiceEntries(rest?.dice).some((entry) => entry.extra) ? ctx.cards : []) {
      const extra = rulesetRestExtraDie(
        ctx.definition,
        member.build,
        rest!.id,
        member.items,
        live[normalizeCharacterLookupName(member.name)],
      );
      if (extra && (!best || extra.sides > best.sides || (extra.sides === best.sides && extra.add > best.add)))
        best = extra;
    }
    return best ? { extra: best } : {};
  };

  const applyTo = (card: SheetCommandCard, op: RulesetSheetOp): RulesetSheetOpResult => {
    const key = normalizeCharacterLookupName(card.name);
    try {
      if (op.op === "advance" && ctx.advancementRefusal) return { ok: false, reason: ctx.advancementRefusal };
      if (op.op === "use") return useOn(card, key, op);
      // Dice spent on a rest (1.335) take the party's best extra die (Song of Rest), whoever has it.
      const given = op.op === "rest" && op.dice && !op.extra ? { ...op, ...partyExtra(op.rest) } : op;
      const result = applyRulesetSheetOp(ctx.definition, card.build, live[key], given, ctx.roll, card.items);
      if (result.ok) {
        store(key, result.live);
        if (result.build) {
          card.build = result.build;
          builds[key] = result.build;
        }
      }
      if (result.ok && op.op === "rest") rests.push({ who: card.name, rest: op.rest });
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
      const tag = serializeSheetCommandTag(
        { op: parsed.op, sheet: parsed.sheet, who: named ?? parsed.who, raw: body },
        outcome,
      );
      outcomes.push({
        who,
        ok: outcome.ok,
        ...(outcome.ok ? { now: outcome.now } : { reason: outcome.reason }),
        tag,
      });
      return tag;
    };

    seen += 1;
    const named = parsed.sheet === "party" ? "party" : (parsed.who ?? ctx.playerName ?? "");
    if (seen > MAX_SHEET_COMMANDS) return record(named, { ok: false, reason: "too-many" });
    if (!parsed.op) return record(named, { ok: false, reason: "malformed" });

    if (parsed.sheet !== undefined) {
      if (parsed.sheet !== "party" || !partyDefinition || !partyBuild)
        return record("party", { ok: false, reason: "unknown-sheet" });
      if (parsed.who !== undefined) return record("party", { ok: false, reason: "malformed" });
      const op = parsed.op;
      if (op.op !== "spend" && op.op !== "restore" && !(op.op === "advance" && "field" in op))
        return record("party", { ok: false, reason: "not-allowed" });
      if (op.op === "advance" && ctx.advancementRefusal)
        return record("party", { ok: false, reason: ctx.advancementRefusal });
      let result: RulesetSheetOpResult;
      try {
        result = applyRulesetSheetOp(partyDefinition, partyBuild, live[RULESET_PARTY_KEY], op);
      } catch {
        // As applyTo: one bad command is refused, never the whole turn.
        return record("party", { ok: false, reason: "malformed" });
      }
      if (result.ok) {
        store(RULESET_PARTY_KEY, result.live);
        if (result.build) builds[RULESET_PARTY_KEY] = partyBuild = result.build;
      }
      return record("party", result);
    }

    const targets = findTargets(parsed.who);
    if ("refusal" in targets) return record(named, { ok: false, reason: targets.refusal });

    // A pool left out is health's, where the ruleset keeps health in a pool.
    const health = ctx.definition.combat?.health;
    const healthPool = health && "pool" in health ? health.pool : undefined;
    if ("pool" in parsed.op && !parsed.op.pool && !healthPool)
      return record(named, { ok: false, reason: "unknown-pool" });
    const op = "pool" in parsed.op && !parsed.op.pool ? { ...parsed.op, pool: healthPool! } : parsed.op;
    // The saved reply says which pool it was.
    parsed.op = op;
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
    return record(targets.who, { ok: true, now: joinSheetSummary(applied, undefined, refused) }, targets.who);
  });

  return { content: rewritten, live, changed, outcomes, rests, builds };
}
