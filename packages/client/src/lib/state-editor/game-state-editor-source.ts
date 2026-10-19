// ──────────────────────────────────────────────
// State Editor — the roleplay game-state source.
// Sections are the Agent Suite tracker slices, so the shapes, validation and
// patch building stay in one place for both editors.
// ──────────────────────────────────────────────
import type { GameState } from "@marinara-engine/shared";
import {
  AGENT_SUITE_TRACKER_SLICES,
  trackerSlicePatchError,
  type TrackerSliceError,
} from "../agent-suite-tracker-slices";
import { stateValuesEqual } from "./state-editor-json";
import type { StateEditorChange, StateEditorSection } from "./state-editor.types";

/** Section order in the editor: the scene first, then who is in it, then the player's things. */
export const GAME_STATE_EDITOR_SECTION_IDS = [
  "world-state",
  "character-tracker",
  "persona-stats",
  "inventory-tracker",
  "custom-tracker",
  "quest",
] as const;

export type GameStateEditorSectionId = (typeof GAME_STATE_EDITOR_SECTION_IDS)[number];

export function buildGameStateEditorSections(
  gameState: GameState,
  localize: (sectionId: GameStateEditorSectionId, part: "label" | "description") => string,
): StateEditorSection[] {
  return GAME_STATE_EDITOR_SECTION_IDS.map((id) => ({
    id,
    label: localize(id, "label"),
    description: localize(id, "description"),
    value: AGENT_SUITE_TRACKER_SLICES[id]!.getValue(gameState),
  }));
}

/**
 * Folds the changed sections into ONE game-state PATCH body. Each slice builds its patch on top of the
 * previous slices' result: several slices rewrite all of playerStats, so building them from the same
 * snapshot would let the last one silently undo the others.
 */
export function buildGameStateEditorPatch(
  snapshot: GameState,
  changes: StateEditorChange[],
): { patch: Record<string, unknown> } | { error: TrackerSliceError | null; sectionId: string } {
  let working = snapshot;
  const patch: Record<string, unknown> = {};
  for (const change of changes) {
    const slice = AGENT_SUITE_TRACKER_SLICES[change.sectionId];
    // null: no tracker slice has this id; the modal words that message.
    if (!slice) return { error: null, sectionId: change.sectionId };
    const slicePatch = slice.buildPatch(working, change.value);
    const error = trackerSlicePatchError(slicePatch);
    if (error) return { error, sectionId: change.sectionId };
    Object.assign(patch, slicePatch);
    working = { ...working, ...slicePatch } as GameState;
  }
  return { patch };
}

/**
 * The changed sections whose saved value moved since the editor opened (a tracker agent can still be
 * writing to the same turn). A section saves as a whole, so saving those would undo that update.
 */
export function findGameStateSectionsChangedSince(
  baseline: GameState,
  fresh: GameState,
  changes: StateEditorChange[],
): string[] {
  return changes
    .map((change) => change.sectionId)
    .filter((id) => {
      const slice = AGENT_SUITE_TRACKER_SLICES[id];
      return slice ? !stateValuesEqual(slice.getValue(baseline), slice.getValue(fresh)) : false;
    });
}
