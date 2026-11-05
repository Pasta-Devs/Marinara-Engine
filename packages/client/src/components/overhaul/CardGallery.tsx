// ──────────────────────────────────────────────
// UI overhaul: Characters / Personas landing page (portrait gallery)
//
// Title with Import and New, one toolbar row (search, quick filters, sort),
// then a grid of portraits with the token count, name and tags. Clicking a
// portrait opens its editor; the Library pane's tags filter the list.
// ──────────────────────────────────────────────
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { MessageCircle, Plus, Search, User, VenetianMask, Download } from "lucide-react";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { AvatarImage } from "../characters/AvatarImage";

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
  const localize = useLocalizedUiText();
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>(null);
  const [sort, setSort] = useState<SortKey>("name-asc");
  const singular = kind === "characters" ? "character" : "persona";

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const tagQuery = needle.startsWith("tag:") ? needle.slice(4).trim() : null;
    let list = cards.filter((card) => {
      if (quick === "favorites" && !card.favorite) return false;
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
  }, [cards, quick, search, sort]);

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
        <button type="button" className="ov-btn ov-btn--primary" onClick={onNew}>
          <Plus size={14} aria-hidden="true" />
          {localize(kind === "characters" ? "New character" : "New persona")}
        </button>
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
        {kind === "characters" ? (
          <button
            type="button"
            className={cn("ov-btn", quick === "favorites" && "is-on")}
            aria-pressed={quick === "favorites"}
            onClick={() => setQuick((value) => (value === "favorites" ? null : "favorites"))}
          >
            {localize("Favourites")}
          </button>
        ) : null}
        <button
          type="button"
          className={cn("ov-btn", quick === "recent" && "is-on")}
          aria-pressed={quick === "recent"}
          onClick={() => setQuick((value) => (value === "recent" ? null : "recent"))}
        >
          {localize("Recently edited")}
        </button>
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
      </div>

      <div className="ov-gallery__grid">
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
              {card.tags.length ? card.tags.map((tag) => `#${tag}`).join(" ") : `#${localize("Untagged")}`}
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
