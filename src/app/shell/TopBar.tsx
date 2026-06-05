// ──────────────────────────────────────────────
// Layout: Mobile App Top Bar
// ──────────────────────────────────────────────
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { useChat } from "../../features/catalog/chats/index";
import { useChatStore } from "../../shared/stores/chat.store";
import { useUIStore } from "../../shared/stores/ui.store";
import { getConnectedChatDisplayName, normalizeChatCharacterIds } from "../../shared/lib/chat-display";
import { useCharacterSummariesByIds } from "../../features/catalog/characters/hooks/use-characters";
import { CharacterAvatarImage } from "../../features/catalog/characters/components/CharacterAvatarImage";
import { useTopBarActions } from "./TopBarActionsContext";
import { cn } from "../../shared/lib/utils";

export function TopBar({
  professorMariOpen: _professorMariOpen = false,
  onOpenProfessorMari: _onOpenProfessorMari,
  onGoHome: _onGoHome,
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

  // Load chat directly so TopBar doesn't have to wait for the chat surface to hydrate the store.
  const { data: queriedChat } = useChat(activeChatId);
  const chat = activeChat ?? queriedChat ?? null;

  const characterIds = useMemo(() => normalizeChatCharacterIds(chat?.characterIds), [chat?.characterIds]);
  const { data: characters } = useCharacterSummariesByIds(characterIds, characterIds.length > 0);
  const firstChar = characters?.[0];

  const backFromChat = () => {
    setActiveChatId(null);
    closeAllDetails();
    closeRightPanel();
    setTrackerPanelOpen(false);
  };

  if (!activeChatId) return null;

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

      {firstChar ? (
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
      )}

      <div className="min-w-0 flex-1 truncate">
        <span className="block text-sm font-semibold text-[var(--foreground)] leading-tight">{chatName || "Chat"}</span>
        {activity && (
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
