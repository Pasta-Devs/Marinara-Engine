// ──────────────────────────────────────────────
// Per-device look
//
// The look settings (dark/light, Visual Style, accent and background colours,
// font and the custom CSS theme) normally sync across every device through the
// shared settings blob. A person can give one device its own look instead
// (say, a light theme on the phone and a dark one on the PC). While that's on:
//   • this device keeps its own values and never sends them to the server,
//   • pushes from this device carry the shared look it last saw, so other
//     devices are not changed,
//   • the custom CSS theme is picked per device instead of on the server.
// Everything here lives in this browser only.
// ──────────────────────────────────────────────
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** The synced settings that make up "the look". */
export const DEVICE_LOOK_KEYS = ["theme", "visualTheme", "appAccentColor", "appBackgroundColor", "fontFamily"] as const;
export type DeviceLookKey = (typeof DEVICE_LOOK_KEYS)[number];
export type LookValues = Partial<Record<DeviceLookKey, unknown>>;

interface DeviceLookState {
  /** This device has its own look. */
  enabled: boolean;
  /** The shared look as the server last had it, so pushes from here leave it alone. */
  sharedLook: LookValues;
  /** This device's custom CSS theme while `enabled`: an id, null for none, undefined to follow the server. */
  customThemeId: string | null | undefined;
  setSharedLook: (look: LookValues) => void;
  setCustomThemeId: (id: string | null | undefined) => void;
  setEnabled: (enabled: boolean, currentLook?: LookValues) => void;
}

export function pickLook(settings: Record<string, unknown>): LookValues {
  const look: LookValues = {};
  for (const key of DEVICE_LOOK_KEYS) {
    if (key in settings) look[key] = settings[key];
  }
  return look;
}

export const useDeviceLookStore = create<DeviceLookState>()(
  persist(
    (set) => ({
      enabled: false,
      sharedLook: {},
      customThemeId: undefined,
      setSharedLook: (sharedLook) => set({ sharedLook }),
      setCustomThemeId: (customThemeId) => set({ customThemeId }),
      // Turning it on: the current values are what every device shares right now.
      setEnabled: (enabled, currentLook) =>
        set(enabled ? { enabled, sharedLook: currentLook ?? {} } : { enabled, customThemeId: undefined }),
    }),
    { name: "marinara-device-look", version: 1 },
  ),
);

/** For a settings push: replace this device's own look with the shared one, while the device look is on. */
export function withSharedLook<T extends Record<string, unknown>>(settings: T): T {
  const { enabled, sharedLook } = useDeviceLookStore.getState();
  if (!enabled) return settings;
  const next: Record<string, unknown> = { ...settings };
  for (const key of DEVICE_LOOK_KEYS) {
    if (key in sharedLook) next[key] = sharedLook[key];
  }
  return next as T;
}

/** Asks the settings sync to send this device's settings now (used by "Use this look on every device"). */
export const SETTINGS_PUSH_NOW_EVENT = "marinara:settings-push-now";
