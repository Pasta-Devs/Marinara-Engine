import { describe, expect, it } from "vitest";
import type { GameMap } from "../src/engine/contracts/types/game";
import { syncGameMapMetaPartyPosition } from "../src/engine/modes/game/world/map-position.service";

function nodeMap(overrides: Partial<GameMap> = {}): GameMap {
  return {
    id: "crossroads",
    type: "node",
    name: "Crossroads",
    description: "",
    partyPosition: "old-road",
    nodes: [
      { id: "old-road", label: "Old Road", emoji: "road", x: 35, y: 50, discovered: true },
      { id: "sunken-archive", label: "Sunken Archive", emoji: "book", x: 65, y: 50, discovered: false },
    ],
    edges: [{ from: "old-road", to: "sunken-archive" }],
    ...overrides,
  };
}

function gridMap(overrides: Partial<GameMap> = {}): GameMap {
  return {
    id: "harbor",
    type: "grid",
    name: "Harbor",
    description: "",
    width: 3,
    height: 3,
    partyPosition: { x: 0, y: 0 },
    cells: [
      { x: 0, y: 0, emoji: "dock", label: "Old Dock", terrain: "dock", discovered: true },
      { x: 2, y: 1, emoji: "tower", label: "Lantern Pier", terrain: "pier", discovered: false },
    ],
    ...overrides,
  };
}

describe("issue 2139 map position sync", () => {
  it("moves and discovers a matching node from structured location text", () => {
    const syncedMeta = syncGameMapMetaPartyPosition({ gameMap: nodeMap() }, "The Sunken Archive");
    const synced = syncedMeta.gameMap as GameMap;

    expect(synced.partyPosition).toBe("sunken-archive");
    expect(synced.nodes?.find((node) => node.id === "sunken-archive")?.discovered).toBe(true);
  });

  it("moves and discovers a matching grid cell from structured location text", () => {
    const syncedMeta = syncGameMapMetaPartyPosition({ gameMap: gridMap() }, "Lantern Pier");
    const synced = syncedMeta.gameMap as GameMap;

    expect(synced.partyPosition).toEqual({ x: 2, y: 1 });
    expect(synced.cells?.find((cell) => cell.label === "Lantern Pier")?.discovered).toBe(true);
  });

  it("syncs metadata to the map that contains the reported location", () => {
    const meta = {
      gameMap: nodeMap({ id: "crossroads", name: "Crossroads" }),
      gameMaps: [nodeMap({ id: "crossroads", name: "Crossroads" }), gridMap({ id: "harbor", name: "Harbor" })],
      activeGameMapId: "crossroads",
    };

    const synced = syncGameMapMetaPartyPosition(meta, "Lantern Pier");

    expect((synced.gameMap as GameMap).id).toBe("harbor");
    expect((synced.gameMap as GameMap).partyPosition).toEqual({ x: 2, y: 1 });
    expect(synced.activeGameMapId).toBe("harbor");
    expect(((synced.gameMaps as GameMap[]).find((map) => map.id === "harbor")?.partyPosition)).toEqual({
      x: 2,
      y: 1,
    });
  });

  it("leaves metadata stable when no map contains the reported location", () => {
    const meta = {
      gameMap: nodeMap({ id: "crossroads", name: "Crossroads" }),
      gameMaps: [nodeMap({ id: "crossroads", name: "Crossroads" }), gridMap({ id: "harbor", name: "Harbor" })],
      activeGameMapId: "crossroads",
    };

    const synced = syncGameMapMetaPartyPosition(meta, "Moonlit Orchard");

    expect((synced.gameMap as GameMap).id).toBe("crossroads");
    expect((synced.gameMap as GameMap).partyPosition).toBe("old-road");
    expect(synced.activeGameMapId).toBe("crossroads");
  });

  it("keeps the active map stable when it already contains the reported location", () => {
    const meta = {
      gameMap: nodeMap({
        partyPosition: "sunken-archive",
        nodes: [
          { id: "old-road", label: "Old Road", emoji: "road", x: 35, y: 50, discovered: true },
          { id: "sunken-archive", label: "Sunken Archive", emoji: "book", x: 65, y: 50, discovered: true },
        ],
      }),
      activeGameMapId: "crossroads",
    };

    const synced = syncGameMapMetaPartyPosition(meta, "Sunken Archive");

    expect(synced).toBe(meta);
  });
});
