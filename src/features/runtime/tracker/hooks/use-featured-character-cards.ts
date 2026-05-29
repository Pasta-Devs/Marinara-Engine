import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdateChatMetadata } from "../../../catalog/chats/index";
import { normalizeStringArray } from "../../../../shared/lib/tracker-metadata";
import { TRACKER_FEATURED_CHARACTER_META_KEY } from "../components/tracker-data-sidebar.constants";

function getFeaturedCharacterCardValues(cards: Set<string>) {
  return Array.from(cards);
}

function getFeaturedCharacterCardSignature(values: string[]) {
  return JSON.stringify(values);
}

export function useFeaturedCharacterCards({
  activeChatId,
  chatMeta,
}: {
  activeChatId: string | null;
  chatMeta: Record<string, unknown>;
}) {
  const updateChatMetadata = useUpdateChatMetadata();
  const [featuredCharacterCards, setFeaturedCharacterCards] = useState<Set<string>>(() => new Set());
  const featuredCharacterCardsRef = useRef<Set<string>>(new Set());
  const pendingPersistRef = useRef<{ chatId: string; signature: string } | null>(null);
  const persistChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const values = normalizeStringArray(chatMeta[TRACKER_FEATURED_CHARACTER_META_KEY]);
    const pendingPersist = activeChatId ? pendingPersistRef.current : null;
    if (
      pendingPersist?.chatId === activeChatId &&
      pendingPersist.signature !== getFeaturedCharacterCardSignature(values)
    ) {
      return;
    }
    if (pendingPersist?.chatId === activeChatId) {
      pendingPersistRef.current = null;
    }

    const next = new Set(values);
    featuredCharacterCardsRef.current = next;
    setFeaturedCharacterCards(next);
  }, [activeChatId, chatMeta]);

  const persistFeaturedCharacterCards = useCallback(
    (next: Set<string>) => {
      featuredCharacterCardsRef.current = next;
      setFeaturedCharacterCards(next);
      if (!activeChatId) return;

      const values = getFeaturedCharacterCardValues(next);
      const signature = getFeaturedCharacterCardSignature(values);
      pendingPersistRef.current = { chatId: activeChatId, signature };
      persistChainRef.current = persistChainRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            await updateChatMetadata.mutateAsync({
              id: activeChatId,
              [TRACKER_FEATURED_CHARACTER_META_KEY]: values,
            });
          } catch {
            // Keep the local optimistic selection; the next toggle will retry with the latest set.
          } finally {
            if (
              pendingPersistRef.current?.chatId === activeChatId &&
              pendingPersistRef.current.signature === signature
            ) {
              pendingPersistRef.current = null;
            }
          }
        });
    },
    [activeChatId, updateChatMetadata],
  );

  const removeFeaturedCharacterCard = useCallback(
    (key: string) => {
      if (!featuredCharacterCardsRef.current.has(key)) return;
      const next = new Set(featuredCharacterCardsRef.current);
      next.delete(key);
      persistFeaturedCharacterCards(next);
    },
    [persistFeaturedCharacterCards],
  );

  const toggleFeaturedCharacterCard = useCallback(
    (key: string) => {
      const next = new Set(featuredCharacterCardsRef.current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      persistFeaturedCharacterCards(next);
    },
    [persistFeaturedCharacterCards],
  );

  return {
    featuredCharacterCards,
    removeFeaturedCharacterCard,
    toggleFeaturedCharacterCard,
  };
}
