import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { spriteApi } from "../../../../shared/api/image-generation-api";
import { storageApi } from "../../../../shared/api/storage-api";
import type { CharacterMap } from "../../shared/chat-ui/types";

type AvatarOverrideRef = { charId: string; mode: "sprite" | "gallery"; value: string };
type SpriteRow = { expression: string; url: string };
type GalleryRow = { id: string; url?: string | null; filePath?: string | null };

function collectAvatarOverrideRefs(characterMap: CharacterMap): AvatarOverrideRef[] {
  const refs: AvatarOverrideRef[] = [];
  characterMap.forEach((info, id) => {
    const override = info.conversationAvatar;
    if (override && (override.mode === "sprite" || override.mode === "gallery") && override.value) {
      refs.push({ charId: id, mode: override.mode, value: override.value });
    }
  });
  return refs;
}

export function useConversationAvatarOverrides(baseCharacterMap: CharacterMap): CharacterMap {
  const avatarOverrideRefs = useMemo(() => collectAvatarOverrideRefs(baseCharacterMap), [baseCharacterMap]);
  const { data: resolvedAvatarOverrides } = useQuery({
    queryKey: ["conversation-avatar-override", avatarOverrideRefs],
    enabled: avatarOverrideRefs.length > 0,
    // Keep this always-stale rather than caching for minutes: the queryFn degrades sprite/gallery
    // lookup failures into empty results, and a sprite/gallery asset can change in place without
    // altering {charId, mode, value}. A non-zero staleTime would pin a transient fallback or a
    // stale URL; staleTime 0 lets a remount/refocus re-resolve.
    staleTime: 0,
    queryFn: async () => {
      const result: Record<string, string> = {};
      const spriteCharIds = Array.from(
        new Set(avatarOverrideRefs.filter((ref) => ref.mode === "sprite").map((ref) => ref.charId)),
      );
      const galleryCharIds = Array.from(
        new Set(avatarOverrideRefs.filter((ref) => ref.mode === "gallery").map((ref) => ref.charId)),
      );
      const spriteLists = new Map<string, SpriteRow[]>();
      const galleryLists = new Map<string, GalleryRow[]>();

      await Promise.all([
        ...spriteCharIds.map(async (characterId) => {
          try {
            spriteLists.set(characterId, await spriteApi.list<SpriteRow[]>(characterId, { ownerType: "character" }));
          } catch {
            spriteLists.set(characterId, []);
          }
        }),
        ...galleryCharIds.map(async (characterId) => {
          try {
            galleryLists.set(
              characterId,
              await storageApi.list<GalleryRow>("character-gallery", { filters: { characterId } }),
            );
          } catch {
            galleryLists.set(characterId, []);
          }
        }),
      ]);

      for (const ref of avatarOverrideRefs) {
        if (ref.mode === "sprite") {
          const src = spriteLists.get(ref.charId)?.find((sprite) => sprite.expression === ref.value)?.url;
          if (src) result[ref.charId] = src;
          continue;
        }
        const image = galleryLists.get(ref.charId)?.find((galleryImage) => galleryImage.id === ref.value);
        const src = (image?.url || image?.filePath || "").trim();
        if (src) result[ref.charId] = src;
      }

      return result;
    },
  });

  return useMemo(() => {
    if (!resolvedAvatarOverrides || Object.keys(resolvedAvatarOverrides).length === 0) return baseCharacterMap;
    const next: CharacterMap = new Map(baseCharacterMap);
    for (const [characterId, src] of Object.entries(resolvedAvatarOverrides)) {
      const info = next.get(characterId);
      if (info) next.set(characterId, { ...info, conversationAvatarSrc: src });
    }
    return next;
  }, [baseCharacterMap, resolvedAvatarOverrides]);
}
