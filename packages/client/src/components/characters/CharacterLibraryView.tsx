import { CardLibraryPreview } from "./CardLibraryPreview";
import { AvatarImage } from "./AvatarImage";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import {
  ArrowUpDown,
  BookOpen,
  Check,
  Download,
  Hash,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Star,
  User,
  type LucideIcon,
} from "lucide-react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { matchesCardLibrarySearch, parseCardLibrarySearchQuery } from "../../lib/card-library-search";
import { formatEstimatedTokens } from "../../lib/character-token-count";
import { librarySortOptions } from "../../lib/library-sort-options";
import { applyInlineMarkdown, renderMarkdownBlocks } from "../../lib/markdown";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { useLoadMoreWhenNear } from "../panels/PanelLoadMoreBar";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { isTokenSort } from "@marinara-engine/shared";
import { sortItemsByTokens } from "../../lib/panel-sort";
import { useUIStore, type CardLibraryKind, type UIState } from "../../stores/ui.store";
import { useSetLorebooksEnabled } from "../../hooks/use-lorebooks";
import { SurfaceBackButton } from "../ui/SurfaceBackButton";
import { Select } from "../ui/Select";
import { SurfaceCloseButton, selectShowsSurfaceClose } from "../ui/SurfaceCloseButton";
import { toast } from "sonner";
import { PanelVirtualList } from "../panels/PanelVirtualList";
import {
  useCharacterLibrarySource,
  useLorebookLibrarySource,
  usePersonaLibrarySource,
  type LibraryCard,
} from "./card-library-sources";

const libraryToolbarButtonClass =
  "mari-chrome-control mari-chrome-control--primary h-10 min-h-10 min-w-0 px-3 text-[0.75rem]";
const libraryToolbarFieldClass = "mari-chrome-field h-10 w-full text-[0.75rem] md:h-9";
const detailActionClass =
  "mari-chrome-control mari-chrome-control--regular-label min-h-10 px-3 py-2 text-xs sm:px-4 sm:text-sm";

type StoreKey = keyof UIState;

/** Everything that differs between the library kinds; only the detail actions branch on the kind itself. */
type LibraryKindConfig = {
  singular: "character" | "persona" | "lorebook";
  plural: "characters" | "personas" | "lorebooks";
  title: string;
  heading: string;
  /** Label of the Edit button's noun ("Edit Character"). */
  editNounKey: string;
  /** Header counts: all loaded, and while more pages remain. */
  countKey: string;
  loadedCountKey: string;
  placeholderClass: string;
  gradientClass: string;
  PlaceholderIcon: LucideIcon;
  createModal: string;
  importModal: string;
  /** i18n key of the search placeholder, or an English string run through `localize`. */
  searchPlaceholder: { key: string } | { text: string };
  hasFavorites: boolean;
  store: {
    selectedId: StoreKey;
    setSelectedId: StoreKey;
    sort: StoreKey;
    setSort: StoreKey;
    scrollTop: StoreKey;
    setScrollTop: StoreKey;
  };
};

export const CARD_LIBRARY_KINDS: Record<CardLibraryKind, LibraryKindConfig> = {
  characters: {
    singular: "character",
    plural: "characters",
    title: "Character Library",
    heading: "Browse your characters",
    editNounKey: "ui.characters.cardlibrarydetailcard.character",
    countKey: "ui.characters.characterlibraryview.cardCount",
    loadedCountKey: "ui.characters.characterlibraryview.loadedCount",
    placeholderClass: "mari-avatar-placeholder--character",
    gradientClass: "mari-panel-gradient--characters",
    PlaceholderIcon: User,
    createModal: "create-character",
    importModal: "import-character",
    searchPlaceholder: { key: "search.panels.characters" },
    hasFavorites: true,
    store: {
      selectedId: "characterLibrarySelectedId",
      setSelectedId: "setCharacterLibrarySelectedId",
      sort: "characterLibrarySort",
      setSort: "setCharacterLibrarySort",
      scrollTop: "characterLibraryScrollTop",
      setScrollTop: "setCharacterLibraryScrollTop",
    },
  },
  personas: {
    singular: "persona",
    plural: "personas",
    title: "Persona Library",
    heading: "Browse your personas",
    editNounKey: "ui.characters.cardlibrarydetailcard.persona",
    countKey: "ui.characters.characterlibraryview.cardCount",
    loadedCountKey: "ui.characters.characterlibraryview.loadedCount",
    placeholderClass: "mari-avatar-placeholder--persona",
    gradientClass: "mari-panel-gradient--personas",
    PlaceholderIcon: User,
    createModal: "create-persona",
    importModal: "import-persona",
    searchPlaceholder: { text: "Search personas" },
    hasFavorites: false,
    store: {
      selectedId: "personaLibrarySelectedId",
      setSelectedId: "setPersonaLibrarySelectedId",
      sort: "personaLibrarySort",
      setSort: "setPersonaLibrarySort",
      scrollTop: "personaLibraryScrollTop",
      setScrollTop: "setPersonaLibraryScrollTop",
    },
  },
  lorebooks: {
    singular: "lorebook",
    plural: "lorebooks",
    title: "Lorebook Library",
    heading: "Browse your lorebooks",
    editNounKey: "ui.characters.cardlibrarydetailcard.lorebook",
    countKey: "ui.characters.characterlibraryview.lorebookCount",
    loadedCountKey: "ui.characters.characterlibraryview.loadedLorebookCount",
    placeholderClass: "mari-avatar-placeholder--lorebook",
    gradientClass: "mari-panel-gradient--lorebooks",
    PlaceholderIcon: BookOpen,
    createModal: "create-lorebook",
    importModal: "import-lorebook",
    searchPlaceholder: { key: "search.panels.lorebooks" },
    hasFavorites: false,
    store: {
      selectedId: "lorebookLibrarySelectedId",
      setSelectedId: "setLorebookLibrarySelectedId",
      sort: "lorebookLibrarySort",
      setSort: "setLorebookLibrarySort",
      scrollTop: "lorebookLibraryScrollTop",
      setScrollTop: "setLorebookLibraryScrollTop",
    },
  },
};

function truncateText(content: string, maxLength: number) {
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength - 3).trimEnd()}...`;
}

function CardLibraryDetailCard({
  card,
  kind,
  actions,
}: {
  card: LibraryCard;
  kind: CardLibraryKind;
  /** The action buttons under the header; two or more share a two-column grid. */
  actions: ReactNode[];
}) {
  const { t: localizeUi } = useUiTranslation();
  const config = CARD_LIBRARY_KINDS[kind];
  const { PlaceholderIcon } = config;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/70 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.95)] sm:rounded-[2rem]">
        <div className={cn("mari-avatar-placeholder relative aspect-square overflow-hidden", config.placeholderClass)}>
          {card.avatarPath ? (
            <AvatarImage
              src={card.avatarPath}
              alt={card.name}
              iconSize="2.5rem"
              className="h-full w-full object-cover"
              style={getAvatarCropStyle(card.avatarCrop)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--marinara-chat-chrome-panel-title)]">
              <PlaceholderIcon size="2.5rem" />
            </div>
          )}
        </div>

        <div className="space-y-4 p-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-[var(--marinara-chat-chrome-panel-title)] sm:text-2xl">
                  {card.name}
                </h2>
                {card.title && (
                  <p className="mt-1 truncate text-sm italic text-[var(--marinara-chat-chrome-panel-muted)]">
                    {card.title}
                  </p>
                )}
                {card.meta && (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--marinara-chat-chrome-panel-muted)]">
                    {card.meta}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {card.tokenEstimate !== undefined && (
                  <span
                    className="mari-chrome-muted-badge gap-1 px-2.5 py-1 text-[0.6875rem]"
                    title={localizeUi(
                      "ui.characters.cardlibrarydetailcard.estimatedFromValue1CardTextFieldsActualTokenizerCounts",
                      { value1: config.singular },
                    )}
                  >
                    <Hash size="0.75rem" />
                    {formatEstimatedTokens(card.tokenEstimate, localizeUi)}
                  </span>
                )}
                {card.entryCount !== undefined && (
                  <span className="mari-chrome-muted-badge gap-1 px-2.5 py-1 text-[0.6875rem]">
                    <BookOpen size="0.75rem" />
                    {localizeUi("chat.settings.inlineLorebook.entryCount", { count: card.entryCount })}
                  </span>
                )}
                {card.favorite && (
                  <span
                    data-character-favorite-indicator="detail"
                    className="mari-chrome-accent-surface mari-accent-animated mari-chrome-tag inline-flex items-center gap-1 px-2.5 py-1 text-[0.6875rem] font-medium"
                  >
                    <Star size="0.75rem" className="fill-current" />{" "}
                    {localizeUi("ui.characters.cardlibrarydetailcard.favorite")}
                  </span>
                )}
              </div>
            </div>

            {card.hasExplicitSummary && (
              <section className="mt-4 rounded-[1.5rem] border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-4 py-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-panel-muted)]">
                  {localizeUi("ui.characters.summary.label")}
                </h3>
                <div className="mari-message-content mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--marinara-chat-chrome-panel-text)]">
                  {renderMarkdownBlocks(card.summary, applyInlineMarkdown, `summary-${card.id}`)}
                </div>
              </section>
            )}

            {card.creatorNotes && (
              <div className="mari-message-content mt-4 whitespace-pre-wrap rounded-[1.5rem] border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-4 py-3 text-sm leading-6 text-[var(--marinara-chat-chrome-panel-text)]">
                {renderMarkdownBlocks(card.creatorNotes, applyInlineMarkdown, `creator-notes-${card.id}`)}
              </div>
            )}

            <div className={cn("mt-4 gap-2", actions.length > 1 ? "grid grid-cols-2" : "flex flex-wrap")}>
              {actions}
            </div>
          </div>
        </div>
      </div>

      {card.sections.length > 0 && (
        <div className="space-y-3">
          {card.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[1.5rem] border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/65 p-4"
            >
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marinara-chat-chrome-panel-muted)]">
                {localizeUi(section.title)}
              </h3>
              <div className="mari-message-content mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--marinara-chat-chrome-panel-text)]">
                {renderMarkdownBlocks(
                  truncateText(section.content, section.title === "ui.cardLibrary.sections.openingMessage" ? 420 : 620),
                  applyInlineMarkdown,
                  `card-${card.id}-${section.title}`,
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** The full-page Library for characters, personas and lorebooks; `cardLibraryKind` picks the collection. */
/** The old grid's viewport breakpoints: 1 column, 2 from sm, 3 from xl, 4 from 2xl. */
const libraryColumns = () => {
  const width = window.innerWidth;
  return width >= 1536 ? 4 : width >= 1280 ? 3 : width >= 640 ? 2 : 1;
};

export function CharacterLibraryView() {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const kind = useUIStore((s) => s.cardLibraryKind);
  const showsClose = useUIStore(selectShowsSurfaceClose);
  const config = CARD_LIBRARY_KINDS[kind];
  const { PlaceholderIcon } = config;
  const openCharacterDetail = useUIStore((s) => s.openCharacterDetail);
  const openPersonaDetail = useUIStore((s) => s.openPersonaDetail);
  const openLorebookDetail = useUIStore((s) => s.openLorebookDetail);
  const openModal = useUIStore((s) => s.openModal);
  const initialCharacterId = useUIStore((s) => s.characterLibraryInitialId);
  const initialScrollHandled = useRef<string | null>(null);
  const selectedId = useUIStore((s) => s[config.store.selectedId] as string | null);
  const sort = useUIStore((s) => s[config.store.sort] as string);
  const setLorebooksEnabled = useSetLorebooksEnabled();

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const serverSearch = useMemo(() => parseCardLibrarySearchQuery(deferredSearch).text, [deferredSearch]);
  // Every kind's source runs; only the shown one is enabled, so hook order never changes with the kind.
  const sources = {
    characters: useCharacterLibrarySource({
      enabled: kind === "characters",
      search: serverSearch,
      sort: kind === "characters" ? sort : "",
      initialId: initialCharacterId,
    }),
    personas: usePersonaLibrarySource({
      enabled: kind === "personas",
      search: serverSearch,
      sort: kind === "personas" ? sort : "",
    }),
    lorebooks: useLorebookLibrarySource({
      enabled: kind === "lorebooks",
      search: serverSearch,
      sort: kind === "lorebooks" ? sort : "",
    }),
  };
  const source = sources[kind];
  const { cards, isLoading, hasNextPage, isFetchingNextPage } = source;
  const libraryRootScrollRef = useRef<HTMLDivElement | null>(null);
  const libraryListScrollRef = useRef<HTMLElement | null>(null);
  const pendingLibraryScrollTopRef = useRef(0);
  const libraryScrollFrameRef = useRef<number | null>(null);

  const filteredCards = useMemo(() => {
    const query = parseCardLibrarySearchQuery(search);
    return cards.filter((card) => matchesCardLibrarySearch(card, query));
  }, [cards, search]);

  const sortedCards = useMemo(() => {
    // Same order as the server's pages, so a page loaded later lands below the rows already shown.
    if (isTokenSort(sort))
      return sortItemsByTokens(
        filteredCards,
        sort,
        (card) => card.tokenEstimate,
        (card) => card.name,
      );
    const list = [...filteredCards];
    switch (sort) {
      case "name-asc":
        return list.sort((left, right) => left.name.localeCompare(right.name));
      case "name-desc":
        return list.sort((left, right) => right.name.localeCompare(left.name));
      case "newest":
        return list.sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
      case "oldest":
        return list.sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? ""));
      case "favorites":
        return list.sort(
          (left, right) => Number(right.favorite) - Number(left.favorite) || left.name.localeCompare(right.name),
        );
      default:
        return list;
    }
  }, [filteredCards, sort]);

  const callStoreSetter = useCallback(
    (key: StoreKey, value: unknown) => (useUIStore.getState()[key] as (value: unknown) => void)(value),
    [],
  );
  const setSelectedId = useCallback(
    (id: string | null) => callStoreSetter(config.store.setSelectedId, id),
    [callStoreSetter, config.store.setSelectedId],
  );

  useEffect(() => {
    if (isLoading) return;
    if (selectedId && sortedCards.some((card) => card.id === selectedId)) return;
    setSelectedId(sortedCards[0]?.id ?? null);
  }, [isLoading, selectedId, setSelectedId, sortedCards]);

  const selectedCard = useMemo(
    () => sortedCards.find((card) => card.id === selectedId) ?? null,
    [selectedId, sortedCards],
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

  const saveScrollTop = useCallback(
    (scrollTop: number) => callStoreSetter(config.store.setScrollTop, scrollTop),
    [callStoreSetter, config.store.setScrollTop],
  );

  const rememberLibraryScroll = useCallback(() => {
    const node = getActiveLibraryScrollNode();
    if (!node) return;
    pendingLibraryScrollTopRef.current = node.scrollTop;
    saveScrollTop(node.scrollTop);
  }, [getActiveLibraryScrollNode, saveScrollTop]);

  const handleLibraryScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      if (event.currentTarget !== event.target) return;
      pendingLibraryScrollTopRef.current = event.currentTarget.scrollTop;
      if (libraryScrollFrameRef.current !== null) return;
      libraryScrollFrameRef.current = window.requestAnimationFrame(() => {
        libraryScrollFrameRef.current = null;
        saveScrollTop(pendingLibraryScrollTopRef.current);
      });
    },
    [saveScrollTop],
  );

  const initialTargetId = kind === "characters" ? initialCharacterId : null;
  const initialTargetIndex = initialTargetId ? sortedCards.findIndex((card) => card.id === initialTargetId) : undefined;
  useLayoutEffect(() => {
    if (isLoading) return;
    const restoreScroll = () => {
      // A target in the list owns the scroll until its row mounts; the stored offset must not pull it back.
      if (initialScrollHandled.current === initialTargetId && initialTargetId) return;
      if (initialTargetId) {
        const target = libraryRootScrollRef.current?.querySelector<HTMLElement>(
          `[data-card-library-card="${CSS.escape(initialTargetId)}"]`,
        );
        if (target) {
          target.scrollIntoView({ block: "start", behavior: "instant" });
          initialScrollHandled.current = initialTargetId;
          rememberLibraryScroll();
          return;
        }
        // An unmounted card: the card list scrolls to it (scrollToIndex).
        // Not marked handled: scrollToIndex reveals it, and the stored offset stays out of the way.
        if (sortedCards.some((card) => card.id === initialTargetId)) return;
      }
      const scrollTop = useUIStore.getState()[config.store.scrollTop] as number;
      for (const node of [libraryRootScrollRef.current, libraryListScrollRef.current]) {
        if (!node) continue;
        const maxScrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
        node.scrollTop = Math.min(scrollTop, maxScrollTop);
      }
    };
    restoreScroll();
    const frame = window.requestAnimationFrame(restoreScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [config.store.scrollTop, initialTargetId, isLoading, rememberLibraryScroll, sortedCards]);

  useLayoutEffect(
    () => () => {
      if (libraryScrollFrameRef.current !== null) window.cancelAnimationFrame(libraryScrollFrameRef.current);
    },
    [],
  );

  const openDetailFromLibrary = (id: string) => {
    rememberLibraryScroll();
    setSelectedId(id);
    if (kind === "personas") openPersonaDetail(id, { preservePersonaLibrary: true });
    else if (kind === "lorebooks") openLorebookDetail(id);
    else openCharacterDetail(id, { preserveCharacterLibrary: true });
  };

  const renderDetailActions = (card: LibraryCard): ReactNode[] => {
    const actions: ReactNode[] = [
      <button key="edit" type="button" onClick={() => openDetailFromLibrary(card.id)} className={detailActionClass}>
        <Pencil size="0.875rem" />
        {localizeUi("ui.noodle.noodlepostcard.edit")} {localizeUi(config.editNounKey)}
      </button>,
    ];
    if (kind === "characters") {
      actions.push(
        <button
          key="chat"
          type="button"
          onClick={() =>
            openModal("start-character-chat", {
              characterId: card.id,
              characterName: card.name,
            })
          }
          className={detailActionClass}
        >
          <MessageCircle size="0.875rem" />
          {localizeUi("ui.characters.characterlibraryview.chatNow")}
        </button>,
      );
    }
    if (kind === "lorebooks") {
      const active = !!card.active;
      actions.push(
        <button
          key="active"
          type="button"
          aria-pressed={active}
          disabled={setLorebooksEnabled.isPending}
          title={localizeUi("ui.characters.characterlibraryview.lorebookActiveHint")}
          onClick={() =>
            setLorebooksEnabled.mutate(
              { ids: [card.id], enabled: !active },
              { onError: () => toast.error(localizeUi("ui.panels.lorebookspanel.couldNotSwitchLorebooks")) },
            )
          }
          className={cn(detailActionClass, "disabled:opacity-60")}
        >
          <Check size="0.875rem" className={cn(!active && "opacity-0")} />
          {localizeUi("ui.characters.lorebooktab.active")}
        </button>,
      );
    }
    return actions;
  };

  const handleSortChange = (value: string) => callStoreSetter(config.store.setSort, value);

  const loadMoreSentinelRef = useLoadMoreWhenNear(
    source.fetchNextPage,
    isLoading || !hasNextPage || isFetchingNextPage || source.isFetchNextPageError,
  );

  const newCardButtonClass = cn(
    "mari-panel-gradient-button h-10 min-h-10 min-w-0 px-3 text-[0.75rem]",
    config.gradientClass,
  );
  const searchPlaceholder =
    "key" in config.searchPlaceholder ? t(config.searchPlaceholder.key) : localize(config.searchPlaceholder.text);

  const emptyPlaceholder = (
    <div
      className={cn(
        "mari-avatar-placeholder flex h-14 w-14 items-center justify-center rounded-3xl",
        config.placeholderClass,
      )}
    >
      <PlaceholderIcon size="1.5rem" />
    </div>
  );

  return (
    <div
      ref={libraryRootScrollRef}
      data-component="CharacterLibraryView"
      data-card-library-kind={kind}
      onScroll={handleLibraryScroll}
      className="mari-chrome-token-scope flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_color-mix(in_srgb,var(--marinara-chat-chrome-accent)_14%,transparent),_transparent_30%),radial-gradient(circle_at_top_right,_color-mix(in_srgb,var(--marinara-chat-chrome-text)_10%,transparent),_transparent_26%),var(--background)] text-[var(--marinara-chat-chrome-panel-text)] lg:overflow-hidden"
    >
      <div className="sticky top-0 z-10 border-b border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--card)]/85 backdrop-blur-xl">
        <div className="relative flex flex-col gap-2 px-3 py-2 md:px-6 md:py-3 lg:flex-row lg:items-start lg:justify-between">
          <div className={cn("flex min-w-0 items-center gap-3", showsClose && "max-lg:pr-12")}>
            <SurfaceBackButton
              className="mari-chrome-control h-9 w-9 rounded-2xl p-0 md:h-10 md:w-10"
              iconSize="0.95rem"
            />
            <div className="min-w-0">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.28em] text-[var(--marinara-chat-chrome-panel-muted)]">
                {config.title}
              </p>
              <h1 className="truncate text-base font-semibold text-[var(--marinara-chat-chrome-panel-title)] md:text-2xl">
                {config.heading}
              </h1>
              <p className="text-xs text-[var(--marinara-chat-chrome-panel-muted)] md:text-sm">
                {hasNextPage
                  ? localizeUi(config.loadedCountKey, {
                      visible: filteredCards.length,
                      loaded: cards.length,
                    })
                  : localizeUi(config.countKey, {
                      visible: filteredCards.length,
                      count: cards.length,
                    })}
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-1.5 sm:ml-auto sm:w-72 lg:w-80">
            <button
              onClick={() => openModal(config.createModal)}
              className={newCardButtonClass}
              title={localizeUi("ui.characters.characterlibraryview.newValue1", { value1: config.singular })}
              aria-label={localizeUi("ui.characters.characterlibraryview.newValue1", { value1: config.singular })}
            >
              <Plus size="0.75rem" />
            </button>
            <button
              onClick={() => openModal(config.importModal)}
              className={libraryToolbarButtonClass}
              title={localizeUi("ui.characters.characterlibraryview.importValue1", { value1: config.singular })}
              aria-label={localizeUi("ui.characters.characterlibraryview.importValue1", { value1: config.singular })}
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
                placeholder={searchPlaceholder}
                className={cn(libraryToolbarFieldClass, "pl-7 pr-2.5")}
              />
            </div>

            <div data-library-toolbar-sort className="relative min-w-0">
              <Select
                value={sort}
                onChange={handleSortChange}
                label={localizeUi("ui.panels.agentspanel.sortOrder")}
                className={cn(
                  libraryToolbarFieldClass,
                  "mari-chrome-sort-field mari-accent-animated !w-full pl-2.5 pr-7 [&>svg]:hidden",
                )}
                searchable={false}
                options={librarySortOptions(localizeUi, {
                  az: "name-asc",
                  za: "name-desc",
                  newest: "newest",
                  oldest: "oldest",
                  ...(config.hasFavorites ? { favorites: "favorites" } : {}),
                  mostTokens: "tokens-desc",
                  fewestTokens: "tokens-asc",
                })}
              />
              <ArrowUpDown
                size="0.6875rem"
                className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
              />
            </div>
          </div>
          <SurfaceCloseButton
            className="absolute right-3 top-2 md:right-6 md:top-3 lg:static"
            buttonClassName="mari-chrome-control h-9 w-9 rounded-2xl p-0 md:h-10 md:w-10"
            iconSize="0.95rem"
            dividerClassName="max-lg:hidden"
          />
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

          {!isLoading && sortedCards.length === 0 && (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--card)]/50 p-6 text-center">
              {emptyPlaceholder}
              <div>
                <h2 className="text-lg font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  {localizeUi("ui.characters.characterlibraryview.noMatching")} {config.plural}
                </h2>
                <p className="mt-1 max-w-md text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
                  {localizeUi("ui.characters.characterlibraryview.tryADifferentSearchAdjustSortingOrImportA")}
                </p>
              </div>
            </div>
          )}

          {!isLoading && sortedCards.length > 0 && (
            <PanelVirtualList
              listKey={`character-library:${kind}`}
              count={sortedCards.length}
              getItemKey={(index) => sortedCards[index]!.id}
              estimateSize={220}
              gap={12}
              columns={libraryColumns}
              scrollToIndex={initialTargetIndex}
              renderRow={(index) => {
                const card = sortedCards[index]!;
                const isSelected = selectedId === card.id;
                return (
                  <>
                    <CardLibraryPreview
                      card={card}
                      kind={kind}
                      isSelected={isSelected}
                      onClick={() => setSelectedId(card.id)}
                    />
                    {isSelected && (
                      <div className="col-span-full mt-3 lg:hidden">
                        <CardLibraryDetailCard card={card} kind={kind} actions={renderDetailActions(card)} />
                      </div>
                    )}
                  </>
                );
              }}
            />
          )}

          {!isLoading && hasNextPage && <div ref={loadMoreSentinelRef} aria-hidden className="h-px" />}
          {!isLoading && hasNextPage && (
            <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex justify-center border-t border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--background)]/92 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
              <button
                type="button"
                onClick={source.fetchNextPage}
                disabled={isFetchingNextPage}
                className="mari-chrome-control mari-chrome-control--primary px-5 py-2 text-sm"
              >
                {isFetchingNextPage
                  ? localizeUi("ui.characters.characterlibraryview.loading")
                  : source.total === null
                    ? localizeUi("ui.characters.characterlibraryview.loadMoreValue1Loaded", { value1: cards.length })
                    : localizeUi("ui.panels.characterspanel.loadMoreValue1OfValue2", {
                        value1: cards.length,
                        value2: source.total,
                      })}
              </button>
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 overflow-visible border-t border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--card)]/65 backdrop-blur-xl lg:block lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="space-y-4 p-4 md:p-6">
            {selectedCard ? (
              <CardLibraryDetailCard card={selectedCard} kind={kind} actions={renderDetailActions(selectedCard)} />
            ) : (
              <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/65 p-6 text-center">
                {emptyPlaceholder}
                <div>
                  <h2 className="text-lg font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                    {localizeUi("ui.characters.characterlibraryview.selectACard")}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
                    {localizeUi("ui.characters.characterlibraryview.pickA")} {config.singular}{" "}
                    {localizeUi("ui.characters.characterlibraryview.fromTheGridToSeeALargerOverviewBefore")}
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
