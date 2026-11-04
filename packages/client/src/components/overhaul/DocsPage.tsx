// ──────────────────────────────────────────────
// UI overhaul: Docs as a tab
//
// The guide reads on the left in a wide column; the guide list sits on the
// right, grouped by folder, with search above it. Opened from the top bar's
// "?" button, the Home page, Macro Reference, or anything that used to open the
// Docs modal. Phones show the list, then the open guide with a back button.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, Search, X } from "lucide-react";
import { useCodeBlockCopy } from "../../hooks/use-code-block-copy";
import { useDocContent, useDocsIndex, useDocsSearch, type DocSummary } from "../../hooks/use-docs";
import { applyInlineMarkdown, renderMarkdownBlocks } from "../../lib/markdown";
import { cn } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useOverhaulStore } from "../../stores/overhaul.store";
import { dirLabel, prepareDocMarkdown } from "../modals/DocsViewerModal";

export function OverhaulDocsPage({ tabId }: { tabId: string }) {
  const localize = useLocalizedUiText();
  const path = useOverhaulStore((s) => s.docsTabs[tabId] ?? null);
  const setDocsPath = useOverhaulStore((s) => s.setDocsPath);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: index, isLoading: indexLoading } = useDocsIndex(true);
  const { data: doc, isLoading: docLoading, isError: docError } = useDocContent(path);
  const searching = debounced.trim().length >= 2;
  const { data: search } = useDocsSearch(debounced.trim());
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

  const rendered = useMemo(
    () =>
      doc ? renderMarkdownBlocks(prepareDocMarkdown(doc.content, doc.path), applyInlineMarkdown, "docs-viewer") : null,
    [doc],
  );
  useCodeBlockCopy(scrollEl, rendered);

  const select = (next: string) => {
    setDocsPath(tabId, next);
    scrollEl?.scrollTo({ top: 0 });
  };

  const current = index?.docs.find((entry) => entry.path === path);
  const crumbs = current ? [dirLabel(current.dir, docsLanguage), current.title].filter(Boolean) : [];

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

  return (
    <section className="ov-docs" data-component="OverhaulDocsPage" data-has-doc={path !== null ? "true" : undefined}>
      <div className="ov-docs__reader" ref={setScrollEl}>
        {path === null ? (
          <div className="ov-docs__empty">
            <BookOpen size={28} aria-hidden="true" />
            <h1>{localize("Docs")}</h1>
            <p>{localize("Pick a guide on the right, or search all guides.")}</p>
          </div>
        ) : docLoading ? (
          <p className="ov-gallery__note">{localize("Loading…")}</p>
        ) : docError || !doc ? (
          <p className="ov-gallery__note">{localize("Could not load this guide.")}</p>
        ) : (
          <>
            {/* Phones show one pane at a time: this goes back to the guide list. */}
            <button type="button" className="ov-docs__back" onClick={() => setDocsPath(tabId, null)}>
              <ChevronLeft size={18} aria-hidden="true" />
              {localize("All guides")}
            </button>
            {crumbs.length ? <p className="ov-docs__crumbs">{crumbs.join(" › ")}</p> : null}
            <div
              key={`${doc.path}:${doc.updatedAt}`}
              className="mari-message-content docs-reader-content ov-docs__content"
              onClick={handleContentClick}
            >
              {rendered}
            </div>
          </>
        )}
      </div>
      <aside className="ov-docs__nav">
        <label className="ov-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={localize("Search all guides")}
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label={localize("Clear search")}>
              <X size={12} />
            </button>
          ) : null}
        </label>
        {indexLoading ? <p className="ov-gallery__note">{localize("Loading…")}</p> : null}
        {searching ? (
          <ul className="ov-docs__list">
            {(search?.results ?? []).map((result) => (
              <li key={result.path}>
                <button
                  type="button"
                  className={cn(path === result.path && "is-on")}
                  onClick={() => select(result.path)}
                >
                  {result.title}
                  <small>{result.matches}</small>
                </button>
              </li>
            ))}
            {search && search.results.length === 0 ? <li className="ov-docs__none">{localize("No matches")}</li> : null}
          </ul>
        ) : (
          groups.map((group) => (
            <div key={group.dir || "root"} className="ov-docs__group">
              <p className="ov-docs__eyebrow">{dirLabel(group.dir, docsLanguage) || localize("Start here")}</p>
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
            </div>
          ))
        )}
      </aside>
    </section>
  );
}
