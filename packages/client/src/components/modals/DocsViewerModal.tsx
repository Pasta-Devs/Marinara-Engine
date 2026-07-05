// ──────────────────────────────────────────────
// DocsViewerModal: Browse the guides shipped in docs/
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, FileText, Search, X } from "lucide-react";
import { Modal } from "../ui/Modal";
import { cn } from "../../lib/utils";
import { renderMarkdownBlocks, applyInlineMarkdown } from "../../lib/markdown";
import { useDocContent, useDocsIndex, useDocsSearch, type DocSummary } from "../../hooks/use-docs";

const DIR_LABELS: Record<string, string> = {
  "": "Guides",
  installation: "Installation",
  integrations: "Integrations",
};

function dirLabel(dir: string) {
  return DIR_LABELS[dir] ?? dir.charAt(0).toUpperCase() + dir.slice(1);
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Resolve a link target relative to the doc it appears in (e.g. "../FAQ.md" from "installation/windows.md"). */
function resolveDocPath(currentPath: string, target: string): string {
  const clean = target.replace(/\\/g, "/").replace(/^\.\//, "");
  const segments = currentPath.split("/").slice(0, -1);
  for (const part of clean.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      segments.pop();
      continue;
    }
    segments.push(part);
  }
  return segments.join("/");
}

/**
 * The shipped docs use a little structural HTML (FAQ.md's <details> blocks,
 * anchor targets) and relative cross-doc links, neither of which the chat
 * markdown renderer understands. Rewrite both into forms it can render:
 * summaries become headings, structural tags are dropped, and relative .md
 * links point at the content endpoint so the click handler below can follow
 * them inside the modal.
 */
function prepareDocMarkdown(raw: string, docPath: string): string {
  const out: string[] = [];
  for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (/^<\/?details>$/i.test(trimmed) || /^<br\s*\/?>$/i.test(trimmed) || /^<\/?p(\s[^>]*)?>$/i.test(trimmed)) {
      continue;
    }
    if (/^(<a id="[^"]*"><\/a>\s*)+$/i.test(trimmed)) continue;
    const summary = trimmed.match(/^<summary>(?:<strong>)?(.+?)(?:<\/strong>)?<\/summary>$/i);
    if (summary) {
      out.push(`## ${summary[1]}`);
      continue;
    }
    const img = trimmed.match(/^<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"[^>]*>$/i);
    if (img) {
      out.push(`![](${img[1]})`);
      continue;
    }
    if (/^<img\b[^>]*>$/i.test(trimmed)) continue;
    out.push(line);
  }
  return out
    .join("\n")
    .replace(/\[([^\]]+)\]\(#[^)]*\)/g, "$1")
    .replace(
      /\[([^\]]+)\]\((?!(?:https?|card):\/\/|\/api\/|#|mailto:)([^()\s#]+\.md)(?:#[^)]*)?\)/gi,
      (_match, text: string, target: string) =>
        `[${text}](/api/docs/content?path=${encodeURIComponent(resolveDocPath(docPath, target))})`,
    );
}

// Session memory so reopening the viewer resumes where the user left off
// (people bounce in and out while referencing macros, CSS, etc.).
const PLACE_KEY = "marinara-docs-viewer-place";

interface SavedPlace {
  doc: string | null;
  scrollTop: number;
}

function readSavedPlace(): SavedPlace {
  try {
    const raw = sessionStorage.getItem(PLACE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedPlace>;
      return {
        doc: typeof parsed.doc === "string" ? parsed.doc : null,
        scrollTop: typeof parsed.scrollTop === "number" ? parsed.scrollTop : 0,
      };
    }
  } catch {
    // Ignore unavailable/corrupt sessionStorage; start fresh.
  }
  return { doc: null, scrollTop: 0 };
}

function writeSavedPlace(place: SavedPlace) {
  try {
    sessionStorage.setItem(PLACE_KEY, JSON.stringify(place));
  } catch {
    // Ignore unavailable sessionStorage.
  }
}

export function DocsViewerModal({
  open,
  onClose,
  initialDoc = null,
}: {
  open: boolean;
  onClose: () => void;
  initialDoc?: string | null;
}) {
  const savedPlaceRef = useRef(readSavedPlace());
  const [selected, setSelectedState] = useState<string | null>(initialDoc ?? savedPlaceRef.current.doc);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pendingScrollTerm, setPendingScrollTerm] = useState<string | null>(null);
  // State (not a plain ref) so effects re-run when the reader actually mounts:
  // the Modal shell renders null on its first frame while its enter animation
  // arms, and a cached doc means no later dep change would re-fire them.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const restoreScrollRef = useRef(initialDoc === null && savedPlaceRef.current.doc !== null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: index, isLoading: indexLoading, isError: indexError } = useDocsIndex(open);
  const { data: doc, isLoading: docLoading, isError: docError } = useDocContent(selected);
  const trimmedQuery = debouncedQuery.trim();
  const searching = trimmedQuery.length >= 2;
  const { data: search, isFetching: searchFetching } = useDocsSearch(trimmedQuery);

  const groups: { dir: string; docs: DocSummary[] }[] = [];
  for (const entry of index?.docs ?? []) {
    const group = groups.find((g) => g.dir === entry.dir);
    if (group) group.docs.push(entry);
    else groups.push({ dir: entry.dir, docs: [entry] });
  }

  const rendered = useMemo(
    () =>
      doc ? renderMarkdownBlocks(prepareDocMarkdown(doc.content, doc.path), applyInlineMarkdown, "docs-viewer") : null,
    [doc],
  );

  const selectDoc = (path: string, scrollTerm: string | null = null) => {
    // Re-selecting the open doc must not reset the saved reading place.
    if (path !== selected) {
      writeSavedPlace({ doc: path, scrollTop: 0 });
      setSelectedState(path);
    }
    restoreScrollRef.current = false;
    setPendingScrollTerm(scrollTerm);
  };

  // Restore the saved reading position on reopen, or jump to the first
  // occurrence of the search term after opening a doc from search results.
  useEffect(() => {
    if (!scrollEl || !rendered) return;
    if (restoreScrollRef.current && selected === savedPlaceRef.current.doc) {
      scrollEl.scrollTop = savedPlaceRef.current.scrollTop;
      restoreScrollRef.current = false;
      return;
    }
    if (!pendingScrollTerm) return;
    const term = pendingScrollTerm.toLowerCase();
    const walker = document.createTreeWalker(scrollEl, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.toLowerCase().includes(term)) {
        (node.parentElement ?? scrollEl).scrollIntoView({ block: "center" });
        break;
      }
    }
    setPendingScrollTerm(null);
  }, [scrollEl, rendered, selected, pendingScrollTerm]);

  // Give every rendered code block a Copy button (docs-viewer only — the
  // markdown renderer is shared with chat, so we augment the committed DOM
  // here instead of changing it globally). The rendered tree is memoized and
  // the container remounts per doc, so these nodes are stable until cleanup.
  useEffect(() => {
    if (!scrollEl || !rendered) return;
    const cleanups: (() => void)[] = [];
    scrollEl.querySelectorAll<HTMLPreElement>("pre.mari-md-codeblock").forEach((block) => {
      if (block.querySelector(".docs-copy-button")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Copy";
      button.className =
        "docs-copy-button absolute bottom-1.5 right-1.5 rounded-md border border-[var(--border)] bg-[var(--card)]/90 px-1.5 py-0.5 font-sans text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]";
      let resetTimer: ReturnType<typeof setTimeout> | undefined;
      const onClick = () => {
        const code = block.querySelector("code")?.textContent ?? "";
        navigator.clipboard
          .writeText(code)
          .then(() => {
            button.textContent = "Copied!";
          })
          .catch(() => {
            button.textContent = "Copy failed";
          })
          .finally(() => {
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
              button.textContent = "Copy";
            }, 1500);
          });
      };
      button.addEventListener("click", onClick);
      block.appendChild(button);
      cleanups.push(() => {
        clearTimeout(resetTimer);
        button.removeEventListener("click", onClick);
        button.remove();
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [scrollEl, rendered]);

  /** Follow rewritten cross-doc links inside the modal instead of opening a new tab. */
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
    selectDoc(target);
  };

  const searchResults = search?.results ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Documentation" width="max-w-6xl" mobileFullscreen>
      <div className="flex h-full min-h-0 gap-3 sm:h-[min(46rem,calc(90dvh-6.5rem))]">
        {/* Guide list / search */}
        <aside
          className={cn("flex w-full min-w-0 flex-col sm:w-64 sm:shrink-0", selected !== null && "hidden sm:flex")}
        >
          <div className="mb-2 flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--background)]/70 px-3 py-2">
            <Search size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search all guides"
              aria-label="Search documentation"
              className="min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]/65 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                aria-label="Clear documentation search"
              >
                <X size="0.6875rem" />
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {indexLoading ? (
              <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">Loading guides…</p>
            ) : indexError || !index ? (
              <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">
                Could not load the documentation list. The docs folder may be missing from this install.
              </p>
            ) : searching ? (
              searchResults.length === 0 ? (
                <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">
                  {searchFetching ? "Searching…" : `No matches for "${trimmedQuery}".`}
                </p>
              ) : (
                <div className={cn("space-y-1.5", searchFetching && "opacity-60")}>
                  {searchResults.map((result) => (
                    <button
                      key={result.path}
                      type="button"
                      onClick={() => selectDoc(result.path, trimmedQuery)}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors",
                        selected === result.path
                          ? "border-[var(--primary)]/40 bg-[var(--accent)]"
                          : "border-transparent hover:border-[var(--border)] hover:bg-[var(--accent)]/60",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <FileText size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--foreground)]">
                          {result.title}
                        </span>
                        <span className="shrink-0 rounded-full border border-[var(--border)]/60 bg-black/5 px-1.5 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)]/80 dark:bg-white/6">
                          {result.matches}
                        </span>
                      </span>
                      {result.snippets.map((snippet) => (
                        <span
                          key={`${result.path}-${snippet.line}`}
                          className="block truncate pl-6 text-[0.625rem] leading-snug text-[var(--muted-foreground)]/80"
                        >
                          {snippet.text}
                        </span>
                      ))}
                    </button>
                  ))}
                </div>
              )
            ) : groups.length === 0 ? (
              <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">No guides found in the docs folder.</p>
            ) : (
              groups.map((group) => (
                <div key={group.dir || "root"}>
                  <p className="px-1 pb-1 text-[0.625rem] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]/70">
                    {dirLabel(group.dir)}
                  </p>
                  <div className="space-y-1">
                    {group.docs.map((entry) => (
                      <button
                        key={entry.path}
                        type="button"
                        onClick={() => selectDoc(entry.path)}
                        title={entry.updatedAt ? `Last updated ${formatUpdatedAt(entry.updatedAt)}` : undefined}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                          selected === entry.path
                            ? "border-[var(--primary)]/40 bg-[var(--accent)] text-[var(--foreground)]"
                            : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--accent)]/60 hover:text-[var(--foreground)]",
                        )}
                      >
                        <FileText size="0.875rem" className="mt-0.5 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-xs font-medium leading-snug">{entry.title}</span>
                          <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]/70">
                            {entry.path}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          {index ? (
            <div className="mt-2 shrink-0 border-t border-[var(--border)]/60 pt-2">
              <p className="text-[0.625rem] text-[var(--muted-foreground)]/70">Also on disk at:</p>
              <code className="block break-all text-[0.625rem] text-[var(--muted-foreground)]" title={index.root}>
                {index.root}
              </code>
            </div>
          ) : null}
        </aside>

        {/* Reader */}
        <div
          className={cn(
            "min-w-0 flex-1 flex-col sm:flex sm:border-l sm:border-[var(--border)]/60 sm:pl-3",
            selected === null ? "hidden sm:flex" : "flex",
          )}
        >
          {selected === null ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
              <BookOpen size="1.5rem" className="opacity-60" />
              <p className="text-xs">Pick a guide from the list to start reading.</p>
            </div>
          ) : (
            <>
              <div className="mb-2 flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    writeSavedPlace({ doc: null, scrollTop: 0 });
                    setSelectedState(null);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] sm:hidden"
                  aria-label="Back to guide list"
                >
                  <ArrowLeft size="0.875rem" />
                </button>
                <p className="min-w-0 truncate text-[0.625rem] text-[var(--muted-foreground)]/70">
                  docs/{selected}
                  {doc?.updatedAt ? ` · Last updated ${formatUpdatedAt(doc.updatedAt)}` : ""}
                </p>
              </div>
              <div
                key={selected}
                ref={setScrollEl}
                onScroll={(event) => {
                  if (selected) writeSavedPlace({ doc: selected, scrollTop: event.currentTarget.scrollTop });
                }}
                className="min-h-0 flex-1 overflow-y-auto pr-1"
              >
                {docLoading ? (
                  <p className="py-2 text-xs text-[var(--muted-foreground)]">Loading…</p>
                ) : docError || !doc ? (
                  <p className="py-2 text-xs text-[var(--muted-foreground)]">Could not load this guide.</p>
                ) : (
                  <div
                    // Code blocks wrap instead of scrolling horizontally: the shared
                    // .mari-md-codeblock rule is unlayered CSS (beats the utilities
                    // layer, hence the !), and the corner-anchored lang tag + Copy
                    // button would float over the text of a scrolled block.
                    className="mari-message-content whitespace-pre-wrap break-words text-sm text-[var(--foreground)] [&_.mari-md-codeblock]:whitespace-pre-wrap! [&_.mari-md-codeblock]:[overflow-wrap:anywhere]! [&_.mari-md-codeblock]:pb-9!"
                    onClick={handleContentClick}
                  >
                    {rendered}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
