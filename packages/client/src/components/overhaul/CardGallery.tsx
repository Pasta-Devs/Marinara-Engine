// ──────────────────────────────────────────────
// UI overhaul: Characters / Personas landing page (portrait gallery)
//
// Title with Import and New, one toolbar row (search, quick filters, sort),
// then a grid of portraits with the token count, name and tags. Clicking a
// portrait opens its editor; the Library pane's tags filter the list.
// ──────────────────────────────────────────────
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { MessageCircle, Plus, Search, User, VenetianMask, Download, Grid2x2, Grid3x3, Square } from "lucide-react";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { useOverhaulMobile, useOverhaulStore, type GalleryCardSize } from "../../stores/overhaul.store";
import { AvatarImage } from "../characters/AvatarImage";
import { useTranslation as useUiTranslation } from "react-i18next";

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
type SortKey = "name-asc" | "name-desc" | "newest" | "oldest";

/** A stable, pleasant gradient for cards without a picture. */
function placeholderGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(170deg, hsl(${hue} 55% 58%), hsl(${(hue + 40) % 360} 45% 24%))`;
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
  extraHeader?: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const cardSize = useOverhaulStore((state) => state.galleryCardSize);
  const setCardSize = useOverhaulStore((state) => state.setGalleryCardSize);
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>(null);
  // Phones: Favourites, Recently edited and the tags are one dropdown beside + New.
  const mobile = useOverhaulMobile();
  const [tag, setTag] = useState<string | null>(null);
  const allTags = useMemo(
    () =>
      [...new Set(cards.flatMap((card) => card.tags.map((t) => t.trim()).filter(Boolean)))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [cards],
  );
  const [sort, setSort] = useState<SortKey>("name-asc");
  const singular = kind === "characters" ? "character" : "persona";

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const tagQuery = needle.startsWith("tag:") ? needle.slice(4).trim() : null;
    let list = cards.filter((card) => {
      if (quick === "favorites" && !card.favorite) return false;
      if (tag && !card.tags.some((t) => t.trim().toLowerCase() === tag.toLowerCase())) return false;
      if (!needle) return true;
      if (tagQuery !== null) return card.tags.some((tag) => tag.toLowerCase().includes(tagQuery));
      return card.name.toLowerCase().includes(needle) || card.tags.some((tag) => tag.toLowerCase().includes(needle));
    });
    list = [...list];
    if (quick === "recent") return list.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    switch (sort) {
      case "name-desc":
        return list.sort((a, b) => b.name.localeCompare(a.name));
      case "newest":
        return list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      case "oldest":
        return list.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
      default:
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [cards, quick, search, sort, tag]);

  const Placeholder = kind === "characters" ? User : VenetianMask;

  return (
    <section className="ov-gallery" data-component="OverhaulCardGallery" data-kind={kind}>
      <header className="ov-gallery__head">
        <h1>{title}</h1>
        {extraHeader}
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
            value={tag ? `tag:${tag}` : (quick ?? "all")}
            onChange={(event) => {
              const value = event.target.value;
              if (value.startsWith("tag:")) {
                setTag(value.slice(4));
                setQuick(null);
              } else {
                setTag(null);
                setQuick(value === "all" ? null : (value as QuickFilter));
              }
            }}
            aria-label={localize("Filter")}
          >
            <option value="all">{localize("All")}</option>
            {kind === "characters" ? <option value="favorites">{localize("Favourites")}</option> : null}
            <option value="recent">{localize("Recently edited")}</option>
            {allTags.length ? (
              <optgroup label={localize("Tags")}>
                {allTags.map((name) => (
                  <option key={name} value={`tag:${name}`}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ) : null}
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
        {visible.map((card) => (
          <div key={card.id} className="ov-card" data-card-library-card={card.id}>
            <button
              type="button"
              className="ov-card__art"
              onClick={() => onOpen(card.id)}
              style={card.avatarPath ? undefined : { background: placeholderGradient(card.id) }}
              aria-label={card.name}
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
            </button>
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
            <button type="button" className="ov-card__name" onClick={() => onOpen(card.id)}>
              {card.name}
            </button>
            <p className="ov-card__tags">
              {card.tags.length
                ? card.tags.map((tag) => `#${tag}`).join(" ")
                : localizeUi("ui.overhaul.cardgallery.value1", { value1: localize("Untagged") })}
            </p>
          </div>
        ))}
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
    </section>
  );
}
