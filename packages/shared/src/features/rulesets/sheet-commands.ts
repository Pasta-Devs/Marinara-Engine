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
import { rulesetMaterialFor } from "./material.js";
import { normalizeCharacterLookupName, uniqueCharacterKeyFor } from "../../utils/character-lookup-name.js";
import {
  createSheetCommandTagRegex,
  joinSheetSummary,
  parseSheetCommandTagBody,
  serializeSheetCommandTag,
  type SheetCommandTagOutcome,
} from "../../utils/sheet-command-tag.js";
import { createInventoryTagRegex, parseInventoryTagBody } from "../../utils/inventory-command-tag.js";
import {
  applyRulesetRestRecoveries,
  applyRulesetSheetOp,
  rulesetRestDiceEntries,
  rulesetRestRecoveries,
  rulesetRestExtraDie,
  planRulesetUse,
  type RulesetLiveState,
  type RulesetLiveStates,
  type RulesetSheetOp,
  type RulesetSheetOpResult,
  rulesetUseHealOutsideFight,
  rulesetUseKeptCall,
  rulesetUseKeptForm,
  rulesetPoolNowText,
  rulesetPoolKeyNamed,
  rulesetRecoveriesOfGroup,
  rulesetRestOnlyPool,
  readRulesetLive,
} from "./live-state.js";
import { rulesetSheetDead } from "./combat-bridge.js";
import { applyRulesetPrepare, rulesetPreparableEntry } from "./prepare.js";
import type { RulesetBuilderState } from "./sheet-builder.js";

/** A priced material a cast used up (1.790): whose, and how many out of which of their stacks. */
export interface RulesetMaterialTaken {
  who: string;
  stacks: Array<{ id: string; count: number }>;
}

export interface SheetCommandCard {
  name: string;
  build: RulesetSheetBuild;
  /** What they carry, which a rest's dice read for an `itemStat` (1.337): Pell's Teapot. */
  items?: ReadonlyArray<RulesetSheetItem>;
  /** The sheet's builder choices, whose picks say what its later steps offer: what a `prepare` may
   *  add. Absent, what the sheet holds stands in for them. */
  builder?: RulesetBuilderState;
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
  /** The cards of those no longer with the party (taken out of it, their card kept): a command to
   *  the whole party passes them by, as it does the dead. Named, they are still found. */
  away?: readonly string[];
  /** Whether an item the reply uses (`[inventory: action="use"]`), by the name it gives, heals
   *  whoever uses it. The Engine heals them with that use once the sheet commands are done, so a
   *  restore of their health beside it is not paid again. Absent, no item is known to heal. */
  itemHealsUser?: (item: string) => boolean;
  /** The game's clock as the reply's turn began, in minutes from its start: a rest of a kind taken
   *  with none of it passed since the last is refused. Absent where the game keeps none. */
  clock?: number;
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
  /** The priced materials a cast used up (1.790), by card name and the stacks they came out of. */
  materials: RulesetMaterialTaken[];
} {
  const builds: Record<string, RulesetSheetBuild> = {};
  const partyDefinition = rulesetPartyDefinition(ctx.definition);
  let partyBuild =
    ctx.partyBuild === null
      ? null
      : (ctx.partyBuild ?? (partyDefinition ? defaultRulesetSheetBuild(partyDefinition) : null));
  const cards = ctx.cards.map((card) => ({ ...card }));
  const live: RulesetLiveStates = { ...ctx.live };
  // The rests the reply before this one took (laptop playtest 2026-10-26: two long rests written in
  // back-to-back turns), no longer this reply's own once it is read.
  const restedBefore = new Map<string, Set<string>>();
  for (const [key, state] of Object.entries(live)) {
    const fresh = Object.entries(state.rested ?? {}).filter(([, rested]) => rested.fresh);
    if (fresh.length === 0) continue;
    restedBefore.set(key, new Set(fresh.map(([rest]) => rest)));
    // What is left of each is the clock's minute, where the game keeps one.
    const kept = Object.entries(state.rested!).flatMap(([rest, { at }]) => (at === undefined ? [] : [[rest, { at }]]));
    const { rested: _rested, ...rest } = state;
    if (kept.length > 0) live[key] = { ...rest, rested: Object.fromEntries(kept) };
    else if (Object.keys(rest).length > 0) live[key] = rest;
    else delete live[key];
  }
  /** Whether a rest of this kind was taken already in this reply or the one before, or with no time
   *  passed on the game's clock since. */
  const restedAlready = (key: string, rest: string): boolean => {
    if (restedBefore.get(key)?.has(rest)) return true;
    const last = live[key]?.rested?.[rest];
    if (!last) return false;
    if (last.fresh) return true;
    if (ctx.clock === undefined || last.at === undefined) return false;
    // So many hours of the game's clock from the last one's start, where the ruleset says (1.810).
    const every = ctx.definition.rests.find((entry) => entry.id === rest)?.every;
    return every !== undefined ? ctx.clock - last.at < every * 60 : ctx.clock <= last.at;
  };
  const restNamed = (name: string) =>
    ctx.definition.rests.find(
      (entry) =>
        entry.id.toLowerCase() === name.trim().toLowerCase() ||
        entry.label.trim().toLowerCase() === name.trim().toLowerCase(),
    );
  const outcomes: SheetCommandOutcome[] = [];
  const rests: Array<{ who: string; rest: string }> = [];
  const materials: RulesetMaterialTaken[] = [];
  /** What each card's casts have used up this reply, by place in its items. */
  const usedUp = new Map<string, Record<string, number>>();
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

  const away = new Set((ctx.away ?? []).map((name) => normalizeCharacterLookupName(name)));
  const deadOnSheet = (card: SheetCommandCard): boolean =>
    rulesetSheetDead(ctx.definition, card.build, live[normalizeCharacterLookupName(card.name)], card.items);
  const findTargets = (who: string | undefined): TargetMatch => {
    if (who === undefined)
      return playerCard ? { cards: [playerCard], who: playerCard.name } : { refusal: "unknown-character" };
    const key = normalizeCharacterLookupName(who);
    if (key === PARTY_TARGET) {
      // One card per live-state key. Two cards under one name share one entry, so applying to both
      // would charge that character twice for one command. The same tie rule as a named target:
      // the player's own card stands for a name it shares, and any other shared name is left out
      // because the game cannot tell whose sheet it would be.
      // Nor anyone gone from the party or dead on their sheet (laptop pass 6, 2026-10-26: a party
      // long rest put two fallen companions back on their feet, death saves cleared).
      const members = [...byName.entries()].flatMap(([groupKey, group]) =>
        (group.length === 1 || groupKey === playerKey) && !away.has(groupKey) && !deadOnSheet(group[0]!)
          ? [group[0]!]
          : [],
      );
      return members.length > 0 ? { cards: members, who: PARTY_TARGET } : { refusal: "unknown-character" };
    }
    // A shorter name only one card answers to, or the name with a nickname written inside it, as a
    // check's `who=` is read (cheap-GM playtest 2026-10-26: a short rest for
    // `who="Marigold "Mars" Thimblewick"` was refused as nobody).
    const shortKey = byName.has(key) ? key : uniqueCharacterKeyFor(byName.keys(), who);
    const group = byName.get(shortKey ?? key) ?? [];
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

  // A use the Engine cannot price, because what it names is not on the sheet, still pays the pool it
  // names, by `pool=` or as its name (cheap-GM playtest 2026-10-26: Invisibility and Pass without
  // Trace written with `pool="spell_slots_2"` were refused, so the spells cost nothing). One of it,
  // never health, and never for a ritual, which pays none.
  const payNamedPool = (
    card: SheetCommandCard,
    key: string,
    op: Extract<RulesetSheetOp, { op: "use" }>,
  ): RulesetSheetOpResult | null => {
    if (op.ritual) return null;
    const health = ctx.definition.combat?.health;
    const healthPool = health && "pool" in health ? health.pool : undefined;
    for (const named of [op.pool, op.name]) {
      if (!named?.trim()) continue;
      const pool = rulesetPoolKeyNamed(ctx.definition, card.build, live[key], named, card.items);
      if (!pool || pool === healthPool) continue;
      const result = applyRulesetSheetOp(
        ctx.definition,
        card.build,
        live[key],
        { op: "spend", pool, amount: 1 },
        ctx.roll,
        card.items,
      );
      if (!result.ok) return result;
      store(key, result.live);
      const paid = `${named.trim()} ${result.now}`;
      return { ...result, now: named === op.name ? paid : `${op.name.trim()} (not on the sheet): ${paid}` };
    }
    return null;
  };

  // `use` is several spends at once, so it is all or nothing: every step goes onto a working copy
  // and the first refusal refuses the whole command, with the sheet exactly as it was.
  const useOn = (card: SheetCommandCard, key: string, op: Extract<RulesetSheetOp, { op: "use" }>) => {
    const plan = planRulesetUse(ctx.definition, card.build, live[key], ctx.catalogs ?? {}, op);
    if (!plan.ok) {
      if (plan.reason !== "unknown-entry") return { ok: false, reason: plan.reason } as const;
      const paid = payNamedPool(card, key, op);
      if (paid) return paid;
      // Not on the sheet, but one it could prepare (playtest 2026-10-26: a cleric's ritual Detect
      // Magic, swapped in for Sanctuary in the story with no command, refused as nothing known).
      const preparable = rulesetPreparableEntry(ctx.definition, card.build, ctx.catalogs ?? {}, op.name, card.builder);
      return preparable
        ? ({
            ok: false,
            reason: `not-prepared: ${preparable} is not on ${card.name}'s sheet; prepare it first, with op=prepare name=${preparable}`,
          } as const)
        : ({ ok: false, reason: "unknown-entry" } as const);
    }
    // The creature a call that stays calls (1.798), named before anything is paid for it.
    const kept = rulesetUseKeptCall(ctx.definition, card.build, ctx.catalogs ?? {}, op);
    if (kept && !kept.ok) return kept;
    // The shape one that changes its user's own keeps them in (1.801), named the same way.
    const shaped = rulesetUseKeptForm(ctx.definition, card.build, ctx.catalogs ?? {}, op, live[key], card.items);
    if (shaped && !shaped.ok) return shaped;
    // A priced material (1.790) carried, and taken only once everything else is paid.
    const used = usedUp.get(key) ?? {};
    const material = plan.material ? rulesetMaterialFor(ctx.definition, plan.material, card.items, used) : undefined;
    if (material === null) return { ok: false, reason: `no-material: ${plan.material!.label}` } as const;
    let state = live[key] as RulesetLiveState | undefined;
    const paid: string[] = [];
    for (const step of plan.steps) {
      const result = applyRulesetSheetOp(ctx.definition, card.build, state, step.op, ctx.roll, card.items);
      if (!result.ok) return result;
      state = result.live;
      paid.push(`${step.label} ${result.now}`);
    }
    // What it heals its user outside a fight (1.788): Second Wind's 1d10 plus the fighter's level.
    const healed = rulesetUseHealOutsideFight(
      ctx.definition,
      card.build,
      ctx.catalogs ?? {},
      op.name,
      state ?? live[key],
      ctx.roll,
      card.items,
    );
    if (healed && !healed.ok && healed.reason !== "cannot-heal") return healed;
    if (healed?.ok) {
      state = healed.live;
      paid.push(`${plan.label} ${healed.now}`);
    }
    if (material && plan.material?.consumed) {
      const stacks = material.flatMap(({ index, count }) => {
        const stack = card.items?.[index]?.stack;
        used[index] = (used[index] ?? 0) + count;
        return stack ? [{ id: stack.id, count }] : [];
      });
      usedUp.set(key, used);
      materials.push({ who: card.name, stacks });
      paid.push(`${plan.material.label} used up`);
    }
    // Kept on the sheet (1.798), in place of whatever it called before: it joins every fight its
    // user is in until it is dismissed or killed.
    if (kept) {
      const before = (state ?? live[key] ?? {}) as RulesetLiveState;
      state = { ...before, called: { ...before.called, [kept.entry]: kept.as } };
      paid.push(`${kept.as || plan.label} called, and stays`);
    }
    // Kept on the sheet too (1.801), in place of any shape before it: they start every fight in it
    // until it ends, with the form's own health.
    if (shaped) {
      state = { ...((state ?? live[key] ?? {}) as RulesetLiveState), shaped: shaped.shaped };
      paid.push(`in the shape of ${shaped.shaped.as}`);
    }
    // An ability that costs nothing, such as a cantrip or a passive feature, is fine and changes
    // nothing: it is the Game Master saying what happened, not asking to spend.
    // A ritual says so, and that it takes a ritual's longer time (laptop 2026-10-26).
    if (op.ritual) paid.unshift(`${plan.label} cast as a ritual, at no cost, taking the longer time a ritual takes`);
    if (paid.length === 0) return { ok: true, live: {}, now: `${plan.label}: no cost` } as const;
    // Only a material used up, on a sheet with nothing live yet.
    if (!state) return { ok: true, live: {}, now: paid.join(", ") } as const;
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

  // A feature the rest offers as it ends (1.789), named on the tag: the rest stands whatever it does,
  // and its words say what the feature gave back or why it gave nothing.
  const restEnds = (
    card: SheetCommandCard,
    op: Extract<RulesetSheetOp, { op: "rest" }>,
    rested: Extract<RulesetSheetOpResult, { ok: true }>,
  ): RulesetSheetOpResult => {
    const rest = ctx.definition.rests.find(
      (entry) => entry.id === op.rest || entry.label.trim().toLowerCase() === op.rest.trim().toLowerCase(),
    );
    const wanted = op.use!.trim().toLowerCase();
    const offer = rest
      ? rulesetRestRecoveries(ctx.definition, card.build, rested.live, ctx.catalogs ?? {}, rest.id).find(
          (one) => one.name.trim().toLowerCase() === wanted,
        )
      : undefined;
    if (!rest || !offer) return { ...rested, now: `${rested.now}; ${op.use}: nothing it can give back now` };
    const used = applyRulesetRestRecoveries(
      ctx.definition,
      card.build,
      rested.live,
      ctx.catalogs ?? {},
      rest.id,
      [{ name: offer.name, recover: op.recover?.length ? [...op.recover] : offer.picks }],
      ctx.roll,
      card.items,
    );
    if (!used.ok) return { ...rested, now: `${rested.now}; ${offer.name} refused: ${used.reason}` };
    return { ...rested, live: (used.live ?? {}) as RulesetLiveState, now: [rested.now, ...used.now].join("; ") };
  };

  // The pools each character's rest in this reply healed with its dice, by rest label: a restore of
  // one written after it is left to the rest (cheap-GM playtest 2026-10-26: a sorcerer healed by his
  // Hit Dice and again by a 2d6+2 restore the Game Master wrote beside the short rest).
  const restHeals = new Map<string, Array<{ rest: string; pools: Set<string> }>>();
  const applyTo = (card: SheetCommandCard, op: RulesetSheetOp): RulesetSheetOpResult => {
    const key = normalizeCharacterLookupName(card.name);
    try {
      // A prepare edits the build as an advance does, and is refused with it when the build cannot be saved.
      if ((op.op === "advance" || op.op === "prepare" || op.op === "unprepare") && ctx.advancementRefusal)
        return { ok: false, reason: ctx.advancementRefusal };
      if (op.op === "use") return useOn(card, key, op);
      const rest = op.op === "rest" ? restNamed(op.rest) : undefined;
      if (rest && restedAlready(key, rest.id)) return { ok: false, reason: "rested-already" };
      // Dice spent on a rest (1.335) take the party's best extra die (Song of Rest), whoever has it.
      const given = op.op === "rest" && op.dice && !op.extra ? { ...op, ...partyExtra(op.rest) } : op;
      let result: RulesetSheetOpResult;
      if (given.op === "prepare" || given.op === "unprepare") {
        const prepared = applyRulesetPrepare(ctx.definition, card.build, ctx.catalogs ?? {}, given, card.builder);
        result = prepared.ok
          ? {
              ok: true,
              live: (live[key] ?? {}) as RulesetLiveState,
              now: prepared.now,
              ...(prepared.build !== card.build ? { build: prepared.build } : {}),
            }
          : prepared;
      } else result = applyRulesetSheetOp(ctx.definition, card.build, live[key], given, ctx.roll, card.items);
      if (result.ok && op.op === "rest" && op.use) result = restEnds(card, op, result);
      // When it was taken, for the next.
      if (result.ok && rest) {
        const taken = { ...(ctx.clock !== undefined ? { at: ctx.clock } : {}), fresh: true as const };
        result = { ...result, live: { ...result.live, rested: { ...result.live.rested, [rest.id]: taken } } };
      }
      if (result.ok) {
        store(key, result.live);
        if (result.build) {
          card.build = result.build;
          builds[key] = result.build;
        }
      }
      if (result.ok && op.op === "rest") rests.push({ who: card.name, rest: op.rest });
      const diced = op.op === "rest" && (!!op.dice || Object.values(op.diceFrom ?? {}).some((count) => count > 0));
      if (result.ok && rest && diced && !castsToo) {
        const pools = new Set(rulesetRestDiceEntries(rest.dice).map((entry) => entry.heals));
        restHeals.set(key, [...(restHeals.get(key) ?? []), { rest: rest.label, pools }]);
      }
      return result;
    } catch {
      // A turn is never lost to its bookkeeping; an impossible command is simply refused.
      return { ok: false, reason: "malformed" };
    }
  };

  // The dead are not healed, rested or shielded back to life by a plain command (laptop pass 6
  // 2026-10-26: a Game Master's restore of 1 hit point stood a dead hero up as the story went on).
  // What raises the dead is a use of what does (a Revivify), which comes another way.
  // Health by any name the command finds it by (laptop 2026-10-26: pool="hit_points" restored a dead
  // hero to 1 of 38), and a condition taken off (her Unconscious and Prone).
  // Nor are their dying saves wiped (laptop 2026-10-26: a "Death save failures" set to 0 brought Mara
  // Thorne back dying in the next fight).
  const failures = ctx.definition.combat?.dying?.failures;
  const failuresLabel = ctx.definition.sheet.live.tracks.find((track) => track.id === failures)?.label;
  const healthOf = ctx.definition.combat?.health;
  const healthPoolOf = healthOf && "pool" in healthOf ? healthOf.pool : undefined;
  const plain = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, " ");
  const wipesFailures = (op: RulesetSheetOp) =>
    op.op === "track" &&
    failures !== undefined &&
    (plain(op.track) === plain(failures) || (!!failuresLabel && plain(op.track) === plain(failuresLabel)));
  const healsHealth = (card: SheetCommandCard, op: RulesetSheetOp) =>
    (op.op === "restore" || op.op === "temp") &&
    healthPoolOf !== undefined &&
    (!op.pool ||
      op.pool === healthPoolOf ||
      rulesetPoolKeyNamed(
        ctx.definition,
        card.build,
        live[normalizeCharacterLookupName(card.name)],
        op.pool,
        card.items,
      ) === healthPoolOf);
  // Nor are conditions put on them (laptop 0706 Party B: Restrained set on a dead Lyra): the dead are
  // past them, and a revival that takes Unconscious or Prone off is the one change that reaches them.
  const raisesDead = (card: SheetCommandCard, op: RulesetSheetOp) =>
    op.op === "rest" || op.op === "condition" || wipesFailures(op) || healsHealth(card, op);

  // The dying rule's counts outside a fight (cheap-GM playtest 2026-10-26: a hero stabilised in the
  // story stayed dying and rolled death saves again in the next fight, and the Game Master wrote two
  // death save failures with no roll). Failures come from a roll or a blow, never a pen: one written
  // up is refused, and a blow on somebody already at no health marks what a blow while down marks in
  // a fight. Their successes written up to the full count is the story's stabilising, as a fight's
  // is: both counts go back and they stay stable, which the next fight reads, until their health
  // comes back or they are hurt again.
  const dying = ctx.definition.combat?.dying;
  const successes = dying?.successes;
  const successesLabel = ctx.definition.sheet.live.tracks.find((track) => track.id === successes)?.label;
  const namesSuccesses = (op: RulesetSheetOp) =>
    op.op === "track" &&
    successes !== undefined &&
    (plain(op.track) === plain(successes) || (!!successesLabel && plain(op.track) === plain(successesLabel)));
  const trackOf = (card: SheetCommandCard, state: unknown, id: string) =>
    readRulesetLive(ctx.definition, card.build, state, card.items).tracks.find((track) => track.id === id);
  const healthAt = (card: SheetCommandCard, state: unknown) =>
    healthPoolOf === undefined
      ? undefined
      : readRulesetLive(ctx.definition, card.build, state, card.items).pools.find(
          (pool) => !pool.listId && pool.key === healthPoolOf,
        )?.value;
  const hurtsHealth = (card: SheetCommandCard, op: RulesetSheetOp) =>
    op.op === "damage" &&
    "pool" in op &&
    op.amount > 0 &&
    healthPoolOf !== undefined &&
    (op.pool === healthPoolOf ||
      rulesetPoolKeyNamed(
        ctx.definition,
        card.build,
        live[normalizeCharacterLookupName(card.name)],
        op.pool,
        card.items,
      ) === healthPoolOf);
  /** Failures written up by hand, which only a roll or a blow may mark. */
  const writesFailuresUp = (card: SheetCommandCard, op: RulesetSheetOp): boolean => {
    if (op.op !== "track" || !wipesFailures(op) || !failures) return false;
    const now = trackOf(card, live[normalizeCharacterLookupName(card.name)], failures)?.value ?? 0;
    const to = op.to ?? now + (op.by ?? 0);
    return to > now;
  };
  /** What the dying rule makes of a command just applied: the failures a blow while down marks, the
   *  stable the full successes make, and stable lost again. */
  const settleDying = (card: SheetCommandCard, op: RulesetSheetOp, before: unknown, result: RulesetSheetOpResult) => {
    if (!result.ok || !dying || dying.kind !== "saves") return result;
    let state = result.live;
    const said: string[] = [];
    const at = (track: string, value: number) => {
      const done = applyRulesetSheetOp(ctx.definition, card.build, state, { op: "track", track, to: value }, ctx.roll);
      if (done.ok) state = done.live;
      return done;
    };
    const healthBefore = healthAt(card, before);
    const hurtDown = hurtsHealth(card, op) && healthBefore !== undefined && healthBefore <= 0;
    if (hurtDown && failures && dying.damageWhileDown !== "none") {
      const marked = applyRulesetSheetOp(
        ctx.definition,
        card.build,
        state,
        { op: "track", track: failures, by: dying.damageWhileDown === "two-failures" ? 2 : 1 },
        ctx.roll,
      );
      if (marked.ok) {
        state = marked.live;
        said.push(`${failuresLabel ?? failures} ${marked.now}`);
      }
    }
    const health = healthAt(card, state);
    const counted = successes ? trackOf(card, state, successes) : undefined;
    if (
      namesSuccesses(op) &&
      health !== undefined &&
      health <= 0 &&
      counted &&
      counted.max > 0 &&
      counted.value >= counted.max
    ) {
      for (const track of [successes!, failures].filter((id): id is string => !!id)) {
        const declared = trackOf(card, state, track);
        if (declared) at(track, declared.start ?? declared.min);
      }
      state = { ...state, stable: true };
      said.push("stable");
    } else if (state.stable && ((health ?? 0) > 0 || hurtDown)) {
      state = { ...state };
      delete state.stable;
    }
    if (state === result.live) return result;
    store(normalizeCharacterLookupName(card.name), state);
    return { ...result, live: state, now: [result.now, ...said].join("; ") };
  };
  // A reply that both clears a dead hero's dying saves and gives them health back raises them, as the
  // story says (laptop 0706 Party B: a revival wrote "Death save failures" 0 and a restore of 1 hit
  // point), whatever order it wrote them in. Either alone is refused.
  const revived = new Set<string>();
  // In the same pass: the rests each character takes in this reply, by rest id, whatever order the
  // reply writes them in, and whether it uses an ability on a sheet.
  const restsTaken = new Map<string, Set<string>>();
  let castsToo = false;
  {
    const wiped = new Set<string>();
    const healed = new Set<string>();
    for (const match of content.matchAll(createSheetCommandTagRegex())) {
      const parsed = parseSheetCommandTagBody(match[1] ?? "");
      if (!parsed.op || parsed.sheet !== undefined) continue;
      if (parsed.op.op === "use") castsToo = true;
      const targets = findTargets(parsed.who);
      if ("refusal" in targets) continue;
      const op = parsed.op;
      const wanted = op.op === "rest" ? op.rest.trim().toLowerCase() : undefined;
      const rest = wanted
        ? ctx.definition.rests.find((one) => one.id === wanted || one.label.trim().toLowerCase() === wanted)
        : undefined;
      for (const card of targets.cards) {
        const key = normalizeCharacterLookupName(card.name);
        if (wipesFailures(op)) wiped.add(key);
        if (op.op === "restore" && healsHealth(card, op)) healed.add(key);
        if (rest && !restedAlready(key, rest.id))
          restsTaken.set(key, new Set([...(restsTaken.get(key) ?? []), rest.id]));
      }
    }
    for (const key of wiped) if (healed.has(key)) revived.add(key);
  }

  // The healing items each character uses in this reply, which the Engine heals them with after the
  // sheet commands (laptop 2026-10-26: one Potion of Healing healed twice, by its use and again by the
  // Game Master's restore written beside it). Each such use stands for one restore of that character's
  // health. Not where the reply also uses an ability on the sheet: that restore may be the ability's.
  const itemHeals = new Map<string, string[]>();
  if (ctx.itemHealsUser && !castsToo && healthPoolOf !== undefined) {
    for (const match of content.matchAll(createInventoryTagRegex())) {
      const body = match[1] ?? "";
      // One already answered and refused healed nobody.
      if (/\bresult\s*=\s*["']?refused/i.test(body)) continue;
      const parsed = parseInventoryTagBody(body);
      if (parsed?.action !== "use") continue;
      const targets = findTargets(parsed.who);
      if ("refusal" in targets || targets.cards.length !== 1) continue;
      const key = normalizeCharacterLookupName(targets.cards[0]!.name);
      for (const item of parsed.items) {
        if (!ctx.itemHealsUser(item)) continue;
        const uses = Math.min(parsed.count, MAX_SHEET_COMMANDS);
        itemHeals.set(key, [...(itemHeals.get(key) ?? []), ...Array.from({ length: uses }, () => item)]);
      }
    }
  }

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
    // Damage or a spend whose `now` is what the sheet already reads was already paid: by the fight
    // the reply follows, or a command before it. Paying it again would count it twice (a crossbow
    // hit a fight already took, written again after the fight was left).
    const paidAlready = (card: SheetCommandCard): RulesetSheetOpResult | null => {
      if (!parsed.claimed || (op.op !== "damage" && op.op !== "spend") || !("pool" in op)) return null;
      const reads = rulesetPoolNowText(
        ctx.definition,
        card.build,
        live[normalizeCharacterLookupName(card.name)],
        op.pool,
        card.items,
      );
      const value = (text: string) => /^(-?\d+)\s*\/\s*(\d+)/.exec(text.trim())?.slice(1, 3).join("/");
      const said = value(parsed.claimed);
      if (!reads || !said || value(reads) !== said) return null;
      return {
        ok: true,
        live: (live[normalizeCharacterLookupName(card.name)] ?? {}) as RulesetLiveState,
        now: `${reads} (already paid)`,
      };
    };
    // A restore the Engine already accounts for, or one only a rest or a feature's use may give.
    const restored = (card: SheetCommandCard): RulesetSheetOpResult | null => {
      if (op.op !== "restore") return null;
      const key = normalizeCharacterLookupName(card.name);
      // Health an item used in this reply heals: the item's use heals it, once.
      const items = itemHeals.get(key);
      if (items?.length && healsHealth(card, op)) {
        const item = items.shift()!;
        const reads = rulesetPoolNowText(ctx.definition, card.build, live[key], op.pool, card.items);
        return {
          ok: true,
          live: (live[key] ?? {}) as RulesetLiveState,
          now: `${reads ? `${reads}, ` : ""}left to the use of ${item}, which heals it`,
        };
      }
      // A pool a rest's dice healed in this reply: the rest healed it, once.
      const healedBy = restHeals.get(key);
      const leftTo = healedBy?.findIndex(({ pools }) =>
        [...pools].some(
          (pool) =>
            op.pool === pool ||
            rulesetPoolKeyNamed(ctx.definition, card.build, live[key], op.pool, card.items) === pool,
        ),
      );
      if (healedBy && leftTo !== undefined && leftTo >= 0) {
        const { rest } = healedBy.splice(leftTo, 1)[0]!;
        const reads = rulesetPoolNowText(ctx.definition, card.build, live[key], op.pool, card.items);
        return {
          ok: true,
          live: (live[key] ?? {}) as RulesetLiveState,
          now: `${reads ? `${reads}, ` : ""}left to the ${rest}, whose dice heal it`,
        };
      }
      // A pool only a rest gives back (laptop 2026-10-26: a cleric's spell slots restored beside a
      // short rest that gives back none of them) comes back with a rest the reply takes that gives it
      // back, or through the one feature on the sheet that gives it back, which pays that feature's
      // use (an Arcane Recovery's slot with its use left unspent); otherwise it is refused.
      const only = rulesetRestOnlyPool(ctx.definition, card.build, live[key], op.pool, card.items);
      if (!only) return null;
      const taken = restsTaken.get(key);
      if (only.rests.some((rest) => taken?.has(rest))) return null;
      const features = only.group
        ? rulesetRecoveriesOfGroup(ctx.definition, card.build, ctx.catalogs ?? {}, only.group).filter(
            (feature) => feature.atRest === undefined || !!taken?.has(feature.atRest),
          )
        : [];
      if (features.length !== 1 || targets.cards.length !== 1) return { ok: false, reason: "rest-only" };
      const use = {
        op: "use" as const,
        name: features[0]!.name,
        recover: [{ pool: only.label, count: op.amount }],
      };
      // The saved reply says it was that feature's use.
      parsed.op = use;
      return applyTo(card, use);
    };
    const results = targets.cards.map((card) => ({
      card,
      result:
        raisesDead(card, op) && deadOnSheet(card) && !revived.has(normalizeCharacterLookupName(card.name))
          ? ({ ok: false, reason: "dead" } as const)
          : writesFailuresUp(card, op)
            ? ({ ok: false, reason: "dying-saves-rolled" } as const)
            : (paidAlready(card) ??
              restored(card) ??
              settleDying(card, op, live[normalizeCharacterLookupName(card.name)], applyTo(card, op))),
    }));
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

  return { content: rewritten, live, changed, outcomes, rests, materials, builds };
}
