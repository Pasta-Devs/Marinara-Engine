import { useMemo, useState } from "react";
import { BookOpen, FilePlus2, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LorebookEntry, LorebookFolder } from "@marinara-engine/shared";
import { useCreateLorebookEntry, useLorebookEntries, useLorebookFolders } from "../../../hooks/use-lorebooks";
import { LorebookEntryRow } from "../../../components/lorebooks/LorebookEntryRow";
import { useUpdateChatLorebookEntry } from "../../../hooks/use-chats";

interface RawCharacterRow {
  id: string;
  data: string | Record<string, unknown>;
}

interface InlineLorebookEntriesEditorProps {
  lorebookId: string;
  chatId: string;
  entryStateOverrides?: Record<string, { enabled?: boolean }>;
  lorebookName: string;
  characterRows: RawCharacterRow[];
  onClose: () => void;
}

const INITIAL_VISIBLE_ENTRY_COUNT = 30;
const VISIBLE_ENTRY_STEP = 30;

export function InlineLorebookEntriesEditor({
  lorebookId,
  chatId,
  entryStateOverrides,
  lorebookName,
  characterRows,
  onClose,
}: InlineLorebookEntriesEditorProps) {
  const { t } = useTranslation();
  const entriesQuery = useLorebookEntries(lorebookId);
  const foldersQuery = useLorebookFolders(lorebookId);
  const createEntry = useCreateLorebookEntry();
  const updateChatEntry = useUpdateChatLorebookEntry();
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibleEntryCount, setVisibleEntryCount] = useState(INITIAL_VISIBLE_ENTRY_COUNT);
  const entries = useMemo(() => (entriesQuery.data ?? []) as LorebookEntry[], [entriesQuery.data]);
  const folders = useMemo(() => (foldersQuery.data ?? []) as LorebookFolder[], [foldersQuery.data]);
  const characters = useMemo(
    () =>
      characterRows.map((row) => {
        try {
          const parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
          const tags = Array.isArray(parsed?.tags) ? parsed.tags.map(String).filter(Boolean) : [];
          return {
            id: row.id,
            name:
              typeof parsed?.name === "string" && parsed.name.trim()
                ? parsed.name
                : t("chat.settings.inlineLorebook.unknownCharacter"),
            tags,
          };
        } catch {
          return { id: row.id, name: t("chat.settings.inlineLorebook.unknownCharacter"), tags: [] };
        }
      }),
    [characterRows, t],
  );
  const characterTags = useMemo(
    () => Array.from(new Set(characters.flatMap((character) => character.tags))).sort((a, b) => a.localeCompare(b)),
    [characters],
  );
  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!normalizedSearch) return entries;
    return entries.filter(
      (entry) =>
        entry.name.toLocaleLowerCase().includes(normalizedSearch) ||
        entry.keys.some((key) => key.toLocaleLowerCase().includes(normalizedSearch)),
    );
  }, [entries, search]);
  const visibleEntries = filteredEntries.slice(0, visibleEntryCount);
  const hasMoreEntries = visibleEntries.length < filteredEntries.length;
  const isLoading = entriesQuery.isLoading || foldersQuery.isLoading;
  const isError = entriesQuery.isError || foldersQuery.isError;

  const handleCreateEntry = async () => {
    const entry = await createEntry.mutateAsync({
      lorebookId,
      name: t("chat.settings.inlineLorebook.newEntryName"),
      content: "",
      keys: [],
      preventRecursion: true,
    });
    setSearch("");
    setVisibleEntryCount((current) => Math.max(current, entries.length + 1));
    setExpandedEntryId(entry.id);
  };

  return (
    <div
      data-chat-settings-inline-lorebook-editor={lorebookId}
      className="mari-chat-settings-inline-editor mt-2 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] p-2.5"
    >
      <div className="flex items-start gap-2">
        <BookOpen size="0.8125rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {t("chat.settings.inlineLorebook.title", { name: lorebookName })}
          </p>
          <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
            {t("chat.settings.inlineLorebook.autoSave")}
          </p>
        </div>
        <span className="shrink-0 pt-0.5 text-[0.5625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
          {t("chat.settings.inlineLorebook.entryCount", { count: entries.length })}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
          title={t("chat.settings.inlineEditor.close")}
          aria-label={t("chat.settings.inlineEditor.close")}
        >
          <X size="0.75rem" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <label className="relative min-w-0 flex-1">
          <Search
            size="0.6875rem"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--marinara-chat-chrome-panel-muted)]"
          />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setVisibleEntryCount(INITIAL_VISIBLE_ENTRY_COUNT);
            }}
            placeholder={t("chat.settings.inlineLorebook.search")}
            aria-label={t("chat.settings.inlineLorebook.search")}
            className="h-8 w-full rounded-lg border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-input-bg)] pl-7 pr-2.5 text-xs outline-none placeholder:text-[var(--marinara-chat-chrome-panel-muted)]/60 focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleCreateEntry()}
          disabled={createEntry.isPending}
          className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-2 text-[0.6875rem] font-medium text-[var(--marinara-chat-chrome-button-text)] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FilePlus2 size="0.75rem" />
          {t("chat.settings.inlineLorebook.addEntry")}
        </button>
      </div>

      {isLoading && (
        <div className="mt-2 space-y-1.5" aria-label={t("chat.settings.inlineLorebook.loading")}>
          <div className="shimmer h-9 rounded-lg" />
          <div className="shimmer h-9 rounded-lg" />
          <div className="shimmer h-9 rounded-lg" />
        </div>
      )}

      {isError && (
        <p className="mt-2 rounded-lg border border-[var(--destructive)]/25 bg-[var(--destructive)]/10 px-3 py-2 text-[0.6875rem] text-[var(--destructive)]">
          {t("chat.settings.inlineLorebook.loadError")}
        </p>
      )}

      {!isLoading && !isError && filteredEntries.length === 0 && (
        <p className="mt-2 rounded-lg border border-dashed border-[var(--marinara-chat-chrome-button-border)] px-3 py-4 text-center text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
          {entries.length === 0 ? t("chat.settings.inlineLorebook.empty") : t("chat.settings.inlineLorebook.noMatches")}
        </p>
      )}

      {!isLoading && !isError && visibleEntries.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {visibleEntries.map((entry) => (
            <LorebookEntryRow
              key={entry.id}
              entry={entry}
              chatEnabled={{
                enabled: entryStateOverrides?.[entry.id]?.enabled !== false,
                onChange: (enabled) => updateChatEntry.mutateAsync({ chatId, entryId: entry.id, enabled }),
              }}
              lorebookId={lorebookId}
              isExpanded={expandedEntryId === entry.id}
              onToggleExpand={() => setExpandedEntryId((current) => (current === entry.id ? null : entry.id))}
              characters={characters}
              characterTags={characterTags}
              folders={folders}
              compact
              draggable={false}
              isDragging={false}
              isDragReady={false}
              onDragHandleMouseDown={() => undefined}
              onDragHandleMouseUp={() => undefined}
              onDragStart={() => undefined}
              onDragOver={() => undefined}
              onDrop={() => undefined}
              onDragEnd={() => undefined}
            />
          ))}
          {hasMoreEntries && (
            <button
              type="button"
              onClick={() => setVisibleEntryCount((current) => current + VISIBLE_ENTRY_STEP)}
              className="w-full rounded-lg border border-dashed border-[var(--marinara-chat-chrome-button-border)] px-3 py-2 text-[0.6875rem] font-medium text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
            >
              {t("chat.settings.inlineLorebook.showMore", {
                count: Math.min(VISIBLE_ENTRY_STEP, filteredEntries.length - visibleEntries.length),
              })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
