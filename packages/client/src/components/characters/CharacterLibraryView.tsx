import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type UIEvent } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Download,
  Hash,
  Pencil,
  Plus,
  Search,
  Star,
  User,
} from "lucide-react";
import { useCharacters } from "../../hooks/use-characters";
import { getCharacterTitle } from "../../lib/character-display";
import { estimateCharacterCardTokens, formatEstimatedTokens } from "../../lib/character-token-count";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../lib/utils";
import { useUIStore, type CharacterLibrarySort } from "../../stores/ui.store";
import type { CharacterData } from "@marinara-engine/shared";

const libraryToolbarButtonClass =
  "mari-chrome-control h-10 min-w-0 px-3 text-[0.75rem] md:h-9";
const libraryToolbarFieldClass =
  "mari-chrome-field h-10 w-full text-[0.75rem] md:h-9";
const libraryNewCharacterButtonClass =
  "mari-chrome-control mari-chrome-control--primary h-10 min-w-0 px-3 text-[0.75rem] md:h-9";

type CharacterRow = {
  id: string;
  data: string;
  comment?: string | null;
  avatarPath: string | null;
  createdAt: string;
  updatedAt: string;
};

type ParsedCharacterRow = CharacterRow & {
  parsed: Partial<CharacterData> & {
    extensions?: Record<string, unknown>;
  };
};

function parseCharacterRow(char: CharacterRow): ParsedCharacterRow {
  try {
    const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
    return { ...char, parsed: (parsed as ParsedCharacterRow["parsed"]) ?? {} };
  } catch {
    return { ...char, parsed: { name: "Unknown", description: "" } };
  }
}

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getCharacterTags(char: ParsedCharacterRow): string[] {
  return (Array.isArray(char.parsed.tags) ? char.parsed.tags : []).filter(
    (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
  );
}

function parseCharacterSearchQuery(value: string) {
  const excludedTags: string[] = [];
  const text = value
    .replace(/(?:^|\s)(?:-|!)(?:tag:|#)?(?:"([^"]+)"|(\S+))/gi, (_match, quoted: string, bare: string) => {
      const tag = (quoted ?? bare ?? "").trim();
      if (tag) excludedTags.push(tag.toLowerCase());
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  return {
    text: text.toLowerCase(),
    excludedTags,
  };
}

function getCharacterSummary(char: ParsedCharacterRow) {
  const creatorNotes = getText(char.parsed.creator_notes);
  if (creatorNotes) return creatorNotes;

  const description = getText(char.parsed.description);
  if (description) return description;

  const personality = getText(char.parsed.personality);
  if (personality) return personality;

  return "No creator notes yet.";
}

function getCharacterMeta(char: ParsedCharacterRow): string | null {
  const parts: string[] = [];
  const creator = getText(char.parsed.creator);
  const version = getText(char.parsed.character_version);

  if (creator) parts.push(creator);
  if (version) parts.push(`v${version}`);

  return parts.join(" · ") || null;
}

function truncateText(content: string, maxLength: number) {
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength - 3).trimEnd()}...`;
}

function getCharacterSections(char: ParsedCharacterRow) {
  return [
    { title: "Description", content: getText(char.parsed.description) },
    { title: "Personality", content: getText(char.parsed.personality) },
    { title: "Scenario", content: getText(char.parsed.scenario) },
    { title: "Opening Message", content: getText(char.parsed.first_mes) },
  ].filter((section) => section.content);
}

function CharacterLibraryDetailCard({
  character,
  onEdit,
}: {
  character: ParsedCharacterRow;
  onEdit: (id: string) => void;
}) {
  const characterName = getText(character.parsed.name) || "Unnamed";
  const characterTitle = getCharacterTitle({ name: characterName, comment: character.comment });
  const characterMeta = getCharacterMeta(character);
  const creatorNotes = getText(character.parsed.creator_notes);
  const sections = getCharacterSections(character);
  const tokenEstimate = estimateCharacterCardTokens(character.parsed);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)]/50 bg-[var(--background)]/70 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.95)] sm:rounded-[2rem]">
        <div className="mari-accent-soft-fill relative aspect-square overflow-hidden">
          {character.avatarPath ? (
            <img
              src={character.avatarPath}
              alt={characterName || "Selected character"}
              className="h-full w-full object-cover"
              style={getAvatarCropStyle(character.parsed.extensions?.avatarCrop as AvatarCropValue | undefined)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/85">
              <User size="2.5rem" />
            </div>
          )}
        </div>

        <div className="space-y-4 p-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{characterName}</h2>
                {characterTitle && (
                  <p className="mt-1 truncate text-sm italic text-[var(--muted-foreground)]">{characterTitle}</p>
                )}
                {characterMeta && (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                    {characterMeta}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className="mari-chrome-muted-badge gap-1 px-2.5 py-1 text-[0.6875rem]"
                  title="Estimated from character card text fields; actual tokenizer counts vary by model."
                >
                  <Hash size="0.75rem" />
                  {formatEstimatedTokens(tokenEstimate)}
                </span>
                {character.parsed.extensions?.fav && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[0.6875rem] font-medium text-amber-300">
                    <Star size="0.75rem" className="fill-current" /> Favorite
                  </span>
                )}
              </div>
            </div>

            {creatorNotes && (
              <p className="mt-4 rounded-[1.5rem] border border-[var(--border)]/50 bg-[var(--secondary)]/70 px-4 py-3 text-sm leading-6 text-[var(--muted-foreground)]">
                {creatorNotes}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => onEdit(character.id)}
                className="mari-chrome-control mari-chrome-control--primary px-4 py-2.5 text-sm"
              >
                <Pencil size="0.875rem" />
                Edit Character
              </button>
            </div>
          </div>
        </div>
      </div>

      {sections.length > 0 && (
        <div className="space-y-3">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[1.5rem] border border-[var(--border)]/50 bg-[var(--background)]/65 p-4"
            >
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                {section.title}
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]/88">
                {truncateText(section.content, section.title === "Opening Message" ? 420 : 620)}
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function CharacterLibraryView() {
  const closeCharacterLibrary = useUIStore((s) => s.closeCharacterLibrary);
  const openCharacterDetail = useUIStore((s) => s.openCharacterDetail);
  const openModal = useUIStore((s) => s.openModal);
  const selectedCharacterId = useUIStore((s) => s.characterLibrarySelectedId);
  const setSelectedCharacterId = useUIStore((s) => s.setCharacterLibrarySelectedId);
  const sort = useUIStore((s) => s.characterLibrarySort);
  const setCharacterLibrarySort = useUIStore((s) => s.setCharacterLibrarySort);
  const setCharacterLibraryScrollTop = useUIStore((s) => s.setCharacterLibraryScrollTop);
  const { data: characters, isLoading } = useCharacters();

  const [search, setSearch] = useState("");
  const libraryRootScrollRef = useRef<HTMLDivElement | null>(null);
  const libraryListScrollRef = useRef<HTMLElement | null>(null);
  const pendingLibraryScrollTopRef = useRef(0);
  const libraryScrollFrameRef = useRef<number | null>(null);

  const parsedCharacters = useMemo(() => {
    if (!characters) return [];
    return (characters as CharacterRow[]).map(parseCharacterRow);
  }, [characters]);

  const filteredCharacters = useMemo(() => {
    const query = parseCharacterSearchQuery(search);

    return parsedCharacters.filter((char) => {
      const tags = getCharacterTags(char);
      const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));
      if (query.excludedTags.some((tag) => tagSet.has(tag))) return false;
      if (!query.text) return true;

      const fields = [
        getText(char.parsed.name),
        getText(char.comment),
        getText(char.parsed.creator),
        getText(char.parsed.description),
        getText(char.parsed.creator_notes),
        getText(char.parsed.personality),
        ...tags,
      ];

      return fields.some((value) => value.toLowerCase().includes(query.text));
    });
  }, [parsedCharacters, search]);

  const sortedCharacters = useMemo(() => {
    const list = [...filteredCharacters];

    switch (sort) {
      case "name-asc":
        return list.sort((left, right) => getText(left.parsed.name).localeCompare(getText(right.parsed.name)));
      case "name-desc":
        return list.sort((left, right) => getText(right.parsed.name).localeCompare(getText(left.parsed.name)));
      case "newest":
        return list.sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
      case "oldest":
        return list.sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? ""));
      case "favorites":
        return list.sort((left, right) => {
          const leftFavorite = left.parsed.extensions?.fav ? 1 : 0;
          const rightFavorite = right.parsed.extensions?.fav ? 1 : 0;
          if (rightFavorite !== leftFavorite) return rightFavorite - leftFavorite;
          return getText(left.parsed.name).localeCompare(getText(right.parsed.name));
        });
      default:
        return list;
    }
  }, [filteredCharacters, sort]);

  useEffect(() => {
    if (selectedCharacterId && sortedCharacters.some((char) => char.id === selectedCharacterId)) return;
    setSelectedCharacterId(sortedCharacters[0]?.id ?? null);
  }, [selectedCharacterId, setSelectedCharacterId, sortedCharacters]);

  const selectedCharacter = useMemo(
    () => sortedCharacters.find((char) => char.id === selectedCharacterId) ?? null,
    [selectedCharacterId, sortedCharacters],
  );

  const getActiveLibraryScrollNode = useCallback(() => {
    const candidates = [libraryRootScrollRef.current, libraryListScrollRef.current];
    return (
      candidates.find((node) => {
        if (!node || node.scrollHeight <= node.clientHeight) return false;
        const overflowY = window.getComputedStyle(node).overflowY;
        return overflowY === "auto" || overflowY === "scroll";
      }) ??
      libraryRootScrollRef.current ??
      libraryListScrollRef.current
    );
  }, []);

  const rememberLibraryScroll = useCallback(() => {
    const node = getActiveLibraryScrollNode();
    if (!node) return;
    pendingLibraryScrollTopRef.current = node.scrollTop;
    setCharacterLibraryScrollTop(node.scrollTop);
  }, [getActiveLibraryScrollNode, setCharacterLibraryScrollTop]);

  const handleLibraryScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      if (event.currentTarget !== event.target) return;
      pendingLibraryScrollTopRef.current = event.currentTarget.scrollTop;
      if (libraryScrollFrameRef.current !== null) return;
      libraryScrollFrameRef.current = window.requestAnimationFrame(() => {
        libraryScrollFrameRef.current = null;
        setCharacterLibraryScrollTop(pendingLibraryScrollTopRef.current);
      });
    },
    [setCharacterLibraryScrollTop],
  );

  useLayoutEffect(() => {
    if (isLoading) return;
    const restoreScroll = () => {
      const scrollTop = useUIStore.getState().characterLibraryScrollTop;
      for (const node of [libraryRootScrollRef.current, libraryListScrollRef.current]) {
        if (!node) continue;
        const maxScrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
        node.scrollTop = Math.min(scrollTop, maxScrollTop);
      }
    };
    restoreScroll();
    const frame = window.requestAnimationFrame(restoreScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [isLoading, sortedCharacters.length]);

  useLayoutEffect(
    () => () => {
      if (libraryScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(libraryScrollFrameRef.current);
      }
    },
    [],
  );

  const openCharacterDetailFromLibrary = (id: string) => {
    rememberLibraryScroll();
    setSelectedCharacterId(id);
    openCharacterDetail(id, { preserveCharacterLibrary: true });
  };

  const handleSortChange = (value: string) => {
    setCharacterLibrarySort(value as CharacterLibrarySort);
  };

  return (
    <div
      ref={libraryRootScrollRef}
      onScroll={handleLibraryScroll}
      className="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_color-mix(in_srgb,var(--primary)_14%,transparent),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.14),_transparent_26%),var(--background)] lg:overflow-hidden"
    >
      <div className="sticky top-0 z-10 border-b border-[var(--border)]/40 bg-[var(--card)]/85 backdrop-blur-xl">
        <div className="flex flex-col gap-2 px-3 py-2 md:px-6 md:py-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={closeCharacterLibrary}
              className="mari-chrome-control h-9 w-9 rounded-2xl p-0 md:h-10 md:w-10"
              title="Close library"
            >
              <ArrowLeft size="0.95rem" />
            </button>
            <div className="min-w-0">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                Character Library
              </p>
              <h1 className="truncate text-base font-semibold text-[var(--foreground)] md:text-2xl">
                Browse your characters
              </h1>
              <p className="text-xs text-[var(--muted-foreground)] md:text-sm">
                {filteredCharacters.length} out of {parsedCharacters.length} card
                {parsedCharacters.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-1.5 sm:ml-auto sm:w-72 lg:w-80">
            <button
              onClick={() => openModal("create-character")}
              className={libraryNewCharacterButtonClass}
              title="New character"
              aria-label="New character"
            >
              <Plus size="0.75rem" />
            </button>
            <button
              onClick={() => openModal("import-character")}
              className={libraryToolbarButtonClass}
              title="Import character"
              aria-label="Import character"
            >
              <Download size="0.75rem" />
            </button>

            <div className="relative min-w-0">
              <Search
                size="0.75rem"
                className="mari-chrome-field-icon pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search characters"
                className={cn(libraryToolbarFieldClass, "pl-7 pr-2.5 placeholder:text-[var(--muted-foreground)]/70")}
              />
            </div>

            <div className="relative min-w-0">
              <select
                value={sort}
                onChange={(event) => handleSortChange(event.target.value)}
                className={cn(
                  libraryToolbarFieldClass,
                  "mari-chrome-sort-field mari-accent-animated appearance-none pl-2.5 pr-7",
                )}
              >
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="favorites">Favorites first</option>
              </select>
              <ArrowUpDown
                size="0.6875rem"
                className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-0 xl:grid-cols-[minmax(0,1.1fr)_28rem]">
        <section
          ref={libraryListScrollRef}
          onScroll={handleLibraryScroll}
          className="min-h-0 overflow-visible px-4 py-4 md:px-6 lg:overflow-y-auto"
        >
          {isLoading && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="shimmer aspect-square rounded-[1.75rem]" />
              ))}
            </div>
          )}

          {!isLoading && sortedCharacters.length === 0 && (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-[var(--border)]/60 bg-[var(--card)]/50 p-6 text-center">
              <div className="mari-accent-soft-fill flex h-14 w-14 items-center justify-center rounded-3xl text-[var(--primary)]">
                <User size="1.5rem" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">No matching characters</h2>
                <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
                  Try a different search, adjust sorting, or import a new card into the library.
                </p>
              </div>
            </div>
          )}

          {!isLoading && sortedCharacters.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3 2xl:grid-cols-4">
              {sortedCharacters.map((char) => {
                const charName = getText(char.parsed.name) || "Unnamed";
                const charTitle = getCharacterTitle({ name: charName, comment: char.comment });
                const cardSummary = truncateText(getCharacterSummary(char), 180);
                const cardMeta = getCharacterMeta(char);
                const tokenEstimate = estimateCharacterCardTokens(char.parsed);
                const isFavorite = !!char.parsed.extensions?.fav;
                const tags = getCharacterTags(char);
                const isActive = selectedCharacterId === char.id;

                return (
                  <Fragment key={char.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCharacterId(char.id)}
                      className={cn(
                        "group flex h-full items-stretch overflow-hidden rounded-[1.25rem] border bg-[var(--card)]/70 text-left shadow-[0_20px_50px_-32px_rgba(15,23,42,0.75)] transition-all hover:border-[var(--primary)]/35 hover:shadow-[0_24px_60px_-32px_color-mix(in_srgb,var(--primary)_45%,transparent)] sm:flex-col sm:rounded-[1.75rem] sm:hover:-translate-y-0.5",
                        isActive
                          ? "border-[var(--primary)]/45 ring-1 ring-[var(--primary)]/25"
                          : "border-[var(--border)]/50",
                      )}
                    >
                      <div className="mari-accent-soft-fill relative h-24 w-24 shrink-0 overflow-hidden sm:h-auto sm:w-full sm:aspect-square">
                        {char.avatarPath ? (
                          <img
                            src={char.avatarPath}
                            alt={charName}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            style={getAvatarCropStyle(
                              char.parsed.extensions?.avatarCrop as AvatarCropValue | undefined,
                            )}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-white/85">
                            <User size="1.5rem" className="sm:h-8 sm:w-8" />
                          </div>
                        )}

                        {isFavorite && (
                          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[0.5625rem] font-medium text-amber-200 backdrop-blur-sm sm:right-3 sm:top-3 sm:text-[0.625rem]">
                            <Star size="0.625rem" className="fill-current sm:h-[0.6875rem] sm:w-[0.6875rem]" /> Favorite
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--foreground)] sm:text-base">
                            {charName}
                          </div>
                          {charTitle && (
                            <div className="mt-0.5 truncate text-[0.625rem] italic text-[var(--muted-foreground)] sm:mt-1 sm:text-[0.6875rem]">
                              {charTitle}
                            </div>
                          )}
                          {cardMeta && (
                            <div className="mt-0.5 truncate text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)] sm:mt-1 sm:text-[0.625rem] sm:tracking-[0.18em]">
                              {cardMeta}
                            </div>
                          )}
                        </div>

                        <p className="line-clamp-3 text-[0.6875rem] leading-4 text-[var(--muted-foreground)] sm:line-clamp-4 sm:text-xs sm:leading-5">
                          {cardSummary}
                        </p>

                        <div className="mt-auto flex flex-wrap gap-1 sm:gap-1.5">
                          <span
                            className="mari-chrome-muted-badge gap-1 px-1.5 py-0.5 text-[0.5625rem] sm:px-2 sm:py-1 sm:text-[0.625rem]"
                            title="Estimated from character card text fields; actual tokenizer counts vary by model."
                          >
                            <Hash size="0.5625rem" />
                            {formatEstimatedTokens(tokenEstimate)}
                          </span>
                          {tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-[var(--primary)]/8 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--primary)]/85 sm:px-2 sm:py-1 sm:text-[0.625rem]"
                            >
                              {tag}
                            </span>
                          ))}
                          {tags.length > 2 && (
                            <span className="rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)] sm:px-2 sm:py-1 sm:text-[0.625rem]">
                              +{tags.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {isActive && (
                      <div className="col-span-full lg:hidden">
                        <CharacterLibraryDetailCard character={char} onEdit={openCharacterDetailFromLibrary} />
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 overflow-visible border-t border-[var(--border)]/40 bg-[var(--card)]/65 backdrop-blur-xl lg:block lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="space-y-4 p-4 md:p-6">
            {selectedCharacter ? (
              <CharacterLibraryDetailCard character={selectedCharacter} onEdit={openCharacterDetailFromLibrary} />
            ) : (
              <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-[var(--border)]/60 bg-[var(--background)]/65 p-6 text-center">
                <div className="mari-accent-soft-fill flex h-14 w-14 items-center justify-center rounded-3xl text-[var(--primary)]">
                  <User size="1.5rem" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">Select a card</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Pick a character from the grid to see a larger overview before editing.
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
