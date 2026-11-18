import type { AgentResult } from "@marinara-engine/shared";
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
