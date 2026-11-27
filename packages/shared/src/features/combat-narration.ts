// Battle narration: a fight's dry lines ("Xerneas: Moonblast → Houndoom (−24 HP).") told as one
// line of prose each. The numbers never go to the model: it writes only what the blow looks like,
// and the screen keeps its own numbers beside that, so a model can never get a number wrong.
import { z } from "zod";
import type { DirectedRulesetView } from "./combat-director.js";

/** How much of a fight is told in prose: none of it, only its big moments, or every blow. */
export const COMBAT_NARRATION_MODES = ["off", "key", "every"] as const;
export type CombatNarrationMode = (typeof COMBAT_NARRATION_MODES)[number];
export const DEFAULT_COMBAT_NARRATION_MODE: CombatNarrationMode = "every";

export function readCombatNarrationMode(value: unknown): CombatNarrationMode {
  return COMBAT_NARRATION_MODES.includes(value as CombatNarrationMode)
    ? (value as CombatNarrationMode)
    : DEFAULT_COMBAT_NARRATION_MODE;
}

/** One blow, as the narrator is told it. No amounts: those stay on the screen. */
export const combatNarrationBeatSchema = z.object({
  /** The screen's own key for the line, handed back with its prose. */
  id: z.string().min(1).max(120),
  actor: z.string().min(1).max(120),
  target: z.string().max(120).optional(),
  /** What was used: a skill, a weapon, an item. Empty for a plain attack. */
  move: z.string().max(120).optional(),
  outcome: z.enum(["hit", "critical", "miss", "heal"]),
  /** The target fell to it. */
  ko: z.boolean().optional(),
  element: z.string().max(60).optional(),
  /** An elemental reaction it set off ("Melt"). */
  reaction: z.string().max(60).optional(),
  /** How the target's nature took it: weak to it, resisted it, or shrugged it off. */
  effect: z.enum(["strong", "weak", "immune"]).optional(),
});
export type CombatNarrationBeat = z.infer<typeof combatNarrationBeatSchema>;

export const COMBAT_NARRATION_MAX_BEATS = 12;

export const gameRouteCombatNarrateBodySchema = z.object({
  chatId: z.string().min(1),
  beats: z.array(combatNarrationBeatSchema).min(1).max(COMBAT_NARRATION_MAX_BEATS),
  /** The player's language code (i18next), so the prose matches the screen. */
  language: z.string().max(35).optional(),
  debugMode: z.boolean().optional(),
});
export type GameRouteCombatNarrateBody = z.infer<typeof gameRouteCombatNarrateBodySchema>;

export interface CombatNarrateResponse {
  /** One line per beat, in order; null where the model wrote nothing usable. */
  lines: Array<string | null>;
  /** Which model told it. */
  source: "sidecar" | "connection";
}

/** A big moment: what "Key moments" tells in prose. The rest get a line from the free pool. */
export function isKeyCombatBeat(beat: CombatNarrationBeat): boolean {
  return beat.outcome === "critical" || !!beat.ko || !!beat.reaction || beat.effect === "strong";
}

/**
 * The model's line, or null when it can't be shown: empty, far too long, or carrying a number of its
 * own. Every number on screen is the Engine's, so a line that invents one (a damage figure, a roll,
 * "2x") is dropped rather than shown beside the real one. Numbers inside a name ("Unit 7") are fine.
 */
const QUOTES = `"'“”‘’`;

export function cleanCombatNarrationLine(raw: unknown, beat: CombatNarrationBeat): string | null {
  // A model's runaway reply is never one line: drop it before any pattern reads it.
  if (typeof raw !== "string" || raw.length > 2000) return null;
  let line = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:\d+[.):]\s*|[-*•]\s*)/, "");
  // Quotes around the line, peeled off by hand: a pattern for trailing quotes reads slowly on many of them.
  let start = 0;
  let end = line.length;
  while (start < end && QUOTES.includes(line[start]!)) start += 1;
  while (end > start && QUOTES.includes(line[end - 1]!)) end -= 1;
  line = line.slice(start, end).trim();
  if (line.length < 8 || line.length > 320) return null;
  let named = line;
  for (const name of [beat.actor, beat.target, beat.move, beat.reaction, beat.element]) {
    if (name) named = named.split(name).join(" ");
  }
  if (/\p{Nd}/u.test(named)) return null;
  if (!/[.!?…。！？]$/u.test(line)) line = `${line}.`;
  return line;
}

type Entry = DirectedRulesetView["events"][number];

/** The blows among these events: each attack, with what its damage and the target's fall made of it,
 *  and harm or healing that came with no attack roll (a spell with a save, a healing word). */
export function rulesetNarrationBeats(
  entries: Entry[],
  names: ReadonlyMap<string, string>,
): Array<CombatNarrationBeat & { seq: number }> {
  const name = (id: string | undefined) => (id ? names.get(id) : undefined);
  const beats: Array<CombatNarrationBeat & { seq: number }> = [];
  // The blow whose damage and fall are still coming in, and whom it was aimed at.
  let open: (CombatNarrationBeat & { seq: number }) | null = null;
  let openTarget = "";
  for (const { seq, event } of entries) {
    if (event.type === "attack") {
      const actor = name(event.actorId);
      open = actor
        ? {
            seq,
            id: `s${seq}`,
            actor,
            ...(name(event.targetId) ? { target: name(event.targetId)! } : {}),
            ...(event.label ? { move: event.label } : {}),
            outcome: event.outcome,
          }
        : null;
      openTarget = event.targetId;
      if (open) beats.push(open);
      continue;
    }
    if (event.type === "turn" || event.type === "round") {
      open = null;
      continue;
    }
    if (event.type === "damage") {
      if (open && event.targetId === openTarget) {
        if (event.critical && open.outcome === "hit") open.outcome = "critical";
        if (event.adjust === "vulnerable") open.effect = "strong";
        else if (event.adjust === "resist") open.effect = "weak";
        else if (event.adjust === "immune") open.effect = "immune";
      } else if (event.sourceId && event.label && name(event.sourceId) && event.dealt > 0) {
        open = {
          seq,
          id: `s${seq}`,
          actor: name(event.sourceId)!,
          ...(name(event.targetId) ? { target: name(event.targetId)! } : {}),
          move: event.label,
          outcome: "hit",
          ...(event.adjust === "vulnerable" ? { effect: "strong" as const } : {}),
        };
        openTarget = event.targetId;
        beats.push(open);
      }
      continue;
    }
    if (event.type === "heal" && event.sourceId && event.label && !event.blocked && name(event.sourceId)) {
      beats.push({
        seq,
        id: `s${seq}`,
        actor: name(event.sourceId)!,
        ...(name(event.targetId) ? { target: name(event.targetId)! } : {}),
        move: event.label,
        outcome: "heal",
      });
      continue;
    }
    if ((event.type === "down" || event.type === "defeated") && open && event.actorId === openTarget) {
      open.ko = true;
    }
  }
  return beats;
}
