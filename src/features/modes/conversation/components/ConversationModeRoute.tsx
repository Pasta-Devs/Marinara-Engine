import { useCallback, useMemo } from "react";
import { getChatDisplayName, parseChatMetadata } from "../../../../shared/lib/chat-display";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import {
  NewChatConnectionGate,
  useChatMetadataSync,
  useChatOverlays,
  useChatSurfaceData,
  useChatTimelineActions,
  useChatTranscriptShortcuts,
  useChatTtsAutoplay,
  useSpriteMetadataState,
} from "../../shared/chat-ui/index";
import { useDeleteChat } from "../../../catalog/chats/index";
import { ChatConversationSurface } from "./ChatConversationSurface";
import { CreatorNotesCssInjector } from "../../shared/chat-ui/index";

type ConversationModeRouteProps = {
  activeChatId: string;
};

export function ConversationModeRoute({ activeChatId }: ConversationModeRouteProps) {
  const messagesPerPage = useUIStore((state) => state.messagesPerPage);
  const setActiveChatId = useChatStore((state) => state.setActiveChatId);
  const pendingNewChatMode = useChatStore((state) => state.pendingNewChatMode);
  const deleteChat = useDeleteChat();
  const data = useChatSurfaceData({
    activeChatId,
    messagePageSize: messagesPerPage,
    fallbackChatMode: "conversation",
    personaFallback: "active-persona",
  });
  const { chatBackground } = useChatMetadataSync({
    chat: data.chat,
    chatMeta: data.chatMeta,
    messages: data.messages,
    messagePageCount: data.pageCount,
  });
  void chatBackground;

  const overlays = useChatOverlays(activeChatId);
  const spriteState = useSpriteMetadataState({ chat: data.chat, chatMeta: data.chatMeta, messages: data.messages });
  const { agentsEnabled, enabledAgentTypes, agentThoughtBubbleTypes } = useMemo(() => {
    const activeAgentIds = Array.isArray(data.chatMeta.activeAgentIds)
      ? data.chatMeta.activeAgentIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    const set = new Set<string>();
    for (const id of activeAgentIds) set.add(id.trim());
    const agentsEnabled = Boolean(data.chatMeta.enableAgents) || activeAgentIds.length > 0;
    return {
      agentsEnabled,
      enabledAgentTypes: agentsEnabled ? set : new Set<string>(),
      agentThoughtBubbleTypes: agentsEnabled && activeAgentIds.length === 0 ? undefined : set,
    };
  }, [data.chatMeta.activeAgentIds, data.chatMeta.enableAgents]);
  const timeline = useChatTimelineActions({
    activeChatId,
    messages: data.messages,
    messageIdByOrderIndex: data.messageIdByOrderIndex,
    enabledAgentTypes,
    refreshWorldStateOnTimelineChange: agentsEnabled,
  });
  const shortcutsBlocked =
    overlays.settingsOpen ||
    overlays.filesOpen ||
    overlays.galleryOpen ||
    overlays.wizardOpen ||
    overlays.spriteArrangeMode ||
    timeline.multiSelectMode ||
    Boolean(timeline.deleteDialogMessageId) ||
    Boolean(timeline.peekPromptData);
  useChatTranscriptShortcuts({
    activeChatId,
    blocked: shortcutsBlocked,
    isStreaming: timeline.isStreaming,
    agentProcessing: timeline.agentProcessing,
    latestAssistantMessageForSwipes: timeline.latestAssistantMessageForSwipes,
    latestMessageForEdit: timeline.latestMessageForEdit,
    onSetActiveSwipe: timeline.handleSetActiveSwipe,
    onRegenerate: timeline.handleRegenerate,
  });
  useChatTtsAutoplay({
    chatId: activeChatId,
    mode: "conversation",
    messages: data.messages,
    characterMap: data.characterMap,
    isStreaming: timeline.isStreaming,
  });

  const connectedChatId = (data.chat as unknown as { connectedChatId?: string | null } | null | undefined)
    ?.connectedChatId;
  const activeSceneChatId =
    typeof data.chatMeta.activeSceneChatId === "string" ? data.chatMeta.activeSceneChatId : null;
  const activeSceneChat = activeSceneChatId
    ? data.chatList.find((item) => item.id === activeSceneChatId)
    : undefined;
  const activeSceneMeta = parseChatMetadata(activeSceneChat?.metadata);
  const hasActiveLinkedScene = activeSceneChat && activeSceneMeta.sceneStatus === "active";
  const sceneInfo =
    activeSceneChatId && hasActiveLinkedScene
      ? {
          variant: "origin" as const,
          sceneChatId: activeSceneChatId,
          sceneChatName: getChatDisplayName(activeSceneChat),
        }
      : undefined;
  const handleCancelNewConversationSetup = useCallback(() => {
    const cancellingChatId = activeChatId;
    overlays.setWizardOpen(false);
    void deleteChat
      .mutateAsync(cancellingChatId)
      .then(() => {
        if (useChatStore.getState().activeChatId === cancellingChatId) setActiveChatId(null);
      })
      .catch(() => {
        if (useChatStore.getState().activeChatId === cancellingChatId) overlays.setWizardOpen(true);
      });
  }, [activeChatId, deleteChat, overlays, setActiveChatId]);

  const cardCssMode = (() => {
    const mode = data.chatMeta.cardCssMode;
    if (mode === "disabled" || mode === "exclusive") return mode;
    return "chat" as const;
  })();

  return (
    <>
      <CreatorNotesCssInjector
        allCharacters={data.allCharacters}
        characterIds={data.chatCharIds}
        mode={cardCssMode}
        chatMode="conversation"
      />
      <ChatConversationSurface
        activeChatId={activeChatId}
        chat={data.chat}
        messages={data.messages}
        isLoading={data.isLoading}
        hasNextPage={!!data.hasNextPage}
        isFetchingNextPage={data.isFetchingNextPage}
        fetchNextPage={data.fetchNextPage}
        pageCount={data.pageCount}
        totalMessageCount={data.totalMessageCount}
        characterMap={data.characterMap}
        characterNames={data.characterNames}
        personaInfo={data.personaInfo}
        chatMeta={data.chatMeta}
        chatCharIds={data.chatCharIds}
        enabledAgentTypes={agentThoughtBubbleTypes}
        connectedChatName={data.connectedChatName}
        sceneInfo={sceneInfo}
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
        selectedMessageIds={timeline.selectedMessageIds}
        spriteArrangeMode={overlays.spriteArrangeMode}
        onDelete={timeline.handleDelete}
        onRegenerate={timeline.handleRegenerate}
        onEdit={timeline.handleEdit}
        onSetActiveSwipe={timeline.handleSetActiveSwipe}
        onPeekPrompt={timeline.handlePeekPrompt}
        onToggleHiddenFromAI={timeline.handleToggleHiddenFromAI}
        onToggleSelectMessage={timeline.handleToggleSelectMessage}
        onSwitchChat={connectedChatId ? () => setActiveChatId(connectedChatId) : undefined}
        onOpenSettings={overlays.openSettings}
        onOpenFiles={overlays.openFiles}
        onOpenGallery={overlays.openGallery}
        onCloseSettings={overlays.closeSettings}
        onCloseFiles={overlays.closeFiles}
        onCloseGallery={overlays.closeGallery}
        onIllustrate={timeline.handleIllustrate}
        onWizardFinish={overlays.finishWizard}
        onWizardCancel={handleCancelNewConversationSetup}
        onClosePeekPrompt={timeline.closePeekPrompt}
        onResetSpritePlacements={spriteState.handleResetSpritePlacements}
        onSpriteSideChange={spriteState.handleSetSpritePosition}
        onToggleSpriteArrange={overlays.toggleSpriteArrange}
        onDeleteConfirm={timeline.handleDeleteConfirm}
        onDeleteSwipe={timeline.handleDeleteSwipe}
        onDeleteMore={timeline.handleDeleteMore}
        onCloseDeleteDialog={timeline.closeDeleteDialog}
        onBulkDelete={timeline.handleBulkDelete}
        onCancelMultiSelect={timeline.handleCancelMultiSelect}
        onUnselectAllMessages={timeline.handleUnselectAllMessages}
        onSelectAllAboveSelection={timeline.handleSelectAllAboveSelection}
        onSelectAllBelowSelection={timeline.handleSelectAllBelowSelection}
        lastAssistantMessageId={timeline.lastAssistantMessageId}
      />
      {pendingNewChatMode && (
        <NewChatConnectionGate
          mode={pendingNewChatMode}
          onClose={() => useChatStore.getState().setPendingNewChatMode(null)}
        />
      )}
    </>
  );
}
