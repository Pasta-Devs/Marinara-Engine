// The World State tracker: date, time, location, weather, temperature and the custom world fields.
//
// Generate and retry save the row differently on purpose, and the route owns that (see WorldStateTarget):
// - generate creates this swipe's row from the previous one and sends every world field to the HUD;
// - retry patches the existing row and sends only the fields the agent returned, because the client applies a retry's
//   patch to whatever snapshot is loaded and counts any non-empty patch as a tracker change.
import { isDeepStrictEqual } from "node:util";
import {
  applyTrackerFieldLocksToGameStatePatch,
  coerceGameStateTextValue,
  isTrackerRowsUpdate,
  normalizeWorldCustomFields,
  type AgentResult,
  type GameMap,
} from "@marinara-engine/shared";
import { logger } from "../../../lib/logger.js";
import {
  buildWorldCustomFieldsStreamValue,
  parseGameStateRow,
  parseJsonField,
} from "../../../routes/generate/generate-route-utils.js";
import { addLocationEntry } from "../../game/journal.service.js";
import { getGameMapsFromMeta, syncGameMapMetaPartyPosition } from "../../game/map-position.service.js";
import { updateJournal } from "../game-journal-runtime.js";
import type { AgentResultEffectDeps } from "./types.js";

const WORLD_TEXT_FIELDS = ["date", "time", "location", "weather", "temperature"] as const;

/** World State agent: one `game_state_update` result. Combat also returns that type, but has its own handler. */
export async function applyWorldStateResult(result: AgentResult, deps: AgentResultEffectDeps): Promise<void> {
  if (result.agentType === "combat") return;
  if (!deps.trackers.canEditTrackers(result)) return;
  const world = deps.trackers.world;
  const signal = deps.signal;
  try {
    const gs = result.data as Record<string, unknown>;
    signal?.throwIfAborted();
    const previous = await world.loadPrevious();
    signal?.throwIfAborted();
    const lockState = previous ? parseGameStateRow(previous) : null;
    const previousWorldCustomFields = normalizeWorldCustomFields(
      parseJsonField<unknown[]>(previous?.worldCustomFields, []),
    );

    // The agent's location is guidance; in a Game whose spatial map owns the location, the map's place wins.
    const authoritativeLocation = await world.resolveAuthoritativeLocation(coerceGameStateTextValue(gs.location));
    signal?.throwIfAborted();

    const proposed: Record<string, unknown> = {};
    for (const field of WORLD_TEXT_FIELDS) {
      if (field === "location" && authoritativeLocation !== null) continue;
      const value = coerceGameStateTextValue(gs[field]);
      if (value !== null) proposed[field] = value;
      else if (world.patchScope === "full") proposed[field] = coerceGameStateTextValue(previous?.[field]);
    }
    if (gs.worldCustomFields !== undefined) {
      proposed.worldCustomFields = isTrackerRowsUpdate(gs.worldCustomFields)
        ? gs.worldCustomFields
        : normalizeWorldCustomFields(gs.worldCustomFields);
    } else if (world.patchScope === "full") {
      proposed.worldCustomFields = previousWorldCustomFields;
    }

    const locked = applyTrackerFieldLocksToGameStatePatch(proposed, lockState) as Record<string, unknown>;
    if (authoritativeLocation !== null) locked.location = authoritativeLocation;
    for (const field of WORLD_TEXT_FIELDS) {
      if (field in locked) locked[field] = coerceGameStateTextValue(locked[field]);
    }
    if (world.patchScope === "full" || locked.worldCustomFields !== undefined) {
      locked.worldCustomFields = normalizeWorldCustomFields(locked.worldCustomFields);
    }

    signal?.throwIfAborted();
    await world.save(locked, { previous, recentEvents: gs.recentEvents });
    signal?.throwIfAborted();

    const hudPatch: Record<string, unknown> = { ...locked };
    if (world.patchScope === "full" && gs.worldCustomFields === undefined) delete hudPatch.worldCustomFields;
    if (
      gs.worldCustomFields !== undefined &&
      (world.patchScope === "full" || isTrackerRowsUpdate(gs.worldCustomFields))
    ) {
      hudPatch.worldCustomFields = buildWorldCustomFieldsStreamValue(
        gs.worldCustomFields,
        world.patchScope === "full" ? previousWorldCustomFields : lockState?.worldCustomFields,
        locked.worldCustomFields as ReturnType<typeof normalizeWorldCustomFields>,
      );
    }
    logger.debug("[game_state_patch] world-state origin=%s: %j", deps.origin, hudPatch);
    deps.trackers.emitGameStatePatch(hudPatch);

    const nextLocation = typeof locked.location === "string" ? locked.location : null;
    await syncPartyPosition(deps, nextLocation);

    const previousLocation = coerceGameStateTextValue(previous?.location);
    if (nextLocation && nextLocation !== previousLocation) {
      const weather = typeof locked.weather === "string" ? locked.weather : null;
      signal?.throwIfAborted();
      await updateJournal(deps.trackers.db, deps.chatId, (journal) =>
        addLocationEntry(journal, nextLocation, `Arrived at ${nextLocation}${weather ? ` (${weather})` : ""}`),
      );
      signal?.throwIfAborted();
    }
  } catch (err) {
    signal?.throwIfAborted();
    logger.error(
      err,
      "[agent-effects] Failed to apply world-state tracker update origin=%s chatId=%s messageId=%s swipeIndex=%d",
      deps.origin,
      deps.chatId,
      deps.messageId,
      deps.swipeIndex,
    );
  }
}

/**
 * Moves the party marker on the chat's game map to the new location. Skipped when the spatial map owns the location.
 * The move is worked out on the stored metadata inside the chat's queued metadata patch and writes only the map keys,
 * so it can't undo a change made since the route read the chat (`/game/start`, a journal entry, a place discovered).
 */
async function syncPartyPosition(deps: AgentResultEffectDeps, location: string | null): Promise<void> {
  const world = deps.trackers.world;
  const chatMeta = world.chatMeta;
  if (world.mapOwnedBySpatial) return;
  // The route's copy decides whether to write at all: most turns move nothing, and patchMetadata always rewrites the
  // row (and the chat's updatedAt), even for an empty patch.
  const syncedCopy = syncGameMapMetaPartyPosition(chatMeta, location);
  const copyMap = (syncedCopy.gameMap as GameMap | null) ?? null;
  if (!copyMap || copyMap === chatMeta.gameMap) {
    if (getGameMapsFromMeta(syncedCopy).length > 0) Object.assign(chatMeta, syncedCopy);
    return;
  }
  let stored: { keys: Record<string, unknown>; moved: boolean } | null = null;
  deps.signal?.throwIfAborted();
  await deps.chats.patchMetadata(deps.chatId, (current) => {
    const synced = syncGameMapMetaPartyPosition(current, location);
    const keys = { gameMap: synced.gameMap, gameMaps: synced.gameMaps, activeGameMapId: synced.activeGameMapId };
    const moved = Boolean(synced.gameMap) && !isDeepStrictEqual(synced.gameMap, current.gameMap);
    stored = { keys, moved };
    return moved ? keys : {};
  });
  deps.signal?.throwIfAborted();
  // The route's copy is read again later in the same request, so it takes the stored map.
  const result = stored as { keys: Record<string, unknown>; moved: boolean } | null;
  if (!result) return;
  Object.assign(chatMeta, result.keys);
  if (result.moved) world.emitGameMapUpdate(result.keys.gameMap as GameMap);
}
