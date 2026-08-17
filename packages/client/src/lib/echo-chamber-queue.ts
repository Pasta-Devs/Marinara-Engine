export const DEFAULT_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS = 30;
export const MIN_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS = 1;
export const MAX_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS = 300;
export const ECHO_CHAMBER_MESSAGE_LIMIT = 500;

export function normalizeEchoChamberMessageDelaySeconds(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") return DEFAULT_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS;
  if (typeof value === "string" && !value.trim()) return DEFAULT_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS;
  return Math.max(
    MIN_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS,
    Math.min(MAX_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS, Math.trunc(numeric)),
  );
}

export function getEchoChamberMessageInterval(delaySeconds: unknown): number {
  return normalizeEchoChamberMessageDelaySeconds(delaySeconds) * 1_000;
}

export type EchoChamberMessage = {
  characterName: string;
  reaction: string;
  timestamp: number;
};

export type EchoChamberQueueState = {
  messages: EchoChamberMessage[];
  visibleCount: number;
  baseline: number;
};

/**
 * Append one complete Echo Chamber result atomically while keeping every new
 * reaction behind the current reveal cursor. Clamping stale counters here is
 * what prevents a remount or persistence race from dumping the whole batch.
 */
export function enqueueEchoChamberMessages(
  state: EchoChamberQueueState,
  reactions: Array<{ characterName: string; reaction: string }>,
  now = Date.now(),
): EchoChamberQueueState {
  if (reactions.length === 0) return state;

  const currentMessages = state.messages.slice(-ECHO_CHAMBER_MESSAGE_LIMIT);
  const visibleBefore = Math.min(Math.max(0, state.visibleCount), currentMessages.length);
  const baselineBefore = Math.min(Math.max(0, state.baseline), currentMessages.length);
  const incoming = reactions.map((reaction, index) => ({
    characterName: reaction.characterName,
    reaction: reaction.reaction,
    timestamp: now + index,
  }));
  const uncapped = [...currentMessages, ...incoming];
  const droppedCount = Math.max(0, uncapped.length - ECHO_CHAMBER_MESSAGE_LIMIT);

  return {
    messages: uncapped.slice(-ECHO_CHAMBER_MESSAGE_LIMIT),
    visibleCount: Math.max(0, visibleBefore - droppedCount),
    baseline: Math.max(0, baselineBefore - droppedCount),
  };
}

/**
 * Persisted reactions from before the request began are history and can appear
 * immediately. Rows created while that request was in flight belong to the
 * just-finished agent batch and must remain queued for staggered reveal.
 */
export function resolveEchoChamberPersistedBaseline(messages: EchoChamberMessage[], loadStartedAt: number): number {
  return messages.filter((message) => !Number.isFinite(message.timestamp) || message.timestamp < loadStartedAt).length;
}
