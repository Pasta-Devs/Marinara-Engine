// The inventory tracker: which items and currency a reply says the character acquired.
import assert from "node:assert/strict";
import { findInventoryTrackerAcquisitions } from "../../../packages/server/src/routes/generate/generate-route-utils.js";

const inventoryTrackerAcquisitions = findInventoryTrackerAcquisitions(
  {
    inventoryTrackerCurrencies: [{ name: "Mora", qty: 10 }],
    inventoryTrackerEquipped: [],
    inventoryTrackerInventory: [{ name: "Scalpel" }],
  },
  {
    inventoryTrackerCurrencies: [{ name: "Mora", qty: 15 }],
    inventoryTrackerEquipped: [{ name: "Scalpel" }],
    inventoryTrackerInventory: [{ name: "Delusion", qty: 2 }],
  },
);
assert.deepEqual(
  inventoryTrackerAcquisitions,
  [
    { name: "Mora", quantity: 5 },
    { name: "Delusion", quantity: 2 },
  ],
  "Inventory journal deltas must count quantity gains without treating equipped moves as acquisitions",
);
