import assert from "node:assert/strict";
import { UI_PERSISTENCE } from "../../packages/client/src/lib/ui-persistence.js";

// Exercise the real Zustand persistence adapter without a browser or storage delay.
const stored = new Map<string, string>([
  [UI_PERSISTENCE.name, JSON.stringify({ state: { hasCompletedOnboarding: true }, version: UI_PERSISTENCE.version })],
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
  assert.equal(useUIStore.getInitialState().chatWindowIntroDismissed, false, "fresh users see the introduction");
  assert.equal(useUIStore.getState().hasCompletedOnboarding, true, "the older browser state was hydrated");
  assert.equal(useUIStore.getState().chatWindowIntroDismissed, false, "existing users without the flag see it once");

  useUIStore.getState().dismissChatWindowIntro();
  const saved = stored.get(UI_PERSISTENCE.name)!;
  assert.equal(JSON.parse(saved).state.chatWindowIntroDismissed, true, "Got it is saved before a reload can occur");
  assert.equal(pickPersistedUIState(useUIStore.getState()).chatWindowIntroDismissed, true);
  assert.equal(
    pickSyncedSettings(useUIStore.getState()).chatWindowIntroDismissed,
    true,
    "dismissal reaches other devices",
  );
  assert.equal(useUIStore.getState().chatSettingsMoveTipDismissed, false, "the separate launcher tip is unchanged");

  useUIStore.setState({ chatWindowIntroDismissed: false });
  stored.set(UI_PERSISTENCE.name, saved);
  await useUIStore.persist.rehydrate();
  assert.equal(useUIStore.getState().chatWindowIntroDismissed, true, "a new hydration restores the dismissal");
  console.info("Chat window introduction persistence regression passed.");
} finally {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
}
