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
