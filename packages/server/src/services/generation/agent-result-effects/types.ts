import type { AgentResult, GameNpc } from "@marinara-engine/shared";
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
 * purpose: generate falls back to the sibling swipe and the generation baseline, retry projects the owner's location and
 * can run without an assistant message.
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
}

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
  save: (presentCharacters: Array<Record<string, unknown>>) => Promise<unknown>;
  /** Re-reads this message's row after the portraits are drawn, when the route has already answered. */
  loadForBackgroundSave: () => Promise<TrackerSnapshotRow | null>;
  /** Saves the drawn portraits. Must not depend on the route's abort signal, which may have fired by then. */
  saveInBackground: (presentCharacters: Array<Record<string, unknown>>) => Promise<unknown>;
  drawPortrait: (
    character: { name: string; appearance?: unknown; outfit?: unknown },
    options: { connectionId: string; includeOutfit: boolean },
  ) => Promise<string>;
}

export interface AgentResultEffectDeps {
  origin: AgentResultEffectOrigin;
  chatId: string;
  /** The assistant message the agents ran for. */
  messageId: string | null;
  swipeIndex: number;
  chats: Pick<ReturnType<typeof createChatsStorage>, "updateMessageExtraForSwipe">;
  trackers: TrackerEffectTarget;
  /** Stops the effect when the run was cancelled (retry passes its abort signal). */
  signal?: AbortSignal;
}

export type AgentResultEffect = (result: AgentResult, deps: AgentResultEffectDeps) => Promise<void>;
