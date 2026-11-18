// The UI store's saved settings: old and current tracker settings migrate to the same clean values, Send on Enter
// stays on the device while other settings sync, and every synced setting is also kept in browser storage. Also two
// store defaults: Narrator avatar cycling starts on, and opening a preset remembers which tab was asked for.
import assert from "node:assert/strict";
import type { ChatMode } from "../../../packages/shared/src/types/chat.js";

// The UI store needs browser storage while Zustand initializes its persisted state.
// Supply an isolated in-memory implementation so these checks exercise its real
// migration and projection functions in this Node-based regression lane.
const uiStorage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => uiStorage.get(key) ?? null,
    setItem: (key: string, value: string) => uiStorage.set(key, value),
    removeItem: (key: string) => uiStorage.delete(key),
  },
});
const { pickSyncedSettings, useUIStore } = await import("../../../packages/client/src/stores/ui.store.js");
const migrateUiSettings = useUIStore.persist.getOptions().migrate;
assert.ok(migrateUiSettings, "The UI store must retain its persisted-state migration");
const representativeTrackerSettings = {
  trackerPanelCollapsedSections: { world: true, invalid: true },
  trackerPanelUseExpressionSprites: undefined,
  trackerPanelSectionOrder: ["quests", "world", "world", "invalid"],
  summaryPopoverSettings: {
    sourceMode: "range",
    contextSize: 11.8,
    rangeStart: 4.2,
    rangeEnd: 9.7,
    hideSummarisedMessages: true,
    collapseHiddenMessages: false,
  },
  trackerPanelThoughtBubbleDisplay: "floating",
  trackerPanelSizeProfile: "invalid",
  trackerPanelWidth: 280,
  trackerTemperatureUnit: "kelvin",
  trackerPanelDockedThoughtsAlwaysVisible: undefined,
  quoteFormat: "invalid",
  trackerPanelBackgroundColor: "  #123456  ",
};
const migrateRepresentativeTrackerSettings = async (version: number) =>
  (await migrateUiSettings(structuredClone(representativeTrackerSettings), version)) as Record<string, unknown>;
const oldTrackerSettings = await migrateRepresentativeTrackerSettings(0);
const currentTrackerSettings = await migrateRepresentativeTrackerSettings(92);
const trackerMigrationProjection = (settings: Record<string, unknown>) => ({
  trackerPanelCollapsedSections: settings.trackerPanelCollapsedSections,
  trackerPanelUseExpressionSprites: settings.trackerPanelUseExpressionSprites,
  trackerPanelSectionOrder: settings.trackerPanelSectionOrder,
  summaryPopoverSettings: settings.summaryPopoverSettings,
  trackerPanelThoughtBubbleDisplay: settings.trackerPanelThoughtBubbleDisplay,
  trackerPanelSizeProfile: settings.trackerPanelSizeProfile,
  trackerTemperatureUnit: settings.trackerTemperatureUnit,
  trackerPanelDockedThoughtsAlwaysVisible: settings.trackerPanelDockedThoughtsAlwaysVisible,
  quoteFormat: settings.quoteFormat,
  trackerPanelBackgroundColor: settings.trackerPanelBackgroundColor,
});
assert.deepEqual(
  trackerMigrationProjection(oldTrackerSettings),
  trackerMigrationProjection(currentTrackerSettings),
  "Old and current persisted tracker settings must share the unconditional canonicalizers",
);
assert.deepEqual(trackerMigrationProjection(currentTrackerSettings), {
  trackerPanelCollapsedSections: { world: true },
  trackerPanelUseExpressionSprites: false,
  trackerPanelSectionOrder: ["quests", "world", "persona", "characters", "inventory", "custom"],
  summaryPopoverSettings: {
    sourceMode: "range",
    contextSize: 12,
    rangeStart: 4,
    rangeEnd: 10,
    hideSummarisedMessages: true,
    collapseHiddenMessages: false,
  },
  trackerPanelThoughtBubbleDisplay: "floating",
  trackerPanelSizeProfile: "compact",
  trackerTemperatureUnit: "celsius",
  trackerPanelDockedThoughtsAlwaysVisible: false,
  quoteFormat: "straight",
  trackerPanelBackgroundColor: "#123456",
});
const projectionState = {
  ...useUIStore.getState(),
  showHomeBrowserAddressBar: false,
  enterToSendGame: false,
  enterToSendProfessorMari: false,
  chatHelpSeenModes: ["game"] as ChatMode[],
};
assert.equal(
  pickSyncedSettings(projectionState).showHomeBrowserAddressBar,
  false,
  "Home URL bar visibility must be saved per installation",
);
// #9389: Send on Enter depends on the device's keyboard (a phone wants Enter for new lines, a PC wants it to
// send), so the four toggles are saved per device: kept in browser storage, never synced.
for (const key of ["enterToSendRP", "enterToSendConvo", "enterToSendGame", "enterToSendProfessorMari"] as const) {
  assert.ok(!(key in pickSyncedSettings(projectionState)), `${key} must stay off the cross-device settings blob`);
}
assert.deepEqual(
  pickSyncedSettings(projectionState).chatHelpSeenModes,
  ["game"],
  "The chat-help seen modes must be server-synced",
);
const localProjection = useUIStore.persist.getOptions().partialize(projectionState) as Record<string, unknown>;
const syncedSettingsMissingFromLocalPersistence = Object.keys(pickSyncedSettings(projectionState)).filter(
  (key) => !Object.prototype.hasOwnProperty.call(localProjection, key),
);
assert.deepEqual(
  syncedSettingsMissingFromLocalPersistence,
  [],
  "Every server-synced setting must also be browser-local persisted",
);
assert.deepEqual(localProjection.chatHelpSeenModes, ["game"], "Chat-help seen modes must be browser-local persisted");
assert.equal(localProjection.enterToSendGame, false, "Game's Send on Enter must be browser-local persisted");
assert.equal(
  localProjection.enterToSendProfessorMari,
  false,
  "Professor Mari's Send on Enter must be browser-local persisted",
);

assert.equal(
  useUIStore.getState().roleplayNarratorAvatarCycling,
  true,
  "Narrator avatar cycling must remain enabled by default",
);
useUIStore.getState().openPresetDetail("preset-1", { initialTab: "sections" });
assert.equal(useUIStore.getState().presetDetailId, "preset-1");
assert.equal(
  useUIStore.getState().presetDetailInitialTab,
  "sections",
  "Preset navigation must retain an optional initial tab request",
);
useUIStore.getState().openPresetDetail("preset-2");
assert.equal(useUIStore.getState().presetDetailInitialTab, null, "a plain open starts at the preset's first tab");
