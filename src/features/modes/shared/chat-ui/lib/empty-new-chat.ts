type EmptyNewChatCandidate = {
  chat: { id?: string | null } | null | undefined;
  chatCharIds: string[];
  totalMessageCount: number;
};

export function isEmptyNewChatSetup({ chat, chatCharIds, totalMessageCount }: EmptyNewChatCandidate): boolean {
  return Boolean(chat?.id) && chatCharIds.length === 0 && totalMessageCount === 0;
}
