export const lorebookKeys = {
  all: ["lorebooks"] as const,
  list: () => [...lorebookKeys.all, "list"] as const,
  byCategory: (cat: string) => [...lorebookKeys.all, "category", cat] as const,
  detail: (id: string) => [...lorebookKeys.all, "detail", id] as const,
  entries: (lorebookId: string) => [...lorebookKeys.all, "entries", lorebookId] as const,
  entry: (entryId: string) => [...lorebookKeys.all, "entry", entryId] as const,
  folders: (lorebookId: string) => [...lorebookKeys.all, "folders", lorebookId] as const,
  active: (chatId?: string | null) =>
    chatId ? ([...lorebookKeys.all, "active", chatId] as const) : ([...lorebookKeys.all, "active"] as const),
};
