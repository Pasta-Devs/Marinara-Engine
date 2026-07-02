// ──────────────────────────────────────────────
// Query Keys: Turn-Games (shared by UNO + Chess)
// ──────────────────────────────────────────────
// Lives in its own module so use-generate.ts can invalidate turn-game state
// without importing use-uno.ts (which imports use-generate back — a cycle).
// One chat has at most one active turn-game, so every board shares the same
// /state resource and key root; per-game hooks append their own suffix.
export const turnGameKeys = {
  all: ["turn-games"] as const,
  catalog: () => [...turnGameKeys.all, "catalog"] as const,
  state: (chatId: string) => [...turnGameKeys.all, "state", chatId] as const,
};
