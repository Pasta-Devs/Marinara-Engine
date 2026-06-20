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

export async function shouldSkipAgentByAssistantInterval({
  agentsStore,
  chatId,
  agentType,
  settings,
  fallbackInterval,
  messages,
}: {
  agentsStore: AgentsStore;
  chatId: string;
  agentType: string;
  settings: unknown;
  fallbackInterval: number;
  messages: ChatMessageLike[];
}): Promise<boolean> {
  const runInterval = resolveAgentRunInterval(settings, fallbackInterval);
  if (runInterval <= 1) return false;

  const lastRun = await agentsStore.getLastSuccessfulRunByType(agentType, chatId);
  if (!lastRun) return false;

  const lastRunIdx = messages.findIndex((message) => message.id === lastRun.messageId);
  if (lastRunIdx < 0) return false;
  const assistantMessagesSince = messages.slice(lastRunIdx + 1).filter((message) => message.role === "assistant");
  return assistantMessagesSince.length + 1 < runInterval;
}
