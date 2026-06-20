export type LocalNotificationPermission = NotificationPermission | "unsupported";

export type ConversationLocalNotificationOptions = {
  enabled: boolean;
  characterName?: string | null;
  tag?: string;
};

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
  return getBrowserNotificationPermission();
}

export async function requestLocalNotificationPermission(): Promise<LocalNotificationPermission> {
  return requestBrowserNotificationPermission();
}

function isAppFocusedForNotifications(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && document.hasFocus();
}

export async function showConversationLocalNotification({
  enabled,
  characterName,
  tag,
}: ConversationLocalNotificationOptions): Promise<boolean> {
  if (!enabled || isAppFocusedForNotifications()) return false;
  if (getBrowserNotificationPermission() !== "granted") return false;
  if (typeof window === "undefined" || !("Notification" in window)) return false;

  const name = typeof characterName === "string" && characterName.trim() ? characterName.trim() : "Character";
  const notification = new window.Notification(`New message from ${name.slice(0, 80)}`, {
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
