// Deep links into the Add connection window (decisions 32/33), for Defaults tiles, cards and the quick switch.
import type { APIProvider, ChatModelChoice } from "@marinara-engine/shared";
import type { DeviceItem } from "../hooks/use-device-setup";
import { useUIStore } from "../stores/ui.store";

export type AddConnectionTarget = { category: "device"; item: DeviceItem } | { provider: APIProvider };

/** The big model screen for one Connection. */
export type ModelsFor = {
  accountId: string;
  /** Optionally open a supported model kind directly. */
  kind?: "chat" | "image" | "video";
  /** The Model whose stars the screen shows; the Connection's first chat Model by default. */
  connectionId?: string;
  /**
   * Opened from a chat's quick switch: a tap uses the model in that chat only (decision 26) and closes the
   * screen; a star still adds the model to the Connection.
   */
  chat?: { currentModel: string | null; onChoose: (choice: ChatModelChoice) => Promise<void> };
};

const DEVICE_SERVICES = { "local-model": "local_model", tts: "tts", stt: "stt" } as const;

/** Opens the Add window, on one service's set-up screen when a target is given. */
export function openAddConnection(target?: AddConnectionTarget) {
  const service = !target ? undefined : "item" in target ? DEVICE_SERVICES[target.item] : target.provider;
  useUIStore.getState().openModal("create-connection", service ? { service } : undefined);
}

/** Opens the big model screen for one Connection (Add model, Browse all models). */
export function openAddModels(modelsFor: ModelsFor) {
  useUIStore.getState().openModal("create-connection", { modelsFor });
}

/**
 * After adding: scrolls the panel to the Connection's card and flashes its blue rail once. The card can render a
 * moment after the window closes (the list refetches), so it looks again for a short while; with no panel open
 * nothing happens.
 */
export function flashConnectionCard(accountId: string, tries = 20) {
  const card = [
    ...document.querySelectorAll<HTMLElement>(`[data-connection-account-id="${CSS.escape(accountId)}"]`),
  ].find((element) => element.getClientRects().length > 0);
  if (!card) {
    if (tries > 0) window.setTimeout(() => flashConnectionCard(accountId, tries - 1), 100);
    return;
  }
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  card.classList.remove("mari-connection-flash");
  void card.offsetWidth;
  card.classList.add("mari-connection-flash");
  window.setTimeout(() => card.classList.remove("mari-connection-flash"), 1200);
}
