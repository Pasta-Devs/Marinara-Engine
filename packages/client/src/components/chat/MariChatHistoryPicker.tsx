// #5073: Chat-history picker for Professor Mari. Pick one of the user's chats (searchable,
// most-recent first), choose ALL / a RANGE / the LAST N messages, and attach the selected messages
// as a JSON reference-context item Mari can read. Self-contained modal (createPortal), like
// MariPromptPreviewModal.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, X } from "lucide-react";
import type { Chat, Character, Message } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { useChats } from "../../hooks/use-chats";
import { useCharacters } from "../../hooks/use-characters";
import { useAddMariWorkspaceContext } from "../../hooks/use-mari-workspace-context";
import { useModalFocusTrap } from "../../hooks/use-modal-focus-trap";

// Server cap (MAX_CONTEXT_ITEM_CONTENT_LENGTH). Warn + block before the request when a selection
// exceeds it, instead of surfacing a 400.
const MAX_CONTENT_CHARS = 200_000;
// Rough token estimate for the cost hint (~4 chars/token). Not exact — just steers the user toward
// Last-N / a range before they blow the context window.
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

type SelectionMode = "all" | "last" | "range";

interface TranscriptRow {
  role: string;
  name: string;
  content: string;
  at: string;
}

function messageExtra(message: Message): Record<string, unknown> {
  const raw = (message as { extra?: unknown }).extra;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

// Drop system join/leave events and messages hidden from the model or the user, so the attached
// transcript is what the user actually reads.
function visibleMessages(messages: Message[]): Message[] {
  return messages.filter((message) => {
    if (message.role === "system") return false;
    const extra = messageExtra(message);
    if (extra.hiddenFromAI === true || extra.hiddenFromUser === true) return false;
    return typeof message.content === "string" && message.content.trim().length > 0;
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** The Professor Mari workspace chat the attached context belongs to. */
  workspaceChatId: string;
}

export function MariChatHistoryPicker({ open, onClose, workspaceChatId }: Props) {
  const { t: localizeUi } = useTranslation();
  const { data: chats } = useChats();
  const { data: characters } = useCharacters();
  const addContext = useAddMariWorkspaceContext();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Chat | null>(null);
  const [mode, setMode] = useState<SelectionMode>("last");
  const [lastN, setLastN] = useState(20);
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(20);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // Monotonic token bumped on every selection / Back / open / close. A fetch whose token is stale is
  // ignored — including re-selecting the SAME chat (which a chat-id check alone would not catch).
  const requestTokenRef = useRef(0);
  const dialogRef = useModalFocusTrap<HTMLDivElement>(open, onClose);

  // Reset transient state whenever the modal is (re)opened, and discard any in-flight /messages fetch
  // when it closes so a late response can't touch hidden state and flash a stale selection on reopen.
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelected(null);
    setMode("last");
    setLastN(20);
    setRangeFrom(1);
    setRangeTo(20);
    setMessages(null);
    requestTokenRef.current += 1;
    return () => {
      requestTokenRef.current += 1;
    };
  }, [open]);

  const characterNameById = useMemo(() => {
    const map = new Map<string, string>();
    // useCharacters() types its rows loosely ({ id?: unknown }); the runtime shape is full characters.
    for (const character of (characters ?? []) as Character[]) {
      const name = character.data?.name?.trim();
      if (name) map.set(character.id, name);
    }
    return map;
  }, [characters]);

  const chatCharacterNames = useCallback(
    (chat: Chat): string =>
      chat.characterIds
        .map((id) => characterNameById.get(id) ?? "")
        .filter(Boolean)
        .join(", "),
    [characterNameById],
  );

  const sortedChats = useMemo(() => {
    const recency = (chat: Chat) => chat.lastMessageAt ?? chat.updatedAt ?? chat.createdAt ?? "";
    const query = search.trim().toLowerCase();
    return [...(chats ?? [])]
      .filter((chat) => {
        if (!query) return true;
        return `${chat.name} ${chatCharacterNames(chat)}`.toLowerCase().includes(query);
      })
      .sort((a, b) => String(recency(b)).localeCompare(String(recency(a))));
  }, [chats, search, chatCharacterNames]);

  const selectChat = useCallback(
    async (chat: Chat) => {
      setSelected(chat);
      setMessages(null);
      setLoadingMessages(true);
      const token = (requestTokenRef.current += 1);
      try {
        const rows = await api.get<Message[]>(`/chats/${chat.id}/messages`);
        if (requestTokenRef.current !== token) return; // superseded by a newer selection, Back, or close
        setMessages(rows);
      } catch {
        if (requestTokenRef.current !== token) return;
        toast.error(localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryLoadFailed"));
        setMessages([]);
      } finally {
        if (requestTokenRef.current === token) setLoadingMessages(false);
      }
    },
    [localizeUi],
  );

  const visible = useMemo(() => (messages ? visibleMessages(messages) : []), [messages]);
  const total = visible.length;

  // The actual 1-based range used, clamped to [1, total]. Shared by the slice AND the persisted label
  // so the label can't claim more than was attached (e.g. "last 20" on a 5-message chat).
  const clampedRange = useMemo(() => {
    const from = Math.max(1, Math.min(rangeFrom, Math.max(1, total)));
    const to = Math.max(from, Math.min(rangeTo, Math.max(1, total)));
    return { from, to };
  }, [rangeFrom, rangeTo, total]);

  const selectedRows = useMemo((): TranscriptRow[] => {
    let slice = visible;
    if (mode === "last") slice = visible.slice(-Math.max(1, lastN));
    else if (mode === "range") slice = visible.slice(clampedRange.from - 1, clampedRange.to);
    return slice.map((message) => ({
      role: message.role,
      name:
        message.role === "user"
          ? "User"
          : message.characterId
            ? (characterNameById.get(message.characterId) ?? "Character")
            : "Narrator",
      content: typeof message.content === "string" ? message.content : String(message.content ?? ""),
      at: message.createdAt,
    }));
  }, [visible, mode, lastN, clampedRange, characterNameById]);

  const contentJson = useMemo(() => JSON.stringify(selectedRows), [selectedRows]);
  const tokenEstimate = estimateTokens(contentJson);
  const overCap = contentJson.length > MAX_CONTENT_CHARS;

  const modeLabel = useMemo(() => {
    if (mode === "all") return localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryAll");
    if (mode === "range")
      return localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryRangeLabel", {
        from: clampedRange.from,
        to: clampedRange.to,
      });
    return localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryLastLabel", { count: selectedRows.length });
  }, [mode, clampedRange, selectedRows.length, localizeUi]);

  const handleAttach = useCallback(async () => {
    if (!selected || selectedRows.length === 0 || overCap) return;
    try {
      // Keep the composed label under the server's 200-char cap even for very long chat names, so a
      // long name doesn't turn into an opaque request rejection.
      const safeName = selected.name.length > 150 ? `${selected.name.slice(0, 149)}…` : selected.name;
      await addContext.mutateAsync({
        chatId: workspaceChatId,
        kind: "chat_history",
        label: `${safeName} — ${modeLabel}`,
        sourceChatId: selected.id,
        content: contentJson,
        tokenEstimate,
      });
      toast.success(localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryAttached"));
      onClose();
    } catch {
      toast.error(localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryAttachFailed"));
    }
  }, [
    selected,
    selectedRows.length,
    overCap,
    addContext,
    workspaceChatId,
    modeLabel,
    contentJson,
    tokenEstimate,
    localizeUi,
    onClose,
  ]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal
      aria-label={localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryTitle")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl outline-none"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          {selected && (
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                requestTokenRef.current += 1;
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              aria-label={localizeUi("navigation.common.back")}
            >
              <ArrowLeft size="1rem" />
            </button>
          )}
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--foreground)]">
            {selected ? selected.name : localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label={localizeUi("navigation.common.close")}
          >
            <X size="1rem" />
          </button>
        </div>

        {!selected ? (
          <>
            <div className="border-b border-[var(--border)] p-3">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5">
                <Search size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={localizeUi("ui.chat.homeprofessormarichat.attachChatHistorySearch")}
                  className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {sortedChats.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryNoChats")}
                </p>
              ) : (
                sortedChats.map((chat) => {
                  const names = chatCharacterNames(chat);
                  return (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => void selectChat(chat)}
                      className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]"
                    >
                      <span className="truncate text-sm font-medium text-[var(--foreground)]">{chat.name}</span>
                      {names && <span className="truncate text-xs text-[var(--muted-foreground)]">{names}</span>}
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
                <Loader2 size="1rem" className="animate-spin" />
                {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryLoading")}
              </div>
            ) : total === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryEmpty")}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryMessageCount", { count: total })}
                </p>
                <div className="flex flex-col gap-2">
                  {(["all", "last", "range"] as SelectionMode[]).map((option) => (
                    <label
                      key={option}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        mode === option
                          ? "border-[var(--primary)]/60 bg-[var(--primary)]/10 text-[var(--foreground)]"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                      )}
                    >
                      <input
                        type="radio"
                        name="mari-chat-history-mode"
                        checked={mode === option}
                        onChange={() => setMode(option)}
                        className="accent-[var(--primary)]"
                      />
                      {option === "all" && localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryAll")}
                      {option === "last" && (
                        <span className="flex items-center gap-1.5">
                          {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryLastPrefix")}
                          <input
                            type="number"
                            min={1}
                            max={total}
                            value={lastN}
                            onFocus={() => setMode("last")}
                            onChange={(event) => setLastN(Math.max(1, Number(event.target.value) || 1))}
                            className="w-16 rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-center text-sm text-[var(--foreground)] outline-none"
                          />
                          {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryLastSuffix")}
                        </span>
                      )}
                      {option === "range" && (
                        <span className="flex items-center gap-1.5">
                          {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryRangePrefix")}
                          <input
                            type="number"
                            min={1}
                            max={total}
                            value={rangeFrom}
                            onFocus={() => setMode("range")}
                            onChange={(event) => setRangeFrom(Math.max(1, Number(event.target.value) || 1))}
                            className="w-14 rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-center text-sm text-[var(--foreground)] outline-none"
                          />
                          {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryRangeTo")}
                          <input
                            type="number"
                            min={1}
                            max={total}
                            value={rangeTo}
                            onFocus={() => setMode("range")}
                            onChange={(event) => setRangeTo(Math.max(1, Number(event.target.value) || 1))}
                            className="w-14 rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-center text-sm text-[var(--foreground)] outline-none"
                          />
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span>
                    {localizeUi("ui.chat.homeprofessormarichat.attachChatHistorySelectedCount", {
                      count: selectedRows.length,
                    })}
                  </span>
                  <span className={cn(overCap && "font-semibold text-[var(--destructive)]")}>
                    {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryTokenEstimate", {
                      count: tokenEstimate,
                    })}
                  </span>
                </div>
                {overCap && (
                  <p className="text-xs text-[var(--destructive)]">
                    {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryTooLarge")}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void handleAttach()}
                  disabled={selectedRows.length === 0 || overCap || addContext.isPending}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-all active:scale-95",
                    (selectedRows.length === 0 || overCap || addContext.isPending) && "cursor-not-allowed opacity-50",
                  )}
                >
                  {addContext.isPending && <Loader2 size="0.875rem" className="animate-spin" />}
                  {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryAttach")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
