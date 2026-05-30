import type { GameActiveState } from "../../../contracts/types/game";

const GAME_STATES: readonly GameActiveState[] = ["exploration", "dialogue", "combat", "travel_rest"];

/** Returns true if transitioning from `from` to `to` is allowed. Self-transitions are always valid (no-op). */
function isValidTransition(from: GameActiveState, to: GameActiveState): boolean {
  return GAME_STATES.includes(from) && GAME_STATES.includes(to);
}

/** Validate and return the next state, or throw. Self-transitions are treated as no-ops. */
export function validateTransition(from: GameActiveState, to: GameActiveState): GameActiveState {
  if (from === to) return from;
  if (!isValidTransition(from, to)) {
    throw new Error(`Invalid game state transition: ${from} → ${to}`);
  }
  return to;
}
