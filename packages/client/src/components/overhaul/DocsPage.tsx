// ──────────────────────────────────────────────
// UI overhaul: Docs as a tab
//
// The guide reads on the left in a calm, wide column; the right column holds
// search, the open guide's outline ("On this page") and the guide list, folded
// by folder. Searching highlights every hit inside the open guide and steps
// through them. Guides can carry screenshots of the new layout (docs-shots.ts).
// Opened from the top bar's Docs button, the Home page, Macro Reference, or
// anything that used to open the Docs modal. Phones show the list, then the
// open guide with a back button.
// ──────────────────────────────────────────────
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Search,
  X,
} from "lucide-react";
import { useCodeBlockCopy } from "../../hooks/use-code-block-copy";
import { useDocContent, useDocsIndex, useDocsSearch, type DocSummary } from "../../hooks/use-docs";
import { useDocsFind } from "../../hooks/use-docs-find";
import { applyInlineMarkdown, renderMarkdownBlocks } from "../../lib/markdown";
import { cn } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useOverhaulStore } from "../../stores/overhaul.store";
import { dirLabel, prepareDocMarkdown } from "../modals/DocsViewerModal";
import { splitDocAtShots, type DocShot } from "./docs-shots";

const ELLIPSIS = "\u2026";

type OutlineItem = { id: string; text: string; level: 2 | 3 };

/** A search snippet line without its Markdown marks, for the results list. */
function plainSnippet(text: string) {
  return text
    .replace(/^(?:\.\.\.|\u2026)\S*\s+/, "\u2026")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s*(?:#+|[-*+]|\d+\.|>)\s*/, "")
    .replace(/[*_`]+/g, "")
    .trim();
}

function Highlighted({ text, term }: { text: string; term: string }) {
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  const at = needle.length >= 2 && lower.length === text.length ? lower.indexOf(needle) : -1;
  if (at < 0) return <>{text}</>;
  // Keep the hit in view when the line is long: start a little before it.
  const from = at > 48 ? text.lastIndexOf(" ", at - 32) + 1 : 0;
  return (
    <>
      {from > 0 ? ELLIPSIS : null}
      {text.slice(from, at)}
      <mark className="docs-search-mark">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

function ShotFigure({ shot, onOpen }: { shot: DocShot; onOpen: (shot: DocShot) => void }) {
  return (
    <figure className="ov-docs__shot">
      <button type="button" onClick={() => onOpen(shot)} aria-label={shot.alt}>
        <img
          src={`${import.meta.env.BASE_URL}docs-shots/${shot.name}.webp`}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          loading="lazy"
          decoding="async"
          style={{ width: `min(100%, ${Math.round(shot.width / 2)}px)` }}
        />
      </button>
    </figure>
  );
}

export function OverhaulDocsPage({ tabId }: { tabId: string }) {
  const localize = useLocalizedUiText();
  const path = useOverhaulStore((s) => s.docsTabs[tabId] ?? null);
  const setDocsPath = useOverhaulStore((s) => s.setDocsPath);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [zoomed, setZoomed] = useState<DocShot | null>(null);
  const jumpToFirstHit = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: index, isLoading: indexLoading } = useDocsIndex(true);
  const { data: doc, isLoading: docLoading, isError: docError } = useDocContent(path);
  const term = debounced.trim();
  const searching = term.length >= 2;
  const { data: search } = useDocsSearch(term);
  const docsLanguage = index?.language ?? "en";

  const groups = useMemo(() => {
    const out: { dir: string; docs: DocSummary[] }[] = [];
    for (const entry of index?.docs ?? []) {
      const group = out.find((g) => g.dir === entry.dir);
      if (group) group.docs.push(entry);
      else out.push({ dir: entry.dir, docs: [entry] });
    }
    return out;
  }, [index]);

  const rendered = useMemo(() => {
    if (!doc) return null;
    const pieces = splitDocAtShots(prepareDocMarkdown(doc.content, doc.path), doc.path, doc.language);
    return pieces.map((piece, i) =>
      piece.kind === "shot" ? (
        <ShotFigure key={`shot-${piece.shot.name}`} shot={piece.shot} onOpen={setZoomed} />
      ) : (
        <Fragment key={`md-${i}`}>{renderMarkdownBlocks(piece.text, applyInlineMarkdown, `docs-viewer-${i}`)}</Fragment>
      ),
    );
  }, [doc]);
  useCodeBlockCopy(contentEl, rendered);

  const minutes = useMemo(() => {
    if (!doc) return 0;
    const words = doc.content
      .replace(/```[\s\S]*?```/g, " ")
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  }, [doc]);

  // Outline, callouts and heading ids come from the rendered guide.
  useEffect(() => {
    if (!contentEl || !rendered) {
      setOutline([]);
      return;
    }
    const items: OutlineItem[] = [];
    contentEl.querySelectorAll<HTMLElement>("h2, h3").forEach((heading, i) => {
      heading.id = `ov-doc-h${i}`;
      items.push({ id: heading.id, text: heading.textContent ?? "", level: heading.tagName === "H2" ? 2 : 3 });
    });
    setOutline(items);
    setActiveHeading(null);
    // "> **Note:** …" blockquotes read as tinted callouts, as on the website.
    contentEl.querySelectorAll<HTMLElement>("blockquote.mari-md-blockquote").forEach((quote) => {
      const label = quote.querySelector("strong")?.textContent?.trim().toLowerCase() ?? "";
      const kind = label.match(/^(note|tip|warning|important|caution)\b/)?.[1];
      if (kind && quote.textContent?.trim().toLowerCase().startsWith(kind)) quote.dataset.callout = kind;
    });
  }, [contentEl, rendered]);

  // Highlight the outline entry for the section being read.
  useEffect(() => {
    if (!scrollEl || !outline.length) return;
    const onScroll = () => {
      const top = scrollEl.getBoundingClientRect().top + 96;
      let active: string | null = null;
      // At the very end the last short sections can never reach the top: mark the last one.
      if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 4) {
        setActiveHeading(outline[outline.length - 1]!.id);
        return;
      }
      for (const item of outline) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= top) active = item.id;
      }
      setActiveHeading(active);
    };
    onScroll();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [scrollEl, outline]);

  const find = useDocsFind(contentEl, rendered, searching && path ? term.slice(0, 200) : "");
  const findFirst = find.first;
  // Jump to the first hit after opening a result, and while typing with a guide open.
  useEffect(() => {
    if (!find.count) return;
    if (jumpToFirstHit.current || find.current < 0) {
      jumpToFirstHit.current = false;
      findFirst();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find.count, findFirst]);

  const current = index?.docs.find((entry) => entry.path === path);
  const flat = index?.docs ?? [];
  const at = current ? flat.indexOf(current) : -1;
  const previous = at > 0 ? flat[at - 1] : undefined;
  const next = at >= 0 && at < flat.length - 1 ? flat[at + 1] : undefined;

  // The open guide's folder stays unfolded in the list.
  useEffect(() => {
    if (current) setOpenGroups((prev) => (prev.has(current.dir) ? prev : new Set(prev).add(current.dir)));
  }, [current]);

  const select = (target: string, fromSearch = false) => {
    jumpToFirstHit.current = fromSearch;
    setDocsPath(tabId, target);
    scrollEl?.scrollTo({ top: 0 });
  };

  const toggleGroup = (dir: string) =>
    setOpenGroups((prev) => {
      const out = new Set(prev);
      if (out.has(dir)) out.delete(dir);
      else out.add(dir);
      return out;
    });

  const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest?.("a");
    if (!anchor) return;
    let url: URL;
    try {
      url = new URL(anchor.href, window.location.origin);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin || !url.pathname.endsWith("/api/docs/content")) return;
    const target = url.searchParams.get("path");
    if (!target) return;
    event.preventDefault();
    select(target);
  };

  const clearSearch = () => {
    setQuery("");
    setDebounced("");
  };

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setZoomed(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  const results = search?.results ?? [];
  const findPosition = [Math.max(find.current + 1, 0), find.count].join(" / ");

  return (
    <section className="ov-docs" data-component="OverhaulDocsPage" data-has-doc={path !== null ? "true" : undefined}>
      <div className="ov-docs__reader" ref={setScrollEl}>
        {path !== null && searching && doc ? (
          <div className="ov-docs__find" role="status">
            <Search size={13} aria-hidden="true" />
            <span className="ov-docs__find-text">
              {find.count ? findPosition : localize("No matches in this guide")}
              <q>{term}</q>
            </span>
            <button
              type="button"
              onClick={find.previous}
              disabled={!find.count}
              aria-label={localize("Previous match")}
            >
              <ChevronUp size={15} />
            </button>
            <button type="button" onClick={find.next} disabled={!find.count} aria-label={localize("Next match")}>
              <ChevronDown size={15} />
            </button>
            <button type="button" onClick={clearSearch} aria-label={localize("Clear search")}>
              <X size={14} />
            </button>
          </div>
        ) : null}
        {path === null ? (
          <div className="ov-docs__empty">
            <BookOpen size={28} aria-hidden="true" />
            <h1>{localize("Docs")}</h1>
            <p>{localize("Pick a guide on the right, or search all guides.")}</p>
            <div className="ov-docs__landing">
              {groups.map((group) => (
                <div key={group.dir || "root"}>
                  <p className="ov-docs__eyebrow">{dirLabel(group.dir, docsLanguage) || localize("Start here")}</p>
                  <ul>
                    {group.docs.map((entry) => (
                      <li key={entry.path}>
                        <button type="button" onClick={() => select(entry.path)}>
                          {entry.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : docLoading ? (
          <p className="ov-gallery__note">{localize("Loading…")}</p>
        ) : docError || !doc ? (
          <p className="ov-gallery__note">{localize("Could not load this guide.")}</p>
        ) : (
          <article className="ov-docs__article">
            {/* Phones show one pane at a time: this goes back to the guide list. */}
            <button type="button" className="ov-docs__back" onClick={() => setDocsPath(tabId, null)}>
              <ChevronLeft size={18} aria-hidden="true" />
              {localize("All guides")}
            </button>
            <p className="ov-docs__meta">
              {current ? <span>{dirLabel(current.dir, docsLanguage) || localize("Start here")}</span> : null}
              <span className="ov-docs__meta-time">
                <Clock size={12} aria-hidden="true" />
                {minutes} {localize("min read")}
              </span>
            </p>
            <div
              key={`${doc.path}:${doc.updatedAt}`}
              ref={setContentEl}
              className="mari-message-content docs-reader-content ov-docs__content"
              onClick={handleContentClick}
            >
              {rendered}
            </div>
            {previous || next ? (
              <nav className="ov-docs__pager" aria-label={localize("More guides")}>
                {previous ? (
                  <button type="button" onClick={() => select(previous.path)}>
                    <small>
                      <ArrowLeft size={12} aria-hidden="true" />
                      {localize("Previous")}
                    </small>
                    {previous.title}
                  </button>
                ) : (
                  <span />
                )}
                {next ? (
                  <button type="button" className="is-next" onClick={() => select(next.path)}>
                    <small>
                      {localize("Next")}
                      <ArrowRight size={12} aria-hidden="true" />
                    </small>
                    {next.title}
                  </button>
                ) : null}
              </nav>
            ) : null}
          </article>
        )}
      </div>
      <aside className="ov-docs__nav">
        <label className="ov-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (path && find.count) {
                if (event.shiftKey) find.previous();
                else find.next();
              } else if (results[0]) {
                select(results[0].path, true);
              }
            }}
            placeholder={localize("Search all guides")}
          />
          {query ? (
            <button type="button" onClick={clearSearch} aria-label={localize("Clear search")}>
              <X size={12} />
            </button>
          ) : null}
        </label>
        {indexLoading ? <p className="ov-gallery__note">{localize("Loading…")}</p> : null}
        {searching ? (
          <ul className="ov-docs__list ov-docs__results">
            {results.map((result) => {
              const snippet = result.snippets[0] ? plainSnippet(result.snippets[0].text) : "";
              return (
                <li key={result.path}>
                  <button
                    type="button"
                    className={cn(path === result.path && "is-on")}
                    onClick={() => select(result.path, true)}
                  >
                    <span className="ov-docs__result-head">
                      {result.title}
                      <small>{result.matches}</small>
                    </span>
                    {snippet ? (
                      <span className="ov-docs__snippet">
                        <Highlighted text={snippet} term={term} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {search && results.length === 0 ? <li className="ov-docs__none">{localize("No matches")}</li> : null}
          </ul>
        ) : (
          <>
            {path !== null && outline.length > 1 ? (
              <div className="ov-docs__outline">
                <p className="ov-docs__eyebrow">{localize("On this page")}</p>
                <ul>
                  {outline.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(item.level === 3 && "is-sub", activeHeading === item.id && "is-on")}
                        onClick={() =>
                          document.getElementById(item.id)?.scrollIntoView({ block: "start", behavior: "smooth" })
                        }
                      >
                        {item.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="ov-docs__groups">
              {path !== null && outline.length > 1 ? (
                <p className="ov-docs__eyebrow">{localize("All guides")}</p>
              ) : null}
              {groups.map((group) => {
                const open = openGroups.has(group.dir);
                return (
                  <div key={group.dir || "root"} className="ov-docs__group" data-open={open ? "true" : undefined}>
                    <button
                      type="button"
                      className="ov-docs__group-head"
                      aria-expanded={open}
                      onClick={() => toggleGroup(group.dir)}
                    >
                      <ChevronRight size={13} aria-hidden="true" />
                      <span>{dirLabel(group.dir, docsLanguage) || localize("Start here")}</span>
                      <small>{group.docs.length}</small>
                    </button>
                    {open ? (
                      <ul className="ov-docs__list">
                        {group.docs.map((entry) => (
                          <li key={entry.path}>
                            <button
                              type="button"
                              className={cn(path === entry.path && "is-on")}
                              onClick={() => select(entry.path)}
                            >
                              {entry.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </aside>
      {zoomed
        ? createPortal(
            <div className="ov-docs__zoom" role="dialog" aria-label={zoomed.alt} onClick={() => setZoomed(null)}>
              <img src={`${import.meta.env.BASE_URL}docs-shots/${zoomed.name}.webp`} alt={zoomed.alt} />
              <button type="button" aria-label={localize("Close")}>
                <X size={18} />
              </button>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
