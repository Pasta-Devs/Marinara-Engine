// ──────────────────────────────────────────────
// Bookmarks and Trash lists shown inside the chat search panel
// ──────────────────────────────────────────────
import {
  MESSAGE_TRASH_RETENTION_DAYS,
  readMessageBookmark,
  type Message,
  type MessageTrashEntry,
} from "@marinara-engine/shared";
import { Bookmark, RotateCcw, Trash2 } from "lucide-react";
import type { TFunction } from "i18next";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCharacterSummaries } from "../../hooks/use-characters";
import { useDeleteTrashedMessages, useMessageTrash, useRestoreTrashedMessages } from "../../hooks/use-chats";
import { cn } from "../../lib/utils";
import { isMessageHiddenFromUser } from "../../lib/chat-message-visibility";
import { Spinner } from "../ui/Spinner";

const ROW_CLASS =
  "block w-full px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]";
const EMPTY_CLASS = "px-3 py-8 text-center text-sm text-[var(--muted-foreground)]";
const ICON_BUTTON_CLASS =
  "inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md px-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50";

function snippet(content: string, max = 160): string {
  const text = content.replace(/\s+/gu, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max).trim()}…`;
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function useSpeakerName(characterIds: string[]) {
  const { t: localizeUi } = useUiTranslation();
  const { data: summaries } = useCharacterSummaries(characterIds);
  const names = useMemo(() => new Map((summaries ?? []).map((summary) => [summary.id, summary.name])), [summaries]);
  return useCallback(
    (message: { role: string; characterId?: string | null; extra?: unknown }) => {
      if (message.role === "user") {
        const extra = message.extra as { personaSnapshot?: { name?: unknown } | null } | null | undefined;
        const personaName = typeof extra?.personaSnapshot?.name === "string" ? extra.personaSnapshot.name.trim() : "";
        return personaName || localizeUi("ui.chat.messagemarks.you");
      }
      if (message.role === "narrator") return localizeUi("ui.chat.chatmessage.narrator");
      if (message.role === "system") return localizeUi("ui.chat.messagemarks.system");
      return (message.characterId && names.get(message.characterId)) || localizeUi("ui.chat.messagemarks.character");
    },
    [names, localizeUi],
  );
}

/** Bookmarked messages of the loaded transcript; clicking one jumps to it. */
export function ChatBookmarksList({
  messages,
  onJump,
}: {
  messages: Message[];
  onJump: (messageNumber: number) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const bookmarks = useMemo(
    () =>
      messages.flatMap((message, index) => {
        const bookmark = readMessageBookmark(message.extra);
        return bookmark && !isMessageHiddenFromUser(message) ? [{ message, bookmark, messageNumber: index + 1 }] : [];
      }),
    [messages],
  );
  const speakerName = useSpeakerName(
    bookmarks.flatMap(({ message }) => (message.characterId ? [message.characterId] : [])),
  );

  if (bookmarks.length === 0) {
    return (
      <div className={EMPTY_CLASS}>
        <Bookmark size="1rem" className="mx-auto mb-2 opacity-60" />
        <p>{localizeUi("ui.chat.messagemarks.noBookmarks")}</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-[var(--border)]">
      {bookmarks.map(({ message, bookmark, messageNumber }) => (
        <button
          key={message.id}
          type="button"
          onClick={() => onJump(messageNumber)}
          className={ROW_CLASS}
          title={localizeUi("ui.chat.chatmessagesearch.jumpToMessage", { number: messageNumber })}
        >
          <span className="flex items-baseline gap-2 text-xs">
            <span className="min-w-0 truncate font-semibold text-[var(--primary)]">{speakerName(message)}</span>
            <span className="ml-auto shrink-0 text-[var(--muted-foreground)]">{formatWhen(message.createdAt)}</span>
          </span>
          {bookmark.label && (
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
              <Bookmark size="0.7rem" className="shrink-0 text-[var(--primary)]" fill="currentColor" />
              <span className="min-w-0 truncate">{bookmark.label}</span>
            </span>
          )}
          <span className="mt-1 line-clamp-2 block break-words text-sm leading-5 text-[var(--muted-foreground)]">
            {snippet(message.content)}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * A large trash renders this many rows at a time, so the page stays responsive while it fills in (#7210).
 * Batches of 100 took about 1.5x as long to fill 5,001 entries on a 3-4x slower CPU, for little responsiveness gain.
 */
const TRASH_ROW_BATCH = 200;
/** Restore failures outlast the 6 s default: a large restore can keep a slow phone busy for a few seconds. */
const RESTORE_FAILURE_TOAST_MS = 15_000;

/** How many of `total` batches to render now: one at once, then one more each time the page is idle. */
function useProgressiveCount(total: number) {
  const [count, setCount] = useState(1);
  // Shrink with the list, so a list that grows large again also fills in batch by batch.
  if (count > Math.max(total, 1)) setCount(Math.max(total, 1));
  useEffect(() => {
    if (count >= total) return;
    const grow = () => setCount(count + 1);
    // WebKit has no requestIdleCallback; a short timer still lets input and painting run between batches.
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(grow, { timeout: 500 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(grow, 16);
    return () => window.clearTimeout(handle);
  }, [count, total]);
  return Math.min(count, total);
}

type TrashRowActions = {
  localizeUi: TFunction;
  onRestore: (entryId: string) => void;
  onDelete: (entryId: string, confirmed: boolean) => void;
};

/** One trash entry; memoised so a refetch that keeps the entry does not re-render it. */
const ChatTrashRow = memo(function ChatTrashRow({
  entry,
  speaker,
  confirming,
  localizeUi,
  onRestore,
  onDelete,
}: TrashRowActions & { entry: MessageTrashEntry; speaker: string; confirming: boolean }) {
  return (
    // Its own top border, not divide-y: appended rows then never restyle the rows above them.
    <div className="border-t border-[var(--border)] px-3 py-2.5">
      <div className="flex items-baseline gap-2 text-xs">
        <span className="min-w-0 truncate font-semibold text-[var(--foreground)]">{speaker}</span>
        <span className="ml-auto shrink-0 text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.messagetrash.deletedAt", { time: formatWhen(entry.deletedAt) })}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-[var(--muted-foreground)]">
        {snippet(entry.content) || localizeUi("ui.chat.messagetrash.noText")}
      </p>
      <div className="mt-1 flex items-center gap-1">
        {entry.swipeCount > 1 && (
          <span className="mr-auto text-[0.6875rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.messagetrash.swipes", { count: entry.swipeCount })}
          </span>
        )}
        <button
          type="button"
          onClick={() => onRestore(entry.id)}
          className={cn(ICON_BUTTON_CLASS, entry.swipeCount <= 1 && "ml-auto")}
        >
          <RotateCcw size="0.75rem" />
          {localizeUi("ui.chat.messagetrash.restore")}
        </button>
        <button
          type="button"
          onClick={() => onDelete(entry.id, confirming)}
          className={cn(ICON_BUTTON_CLASS, confirming && "text-[var(--destructive)]")}
        >
          <Trash2 size="0.75rem" />
          {confirming
            ? localizeUi("ui.chat.messagetrash.confirmDeleteForever")
            : localizeUi("ui.chat.messagetrash.deleteForever")}
        </button>
      </div>
    </div>
  );
});

/** One batch of trash rows; memoised so busy changes and newly shown batches leave it alone. */
const ChatTrashRowBatch = memo(function ChatTrashRowBatch({
  entries,
  confirmingId,
  speakerName,
  ...actions
}: TrashRowActions & {
  entries: MessageTrashEntry[];
  confirmingId: string | null;
  speakerName: (entry: MessageTrashEntry) => string;
}) {
  return entries.map((entry) => (
    <ChatTrashRow
      key={entry.id}
      entry={entry}
      speaker={speakerName(entry)}
      confirming={entry.id === confirmingId}
      {...actions}
    />
  ));
});

/** Per-chat trash with restore, delete forever and empty trash. */
export function ChatTrashList({ chatId, enabled }: { chatId: string; enabled: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  const { data: entries, isLoading, isError, refetch } = useMessageTrash(chatId, enabled);
  const { mutate: restore, isPending: restoring } = useRestoreTrashedMessages(chatId);
  const { mutate: deleteForever, isPending: deleting } = useDeleteTrashedMessages(chatId);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const speakerName = useSpeakerName(
    (entries ?? []).flatMap((entry) => (entry.characterId ? [entry.characterId] : [])),
  );
  const batches = useMemo(() => {
    const list = entries ?? [];
    return Array.from({ length: Math.ceil(list.length / TRASH_ROW_BATCH) }, (_, index) =>
      list.slice(index * TRASH_ROW_BATCH, (index + 1) * TRASH_ROW_BATCH),
    );
  }, [entries]);
  const shownBatches = useProgressiveCount(batches.length);
  const busy = restoring || deleting;
  // Row actions check this ref instead of `busy`, so a busy change keeps their callbacks and every row unchanged.
  const busyRef = useRef(busy);
  useLayoutEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const restoreEntries = useCallback(
    (entryIds: string[]) =>
      restore(entryIds, {
        onSuccess: (result) => {
          const restored =
            result.restoredMessageIds.length > 0
              ? localizeUi("ui.chat.messagetrash.restored", { count: result.restoredMessageIds.length })
              : undefined;
          if (result.error || result.conflictEntryIds.length > 0)
            toast.warning(result.error ?? localizeUi("ui.chat.messagetrash.restoreConflict"), {
              description: restored,
              duration: RESTORE_FAILURE_TOAST_MS,
            });
          else if (restored) toast.success(restored);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : localizeUi("ui.chat.messagetrash.restoreFailed"), {
            duration: RESTORE_FAILURE_TOAST_MS,
          }),
      }),
    [restore, localizeUi],
  );
  const restoreEntry = useCallback(
    (entryId: string) => {
      if (!busyRef.current) restoreEntries([entryId]);
    },
    [restoreEntries],
  );
  const deleteEntries = useCallback(
    (entryIds?: string[]) => {
      setConfirmingId(null);
      deleteForever(entryIds, {
        onError: () => toast.error(localizeUi("ui.chat.messagetrash.deleteFailed")),
      });
    },
    [deleteForever, localizeUi],
  );
  const deleteEntry = useCallback(
    (entryId: string, confirmed: boolean) => {
      if (busyRef.current) return;
      if (confirmed) deleteEntries([entryId]);
      else setConfirmingId(entryId);
    },
    [deleteEntries],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-[var(--muted-foreground)]">
        <Spinner size="sm" />
        {localizeUi("ui.chat.chatmessagesearch.loading")}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 px-3 py-8 text-center text-sm text-[var(--muted-foreground)]">
        <p>{localizeUi("ui.chat.messagetrash.loadFailed")}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mari-chrome-control mari-chrome-control--small px-3"
        >
          {localizeUi("ui.chat.chatmessagesearch.tryAgain")}
        </button>
      </div>
    );
  }
  if (!entries || entries.length === 0) {
    return (
      <div className={EMPTY_CLASS}>
        <Trash2 size="1rem" className="mx-auto mb-2 opacity-60" />
        <p>{localizeUi("ui.chat.messagetrash.empty")}</p>
        <p className="mt-1 text-xs">
          {localizeUi("ui.chat.messagetrash.retention", { count: MESSAGE_TRASH_RETENTION_DAYS })}
        </p>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <p className="min-w-0 flex-1 text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.messagetrash.retention", { count: MESSAGE_TRASH_RETENTION_DAYS })}
        </p>
        {entries.length > 1 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => restoreEntries(entries.map((entry) => entry.id))}
            className={ICON_BUTTON_CLASS}
            title={localizeUi("ui.chat.messagetrash.restoreAll")}
          >
            <RotateCcw size="0.75rem" />
            {localizeUi("ui.chat.messagetrash.restoreAll")}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => (confirmingId === "all" ? deleteEntries() : setConfirmingId("all"))}
          className={cn(ICON_BUTTON_CLASS, confirmingId === "all" && "text-[var(--destructive)]")}
        >
          <Trash2 size="0.75rem" />
          {confirmingId === "all"
            ? localizeUi("ui.chat.messagetrash.confirmEmpty")
            : localizeUi("ui.chat.messagetrash.emptyTrash")}
        </button>
      </div>
      {/* Says why the rows pause while busy. It stays on the page, empty when idle, so screen readers announce
          it; it takes no space and floats over the dimmed rows wherever the list is scrolled. */}
      <div role="status" aria-live="polite" className="pointer-events-none sticky top-0 z-10 h-0">
        {busy && (
          <span className="absolute left-1/2 top-2 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-center text-xs font-medium text-[var(--foreground)] shadow-sm">
            {restoring ? localizeUi("ui.chat.messagetrash.restoring") : localizeUi("ui.chat.messagetrash.deleting")}
          </span>
        )}
      </div>
      <div aria-busy={busy} className="relative">
        {batches.slice(0, shownBatches).map((batch, index) => (
          <ChatTrashRowBatch
            key={index}
            entries={batch}
            // Only the batch holding the row waiting for a second click re-renders.
            confirmingId={confirmingId && batch.some((entry) => entry.id === confirmingId) ? confirmingId : null}
            speakerName={speakerName}
            localizeUi={localizeUi}
            onRestore={restoreEntry}
            onDelete={deleteEntry}
          />
        ))}
        {/* While busy, a cover dims and blocks the rows. Disabling thousands of row buttons instead
            restyles every row and freezes WebKit for seconds (#7210). */}
        {busy && <div aria-hidden className="absolute inset-0 cursor-progress bg-[var(--background)]/50" />}
      </div>
    </div>
  );
}
