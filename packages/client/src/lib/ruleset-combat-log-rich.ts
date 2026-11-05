// The fight's log as the fight screen draws it: the same sentences `rulesetCombatEventLine` writes,
// cut into pieces so a name can be coloured by its side and the arithmetic of a roll can sit in a
// chip of its own.
//
// Nothing here computes anything. The sentences are built by the same function the plain log uses,
// with the names and the rolls wrapped in marks on the way in; the marks are read back out here and
// never reach the screen. Every number is still the event's own.
import type { DirectedRulesetView, RulesetDefinition } from "@marinara-engine/shared";
import type { TFunction } from "i18next";
import {
  rulesetCombatEventLine,
  rulesetCombatNames,
  rulesetQuietEvents,
  type RulesetCombatNames,
} from "./ruleset-combat-log";

const PARTY_OPEN = "\uE001";
const ENEMY_OPEN = "\uE002";
const NAME_CLOSE = "\uE003";
const ROLL_OPEN = "\uE004";
const ROLL_CLOSE = "\uE005";
const MONO_OPEN = "\uE006";
const MONO_CLOSE = "\uE007";
const MARKS = /[\uE001-\uE007]/gu;
const IS_MARK = /[\uE001-\uE007]/u;

export type RulesetLogPiece =
  | { kind: "text"; text: string }
  | { kind: "party" | "enemy"; text: string }
  /** A roll's arithmetic: "11 + 5 = 16". */
  | { kind: "roll"; text: string }
  /** A number read as a number: the health a blow left. */
  | { kind: "mono"; text: string }
  /** The word that says how a roll went, by whether it went the roller's way. */
  | { kind: "good" | "bad"; text: string };

export interface RulesetLogLine {
  seq: number;
  /** The round the line happened in, for the column that names each round once. */
  round: number;
  /** Whose turn the line happened on, for the heading each turn's block of lines gets. */
  turnOf?: string;
  pieces: RulesetLogPiece[];
  /** The whole line as plain words, for a screen reader and for a key. */
  text: string;
  /** The Engine's reason for its AI's last step, shown with Debug on: drawn as an aside. */
  reason?: true;
}

/** The event keys whose last clause says a roll went the roller's way, and those that say it did
 *  not. Read off the key the line was written with, never off its words. */
const GOOD_KEYS = /\.(attackHit|attackCritical|attackPoolHit|saveSuccess|savePoolSuccess)$/u;
const BAD_KEYS = /\.(attackMiss|attackPoolMiss|saveFailure|savePoolFailure)$/u;
/** The keys whose `health` and `maxHealth` are a combatant's health after a blow. */
const HEALTH_KEYS = /\.(damage|damageUntyped)$/u;

/** Cut one marked sentence into its pieces. A mark inside a roll is dropped: a roll is one chip. */
export function rulesetLogPieces(marked: string, tone?: "good" | "bad"): RulesetLogPiece[] {
  const pieces: RulesetLogPiece[] = [];
  let kind: RulesetLogPiece["kind"] = "text";
  let depth = 0;
  let text = "";
  const flush = () => {
    if (text) pieces.push({ kind, text } as RulesetLogPiece);
    text = "";
  };
  for (const char of marked) {
    if (char === ROLL_OPEN) {
      if (depth === 0) {
        flush();
        kind = "roll";
      }
      depth += 1;
    } else if (char === ROLL_CLOSE) {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        flush();
        kind = "text";
      }
    } else if (depth > 0) {
      if (!IS_MARK.test(char)) text += char;
    } else if (char === PARTY_OPEN || char === ENEMY_OPEN || char === MONO_OPEN) {
      flush();
      kind = char === PARTY_OPEN ? "party" : char === ENEMY_OPEN ? "enemy" : "mono";
    } else if (char === NAME_CLOSE || char === MONO_CLOSE) {
      flush();
      kind = "text";
    } else text += char;
  }
  flush();
  // The outcome is the sentence's last clause, after the roll: "…against AC 12, a hit."
  if (tone) {
    const last = pieces.at(-1);
    const rolled = pieces.some((piece) => piece.kind === "roll");
    if (rolled && last?.kind === "text") {
      const cut = last.text.lastIndexOf(",");
      if (cut >= 0) {
        const head = last.text.slice(0, cut + 1);
        const tail = last.text.slice(cut + 1);
        const word = tail.replace(/[.!。]\s*$/u, "");
        pieces.splice(pieces.length - 1, 1, { kind: "text", text: head }, { kind: tone, text: word });
        if (word.length < tail.length) pieces.push({ kind: "text", text: tail.slice(word.length) });
      }
    }
  }
  return pieces;
}

/**
 * Every line of the fight's log, oldest first, in pieces. The same events the plain log skips are
 * skipped here, for the same reason: what is left of a budget is on the pane already.
 */
export function rulesetRichLogLines(
  definition: RulesetDefinition,
  view: DirectedRulesetView,
  t: TFunction,
  /** With Debug on: the Engine's reasons for its AI's steps, after each one. */
  reasons = false,
  /** The ruleset's own words in the player's language (1.811). */
  text: (english: string) => string = (english) => english,
): RulesetLogLine[] {
  const plain = rulesetCombatNames(definition, view, t, text);
  const sides = new Map(view.combatants.map((combatant) => [combatant.id, combatant.side]));
  const names: RulesetCombatNames = {
    ...plain,
    combatant: (id) => {
      const name = plain.combatant(id);
      if (!name || !id) return name;
      return `${sides.get(id) === "party" ? PARTY_OPEN : ENEMY_OPEN}${name}${NAME_CLOSE}`;
    },
  };
  let tone: "good" | "bad" | undefined;
  const marked = ((key: string | string[], ...rest: unknown[]) => {
    const name = Array.isArray(key) ? key[0]! : key;
    const params = rest[0];
    let options = params;
    if (HEALTH_KEYS.test(name) && params && typeof params === "object") {
      const values = params as Record<string, unknown>;
      options = {
        ...values,
        health: `${MONO_OPEN}${String(values.health)}`,
        maxHealth: `${String(values.maxHealth)}${MONO_CLOSE}`,
      };
    }
    if (GOOD_KEYS.test(name)) tone = "good";
    else if (BAD_KEYS.test(name)) tone = "bad";
    const text = (t as unknown as (key: string | string[], ...rest: unknown[]) => string)(
      key,
      options,
      ...rest.slice(1),
    );
    return name.startsWith("game.combat.ruleset.roll.") ? `${ROLL_OPEN}${text}${ROLL_CLOSE}` : text;
  }) as unknown as TFunction;

  const lines: RulesetLogLine[] = [];
  // The view carries only the newest events (running numbers start at 1). With no round on it at all,
  // every line is the current round's. Otherwise the lines before the first round it carries are the
  // fight's first round when nothing was trimmed, and are left unnamed (0) when the log was cut short.
  const firstRound = view.events.find((entry) => entry.event.type === "round")?.event;
  const trimmed = (view.events[0]?.seq ?? 1) > 1;
  let round = firstRound?.type !== "round" ? Math.max(1, view.round) : trimmed ? 0 : Math.max(1, firstRound.round - 1);
  let turnOf: string | undefined;
  const quiet = rulesetQuietEvents(view.events);
  for (const entry of view.events) {
    // A new round ends the last turn too: its opening line belongs to nobody's turn.
    if (entry.event.type === "round") {
      round = entry.event.round;
      turnOf = undefined;
    }
    if (entry.event.type === "turn") turnOf = entry.event.actorId;
    if (entry.event.type === "budget" || quiet(entry)) continue;
    const reason = entry.event.type === "reasoning";
    if (reason && !reasons) continue;
    tone = undefined;
    const text = rulesetCombatEventLine(entry.event, names, marked);
    if (!text) continue;
    const pieces = rulesetLogPieces(text, tone);
    lines.push({
      seq: entry.seq,
      round,
      ...(turnOf ? { turnOf } : {}),
      pieces,
      text: text.replace(MARKS, ""),
      ...(reason ? { reason: true as const } : {}),
    });
  }
  return lines;
}

/** The running number of the line that opened the window the fight is held open on, if it is on
 *  the log: the last window line, while a window is open. */
export function rulesetWindowLineSeq(view: DirectedRulesetView): number | undefined {
  if (!view.window) return undefined;
  for (let index = view.events.length - 1; index >= 0; index -= 1) {
    if (view.events[index]!.event.type === "window") return view.events[index]!.seq;
  }
  return undefined;
}
