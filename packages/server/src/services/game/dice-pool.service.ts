// ──────────────────────────────────────────────
// Game: the sighted dice pool — the chat-shaped half
//
// The pool is the OPT-IN EXCEPTION, and it ships off. The blind forms carry no
// integrity loss because the engine rolls after the model has committed the sentence;
// the pool puts a value in front of the model before it writes, which is the only way
// to narrate an outcome that needs three or more endings in one pass, and it is also
// the only way the model gains any freedom at all. Section 11 of the design states that
// plainly and the sub-option's help text says it to the player, because a player who
// does not know the model saw the dice will read a suspiciously heroic session as luck.
//
// What the queue makes impossible, without asking the model to cooperate:
//
//   - a value out of order, because the engine spends from the head;
//   - a value used twice, because a spent slot is gone;
//   - an invented value, modifier, total or result, because the engine recomputes all
//     four and its record is what is saved;
//   - a better roll by being asked again, because a swipe, a regenerate and a
//     continuation all re-read the same queue rather than a refilled one;
//   - a roll the pool did not contain, obtained by overflowing, provided the client's
//     own fallback is gated on this sub-option.
//
// What it cannot stop is the model choosing the DC after seeing the value, and choosing
// whether to call for a check at all. The numeric DC bound and the aging clock narrow
// both; the telemetry below records them; neither closes them.
// ──────────────────────────────────────────────

import {
  DEFAULT_GAME_DICE_POOL_AGE_TURNS,
  DEFAULT_GAME_DICE_POOL_WINDOW,
  GAME_DICE_POOL_ALLOTMENT,
  GAME_DICE_POOL_SIZES,
  MAX_GAME_DICE_POOL_AGE_TURNS,
  MAX_GAME_DICE_POOL_WINDOW,
  consumeFromPool,
  createGameDicePool,
  formatPoolSlotName,
  gameDicePoolSizeForFaces,
  isRollPlaceholderName,
  parseGameDicePool,
  refillPool,
  renderGameDicePoolView,
  serializeGameDicePool,
  type GameDicePool,
  type GameDicePoolConsumption,
  type GameDicePoolMismatch,
  type GameDicePoolSize,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createGameDicePoolsStorage } from "../storage/game-dice-pools.storage.js";
import { rollDieSecurely, type DieRoller } from "./dice-rng.js";
import {
  attributeModifier,
  getGoverningAttribute,
  mapSheetAttributeName,
  readContextAttributeScore,
  SHEET_ATTRIBUTE_LABELS,
} from "./skill-check.service.js";
import type { SkillCheckModifierContext } from "./skill-check-resolution.service.js";

/** How much of a model-written claim is worth carrying into a log line or a notice. */
const CLAIM_LOG_MAX = 60;

/** Which turn the session is being built for, which decides which row it reads. */
export type GameDicePoolTarget =
  /** A brand new turn: refill the chat's latest row. */
  | { kind: "fresh" }
  /** A swipe or regenerate of an existing message: re-read that message's own pool. */
  | { kind: "regenerate"; messageId: string }
  /** A continuation: re-read this (message, swipe)'s pool AND its ledger, and resume. */
  | { kind: "continue"; messageId: string; swipeIndex: number };

export interface GameDicePoolSettings {
  /** How many values per size the model is shown. Bounded to 1..6; absent means 1. */
  window: number;
  /** Accepted turns a size may sit unspent before it is rethrown. 0 means aging off. */
  ageTurns: number;
}

export interface GameDicePoolSession {
  readonly chatId: string;
  /** The queue this turn was prompted with. Never mutated; the refill derives a new one. */
  readonly pool: GameDicePool;
  readonly settings: GameDicePoolSettings;
  /** Slots a continuation's already-saved segment spent. Never re-spent, always reported. */
  readonly carried: GameDicePoolConsumption[];
  /** Everything spent for this message, carried slots first, in spend order. */
  readonly consumed: GameDicePoolConsumption[];
  /** What the model claimed that disagreed with what was spent. Recorded, never obeyed. */
  readonly mismatches: GameDicePoolMismatch[];
  /** Tags the pool had no value left for. Nothing rolled, nothing written, no second request. */
  overflow: number;
  /**
   * Spend the next unconsumed value of a size, or null on overflow.
   *
   * `count` is how many values one tag needs: two for an advantage check, N for an
   * `NdM` pool tag. All or nothing, so a tag never narrates half a roll.
   */
  spend(size: GameDicePoolSize, count: number, tagIndex: number): GameDicePoolConsumption[] | null;
  /** Compare what the model wrote against what was spent. Changes no number. */
  audit(spent: GameDicePoolConsumption[], claim: GameDicePoolClaim): void;
  /** Record a tag the pool could not serve. */
  recordOverflow(reason: string, detail: string): void;
}

/** What one tag claimed about the pool, read as a checksum. */
export interface GameDicePoolClaim {
  /**
   * `pool=` as written, present whenever the tag declared one at all — an empty string
   * included, which is why every test of it below asks whether it is `undefined` rather
   * than whether it is truthy. `pool=""` is a declared spend with no name on it, and it
   * is exactly as much a disagreement as a name that says the wrong slot.
   */
  rawPool?: string;
  /** The slots the model named, zero-based, when it named readable ones. */
  slots?: number[];
  /** The numbers the model wrote in `rolls=`. */
  values?: number[];
}

/** Read the sub-option's two numbers off chat metadata, bounded to what the UI offers. */
export function readGameDicePoolSettings(chatMeta: Record<string, unknown> | null | undefined): GameDicePoolSettings {
  const window = Number(chatMeta?.gameDicePoolWindow);
  const ageTurns = Number(chatMeta?.gameDicePoolAgeTurns);
  return {
    window: Number.isFinite(window)
      ? Math.max(1, Math.min(MAX_GAME_DICE_POOL_WINDOW, Math.floor(window)))
      : DEFAULT_GAME_DICE_POOL_WINDOW,
    ageTurns: Number.isFinite(ageTurns)
      ? Math.max(0, Math.min(MAX_GAME_DICE_POOL_AGE_TURNS, Math.floor(ageTurns)))
      : DEFAULT_GAME_DICE_POOL_AGE_TURNS,
  };
}

/** The sub-option. Only meaningful while the one-request switch itself is on. */
export function isGameDicePoolEnabled(chatMeta: Record<string, unknown> | null | undefined): boolean {
  return chatMeta?.gameDicePoolMode === true;
}

export interface CreateGameDicePoolSessionOptions {
  chatId: string;
  pool: GameDicePool;
  settings: GameDicePoolSettings;
  carried?: GameDicePoolConsumption[];
}

export function createGameDicePoolSession(options: CreateGameDicePoolSessionOptions): GameDicePoolSession {
  const carried = [...(options.carried ?? [])];
  const consumed = [...carried];
  const mismatches: GameDicePoolMismatch[] = [];
  const session: GameDicePoolSession = {
    chatId: options.chatId,
    pool: options.pool,
    settings: options.settings,
    carried,
    consumed,
    mismatches,
    overflow: 0,
    spend(size, count, tagIndex) {
      if (count < 1) return [];
      const spent: GameDicePoolConsumption[] = [];
      for (let index = 0; index < count; index += 1) {
        const alreadySpent = consumed.filter((entry) => entry.size === size).length + spent.length;
        const next = consumeFromPool(options.pool, size, alreadySpent);
        // All or nothing: half a roll narrated as a whole one is exactly the invention
        // the never-invent contract forbids, and a partial spend would also leave the
        // queue's accounting disagreeing with what the turn reported.
        if (!next) return null;
        spent.push({ size, slot: next.slot, value: next.value, tagIndex });
      }
      consumed.push(...spent);
      return spent;
    },
    audit(spent, claim) {
      auditPoolClaim(session, spent, claim);
    },
    recordOverflow(reason, detail) {
      session.overflow += 1;
      logger.warn(
        "[game/dice-pool] Chat %s asked for more than the pool held (%s): %s. The tag was left unrolled and no second request was made.",
        session.chatId,
        reason,
        detail.slice(0, CLAIM_LOG_MAX),
      );
    },
  };
  return session;
}

/**
 * Compare the model's `pool=` and `rolls=` against what the engine actually spent.
 *
 * Every disagreement is RECORDED and none is obeyed, which is the whole point: the slot
 * name is a checksum, and a model that names a different slot, writes a different number
 * or claims a slot it already spent changes the log and changes no outcome.
 *
 * There is deliberately no positional rule about which attribute the model writes first.
 * The design re-grades that signal as weak — a thinking model chooses the DC in reasoning
 * tokens long before it emits an attribute — and the engine's own record writes `pool=`
 * last, so the rule would flag the engine's own shape on every turn.
 */
function auditPoolClaim(session: GameDicePoolSession, spent: GameDicePoolConsumption[], claim: GameDicePoolClaim) {
  if (spent.length === 0) return;
  const size = spent[0]!.size;
  const record = (kind: GameDicePoolMismatch["kind"], wrote?: string) => {
    session.mismatches.push({
      kind,
      size,
      slot: spent[0]!.slot,
      ...(wrote ? { wrote: wrote.slice(0, CLAIM_LOG_MAX) } : {}),
    });
    logger.warn(
      "[game/dice-pool] Chat %s wrote a %s that disagrees with the slot the engine spent (%s). The engine's record stands.",
      session.chatId,
      kind,
      formatPoolSlotName(
        size,
        spent.map((entry) => entry.slot),
      ),
    );
  };

  if (claim.slots) {
    const alreadySpentEarlier = session.consumed.filter(
      (entry) => entry.size === size && !spent.includes(entry) && claim.slots!.includes(entry.slot),
    );
    if (alreadySpentEarlier.length > 0) record("reuse", claim.rawPool);
    else if (claim.slots.length !== spent.length || claim.slots.some((slot, index) => slot !== spent[index]!.slot)) {
      record("slot", claim.rawPool);
    }
  } else if (claim.rawPool !== undefined) {
    // Written but unreadable: the same disagreement as naming the wrong slot.
    record("slot", claim.rawPool || "(empty)");
  }

  if (claim.values && claim.values.length > 0) {
    const wrongValue =
      claim.values.length !== spent.length || claim.values.some((value, index) => value !== spent[index]!.value);
    if (wrongValue) record("value", claim.values.join("|"));
  }
}

/**
 * Load the queue this turn plays against.
 *
 * Four cases, in this order, and the ordering is the rewind rule in code:
 *
 *   1. A continuation re-reads its OWN row, ledger included, and resumes after the last
 *      slot the saved segment spent. Without that a continuation either spends slots
 *      1..k twice — the same number appearing twice in one message — or reads a refilled
 *      queue that no longer matches the prompt the first segment was written against.
 *   2. A swipe or a regenerate re-reads the queue the first telling of that turn was
 *      dealt, with an EMPTY ledger. Refill happens once per accepted turn, so an
 *      alternative telling faces the same luck. This is what closes reroll-until-lucky.
 *   3. A new turn refills the chat's latest row: consumed slots shift off the head, fresh
 *      values are pushed at the tail, and every size that went untouched ages one turn.
 *   4. No row at all — the sub-option was just switched on, the chat was imported, the
 *      row was pruned by a rewind — throws a fresh allotment and says so. Nothing fails.
 */
export async function loadGameDicePoolSession(
  db: DB,
  chatId: string,
  target: GameDicePoolTarget,
  settings: GameDicePoolSettings,
  roll: DieRoller = rollDieSecurely,
): Promise<GameDicePoolSession> {
  const store = createGameDicePoolsStorage(db);
  const build = (pool: GameDicePool, carried?: GameDicePoolConsumption[]) =>
    createGameDicePoolSession({ chatId, pool, settings, ...(carried ? { carried } : {}) });

  try {
    if (target.kind === "continue") {
      const own = await store.getForTurn(chatId, target.messageId, target.swipeIndex);
      const pool = parseGameDicePool(own?.pool);
      if (own && pool) return build(pool, parseConsumption(own.consumed));
    }
    if (target.kind === "regenerate" || target.kind === "continue") {
      const earlier = await store.getEarliestForMessage(chatId, target.messageId);
      const pool = parseGameDicePool(earlier?.pool);
      if (pool) return build(pool);
    }
    const latest = await store.getLatestForChat(chatId);
    const previous = parseGameDicePool(latest?.pool);
    if (previous) {
      const refilled = refillPool(previous, countBySize(parseConsumption(latest!.consumed)), roll, settings.ageTurns);
      if (refilled.aged.length > 0) {
        logger.debug(
          "[game/dice-pool] Rethrew %s in chat %s after %d idle turns",
          refilled.aged.join(", "),
          chatId,
          settings.ageTurns,
        );
      }
      logSpendDurations(chatId, previous, parseConsumption(latest!.consumed));
      return build(refilled.pool);
    }
  } catch (err) {
    // A row this cannot read costs the turn its continuity, never the turn. A fresh
    // allotment is honest: it is thrown here, now, with the same roller as every other.
    logger.error(err, "[game/dice-pool] Could not read a pool row for chat %s; throwing a fresh allotment", chatId);
  }
  logger.debug("[game/dice-pool] No usable pool row for chat %s; throwing a fresh allotment", chatId);
  return build(createGameDicePool((sides) => roll(sides)));
}

function parseConsumption(raw: string | null | undefined): GameDicePoolConsumption[] {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const entries: GameDicePoolConsumption[] = [];
  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;
    const size = entry.size as GameDicePoolSize;
    if (!GAME_DICE_POOL_SIZES.includes(size)) continue;
    const slot = Number(entry.slot);
    const value = Number(entry.value);
    if (!Number.isInteger(slot) || slot < 0 || slot >= GAME_DICE_POOL_ALLOTMENT[size]) continue;
    if (!Number.isInteger(value) || value < 1) continue;
    const tagIndex = Number(entry.tagIndex);
    entries.push({ size, slot, value, tagIndex: Number.isInteger(tagIndex) ? tagIndex : 0 });
  }
  return entries;
}

function countBySize(entries: readonly GameDicePoolConsumption[]): Partial<Record<GameDicePoolSize, number>> {
  const counts: Partial<Record<GameDicePoolSize, number>> = {};
  for (const entry of entries) counts[entry.size] = (counts[entry.size] ?? 0) + 1;
  return counts;
}

/**
 * Telemetry, per 11.4.4: transitions and durations, never per-turn state.
 *
 * With a frozen head a rule like "log a turn where the head d20 was low and no check was
 * called" fires forever and says nothing. What is worth recording is how long a head sat
 * before it was spent, and the aging clock's own resets. Debug level, aggregate, no
 * blocking, no rewriting, and nothing the player is ever scolded with.
 */
function logSpendDurations(chatId: string, pool: GameDicePool, spent: readonly GameDicePoolConsumption[]): void {
  for (const [size, count] of Object.entries(countBySize(spent)) as Array<[GameDicePoolSize, number]>) {
    const idle = pool.idle[size] ?? 0;
    if (idle > 0) {
      logger.debug("[game/dice-pool] Chat %s spent %d %s after the head sat %d turns", chatId, count, size, idle);
    }
  }
}

/** A check called at a DC the spent value clears comfortably, with a high head. Recorded only. */
export function logPoolDcFit(session: GameDicePoolSession, dc: number, value: number, modifier: number): void {
  if (value >= 16 && dc <= value + modifier) {
    logger.debug(
      "[game/dice-pool] Chat %s called a DC %d check while holding a %d (+%d)",
      session.chatId,
      dc,
      value,
      modifier,
    );
  }
}

/** The pool and ledger this turn's row should carry, with the refill deliberately NOT applied. */
export function serializeGameDicePoolTurn(session: GameDicePoolSession): { pool: string; consumed: string } {
  return {
    pool: serializeGameDicePool(session.pool),
    // The refill is derived from this pair at the NEXT accepted turn rather than applied
    // here, which is what makes a swipe, a regenerate and a continuation of this same turn
    // all face the queue this turn was prompted with.
    consumed: JSON.stringify(session.consumed),
  };
}

/** The pooled size a declared `NdM` notation needs, or null when the size is not pooled. */
export function pooledSizeForNotation(sides: number): GameDicePoolSize | null {
  return gameDicePoolSizeForFaces(sides);
}

// ── The prompt block ──

/**
 * The `<dice_pool>` and `<check_modifiers>` blocks, plus the five rules that make the
 * mechanism legible. Appended to the DICE block only while the sub-option is on.
 *
 * `<check_modifiers>` is what makes one-pass narration possible at all: without it the
 * model knows the die and not the total. It is rendered from the same context the
 * resolver loads, so the block and the engine cannot disagree about a number, and it
 * carries the same dependency — with no game-state snapshot and no player card sheet
 * there is nothing to render and the block says so rather than implying a zero.
 */
export function renderGameDicePoolPromptBlock(
  session: GameDicePoolSession,
  context: SkillCheckModifierContext | null,
): string {
  const view = renderGameDicePoolView(session.pool, session.settings.window);
  if (view.length === 0) return "";
  const heads = view
    .map((entry) =>
      entry.values.length === 1
        ? `The next ${entry.size} is ${entry.values[0]}.`
        : `The next ${entry.size} values are ${entry.values.join(", ")}.`,
    )
    .join(" ");

  const example = view[0]!;
  const lines = [
    `<dice_pool>`,
    heads,
    `</dice_pool>`,
    ``,
    ...renderCheckModifiers(context),
    ``,
    `- Spend a pool value only for an outcome that needs three or more different endings. Write the number you spent into rolls= and name the slot with pool="${formatPoolSlotName(example.size, [0])}".`,
    `- Do not write modifier, total, used or result. The engine computes them from your rolls= value and the modifiers above, and its numbers are what get saved.`,
    `- A second roll of the same size in this turn is blind: the engine rolls it and you narrate it next turn.`,
    `- Never write a number that is not the one shown above. The engine keeps the pool; a number you invent is replaced and the turn is flagged.`,
    `- Example: [skill_check: skill="Stealth" dc="15" mode="normal" dice="1d20" rolls="${view.find((entry) => entry.size === "d20")?.values[0] ?? example.values[0]}" pool="d20:1"]`,
  ];
  return lines.join("\n");
}

function renderCheckModifiers(context: SkillCheckModifierContext | null): string[] {
  const skills: string[] = [];
  const attributes: string[] = [];
  if (context) {
    for (const [name, raw] of Object.entries(context.skills ?? {})) {
      const label = typeof name === "string" ? name.trim() : "";
      // A skill key is model-written text. Only a name the placeholder grammar could read
      // back is printed, so a bracket or a newline in one cannot reshape this block, and
      // the list is bounded so a runaway sheet cannot pad the prompt.
      // A key with whitespace around it is skipped rather than trimmed, for the same reason the
      // placeholder view skips it: the resolver reads the key as written.
      if (!label || label !== name || label.length > CHECK_MODIFIER_NAME_MAX || !isRollPlaceholderName(label)) continue;
      if (!Number.isFinite(Number(raw))) continue;
      const governing = readContextAttributeScore(context, getGoverningAttribute(label));
      const total = Number(raw) + (governing === null ? 0 : attributeModifier(governing));
      skills.push(`${label} ${formatSigned(total)}`);
      if (skills.length >= CHECK_MODIFIER_NAMES_MAX) break;
    }
    for (const [key, label] of SHEET_ATTRIBUTE_LABELS) {
      const score = readContextAttributeScore(context, key);
      if (score !== null) attributes.push(`${label} ${formatSigned(attributeModifier(score))}`);
    }
  }

  if (skills.length === 0 && attributes.length === 0) {
    return [
      `<check_modifiers>`,
      `This character has no sheet modifiers set, so the engine adds nothing to a check: the total is the die.`,
      `</check_modifiers>`,
    ];
  }
  return [
    `<check_modifiers>`,
    `These are the totals the engine will add to a check. A skill not listed uses its attribute below; an unknown skill uses Intelligence.`,
    ...(skills.length > 0 ? [skills.join("  ")] : []),
    ...(attributes.length > 0 ? [attributes.join("  ")] : []),
    `</check_modifiers>`,
  ];
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** The longest skill name the block will print, and how many. A sheet is not that long. */
const CHECK_MODIFIER_NAME_MAX = 40;
const CHECK_MODIFIER_NAMES_MAX = 40;

/** Re-exported so a caller that only needs the name mapping does not reach past this module. */
export { mapSheetAttributeName };
