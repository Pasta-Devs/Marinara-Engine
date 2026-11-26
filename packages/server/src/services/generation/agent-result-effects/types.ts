import type { AgentResult, GameMap, GameNpc } from "@marinara-engine/shared";
import type { applyTrackerCharacterCardIdentity } from "../../../routes/generate/generate-route-utils.js";
import type { DB } from "../../../db/connection.js";
import type { createChatsStorage } from "../../storage/chats.storage.js";

export type AgentResultEffectOrigin = "generate" | "retry";

/** A game-state snapshot row as the tracker effects read it. */
export type TrackerSnapshotRow = { id: string; playerStats?: unknown; personaStats?: unknown } & Record<
  string,
  unknown
>;

/**
 * What the tracker effects need from the route. Finding the snapshot stays with each route, because the two differ on
 * purpose: generate falls back to the generation baseline (with the sibling swipe's locks on a regeneration); retry
 * projects the owner's location and can run without an assistant message.
 */
export interface TrackerEffectTarget {
  db: DB;
  /** The capability gate: built-in agents always pass, a custom agent needs "edit trackers". */
  canEditTrackers: (result: AgentResult) => boolean;
  /** The snapshot for this message and swipe, created from the route's baseline when it doesn't exist yet. */
  loadSnapshot: () => Promise<TrackerSnapshotRow | null>;
  /** Sends a `game_state_patch` event so the HUD updates without a reload. */
  emitGameStatePatch: (patch: Record<string, unknown>) => void;
  characters: CharacterTrackerTarget;
  world: WorldStateTarget;
}

/**
 * What the World State effect needs from the route. The two routes differ on purpose in each of these:
 * - generate: the row before this turn, its spatial transition, a fresh row per swipe, every field to the HUD;
 * - retry: the retried row (or its base), never a spatial transition, a patch, only the agent's fields to the HUD.
 */
export interface WorldStateTarget {
  /** The row the agent's missing fields fall back to and the field locks are read from. */
  loadPrevious: () => Promise<TrackerSnapshotRow | null>;
  /**
   * The location the Game's spatial map owns, or null when the agent's location stands. Generate may move the party
   * on the map from the agent's guidance first; retry never does.
   */
  resolveAuthoritativeLocation: (guidance: string | null) => Promise<string | null>;
  /**
   * `full`: every world field, missing ones from `loadPrevious` (generate's new row and its HUD patch).
   * `sent`: only the fields the agent returned (retry's patch, which the client applies to whatever is loaded).
   */
  patchScope: "full" | "sent";
  /** Writes the locked world fields. Generate creates the row and keeps the rest from `previous`; retry patches it. */
  save: (fields: Record<string, unknown>, context: WorldStateSaveContext) => Promise<unknown>;
  /** The route's own copy of the chat metadata; it reads the moved party marker from it later in the request. */
  chatMeta: Record<string, unknown>;
  /** The Game's spatial map owns the location, so the old game map's party marker is not moved. */
  mapOwnedBySpatial: boolean;
  emitGameMapUpdate: (map: GameMap) => void;
}

export type WorldStateSaveContext = {
  /** The row the fallbacks and locks came from. */
  previous: TrackerSnapshotRow | null;
  /** The agent's `recentEvents`, untouched. Only generate stores them (the update path has no field for them). */
  recentEvents: unknown;
};

/** What the Character Tracker effect needs on top of the other trackers. */
export interface CharacterTrackerTarget {
  /** The chat's character cards; a tracked character matching one is a card character, not an NPC. */
  cards: Parameters<typeof applyTrackerCharacterCardIdentity>[1];
  /** Recent tracked characters from earlier turns, so names and UI fields carry over. */
  history: Array<Record<string, unknown>>;
  /** The chat's stored NPCs (their portraits are reused as avatars). */
  gameNpcs: GameNpc[];
  /** The Character Tracker agent's settings (auto-generate avatars, image connection, outfit). */
  settings: Record<string, unknown> | null;
  /** The snapshot the new character list merges onto. Reads only; `save` creates the row when needed. */
  loadBaseline: () => Promise<TrackerSnapshotRow | null>;
  /** `movedKeys` only when an NPC row was handed over to its card: the lock and hidden maps under the card id. */
  save: (
    presentCharacters: Array<Record<string, unknown>>,
    movedKeys?: { fieldLocks: Record<string, boolean>; hiddenTrackerFields: Record<string, boolean> },
  ) => Promise<unknown>;
  /** Re-reads this message's row after the portraits are drawn, when the route has already answered. */
  loadForBackgroundSave: () => Promise<TrackerSnapshotRow | null>;
  /** Saves the drawn portraits. Must not depend on the route's abort signal, which may have fired by then. */
  saveInBackground: (presentCharacters: Array<Record<string, unknown>>) => Promise<unknown>;
  drawPortrait: (
    character: { name: string; appearance?: unknown; outfit?: unknown; mood?: unknown },
    options: { connectionId: string; includeOutfit: boolean },
  ) => Promise<string>;
}

export interface AgentResultEffectDeps {
  origin: AgentResultEffectOrigin;
  chatId: string;
  /** The assistant message the agents ran for. */
  messageId: string | null;
  swipeIndex: number;
  chats: Pick<ReturnType<typeof createChatsStorage>, "updateMessageExtraForSwipe" | "patchMetadata">;
  trackers: TrackerEffectTarget;
  /** Stops the effect when the run was cancelled (retry passes its abort signal). */
  signal?: AbortSignal;
}

export type AgentResultEffect = (result: AgentResult, deps: AgentResultEffectDeps) => Promise<void>;
