export const spriteKeys = {
  list: (spriteOwnerId: string) => ["sprites", spriteOwnerId] as const,
  capabilities: () => ["sprites", "capabilities"] as const,
};
