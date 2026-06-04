import { useCallback, useMemo } from "react";
import { getChatDisplayName, parseChatMetadata } from "../../../../shared/lib/chat-display";
import { extractCreatorNotesCss } from "../../../../shared/lib/creator-notes-css";
import { cssTargetsTypingIndicator, filterCssByMode } from "../../../../shared/lib/chat-css";
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
  isEmptyNewChatSetup,
} from "../../shared/chat-ui/index";
import { useDeleteChat } from "../../../catalog/chats/index";
import { ChatConversationSurface } from "./ChatConversationSurface";
import { CreatorNotesCssInjector } from "../../shared/chat-ui/index";
import { useConversationAvatarOverrides } from "../hooks/use-conversation-avatar-overrides";

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
  const conversationCharacterMap = useConversationAvatarOverrides(data.characterMap);
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
    const agentsEnabled = activeAgentIds.length > 0;
    return {
      agentsEnabled,
      enabledAgentTypes: agentsEnabled ? set : new Set<string>(),
      agentThoughtBubbleTypes: set,
    };
  }, [data.chatMeta.activeAgentIds]);
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
    characterMap: conversationCharacterMap,
    isStreaming: timeline.isStreaming,
  });

  const connectedChatId = (data.chat as unknown as { connectedChatId?: string | null } | null | undefined)
    ?.connectedChatId;
  const activeSceneChatId =
    typeof data.chatMeta.activeSceneChatId === "string" ? data.chatMeta.activeSceneChatId : null;
  const activeSceneChat = activeSceneChatId ? data.chatList.find((item) => item.id === activeSceneChatId) : undefined;
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
        overlays.clearNewChatSetup();
        if (useChatStore.getState().activeChatId === cancellingChatId) setActiveChatId(null);
      })
      .catch(() => {
        if (useChatStore.getState().activeChatId === cancellingChatId) overlays.setWizardOpen(true);
      });
  }, [activeChatId, deleteChat, overlays, setActiveChatId]);

  const handleFinishNewConversationSetup = useCallback(() => {
    if (
      isEmptyNewChatSetup({
        activeChatId,
        setupChatId: overlays.newChatSetupChatId,
        chatCharIds: data.chatCharIds,
        totalMessageCount: data.totalMessageCount,
        messagesLoaded: data.messages !== undefined,
      })
    ) {
      handleCancelNewConversationSetup();
      return;
    }
    overlays.finishWizard();
  }, [
    activeChatId,
    data.chatCharIds,
    data.messages,
    data.totalMessageCount,
    handleCancelNewConversationSetup,
    overlays,
  ]);

  const cardCssMode = (() => {
    const mode = data.chatMeta.cardCssMode;
    if (mode === "disabled" || mode === "exclusive") return mode;
    return "chat" as const;
  })();

  // Which active characters carry card CSS that targets the typing indicator? Their typing
  // row is rendered separately (so per-character text/styling applies in isolation) instead
  // of being merged into the combined "A, B are typing…" row. This only differentiates in
  // exclusive mode — chat mode scopes all card CSS to the shared `.mari-card-css`, so a typing
  // rule would apply to every row identically and splitting would be meaningless.
  const typingStyledCharacterIds = useMemo(() => {
    const set = new Set<string>();
    if (cardCssMode !== "exclusive" || !data.allCharacters) return set;
    const byId = new Map(data.allCharacters.map((c) => [c.id, c]));
    for (const id of data.chatCharIds) {
      const row = byId.get(id);
      if (!row) continue;
      let parsed: Record<string, unknown>;
      try {
        const raw = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        parsed = raw as Record<string, unknown>;
      } catch {
        continue;
      }
      const notes = parsed.creator_notes;
      if (typeof notes !== "string" || !notes) continue;
      const { css } = extractCreatorNotesCss(notes);
      if (css && cssTargetsTypingIndicator(filterCssByMode(css, "conversation"))) set.add(id);
    }
    return set;
  }, [cardCssMode, data.allCharacters, data.chatCharIds]);

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
        characterMap={conversationCharacterMap}
        characterNames={data.characterNames}
        personaInfo={data.personaInfo}
        chatMeta={data.chatMeta}
        chatCharIds={data.chatCharIds}
        typingStyledCharacterIds={typingStyledCharacterIds}
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
        onBranch={timeline.handleBranch}
        onToggleSelectMessage={timeline.handleToggleSelectMessage}
        onSwitchChat={connectedChatId ? () => setActiveChatId(connectedChatId) : undefined}
        onOpenSettings={overlays.openSettings}
        onOpenFiles={overlays.openFiles}
        onOpenGallery={overlays.openGallery}
        onCloseSettings={overlays.closeSettings}
        onCloseFiles={overlays.closeFiles}
        onCloseGallery={overlays.closeGallery}
        onIllustrate={timeline.handleIllustrate}
        onWizardFinish={handleFinishNewConversationSetup}
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
