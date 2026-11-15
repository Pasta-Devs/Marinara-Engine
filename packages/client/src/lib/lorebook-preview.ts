import type { AvatarCrop, Lorebook } from "@marinara-engine/shared";

export type LorebookPreviewModel = {
  id: string;
  name: string;
  description?: string;
  imageSrc?: string;
  imageCrop?: AvatarCrop | null;
  category: Lorebook["category"];
  entryCount?: number;
  isGlobal: boolean;
  enabled: boolean;
  linkedNames: string[];
  tags: string[];
};

export function buildLorebookPreviewModel(
  lorebook: Lorebook,
  options: { linkedNames?: readonly string[] } = {},
): LorebookPreviewModel {
  return {
    id: lorebook.id,
    name: lorebook.name,
    description: lorebook.description?.trim() || undefined,
    imageSrc: lorebook.imagePath ?? undefined,
    imageCrop: lorebook.imageCrop,
    category: lorebook.category,
    entryCount: lorebook.entryCount,
    isGlobal: lorebook.isGlobal,
    enabled: lorebook.enabled,
    linkedNames: [...(options.linkedNames ?? [])],
    tags: [...(lorebook.tags ?? [])],
  };
}
