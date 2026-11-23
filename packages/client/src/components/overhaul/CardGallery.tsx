// ──────────────────────────────────────────────
// UI overhaul: Characters / Personas landing page (portrait gallery)
//
// Title with Import and New, one toolbar row (search, quick filters, sort),
// then a grid of portraits with the token count, name and tags. Clicking a
// portrait opens its editor; the tag selector beside search filters the list.
// ──────────────────────────────────────────────
import { DelayedFallback } from "../ui/DelayedFallback";
import { placeholderArt } from "../../lib/placeholder-art";
import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CheckSquare,
  Copy,
  Trash2,
  Upload,
  MessageCircle,
  Plus,
  Search,
  Download,
  Globe,
  Grid2x2,
  Grid3x3,
  Square,
  BookOpen,
  List,
  Star,
  Tag,
} from "lucide-react";
import { plainTextPreview } from "../../lib/plain-text-preview";
import { formatRelativeContact } from "../../lib/relative-time";
import { ViewSwitch } from "./LibraryTables";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { avatarInitial } from "../../lib/avatar-initial";
import { cn } from "../../lib/utils";
import { useOverhaulMobile, useOverhaulStore, type GalleryCardSize } from "../../stores/overhaul.store";
import { AvatarImage } from "../characters/AvatarImage";
import { useTranslation as useUiTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import { useLibraryOrder } from "../../hooks/use-library-order";
import {
  useDeleteCharacter,
  useDeletePersona,
  useDuplicateCharacter,
  useDuplicatePersona,
} from "../../hooks/use-characters";
import {
  KitBulkBar,
  KitCheck,
  KitFolderCrumb,
  KitFolderHead,
  KitFolderTile,
  KitFolderViewToggle,
  KitMoreButton,
  KitNewFolderButton,
  KitSelectButton,
  folderActions,
  groupByFolder,
  useOpenFolder,
  kitDelete,
  kitExport,
  moveToFolderAction,
  useCardFolders,
  useKitMenu,
  useKitRowDrag,
  useKitSelection,
  useLibraryFolderView,
  useSuppressClick,
  type KitAction,
} from "./LibraryKit";
import { TagFilter, countItemTags, matchesPickedTags } from "./TagFilter";
import { avatarPreviewSrc } from "../../lib/avatar-preview";
import { sortItemsByTokens } from "../../lib/panel-sort";

export type GalleryCard = {
  id: string;
  name: string;
  avatarPath: string | null;
  avatarStyle?: CSSProperties;
  tags: string[];
  /** Characters: Creator's Notes (never sent to the model), previewed as plain text under the name. */
  notes?: string;
  /** Characters: the card carries an embedded lorebook. */
  hasLorebook?: boolean;
  tokens: string;
  /** Estimated tokens, for the size sorts. */
  tokenEstimate?: number;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

// "Recently edited" is a sort, as on Lorebooks and Presets, not a filter (audit C16).
type QuickFilter = "favorites" | null;
type SortKey = "name-asc" | "name-desc" | "recent" | "newest" | "oldest" | "tokens-desc" | "tokens-asc" | "custom";
/** Sorts the server can apply when it loads the cards, so a large library loads the newest (or largest) first. */
const SERVER_SORTS = new Set<string>(["name-asc", "name-desc", "newest", "oldest", "tokens-desc", "tokens-asc"]);

/** A stable, pleasant gradient for cards without a picture. */
function placeholderGradient(id: string) {
  return placeholderArt(id, 40, 170, [55, 58, 45, 24]);
}

/** The card-size switch: pictures matter for telling characters apart, so the grid scales instead of becoming a list. */
const GALLERY_SIZES: { id: GalleryCardSize; title: string; icon: typeof Square; iconSize: number }[] = [
  { id: "small", title: "Small cards", icon: Grid3x3, iconSize: 14 },
  { id: "medium", title: "Medium cards", icon: Grid2x2, iconSize: 14 },
  { id: "large", title: "Large cards", icon: Square, iconSize: 13 },
];

export function CardGallery({
  kind,
  title,
  cards,
  loading,
  hasMore,
  onLoadMore,
  onLoadAll,
  loadingMore,
  onOpen,
  onChat,
  onNew,
  onImport,
  onBrowse,
  extraHeader,
  serverSort,
  onServerSort,
}: {
  kind: "characters" | "personas";
  title: string;
  cards: GalleryCard[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  /** Keep loading until every card is in. */
  onLoadAll?: () => Promise<void>;
  loadingMore?: boolean;
  onOpen: (id: string) => void;
  onChat?: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
  /** Characters: open the online card browser (ChubAI and others). */
  onBrowse?: () => void;
  extraHeader?: ReactNode;
  /** The sort the cards load in (saved); the page starts on it. */
  serverSort?: string;
  /** Load the cards in this order (only the sorts the server knows). */
  onServerSort?: (sort: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const cardSize = useOverhaulStore((state) => state.galleryCardSize);
  const setCardSize = useOverhaulStore((state) => state.setGalleryCardSize);
  // List or picture grid (shared by Characters and Personas, like the card size).
  const listView = useOverhaulStore((state) => state.galleryListView);
  const setListView = useOverhaulStore((state) => state.setGalleryListView);
  const [loadingAll, setLoadingAll] = useState(false);
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>(null);
  // Phones: Favourites is a dropdown beside + New.
  const mobile = useOverhaulMobile();
  // The tag selector beside search (several tags narrow to cards with all of them).
  const [pickedTags, setPickedTags] = useState<string[]>([]);
  const tagCounts = useMemo(() => countItemTags(cards), [cards]);
  const [baseSort, setBaseSort] = useState<SortKey>(() =>
    serverSort && SERVER_SORTS.has(serverSort) ? (serverSort as SortKey) : "name-asc",
  );
  const singular = kind === "characters" ? "character" : "persona";
  // My order: drag cards into your own order (shared with the classic panel's manual order).
  const order = useLibraryOrder(singular);
  const sort: SortKey = order.active ? "custom" : baseSort;
  const setSort = (next: SortKey) => {
    if (next === "custom") order.setActive(true);
    else {
      if (order.active) order.setActive(false);
      setBaseSort(next);
      // Pages load from the server in this order, so Newest shows the newest cards even before "Load more".
      if (SERVER_SORTS.has(next) && next !== serverSort) onServerSort?.(next);
    }
  };

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const tagQuery = needle.startsWith("tag:") ? needle.slice(4).trim() : null;
    let list = cards.filter((card) => {
      if (quick === "favorites" && !card.favorite) return false;
      if (!matchesPickedTags(card.tags, pickedTags)) return false;
      if (!needle) return true;
      if (tagQuery !== null) return card.tags.some((tag) => tag.toLowerCase().includes(tagQuery));
      return card.name.toLowerCase().includes(needle) || card.tags.some((tag) => tag.toLowerCase().includes(needle));
    });
    list = [...list];
    switch (sort) {
      case "recent":
        return list.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
      case "custom":
        return order.orderItems(list.sort((a, b) => a.name.localeCompare(b.name)));
      case "name-desc":
        return list.sort((a, b) => b.name.localeCompare(a.name));
      case "newest":
        return list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      case "oldest":
        return list.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
      case "tokens-desc":
      case "tokens-asc":
        return sortItemsByTokens(
          list,
          sort,
          (card) => card.tokenEstimate,
          (card) => card.name,
        );
      default:
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [cards, order, pickedTags, quick, search, sort]);

  // ── Select, ⋯ menus, folders and dragging (like the Lorebooks and Presets pages) ──
  const isCharacters = kind === "characters";
  const nounPlural = localize(isCharacters ? "characters" : "personas");
  const selection = useKitSelection(visible.map((card) => card.id));
  const menu = useKitMenu();
  const folders = useCardFolders(kind, localize(isCharacters ? "Characters" : "Personas"));
  // Folders, or every card together (so Newest or Recent reaches across folders).
  const folderView = useLibraryFolderView(kind);
  const suppress = useSuppressClick();
  const duplicateCharacter = useDuplicateCharacter();
  const duplicatePersona = useDuplicatePersona();
  const deleteCharacter = useDeleteCharacter();
  const deletePersona = useDeletePersona();
  const filtering = !!search.trim() || !!quick || pickedTags.length > 0 || sort === "recent";
  // Searching or filtering looks inside every folder; otherwise the Folders view lists folders closed.
  const searching = !!search.trim() || !!quick || pickedTags.length > 0;
  const opened = useOpenFolder(folders);
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const exportBase = isCharacters ? "/characters" : "/characters/personas";
  const removeMany = async (ids: string[], names?: string) => {
    const failed = await kitDelete(
      ids,
      (id) => (isCharacters ? deleteCharacter.mutateAsync(id) : deletePersona.mutateAsync(id)),
      { noun: nounPlural, localize, names },
    );
    if (failed) selection.set(new Set(failed));
    if (failed && !failed.length) selection.stop();
  };
  const cardActions = (card: GalleryCard): KitAction[] => [
    {
      key: "dup",
      label: "Duplicate",
      icon: <Copy size={14} />,
      onSelect: () =>
        void (isCharacters ? duplicateCharacter.mutateAsync(card.id) : duplicatePersona.mutateAsync(card.id)).then(
          () => toast.success(localizeUi("ui.overhaul.text.copiedName", { name: card.name })),
          (error: unknown) => toast.error(error instanceof Error ? error.message : localize("Couldn't duplicate")),
        ),
    },
    moveToFolderAction(folders, () => [card.id], folders.folderOf(card.id)),
    // Tags no longer crowd the cards: the full list is one step away, and picking one filters by it.
    ...(card.tags.length
      ? [
          {
            key: "tags",
            label: "Tags",
            icon: <Tag size={14} />,
            submenu: card.tags.map((tag): KitAction => ({
              key: `tag:${tag}`,
              label: `#${tag}`,
              onSelect: () => setPickedTags([tag]),
            })),
          } satisfies KitAction,
        ]
      : []),
    {
      key: "export",
      label: "Export",
      icon: <Upload size={14} />,
      onSelect: () => void api.download(`${exportBase}/${card.id}/export?format=native`),
    },
    { key: "select", label: "Select", icon: <CheckSquare size={14} />, onSelect: () => selection.start(card.id) },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => void removeMany([card.id], `"${card.name}"`),
    },
  ];
  const bulkActions: KitAction[] = [
    moveToFolderAction(folders, () => selection.list, null),
    {
      key: "export",
      label: "Export",
      icon: <Upload size={14} />,
      onSelect: () =>
        void kitExport(
          `${exportBase}/export-bulk`,
          selection.list,
          isCharacters ? "marinara-characters.zip" : "marinara-personas.zip",
          localize,
        ),
    },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => void removeMany(selection.list),
    },
  ];
  const bindDrag = useKitRowDrag({
    kind: singular,
    reorder: (ids, target, edge, visibleIds) => order.reorder(ids, target, edge, visibleIds),
    folders,
    selection,
    suppress,
    onHold: (id) => {
      const card = byId.get(id);
      if (card) menu.open(card.name, cardActions(card), { x: 0, y: 0 });
    },
  });
  const activate = (card: GalleryCard) => {
    if (suppress.blocked()) return;
    if (selection.on) selection.toggle(card.id);
    else onOpen(card.id);
  };
  const openFolder = folderView.flat ? null : opened.open;
  const { groups, loose } = openFolder
    ? { groups: [], loose: [] as GalleryCard[] }
    : groupByFolder(visible, folderView.flat ? null : folders, searching || filtering);
  const openRows = openFolder
    ? (() => {
        const ids = new Set(openFolder.itemIds);
        return visible.filter((card) => ids.has(card.id));
      })()
    : [];

  // Creator's Notes as a few plain-text lines (HTML, Markdown and images dropped; shown as text, never markup).
  const notesById = useMemo(() => new Map(cards.map((card) => [card.id, plainTextPreview(card.notes)])), [cards]);
  const notesPreview = (card: GalleryCard) => notesById.get(card.id) ?? "";
  // Hovering the name shows the full name and every tag (the tags left the card itself).
  const tagTooltip = (card: GalleryCard) =>
    card.tags.length ? `${card.name}\n${card.tags.map((tag) => `#${tag}`).join(" ")}` : card.name;
  const lorebookLabel = localize("Has an embedded lorebook");
  const lorebookMark = (
    <span className="ov-card__book" title={lorebookLabel} data-mari-part="card-lorebook">
      <BookOpen size={14} aria-hidden="true" />
      <span className="sr-only">{lorebookLabel}</span>
    </span>
  );

  // A member's picture (or its initial on the placeholder) for a folder tile's 2 × 2 peek.
  const renderPeek = (card: GalleryCard) =>
    card.avatarPath ? (
      <AvatarImage
        src={avatarPreviewSrc(card.avatarPath, "card")}
        alt=""
        iconSize="1rem"
        className="h-full w-full object-cover"
        style={card.avatarStyle}
        loading="lazy"
      />
    ) : (
      <span
        className="ov-folder-tile__peek-ph"
        style={{ background: `var(--mari-card-art-placeholder, ${placeholderGradient(card.id)})` }}
      >
        {avatarInitial(card.name)}
      </span>
    );
  const renderCard = (card: GalleryCard, folderId: string | null) => (
    <div
      key={card.id}
      className={cn("ov-card", selection.has(card.id) && "is-selected")}
      data-card-library-card={card.id}
      {...bindDrag(card.id, folderId)}
      onContextMenu={(event) => menu.openFromEvent(event, card.name, cardActions(card))}
    >
      <button
        type="button"
        className="ov-card__art"
        onClick={() => activate(card)}
        // A card with no picture: --mari-card-art-placeholder (any background) replaces the gradient.
        data-mari-part="card-art"
        data-placeholder={card.avatarPath ? undefined : ""}
        style={
          card.avatarPath
            ? undefined
            : { background: `var(--mari-card-art-placeholder, ${placeholderGradient(card.id)})` }
        }
        aria-label={card.name}
        data-drag-surface
      >
        {card.avatarPath ? (
          <AvatarImage
            src={avatarPreviewSrc(card.avatarPath, "card")}
            alt=""
            iconSize="2rem"
            className="h-full w-full object-cover"
            style={card.avatarStyle}
            loading="lazy"
          />
        ) : (
          // The name's initial, the same fallback as Home, the Chats list and chat messages (audit C2).
          <span className="ov-card__ph ov-card__initial" aria-hidden="true">
            {avatarInitial(card.name)}
          </span>
        )}
        <span className="ov-card__tokens">{card.tokens}</span>
        {selection.on ? (
          <span className="ov-card__check">
            <KitCheck checked={selection.has(card.id)} label={card.name} />
          </span>
        ) : null}
      </button>
      <KitMoreButton
        className="ov-card__more"
        label={localize("More actions")}
        onOpen={(event) => menu.openFromEvent(event, card.name, cardActions(card), "button")}
      />
      {onChat ? (
        <button
          type="button"
          className="ov-card__chat"
          onClick={() => onChat(card.id)}
          title={localize("Chat")}
          aria-label={localize("Chat")}
        >
          <MessageCircle size={14} />
        </button>
      ) : null}
      <button
        type="button"
        className="ov-card__name"
        onClick={() => activate(card)}
        title={tagTooltip(card)}
        data-drag-surface
      >
        <span className="ov-card__name-text">{card.name}</span>
        {card.hasLorebook ? lorebookMark : null}
      </button>
      {isCharacters ? (
        // Characters: the first lines of Creator's Notes; blank notes leave no empty line.
        notesPreview(card) ? (
          <p className="ov-card__tags ov-card__notes" data-mari-part="card-notes">
            {notesPreview(card)}
          </p>
        ) : null
      ) : (
        <p className="ov-card__tags">
          {card.tags.length
            ? card.tags.map((tag) => `#${tag}`).join(" ")
            : localizeUi("ui.overhaul.cardgallery.value1", { value1: localize("Untagged") })}
        </p>
      )}
    </div>
  );

  // ── List view: one row per card (picture, name, notes, tags, size, last edit) ──
  const renderRow = (card: GalleryCard, folderId: string | null, inFolder = !!folderId) => (
    <tr
      key={card.id}
      tabIndex={0}
      className={cn("ov-cl__row", inFolder && "is-in-folder", selection.has(card.id) && "is-selected")}
      data-card-library-card={card.id}
      onClick={() => activate(card)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) activate(card);
      }}
      {...bindDrag(card.id, folderId)}
      onContextMenu={(event) => menu.openFromEvent(event, card.name, cardActions(card))}
    >
      {selection.on ? (
        <td className="ov-table__check">
          <KitCheck checked={selection.has(card.id)} label={card.name} />
        </td>
      ) : null}
      <td className="ov-table__lead ov-cl__lead">
        <span
          className="ov-thumb ov-cl__thumb"
          aria-hidden="true"
          style={
            card.avatarPath
              ? undefined
              : { background: `var(--mari-card-art-placeholder, ${placeholderGradient(card.id)})` }
          }
        >
          {card.avatarPath ? (
            <AvatarImage
              src={avatarPreviewSrc(card.avatarPath, "card")}
              alt=""
              iconSize="0.875rem"
              className="h-full w-full object-cover"
              style={card.avatarStyle}
              loading="lazy"
            />
          ) : (
            <span className="ov-cl__initial">{avatarInitial(card.name)}</span>
          )}
        </span>
      </td>
      <td className="ov-table__name ov-cl__name" title={card.name}>
        <span className="ov-cl__title">
          <span className="ov-cl__name-text">{card.name}</span>
          {card.hasLorebook ? lorebookMark : null}
        </span>
        {/* Narrow screens keep only this column, so the size and first note line ride under the name. */}
        <span className="ov-cl__sub">
          {[
            `${card.tokens} ${localize("tokens")}`,
            isCharacters ? notesPreview(card).split("\n")[0] : card.tags.map((tag) => `#${tag}`).join(" "),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </td>
      {isCharacters ? (
        <td className="ov-table__desc ov-cl__notes">{notesPreview(card).replace(/\n/g, " ") || "—"}</td>
      ) : null}
      <td className={cn("ov-cl__tags", !isCharacters && "ov-table__desc")} title={card.tags.join(", ") || undefined}>
        <span className="ov-table__clip">{card.tags.length ? card.tags.map((tag) => `#${tag}`).join(" ") : "—"}</span>
      </td>
      <td className="ov-table__num">{card.tokens}</td>
      <td className="ov-cl__updated">{formatRelativeContact(card.updatedAt) ?? "—"}</td>
      <td className="ov-table__more">
        <KitMoreButton
          label={localize("More actions")}
          onOpen={(event) => menu.openFromEvent(event, card.name, cardActions(card), "button")}
        />
      </td>
    </tr>
  );

  const browseButton = onBrowse ? (
    <button
      type="button"
      className={cn("ov-btn", mobile && "ov-btn--icon")}
      onClick={onBrowse}
      aria-label={localizeUi("ui.overhaul.text.browseOnline")}
      title={localizeUi("ui.overhaul.text.browseOnline")}
    >
      <Globe size={14} aria-hidden="true" />
      {mobile ? null : localizeUi("ui.overhaul.text.browseOnline")}
    </button>
  ) : null;

  const quickSelect = (className: string) => (
    <select
      className={cn("ov-select", className)}
      value={quick ?? "all"}
      onChange={(event) => {
        const value = event.target.value;
        setQuick(value === "all" ? null : (value as QuickFilter));
      }}
      aria-label={localize("Filter")}
    >
      <option value="all">{localize("All")}</option>
      <option value="favorites">{localize("Favorites")}</option>
    </select>
  );

  // Desktop: List is the first stop on the card-size switch (one control, so the toolbar keeps one line), and it
  // sits before the sort as on Lorebooks and Presets. Phones and tablets have the List / Gallery switch in the
  // header, and this one after the sort.
  const sizeSwitch = (
    <div className="ov-seg ov-gallery__size" role="group" aria-label={localize("View")} hidden={mobile && listView}>
      {mobile ? null : (
        <button
          type="button"
          className={cn(listView && "is-on")}
          aria-pressed={listView}
          title={localize("List")}
          aria-label={localize("List")}
          onClick={() => setListView(true)}
        >
          <List size={14} aria-hidden="true" />
        </button>
      )}
      {GALLERY_SIZES.map((option) => (
        <button
          key={option.id}
          type="button"
          className={cn(!listView && cardSize === option.id && "is-on")}
          aria-pressed={!listView && cardSize === option.id}
          title={localize(option.title)}
          aria-label={localize(option.title)}
          onClick={() => {
            setCardSize(option.id);
            setListView(false);
          }}
        >
          <option.icon size={option.iconSize} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
  const viewSwitch = <ViewSwitch gallery={!listView} onChange={(gallery) => setListView(!gallery)} />;
  const folderRow = (folder: (typeof groups)[number]["folder"], count: number, open: boolean) => (
    <tr key={`folder:${folder.id}`} className="ov-table__folder">
      <td colSpan={listColumns}>
        <KitFolderHead
          folder={folder}
          count={count}
          dragKind={singular}
          collapsed={!open}
          mode={open ? "toggle" : "open"}
          onToggle={() => opened.openFolder(folder)}
          onMenu={(event, anchor) => menu.openFromEvent(event, folder.name, folderActions(folders, folder), anchor)}
        />
      </td>
    </tr>
  );
  const listColumns = (selection.on ? 1 : 0) + (isCharacters ? 7 : 6);
  const listBody = (
    <>
      {openFolder ? (
        <div className="ov-cl__crumb">
          <KitFolderCrumb
            backLabel={title}
            folder={openFolder}
            count={openRows.length}
            onBack={opened.close}
            onMenu={(event, anchor) =>
              menu.openFromEvent(event, openFolder.name, folderActions(folders, openFolder), anchor)
            }
          />
        </div>
      ) : null}
      {loading && cards.length === 0 ? null : openRows.length + groups.length + loose.length === 0 ? (
        <p className="ov-list__empty">
          {localize(kind === "characters" ? "No characters here." : "No personas here.")}
        </p>
      ) : (
        <div className="ov-table-wrap ov-cl" data-kind={kind}>
          <table className="ov-table">
            <thead>
              <tr>
                {selection.on ? (
                  <th className="ov-table__check">
                    <button
                      type="button"
                      onClick={selection.toggleAll}
                      aria-label={localize(selection.allSelected ? "Select none" : "Select all")}
                    >
                      <KitCheck checked={selection.allSelected} label={localize("Select all")} />
                    </button>
                  </th>
                ) : null}
                <th className="ov-table__lead" aria-hidden="true" />
                <th className="ov-table__name">{localize(isCharacters ? "Character" : "Persona")}</th>
                {isCharacters ? <th className="ov-table__desc">{localize("Creator's Notes")}</th> : null}
                <th className={cn("ov-cl__tags", !isCharacters && "ov-table__desc")}>{localize("Tags")}</th>
                <th className="ov-table__num">{localize("Tokens")}</th>
                <th>{localize("Updated")}</th>
                <th className="ov-table__more" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {openRows.map((card) => renderRow(card, openFolder?.id ?? null, false))}
              {groups.map(({ folder, rows: members }) =>
                searching ? (
                  <Fragment key={`folder:${folder.id}`}>
                    {folderRow(folder, members.length, true)}
                    {members.map((card) => renderRow(card, folder.id, true))}
                  </Fragment>
                ) : (
                  folderRow(folder, members.length, false)
                ),
              )}
              {loose.map((card) => renderRow(card, null))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  return (
    <section
      className="ov-gallery"
      data-component="OverhaulCardGallery"
      data-kind={kind}
      data-view={listView ? "list" : "grid"}
    >
      <header className="ov-gallery__head">
        <h1 data-mari-part="page-title">{title}</h1>
        {extraHeader}
        <KitNewFolderButton folders={folders} onCreate={() => folderView.setFlat(false)} />
        <KitSelectButton selection={selection} />
        {mobile ? null : browseButton}
        <button type="button" className="ov-btn" onClick={onImport}>
          <Download size={14} aria-hidden="true" />
          {localize("Import")}
        </button>
        {/* Phones and the split side: Browse sits after Import, so the first buttons line up with the
            other Library pages (folder, select, import). */}
        {mobile ? browseButton : null}
        <button
          type="button"
          className="ov-btn ov-btn--primary"
          onClick={onNew}
          aria-label={localize(kind === "characters" ? "New character" : "New persona")}
        >
          <Plus size={14} aria-hidden="true" />
          {mobile ? localize("New") : localize(kind === "characters" ? "New character" : "New persona")}
        </button>
        {/* Phones: Favorites is one star toggle (the All / Favorites dropdown didn't fit beside the List /
            Gallery switch in wide-font themes). */}
        {mobile && kind === "characters" ? (
          <button
            type="button"
            className={cn("ov-btn ov-btn--icon ovm-fav-toggle", quick === "favorites" && "is-on")}
            aria-pressed={quick === "favorites"}
            aria-label={localize("Favorites")}
            title={localize("Favorites")}
            onClick={() => setQuick((value) => (value === "favorites" ? null : "favorites"))}
          >
            <Star size={15} aria-hidden="true" fill={quick === "favorites" ? "currentColor" : "none"} />
          </button>
        ) : null}
        {mobile ? viewSwitch : null}
      </header>
      <div className="ov-gallery__tools">
        <label className="ov-search">
          <Search size={14} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localize(kind === "characters" ? "Search characters or tag:name" : "Search personas")}
            aria-label={localize(kind === "characters" ? "Search characters or tag:name" : "Search personas")}
          />
        </label>
        {tagCounts.tags.length || pickedTags.length ? (
          <TagFilter tags={tagCounts.tags} untagged={tagCounts.untagged} picked={pickedTags} onChange={setPickedTags} />
        ) : null}
        {kind === "characters" && !mobile ? (
          <button
            type="button"
            className={cn("ov-btn", quick === "favorites" && "is-on")}
            aria-pressed={quick === "favorites"}
            onClick={() => setQuick((value) => (value === "favorites" ? null : "favorites"))}
          >
            {localize("Favorites")}
          </button>
        ) : null}
        <span className="ov-gallery__spacer" />
        <KitFolderViewToggle folders={folders} view={folderView} />
        {mobile ? null : sizeSwitch}
        <select
          className="ov-select"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label={localize("Sort")}
        >
          <option value="name-asc">{localize("A to Z")}</option>
          <option value="name-desc">{localize("Z to A")}</option>
          <option value="recent">{localize("Recent")}</option>
          <option value="newest">{localize("Newest")}</option>
          <option value="oldest">{localize("Oldest")}</option>
          <option value="tokens-desc">{localize("Most tokens")}</option>
          <option value="tokens-asc">{localize("Fewest tokens")}</option>
          <option value="custom">{localize("My order")}</option>
        </select>
        {/* A narrow split side shows this copy (beside the sort) and hides the header one, so the
            toolbar keeps three lines (overhaul-mobile.css, SV14). */}
        {mobile && kind === "characters" ? quickSelect("ovm-lp-filter ovm-lp-filter--tools") : null}
        {mobile ? (
          <ViewSwitch
            gallery={!listView}
            onChange={(gallery) => setListView(!gallery)}
            className="ovm-lp-view--tools"
          />
        ) : null}
        {mobile ? sizeSwitch : null}
      </div>

      {listView ? listBody : null}
      {/* First load: the grid (with its New card) waits for the cards, so they appear together instead of the
          New card first and the rest popping in around it (QC round 2). */}
      <div
        className="ov-gallery__grid"
        data-size={cardSize}
        hidden={listView}
        style={loading && cards.length === 0 ? { visibility: "hidden" } : undefined}
      >
        {openFolder ? (
          <div className="ov-kit-folder-cell">
            <KitFolderCrumb
              backLabel={title}
              folder={openFolder}
              count={openRows.length}
              onBack={opened.close}
              onMenu={(event, anchor) =>
                menu.openFromEvent(event, openFolder.name, folderActions(folders, openFolder), anchor)
              }
            />
          </div>
        ) : null}
        {openRows.map((card) => renderCard(card, openFolder?.id ?? null))}
        {groups.map(({ folder, rows: members }) =>
          searching ? (
            // A search shows each folder's matches in place, under its name.
            <Fragment key={`folder:${folder.id}`}>
              <div className="ov-kit-folder-cell">
                <KitFolderHead
                  folder={folder}
                  count={members.length}
                  dragKind={singular}
                  collapsed={false}
                  onToggle={() => opened.openFolder(folder)}
                  onMenu={(event, anchor) =>
                    menu.openFromEvent(event, folder.name, folderActions(folders, folder), anchor)
                  }
                />
              </div>
              {members.map((card) => renderCard(card, folder.id))}
            </Fragment>
          ) : (
            // The Folders view: each folder is an icon in the grid, like a file explorer; open one to see inside.
            <KitFolderTile
              key={`folder:${folder.id}`}
              folder={folder}
              count={members.length}
              dragKind={singular}
              previews={members.slice(0, 4).map(renderPeek)}
              onOpen={() => opened.openFolder(folder)}
              onMenu={(event, anchor) => menu.openFromEvent(event, folder.name, folderActions(folders, folder), anchor)}
            />
          ),
        )}
        {searching && groups.length > 0 && loose.length > 0 ? (
          <div className="ov-kit-folder-cell ov-kit-loose">{localize("Not in a folder")}</div>
        ) : null}
        {loose.map((card) => renderCard(card, null))}
        <div className="ov-card" hidden={!!openFolder}>
          {/* The picture repeats the name button beside it, so only the name is in the Tab order (AX16). */}
          <button
            type="button"
            className="ov-card__art ov-card__art--new"
            onClick={onNew}
            tabIndex={-1}
            aria-hidden="true"
          >
            <Plus size={22} aria-hidden="true" />
          </button>
          <button type="button" className="ov-card__name" onClick={onNew}>
            {localize(`New ${singular}`)}
          </button>
          <p className="ov-card__tags">{localize("Blank or from a template")}</p>
        </div>
      </div>
      {loading ? (
        <DelayedFallback>
          <p className="ov-gallery__note">{localize("Loading…")}</p>
        </DelayedFallback>
      ) : null}
      {hasMore ? (
        <div className="ov-gallery__more">
          <button type="button" className="ov-btn" onClick={onLoadMore} disabled={loadingAll}>
            {localize("Load more")}
          </button>
          {onLoadAll ? (
            <button
              type="button"
              className="ov-btn"
              disabled={loadingAll}
              onClick={() => {
                setLoadingAll(true);
                void onLoadAll().finally(() => setLoadingAll(false));
              }}
            >
              {localize(loadingAll || loadingMore ? "Loading…" : "Load all")}
            </button>
          ) : null}
        </div>
      ) : null}
      <KitBulkBar selection={selection} actions={bulkActions} />
      {menu.node}
    </section>
  );
}
