// What a refused buy or sale in the Game Master's reply is told to the player as. The Game Master writes
// its narration before the Engine answers its tags, so the prose can say a purchase was made that the
// Engine refused (not sold here, too dear); the player is told, and the Game Master reads the refusal
// back next turn.
import type { ResolvedInventoryTag } from "@marinara-engine/shared";

/** The reasons said in words of their own; any other is the general one. */
const SAID = new Set([
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
]);

/** The message and reason keys for a refused buy or sale, or null for anything else. A sale an honest
 *  buyer saw through is told by the fake's own notice. */
export function gameInventoryRefusalKeys(
  update: Pick<ResolvedInventoryTag, "action" | "ok" | "reason" | "revealed">,
): { message: string; reason: string } | null {
  if (update.ok || (update.action !== "buy" && update.action !== "sell")) return null;
  if (update.action === "sell" && update.revealed) return null;
  // A buy held for a companion's warning (1.802) is the companion's to tell, in the story.
  if (update.action === "buy" && update.reason === "held") return null;
  const reason = update.reason && SAID.has(update.reason) ? update.reason : "other";
  return {
    message: `ui.game.gamesurfacecomponent.${update.action === "buy" ? "inventoryBuyRefused" : "inventorySellRefused"}`,
    // Locale keys are camel case: "not-here" is told by `notHere`.
    reason: `ui.game.gamesurfacecomponent.inventoryRefusedBecause.${reason.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`,
  };
}

type Localize = (key: string, values?: Record<string, string>) => string;

/** What a refused inventory change says, by why it was refused. Shared by the inventory panel and the
 *  State Editor's Game data inventory. `who` is the bag a weight was too much for: a name, "" for the
 *  player's own, or absent when the whole party was asked. `fallbackKey` words any other reason. */
export function describeGameInventoryRefusal(
  localizeUi: Localize,
  reason: string | undefined,
  value1: string,
  fallbackKey: string,
  who?: string,
): string {
  switch (reason) {
    case "not-ruleset-item":
      return localizeUi("ui.game.gamesurfacecomponent.notARulesetItemValue1", { value1 });
    case "too-heavy":
      return who === undefined
        ? localizeUi("ui.game.gamesurfacecomponent.nobodyCanCarryValue1", { value1 })
        : who
          ? localizeUi("ui.game.gamesurfacecomponent.whoCannotCarryValue1", { who, value1 })
          : localizeUi("ui.game.gamesurfacecomponent.youCannotCarryValue1", { value1 });
    case "cursed":
      return localizeUi("ui.game.gamesurfacecomponent.cursedValue1", { value1 });
    case "service":
      return localizeUi("ui.game.gamesurfacecomponent.serviceValue1", { value1 });
    case "no-slot":
      return localizeUi("ui.game.gamesurfacecomponent.noSlotValue1", { value1 });
    case "not-wearable":
      return localizeUi("ui.game.gamesurfacecomponent.notWearableValue1", { value1 });
    case "not-bindable":
      return localizeUi("ui.game.gamesurfacecomponent.notBindableValue1", { value1 });
    case "binding-full":
      return localizeUi("ui.game.gamesurfacecomponent.bindingFullValue1", { value1 });
    case "needs-worn":
      return localizeUi("ui.game.gamesurfacecomponent.needsWornValue1", { value1 });
    case "missing-stack":
      return localizeUi("ui.game.gamesurfacecomponent.thatStackIsNoLongerInYourInventory");
    default:
      return localizeUi(fallbackKey, { value1 });
  }
}
