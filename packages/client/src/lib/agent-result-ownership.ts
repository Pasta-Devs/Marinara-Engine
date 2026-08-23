export type AgentResultOwnership = {
  messageId?: string | null;
  swipeIndex?: number | null;
};

export function agentResultMatchesVisibleSwipe(
  messages: ReadonlyArray<{ id: string; activeSwipeIndex?: number | null }>,
  ownership: AgentResultOwnership,
): boolean {
  if (!ownership.messageId || typeof ownership.swipeIndex !== "number") return true;
  const target = messages.find((message) => message.id === ownership.messageId);
  return !!target && (target.activeSwipeIndex ?? 0) === ownership.swipeIndex;
}
