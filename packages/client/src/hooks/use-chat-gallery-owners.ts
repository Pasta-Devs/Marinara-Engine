// ──────────────────────────────────────────────
// Hook: the characters and persona of a chat whose galleries the chat can use
// (assign a chat picture to them; show their background pictures).
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { galleryBackgroundPins, type AvatarCrop, type LocationBackgroundPin } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { characterKeys, useCharacterListRows, usePersonas } from "./use-characters";
import { getChatCharacterIds } from "../lib/chat-macros";
import type { GalleryAssignTarget } from "./use-gallery";

function cardFields(data: unknown): { name: string; avatarCrop: AvatarCrop | null } {
  try {
    const parsed = (typeof data === "string" ? JSON.parse(data) : data) as {
      name?: unknown;
      extensions?: { avatarCrop?: AvatarCrop | null };
    } | null;
    return {
      name: typeof parsed?.name === "string" ? parsed.name.trim() : "",
      avatarCrop: parsed?.extensions?.avatarCrop ?? null,
    };
  } catch {
    return { name: "", avatarCrop: null };
  }
}

type CharacterRow = { id: string; data: unknown; avatarPath?: string | null };

function characterOwner(character: CharacterRow): BackgroundOwner {
  const { name, avatarCrop } = cardFields(character.data);
  return {
    type: "character",
    id: character.id,
    name: name || "Character",
    avatarPath: character.avatarPath ?? null,
    avatarCrop,
  };
}

/** A chat owner, with the picture its heading shows in the background library. */
export type BackgroundOwner = GalleryAssignTarget & { avatarPath?: string | null; avatarCrop?: AvatarCrop | null };

export function useChatGalleryOwners(
  chat: { characterIds?: unknown; personaId?: string | null } | null | undefined,
): BackgroundOwner[] {
  const { data: allCharacters } = useCharacterListRows({ includeBuiltIn: true, enabled: !!chat });
  const { data: allPersonas } = usePersonas(!!chat?.personaId);
  const characterIdsKey = JSON.stringify(getChatCharacterIds(chat ?? null));
  const personaId = chat?.personaId ?? null;
  return useMemo(() => {
    const characterIds = JSON.parse(characterIdsKey) as string[];
    const byId = new Map(((allCharacters ?? []) as CharacterRow[]).map((character) => [character.id, character]));
    const owners: BackgroundOwner[] = [];
    for (const id of characterIds) {
      const character = byId.get(id);
      if (character) owners.push(characterOwner(character));
    }
    const persona = personaId
      ? (
          (allPersonas ?? []) as Array<{
            id: string;
            name?: string;
            avatarPath?: string | null;
            avatarCrop?: AvatarCrop | null;
          }>
        ).find((item) => item.id === personaId)
      : undefined;
    if (persona) {
      owners.push({
        type: "persona",
        id: persona.id,
        name: persona.name?.trim() || "Persona",
        avatarPath: persona.avatarPath ?? null,
        avatarCrop: persona.avatarCrop ?? null,
      });
    }
    return owners;
  }, [allCharacters, allPersonas, characterIdsKey, personaId]);
}

export type OwnerBackground = {
  imageId: string;
  /** The picture's gallery URL; the chat stores it as its background. */
  url: string;
  /** The places it shows, or the owner's name when it names none. */
  title: string;
  owner: BackgroundOwner;
  places: string | null;
};

type GalleryBackgroundImage = { id: string; url: string; customName: string | null };

function ownerBackground(owner: BackgroundOwner, image: GalleryBackgroundImage): OwnerBackground {
  return {
    imageId: image.id,
    url: image.url,
    // {{char}} in a character's gallery is that character; {{user}} in a persona's is that persona.
    title:
      (image.customName ?? "")
        .replace(owner.type === "character" ? /\{\{\s*char\s*\}\}/giu : /\{\{\s*user\s*\}\}/giu, owner.name)
        .trim() || owner.name,
    owner,
    places: image.customName?.trim() || null,
  };
}

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
          .map((image) => ownerBackground(owner, image)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owners, dataKey],
  );
}

/**
 * Every character's pictures labeled "background", in one request. Loads only while `enabled`,
 * so the background library asks for them when someone opens "All characters".
 */
export function useAllCharacterBackgrounds(enabled: boolean): {
  backgrounds: OwnerBackground[];
  loading: boolean;
  error: boolean;
  refetch: () => void;
} {
  const { data: characters, isLoading: charactersLoading } = useCharacterListRows({ includeBuiltIn: true, enabled });
  const {
    data: images,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: characterKeys.galleryBackgrounds(),
    queryFn: () => api.get<Array<GalleryBackgroundImage & { characterId: string }>>("/characters/gallery/backgrounds"),
    enabled,
  });
  const backgrounds = useMemo(() => {
    const owners = new Map(
      ((characters ?? []) as CharacterRow[]).map((character) => [character.id, characterOwner(character)]),
    );
    return (images ?? []).flatMap((image) => {
      const owner = owners.get(image.characterId);
      return owner ? [ownerBackground(owner, image)] : [];
    });
  }, [characters, images]);
  return { backgrounds, loading: enabled && (isLoading || charactersLoading), error: isError, refetch };
}

/** The chat's characters' and persona's gallery backgrounds that name places, as pinned places. */
export function useChatGalleryBackgroundPins(
  chat: { characterIds?: unknown; personaId?: string | null } | null | undefined,
): LocationBackgroundPin[] {
  const backgrounds = useChatOwnerBackgrounds(chat);
  return useMemo(() => {
    const pins: LocationBackgroundPin[] = [];
    const byOwner = new Map<string, OwnerBackground[]>();
    for (const background of backgrounds) {
      const key = `${background.owner.type}:${background.owner.id}`;
      byOwner.set(key, [...(byOwner.get(key) ?? []), background]);
    }
    for (const list of byOwner.values()) {
      const owner = list[0]!.owner;
      pins.push(
        ...galleryBackgroundPins(
          owner,
          list.map((background) => ({
            id: background.imageId,
            url: background.url,
            customKind: "background",
            customName: background.places,
          })),
        ),
      );
    }
    return pins;
  }, [backgrounds]);
}
