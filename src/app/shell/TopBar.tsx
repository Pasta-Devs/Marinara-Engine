// ──────────────────────────────────────────────
// Layout: Mobile App Top Bar
// ──────────────────────────────────────────────
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useChat } from "../../features/catalog/chats/index";
import { useChatStore } from "../../shared/stores/chat.store";
import { useUIStore } from "../../shared/stores/ui.store";
import { getConnectedChatDisplayName, normalizeChatCharacterIds } from "../../shared/lib/chat-display";
import { useCharacterSummariesByIds, CharacterAvatarImage } from "../../features/catalog/characters/index";
import { useTopBarActions } from "../../shared/components/mobile-shell-actions";
import { cn } from "../../shared/lib/utils";

export function TopBar({
  professorMariOpen: _professorMariOpen = false,
  onOpenProfessorMari: _onOpenProfessorMari,
  onGoHome,
}: {
  professorMariOpen?: boolean;
  onOpenProfessorMari?: () => void;
  onGoHome?: () => void;
}) {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const activeChat = useChatStore((s) => s.activeChat);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const setTrackerPanelOpen = useUIStore((s) => s.setTrackerPanelOpen);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  // Load chat directly so TopBar doesn't have to wait for the chat surface to hydrate the store.
  const { data: queriedChat } = useChat(activeChatId);
  const chat = activeChat && activeChat.id === activeChatId ? activeChat : (queriedChat ?? null);

  const characterIds = useMemo(() => normalizeChatCharacterIds(chat?.characterIds), [chat?.characterIds]);
  const { data: characters } = useCharacterSummariesByIds(characterIds, characterIds.length > 0);
  const firstChar = characters?.[0];

  const { rightSlot } = useTopBarActions();
  const chatName = getConnectedChatDisplayName(chat);
  const showStatus = chat?.mode === "conversation";

  const extensions = (firstChar?.data?.extensions ?? {}) as Record<string, unknown>;
  const rawStatus = typeof extensions.conversationStatus === "string" ? extensions.conversationStatus : "";
  const status: "online" | "idle" | "dnd" | "offline" | undefined = showStatus
    ? rawStatus === "online" || rawStatus === "idle" || rawStatus === "dnd" || rawStatus === "offline"
      ? rawStatus
      : undefined
    : undefined;
  const activity = showStatus && typeof extensions.conversationActivity === "string" ? extensions.conversationActivity : "";

  const statusColor =
    status === "online"
      ? "bg-green-500"
      : status === "idle"
        ? "bg-yellow-500"
        : status === "dnd"
          ? "bg-red-500"
          : status === "offline"
            ? "bg-gray-400"
            : "";

  const [charPopup, setCharPopup] = useState<number | null>(null);

  const charStatusColor = (ext: Record<string, unknown>) => {
    if (!showStatus) return "";
    const s = ext.conversationStatus;
    return s === "online" ? "bg-green-500" : s === "idle" ? "bg-yellow-500" : s === "dnd" ? "bg-red-500" : s === "offline" ? "bg-gray-400" : "";
  };

  useEffect(() => {
    if (charPopup === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCharPopup(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [charPopup]);

  useEffect(() => {
    setCharPopup(null);
  }, [activeChatId]);

  const backFromChat = () => {
    setCharPopup(null);
    setActiveChatId(null);
    closeAllDetails();
    closeRightPanel();
    setTrackerPanelOpen(false);
    setSidebarOpen(false);
    onGoHome?.();
  };

  if (!activeChatId) return null;

  return (
    <header
      data-component="TopBar"
      className="mari-topbar relative z-30 flex h-[3.25rem] flex-shrink-0 items-center gap-2 px-2 md:hidden"
    >
      <button
        type="button"
        onClick={backFromChat}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-all active:scale-90 hover:text-[var(--foreground)]"
        title="Back"
        aria-label="Back"
      >
        <ArrowLeft size="1.15rem" aria-hidden />
      </button>

      {charPopup !== null && (
        <div className="fixed inset-0 z-40" onClick={() => setCharPopup(null)} aria-hidden />
      )}

      {chat?.mode !== "game" && (
        characters && characters.length > 1 ? (
          // Multi-char: stacked avatars with status dots, each clickable to show activity
          <div className="relative flex shrink-0 items-center" style={{ width: `${characters.length > 3 ? 92 : 20 * Math.min(characters.length, 3) + 12}px`, height: 32 }}>
            {characters.slice(0, 3).map((c, i) => {
              const ext = (c.data?.extensions ?? {}) as Record<string, unknown>;
              const dotColor = charStatusColor(ext);
              const cActivity = showStatus && typeof ext.conversationActivity === "string" ? ext.conversationActivity : "";
              const isOpen = charPopup === i;
              return (
                <div key={c.id ?? i} className="absolute top-0" style={{ left: i * 20, zIndex: isOpen ? 10 : 3 - i }}>
                  <button
                    type="button"
                    onClick={() => setCharPopup(isOpen ? null : i)}
                    className="relative block active:scale-90 transition-transform"
                    aria-label={c.data?.name ?? "Character"}
                  >
                    {c.avatarPath ? (
                      <CharacterAvatarImage
                        src={c.avatarPath}
                        avatarFilePath={c.avatarFilePath}
                        avatarFilename={c.avatarFilename}
                        alt={c.data?.name ?? ""}
                        className="h-8 w-8 rounded-xl object-cover ring-2 ring-[var(--background)]"
                        thumbnailSize={64}
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-[var(--muted-foreground)] ring-2 ring-[var(--background)]">
                        {(c.data?.name ?? "?")[0]?.toUpperCase()}
                      </div>
                    )}
                    {dotColor && (
                      <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-[1.5px] ring-[var(--background)]", dotColor)} />
                    )}
                  </button>
                  {isOpen && (
                    <div className="absolute left-1/2 top-full mt-1.5 z-50 min-w-[7rem] -translate-x-1/2 rounded-xl border border-[var(--border)]/60 bg-[var(--card)] px-3 py-2 shadow-lg backdrop-blur-xl">
                      <p className="text-[0.7rem] font-semibold text-[var(--foreground)] leading-tight">{c.data?.name}</p>
                      {cActivity && <p className="mt-0.5 text-[0.6rem] text-[var(--muted-foreground)]/70 leading-tight">{cActivity}</p>}
                    </div>
                  )}
                </div>
              );
            })}
            {characters.length > 3 && (
              <div
                className="absolute top-0 flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-[0.6rem] font-bold text-[var(--muted-foreground)] ring-2 ring-[var(--background)]"
                style={{ left: 3 * 20, zIndex: 0 }}
              >
                +{characters.length - 3}
              </div>
            )}
          </div>
        ) : firstChar ? (
          <div className="relative shrink-0">
            {firstChar.avatarPath ? (
              <CharacterAvatarImage
                src={firstChar.avatarPath}
                avatarFilePath={firstChar.avatarFilePath}
                avatarFilename={firstChar.avatarFilename}
                alt={firstChar.data?.name ?? ""}
                className="h-8 w-8 rounded-xl object-cover ring-1 ring-[var(--border)]/50"
                thumbnailSize={64}
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-[var(--muted-foreground)] ring-1 ring-[var(--border)]/50">
                {(firstChar.data?.name ?? chatName ?? "?")[0]?.toUpperCase()}
              </div>
            )}
            {status && (
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-[1.5px] ring-[var(--border)]",
                  statusColor,
                )}
              />
            )}
          </div>
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-[var(--muted-foreground)]">
            {(chatName || "?")[0]?.toUpperCase()}
          </div>
        )
      )}

      <div className="min-w-0 flex-1 truncate">
        <span className="block text-sm font-semibold text-[var(--foreground)] leading-tight">{chatName || "Chat"}</span>
        {activity && (!characters || characters.length <= 1) && (
          <span className="block text-[0.65rem] text-[var(--muted-foreground)]/60 leading-tight">{activity}</span>
        )}
      </div>

      {rightSlot && (
        <div className="flex items-center gap-0.5">
          {rightSlot}
        </div>
      )}
    </header>
  );
}
