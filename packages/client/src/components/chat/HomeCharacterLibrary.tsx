import { useEffect, useMemo, useState } from "react";
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
  return (
    <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-2" data-home-library-grid>
      {cards.map((card) => (
        <div key={card.id} className="flex min-h-0 min-w-0 flex-col gap-1.5" data-home-library-character={card.id}>
          <CardLibraryPreview
            compact
            card={{
              ...card,
              title: getCharacterTitle({ name: card.name, comment: card.comment }),
              meta: formatCardLibraryMeta(card.creator, card.version),
              avatarCrop: normalizeAvatarCrop(card.avatarCrop) ?? undefined,
            }}
            onClick={() => useUIStore.getState().openCharacterLibrary(card.id)}
          />
        </div>
      ))}
      {cards.length === 0 && (
        <p className="col-span-2 py-3 text-xs text-[var(--muted-foreground)]">
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
  );
}
