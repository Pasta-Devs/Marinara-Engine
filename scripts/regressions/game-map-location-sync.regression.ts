import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { GameMap } from "../../packages/shared/src/types/game.js";
import { syncGameMapMetaPartyPosition } from "../../packages/server/src/services/game/map-position.service.js";

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
assert.match(handler, /type: "game_map_update"/u);
assert.ok(
  handler.indexOf("applyTrackerFieldLocksToGameStatePatch") <
    handler.indexOf("coerceGameStateTextValue(lockedUpdates.location)"),
  "map sync must consume the post-lock location",
);

process.stdout.write("Game map tool location sync regression passed.\n");
