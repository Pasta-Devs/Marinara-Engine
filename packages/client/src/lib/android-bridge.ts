const ANDROID_BRIDGE_TOKEN_PROPERTY = "__MARINARA_ANDROID_BRIDGE_TOKEN__";
const HEX_256 = /^[a-f0-9]{64}$/u;
export const ANDROID_BRIDGE_READY_EVENT = "marinara:android-bridge-ready";

/** Return the per-navigation token injected by current Android shells. */
export function getAndroidBridgeToken(): string | null {
  if (typeof window === "undefined") return null;
  const value = (window as Window & { __MARINARA_ANDROID_BRIDGE_TOKEN__?: unknown })[ANDROID_BRIDGE_TOKEN_PROPERTY];
  return typeof value === "string" && HEX_256.test(value) ? value : null;
}
