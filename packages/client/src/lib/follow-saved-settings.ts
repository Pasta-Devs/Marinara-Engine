// ──────────────────────────────────────────────
// Settings apply to every window of the Engine
//
// A setting changed in one window (the split view's second side, the main
// window, or another browser tab of the app) is saved to this device's
// storage; every other window loads it from the storage event at once.
// Where each window is (open page, editor, Settings category, tabs) stays its
// own: only the settings in the save are taken.
// ──────────────────────────────────────────────
import { SPLIT_PLACE_FIELDS, forgetSplitPaneCopy } from "./split-view-env";
import { useUIStore } from "../stores/ui.store";
import { useOverhaulStore } from "../stores/overhaul.store";
import { useDeviceLookStore } from "../stores/device-look.store";

/** The saved fields of `persisted` that are settings, over `current` (which keeps its place). */
function takeSettings<S>(key: string, persisted: unknown, current: S): S {
  const place = SPLIT_PLACE_FIELDS[key];
  const settings = Object.fromEntries(
    Object.entries((persisted ?? {}) as Record<string, unknown>).filter(([field]) => !place?.test(field)),
  );
  return { ...current, ...settings };
}

/** Load the saved settings in one update that leaves this window's place out. */
function rehydrateSettings(key: string, store: typeof useUIStore | typeof useOverhaulStore) {
  // (Restoring the place afterwards let a render in between move this window to the other one's page.)
  const persist = store.persist as typeof useUIStore.persist;
  persist.setOptions({ merge: (persisted, current) => takeSettings(key, persisted, current) });
  void Promise.resolve(persist.rehydrate()).finally(() => persist.setOptions({ merge: undefined }));
}

let started = false;

export function followSavedSettings() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("storage", (event) => {
    if (event.storageArea !== window.localStorage || !event.key) return;
    if (event.key === "marinara-device-look") void useDeviceLookStore.persist.rehydrate();
    if (event.key === "marinara-engine-ui") {
      forgetSplitPaneCopy("marinara-engine-ui");
      forgetSplitPaneCopy("marinara-engine-ui:host");
      rehydrateSettings(event.key, useUIStore);
    }
    if (event.key === "marinara-overhaul-layout") {
      forgetSplitPaneCopy(event.key);
      rehydrateSettings(event.key, useOverhaulStore);
    }
  });
}
