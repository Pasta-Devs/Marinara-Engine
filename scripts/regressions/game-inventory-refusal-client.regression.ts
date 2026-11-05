/**
 * A refused buy or sale in the Game Master's reply is told to the player: the narration may already
 * say it happened. Other refused tags are not announced, and a sale an honest buyer saw through has
 * its own notice.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { gameInventoryRefusalKeys } from "../../packages/client/src/lib/game-inventory-refusal.js";

const locale = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url)),
    "utf8",
  ),
) as Record<string, string>;

const buy = gameInventoryRefusalKeys({ action: "buy", ok: false, reason: "not-here" });
assert.deepEqual(buy, {
  message: "ui.game.gamesurfacecomponent.inventoryBuyRefused",
  reason: "ui.game.gamesurfacecomponent.inventoryRefusedBecause.notHere",
});
assert.equal(
  gameInventoryRefusalKeys({ action: "sell", ok: false, reason: "purse-spent" })?.reason,
  "ui.game.gamesurfacecomponent.inventoryRefusedBecause.purseSpent",
);
assert.equal(
  gameInventoryRefusalKeys({ action: "buy", ok: false, reason: "too-many" })?.reason,
  "ui.game.gamesurfacecomponent.inventoryRefusedBecause.other",
  "an unexpected reason is told in general words",
);
assert.equal(gameInventoryRefusalKeys({ action: "buy", ok: true }), null, "a buy that went through is not a refusal");
assert.equal(gameInventoryRefusalKeys({ action: "add", ok: false, reason: "too-heavy" }), null, "only buys and sales");
assert.equal(
  gameInventoryRefusalKeys({ action: "sell", ok: false, reason: "not-bought", revealed: "Brass ring" }),
  null,
  "a fake seen through has its own notice",
);
assert.equal(
  gameInventoryRefusalKeys({ action: "buy", ok: false, reason: "held" }),
  null,
  "a buy held for a companion's warning is theirs to tell (1.802)",
);
// Every key it can return is in the locale.
const reasons = [
  "no-market",
  "no-place",
  "not-for-sale",
  "not-here",
  "no-seller",
  "not-to-you",
  "sold-out",
  "cannot-afford",
  "too-heavy",
  "not-bought",
  "purse-spent",
  "cursed",
  "none-held",
  "unapplied",
];
for (const action of ["buy", "sell"] as const) {
  for (const reason of reasons) {
    const keys = gameInventoryRefusalKeys({ action, ok: false, reason })!;
    assert.ok(locale[keys.message], keys.message);
    assert.ok(locale[keys.reason], keys.reason);
  }
}
console.log("Inventory refusals: a refused buy or sale is told, in words, and nothing else is.");
