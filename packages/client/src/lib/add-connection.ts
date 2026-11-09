// Deep links into the Add connection window (decisions 32/33), for Defaults tiles, cards and the quick switch.
import type { APIProvider, ChatModelChoice } from "@marinara-engine/shared";
import type { DeviceItem } from "../hooks/use-device-setup";
import { useUIStore } from "../stores/ui.store";
import { queryClient } from "./query-client";
import type { JobKey } from "./connection-jobs";

/** An engine on this device, or the built-in decision model: opens its This device page or its job. */
export type SetupItem = DeviceItem | "decision-builtin";
export type AddConnectionTarget =
  | { category: "device"; item: SetupItem }
  /** A provider; a found local server also fills in its address and name. */
  | { provider: APIProvider; baseUrl?: string; name?: string }
  | AddFor;

/** A job the Add window can start from ("For a job..."); the jobs live in `connection-jobs.ts`. */
export type AddJob = JobKey;
export type AddKind = "chat" | "image" | "video" | "voice" | "decision";
/**
 * Add for a job (a job picker's "Add a model for this…", a feature with no model yet): the window starts filtered
 * to the job's kind, and Done sets the new Model for it with an Undo toast. `assign` is the picker's own setter
 * (`previous` is what Undo puts back); without it the window sets the job's own default where it has one.
 */
export type AddFor = {
  job?: AddJob;
  kind?: AddKind;
  assign?: (connectionId: string | null) => void;
  previous?: string | null;
};

/** The big model screen for one Connection. */
export type ModelsFor = {
  accountId: string;
  /** Optionally open a supported model kind directly. */
  kind?: "chat" | "image" | "video" | "decision";
  /** The Model whose stars the screen shows; the Connection's first chat Model by default. */
  connectionId?: string;
  /**
   * Opened from a chat's quick switch: a tap uses the model in that chat only (decision 26) and closes the
   * screen; a star still adds the model to the Connection.
   */
  chat?: { currentModel: string | null; onChoose: (choice: ChatModelChoice) => Promise<void> };
};

/**
 * Opens the Add window, on one provider's address step when a target is given. Engines on this device are no
 * providers: the built-in model (and its decision model) opens its This device page, voice and dictation their jobs.
 */
export function openAddConnection(target?: AddConnectionTarget) {
  const { openModal } = useUIStore.getState();
  if (target && "item" in target) {
    if (target.item === "stt") return openModal("job-settings", { job: "stt" });
    if (target.item === "tts") {
      // With voice on, its settings; with voice off, the picker that turns it on.
      const on = queryClient.getQueryData<{ enabled?: boolean }>(["tts", "config"])?.enabled;
      return openModal(on ? "job-settings" : "job-picker", { job: "voice" });
    }
    return openModal("device-detail", { item: "local-model" });
  }
  if (target && !("provider" in target)) return openModal("create-connection", { forJob: target });
  openModal("create-connection", target && { service: target.provider, baseUrl: target.baseUrl, name: target.name });
}

/** Opens the big model screen for one Connection (Add model, Browse all models). */
export function openAddModels(modelsFor: ModelsFor) {
  useUIStore.getState().openModal("create-connection", { modelsFor });
}

/**
 * After adding: scrolls the panel to the Connection's card. The card can render a
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
}
