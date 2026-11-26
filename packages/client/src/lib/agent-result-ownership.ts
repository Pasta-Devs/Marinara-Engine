export type AgentResultOwnership = {
  messageId?: string | null;
  swipeIndex?: number | null;
};

type OwnedMessage = { id: string; activeSwipeIndex?: number | null };

export function agentResultMatchesVisibleSwipe(
  messages: ReadonlyArray<OwnedMessage>,
  ownership: AgentResultOwnership,
  // Replies the live stream shows but the message list does not yet, such as one held
  // for Prose Guardian, which joins the list only after the agent results (#7592).
  unlistedReplies?: ReadonlyMap<string, OwnedMessage>,
): boolean {
  if (!ownership.messageId || typeof ownership.swipeIndex !== "number") return true;
  const target =
    messages.find((message) => message.id === ownership.messageId) ?? unlistedReplies?.get(ownership.messageId);
  return !!target && (target.activeSwipeIndex ?? 0) === ownership.swipeIndex;
}

/**
 * Whether a retried agent's write proposal joins the approval queue. A backfill works on replies far above
 * the loaded page, so its target is never on screen; requiring the visible swipe there dropped every
 * proposal, and the server keeps the write pending until it is approved (#9695).
 */
export function shouldQueueAgentWriteApproval(args: {
  isActiveChat: boolean;
  ownsVisibleSwipe: boolean;
  backfill: boolean;
}): boolean {
  return args.isActiveChat && (args.ownsVisibleSwipe || args.backfill);
}
