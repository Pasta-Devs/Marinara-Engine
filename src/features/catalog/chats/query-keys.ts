export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const,
  summaries: () => [...chatKeys.list(), "summaries"] as const,
  recentSummaries: (limit: number) => [...chatKeys.summaries(), "recent", limit] as const,
  detail: (id: string) => [...chatKeys.all, "detail", id] as const,
  messages: (chatId: string) => [...chatKeys.all, "messages", chatId] as const,
  messageCount: (chatId: string) => [...chatKeys.all, "messageCount", chatId] as const,
  memories: (chatId: string) => [...chatKeys.all, "memories", chatId] as const,
  notes: (chatId: string) => [...chatKeys.all, "notes", chatId] as const,
  group: (groupId: string) => [...chatKeys.all, "group", groupId] as const,
};
