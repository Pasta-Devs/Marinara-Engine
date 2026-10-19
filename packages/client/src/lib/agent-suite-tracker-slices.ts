import type { GameState, InventoryTrackerRowProblem, PlayerStats } from "@marinara-engine/shared";
import type { TOptions } from "i18next";
import {
  excludeInventoryTrackerCarriedDuplicates,
  findInventoryTrackerRowProblem,
  normalizeInventoryTrackerRows,
} from "@marinara-engine/shared";

type InventoryTrackerGroup = "currencies" | "equipped" | "inventory";

/** Why an edited tracker block doesn't fit its shape. `trackerSliceErrorMessage` words it for the user. */
export type TrackerSliceError =
  | { code: "notObject"; field: keyof typeof TRACKER_SLICE_ERROR_KEYS.notObject }
  | { code: "notArray"; field: keyof typeof TRACKER_SLICE_ERROR_KEYS.notArray }
  | { code: "missingInventoryGroups" }
  | { code: "invalidInventoryRow"; group: InventoryTrackerGroup; problem: InventoryTrackerRowProblem };

/** The English text of every key lives in en.json; the regression checks each one exists. */
export const TRACKER_SLICE_ERROR_KEYS = {
  notObject: {
    worldState: "ui.trackerData.errors.notObject.worldState",
    personaStats: "ui.trackerData.errors.notObject.personaStats",
    inventoryTracker: "ui.trackerData.errors.notObject.inventoryTracker",
  },
  notArray: {
    worldCustomFields: "ui.trackerData.errors.notArray.worldCustomFields",
    presentCharacters: "ui.trackerData.errors.notArray.presentCharacters",
    personaStats: "ui.trackerData.errors.notArray.personaStats",
    inventory: "ui.trackerData.errors.notArray.inventory",
    customTrackerFields: "ui.trackerData.errors.notArray.customTrackerFields",
    activeQuests: "ui.trackerData.errors.notArray.activeQuests",
  },
  missingInventoryGroups: "ui.trackerData.errors.missingInventoryGroups",
  invalidInventoryRow: {
    notArray: "ui.trackerData.errors.inventoryRow.notArray",
    rowNotObject: "ui.trackerData.errors.inventoryRow.rowNotObject",
    missingName: "ui.trackerData.errors.inventoryRow.missingName",
    emptyName: "ui.trackerData.errors.inventoryRow.emptyName",
    nonStringField: "ui.trackerData.errors.inventoryRow.nonStringField",
    nonNumericQty: "ui.trackerData.errors.inventoryRow.nonNumericQty",
    qtyBelowOne: "ui.trackerData.errors.inventoryRow.qtyBelowOne",
  } satisfies Record<InventoryTrackerRowProblem["code"], string>,
} as const;

/** Turns a slice error into the user's language. `localize` is react-i18next's `t`. */
export function trackerSliceErrorMessage(
  error: TrackerSliceError,
  localize: (key: string, options?: TOptions) => unknown,
): string {
  switch (error.code) {
    case "notObject":
      return String(localize(TRACKER_SLICE_ERROR_KEYS.notObject[error.field]));
    case "notArray":
      return String(localize(TRACKER_SLICE_ERROR_KEYS.notArray[error.field]));
    case "missingInventoryGroups":
      return String(localize(TRACKER_SLICE_ERROR_KEYS.missingInventoryGroups));
    case "invalidInventoryRow": {
      const { problem } = error;
      return String(
        localize(TRACKER_SLICE_ERROR_KEYS.invalidInventoryRow[problem.code], {
          group: error.group,
          ...("index" in problem ? { index: problem.index } : {}),
          ...("field" in problem ? { field: problem.field } : {}),
        }),
      );
    }
  }
}

/** The validation error `buildPatch` returned, or `null` when it built a patch (patches never have an `error` key). */
export function trackerSlicePatchError(
  result: ReturnType<AgentSuiteTrackerSlice["buildPatch"]>,
): TrackerSliceError | null {
  return "error" in result ? (result.error as TrackerSliceError) : null;
}

export type AgentSuiteTrackerSlice = {
  label: string;
  description: string;
  getValue: (gameState: GameState) => unknown;
  buildPatch: (gameState: GameState, parsed: unknown) => Record<string, unknown> | { error: TrackerSliceError };
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
        return { error: { code: "notObject", field: "worldState" } };
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
          return { error: { code: "notArray", field: "worldCustomFields" } };
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
      Array.isArray(parsed)
        ? { presentCharacters: parsed }
        : { error: { code: "notArray", field: "presentCharacters" } },
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
        return { error: { code: "notObject", field: "personaStats" } };
      }
      const record = parsed as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if ("personaStats" in record) {
        if (!Array.isArray(record.personaStats)) return { error: { code: "notArray", field: "personaStats" } };
        patch.personaStats = record.personaStats;
      }
      if ("inventory" in record) {
        if (!Array.isArray(record.inventory)) return { error: { code: "notArray", field: "inventory" } };
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
        : { error: { code: "notArray", field: "customTrackerFields" } },
  },
  "inventory-tracker": {
    label: "Inventory Tracker",
    description: "Currencies, equipped items, and carried inventory maintained by the Inventory Tracker agent.",
    getValue: (gameState) => ({
      currencies: gameState.playerStats?.inventoryTrackerCurrencies ?? [],
      equipped: gameState.playerStats?.inventoryTrackerEquipped ?? [],
      inventory: gameState.playerStats?.inventoryTrackerInventory ?? [],
    }),
    buildPatch: (gameState, parsed) => {
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { error: { code: "notObject", field: "inventoryTracker" } };
      }
      const record = parsed as Record<string, unknown>;
      if (!Array.isArray(record.currencies) || !Array.isArray(record.equipped) || !Array.isArray(record.inventory)) {
        return { error: { code: "missingInventoryGroups" } };
      }
      // Report malformed rows instead of normalizing them away. The shared normalizer
      // drops rows it cannot read, so `[{ "foo": 1 }]` would silently become `[]` and
      // look to the author like the editor had eaten a group they just typed.
      for (const [group, rows] of [
        ["currencies", record.currencies],
        ["equipped", record.equipped],
        ["inventory", record.inventory],
      ] as const) {
        const problem = findInventoryTrackerRowProblem(rows);
        if (problem) return { error: { code: "invalidInventoryRow", group, problem } };
      }

      const currencies = normalizeInventoryTrackerRows(record.currencies);
      const equipped = normalizeInventoryTrackerRows(record.equipped);
      const carried = normalizeInventoryTrackerRows(record.inventory);
      return {
        playerStats: {
          ...(gameState.playerStats ?? createEmptyPlayerStats()),
          inventoryTrackerCurrencies: currencies,
          inventoryTrackerEquipped: equipped,
          inventoryTrackerInventory: excludeInventoryTrackerCarriedDuplicates(carried, currencies, equipped),
        },
      };
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
        : { error: { code: "notArray", field: "activeQuests" } },
  },
};
