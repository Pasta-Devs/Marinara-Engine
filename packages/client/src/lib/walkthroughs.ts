// ──────────────────────────────────────────────
// Walkthroughs: which tours this browser has seen, per kind of device
// ──────────────────────────────────────────────
// The main tour and the per-mode chat help are synced settings, so a user who finished them on a PC
// never saw them on a phone. This record lives only in this browser's storage: the first time a phone,
// tablet or computer opens Marinara, it gets that device's walkthrough, and the first time each chat
// mode opens there, it gets that mode's help.
import { useSyncExternalStore } from "react";
import { UI_PERSISTENCE } from "./ui-persistence";

export type WalkthroughDevice = "desktop" | "tablet" | "phone";
export type WalkthroughMode = "conversation" | "roleplay" | "game";

export const WALKTHROUGH_DEVICES: readonly WalkthroughDevice[] = ["desktop", "tablet", "phone"];
const STORAGE_KEY = "marinara-walkthroughs-seen";
const TOUCH_QUERY = "(hover: none) and (any-pointer: coarse)";
/** A touch screen whose short side is under this many CSS pixels is a phone; anything larger is a tablet. */
const PHONE_SHORT_SIDE_PX = 600;

interface WalkthroughRecord {
  devices: WalkthroughDevice[];
  /** `${device}:${mode}` for each chat mode whose help has shown on that kind of device. */
  modes: string[];
}

const listeners = new Set<() => void>();
let record: WalkthroughRecord = loadRecord();

function emptyRecord(): WalkthroughRecord {
  return { devices: [], modes: [] };
}

function readStorage(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRecord(next: WalkthroughRecord) {
  record = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private or restricted storage: the walkthroughs then show once per visit at most.
  }
  for (const listener of listeners) listener();
}

/**
 * First run of this code in a browser that already used Marinara on a computer: count that computer as
 * having seen the desktop tour and the chat help it opened, so nobody gets a tour they already finished.
 * Phones and tablets are not counted, because the touch layout and its gestures are new to them.
 */
function seedFromExistingSettings(): WalkthroughRecord {
  const seeded = emptyRecord();
  if (detectWalkthroughDevice() !== "desktop") return seeded;
  const raw = readStorage(UI_PERSISTENCE.name);
  if (!raw) return seeded;
  try {
    const state = (JSON.parse(raw) as { state?: Record<string, unknown> }).state ?? {};
    if (state.hasCompletedOnboarding === true) seeded.devices.push("desktop");
    if (Array.isArray(state.chatHelpSeenModes)) {
      for (const mode of state.chatHelpSeenModes) {
        if (typeof mode === "string") seeded.modes.push(`desktop:${mode}`);
      }
    }
  } catch {
    // An unreadable blob means nothing to carry over.
  }
  return seeded;
}

function loadRecord(): WalkthroughRecord {
  if (typeof window === "undefined") return emptyRecord();
  const raw = readStorage(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<WalkthroughRecord>;
      return {
        devices: Array.isArray(parsed.devices)
          ? parsed.devices.filter((d): d is WalkthroughDevice => WALKTHROUGH_DEVICES.includes(d))
          : [],
        modes: Array.isArray(parsed.modes) ? parsed.modes.filter((m): m is string => typeof m === "string") : [],
      };
    } catch {
      // Fall through and start again.
    }
  }
  const seeded = seedFromExistingSettings();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  } catch {
    // See writeRecord.
  }
  return seeded;
}

/** Phone, tablet or computer, judged by the screen itself rather than the window, so a narrow PC window stays a computer. */
export function detectWalkthroughDevice(): WalkthroughDevice {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "desktop";
  if (!window.matchMedia(TOUCH_QUERY).matches) return "desktop";
  const shortSide = Math.min(window.screen?.width ?? window.innerWidth, window.screen?.height ?? window.innerHeight);
  return shortSide < PHONE_SHORT_SIDE_PX ? "phone" : "tablet";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasSeenDeviceWalkthrough(device: WalkthroughDevice): boolean {
  return record.devices.includes(device);
}

export function markDeviceWalkthroughSeen(device: WalkthroughDevice = detectWalkthroughDevice()) {
  if (record.devices.includes(device)) return;
  writeRecord({ ...record, devices: [...record.devices, device] });
}

/** Settings > Replay: this device's walkthrough shows again the next time Marinara looks for it (at once). */
export function resetDeviceWalkthrough(device: WalkthroughDevice = detectWalkthroughDevice()) {
  writeRecord({ ...record, devices: record.devices.filter((d) => d !== device) });
}

export function hasSeenModeWalkthrough(mode: WalkthroughMode, device: WalkthroughDevice = detectWalkthroughDevice()) {
  return record.modes.includes(`${device}:${mode}`);
}

export function markModeWalkthroughSeen(mode: WalkthroughMode, device: WalkthroughDevice = detectWalkthroughDevice()) {
  const key = `${device}:${mode}`;
  if (record.modes.includes(key)) return;
  writeRecord({ ...record, modes: [...record.modes, key] });
}

export function markAllModeWalkthroughsSeen(device: WalkthroughDevice = detectWalkthroughDevice()) {
  const keys = (["conversation", "roleplay", "game"] as const).map((mode) => `${device}:${mode}`);
  writeRecord({ ...record, modes: [...new Set([...record.modes, ...keys])] });
}

/** Settings > Replay: each mode's help opens again the next time a chat of that mode opens on this device. */
export function resetModeWalkthroughs(device: WalkthroughDevice = detectWalkthroughDevice()) {
  writeRecord({ ...record, modes: record.modes.filter((key) => !key.startsWith(`${device}:`)) });
}

const EMPTY_RECORD: WalkthroughRecord = emptyRecord();

function getSnapshot() {
  return record;
}

/** The record, re-rendering when a walkthrough is marked or reset. */
export function useWalkthroughRecord(): WalkthroughRecord {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_RECORD);
}

function subscribeDevice(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(TOUCH_QUERY);
  media.addEventListener("change", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

export function useWalkthroughDevice(): WalkthroughDevice {
  return useSyncExternalStore(subscribeDevice, detectWalkthroughDevice, () => "desktop");
}
