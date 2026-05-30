import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import type { Chat as EngineChat } from "../../../../engine/contracts/types/chat";
import { useUIStore } from "../../../../shared/stores/ui.store";
import {
  ChatCommonOverlays,
  useChatMetadataSync,
  useChatOverlays,
  useChatSurfaceData,
  useChatTimelineActions,
  useSpriteMetadataState,
} from "../../shared/chat-ui/index";
import { GameSurface } from "./GameSurface";

interface GameConversationViewProps {
  activeChatId: string;
}

function GameChatHydrationState({
  status,
  onRetry,
}: {
  status: "loading" | "error";
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden bg-[var(--background)] px-4 dark:bg-black/90">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        {status === "loading" ? (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--muted)]/40 border-t-[var(--foreground)]/70 dark:border-white/20 dark:border-t-white/70" />
        ) : (
          <RefreshCw size="1.25rem" className="text-[var(--muted-foreground)]" />
        )}
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {status === "loading" ? "Loading game chat..." : "Game chat could not load"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {status === "loading"
              ? "Restoring the saved game surface."
              : "Retry loading the chat before leaving the game surface."}
          </p>
        </div>
        {status === "error" && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/35"
          >
            <RefreshCw size="0.75rem" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function GameConversationView({ activeChatId }: GameConversationViewProps) {
  const messagesPerPage = useUIStore((state) => state.messagesPerPage);
  const data = useChatSurfaceData({
    activeChatId,
    messagePageSize: messagesPerPage,
    fallbackChatMode: "game",
    personaFallback: "none",
  });
  const { chatBackground } = useChatMetadataSync({
    chat: data.chat,
    chatMeta: data.chatMeta,
    messages: data.messages,
    messagePageCount: data.pageCount,
  });
  const overlays = useChatOverlays(activeChatId);
  const spriteState = useSpriteMetadataState({ chat: data.chat, chatMeta: data.chatMeta, messages: data.messages });
  const timeline = useChatTimelineActions({
    activeChatId,
    messages: data.messages,
    messageIdByOrderIndex: data.messageIdByOrderIndex,
    refreshWorldStateOnTimelineChange: true,
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage, loadedMessageCount, totalMessageCount } = data;

  useEffect(() => {
    if (loadedMessageCount <= 0) return;
    if (totalMessageCount <= loadedMessageCount) return;
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, loadedMessageCount, totalMessageCount]);

  if (!data.chat) {
    if (data.chatError) {
      return <GameChatHydrationState status="error" onRetry={() => void data.refetchChat()} />;
    }
    return <GameChatHydrationState status="loading" />;
  }

  return (
    <>
      <GameSurface
        activeChatId={activeChatId}
        chat={data.chat as unknown as EngineChat}
        chatMeta={data.chatMeta}
        messages={data.messages ?? []}
        isStreaming={timeline.isStreaming}
        isMessagesLoading={data.isLoading}
        characterMap={data.characterMap}
        characters={data.gameCharacters}
        personaInfo={data.personaInfo}
        chatBackground={chatBackground}
        onOpenSettings={overlays.openSettings}
        onDeleteMessage={timeline.handleDelete}
        multiSelectMode={timeline.multiSelectMode}
        selectedMessageIds={timeline.selectedMessageIds}
      />

      <ChatCommonOverlays
        chat={data.chat}
        activeChatId={activeChatId}
        settingsOpen={overlays.settingsOpen}
        filesOpen={overlays.filesOpen}
        galleryOpen={overlays.galleryOpen}
        wizardOpen={overlays.wizardOpen}
        peekPromptData={timeline.peekPromptData}
        deleteDialogMessageId={timeline.deleteDialogMessageId}
        deleteDialogCanDeleteSwipe={timeline.deleteDialogCanDeleteSwipe}
        deleteDialogActiveSwipeIndex={timeline.deleteDialogActiveSwipeIndex}
        deleteDialogSwipeCount={timeline.deleteDialogSwipeCount}
        multiSelectMode={timeline.multiSelectMode}
        selectedMessageCount={timeline.selectedMessageIds.size}
        sceneSettings={{
          spriteArrangeMode: overlays.spriteArrangeMode,
          onToggleSpriteArrange: overlays.toggleSpriteArrange,
          onResetSpritePlacements: spriteState.handleResetSpritePlacements,
          onSpriteSideChange: spriteState.handleSetSpritePosition,
        }}
        onCloseSettings={overlays.closeSettings}
        onCloseFiles={overlays.closeFiles}
        onCloseGallery={overlays.closeGallery}
        onIllustrate={timeline.handleIllustrate}
        onWizardFinish={overlays.finishWizard}
        onClosePeekPrompt={timeline.closePeekPrompt}
        onDeleteConfirm={timeline.handleDeleteConfirm}
        onDeleteSwipe={timeline.handleDeleteSwipe}
        onDeleteMore={timeline.handleDeleteMore}
        onCloseDeleteDialog={timeline.closeDeleteDialog}
        onBulkDelete={timeline.handleBulkDelete}
        onCancelMultiSelect={timeline.handleCancelMultiSelect}
        onUnselectAllMessages={timeline.handleUnselectAllMessages}
        onSelectAllAboveSelection={timeline.handleSelectAllAboveSelection}
        onSelectAllBelowSelection={timeline.handleSelectAllBelowSelection}
      />
    </>
  );
}
