// ──────────────────────────────────────────────
// UI overhaul: Characters / Personas landing page (portrait gallery)
//
// Title with Import and New, one toolbar row (search, quick filters, sort),
// then a grid of portraits with the token count, name and tags. Clicking a
// portrait opens its editor; the tag selector beside search filters the list.
// ──────────────────────────────────────────────
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
  User,
  VenetianMask,
  Download,
  Globe,
  Grid2x2,
  Grid3x3,
  Square,
} from "lucide-react";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
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
  KitFolderHead,
  KitMoreButton,
  KitNewFolderButton,
  KitSelectButton,
  folderActions,
  groupByFolder,
  kitDelete,
  kitExport,
  moveToFolderAction,
  useCardFolders,
  useKitMenu,
  useKitRowDrag,
  useKitSelection,
  useSuppressClick,
  type KitAction,
} from "./LibraryKit";
import { TagFilter, countItemTags, matchesPickedTags } from "./TagFilter";

export type GalleryCard = {
  id: string;
  name: string;
  avatarPath: string | null;
  avatarStyle?: CSSProperties;
  tags: string[];
  tokens: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

type QuickFilter = "favorites" | "recent" | null;
type SortKey = "name-asc" | "name-desc" | "newest" | "oldest" | "custom";

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
  onOpen,
  onChat,
  onNew,
  onImport,
  onBrowse,
  extraHeader,
}: {
  kind: "characters" | "personas";
  title: string;
  cards: GalleryCard[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpen: (id: string) => void;
  onChat?: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
  /** Characters: open the online card browser (ChubAI and others). */
  onBrowse?: () => void;
  extraHeader?: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const cardSize = useOverhaulStore((state) => state.galleryCardSize);
  const setCardSize = useOverhaulStore((state) => state.setGalleryCardSize);
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>(null);
  // Phones: Favourites and Recently edited are one dropdown beside + New.
  const mobile = useOverhaulMobile();
  // The tag selector beside search (several tags narrow to cards with all of them).
  const [pickedTags, setPickedTags] = useState<string[]>([]);
  const tagCounts = useMemo(() => countItemTags(cards), [cards]);
  const [baseSort, setBaseSort] = useState<SortKey>("name-asc");
  const singular = kind === "characters" ? "character" : "persona";
  // My order: drag cards into your own order (shared with the classic panel's manual order).
  const order = useLibraryOrder(singular);
  const sort: SortKey = order.active ? "custom" : baseSort;
  const setSort = (next: SortKey) => {
    if (next === "custom") order.setActive(true);
    else {
      if (order.active) order.setActive(false);
      setBaseSort(next);
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
    if (quick === "recent") return list.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    switch (sort) {
      case "custom":
        return order.orderItems(list.sort((a, b) => a.name.localeCompare(b.name)));
      case "name-desc":
        return list.sort((a, b) => b.name.localeCompare(a.name));
      case "newest":
        return list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      case "oldest":
        return list.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
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
  const suppress = useSuppressClick();
  const duplicateCharacter = useDuplicateCharacter();
  const duplicatePersona = useDuplicatePersona();
  const deleteCharacter = useDeleteCharacter();
  const deletePersona = useDeletePersona();
  const filtering = !!search.trim() || !!quick || pickedTags.length > 0;
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
          () => toast.success(`${localize("Copied")} ${card.name}`),
          (error: unknown) => toast.error(error instanceof Error ? error.message : localize("Couldn't duplicate")),
        ),
    },
    moveToFolderAction(folders, () => [card.id], folders.folderOf(card.id)),
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
  const { groups, loose } = groupByFolder(visible, folders, filtering);

  const Placeholder = kind === "characters" ? User : VenetianMask;

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
            src={card.avatarPath}
            alt=""
            iconSize="2rem"
            className="h-full w-full object-cover"
            style={card.avatarStyle}
            loading="lazy"
          />
        ) : (
          <Placeholder size={28} className="ov-card__ph" aria-hidden="true" />
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
      <button type="button" className="ov-card__name" onClick={() => activate(card)} data-drag-surface>
        {card.name}
      </button>
      <p className="ov-card__tags">
        {card.tags.length
          ? card.tags.map((tag) => `#${tag}`).join(" ")
          : localizeUi("ui.overhaul.cardgallery.value1", { value1: localize("Untagged") })}
      </p>
    </div>
  );

  return (
    <section className="ov-gallery" data-component="OverhaulCardGallery" data-kind={kind}>
      <header className="ov-gallery__head">
        <h1 data-mari-part="page-title">{title}</h1>
        {extraHeader}
        <KitNewFolderButton folders={folders} />
        <KitSelectButton selection={selection} />
        {onBrowse ? (
          <button
            type="button"
            className="ov-btn"
            onClick={onBrowse}
            aria-label={localizeUi("ui.overhaul.text.browseOnline")}
            title={localizeUi("ui.overhaul.text.browseOnline")}
          >
            <Globe size={14} aria-hidden="true" />
            {mobile ? null : localizeUi("ui.overhaul.text.browseOnline")}
          </button>
        ) : null}
        <button type="button" className="ov-btn" onClick={onImport}>
          <Download size={14} aria-hidden="true" />
          {localize("Import")}
        </button>
        <button
          type="button"
          className="ov-btn ov-btn--primary"
          onClick={onNew}
          aria-label={localize(kind === "characters" ? "New character" : "New persona")}
        >
          <Plus size={14} aria-hidden="true" />
          {mobile ? localize("New") : localize(kind === "characters" ? "New character" : "New persona")}
        </button>
        {mobile ? (
          <select
            className="ov-select ovm-lp-filter"
            value={quick ?? "all"}
            onChange={(event) => {
              const value = event.target.value;
              setQuick(value === "all" ? null : (value as QuickFilter));
            }}
            aria-label={localize("Filter")}
          >
            <option value="all">{localize("All")}</option>
            {kind === "characters" ? <option value="favorites">{localize("Favourites")}</option> : null}
            <option value="recent">{localize("Recently edited")}</option>
          </select>
        ) : null}
      </header>
      <div className="ov-gallery__tools">
        <label className="ov-search">
          <Search size={14} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localize(kind === "characters" ? "Search characters or tag:name" : "Search personas")}
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
            {localize("Favourites")}
          </button>
        ) : null}
        {mobile ? null : (
          <button
            type="button"
            className={cn("ov-btn", quick === "recent" && "is-on")}
            aria-pressed={quick === "recent"}
            onClick={() => setQuick((value) => (value === "recent" ? null : "recent"))}
          >
            {localize("Recently edited")}
          </button>
        )}
        <span className="ov-gallery__spacer" />
        <select
          className="ov-select"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label={localize("Sort")}
        >
          <option value="name-asc">{localize("A to Z")}</option>
          <option value="name-desc">{localize("Z to A")}</option>
          <option value="newest">{localize("Newest")}</option>
          <option value="oldest">{localize("Oldest")}</option>
          <option value="custom">{localize("My order")}</option>
        </select>
        <div className="ov-seg ov-gallery__size" role="group" aria-label={localize("Card size")}>
          {GALLERY_SIZES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cn(cardSize === option.id && "is-on")}
              aria-pressed={cardSize === option.id}
              title={localize(option.title)}
              aria-label={localize(option.title)}
              onClick={() => setCardSize(option.id)}
            >
              <option.icon size={option.iconSize} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <div className="ov-gallery__grid" data-size={cardSize}>
        {groups.map(({ folder, rows: members }) => (
          <Fragment key={`folder:${folder.id}`}>
            <div className="ov-kit-folder-cell">
              <KitFolderHead
                folder={folder}
                count={members.length}
                dragKind={singular}
                collapsed={folders.isCollapsed(folder)}
                onToggle={() => folders.toggleCollapsed(folder)}
                onMenu={(event, anchor) =>
                  menu.openFromEvent(event, folder.name, folderActions(folders, folder), anchor)
                }
              />
            </div>
            {folders.isCollapsed(folder) ? null : members.map((card) => renderCard(card, folder.id))}
          </Fragment>
        ))}
        {groups.length > 0 && loose.length > 0 ? (
          <div className="ov-kit-folder-cell ov-kit-loose">{localize("Not in a folder")}</div>
        ) : null}
        {loose.map((card) => renderCard(card, null))}
        <div className="ov-card">
          <button type="button" className="ov-card__art ov-card__art--new" onClick={onNew}>
            <Plus size={22} aria-hidden="true" />
          </button>
          <button type="button" className="ov-card__name" onClick={onNew}>
            {localize(`New ${singular}`)}
          </button>
          <p className="ov-card__tags">{localize("Blank or from a template")}</p>
        </div>
      </div>
      {loading ? <p className="ov-gallery__note">{localize("Loading…")}</p> : null}
      {hasMore ? (
        <div className="ov-gallery__more">
          <button type="button" className="ov-btn" onClick={onLoadMore}>
            {localize("Load more")}
          </button>
        </div>
      ) : null}
      <KitBulkBar selection={selection} actions={bulkActions} />
      {menu.node}
    </section>
  );
}
