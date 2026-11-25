import { z } from "zod";

/**
 * Push notifications through an ntfy server (#9752), stored as one JSON object in the
 * `push-notifications` app setting. The server publishes when a character reply is saved,
 * so a phone with the ntfy app hears about it while Marinara is closed.
 */
export const PUSH_NOTIFICATION_SETTINGS_KEY = "push-notifications";
export const DEFAULT_NTFY_SERVER_URL = "https://ntfy.sh";
/** ntfy topic names: letters, digits, `_` and `-`, at most 64 characters. */
export const PUSH_NOTIFICATION_TOPIC_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_URL_LENGTH = 500;

export interface PushNotificationSettings {
  enabled: boolean;
  /** The ntfy server, without a trailing slash. */
  serverUrl: string;
  /** Made by the server; anyone who knows it can read the notifications. Empty until first enabled. */
  topic: string;
  /** Send a cleaned excerpt of the reply instead of the generic line. */
  previews: boolean;
  /** Messages characters send on their own, including the server's offline follow-ups. */
  notifyAutonomous: boolean;
  /** Replies the user started, when the app was closed or left before they finished. */
  notifyReplies: boolean;
  /** The Marinara address a tapped notification opens. Empty: the notification opens nothing. */
  clickUrl: string;
}

export const DEFAULT_PUSH_NOTIFICATION_SETTINGS: PushNotificationSettings = {
  enabled: false,
  serverUrl: DEFAULT_NTFY_SERVER_URL,
  topic: "",
  previews: false,
  notifyAutonomous: true,
  notifyReplies: true,
  clickUrl: "",
};

/** An http(s) address without credentials, query or fragment, trailing slashes removed; null when it is not one. */
export function normalizePushHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.search || url.hash || !url.hostname) return null;
  return url.toString().replace(/\/+$/, "");
}

/** What the settings form may change. The topic is made and rotated by the server only. */
export const pushNotificationSettingsUpdateSchema = z
  .object({
    enabled: z.boolean(),
    serverUrl: z.string().max(MAX_URL_LENGTH),
    previews: z.boolean(),
    notifyAutonomous: z.boolean(),
    notifyReplies: z.boolean(),
    clickUrl: z.string().max(MAX_URL_LENGTH),
  })
  .partial()
  .strict();
export type PushNotificationSettingsUpdate = z.infer<typeof pushNotificationSettingsUpdateSchema>;

/** Stored settings with every malformed field back at its default. */
export function parsePushNotificationSettings(raw: unknown): PushNotificationSettings {
  let parsed = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { ...DEFAULT_PUSH_NOTIFICATION_SETTINGS };
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ...DEFAULT_PUSH_NOTIFICATION_SETTINGS };
  const source = parsed as Record<string, unknown>;
  const flag = (key: "enabled" | "previews" | "notifyAutonomous" | "notifyReplies") =>
    typeof source[key] === "boolean" ? source[key] : DEFAULT_PUSH_NOTIFICATION_SETTINGS[key];
  const topic =
    typeof source.topic === "string" && PUSH_NOTIFICATION_TOPIC_PATTERN.test(source.topic) ? source.topic : "";
  return {
    enabled: flag("enabled") && topic !== "",
    serverUrl: normalizePushHttpUrl(source.serverUrl) ?? DEFAULT_NTFY_SERVER_URL,
    topic,
    previews: flag("previews"),
    notifyAutonomous: flag("notifyAutonomous"),
    notifyReplies: flag("notifyReplies"),
    clickUrl: normalizePushHttpUrl(source.clickUrl) ?? "",
  };
}
