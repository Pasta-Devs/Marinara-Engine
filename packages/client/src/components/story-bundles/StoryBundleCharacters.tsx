// ──────────────────────────────────────────────
// Story Bundle Characters Tab
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Dices, Plus, Search, X } from "lucide-react";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";

const CHARACTER_PICKER_PAGE_SIZE = 20;

interface Character {
  id: string;
  data: unknown;
  comment?: string | null;
  avatarPath: string | null;
}

interface CharacterFolder {
  id: string;
  name: string;
  characterIds: string[];
}

export interface StoryBundleCharactersProps {
  characterIds: string[];
  onCharacterIdsChange: (ids: string[]) => void;
  characters: Character[];
  characterFolders: CharacterFolder[];
  validCharacterIds: Set<string>;
}

function getCharacterName(char: Character): string {
  try {
    const data = typeof char.data === "string" ? JSON.parse(char.data) : (char.data as Record<string, unknown> | null);
    return typeof data?.name === "string" ? data.name.trim() : "Unknown";
  } catch {
    return "Unknown";
  }
}

function getCharacterTitle(char: Character): string | null {
  return char.comment?.trim() || null;
}

function CroppedAvatarImage({
  avatarPath,
  avatarCrop,
  alt,
  className,
}: {
  avatarPath: string | null;
  avatarCrop?: AvatarCrop | null;
  alt: string;
  className?: string;
}) {
  const cropStyle: CSSProperties = getAvatarCropStyle(avatarCrop ?? null);

  if (!avatarPath) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]",
          className,
        )}
        aria-label={alt}
      >
        <span className="text-xs font-semibold">{alt.charAt(0).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-full", className)}>
      <img src={avatarPath} alt={alt} className="h-full w-full object-cover" style={cropStyle} />
    </div>
  );
}

export function StoryBundleCharacters({
  characterIds,
  onCharacterIdsChange,
  characters,
  characterFolders,
  validCharacterIds,
}: StoryBundleCharactersProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [characterPickerLimit, setCharacterPickerLimit] = useState(CHARACTER_PICKER_PAGE_SIZE);
  const [selectedGroupId, setSelectedGroupId] = useState("");

  useEffect(() => {
    setCharacterPickerLimit(CHARACTER_PICKER_PAGE_SIZE);
  }, [search]);

  const selectedIds = useMemo(() => new Set(characterIds), [characterIds]);

  const available = useMemo(() => {
    const query = search.toLowerCase().trim();
    return characters.filter((c) => {
      if (selectedIds.has(c.id)) return false;
      if (!validCharacterIds.has(c.id)) return false;
      if (!query) return true;
      const name = getCharacterName(c).toLowerCase();
      const title = (getCharacterTitle(c) ?? "").toLowerCase();
      return name.includes(query) || title.includes(query);
    });
  }, [characters, selectedIds, validCharacterIds, search]);

  const visibleAvailable = useMemo(() => available.slice(0, characterPickerLimit), [available, characterPickerLimit]);

  const selectedCharacters = useMemo(
    () => characters.filter((c) => selectedIds.has(c.id) && validCharacterIds.has(c.id)),
    [characters, selectedIds, validCharacterIds],
  );

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onCharacterIdsChange([...next]);
  };

  const handleRandom = () => {
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    const next = new Set(selectedIds);
    next.add(pick.id);
    onCharacterIdsChange([...next]);
  };

  const handleAddGroup = () => {
    if (!selectedGroupId) return;
    const folder = characterFolders.find((f) => f.id === selectedGroupId);
    if (!folder) return;
    const newIds = folder.characterIds.filter((id) => !selectedIds.has(id) && validCharacterIds.has(id));
    if (newIds.length === 0) return;
    const next = new Set(selectedIds);
    for (const id of newIds) next.add(id);
    onCharacterIdsChange([...next]);
    setSelectedGroupId("");
  };

  const groupNewCount = (folder: CharacterFolder) =>
    folder.characterIds.filter((id) => !selectedIds.has(id) && validCharacterIds.has(id)).length;

  return (
    <div data-testid="story-bundle-editor-characters" className="flex flex-col gap-6">
      {/* Add Characters */}
      <section>
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.addCharacters", "Add Characters")}
        </h3>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size="0.875rem"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              data-testid="story-bundle-editor-characters-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("storyBundles.searchCharacters", "Search characters…")}
              className="mari-input w-full rounded-lg border border-[var(--border)] bg-[var(--input)] py-1.5 pl-8 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>
          <button
            data-testid="story-bundle-editor-characters-random"
            onClick={handleRandom}
            disabled={available.length === 0}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            title={t("storyBundles.randomHint", "Pick a random character")}
          >
            <Dices size="0.75rem" />
            <span className="block truncate text-xs">{t("storyBundles.random", "Random")}</span>
          </button>
        </div>

        {visibleAvailable.length > 0 ? (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
            {visibleAvailable.map((char) => {
              const name = getCharacterName(char);
              const title = getCharacterTitle(char);
              return (
                <button
                  key={char.id}
                  data-testid={`story-bundle-editor-characters-add-${char.id}`}
                  onClick={() => handleToggle(char.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-all hover:bg-[var(--accent)]"
                >
                  <CroppedAvatarImage avatarPath={char.avatarPath} alt={name} className="h-7 w-7" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">{name}</div>
                    {title && <div className="truncate text-xs text-[var(--muted-foreground)]">{title}</div>}
                  </div>
                  <Plus size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
                </button>
              );
            })}
            {available.length > characterPickerLimit && (
              <button
                data-testid="story-bundle-editor-characters-load-more"
                onClick={() => setCharacterPickerLimit((limit) => limit + CHARACTER_PICKER_PAGE_SIZE)}
                className="w-full rounded-md px-2 py-1.5 text-center text-xs text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
              >
                {t("storyBundles.loadMore", "Load more")} ({visibleAvailable.length} {t("storyBundles.of", "of")}{" "}
                {available.length})
              </button>
            )}
          </div>
        ) : (
          <div
            data-testid="story-bundle-editor-characters-empty"
            className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm text-[var(--muted-foreground)]"
          >
            {search
              ? t("storyBundles.noCharactersMatch", "No characters match your search.")
              : t("storyBundles.allCharactersAdded", "All characters have been added.")}
          </div>
        )}
      </section>

      {/* Groups */}
      {characterFolders.length > 0 && (
        <section>
          <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">{t("storyBundles.groups", "Groups")}</h3>
          <div className="flex items-center gap-2">
            <select
              data-testid="story-bundle-editor-characters-group-select"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              aria-label={t("storyBundles.addFromGroup", "Add characters from group")}
              className="mari-input flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            >
              <option value="">{t("storyBundles.addFromGroup", "Add from group…")}</option>
              {characterFolders.map((folder) => {
                const newCount = groupNewCount(folder);
                return (
                  <option key={folder.id} value={folder.id}>
                    {folder.name} ({newCount > 0 ? newCount : t("storyBundles.allAdded", "all added")})
                  </option>
                );
              })}
            </select>
            <button
              data-testid="story-bundle-editor-characters-add-group"
              onClick={handleAddGroup}
              disabled={!selectedGroupId}
              className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("storyBundles.add", "Add")}
            </button>
          </div>
        </section>
      )}

      {/* Selected Characters */}
      <section data-testid="story-bundle-editor-characters-selected">
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.selectedCharacters", "Selected Characters")}
        </h3>

        {selectedCharacters.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
            {selectedCharacters.map((char) => {
              const name = getCharacterName(char);
              const title = getCharacterTitle(char);
              return (
                <div key={char.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                  <CroppedAvatarImage avatarPath={char.avatarPath} alt={name} className="h-7 w-7" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">{name}</div>
                    {title && <div className="truncate text-xs text-[var(--muted-foreground)]">{title}</div>}
                  </div>
                  <button
                    data-testid={`story-bundle-editor-characters-remove-${char.id}`}
                    onClick={() => handleToggle(char.id)}
                    className="shrink-0 rounded p-1 text-[var(--muted-foreground)] transition-all hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                    title={t("storyBundles.removeCharacter", "Remove")}
                  >
                    <X size="0.875rem" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            data-testid="story-bundle-editor-characters-selected-empty"
            className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm text-[var(--muted-foreground)]"
          >
            {t("storyBundles.charactersEmpty", "No characters assigned yet.")}
          </div>
        )}
      </section>
    </div>
  );
}
