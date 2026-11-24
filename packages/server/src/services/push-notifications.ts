// ──────────────────────────────────────────────
// Push notifications through ntfy (#9752)
// ──────────────────────────────────────────────
// Publishes a short notice to the user's ntfy topic when a character reply is saved, so a phone
// with the ntfy app hears about it while Marinara is closed. ntfy's JSON publishing goes to the
// server root, which keeps the topic out of the request URL and lets titles hold any script.
// Publish API: https://docs.ntfy.sh/publish/#publish-as-json
import { randomBytes } from "node:crypto";
import {
  normalizePushHttpUrl,
  parsePushNotificationSettings,
  PUSH_NOTIFICATION_SETTINGS_KEY,
  type PushNotificationSettings,
  type PushNotificationSettingsUpdate,
} from "@marinara-engine/shared";
import type { DB } from "../db/connection.js";
import { logger } from "../lib/logger.js";
import { sleep } from "../utils/sleep.js";
import { safeFetch } from "../utils/security.js";
import { createAppSettingsStorage } from "./storage/app-settings.storage.js";

export const PUSH_GENERIC_BODY = "Open Marinara to read it.";
export const PUSH_PREVIEW_MAX_CHARS = 200;
/** One notice per chat in this window: a group's replies or a split reply arrive as one buzz. */
export const PUSH_CHAT_COOLDOWN_MS = 20_000;
const PUSH_MIN_INTERVAL_MS = 1_000;
const PUSH_MAX_QUEUED = 10;
const PUSH_TIMEOUT_MS = 15_000;
/** Topics replaced by New topic: a notice still queued for one is dropped instead of reaching old subscribers. */
const retiredTopics = new Set<string>();

export interface PushNotificationEvent {
  chatId: string;
  /** "New message from Aria", or the chat's name for Game mode. */
  title: string;
  /** The saved reply; sent only as a cleaned preview when previews are on. */
  content: string;
}

export interface NtfyPublishRequest {
  url: string;
  body: {
    topic: string;
    title: string;
    message: string;
    tags: string[];
    priority: number;
    click?: string;
  };
}

/** Plain text for a lock-screen preview: no markdown or roleplay markers, one line, at most 200 characters. */
export function cleanPushPreview(text: string): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`#>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > PUSH_PREVIEW_MAX_CHARS ? `${plain.slice(0, PUSH_PREVIEW_MAX_CHARS - 1).trimEnd()}…` : plain;
}

/** The ntfy request for one notice; null when the settings cannot publish. */
export function buildNtfyPublishRequest(
  settings: PushNotificationSettings,
  event: PushNotificationEvent,
): NtfyPublishRequest | null {
  const serverUrl = normalizePushHttpUrl(settings.serverUrl);
  if (!serverUrl || !settings.topic) return null;
  const preview = settings.previews ? cleanPushPreview(event.content) : "";
  const clickUrl = normalizePushHttpUrl(settings.clickUrl);
  return {
    url: serverUrl,
    body: {
      topic: settings.topic,
      title: event.title.trim().slice(0, 100) || "Marinara",
      message: preview || PUSH_GENERIC_BODY,
      tags: ["speech_balloon"],
      priority: 3,
      ...(clickUrl ? { click: `${clickUrl}/?chat=${encodeURIComponent(event.chatId)}` } : {}),
    },
  };
}

export interface ReplyPushContext {
  autonomous: boolean;
  /** The request's stream closed before the reply was saved: the app was closed or left. */
  clientDisconnected: boolean;
  regenerate: boolean;
  impersonate: boolean;
  content: string;
}

/**
 * Messages characters send on their own always notify (when switched on). A reply the user
 * started notifies only when its stream closed first; while the app is open, its own
 * notifications cover it. Regenerations, swipes and impersonations never notify.
 */
export function shouldPublishReplyPush(settings: PushNotificationSettings, reply: ReplyPushContext): boolean {
  if (!settings.enabled || !settings.topic) return false;
  if (reply.regenerate || reply.impersonate || !reply.content.trim()) return false;
  if (reply.autonomous) return settings.notifyAutonomous;
  return settings.notifyReplies && reply.clientDisconnected;
}

export function generatePushTopic(): string {
  return `marinara-${randomBytes(18).toString("base64url")}`;
}

export async function readPushNotificationSettings(db: DB): Promise<PushNotificationSettings> {
  return parsePushNotificationSettings(await createAppSettingsStorage(db).get(PUSH_NOTIFICATION_SETTINGS_KEY));
}

export class PushNotificationSettingsError extends Error {}

/** Merges the form's changes. Turning it on makes a topic when there is none; an address must be http(s). */
export async function writePushNotificationSettings(
  db: DB,
  changes: PushNotificationSettingsUpdate,
  options: { rotateTopic?: boolean } = {},
): Promise<PushNotificationSettings> {
  const serverUrl = changes.serverUrl === undefined ? undefined : normalizePushHttpUrl(changes.serverUrl);
  if (serverUrl === null) {
    throw new PushNotificationSettingsError("The ntfy server must be an http:// or https:// address.");
  }
  let clickUrl: string | undefined;
  if (changes.clickUrl !== undefined) {
    // Empty is allowed: the notification then opens nothing.
    const normalized = changes.clickUrl.trim() ? normalizePushHttpUrl(changes.clickUrl) : "";
    if (normalized === null) {
      throw new PushNotificationSettingsError("The address to open must be an http:// or https:// address.");
    }
    clickUrl = normalized;
  }
  let replacedTopic = "";
  await db.transaction(async () => {
    const current = await readPushNotificationSettings(db);
    const next: PushNotificationSettings = {
      ...current,
      ...changes,
      ...(serverUrl !== undefined ? { serverUrl } : {}),
      ...(clickUrl !== undefined ? { clickUrl } : {}),
    };
    if (options.rotateTopic || (next.enabled && !next.topic)) {
      replacedTopic = current.topic;
      next.topic = generatePushTopic();
    }
    await createAppSettingsStorage(db).set(PUSH_NOTIFICATION_SETTINGS_KEY, JSON.stringify(next));
  });
  // Only once the new topic is saved: a failed write keeps the old topic in use.
  if (replacedTopic) retiredTopics.add(replacedTopic);
  return readPushNotificationSettings(db);
}

async function sendNtfy(request: NtfyPublishRequest): Promise<void> {
  const origin = new URL(request.url).origin;
  let response: Response;
  try {
    response = await safeFetch(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      maxResponseBytes: 64 * 1024,
      // Only the owner can save the server address (a privileged route), so a self-hosted ntfy on this
      // machine or the LAN works; every request and redirect stays on that one origin.
      policy: {
        allowLocal: true,
        allowLoopback: true,
        allowedProtocols: ["https:", "http:"],
        allowedOrigins: [origin],
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`The ntfy server at ${origin} took too long to answer.`, { cause: error });
    }
    if (error instanceof Error && error.message.startsWith("Refused to fetch")) throw error;
    throw new Error(`Could not reach the ntfy server at ${origin}.`, { cause: error });
  }
  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: unknown) =>
        body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
          ? (body as { error: string }).error
          : "",
      )
      .catch(() => "");
    throw new Error(`The ntfy server answered ${response.status}${detail ? `: ${detail}` : "."}`);
  }
}

// ponytail: in-memory queue and cooldowns, reset on restart; enough for one owner's notices.
// A burst beyond PUSH_MAX_QUEUED is dropped rather than delayed for minutes.
const queues = new Map<string, Array<() => Promise<void>>>();
const lastNoticeByChat = new Map<string, number>();

function enqueue(key: string, task: () => Promise<void>): boolean {
  let queue = queues.get(key);
  if (queue && queue.length >= PUSH_MAX_QUEUED) return false;
  if (!queue) {
    queue = [];
    queues.set(key, queue);
    queue.push(task);
    void drain(key, queue);
    return true;
  }
  queue.push(task);
  return true;
}

async function drain(key: string, queue: Array<() => Promise<void>>): Promise<void> {
  while (queue.length > 0) {
    await queue[0]!().catch(() => undefined);
    queue.shift();
    if (queue.length > 0) await sleep(PUSH_MIN_INTERVAL_MS);
  }
  queues.delete(key);
}

/** Fire-and-forget: never throws and never delays the reply. The topic is never logged. */
export function publishPushNotification(settings: PushNotificationSettings, event: PushNotificationEvent): void {
  const request = buildNtfyPublishRequest(settings, event);
  if (!request) return;
  const now = Date.now();
  const last = lastNoticeByChat.get(event.chatId);
  if (last !== undefined && now - last < PUSH_CHAT_COOLDOWN_MS) return;
  lastNoticeByChat.set(event.chatId, now);
  if (lastNoticeByChat.size > 500) {
    for (const [chatId, at] of lastNoticeByChat) if (now - at >= PUSH_CHAT_COOLDOWN_MS) lastNoticeByChat.delete(chatId);
  }
  const queued = enqueue(request.url, async () => {
    if (retiredTopics.has(request.body.topic)) return;
    try {
      await sendNtfy(request);
      logger.debug("[push] Sent a notification for chat %s", event.chatId);
    } catch (error) {
      // The message names the server, never the topic.
      logger.warn("[push] Could not send a notification: %s", error instanceof Error ? error.message : String(error));
    }
  });
  if (!queued) logger.warn("[push] Dropped a notification for chat %s: too many waiting", event.chatId);
}

/** Reads the settings and publishes when they allow it; for hooks that must not await or throw. */
export function publishReplyPushNotification(db: DB, event: PushNotificationEvent, reply: ReplyPushContext): void {
  void readPushNotificationSettings(db)
    .then((settings) => {
      if (shouldPublishReplyPush(settings, reply)) publishPushNotification(settings, event);
    })
    .catch((error) => logger.warn(error, "[push] Could not read the push notification settings"));
}

/** Sends a test notice now and reports why it failed, for the settings' test button. */
export async function sendTestPushNotification(settings: PushNotificationSettings): Promise<void> {
  const request = buildNtfyPublishRequest(
    { ...settings, previews: true },
    { chatId: "", title: "Marinara test notification", content: "Push notifications work." },
  );
  if (!request) throw new PushNotificationSettingsError("Turn push notifications on first.");
  const clickUrl = normalizePushHttpUrl(settings.clickUrl);
  if (clickUrl) request.body.click = clickUrl;
  else delete request.body.click;
  await sendNtfy(request);
}
