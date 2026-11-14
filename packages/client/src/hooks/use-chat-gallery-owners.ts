// ──────────────────────────────────────────────
// Hook: the characters and persona of a chat whose galleries the chat can use
// (assign a chat picture to them; show their background pictures).
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { characterKeys, useCharacters, usePersonas } from "./use-characters";
import { getChatCharacterIds } from "../lib/chat-macros";
import type { GalleryAssignTarget } from "./use-gallery";

function cardName(data: unknown): string {
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    const name = parsed && typeof parsed === "object" ? (parsed as { name?: unknown }).name : null;
    return typeof name === "string" ? name.trim() : "";
  } catch {
    return "";
  }
}

export function useChatGalleryOwners(
  chat: { characterIds?: unknown; personaId?: string | null } | null | undefined,
): GalleryAssignTarget[] {
  const { data: allCharacters } = useCharacters({ includeBuiltIn: true, enabled: !!chat });
  const { data: allPersonas } = usePersonas(!!chat?.personaId);
  const characterIdsKey = JSON.stringify(getChatCharacterIds(chat ?? null));
  const personaId = chat?.personaId ?? null;
  return useMemo(() => {
    const characterIds = JSON.parse(characterIdsKey) as string[];
    const byId = new Map(
      ((allCharacters ?? []) as Array<{ id: string; data: unknown }>).map((character) => [character.id, character]),
    );
    const owners: GalleryAssignTarget[] = [];
    for (const id of characterIds) {
      const character = byId.get(id);
      if (character) owners.push({ type: "character", id, name: cardName(character.data) || "Character" });
    }
    const persona = personaId
      ? ((allPersonas ?? []) as Array<{ id: string; name?: string }>).find((item) => item.id === personaId)
      : undefined;
    if (persona) owners.push({ type: "persona", id: persona.id, name: persona.name?.trim() || "Persona" });
    return owners;
  }, [allCharacters, allPersonas, characterIdsKey, personaId]);
}

export type OwnerBackground = {
  /** The picture's gallery URL; the chat stores it as its background. */
  url: string;
  /** The places it shows, or the owner's name when it names none. */
  title: string;
  owner: GalleryAssignTarget;
  places: string | null;
};

/** The pictures labeled "background" in the galleries of the chat's characters and persona. */
export function useChatOwnerBackgrounds(
  chat: { characterIds?: unknown; personaId?: string | null } | null | undefined,
): OwnerBackground[] {
  const owners = useChatGalleryOwners(chat);
  const results = useQueries({
    queries: owners.map((owner) => ({
      queryKey: owner.type === "character" ? characterKeys.gallery(owner.id) : characterKeys.personaGallery(owner.id),
      queryFn: () =>
        api.get<Array<{ id: string; url: string; customKind: string | null; customName: string | null }>>(
          owner.type === "character" ? `/characters/${owner.id}/gallery` : `/characters/personas/${owner.id}/gallery`,
        ),
      staleTime: 5 * 60_000,
    })),
  });
  const dataKey = results.map((result) => result.dataUpdatedAt).join(",");
  return useMemo(
    () =>
      owners.flatMap((owner, index) =>
        (results[index]?.data ?? [])
          .filter((image) => image.customKind === "background")
          .map((image) => ({
            url: image.url,
            title: image.customName?.trim() || owner.name,
            owner,
            places: image.customName?.trim() || null,
          })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owners, dataKey],
  );
}
