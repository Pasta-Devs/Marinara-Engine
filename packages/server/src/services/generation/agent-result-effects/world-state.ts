// The World State tracker: date, time, location, weather, temperature and the custom world fields.
//
// Generate and retry save the row differently on purpose, and the route owns that (see WorldStateTarget):
// - generate creates this swipe's row from the previous one and sends every world field to the HUD;
// - retry patches the existing row and sends only the fields the agent returned, because the client applies a retry's
//   patch to whatever snapshot is loaded and counts any non-empty patch as a tracker change.
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
  parseExtra,
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
 * The write re-reads the chat's metadata and changes only the map keys, so it can't undo a concurrent change such as
 * `/game/start` or a journal entry.
 */
async function syncPartyPosition(deps: AgentResultEffectDeps, location: string | null): Promise<void> {
  const world = deps.trackers.world;
  const chatMeta = world.chatMeta;
  const existingGameMap = (chatMeta.gameMap as GameMap | null) ?? null;
  const syncedMeta = world.mapOwnedBySpatial ? chatMeta : syncGameMapMetaPartyPosition(chatMeta, location);
  const syncedGameMap = (syncedMeta.gameMap as GameMap | null) ?? null;
  if (syncedGameMap && syncedGameMap !== existingGameMap) {
    // The route's copy is read again later in the same request, so it takes the new map too.
    Object.assign(chatMeta, syncedMeta);
    deps.signal?.throwIfAborted();
    const fresh = await deps.chats.getById(deps.chatId);
    deps.signal?.throwIfAborted();
    const freshMeta = fresh ? (parseExtra(fresh.metadata) as Record<string, unknown>) : chatMeta;
    await deps.chats.updateMetadata(deps.chatId, {
      ...freshMeta,
      gameMap: syncedMeta.gameMap,
      gameMaps: syncedMeta.gameMaps,
      activeGameMapId: syncedMeta.activeGameMapId,
    });
    deps.signal?.throwIfAborted();
    world.emitGameMapUpdate(syncedGameMap);
  } else if (getGameMapsFromMeta(syncedMeta).length > 0) {
    Object.assign(chatMeta, syncedMeta);
  }
}
