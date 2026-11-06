/**
 * The turn's own facts for the Game Master, said in the turn part of the reminder just before its
 * closing lines. A small model reads past a general rule ("an item the pack does not list does not
 * exist") but follows a plain fact about this turn: told the bags hold no torch, it stops handing one
 * over (2026-10-26 eval: Gemini Flash-Lite went from 0 to 4 clean replies of 6).
 */

import { gameInventoryNameStem } from "@marinara-engine/shared";

/** The most missing items one notice names. */
const MAX_MISSING_NAMED = 8;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whether `text` names `name` as a whole word, singular or plural, ignoring case. */
function namesItem(text: string, name: string): boolean {
  const base = gameInventoryNameStem(name);
  if (base.length < 3) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(base)}(?:e?s|e)?(?![\\p{L}\\p{N}])`, "iu").test(text);
}

/**
 * The items the player's message names that no bag in the party holds, as one line, or nothing. Plain
 * facts, no orders: the item may still be in the scene, so it says nobody carries it, not that it
 * isn't there.
 */
export function gmTurnNotices(input: {
  playerMessage: string;
  /** Item names the Engine knows: the ruleset's item book. */
  knownItems: readonly string[];
  /** What the bags hold, each by its own name and its nickname. */
  heldItems: readonly string[];
}): string[] {
  if (!input.playerMessage.trim()) return [];
  const missing = [...new Set(input.knownItems.map((name) => name.trim()).filter(Boolean))].filter(
    (name) =>
      namesItem(input.playerMessage, name) &&
      !input.heldItems.some((held) => namesItem(held, name) || namesItem(name, held)),
  );
  // A longer name that holds a shorter one ("Torch" in "Everburning Torch") is said once, as the shorter;
  // two that name each other ("Torch" and "Torches") once, as the first the book lists.
  const said = missing.filter(
    (name, index) =>
      !missing.some((other, at) => at !== index && namesItem(name, other) && (at < index || !namesItem(other, name))),
  );
  return said.length ? [`Nobody in the party carries: ${said.slice(0, MAX_MISSING_NAMED).join(", ")}.`] : [];
}
