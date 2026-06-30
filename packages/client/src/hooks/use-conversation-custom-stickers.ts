// ──────────────────────────────────────────────
// Resolve the custom stickers available in the active Conversation, with sources:
// the GLOBAL pool + the active persona's gallery stickers + each chat character's
// gallery stickers (gallery images tagged customKind="sticker"). Gallery-sourced
// stickers override a global of the same name (owner-wins). Used by the message
// renderer and the sticker selector.
// ──────────────────────────────────────────────
import { useQueries } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useChatStore } from "../stores/chat.store";
import { useChat } from "./use-chats";
import { getChatCharacterIds } from "../lib/chat-macros";
import { parseCharacterDisplayData } from "../lib/character-display";
import { useCustomStickers } from "./use-custom-stickers";
import {
  usePersona,
  usePersonaGalleryImages,
  characterKeys,
  type CharacterGalleryImage,
} from "./use-characters";

export interface ConversationCustomSticker {
  name: string;
  url: string;
  /** Display label for where the sticker comes from: "Global", a persona name, or a character name. */
  source: string;
  /** Global stickers are editable in the selector; gallery-sourced ones are managed in their gallery. */
  editable: boolean;
}

function displayName(row: { data?: unknown; name?: unknown } | undefined, fallback: string): string {
  if (!row) return fallback;
  const parsed = parseCharacterDisplayData({ data: row.data }).name;
  if (parsed && parsed !== "Unknown") return parsed;
  return typeof row.name === "string" && row.name.trim() ? row.name.trim() : fallback;
}

export function useConversationCustomStickers(): { list: ConversationCustomSticker[]; map: Map<string, string> } {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: activeChat } = useChat(activeChatId);
  const personaId = (activeChat as { personaId?: string | null } | undefined)?.personaId ?? null;
  const characterIds = getChatCharacterIds(activeChat);

  const { data: globalStickers } = useCustomStickers();
  const { data: personaImages } = usePersonaGalleryImages(personaId);
  const { data: persona } = usePersona(personaId);
  const characterQueries = useQueries({
    queries: characterIds.map((id) => ({
      queryKey: characterKeys.detail(id),
      queryFn: () => api.get<{ id: string; data?: unknown; name?: unknown }>(`/characters/${id}`),
      enabled: !!id,
      retry: false,
      staleTime: 5 * 60_000,
    })),
  });

  const charGalleries = useQueries({
    queries: characterIds.map((id) => ({
      queryKey: characterKeys.gallery(id),
      queryFn: () => api.get<CharacterGalleryImage[]>(`/characters/${id}/gallery`),
      enabled: !!id,
      staleTime: 5 * 60_000,
    })),
  });

  const characterRows = characterQueries
    .map((query) => query.data)
    .filter((row): row is { id: string; data?: unknown; name?: unknown } => typeof row?.id === "string");
  const personaName = personaId ? displayName(persona, "Persona") : "Persona";
  const charNameById = new Map<string, string>();
  for (const row of characterRows) charNameById.set(row.id, displayName(row, "Character"));

  // Combine, deduped by name; gallery-sourced stickers override a global of the same name.
  const byName = new Map<string, ConversationCustomSticker>();
  for (const sticker of globalStickers ?? []) {
    byName.set(sticker.name, { name: sticker.name, url: sticker.url, source: "Global", editable: true });
  }
  for (const img of personaImages ?? []) {
    if (img.customKind === "sticker" && img.customName) {
      byName.set(img.customName, { name: img.customName, url: img.url, source: personaName, editable: false });
    }
  }
  charGalleries.forEach((query, index) => {
    const id = characterIds[index];
    const source = (id && charNameById.get(id)) || "Character";
    for (const img of query.data ?? []) {
      if (img.customKind === "sticker" && img.customName) {
        byName.set(img.customName, { name: img.customName, url: img.url, source, editable: false });
      }
    }
  });

  const list = [...byName.values()];
  const map = new Map(list.map((sticker) => [sticker.name, sticker.url] as const));
  return { list, map };
}
