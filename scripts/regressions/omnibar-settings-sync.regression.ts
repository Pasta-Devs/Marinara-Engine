import assert from "node:assert/strict";
import { UI_PERSISTENCE } from "../../packages/client/src/lib/ui-persistence.js";

// Omnibar and Professor Mari choices must follow the user to other browsers, so every one of them
// has to be in the server-synced set, and the old browser-only Mari connection key must migrate once.
const LEGACY_MARI_CONNECTION_KEY = "marinara:home-professor-mari-connection-id";
const stored = new Map<string, string>([
  [
    UI_PERSISTENCE.name,
    JSON.stringify({
      state: { hasCompletedOnboarding: true, omnibarAsideConnectionId: "quick-model" },
      version: 102,
    }),
  ],
  [LEGACY_MARI_CONNECTION_KEY, "mari-connection"],
]);
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  },
});

try {
  const { useUIStore, pickPersistedUIState, pickSyncedSettings } =
    await import("../../packages/client/src/stores/ui.store.js");
  const { mergeUndatedSyncedSettings } = await import("../../packages/client/src/hooks/use-settings-sync.js");

  const state = useUIStore.getState();
  assert.equal(state.mariConnectionId, "mari-connection", "the v103 migration reads Mari's old browser key once");
  assert.equal(state.omnibarAsideConnectionId, "quick-model", "the Quick answer model survives the migration");

  const synced = pickSyncedSettings(state);
  const persistedKeys = Object.keys(pickPersistedUIState(state));
  const omnibarOrMariKeys = persistedKeys.filter((key) => /omnibar|mari/iu.test(key));
  for (const key of omnibarOrMariKeys) {
    assert.ok(key in synced, `${key} is a saved Omnibar or Professor Mari setting and must sync to the server`);
  }
  assert.ok(omnibarOrMariKeys.includes("mariConnectionId"), "Mari's connection is one of the saved settings");

  // A fresh browser has no local timestamp, so the server value must replace the local default.
  const fresh = mergeUndatedSyncedSettings(pickSyncedSettings(useUIStore.getInitialState()), {
    omnibarAsideConnectionId: "server-quick-model",
    mariConnectionId: "server-mari-connection",
  });
  assert.equal(
    fresh.omnibarAsideConnectionId,
    "server-quick-model",
    "a server Quick answer model wins over the default",
  );
  assert.equal(fresh.mariConnectionId, "server-mari-connection", "a server Mari connection wins over the default");

  // The old key is only read by the migration, so a later write does not depend on it.
  useUIStore.getState().setMariConnectionId("new-mari-connection");
  assert.equal(pickSyncedSettings(useUIStore.getState()).mariConnectionId, "new-mari-connection");
  // Let the debounced browser-storage write land before the fake storage is removed.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  console.info("Omnibar and Professor Mari settings sync regression passed.");
} finally {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
}
