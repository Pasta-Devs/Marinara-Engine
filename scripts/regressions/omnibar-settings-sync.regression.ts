import assert from "node:assert/strict";
import { UI_PERSISTENCE } from "../../packages/client/src/lib/ui-persistence.js";

// Omnibar and Professor Mari choices must follow the user to other browsers, so every one of them
// has to be in the server-synced set, and the old browser-only picks must be staged once for the server copy.
const LEGACY_MARI_CONNECTION_KEY = "marinara:home-professor-mari-connection-id";
const stored = new Map<string, string>([
  [
    UI_PERSISTENCE.name,
    JSON.stringify({
      state: { hasCompletedOnboarding: true, omnibarAsideConnectionId: "quick-model" },
      version: 103,
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

  const state = useUIStore.getState() as unknown as Record<string, unknown>;
  for (const key of ["mariConnectionId", "omnibarAsideConnectionId", "impersonateConnectionId"]) {
    assert.ok(!(key in state), `${key} lives in the server feature-model setting, not in the store`);
  }
  assert.deepEqual(
    JSON.parse(stored.get("marinara:legacy-feature-models") ?? "null"),
    { mariConnectionId: "mari-connection", omnibarAsideConnectionId: "quick-model", impersonateConnectionId: null },
    "the migration stages the old picks (Mari's old browser key included) for the one-time server copy",
  );

  const synced = pickSyncedSettings(useUIStore.getState());
  const persistedKeys = Object.keys(pickPersistedUIState(useUIStore.getState()));
  const omnibarOrMariKeys = persistedKeys.filter((key) => /omnibar|mari/iu.test(key));
  for (const key of omnibarOrMariKeys) {
    assert.ok(key in synced, `${key} is a saved Omnibar or Professor Mari setting and must sync to the server`);
  }

  // A fresh browser has no local timestamp, so the server value must replace the local default.
  const fresh = mergeUndatedSyncedSettings(pickSyncedSettings(useUIStore.getInitialState()), {
    omnibarAsideEnabled: true,
  });
  assert.equal(fresh.omnibarAsideEnabled, true, "a server value wins over the default");

  // Let the debounced browser-storage write land before the fake storage is removed.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  console.info("Omnibar and Professor Mari settings sync regression passed.");
} finally {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
}
