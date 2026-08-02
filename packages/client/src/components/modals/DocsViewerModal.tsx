// ──────────────────────────────────────────────
// DocsViewerModal: Browse the guides shipped in docs/
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, FileText, Search, X } from "lucide-react";
import { Modal } from "../ui/Modal";
import { cn } from "../../lib/utils";
import { renderMarkdownBlocks, applyInlineMarkdown } from "../../lib/markdown";
import { useDocContent, useDocsIndex, useDocsSearch, type DocSummary } from "../../hooks/use-docs";
import { useTranslation as useUiTranslation } from "react-i18next";

/**
 * Sidebar category headers, keyed by the ACTIVE DOCS LANGUAGE (not the UI
 * language): a user can run an English UI with Spanish docs, and the headers
 * must match the content they sit above. Unlisted folders fall back to the
 * English map, then to title-cased folder names, so new categories and new
 * languages degrade gracefully. Each language's labels follow its docs
 * translation glossary (loanwords like "roleplay"/"lorebooks"/"prompts" and
 * the mode names stay English, matching the UI).
 */
const DIR_LABELS_BY_DOCS_LANG: Record<string, Record<string, string>> = {
  en: {
    "": "Guides",
    installation: "Installation",
    integrations: "Integrations",
  },
  es: {
    "": "Guías",
    home: "Inicio",
    installation: "Instalación",
    connections: "Conexiones",
    conversation: "Conversación",
    roleplay: "Roleplay",
    game: "Game Mode",
    characters: "Personajes",
    chats: "Chats",
    lorebooks: "Lorebooks",
    agents: "Agentes",
    media: "Medios",
    prompts: "Prompts",
    noodle: "Noodle",
    appearance: "Apariencia",
    settings: "Configuración",
    data: "Datos",
    extending: "Extensiones",
    integrations: "Integraciones",
    development: "Desarrollo",
  },
  de: {
    "": "Anleitungen",
    home: "Start",
    installation: "Installation",
    connections: "Verbindungen",
    conversation: "Conversation",
    roleplay: "Roleplay",
    game: "Game Mode",
    characters: "Charaktere",
    chats: "Chats",
    lorebooks: "Lorebooks",
    agents: "Agenten",
    media: "Medien",
    prompts: "Prompts",
    noodle: "Noodle",
    appearance: "Darstellung",
    settings: "Einstellungen",
    data: "Daten",
    extending: "Erweiterungen",
    integrations: "Integrationen",
    development: "Entwicklung",
  },
  fr: {
    "": "Guides",
    home: "Accueil",
    installation: "Installation",
    connections: "Connexions",
    conversation: "Conversation",
    roleplay: "Roleplay",
    game: "Game Mode",
    characters: "Personnages",
    chats: "Chats",
    lorebooks: "Lorebooks",
    agents: "Agents",
    media: "Médias",
    prompts: "Prompts",
    noodle: "Noodle",
    appearance: "Apparence",
    settings: "Paramètres",
    data: "Données",
    extending: "Extensions",
    integrations: "Intégrations",
    development: "Développement",
  },
  "pt-br": {
    "": "Guias",
    home: "Início",
    installation: "Instalação",
    connections: "Conexões",
    conversation: "Conversation",
    roleplay: "Roleplay",
    game: "Game Mode",
    characters: "Personagens",
    chats: "Chats",
    lorebooks: "Lorebooks",
    agents: "Agentes",
    media: "Mídia",
    prompts: "Prompts",
    noodle: "Noodle",
    appearance: "Aparência",
    settings: "Configurações",
    data: "Dados",
    extending: "Extensões",
    integrations: "Integrações",
    development: "Desenvolvimento",
  },
  pl: {
    "": "Przewodniki",
    home: "Start",
    installation: "Instalacja",
    connections: "Połączenia",
    conversation: "Conversation",
    roleplay: "Roleplay",
    game: "Game Mode",
    characters: "Postacie",
    chats: "Czaty",
    lorebooks: "Lorebooki",
    agents: "Agenci",
    media: "Multimedia",
    prompts: "Prompty",
    noodle: "Noodle",
    appearance: "Wygląd",
    settings: "Ustawienia",
    data: "Dane",
    extending: "Rozszerzenia",
    integrations: "Integracje",
    development: "Rozwój",
  },
  ru: {
    "": "Руководства",
    home: "Главная",
    installation: "Установка",
    connections: "Подключения",
    conversation: "Conversation",
    roleplay: "Roleplay",
    game: "Game Mode",
    characters: "Персонажи",
    chats: "Чаты",
    lorebooks: "Лорбуки",
    agents: "Агенты",
    media: "Медиа",
    prompts: "Промпты",
    noodle: "Noodle",
    appearance: "Оформление",
    settings: "Настройки",
    data: "Данные",
    extending: "Расширения",
    integrations: "Интеграции",
    development: "Разработка",
  },
  ja: {
    "": "ガイド",
    home: "ホーム",
    installation: "インストール",
    connections: "接続",
    conversation: "Conversation",
    roleplay: "Roleplay",
    game: "Game Mode",
    characters: "キャラクター",
    chats: "チャット",
    lorebooks: "ロアブック",
    agents: "エージェント",
    media: "メディア",
    prompts: "プロンプト",
    noodle: "Noodle",
    appearance: "外観",
    settings: "設定",
    data: "データ",
    extending: "拡張機能",
    integrations: "連携",
    development: "開発",
  },
  ko: {
    "": "가이드",
    home: "홈",
    installation: "설치",
    connections: "연결",
    conversation: "Conversation",
    roleplay: "Roleplay",
    game: "Game Mode",
    characters: "캐릭터",
    chats: "채팅",
    lorebooks: "로어북",
    agents: "에이전트",
    media: "미디어",
    prompts: "프롬프트",
    noodle: "Noodle",
    appearance: "모양",
    settings: "설정",
    data: "데이터",
    extending: "확장",
    integrations: "연동",
    development: "개발",
  },
  "zh-hans": {
    "": "指南",
    home: "主页",
    installation: "安装",
    connections: "连接",
    conversation: "Conversation",
    roleplay: "Roleplay",
    game: "Game Mode",
    characters: "角色",
    chats: "聊天",
    lorebooks: "世界书",
    agents: "智能体",
    media: "媒体",
    prompts: "提示词",
    noodle: "Noodle",
    appearance: "外观",
    settings: "设置",
    data: "数据",
    extending: "扩展",
    integrations: "集成",
    development: "开发",
  },
  hi: {
    "": "गाइड",
    home: "होम",
    installation: "इंस्टॉलेशन",
    connections: "कनेक्शन",
    conversation: "Conversation",
    roleplay: "Roleplay",
    game: "Game Mode",
    characters: "कैरेक्टर",
    chats: "चैट",
    lorebooks: "लोरबुक",
    agents: "एजेंट",
    media: "मीडिया",
    prompts: "प्रॉम्प्ट",
    noodle: "Noodle",
    appearance: "अपीयरेंस",
    settings: "सेटिंग्स",
    data: "डेटा",
    extending: "एक्सटेंशन",
    integrations: "इंटीग्रेशन",
    development: "डेवलपमेंट",
  },
};

function dirLabel(dir: string, docsLanguage: string) {
  return (
    DIR_LABELS_BY_DOCS_LANG[docsLanguage]?.[dir] ??
    DIR_LABELS_BY_DOCS_LANG.en[dir] ??
    dir.charAt(0).toUpperCase() + dir.slice(1)
  );
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

// Upper bound on injected search marks per doc: a 2-char needle ("in", "to")
// can match hundreds of times, and unbounded wrapping bloats the DOM and makes
// the cleanup normalize() pass expensive. 500 covers every shipped guide.
const MAX_SEARCH_MARKS = 500;

/**
 * Split `text` into plain segments and <mark>ed matches of `term`.
 * Mirrors the server's docs-search semantics exactly: literal, case-insensitive,
 * whole-query substring via toLowerCase()+indexOf — never a regex, so metachars
 * (`c++`, `a|b`) match literally and highlights agree with the match counts.
 */
function highlightTermNodes(text: string, term: string): ReactNode[] {
  if (term.length < 2) return [text];
  const needle = term.toLowerCase();
  const lower = text.toLowerCase();
  // A few Unicode chars grow under toLowerCase() (e.g. İ -> i + U+0307), which
  // would misalign indexes found in `lower` when sliced out of `text`. Degrade
  // to no highlight rather than marking the wrong characters.
  if (lower.length !== text.length || needle.length !== term.length) return [text];
  const out: ReactNode[] = [];
  let last = 0;
  let idx = lower.indexOf(needle);
  let key = 0;
  while (idx !== -1) {
    if (idx > last) out.push(text.slice(last, idx));
    out.push(
      <mark key={key++} className="docs-search-mark">
        {text.slice(idx, idx + needle.length)}
      </mark>,
    );
    last = idx + needle.length;
    idx = lower.indexOf(needle, last);
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
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
  const { t: localizeUi } = useUiTranslation();
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
  // Live highlight target: the active (debounced) query while a search is on,
  // capped at 200 chars to mirror the server's needle truncation.
  const highlightTerm = searching ? trimmedQuery.slice(0, 200) : "";

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

  // The DOM-augmentation effects below (highlight + Copy buttons) mutate the
  // committed DOM under `rendered`. That is only safe if React never RECONCILES
  // the mutated subtree — it must always REMOUNT it. key={selected} alone does
  // not guarantee that: useDocContent keeps the previous doc as placeholderData,
  // so `doc` (and therefore `rendered`) can change identity without `selected`
  // changing — when a newly-selected doc's fetch resolves, or when a refetch
  // returns changed content. Reconciling against mutated DOM would patch
  // detached text nodes (stale text) or crash on insertBefore. Keying the
  // content container by the document revision closes that gap without
  // mutating render-time refs or relying on React's memo cache semantics.
  const renderedKey = doc ? `${doc.path}:${doc.updatedAt}` : "no-doc";

  // Highlight every occurrence of the live search term in the rendered doc by
  // wrapping matches in <mark> elements (docs-viewer only — the markdown
  // renderer is shared with chat, so like the Copy buttons below we augment
  // the committed DOM instead). Mutating the tree is safe because the content
  // container is keyed on the tree's identity (renderedKey above): any change
  // remounts, so React never reconciles a mutated subtree. Declared BEFORE
  // the scroll effect so marks exist when it looks for them in the same commit.
  useEffect(() => {
    if (!scrollEl || !rendered || highlightTerm.length < 2) return;
    const needle = highlightTerm.toLowerCase();
    // Skip entirely if lowercasing changed the query's own length (see the
    // walker filter below) — offsets couldn't be mapped back reliably.
    if (needle.length !== highlightTerm.length) return;
    const created: HTMLElement[] = [];

    // Phase 1: walk read-only and collect matching text nodes — mutating
    // while walking would invalidate the TreeWalker.
    const walker = document.createTreeWalker(scrollEl, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        // Never wrap our own injected chrome (Copy buttons) or existing marks.
        if (parent.closest(".docs-copy-button") || parent.closest("mark.docs-search-mark")) {
          return NodeFilter.FILTER_REJECT;
        }
        const text = node.textContent ?? "";
        const lower = text.toLowerCase();
        // A few Unicode chars grow under toLowerCase() (e.g. İ -> i + U+0307),
        // which would misalign indexes found in `lower` when sliced out of the
        // original. Skip such nodes rather than marking the wrong characters.
        if (lower.length !== text.length) return NodeFilter.FILTER_REJECT;
        return lower.includes(needle) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const targets: Text[] = [];
    let walked: Node | null;
    let budget = MAX_SEARCH_MARKS;
    while (budget > 0 && (walked = walker.nextNode())) {
      targets.push(walked as Text);
      const lower = (walked.textContent ?? "").toLowerCase();
      for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + needle.length)) budget--;
    }

    // Phase 2: split each collected text node around its matches. Matched
    // slices come from the original text, preserving the doc's casing.
    const parentsToNormalize = new Set<Node>();
    for (const textNode of targets) {
      const text = textNode.textContent ?? "";
      const lower = text.toLowerCase();
      const frag = document.createDocumentFragment();
      let last = 0;
      let idx = lower.indexOf(needle);
      while (idx !== -1 && created.length < MAX_SEARCH_MARKS) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement("mark");
        mark.className = "docs-search-mark";
        mark.appendChild(document.createTextNode(text.slice(idx, idx + needle.length)));
        frag.appendChild(mark);
        created.push(mark);
        last = idx + needle.length;
        idx = lower.indexOf(needle, last);
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      const parent = textNode.parentNode;
      if (parent) {
        parent.replaceChild(frag, textNode);
        parentsToNormalize.add(parent);
      }
    }

    // Cleanup unwraps exactly the marks this run created (never a fresh query,
    // so re-runs can't touch another run's marks), then merges the split text
    // nodes back so the scroll/copy effects see the original DOM shape. Both
    // steps are harmless if React already detached the tree (doc switch).
    return () => {
      for (const mark of created) {
        const parent = mark.parentNode;
        if (!parent) continue;
        parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
      }
      for (const parent of parentsToNormalize) parent.normalize();
    };
  }, [scrollEl, rendered, highlightTerm]);

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
    // Prefer the first injected highlight (exists whenever the live term
    // matches); fall back to a raw text walk for terms the highlighter
    // couldn't wrap (e.g. a stale pendingScrollTerm after the query changed).
    const firstMark = scrollEl.querySelector<HTMLElement>("mark.docs-search-mark");
    if (firstMark) {
      firstMark.scrollIntoView({ block: "center" });
    } else {
      const term = pendingScrollTerm.toLowerCase();
      const walker = document.createTreeWalker(scrollEl, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent?.toLowerCase().includes(term)) {
          (node.parentElement ?? scrollEl).scrollIntoView({ block: "center" });
          break;
        }
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
      button.textContent = localizeUi("ui.modals.docsviewermodal.copy");
      button.className =
        "docs-copy-button absolute bottom-1.5 right-1.5 rounded-md border border-[var(--border)] bg-[var(--card)]/90 px-1.5 py-0.5 font-sans text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]";
      let resetTimer: ReturnType<typeof setTimeout> | undefined;
      const onClick = () => {
        const code = block.querySelector("code")?.textContent ?? "";
        navigator.clipboard
          .writeText(code)
          .then(() => {
            button.textContent = localizeUi("ui.modals.docsviewermodal.copied");
          })
          .catch(() => {
            button.textContent = localizeUi("ui.modals.docsviewermodal.copyFailed");
          })
          .finally(() => {
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
              button.textContent = localizeUi("ui.modals.docsviewermodal.copy");
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
  }, [scrollEl, rendered, localizeUi]);

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

  // Active docs language; "en" until the index loads. A doc whose served
  // language differs from it is an English fallback and gets an "EN" badge.
  const docsLanguage = index?.language ?? "en";
  const englishBadge = (
    <span
      className="shrink-0 rounded-full border border-[var(--border)]/60 bg-black/5 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)]/80 dark:bg-white/6"
      title={localizeUi("ui.modals.docsviewermodal.notYetTranslatedShowingEnglish")}
    >
      {localizeUi("ui.modals.docsviewermodal.englishBadge")}
    </span>
  );

  return (
    <Modal open={open} onClose={onClose} title={localizeUi("home.actions.documentation")} width="max-w-6xl" mobileFullscreen>
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
              placeholder={localizeUi("ui.modals.docsviewermodal.searchAllGuides")}
              aria-label={localizeUi("ui.modals.docsviewermodal.searchDocumentation")}
              className="min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]/65 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                aria-label={localizeUi("ui.modals.docsviewermodal.clearDocumentationSearch")}
              >
                <X size="0.6875rem" />
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {indexLoading ? (
              <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">{localizeUi("ui.modals.docsviewermodal.loadingGuides")}</p>
            ) : indexError || !index ? (
              <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">{localizeUi("ui.modals.docsviewermodal.couldNotLoadTheDocumentationListTheDocsFolder")}</p>
            ) : searching ? (
              searchResults.length === 0 ? (
                <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">
                  {searchFetching ?localizeUi("ui.modals.docsviewermodal.searching") :localizeUi("ui.modals.docsviewermodal.noMatchesForValue1", { value1: trimmedQuery })}
                </p>
              ) : (
                <div className={cn("space-y-1.5", searchFetching && "opacity-60")}>
                  {searchResults.map((result) => (
                    <button
                      key={result.path}
                      type="button"
                      onClick={() => selectDoc(result.path, highlightTerm)}
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
                          {highlightTermNodes(result.title, highlightTerm)}
                        </span>
                        {docsLanguage !== "en" && result.language === "en" ? englishBadge : null}
                        <span className="shrink-0 rounded-full border border-[var(--border)]/60 bg-black/5 px-1.5 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)]/80 dark:bg-white/6">
                          {result.matches}
                        </span>
                      </span>
                      {result.snippets.map((snippet) => (
                        <span
                          key={`${result.path}-${snippet.line}`}
                          className="block truncate pl-6 text-[0.625rem] leading-snug text-[var(--muted-foreground)]/80"
                        >
                          {highlightTermNodes(snippet.text, highlightTerm)}
                        </span>
                      ))}
                    </button>
                  ))}
                </div>
              )
            ) : groups.length === 0 ? (
              <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">{localizeUi("ui.modals.docsviewermodal.noGuidesFoundInTheDocsFolder")}</p>
            ) : (
              groups.map((group) => (
                <div key={group.dir || "root"}>
                  <p className="px-1 pb-1 text-[0.625rem] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]/70">
                    {dirLabel(group.dir, docsLanguage)}
                  </p>
                  <div className="space-y-1">
                    {group.docs.map((entry) => (
                      <button
                        key={entry.path}
                        type="button"
                        onClick={() => selectDoc(entry.path)}
                        title={entry.updatedAt ?localizeUi("ui.modals.docsviewermodal.lastUpdatedValue1", { value1: formatUpdatedAt(entry.updatedAt) }) : undefined}
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
                        {docsLanguage !== "en" && entry.language === "en" ? englishBadge : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          {index ? (
            <div className="mt-2 shrink-0 border-t border-[var(--border)]/60 pt-2">
              <p className="text-[0.625rem] text-[var(--muted-foreground)]/70">{localizeUi("ui.modals.docsviewermodal.alsoOnDiskAt")}</p>
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
              <p className="text-xs">{localizeUi("ui.modals.docsviewermodal.pickAGuideFromTheListToStartReading")}</p>
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
                  aria-label={localizeUi("ui.modals.docsviewermodal.backToGuideList")}
                >
                  <ArrowLeft size="0.875rem" />
                </button>
                <p className="min-w-0 truncate text-[0.625rem] text-[var(--muted-foreground)]/70">{localizeUi("ui.modals.docsviewermodal.docs")}{selected}
                  {doc?.updatedAt ?localizeUi("ui.modals.docsviewermodal.lastUpdatedValue1_f97aff7", { value1: formatUpdatedAt(doc.updatedAt) }) : ""}
                </p>
                {doc && docsLanguage !== "en" && doc.language === "en" ? englishBadge : null}
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
                  <p className="py-2 text-xs text-[var(--muted-foreground)]">{localizeUi("ui.panels.ttsconfigcard.loading")}</p>
                ) : docError || !doc ? (
                  <p className="py-2 text-xs text-[var(--muted-foreground)]">{localizeUi("ui.modals.docsviewermodal.couldNotLoadThisGuide")}</p>
                ) : (
                  <div
                    // Keyed on the rendered tree's identity so React remounts
                    // (never reconciles) the subtree the highlight/copy effects
                    // mutate — see renderedKey above.
                    key={renderedKey}
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
