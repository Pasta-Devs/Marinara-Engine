type TauriNotificationApi = typeof import("@tauri-apps/plugin-notification");

export type LocalNotificationPermission = NotificationPermission | "unsupported";

export type ConversationLocalNotificationOptions = {
  enabled: boolean;
  characterName?: string | null;
  tag?: string;
};

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime() {
  if (typeof window === "undefined") return false;
  return Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__);
}

async function getTauriNotificationApi(): Promise<TauriNotificationApi | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await import("@tauri-apps/plugin-notification");
  } catch {
    return null;
  }
}

function getBrowserNotificationPermission(): LocalNotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return window.Notification.permission;
}

async function requestBrowserNotificationPermission(): Promise<LocalNotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (window.Notification.permission !== "default") return window.Notification.permission;
  return window.Notification.requestPermission();
}

export async function getLocalNotificationPermission(): Promise<LocalNotificationPermission> {
  const tauriNotifications = await getTauriNotificationApi();
  if (tauriNotifications) {
    return (await tauriNotifications.isPermissionGranted()) ? "granted" : "default";
  }
  return getBrowserNotificationPermission();
}

export async function requestLocalNotificationPermission(): Promise<LocalNotificationPermission> {
  const tauriNotifications = await getTauriNotificationApi();
  if (tauriNotifications) return tauriNotifications.requestPermission();
  return requestBrowserNotificationPermission();
}

function isAppFocusedForNotifications(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && document.hasFocus();
}

export function shouldShowConversationLocalNotification({
  enabled,
  permission,
  appFocused,
}: {
  enabled: boolean;
  permission: LocalNotificationPermission;
  appFocused: boolean;
}) {
  return enabled && permission === "granted" && !appFocused;
}

export async function showConversationLocalNotification({
  enabled,
  characterName,
  tag,
}: ConversationLocalNotificationOptions): Promise<boolean> {
  const permission = await getLocalNotificationPermission();
  if (
    !shouldShowConversationLocalNotification({
      enabled,
      permission,
      appFocused: isAppFocusedForNotifications(),
    })
  ) {
    return false;
  }

  const name = typeof characterName === "string" && characterName.trim() ? characterName.trim() : "Character";
  const title = `New message from ${name.slice(0, 80)}`;
  const body = "Open Marinara to read it.";

  const tauriNotifications = await getTauriNotificationApi();
  if (tauriNotifications) {
    tauriNotifications.sendNotification({
      title,
      body,
      group: tag,
      autoCancel: true,
    });
    return true;
  }

  if (typeof window === "undefined" || !("Notification" in window)) return false;

  const notification = new window.Notification(title, {
    body,
    icon: "/icon-192.png",
    tag,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  return true;
}
