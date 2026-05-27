export const galleryKeys = {
  all: ["gallery"] as const,
  images: (chatId: string | null, scopeChatIds?: readonly string[]) =>
    scopeChatIds
      ? ([...galleryKeys.all, "images", chatId, "scope", scopeChatIds] as const)
      : ([...galleryKeys.all, "images", chatId] as const),
  gameSessions: (gameId: string | null) => [...galleryKeys.all, "game-sessions", gameId] as const,
};
