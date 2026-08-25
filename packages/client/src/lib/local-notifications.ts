import { getAndroidBridgeToken } from "./android-bridge";

export type LocalNotificationPermission = NotificationPermission | "insecure" | "unsupported";
export type NativeNotificationPermission = "default" | "denied" | "granted" | "unsupported";

type MarinaraAndroidNotificationBridge = {
  getNotificationPermission?: {
    (token: string): string;
    (): string;
  };
  requestNotificationPermission?: {
    (token: string): void;
    (): void;
  };
  showNotification?: {
    (token: string, title: string, body: string, tag: string): void;
    (title: string, body: string, tag: string): void;
  };
};

export type LocalMessageNotificationOptions = {
  enabled: boolean;
  characterName?: string | null;
  title?: string;
  tag?: string;
};

function getBrowserNotificationPermission(): LocalNotificationPermission {
  if (typeof window === "undefined") return "unsupported";
  if (window.isSecureContext === false) return "insecure";
  if (!("Notification" in window)) return "unsupported";
  return window.Notification.permission;
}

function getAndroidNotificationBridge(): MarinaraAndroidNotificationBridge | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { MarinaraAndroid?: MarinaraAndroidNotificationBridge }).MarinaraAndroid ?? null;
}

export function hasNativeNotificationBridge(): boolean {
  const bridge = getAndroidNotificationBridge();
  return (
    typeof bridge?.getNotificationPermission === "function" &&
    typeof bridge.requestNotificationPermission === "function" &&
    typeof bridge.showNotification === "function"
  );
}

function normalizeNativePermission(value: string | undefined): NativeNotificationPermission {
  return value === "default" || value === "denied" || value === "granted" ? value : "unsupported";
}

export function getNativeNotificationPermission(): NativeNotificationPermission {
  const bridge = getAndroidNotificationBridge();
  if (typeof bridge?.getNotificationPermission !== "function") return "unsupported";
  const token = getAndroidBridgeToken();
  return normalizeNativePermission(
    token ? bridge.getNotificationPermission(token) : bridge.getNotificationPermission(),
  );
}

export async function requestNativeNotificationPermission(): Promise<NativeNotificationPermission> {
  const bridge = getAndroidNotificationBridge();
  if (typeof bridge?.requestNotificationPermission !== "function") return "unsupported";
  const current = getNativeNotificationPermission();
  if (current === "granted") return current;

  return new Promise((resolve) => {
    const finish = (permission: NativeNotificationPermission) => {
      window.removeEventListener("marinara:native-notification-permission", handlePermission);
      window.clearTimeout(timeoutId);
      resolve(permission);
    };
    const handlePermission = (event: Event) => {
      finish(normalizeNativePermission((event as CustomEvent<string>).detail));
    };
    // Resolve a slow bridge request for the current caller, but leave the one-shot
    // listener installed so a late Android result is still consumed and cleaned up.
    const timeoutId = window.setTimeout(() => resolve(getNativeNotificationPermission()), 30_000);
    window.addEventListener("marinara:native-notification-permission", handlePermission, { once: true });
    const token = getAndroidBridgeToken();
    if (token) bridge.requestNotificationPermission?.(token);
    else bridge.requestNotificationPermission?.();
  });
}

async function requestBrowserNotificationPermission(): Promise<LocalNotificationPermission> {
  const current = getBrowserNotificationPermission();
  if (current === "insecure" || current === "unsupported") return current;
  if (window.Notification.permission !== "default") return window.Notification.permission;
  return window.Notification.requestPermission();
}

export async function getLocalNotificationPermission(): Promise<LocalNotificationPermission> {
  return getBrowserNotificationPermission();
}

export async function requestLocalNotificationPermission(): Promise<LocalNotificationPermission> {
  return requestBrowserNotificationPermission();
}

function isAppFocusedForNotifications(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && document.hasFocus();
}

function resolveMessageNotificationTitle(title?: string, characterName?: string | null): string {
  const explicitTitle = typeof title === "string" ? title.trim() : "";
  if (explicitTitle) return explicitTitle.slice(0, 100);
  const name = typeof characterName === "string" && characterName.trim() ? characterName.trim() : "Character";
  return `New message from ${name.slice(0, 80)}`;
}

export async function showLocalMessageNotification({
  enabled,
  characterName,
  title,
  tag,
}: LocalMessageNotificationOptions): Promise<boolean> {
  if (!enabled || isAppFocusedForNotifications()) return false;
  if (getBrowserNotificationPermission() !== "granted") return false;
  if (typeof window === "undefined" || !("Notification" in window)) return false;

  const notification = new window.Notification(resolveMessageNotificationTitle(title, characterName), {
    body: "Open Marinara to read it.",
    icon: "/icon-192.png",
    tag,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  return true;
}

export function showNativeMessageNotification({
  enabled,
  characterName,
  title,
  tag,
}: LocalMessageNotificationOptions): boolean {
  if (!enabled || isAppFocusedForNotifications()) return false;
  const bridge = getAndroidNotificationBridge();
  if (typeof bridge?.showNotification !== "function" || getNativeNotificationPermission() !== "granted") {
    return false;
  }
  const notificationTitle = resolveMessageNotificationTitle(title, characterName);
  const notificationTag = tag ?? "message";
  const token = getAndroidBridgeToken();
  if (token) bridge.showNotification(token, notificationTitle, "Open Marinara to read it.", notificationTag);
  else bridge.showNotification(notificationTitle, "Open Marinara to read it.", notificationTag);
  return true;
}
