// ──────────────────────────────────────────────
// Game setup: pick individual lorebook entries (#9645)
// A searchable list of lorebooks. A book's entries are read only when that book is opened, so a big
// library costs one request per book the player looks into, not one per book they own.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { BookOpen, ChevronDown, Search, X } from "lucide-react";
import { useLorebookEntries, useLorebookFolders, type EligibleLorebookEntry } from "../../hooks/use-lorebooks";
import { cn } from "../../lib/utils";
import { Checkbox } from "../ui/Checkbox";

/** At most this many books are drawn at once; searching or "Show more" reaches the rest. */
const BOOK_PAGE = 40;
export const SETUP_LORE_ENTRY_LIMIT = 100;

type PickerBook = { id: string; name: string };

export function GameSetupLoreEntryPicker({
  books,
  selectedEntries,
  isUsable,
  disabled,
  onPick,
  onUnpick,
}: {
  /** The books whose entries may be picked, in library order. */
  books: PickerBook[];
  /** The picks that count, in pick order. */
  selectedEntries: EligibleLorebookEntry[];
  /** Whether an entry of an opened book can be picked in this chat (on, not switched off here). */
  isUsable: (entry: EligibleLorebookEntry) => boolean;
  disabled: boolean;
  onPick: (entry: EligibleLorebookEntry) => void;
  onUnpick: (entryId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(BOOK_PAGE);
  const [openBookIds, setOpenBookIds] = useState<string[]>([]);

  const bookNames = useMemo(() => new Map(books.map((book) => [book.id, book.name])), [books]);
  const pickedPerBook = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of selectedEntries) counts.set(entry.lorebookId, (counts.get(entry.lorebookId) ?? 0) + 1);
    return counts;
  }, [selectedEntries]);
  // Books with picks lead, so a pick is never buried under the rest of the library.
  const matchingBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = query ? books.filter((book) => book.name.toLowerCase().includes(query)) : books;
    return [
      ...matches.filter((book) => pickedPerBook.has(book.id)),
      ...matches.filter((book) => !pickedPerBook.has(book.id)),
    ];
  }, [books, search, pickedPerBook]);
  const visibleBooks = matchingBooks.slice(0, shown);
  const hiddenCount = matchingBooks.length - visibleBooks.length;
  const selectedIds = useMemo(() => new Set(selectedEntries.map((entry) => entry.id)), [selectedEntries]);
  const full = selectedEntries.length >= SETUP_LORE_ENTRY_LIMIT;

  const toggleBook = (bookId: string) =>
    setOpenBookIds((open) => (open.includes(bookId) ? open.filter((id) => id !== bookId) : [...open, bookId]));

  return (
    <div className="space-y-2">
      {selectedEntries.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("game.setupLore.picked", { count: selectedEntries.length, max: SETUP_LORE_ENTRY_LIMIT })}
          </p>
          {selectedEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-1.5 ring-1 ring-[var(--primary)]/30"
            >
              <span className="min-w-0 flex-1 truncate text-xs">
                <span>{entry.name || localizeUi("game.setupLore.unnamed")}</span>
                <span className="text-[var(--muted-foreground)]"> · {bookNames.get(entry.lorebookId) ?? ""}</span>
              </span>
              <button
                type="button"
                onClick={() => onUnpick(entry.id)}
                disabled={disabled}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                title={localizeUi("settings.notifications.customSound.actions.remove")}
                aria-label={localizeUi("settings.notifications.customSound.actions.remove")}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-[var(--card)] ring-1 ring-[var(--border)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5">
          <Search size={12} className="text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setShown(BOOK_PAGE);
            }}
            placeholder={localizeUi("ui.game.gamesetupwizard.searchLorebooks")}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
          />
        </div>
        <div className="max-h-72 overflow-y-auto" data-component="GameSetupLoreEntryPicker.Books">
          {visibleBooks.map((book) => {
            const open = openBookIds.includes(book.id);
            const picked = pickedPerBook.get(book.id) ?? 0;
            return (
              <div key={book.id} className="border-b border-[var(--border)] last:border-b-0">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleBook(book.id)}
                  className="flex min-h-11 w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-[var(--accent)]"
                >
                  <BookOpen size={12} className={picked ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"} />
                  <span className="min-w-0 flex-1 truncate text-xs">{book.name}</span>
                  {picked > 0 && (
                    <span className="shrink-0 text-[0.625rem] text-[var(--primary)]">
                      {localizeUi("game.setupLore.bookPicked", { count: picked })}
                    </span>
                  )}
                  <ChevronDown
                    size={12}
                    className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
                  />
                </button>
                {open && (
                  <BookEntries
                    bookId={book.id}
                    isUsable={isUsable}
                    selectedIds={selectedIds}
                    full={full}
                    disabled={disabled}
                    onPick={onPick}
                    onUnpick={onUnpick}
                  />
                )}
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShown((count) => count + BOOK_PAGE)}
              className="flex min-h-11 w-full items-center justify-center px-3 py-1.5 text-xs text-[var(--primary)] transition-colors hover:bg-[var(--accent)]"
            >
              {localizeUi("game.setupLore.showMoreBooks", { count: Math.min(hiddenCount, BOOK_PAGE) })}
            </button>
          )}
          {matchingBooks.length === 0 && (
            <p className="px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
              {books.length === 0
                ? localizeUi("ui.panels.lorebookspanel.noLorebooksYet")
                : localizeUi("ui.lorebooks.linkedresourcepicker.noMatches")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** One opened book: its entries are read now, and shown as soon as this book has them. */
function BookEntries({
  bookId,
  isUsable,
  selectedIds,
  full,
  disabled,
  onPick,
  onUnpick,
}: {
  bookId: string;
  isUsable: (entry: EligibleLorebookEntry) => boolean;
  selectedIds: Set<string>;
  full: boolean;
  disabled: boolean;
  onPick: (entry: EligibleLorebookEntry) => void;
  onUnpick: (entryId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const query = useLorebookEntries(bookId);
  const folders = useLorebookFolders(bookId);
  // An entry in a switched-off folder (or under one) is never read in play, so it isn't offered.
  const offFolderIds = useMemo(() => {
    const byId = new Map((folders.data ?? []).map((folder) => [folder.id, folder]));
    const off = new Set<string>();
    for (const folder of folders.data ?? []) {
      const seen = new Set<string>();
      for (let at = folder; at && !seen.has(at.id); at = byId.get(at.parentFolderId ?? "")!) {
        seen.add(at.id);
        if (!at.enabled) {
          off.add(folder.id);
          break;
        }
      }
    }
    return off;
  }, [folders.data]);
  const entries = useMemo(
    () =>
      (query.data ?? [])
        .filter((entry) => isUsable(entry) && !(entry.folderId && offFolderIds.has(entry.folderId)))
        .sort((a, b) => Number(b.constant) - Number(a.constant) || a.order - b.order),
    [query.data, isUsable, offFolderIds],
  );

  if (query.isLoading || folders.isLoading) {
    return (
      <p role="status" className="px-3 pb-2 text-xs text-[var(--muted-foreground)]">
        {localizeUi("game.setupLore.loading")}
      </p>
    );
  }
  // Both reads must succeed: without the folders, entries in a switched-off folder would look pickable.
  if (query.isError || folders.isError) {
    return (
      <div className="flex items-center gap-2 px-3 pb-2">
        <p role="alert" className="flex-1 text-xs text-[var(--marinara-app-accent-static)]">
          {localizeUi("game.setupLore.bookError")}
        </p>
        <button
          type="button"
          onClick={() => {
            if (query.isError) void query.refetch();
            if (folders.isError) void folders.refetch();
          }}
          disabled={query.isFetching || folders.isFetching}
          className="flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-50"
        >
          {localizeUi("ui.game.gamesurfacecomponent.retry")}
        </button>
      </div>
    );
  }
  if (!query.data || !folders.data) return null;
  if (entries.length === 0) {
    return <p className="px-3 pb-2 text-xs text-[var(--muted-foreground)]">{localizeUi("game.setupLore.bookEmpty")}</p>;
  }
  return (
    <div className="max-h-48 overflow-y-auto px-3 pb-1">
      {entries.map((entry) => {
        const checked = selectedIds.has(entry.id);
        return (
          <label key={entry.id} className="flex min-h-11 items-start gap-2 py-1.5 text-xs">
            <Checkbox
              checked={checked}
              disabled={disabled || (!checked && full)}
              className="mt-0.5"
              onChange={(event) => (event.target.checked ? onPick(entry) : onUnpick(entry.id))}
            />
            <span className="min-w-0 break-words">{entry.name || localizeUi("game.setupLore.unnamed")}</span>
          </label>
        );
      })}
    </div>
  );
}
