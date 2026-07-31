import {
  spatialContextDefinitionSchema,
  type GameMap,
  type GameSetupConfig,
  type GameWorldMapMode,
} from "@marinara-engine/shared";
import { ensureGameMapId, withActiveGameMapMeta } from "./map-position.service.js";

export const HIERARCHICAL_MAPS_AGENT_ID = "hierarchical-maps";

export type GameStartWorldMapResolution = "unchanged" | "hierarchical" | "standard_fallback" | "standard_mapless";

export interface GameStartWorldMapPatch {
  patch: Record<string, unknown>;
  resolution: GameStartWorldMapResolution;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isGameMap(value: unknown): value is GameMap {
  if (!isRecord(value) || (value.type !== "grid" && value.type !== "node")) return false;
  return typeof value.name === "string" && typeof value.description === "string" && "partyPosition" in value;
}

export function resolveGameWorldMapMode(config: GameSetupConfig | null | undefined): GameWorldMapMode {
  return config?.gameWorldMapMode === "hierarchical" ? "hierarchical" : "standard";
}

export function buildInitialGameMapPatch(
  meta: Record<string, unknown>,
  setupConfig: GameSetupConfig | null | undefined,
  map: GameMap,
): Record<string, unknown> {
  if (resolveGameWorldMapMode(setupConfig) === "hierarchical") {
    return {
      gameMap: null,
      gameMaps: [],
      activeGameMapId: null,
      gameInitialMapFallback: ensureGameMapId(map),
    };
  }

  const activeMapMeta = withActiveGameMapMeta(meta, map);
  return {
    gameMap: activeMapMeta.gameMap,
    gameMaps: activeMapMeta.gameMaps,
    activeGameMapId: activeMapMeta.activeGameMapId,
    gameInitialMapFallback: null,
  };
}

export function resolveInitialMapLocationName(map: GameMap | null | undefined, location: string): string {
  const trimmed = location.trim();
  if (!trimmed || !map) return trimmed || "Unknown";
  if (map.type === "node") {
    return map.nodes?.find((node) => node.id === trimmed)?.label?.trim() || trimmed;
  }
  return map.cells?.find((cell) => cell.label === trimmed)?.label?.trim() || trimmed;
}

function hasUsableHierarchicalWorldMap(meta: Record<string, unknown>): boolean {
  if (meta.enableAgents !== true) return false;
  const activeAgentIds = Array.isArray(meta.activeAgentIds) ? meta.activeAgentIds : [];
  if (!activeAgentIds.includes(HIERARCHICAL_MAPS_AGENT_ID)) return false;

  const parsed = spatialContextDefinitionSchema.safeParse(meta.spatialContext);
  if (!parsed.success || parsed.data.ownerMode !== "game" || !parsed.data.enabled) return false;
  const startingLocationId = parsed.data.startingLocationId;
  return (
    typeof startingLocationId === "string" &&
    parsed.data.locations.some((location) => location.id === startingLocationId && location.status === "active")
  );
}

export function resolveGameStartWorldMapPatch(meta: Record<string, unknown>): GameStartWorldMapPatch {
  const setupConfig = isRecord(meta.gameSetupConfig) ? (meta.gameSetupConfig as unknown as GameSetupConfig) : null;
  if (resolveGameWorldMapMode(setupConfig) !== "hierarchical") {
    return { patch: {}, resolution: "unchanged" };
  }

  if (hasUsableHierarchicalWorldMap(meta)) {
    return {
      patch: {
        gameMap: null,
        gameMaps: [],
        activeGameMapId: null,
        gameInitialMapFallback: null,
      },
      resolution: "hierarchical",
    };
  }

  const standardSetupConfig: GameSetupConfig = {
    ...(setupConfig as GameSetupConfig),
    gameWorldMapMode: "standard",
  };
  const fallbackMap = isGameMap(meta.gameInitialMapFallback) ? meta.gameInitialMapFallback : null;
  if (!fallbackMap) {
    return {
      patch: {
        gameMap: null,
        gameMaps: [],
        activeGameMapId: null,
        gameInitialMapFallback: null,
        gameSetupConfig: standardSetupConfig,
      },
      resolution: "standard_mapless",
    };
  }

  const promoted = withActiveGameMapMeta({ ...meta, gameMap: null, gameMaps: [], activeGameMapId: null }, fallbackMap);
  return {
    patch: {
      gameMap: promoted.gameMap,
      gameMaps: promoted.gameMaps,
      activeGameMapId: promoted.activeGameMapId,
      gameInitialMapFallback: null,
      gameSetupConfig: standardSetupConfig,
    },
    resolution: "standard_fallback",
  };
}
