import { useMemo, useRef, useState } from "react";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GlobalChatSearchResult } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { cn } from "../../lib/utils";
import { useChats } from "../../hooks/use-chats";
import { useCharacterSummaries } from "../../hooks/use-characters";
import { useGlobalChatSearch, type GlobalChatSearchFilters } from "../../hooks/use-chat-insights";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { openChatAtMessage } from "../../lib/chat-insights";
import { localDateInputToIso, splitSnippet } from "../../lib/chat-insights-display";

const FIELD_CLASS =
  "h-9 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25";

function readCharacterIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((id): id is string => typeof id === "string");
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function SearchResultRow({ result, onOpen }: { result: GlobalChatSearchResult; onOpen: () => void }) {
  const { t } = useTranslation();
  const speaker =
    result.role === "user"
      ? t("chatInsights.search.speaker.user")
      : result.role === "narrator"
        ? t("chatInsights.search.speaker.narrator")
        : result.role === "system"
          ? t("chatInsights.search.speaker.system")
          : (result.speaker ?? t("chatInsights.search.speaker.character"));
  const date = new Date(result.createdAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
      title={t("chatInsights.search.openResult", { chat: result.chatName, number: result.messageNumber })}
    >
      <span className="flex min-w-0 items-baseline gap-2 text-xs">
        <span className="truncate font-semibold text-[var(--foreground)]">{result.chatName}</span>
        <span className="shrink-0 text-[var(--muted-foreground)]">{t(`chatInsights.mode.${result.chatMode}`)}</span>
        <span className="ml-auto shrink-0 tabular-nums text-[var(--muted-foreground)]">{dateLabel}</span>
      </span>
      <span className="mt-0.5 block text-[0.6875rem] font-medium text-[var(--primary)]">
        {t("chatInsights.search.speakerAndNumber", { speaker, number: result.messageNumber })}
      </span>
      <span className="mt-1 line-clamp-3 block break-words text-sm leading-5 text-[var(--foreground)]">
        {splitSnippet(result.snippet, result.highlights).map((part, index) =>
          part.highlighted ? (
            <mark key={index} className="rounded-sm bg-[var(--primary)]/25 px-0.5 text-[var(--foreground)]">
              {part.text}
            </mark>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </span>
    </button>
  );
}

export function GlobalSearchModal({
  open,
  onClose,
  initialQuery = "",
}: {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState("");
  const [role, setRole] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: chats } = useChats({ enabled: open && filtersOpen });
  const characterIds = useMemo(
    () => [...new Set((chats ?? []).flatMap((chat) => readCharacterIds(chat.characterIds)))],
    [chats],
  );
  const { data: characterSummaries } = useCharacterSummaries(characterIds, open && filtersOpen);
  const characterOptions = useMemo(
    () =>
      [...(characterSummaries ?? [])]
        .filter((character) => character.name?.trim())
        .sort((left, right) => left.name.localeCompare(right.name)),
    [characterSummaries],
  );

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const filters = useMemo<GlobalChatSearchFilters>(
    () => ({
      query: debouncedQuery,
      mode: mode || undefined,
      role: role || undefined,
      characterId: characterId || undefined,
      from: localDateInputToIso(fromDate, false),
      to: localDateInputToIso(toDate, true),
    }),
    [characterId, debouncedQuery, fromDate, mode, role, toDate],
  );
  const search = useGlobalChatSearch(filters, open);
  // Pages are separate scans; a chat that got a new message between them can
  // move up the order and repeat a hit, so keep the first copy only.
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const seen = new Set<string>();
    return (search.data?.pages.flatMap((page) => page.results) ?? []).filter((result) => {
      const key = `${result.chatId}:${result.messageId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [query, search.data]);
  const lastPage = query.trim() ? search.data?.pages[search.data.pages.length - 1] : undefined;
  const activeFilterCount = [mode, role, characterId, fromDate, toDate].filter(Boolean).length;
  const waiting = query.trim() !== debouncedQuery || (search.isFetching && !search.isFetchingNextPage);

  const openResult = (result: GlobalChatSearchResult) => {
    onClose();
    openChatAtMessage(result.chatId, result.messageNumber);
  };

  let status: string;
  if (!query.trim()) status = t("chatInsights.search.hint");
  else if (waiting) status = t("chatInsights.search.searching");
  else if (search.isError) status = t("chatInsights.search.failed");
  else if (results.length === 0) status = t("chatInsights.search.noMatches");
  else if (search.hasNextPage) status = t("chatInsights.search.resultCountMore", { count: results.length });
  else status = t("chatInsights.search.resultCount", { count: results.length });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("chatInsights.search.title")}
      width="max-w-2xl"
      mobileFullscreen
      initialFocusRef={inputRef}
    >
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size="0.875rem"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && results[0] && !waiting) openResult(results[0]);
              }}
              placeholder={t("chatInsights.search.placeholder")}
              aria-label={t("chatInsights.search.inputLabel")}
              className={cn(FIELD_CLASS, "h-10 pl-9 text-sm")}
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            aria-expanded={filtersOpen}
            className={cn(
              "mari-chrome-control mari-chrome-control--small relative h-10 shrink-0 px-3",
              filtersOpen && "mari-chrome-control--selected",
            )}
            title={t("chatInsights.search.filters")}
            aria-label={t("chatInsights.search.filters")}
          >
            <SlidersHorizontal size="0.875rem" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[0.5625rem] font-bold text-[var(--primary-foreground)]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("chatInsights.search.filterMode")}
              <select value={mode} onChange={(event) => setMode(event.target.value)} className={FIELD_CLASS}>
                <option value="">{t("chatInsights.search.anyMode")}</option>
                <option value="conversation">{t("chatInsights.mode.conversation")}</option>
                <option value="roleplay">{t("chatInsights.mode.roleplay")}</option>
                <option value="game">{t("chatInsights.mode.game")}</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("chatInsights.search.filterRole")}
              <select value={role} onChange={(event) => setRole(event.target.value)} className={FIELD_CLASS}>
                <option value="">{t("chatInsights.search.anyRole")}</option>
                <option value="user">{t("chatInsights.search.speaker.user")}</option>
                <option value="assistant">{t("chatInsights.search.roleCharacters")}</option>
                <option value="narrator">{t("chatInsights.search.speaker.narrator")}</option>
              </select>
            </label>
            <label className="col-span-2 flex min-w-0 flex-col gap-1 text-[0.6875rem] text-[var(--muted-foreground)] sm:col-span-1">
              {t("chatInsights.search.filterCharacter")}
              <select
                value={characterId}
                onChange={(event) => setCharacterId(event.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">{t("chatInsights.search.anyCharacter")}</option>
                {characterOptions.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("chatInsights.search.filterFrom")}
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => setFromDate(event.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("chatInsights.search.filterTo")}
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => setToDate(event.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            {activeFilterCount > 0 && (
              <div className="col-span-2 flex items-end sm:col-span-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("");
                    setRole("");
                    setCharacterId("");
                    setFromDate("");
                    setToDate("");
                  }}
                  className="mari-chrome-control mari-chrome-control--small h-9 w-full justify-center text-xs"
                >
                  {t("chatInsights.search.clearFilters")}
                </button>
              </div>
            )}
          </div>
        )}

        <p
          className="flex min-h-4 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--muted-foreground)]"
          role="status"
          aria-live="polite"
        >
          {waiting && query.trim() ? <Loader2 size="0.75rem" className="animate-spin" /> : null}
          {status}
          {lastPage?.partial && !waiting ? <span>{t("chatInsights.search.partial")}</span> : null}
        </p>

        {results.length > 0 && (
          <div
            className={cn(
              "divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)]",
              waiting && "opacity-60",
            )}
          >
            {results.map((result) => (
              <SearchResultRow
                key={`${result.chatId}:${result.messageId}`}
                result={result}
                onOpen={() => openResult(result)}
              />
            ))}
          </div>
        )}

        {query.trim() && search.hasNextPage && !waiting && (
          <button
            type="button"
            onClick={() => void search.fetchNextPage()}
            disabled={search.isFetchingNextPage}
            className="mari-chrome-control mari-chrome-control--small mx-auto px-4 text-xs disabled:opacity-50"
          >
            {search.isFetchingNextPage ? <Loader2 size="0.75rem" className="animate-spin" /> : null}
            {t("chatInsights.search.loadMore")}
          </button>
        )}
      </div>
    </Modal>
  );
}
