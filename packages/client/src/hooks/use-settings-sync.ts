// ──────────────────────────────────────────────
// Hook: Cross-device UI settings sync
// ──────────────────────────────────────────────
// On mount: fetches the server's saved settings blob and overlays it onto the
// UI store so every browser/device sees the same shared preferences. Device-
// local preferences such as interface and chat text size stay in browser
// storage and are ignored when older server blobs still contain them. If the
// server has no blob yet, the current local shared state is pushed as the
// initial seed (one-time migration for users upgrading from browser-only
// storage).
//
// While the app runs: subscribes to UI store changes, debounces serialization,
// and pushes the synced subset to the server. Only user-facing preference
// edits trigger a push — transient UI state (modal open, detail panels, etc.)
// is filtered out via `pickSyncedSettings`.
import { useEffect } from "react";
import {
  normalizeImageStyleProfileSettings,
  normalizeQuoteFormat,
  type AppSettingsResponse,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { normalizeConversationTimeZone } from "../lib/conversation-time-zone";
import {
  normalizeTrackerPanelCollapsedSections,
  normalizeTrackerPanelSectionOrder,
  normalizeTrackerPanelSizeProfile,
  normalizeTrackerStatDisplayMode,
  normalizeTrackerTemperatureUnit,
  normalizeTrackerThoughtBubbleDisplay,
  normalizeScenePromptPreferences,
  pickSyncedSettings,
  useUIStore,
} from "../stores/ui.store";

const SETTINGS_KEY = "ui";
const SETTINGS_PATH = `/app-settings/${SETTINGS_KEY}`;
const LOCAL_SETTINGS_KEY = "marinara-engine-ui";
const LOCAL_UPDATED_AT_KEY = "marinara-engine-ui-updated-at";
const DEBOUNCE_MS = 1000;

type SyncedSettingsObject = ReturnType<typeof pickSyncedSettings>;
type ServerSettingsPayload = SyncedSettingsObject & { __updatedAt?: number };
type ParsedSettings = Partial<SyncedSettingsObject> & Record<string, unknown>;

const LOCAL_ONLY_SETTING_KEYS = [
  "fontSize",
  "chatFontSize",
  "trackerPanelOpen",
  "impersonatePromptTemplate",
  "activeImpersonatePromptTemplateId",
] as const;

export function omitLocalOnlySettings(settings: ParsedSettings): ParsedSettings {
  const sanitized = { ...settings };
  for (const key of LOCAL_ONLY_SETTING_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}

export function hasMissingSyncedSettings(settings: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  return expectedKeys.some((key) => !(key in settings));
}

export function mergeUndatedSyncedSettings(
  localSettings: SyncedSettingsObject,
  serverSettings: ParsedSettings,
): SyncedSettingsObject {
  return { ...localSettings, ...serverSettings } as SyncedSettingsObject;
}

function readLocalUpdatedAt(): number | null {
  const value = window.localStorage.getItem(LOCAL_UPDATED_AT_KEY);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function writeLocalUpdatedAt(updatedAt: number): void {
  window.localStorage.setItem(LOCAL_UPDATED_AT_KEY, String(updatedAt));
}

function hasLocalPersistedUiState(): boolean {
  return window.localStorage.getItem(LOCAL_SETTINGS_KEY) !== null;
}

function serializeSettings(settings: SyncedSettingsObject): string {
  return JSON.stringify(settings);
}

function buildServerSettingsValue(settings: SyncedSettingsObject, updatedAt: number): string {
  return JSON.stringify({ ...settings, __updatedAt: updatedAt } satisfies ServerSettingsPayload);
}

function parseServerSettingsValue(value: string): {
  settings: ParsedSettings;
  updatedAt: number | null;
} {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid settings payload");
  }

  const payload = { ...(parsed as ServerSettingsPayload) };
  const updatedAt =
    typeof payload.__updatedAt === "number" && Number.isFinite(payload.__updatedAt) ? payload.__updatedAt : null;
  delete payload.__updatedAt;
  return { settings: payload, updatedAt };
}

export function useSettingsSync() {
  useEffect(() => {
    let disposed = false;
    let ready = false;
    let pushTimer: ReturnType<typeof setTimeout> | null = null;
    let lastPushed = "";
    let pendingUpdatedAt: number | null = null;

    const serialize = () => serializeSettings(pickSyncedSettings(useUIStore.getState()));

    const pushNow = () => {
      pushTimer = null;
      if (disposed) return;
      const settings = pickSyncedSettings(useUIStore.getState());
      const settingsFingerprint = serializeSettings(settings);
      if (settingsFingerprint === lastPushed) return;
      const updatedAt = pendingUpdatedAt ?? readLocalUpdatedAt() ?? Date.now();
      pendingUpdatedAt = null;
      writeLocalUpdatedAt(updatedAt);
      lastPushed = settingsFingerprint;
      api.put(SETTINGS_PATH, { value: buildServerSettingsValue(settings, updatedAt) }).catch(() => {
        // Server unreachable — next change will retry. We keep `lastPushed`
        // as the failed payload so we only re-send when the user actually
        // changes something again.
      });
    };

    const schedulePush = () => {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(pushNow, DEBOUNCE_MS);
    };

    const flushNow = () => {
      if (pushTimer) {
        clearTimeout(pushTimer);
        pushTimer = null;
        pushNow();
      }
    };

    const unsubscribe = useUIStore.subscribe((state, prev) => {
      if (!ready || disposed) return;
      const current = serializeSettings(pickSyncedSettings(state));
      const previous = serializeSettings(pickSyncedSettings(prev));
      if (current !== previous) {
        pendingUpdatedAt = Date.now();
        writeLocalUpdatedAt(pendingUpdatedAt);
        schedulePush();
      }
    });

    // Flush any pending edits before the tab closes so they reach the server.
    const handleBeforeUnload = () => flushNow();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void (async () => {
      try {
        const localSettings = pickSyncedSettings(useUIStore.getState());
        const localFingerprint = serializeSettings(localSettings);
        const defaultFingerprint = serializeSettings(pickSyncedSettings(useUIStore.getInitialState()));
        const localCustomized = hasLocalPersistedUiState() && localFingerprint !== defaultFingerprint;
        const localUpdatedAt = readLocalUpdatedAt();
        const hasTrustedLocalTimestamp = localUpdatedAt !== null;

        const data = await api.get<AppSettingsResponse>(SETTINGS_PATH);
        if (disposed) return;
        if (data.value) {
          try {
            const parsed = parseServerSettingsValue(data.value);
            if (parsed.settings && typeof parsed.settings === "object") {
              const hadLocalOnlySettings = LOCAL_ONLY_SETTING_KEYS.some((key) => key in parsed.settings);
              const hadMissingSyncedSettings = hasMissingSyncedSettings(parsed.settings, Object.keys(localSettings));
              parsed.settings = omitLocalOnlySettings(parsed.settings);

              // Migrate old flat gradient fields → per-scheme nested (v10 → v11).
              if ("convoGradientFrom" in parsed.settings || "convoGradientTo" in parsed.settings) {
                const legacyGradientFrom =
                  typeof parsed.settings.convoGradientFrom === "string" ? parsed.settings.convoGradientFrom : "#0a0a0e";
                const legacyGradientTo =
                  typeof parsed.settings.convoGradientTo === "string" ? parsed.settings.convoGradientTo : "#1c2133";
                parsed.settings.convoGradient = {
                  dark: {
                    from: legacyGradientFrom,
                    to: legacyGradientTo,
                  },
                  light: { from: "#f2eff7", to: "#eae6f0" },
                };
                delete parsed.settings.convoGradientFrom;
                delete parsed.settings.convoGradientTo;
              }
              if ("trackerPanelSizeProfile" in parsed.settings || "trackerPanelWidth" in parsed.settings) {
                parsed.settings.trackerPanelSizeProfile = normalizeTrackerPanelSizeProfile(
                  parsed.settings.trackerPanelSizeProfile,
                  parsed.settings.trackerPanelWidth,
                );
                delete parsed.settings.trackerPanelWidth;
              }
              // The synced blob predates every section added after it was written, so a
              // server order captured before a new tracker section shipped would hide
              // that section forever — `migrate` only normalizes the browser-local copy,
              // and the `setState` below overwrites it. `staleSyncedShape` forces the
              // corrected value back to the server; without it the stale array survives
              // and re-arrives on every other device.
              let staleSyncedShape = false;
              if ("trackerPanelSectionOrder" in parsed.settings) {
                const normalizedOrder = normalizeTrackerPanelSectionOrder(parsed.settings.trackerPanelSectionOrder);
                if (!Array.isArray(parsed.settings.trackerPanelSectionOrder)) {
                  staleSyncedShape = true;
                } else if (
                  parsed.settings.trackerPanelSectionOrder.length !== normalizedOrder.length ||
                  normalizedOrder.some(
                    (section, index) => parsed.settings.trackerPanelSectionOrder?.[index] !== section,
                  )
                ) {
                  staleSyncedShape = true;
                }
                parsed.settings.trackerPanelSectionOrder = normalizedOrder;
              }
              if ("trackerPanelCollapsedSections" in parsed.settings) {
                const normalizedCollapsed = normalizeTrackerPanelCollapsedSections(
                  parsed.settings.trackerPanelCollapsedSections,
                );
                if (
                  JSON.stringify(parsed.settings.trackerPanelCollapsedSections) !== JSON.stringify(normalizedCollapsed)
                ) {
                  staleSyncedShape = true;
                }
                parsed.settings.trackerPanelCollapsedSections = normalizedCollapsed;
              }
              if ("trackerPanelThoughtBubbleDisplay" in parsed.settings) {
                parsed.settings.trackerPanelThoughtBubbleDisplay = normalizeTrackerThoughtBubbleDisplay(
                  parsed.settings.trackerPanelThoughtBubbleDisplay,
                );
              }
              if ("trackerStatDisplayMode" in parsed.settings) {
                parsed.settings.trackerStatDisplayMode = normalizeTrackerStatDisplayMode(
                  parsed.settings.trackerStatDisplayMode,
                );
              }
              if ("trackerPanelDockedThoughtsAlwaysVisible" in parsed.settings) {
                parsed.settings.trackerPanelDockedThoughtsAlwaysVisible =
                  parsed.settings.trackerPanelDockedThoughtsAlwaysVisible === true;
              }
              if ("trackerTemperatureUnit" in parsed.settings) {
                parsed.settings.trackerTemperatureUnit = normalizeTrackerTemperatureUnit(
                  parsed.settings.trackerTemperatureUnit,
                );
              }
              if ("quoteFormat" in parsed.settings) {
                parsed.settings.quoteFormat = normalizeQuoteFormat(parsed.settings.quoteFormat);
              }
              if ("imageStyleProfiles" in parsed.settings) {
                parsed.settings.imageStyleProfiles = normalizeImageStyleProfileSettings(
                  parsed.settings.imageStyleProfiles,
                );
              }
              if ("scenePromptPreferences" in parsed.settings) {
                parsed.settings.scenePromptPreferences = normalizeScenePromptPreferences(
                  parsed.settings.scenePromptPreferences,
                );
              }
              if ("conversationTimeZone" in parsed.settings) {
                parsed.settings.conversationTimeZone = normalizeConversationTimeZone(
                  parsed.settings.conversationTimeZone,
                );
              }

              const serverUpdatedAt = parsed.updatedAt;
              const localIsNewer =
                hasTrustedLocalTimestamp &&
                (serverUpdatedAt === null ? localCustomized : localUpdatedAt > serverUpdatedAt);

              if (!hasTrustedLocalTimestamp) {
                // An undated browser cache has no trustworthy ordering signal.
                // Keep its values only for keys absent from the server, then
                // rewrite the merged complete profile with a real timestamp.
                useUIStore.setState(mergeUndatedSyncedSettings(localSettings, parsed.settings));
                lastPushed = serialize();
                const rewriteUpdatedAt = Date.now();
                try {
                  await api.put(SETTINGS_PATH, {
                    value: buildServerSettingsValue(pickSyncedSettings(useUIStore.getState()), rewriteUpdatedAt),
                  });
                  writeLocalUpdatedAt(rewriteUpdatedAt);
                } catch {
                  // Best-effort recovery. The in-memory merge still protects
                  // server-present preferences for this session.
                }
              } else if (localIsNewer) {
                lastPushed = "";
                pushNow();
              } else {
                useUIStore.setState(parsed.settings);
                lastPushed = serialize();
                if (serverUpdatedAt !== null) writeLocalUpdatedAt(serverUpdatedAt);
                if (hadLocalOnlySettings || hadMissingSyncedSettings || staleSyncedShape) {
                  try {
                    const rewriteUpdatedAt =
                      hadMissingSyncedSettings || staleSyncedShape ? Date.now() : (serverUpdatedAt ?? Date.now());
                    await api.put(SETTINGS_PATH, {
                      value: buildServerSettingsValue(pickSyncedSettings(useUIStore.getState()), rewriteUpdatedAt),
                    });
                    writeLocalUpdatedAt(rewriteUpdatedAt);
                  } catch {
                    // Rewriting legacy/incomplete blobs is best-effort. This
                    // browser still ignores removed keys and retains local
                    // values for newly synced preferences.
                  }
                }
              }
            }
          } catch {
            // Corrupt blob on the server — ignore and let the next edit overwrite it.
            lastPushed = serialize();
          }
        } else {
          // Server has no settings yet — seed it with whatever is in the local
          // store (either defaults or previously-localStorage-persisted values).
          const settings = pickSyncedSettings(useUIStore.getState());
          const updatedAt = localUpdatedAt ?? Date.now();
          writeLocalUpdatedAt(updatedAt);
          const payload = serializeSettings(settings);
          lastPushed = payload;
          try {
            await api.put(SETTINGS_PATH, { value: buildServerSettingsValue(settings, updatedAt) });
          } catch {
            // Seed failed; leave `lastPushed` set so the next change triggers a retry.
          }
        }
      } catch {
        // Server unreachable at startup — run with local state only.
        lastPushed = serialize();
      } finally {
        if (!disposed) ready = true;
      }
    })();

    return () => {
      flushNow();
      disposed = true;
      unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
