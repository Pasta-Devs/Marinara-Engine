type ChatMessagesStore = {
  listMessages(chatId: string): Promise<Array<{ id?: string | null; role?: string | null }>>;
};

export async function findLastUserMessageIdBefore(
  chats: ChatMessagesStore,
  chatId: string,
  beforeMessageId?: string | null,
): Promise<string | null> {
  const rows = await chats.listMessages(chatId);
  const beforeIndex = beforeMessageId ? rows.findIndex((message) => message.id === beforeMessageId) : -1;
  if (beforeMessageId && beforeIndex < 0) return null;
  const startIndex = beforeIndex >= 0 ? beforeIndex - 1 : rows.length - 1;
  for (let index = startIndex; index >= 0; index -= 1) {
    const message = rows[index];
    if (message?.role === "user" && typeof message.id === "string") return message.id;
  }
  return null;
}
