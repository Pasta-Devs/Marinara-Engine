import {
  normalizeIllustratorRunInterval,
  normalizeIllustratorVideoMode,
  parseAgentSettingsRecord,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";

type AgentsStore = {
  getLastSuccessfulRunByType(agentType: string, chatId: string): Promise<{ messageId?: string | null } | null>;
};

type ChatMessageLike = {
  id?: string | null;
  role?: string | null;
};

export function resolveAgentRunInterval(settings: unknown, fallback: number): number {
  const normalizedFallback = Number.isFinite(fallback) ? Math.min(100, Math.max(1, Math.floor(fallback))) : 1;
  const source = settings && typeof settings === "object" ? (settings as { runInterval?: unknown }) : {};
  const rawInterval = source.runInterval;
  const parsed =
    typeof rawInterval === "number" ? rawInterval : typeof rawInterval === "string" ? Number(rawInterval) : NaN;
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(100, Math.floor(parsed)) : normalizedFallback;
}

/**
 * Illustrator settings with a Roleplay chat's Run Interval (0-100) in place of the agent's. Other agents and other
 * modes pass through: Game orders its illustrations by scenes and asset needs, not by a per-chat interval.
 * With Illustrator making clips only, every run is a clip, so the Video Run Interval paces it.
 */
export function applyIllustratorChatRunInterval(
  agentType: string,
  settings: Record<string, unknown>,
  chatMetadata: Record<string, unknown> | null | undefined,
  chatMode: unknown,
): Record<string, unknown> {
  if (agentType !== "illustrator" || chatMode !== "roleplay") return settings;
  if (normalizeIllustratorVideoMode(chatMetadata?.illustratorVideoMode) === "clips_only") {
    return { ...settings, runInterval: resolveVideoRunInterval(chatMetadata ?? {}, settings) };
  }
  const runInterval = normalizeIllustratorRunInterval(chatMetadata?.illustratorRunInterval);
  return runInterval === null ? settings : { ...settings, runInterval };
}

export async function shouldSkipAgentByMessageInterval({
  agentsStore,
  chatId,
  agentType,
  settings,
  fallbackInterval,
  messages,
  countUpcomingAssistantMessage = true,
}: {
  agentsStore: AgentsStore;
  chatId: string;
  agentType: string;
  settings: unknown;
  fallbackInterval: number;
  messages: ChatMessageLike[];
  countUpcomingAssistantMessage?: boolean;
}): Promise<boolean> {
  const rawInterval =
    settings && typeof settings === "object" ? (settings as { runInterval?: unknown }).runInterval : undefined;
  if (agentType === "illustrator" && (rawInterval === 0 || rawInterval === "0")) return true;

  const runInterval = resolveAgentRunInterval(settings, fallbackInterval);
  if (runInterval <= 1) return false;

  const lastRun = await agentsStore.getLastSuccessfulRunByType(agentType, chatId);
  if (!lastRun) return false;

  const messagesSince = countMessagesSinceAgentRun(messages, lastRun.messageId, countUpcomingAssistantMessage);
  return messagesSince !== null && messagesSince < runInterval;
}

/** Shared cadence/activation count; null means there is no usable successful-run anchor. */
export function countMessagesSinceAgentRun(
  messages: ChatMessageLike[],
  lastMessageId: string | null | undefined,
  countUpcomingAssistantMessage = false,
): number | null {
  if (!lastMessageId) return null;
  const lastRunIdx = messages.findIndex((message) => message.id === lastMessageId);
  if (lastRunIdx < 0) return null;
  const messagesSince = messages
    .slice(lastRunIdx + 1)
    .filter((message) => message.role === "user" || message.role === "assistant");
  return messagesSince.length + (countUpcomingAssistantMessage ? 1 : 0);
}

export const DEFAULT_VIDEO_RUN_INTERVAL = 5;

/**
 * Messages between videos an agent or character makes on its own: the chat's Video Run Interval, else the
 * Illustrator agent's, else 5. 0 means videos only come when the user asks (/video, the Gallery).
 */
export function resolveVideoRunInterval(chatMetadata: Record<string, unknown>, illustratorSettings: unknown): number {
  const agentSettings =
    illustratorSettings && typeof illustratorSettings === "object"
      ? (illustratorSettings as { videoRunInterval?: unknown })
      : {};
  return (
    normalizeIllustratorRunInterval(chatMetadata.illustratorVideoRunInterval) ??
    normalizeIllustratorRunInterval(agentSettings.videoRunInterval) ??
    DEFAULT_VIDEO_RUN_INTERVAL
  );
}

/**
 * Whether an automatic video may run now. Anchored on the message the last automatic video joined
 * (`lastAutomaticVideoMessageId`); with no usable anchor the first one is allowed. A new swipe of that
 * same message (`targetMessageId`) replaces the reply the clip belonged to, so it may have its own.
 */
export function automaticVideoAllowed(
  messages: ChatMessageLike[],
  chatMetadata: Record<string, unknown>,
  interval: number,
  countUpcomingAssistantMessage = false,
  targetMessageId?: string | null,
): boolean {
  if (interval <= 0) return false;
  const anchor =
    typeof chatMetadata.lastAutomaticVideoMessageId === "string" ? chatMetadata.lastAutomaticVideoMessageId : null;
  if (anchor && anchor === targetMessageId) return true;
  const since = countMessagesSinceAgentRun(messages, anchor, countUpcomingAssistantMessage);
  return since === null || since >= interval;
}

/** An automatic clip's hold on the Video Run Interval; `settle` reports whether the clip was made. */
export type AutomaticVideoRunClaim = { settle(made: boolean): Promise<void> };

/** Clips still being made, per chat and message, with the starting point they replaced. */
const openVideoRuns = new Map<string, { count: number; made: boolean; previous: unknown }>();

/**
 * Records `messageId` as where the Video Run Interval counts from, when an automatic clip starts: a clip takes
 * minutes, and a later reply must not start another one meanwhile. `allowed`, when given, is checked against the
 * chat's current metadata inside the same serialized write, so two replies can't both pass it before either claims;
 * a refused claim returns null. Several clips may share one message (a merged group reply). Once the last of them
 * settles and none was made, the previous starting point comes back, unless a newer clip has taken its place.
 */
export async function claimAutomaticVideoRun(
  chats: {
    patchMetadata(
      id: string,
      updater: (current: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>,
    ): Promise<unknown>;
  },
  chatId: string,
  messageId: string,
  allowed?: (current: Record<string, unknown>) => boolean | Promise<boolean>,
): Promise<AutomaticVideoRunClaim | null> {
  const key = `${chatId}:${messageId}`;
  // The entry this call joined or opened, so only its own hold is ever released.
  let held: { count: number; made: boolean; previous: unknown } | undefined;
  const settle = async (made: boolean) => {
    const open = held;
    held = undefined;
    if (!open) return;
    open.made ||= made;
    open.count -= 1;
    if (open.count > 0) return;
    if (openVideoRuns.get(key) === open) openVideoRuns.delete(key);
    if (open.made) return;
    await chats
      .patchMetadata(chatId, (current) =>
        current.lastAutomaticVideoMessageId === messageId ? { lastAutomaticVideoMessageId: open.previous } : {},
      )
      .catch((err) => logger.warn(err, "[video] Could not give back the Video Run Interval after a failed clip"));
  };
  let granted = true;
  try {
    await chats.patchMetadata(chatId, async (current) => {
      const open = openVideoRuns.get(key);
      if (open) {
        open.count += 1;
        held = open;
        return {};
      }
      if (allowed && !(await allowed(current))) {
        granted = false;
        return {};
      }
      held = { count: 1, made: false, previous: current.lastAutomaticVideoMessageId ?? null };
      openVideoRuns.set(key, held);
      return { lastAutomaticVideoMessageId: messageId };
    });
  } catch (err) {
    // A write that failed after this call took its hold gives it back, as a clip that was not made.
    await settle(false);
    logger.warn(err, "[video] Could not record the clip for the Video Run Interval");
    // A clip that had to pass a check is refused when the check could not run; one already decided goes ahead.
    return allowed ? null : { settle: async () => undefined };
  }
  if (!granted) return null;
  return { settle };
}

/** `resolveVideoRunInterval` with the Illustrator agent's saved settings looked up. */
export async function loadVideoRunInterval(
  agentsStore: { getByType(type: string): Promise<{ settings?: unknown } | null> },
  chatMetadata: Record<string, unknown>,
): Promise<number> {
  const agent = await agentsStore.getByType("illustrator").catch(() => null);
  return resolveVideoRunInterval(chatMetadata, parseAgentSettingsRecord(agent?.settings));
}
