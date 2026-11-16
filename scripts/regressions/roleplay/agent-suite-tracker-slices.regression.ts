// Editing trackers in the Agent Suite: each tracker's fields are editable without replacing the data beside them, and
// every tracker editing error has an English message.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AGENT_SUITE_TRACKER_SLICES,
  TRACKER_SLICE_ERROR_KEYS,
  trackerSliceErrorMessage,
  type TrackerSliceError,
} from "../../../packages/client/src/lib/agent-suite-tracker-slices.js";
import type { GameState } from "../../../packages/shared/src/types/game-state.js";

const englishLocale = JSON.parse(
  readFileSync(new URL("../../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
) as Record<string, string>;
{
  // #4937: Agent Suite tracker editing must expose every field owned by the
  // World State and Persona Stats trackers without replacing adjacent data.
  const gameState = {
    id: "state-4937",
    chatId: "chat-4937",
    messageId: "message-4937",
    swipeIndex: 0,
    date: "August 12",
    time: "10:00",
    location: "Lab",
    weather: "Clear",
    temperature: "20 C",
    worldCustomFields: [{ name: "Moon", value: "Full", icon: "moon" }],
    presentCharacters: [],
    recentEvents: [],
    personaStats: [{ name: "Energy", value: 8, max: 10, color: "blue" }],
    playerStats: {
      stats: [],
      attributes: null,
      skills: { alchemy: 4 },
      inventory: [{ name: "Vial", description: "Sealed", quantity: 2, location: "on_person" }],
      activeQuests: [],
      status: "Focused",
    },
    createdAt: "2026-08-12T08:00:00.000Z",
  } satisfies GameState;
  assert.deepEqual(
    (AGENT_SUITE_TRACKER_SLICES["world-state"]!.getValue(gameState) as Record<string, unknown>).worldCustomFields,
    gameState.worldCustomFields,
  );
  assert.deepEqual(AGENT_SUITE_TRACKER_SLICES["persona-stats"]!.getValue(gameState), {
    personaStats: gameState.personaStats,
    inventory: gameState.playerStats.inventory,
  });
  assert.deepEqual(
    AGENT_SUITE_TRACKER_SLICES["persona-stats"]!.buildPatch(gameState, {
      personaStats: [],
      inventory: [{ name: "Key", description: "Brass", quantity: 1, location: "stored" }],
    }),
    {
      personaStats: [],
      playerStats: {
        ...gameState.playerStats,
        inventory: [{ name: "Key", description: "Brass", quantity: 1, location: "stored" }],
      },
    },
    "Persona inventory edits must preserve skills, status, and other player stats",
  );
  assert.deepEqual(AGENT_SUITE_TRACKER_SLICES["world-state"]!.buildPatch(gameState, { worldCustomFields: "invalid" }), {
    error: { code: "notArray", field: "worldCustomFields" },
  });
  assert.deepEqual(
    AGENT_SUITE_TRACKER_SLICES["persona-stats"]!.buildPatch(gameState, { personaStats: [] }),
    { personaStats: [] },
    "Dropping inventory from an AI rewrite must leave the saved inventory unchanged",
  );

  // The Inventory Tracker editor must refuse malformed rows rather than normalize
  // them away. The shared normalizer drops rows it cannot read, so accepting this
  // payload would empty a group the author had just typed out.
  const inventorySlice = AGENT_SUITE_TRACKER_SLICES["inventory-tracker"]!;
  const malformedRows = inventorySlice.buildPatch(gameState, {
    currencies: [],
    equipped: [],
    inventory: [{ foo: 1 }],
  });
  assert.deepEqual(
    malformedRows,
    { error: { code: "invalidInventoryRow", group: "inventory", problem: { code: "missingName", index: 0 } } },
    "a row without a name must be reported, naming the group it came from",
  );
  assert.deepEqual(
    inventorySlice.buildPatch(gameState, {
      currencies: [],
      equipped: [],
      inventory: [{ name: "Rope", qty: 0 }],
    }),
    { error: { code: "invalidInventoryRow", group: "inventory", problem: { code: "qtyBelowOne", index: 0 } } },
    "a quantity below 1 must be reported rather than silently clamped",
  );

  // #7738: slice errors are codes the UI localizes. Every code must name an English key, and the
  // English text must read as it did before the errors were localized.
  const collectKeys = (value: unknown): string[] =>
    typeof value === "string" ? [value] : Object.values(value as object).flatMap(collectKeys);
  const trackerErrorKeys = collectKeys(TRACKER_SLICE_ERROR_KEYS);
  assert.equal(trackerErrorKeys.length, 17, "every tracker slice error code has a key");
  for (const key of trackerErrorKeys) {
    assert.equal(typeof englishLocale[key], "string", `${key} must exist in en.json`);
  }
  const renderEnglish = (error: TrackerSliceError) =>
    trackerSliceErrorMessage(error, (key, values) =>
      englishLocale[key]!.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => {
        const value = (values as Record<string, unknown> | undefined)?.[name];
        assert.ok(value !== undefined, `${key} needs {{${name}}}`);
        return String(value);
      }),
    );
  const sliceError = (slice: string, parsed: unknown) =>
    (AGENT_SUITE_TRACKER_SLICES[slice]!.buildPatch(gameState, parsed) as { error: TrackerSliceError }).error;
  const inventoryRows = (inventory: unknown[]) =>
    sliceError("inventory-tracker", { currencies: [], equipped: [], inventory });
  for (const [error, english] of [
    [sliceError("world-state", []), "Scene data must be a JSON object"],
    [sliceError("world-state", { worldCustomFields: "invalid" }), "World custom fields must be a JSON array"],
    [sliceError("character-tracker", {}), "Present characters must be a JSON array"],
    [sliceError("persona-stats", []), "Persona stats data must be a JSON object"],
    [sliceError("persona-stats", { personaStats: {} }), "Persona stats must be a JSON array"],
    [sliceError("persona-stats", { inventory: {} }), "Inventory must be a JSON array"],
    [sliceError("custom-tracker", {}), "Custom tracker fields must be a JSON array"],
    [sliceError("inventory-tracker", null), "Inventory Tracker data must be a JSON object"],
    [
      sliceError("inventory-tracker", { currencies: [] }),
      "Inventory Tracker data must include currencies, equipped, and inventory arrays",
    ],
    [
      { code: "invalidInventoryRow", group: "currencies", problem: { code: "notArray" } },
      'Inventory Tracker "currencies": must be an array',
    ],
    [inventoryRows(["Rope"]), 'Inventory Tracker "inventory": row 0 must be an object'],
    [inventoryRows([{ foo: 1 }]), 'Inventory Tracker "inventory": row 0 is missing a string "name"'],
    [inventoryRows([{ name: "Rope" }, { name: "  " }]), 'Inventory Tracker "inventory": row 1 has an empty "name"'],
    [
      inventoryRows([{ name: "Rope", location: 3 }]),
      'Inventory Tracker "inventory": row 0 has a non-string "location"',
    ],
    [inventoryRows([{ name: "Rope", qty: "lots" }]), 'Inventory Tracker "inventory": row 0 has a non-numeric "qty"'],
    [inventoryRows([{ name: "Rope", qty: 0 }]), 'Inventory Tracker "inventory": row 0 has a "qty" below 1'],
    [sliceError("quest", {}), "Active quests must be a JSON array"],
  ] as const) {
    assert.equal(renderEnglish(error), english);
  }

  // Accepted payloads still get the shared invariants applied.
  const equippedWins = inventorySlice.buildPatch(gameState, {
    currencies: [],
    equipped: [{ name: "Short axe" }],
    inventory: [{ name: "short  axe" }, { name: "Waterskin" }],
  }) as { playerStats: Record<string, unknown> };
  assert.deepEqual(
    equippedWins.playerStats.inventoryTrackerInventory,
    [{ name: "Waterskin" }],
    "an equipped item must not survive in carried inventory through the JSON editor",
  );
}
