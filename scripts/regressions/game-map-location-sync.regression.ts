import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { GameMap } from "../../packages/shared/src/types/game.js";
import { buildGmFormatReminder } from "../../packages/server/src/services/game/gm-prompts.js";
import {
  areGameMapLocationsEquivalent,
  doGameMapLocationsResolveToSamePosition,
  syncGameMapMetaPartyPosition,
} from "../../packages/server/src/services/game/map-position.service.js";

const map: GameMap = {
  id: "village",
  type: "node",
  name: "Village",
  description: "",
  partyPosition: "square",
  nodes: [
    { id: "square", label: "Town Square", emoji: "🏘️", x: 30, y: 50, discovered: true },
    { id: "inn", label: "Silver Inn", emoji: "🏨", x: 70, y: 50, discovered: false },
  ],
  edges: [{ from: "square", to: "inn" }],
};

const synced = syncGameMapMetaPartyPosition({ gameMap: map }, "Silver Inn");
const syncedMap = synced.gameMap as GameMap;
assert.equal(syncedMap.partyPosition, "inn");
assert.equal(syncedMap.nodes?.find((node) => node.id === "inn")?.discovered, true);

const unmatched = syncGameMapMetaPartyPosition({ gameMap: map }, "Moonlit Orchard");
assert.equal((unmatched.gameMap as GameMap).partyPosition, "square");
assert.equal(areGameMapLocationsEquivalent("The Silver-Inn", "silver_inn"), true);
assert.equal(areGameMapLocationsEquivalent("King's Landing", "kings_landing"), true);
assert.equal(areGameMapLocationsEquivalent("Town Square", "Silver Inn"), false);

const numberedMap: GameMap = {
  ...map,
  nodes: [...(map.nodes ?? []), { id: "level2", label: "Level 2", emoji: "2", x: 50, y: 25, discovered: true }],
};
assert.equal(doGameMapLocationsResolveToSamePosition({ gameMap: numberedMap }, "Level 2", "level2"), true);
assert.equal(doGameMapLocationsResolveToSamePosition({ gameMap: numberedMap }, "Town Square", "level2"), false);

const gmReminder = buildGmFormatReminder({
  gameActiveState: "exploration",
  sessionNumber: 1,
  map,
  partyNames: [],
  playerName: "Player",
});
assert.match(gmReminder, /\[map_update:.*on every real arrival at a different location/u);
assert.match(gmReminder, /including an existing node/u);
assert.match(gmReminder, /correct stale map state/u);
assert.doesNotMatch(gmReminder, /only when the party arrives at an entirely new location/u);

const hierarchicalReminder = buildGmFormatReminder({
  gameActiveState: "exploration",
  sessionNumber: 1,
  map,
  partyNames: [],
  playerName: "Player",
  hierarchicalMapOwnsLocation: true,
});
assert.doesNotMatch(hierarchicalReminder, /\[map_update:/u);

const gridReminder = buildGmFormatReminder({
  gameActiveState: "exploration",
  sessionNumber: 1,
  map: { id: "grid", type: "grid", name: "Grid", width: 1, height: 1, cells: [] },
  partyNames: [],
  playerName: "Player",
});
assert.doesNotMatch(gridReminder, /\[map_update:/u);

const routeSource = readFileSync(
  new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
  "utf8",
);
const handlerStart = routeSource.indexOf('if (tr.name === "update_game_state" && tr.success)');
const handlerEnd = routeSource.indexOf("// update_about_me public scope", handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, "update_game_state tool handler must remain discoverable");
const handler = routeSource.slice(handlerStart, handlerEnd);
assert.match(handler, /omitAuthoritativeGameLocation\(updates, ownerSpatialProjection\)/u);
assert.match(handler, /applyTrackerFieldLocksToGameStatePatch\(/u);
assert.match(handler, /coerceGameStateTextValue\(lockedUpdates\.location\)/u);
assert.match(handler, /syncGameMapMetaPartyPosition\(freshMeta, updatedLocation\)/u);
assert.match(handler, /!areGameMapLocationsEquivalent\(previousLocation, updatedLocation\)/u);
assert.match(handler, /doGameMapLocationsResolveToSamePosition\(freshMeta, previousLocation, updatedLocation\)/u);
assert.match(handler, /updateChatMetadataForTools\(\(freshMeta\) =>/u);
assert.match(handler, /type: "game_map_update"/u);
assert.ok(
  handler.indexOf("applyTrackerFieldLocksToGameStatePatch") <
    handler.indexOf("coerceGameStateTextValue(lockedUpdates.location)"),
  "map sync must consume the post-lock location",
);

const mapHandlerStart = routeSource.indexOf("const mapUpdates =", handlerEnd);
const mapHandlerEnd = routeSource.indexOf("// Evict cachedPrompt", mapHandlerStart);
assert.ok(mapHandlerStart >= 0 && mapHandlerEnd > mapHandlerStart, "map_update handler must remain discoverable");
const mapHandler = routeSource.slice(mapHandlerStart, mapHandlerEnd);
assert.match(mapHandler, /ownerSpatialProjection\?\.ownerMode === "game" \|\| gameMap\?\.type !== "node"/u);
assert.match(mapHandler, /originalMap\?\.type !== "node"/u);
assert.match(mapHandler, /isTrackerFieldLocked\(effectiveLocks, worldTrackerLockKey\("location"\)\)/u);
assert.match(mapHandler, /updateChatMetadataForTools\(\(freshMeta\) =>/u);
assert.ok(
  mapHandler.indexOf("applyTrackerFieldLocksToGameStatePatch") < mapHandler.indexOf("applyMapUpdateCommand"),
  "tracker locks must be applied before a map_update can move the marker",
);
assert.ok(
  mapHandler.indexOf("gameStateStore.updateByMessage") > mapHandler.indexOf("Object.assign(chatMeta, metadataPatch)"),
  "map_update must anchor the message snapshot even when the map was already positioned",
);

process.stdout.write("Game map tool location sync regression passed.\n");
