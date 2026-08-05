// ──────────────────────────────────────────────
// Resolve the custom emojis available in the active Conversation, with sources:
// the GLOBAL pool + the active persona's gallery emojis + each chat character's
// gallery emojis (gallery images tagged customKind="emoji"). Gallery-sourced
// emojis override a global of the same name (owner-wins). Used by the message
// renderer, the composer autocomplete, and the picker's Custom tab.
// ──────────────────────────────────────────────
import { useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useChatStore } from "../stores/chat.store";
import { useChat } from "./use-chats";
import { getChatCharacterIds } from "../lib/chat-macros";
import { parseCharacterDisplayData } from "../lib/character-display";
import { useCustomEmojis } from "./use-custom-emojis";
import {
  usePersona,
  usePersonaGalleryImages,
  characterKeys,
  type CharacterGalleryImage,
} from "./use-characters";

export interface ConversationCustomEmoji {
  name: string;
  url: string;
  /** Display label for where the emoji comes from: "Global", a persona name, or a character name. */
  source: string;
  /** Global emojis are editable in the picker; gallery-sourced ones are managed in their gallery. */
  editable: boolean;
}

function displayName(row: { data?: unknown; name?: unknown } | undefined, fallback: string): string {
  if (!row) return fallback;
  const parsed = parseCharacterDisplayData({ data: row.data }).name;
  if (parsed && parsed !== "Unknown") return parsed;
  return typeof row.name === "string" && row.name.trim() ? row.name.trim() : fallback;
}

export function useConversationCustomEmojis(): { list: ConversationCustomEmoji[]; map: Map<string, string> } {
  const stableResultRef = useRef<{ list: ConversationCustomEmoji[]; map: Map<string, string> } | null>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: activeChat } = useChat(activeChatId);
  const personaId = activeChat?.personaId ?? null;
  const characterIds = getChatCharacterIds(activeChat);

  const { data: globalEmojis } = useCustomEmojis();
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

  // Combine, deduped by name; gallery-sourced emojis override a global of the same name.
  const byName = new Map<string, ConversationCustomEmoji>();
  for (const emoji of globalEmojis ?? []) {
    byName.set(emoji.name, { name: emoji.name, url: emoji.url, source: "Global", editable: true });
  }
  for (const img of personaImages ?? []) {
    if (img.customKind === "emoji" && img.customName) {
      byName.set(img.customName, { name: img.customName, url: img.url, source: personaName, editable: false });
    }
  }
  charGalleries.forEach((query, index) => {
    const id = characterIds[index];
    const source = (id && charNameById.get(id)) || "Character";
    for (const img of query.data ?? []) {
      if (img.customKind === "emoji" && img.customName) {
        byName.set(img.customName, { name: img.customName, url: img.url, source, editable: false });
      }
    }
  });

  // [#3223] The derivation above rebuilds fresh objects every render (the
  // useQueries result arrays churn identity per render), but the resolved set
  // rarely changes. Reuse the previous { list, map } when it is element-wise
  // identical — every mounted ConversationMessage receives `map` as a prop, so
  // a fresh Map per render broke React.memo for the whole transcript on every
  // streaming frame (the #3164 disease; same ref-reuse pattern as ChatArea's
  // chatCharacterRows).
  const next = [...byName.values()];
  const previous = stableResultRef.current;
  if (
    previous &&
    previous.list.length === next.length &&
    next.every((emoji, index) => {
      const before = previous.list[index]!;
      return (
        before.name === emoji.name &&
        before.url === emoji.url &&
        before.source === emoji.source &&
        before.editable === emoji.editable
      );
    })
  ) {
    return previous;
  }
  const result = { list: next, map: new Map(next.map((emoji) => [emoji.name, emoji.url] as const)) };
  stableResultRef.current = result;
  return result;
}
