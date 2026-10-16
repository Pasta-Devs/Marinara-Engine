// Deep links into the Add connection window (decisions 32/33), for Defaults tiles, cards and the quick switch.
import type { APIProvider, ChatModelChoice } from "@marinara-engine/shared";
import type { DeviceItem } from "../hooks/use-device-setup";
import { useUIStore } from "../stores/ui.store";

export type AddConnectionTarget = { category: "device"; item: DeviceItem } | { provider: APIProvider };

/** The big model screen for one Connection. */
export type ModelsFor = {
  accountId: string;
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
