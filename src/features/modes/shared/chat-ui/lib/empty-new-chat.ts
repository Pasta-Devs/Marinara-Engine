type EmptyNewChatCandidate = {
  activeChatId: string | null;
  setupChatId: string | null;
  chatCharIds: string[];
  totalMessageCount: number;
  messagesLoaded: boolean;
};

export function isEmptyNewChatSetup({
  activeChatId,
  setupChatId,
  chatCharIds,
  totalMessageCount,
  messagesLoaded,
}: EmptyNewChatCandidate): boolean {
  return (
    Boolean(activeChatId) &&
    setupChatId === activeChatId &&
    chatCharIds.length === 0 &&
    (!messagesLoaded || totalMessageCount === 0)
  );
}
