export interface ChatImageVersion {
  id: string;
  chatId: string;
  createdAt: string;
  variantGroupId?: string | null;
  variantSelected?: number | null;
}

/** Old rows remain single pictures. A group is always scoped to its owning chat. */
export function groupChatImageVariants<T extends ChatImageVersion>(images: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const image of images) {
    const key = JSON.stringify([image.chatId, image.variantGroupId || image.id]);
    const versions = groups.get(key) ?? [];
    versions.push(image);
    groups.set(key, versions);
  }
  return [...groups.entries()].map(([id, rows]) => {
    const versions = rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const selected = versions.reduce(
      (current, image) => (image.variantSelected === 1 ? image : current),
      versions[versions.length - 1]!,
    );
    return { id, versions, selected };
  });
}
