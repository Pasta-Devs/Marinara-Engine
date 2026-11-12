// ──────────────────────────────────────────────
// UI overhaul: the tag selector beside a Library page's search
//
// One compact button ("Tags", or the picked tag) that opens a searchable list
// of every tag with its count. Pick several to narrow the list to cards that
// carry all of them; "Untagged" shows only cards without tags. Replaces the
// long tag list that used to grow under Characters/Personas in the Library pane.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Hash, Search, Tag, X } from "lucide-react";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";

/** The value of the "Untagged" choice: it can't be a real tag, which never is empty. */
export const UNTAGGED = "";

export type TagCount = { tag: string; count: number };

/** Every distinct tag (case-insensitive, first spelling wins) with how many items carry it, A to Z. */
export function countItemTags(items: Array<{ tags: string[] }>) {
  const map = new Map<string, TagCount>();
  let untagged = 0;
  for (const item of items) {
    const seen = new Set<string>();
    for (const raw of item.tags) {
      const tag = raw.trim();
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      const entry = map.get(key);
      if (entry) entry.count += 1;
      else map.set(key, { tag, count: 1 });
    }
    if (!seen.size) untagged += 1;
  }
  return { tags: [...map.values()].sort((a, b) => a.tag.localeCompare(b.tag)), untagged };
}

/** True when an item passes the picked tags: all of them, or none at all for "Untagged". */
export function matchesPickedTags(itemTags: string[], picked: string[]) {
  if (!picked.length) return true;
  const own = itemTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  if (picked.includes(UNTAGGED)) return own.length === 0;
  return picked.every((tag) => own.includes(tag.toLowerCase()));
}

export function TagFilter({
  tags,
  untagged,
  picked,
  onChange,
  compact = false,
  className,
}: {
  tags: TagCount[];
  untagged: number;
  picked: string[];
  onChange: (next: string[]) => void;
  /** Icon (plus picked count) only, for narrow toolbars such as the Chats list in the sidebar. */
  compact?: boolean;
  /** Replaces the default `ov-btn` look, so the button can match its neighbours. */
  className?: string;
}) {
  const localize = useLocalizedUiText();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? tags.filter((entry) => entry.tag.toLowerCase().includes(needle)) : tags;
  }, [query, tags]);

  const isPicked = (tag: string) => picked.some((value) => value.toLowerCase() === tag.toLowerCase());
  const toggle = (tag: string) => {
    if (tag === UNTAGGED) onChange(picked.includes(UNTAGGED) ? [] : [UNTAGGED]);
    else if (isPicked(tag)) onChange(picked.filter((value) => value.toLowerCase() !== tag.toLowerCase()));
    else onChange([...picked.filter((value) => value !== UNTAGGED), tag]);
  };

  // Place the list under the button, right edges lined up, inside the window.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current?.getBoundingClientRect();
      const pop = popRef.current?.getBoundingClientRect();
      if (!button) return;
      const width = pop?.width ?? 256;
      // Never past the toolbar's right edge (the page's content column), nor the window's.
      const toolbar = buttonRef.current?.closest(".ov-gallery__tools, .ov-chats-tools")?.getBoundingClientRect();
      const maxRight = Math.min(window.innerWidth - 8, toolbar && toolbar.width > 0 ? toolbar.right : Infinity);
      const left = Math.min(Math.max(8, button.left), maxRight - width);
      const top = button.bottom + 6;
      setPos({ left: Math.max(8, left), top, maxHeight: Math.max(160, window.innerHeight - top - 12) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    // Pointers type straight away; touch screens don't get the keyboard thrown up over the list.
    if (window.matchMedia?.("(hover: hover)").matches) searchRef.current?.focus({ preventScroll: true });
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const realPicked = picked.filter((value) => value !== UNTAGGED);
  const label = picked.includes(UNTAGGED)
    ? localize("Untagged")
    : realPicked.length
      ? `#${tags.find((entry) => entry.tag.toLowerCase() === realPicked[0].toLowerCase())?.tag ?? realPicked[0]}`
      : localize("Tags");
  const more = realPicked.length > 1 ? realPicked.length - 1 : 0;
  const active = picked.length > 0;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(className ?? "ov-btn", "ov-tagfilter", compact && "ov-tagfilter--compact", active && "is-on")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={localize("Filter by tag")}
        title={localize("Filter by tag")}
        data-mari-part="tag-filter"
        onClick={() => setOpen((value) => !value)}
      >
        <Tag size={14} aria-hidden="true" />
        <span className="ov-tagfilter__label">{label}</span>
        {more ? <span className="ov-tagfilter__more">+{more}</span> : null}
        {/* Phones show only the icon, plus how many tags are picked. */}
        {active ? <span className="ov-tagfilter__count">{picked.length}</span> : null}
        <ChevronDown size={14} aria-hidden="true" className="ov-tagfilter__chev" />
      </button>
      {open
        ? createPortal(
            <div
              ref={popRef}
              role="dialog"
              aria-label={localize("Filter by tag")}
              className="ov-tagpop"
              data-component="OverhaulTagFilter"
              style={{
                left: pos?.left ?? -9999,
                top: pos?.top ?? -9999,
                maxHeight: pos?.maxHeight,
              }}
            >
              <div className="ov-tagpop__top">
                <label className="ov-search ov-tagpop__search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={localize("Search tags")}
                    aria-label={localize("Search tags")}
                  />
                </label>
                {active ? (
                  <button type="button" className="ov-tagpop__clear" onClick={() => onChange([])}>
                    <X size={12} aria-hidden="true" />
                    {localize("Clear")}
                  </button>
                ) : null}
              </div>
              <div className="ov-tagpop__list" role="group">
                {shown.map((entry) => {
                  const on = isPicked(entry.tag);
                  return (
                    <button
                      key={entry.tag}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={on}
                      className={cn("ov-tagpop__row", on && "is-on")}
                      onClick={() => toggle(entry.tag)}
                    >
                      <span className="ov-tagpop__box">
                        {on ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}
                      </span>
                      <Hash size={12} aria-hidden="true" className="ov-tagpop__hash" />
                      <span className="ov-tagpop__name">{entry.tag}</span>
                      <small>{entry.count}</small>
                    </button>
                  );
                })}
                {!shown.length ? (
                  <p className="ov-tagpop__empty">{localize(tags.length ? "No tags match" : "No tags yet")}</p>
                ) : null}
                {untagged > 0 && !query.trim() ? (
                  <>
                    <div className="ov-tagpop__rule" aria-hidden="true" />
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={picked.includes(UNTAGGED)}
                      className={cn("ov-tagpop__row", picked.includes(UNTAGGED) && "is-on")}
                      onClick={() => toggle(UNTAGGED)}
                    >
                      <span className="ov-tagpop__box">
                        {picked.includes(UNTAGGED) ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}
                      </span>
                      <span className="ov-tagpop__name ov-tagpop__name--muted">{localize("Untagged")}</span>
                      <small>{untagged}</small>
                    </button>
                  </>
                ) : null}
              </div>
              {realPicked.length > 1 ? (
                <p className="ov-tagpop__hint">{localize("Showing cards with all picked tags")}</p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
