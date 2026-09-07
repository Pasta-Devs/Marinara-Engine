import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { normalizeAvatarCrop, type CharacterCatalogEntry } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { CardLibraryPreview } from "../characters/CardLibraryPreview";
import { dailyCharacters } from "../../lib/daily-characters";
import { getCharacterTitle } from "../../lib/character-display";
import { formatCardLibraryMeta } from "../../lib/card-library-search";
import { useUIStore } from "../../stores/ui.store";

export function HomeCharacterLibrary({
  characters,
  loading,
  error,
  onRetry,
}: {
  characters: CharacterCatalogEntry[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const [day, setDay] = useState(() => new Date().toDateString());
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const sync = () => setDay(new Date().toDateString());
    const timer = window.setTimeout(sync, midnight.getTime() - now.getTime() + 100);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [day]);
  const cards = useMemo(
    () =>
      dailyCharacters(
        characters.filter((card) => card.name.trim()),
        day,
      ),
    [characters, day],
  );
  const openLibrary = () => useUIStore.getState().openCharacterLibrary();
  return (
    <div className="@container flex h-full min-h-0 flex-col gap-2">
      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto pr-1 @[28rem]:grid-cols-2">
        {cards.map((card) => (
          <div key={card.id} className="space-y-1.5" data-home-library-character={card.id}>
            <CardLibraryPreview
              compact
              card={{
                ...card,
                title: getCharacterTitle({ name: card.name, comment: card.comment }),
                meta: formatCardLibraryMeta(card.creator, card.version),
                avatarCrop: normalizeAvatarCrop(card.avatarCrop) ?? undefined,
              }}
              onClick={openLibrary}
            />
            <button
              type="button"
              className="mari-chrome-control min-h-9 w-full gap-1.5 text-xs"
              onClick={() =>
                useUIStore
                  .getState()
                  .openModal("start-character-chat", { characterId: card.id, characterName: card.name })
              }
            >
              <MessageCircle size="0.875rem" />
              {t("home.characterLibrary.chat", { name: card.name })}
            </button>
          </div>
        ))}
        {cards.length === 0 && (
          <p className="py-3 text-xs text-[var(--muted-foreground)]">
            {t(
              error
                ? "home.characterLibrary.loadFailed"
                : loading
                  ? "ui.characters.characterlibraryview.loading"
                  : "home.characterLibrary.empty",
            )}
            {error && (
              <button type="button" className="mari-chrome-control mt-2 min-h-9 w-full" onClick={onRetry}>
                {t("home.recentChats.retry")}
              </button>
            )}
          </p>
        )}
      </div>
      <button type="button" className="mari-chrome-control min-h-9 shrink-0 text-xs" onClick={openLibrary}>
        {t("home.characterLibrary.browse")}
      </button>
    </div>
  );
}
