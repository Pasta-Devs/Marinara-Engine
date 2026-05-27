import { useEffect } from "react";
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

type GameModeRouteProps = {
  activeChatId: string;
};

export function GameModeRoute({ activeChatId }: GameModeRouteProps) {
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

  useEffect(() => {
    if (data.loadedMessageCount <= 0) return;
    if (data.totalMessageCount <= data.loadedMessageCount) return;
    void data.refetchMessages();
  }, [data.loadedMessageCount, data.refetchMessages, data.totalMessageCount]);

  if (!data.chat) return <div className="flex flex-1 overflow-hidden" />;

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
