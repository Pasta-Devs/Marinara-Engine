const ANDROID_BRIDGE_TOKEN_PROPERTY = "__MARINARA_ANDROID_BRIDGE_TOKEN__";
const HEX_256 = /^[a-f0-9]{64}$/u;
export const ANDROID_BRIDGE_READY_EVENT = "marinara:android-bridge-ready";

export type MarinaraAndroidBridge = {
  openLauncher?: (token?: string) => void;
  openConsole?: {
    (token: string): void;
    (): void;
  };
  isStatusBarVisible?: {
    (token: string): boolean;
    (): boolean;
  };
  setStatusBarVisible?: {
    (token: string, visible: boolean): void;
    (visible: boolean): void;
  };
};

/** Return the per-navigation token injected by current Android shells. */
export function getAndroidBridgeToken(): string | null {
  if (typeof window === "undefined") return null;
  const value = (window as Window & { __MARINARA_ANDROID_BRIDGE_TOKEN__?: unknown })[ANDROID_BRIDGE_TOKEN_PROPERTY];
  return typeof value === "string" && HEX_256.test(value) ? value : null;
}

export function getMarinaraAndroidBridge(): MarinaraAndroidBridge | null {
  if (typeof window === "undefined") return null;
  const nativeWindow = window as Window & { MarinaraAndroid?: MarinaraAndroidBridge };
  return nativeWindow.MarinaraAndroid ?? null;
}

export function isMarinaraAndroidShell(): boolean {
  return typeof navigator !== "undefined" && /\bMarinaraEngine\/Android\b/u.test(navigator.userAgent);
}

/** True when the Android shell can open its Termux console. */
export function canOpenAndroidTermuxConsole(): boolean {
  return typeof getMarinaraAndroidBridge()?.openConsole === "function";
}

/** Opens Termux through the Android shell; false when this shell has no console shortcut. */
export function openAndroidTermuxConsole(): boolean {
  const bridge = getMarinaraAndroidBridge();
  if (typeof bridge?.openConsole !== "function") return false;
  const token = getAndroidBridgeToken();
  if (token) bridge.openConsole(token);
  else bridge.openConsole();
  return true;
}
