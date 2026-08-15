import {
  INVENTORY_TRACKER_GROUPS,
  INVENTORY_TRACKER_GROUP_FIELDS,
  normalizeInventoryTrackerItems,
  type GameState,
  type PlayerStats,
} from "@marinara-engine/shared";

export type AgentSuiteTrackerSlice = {
  label: string;
  description: string;
  getValue: (gameState: GameState) => unknown;
  buildPatch: (gameState: GameState, parsed: unknown) => Record<string, unknown> | { error: string };
};

function createEmptyPlayerStats(): PlayerStats {
  return {
    stats: [],
    attributes: null,
    skills: {},
    inventory: [],
    activeQuests: [],
    status: "",
  };
}

/** Per-tracker-agent slice of the latest game-state snapshot. */
export const AGENT_SUITE_TRACKER_SLICES: Record<string, AgentSuiteTrackerSlice> = {
  "world-state": {
    label: "Scene",
    description: "Date, time, location, weather, and temperature of the current scene.",
    getValue: (gameState) => ({
      date: gameState.date,
      time: gameState.time,
      location: gameState.location,
      weather: gameState.weather,
      temperature: gameState.temperature,
      worldCustomFields: gameState.worldCustomFields ?? [],
    }),
    buildPatch: (_gameState, parsed) => {
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { error: "Scene data must be a JSON object" };
      }
      const record = parsed as Record<string, unknown>;
      // Only send keys present in the edited JSON: a dropped key (e.g. from an
      // AI rewrite) means "leave unchanged" — an explicit null still clears.
      const patch: Record<string, unknown> = {};
      for (const key of ["date", "time", "location", "weather", "temperature"] as const) {
        if (key in record) patch[key] = record[key] ?? null;
      }
      if ("worldCustomFields" in record) {
        if (!Array.isArray(record.worldCustomFields)) {
          return { error: "World custom fields must be a JSON array" };
        }
        patch.worldCustomFields = record.worldCustomFields;
      }
      return patch;
    },
  },
  "character-tracker": {
    label: "Present Characters",
    description: "Characters in the current scene with mood, appearance, outfit, and thoughts.",
    getValue: (gameState) => gameState.presentCharacters ?? [],
    buildPatch: (_gameState, parsed) =>
      Array.isArray(parsed) ? { presentCharacters: parsed } : { error: "Present characters must be a JSON array" },
  },
  "persona-stats": {
    label: "Persona Stats",
    description: "Your persona's status bars and inventory.",
    getValue: (gameState) => ({
      personaStats: gameState.personaStats ?? [],
      inventory: gameState.playerStats?.inventory ?? [],
    }),
    buildPatch: (gameState, parsed) => {
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { error: "Persona stats data must be a JSON object" };
      }
      const record = parsed as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if ("personaStats" in record) {
        if (!Array.isArray(record.personaStats)) return { error: "Persona stats must be a JSON array" };
        patch.personaStats = record.personaStats;
      }
      if ("inventory" in record) {
        if (!Array.isArray(record.inventory)) return { error: "Inventory must be a JSON array" };
        patch.playerStats = {
          ...(gameState.playerStats ?? createEmptyPlayerStats()),
          inventory: record.inventory,
        };
      }
      return patch;
    },
  },
  "custom-tracker": {
    label: "Custom Tracker Fields",
    description: "User-defined tracker fields maintained by the Custom Tracker agent.",
    getValue: (gameState) => gameState.playerStats?.customTrackerFields ?? [],
    buildPatch: (gameState, parsed) =>
      Array.isArray(parsed)
        ? {
            playerStats: {
              ...(gameState.playerStats ?? createEmptyPlayerStats()),
              customTrackerFields: parsed,
            },
          }
        : { error: "Custom tracker fields must be a JSON array" },
  },
  "inventory-tracker": {
    label: "Inventory",
    description: "Currencies, equipped items, and carried items maintained by the Inventory Tracker agent.",
    getValue: (gameState) =>
      Object.fromEntries(
        INVENTORY_TRACKER_GROUPS.map((group) => [
          group,
          gameState.playerStats?.[INVENTORY_TRACKER_GROUP_FIELDS[group]] ?? [],
        ]),
      ),
    buildPatch: (gameState, parsed) => {
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { error: "Inventory data must be a JSON object" };
      }
      const record = parsed as Record<string, unknown>;
      const playerStats = { ...(gameState.playerStats ?? createEmptyPlayerStats()) };
      // As with the scene slice, an omitted group means "leave unchanged".
      for (const group of INVENTORY_TRACKER_GROUPS) {
        if (!(group in record)) continue;
        if (!Array.isArray(record[group])) return { error: `Inventory "${group}" must be a JSON array` };
        playerStats[INVENTORY_TRACKER_GROUP_FIELDS[group]] = normalizeInventoryTrackerItems(record[group]);
      }
      return { playerStats };
    },
  },
  quest: {
    label: "Active Quests",
    description: "Quest progress tracked for this chat.",
    getValue: (gameState) => gameState.playerStats?.activeQuests ?? [],
    buildPatch: (gameState, parsed) =>
      Array.isArray(parsed)
        ? {
            playerStats: {
              ...(gameState.playerStats ?? createEmptyPlayerStats()),
              activeQuests: parsed,
            },
          }
        : { error: "Active quests must be a JSON array" },
  },
};
