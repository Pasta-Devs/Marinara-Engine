import type { CSSProperties } from "react";

import { parseCharacterDisplayData } from "./character-display";
import { getAvatarCropStyle } from "./utils";

export interface CharacterPreviewModel {
  id: string;
  name: string;
  avatarSrc?: string;
  avatarCropStyle?: CSSProperties;
  summary?: string;
  comment?: string;
  description?: string;
  creator?: string;
  version?: string;
  tags: string[];
  lorebookCount: number;
}

/**
 * One semantic character representation shared by compact references and rich
 * previews. Surfaces choose their own layout instead of sharing card chrome.
 */
export function buildCharacterPreviewModel(
  item: unknown,
  options: { lorebookCount?: number } = {},
): CharacterPreviewModel | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim()) return null;
  const display = parseCharacterDisplayData({
    data: record.data,
    comment: typeof record.comment === "string" ? record.comment : undefined,
  });

  return {
    id: record.id,
    name: display.name,
    ...(typeof record.avatarPath === "string" && record.avatarPath.trim() ? { avatarSrc: record.avatarPath } : {}),
    ...(display.avatarCrop ? { avatarCropStyle: getAvatarCropStyle(display.avatarCrop) } : {}),
    ...(display.summary?.trim() ? { summary: display.summary.trim() } : {}),
    ...(display.comment?.trim() ? { comment: display.comment.trim() } : {}),
    ...(display.description?.trim() ? { description: display.description.trim() } : {}),
    ...(display.creator?.trim() ? { creator: display.creator.trim() } : {}),
    ...(typeof record.version === "string" && record.version.trim() ? { version: record.version.trim() } : {}),
    tags: (display.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    lorebookCount: Math.max(0, options.lorebookCount ?? 0),
  };
}
