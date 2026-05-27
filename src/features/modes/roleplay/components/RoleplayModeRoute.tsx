import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useEncounterStore } from "../../../../shared/stores/encounter.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { spriteApi } from "../../../../shared/api/image-generation-api";
import { spriteKeys, type SpriteInfo } from "../../../catalog/characters/index";
import {
  type ExpressionAvatarResolver,
  type MessageWithSwipes,
  NewChatConnectionGate,
  useChatMetadataSync,
  useChatOverlays,
  useChatSurfaceData,
  useChatTimelineActions,
  useChatTranscriptShortcuts,
  useChatTtsAutoplay,
  useSpriteMetadataState,
} from "../../shared/chat-ui/index";
import { useEncounter } from "../encounter/hooks/use-encounter";
import { useAgentInjectionReview } from "../hooks/use-agent-injection-review";
import { useRoleplayTranscriptScroll } from "../hooks/use-roleplay-transcript-scroll";
import { useScene } from "../hooks/use-scene";
import { AgentInjectionReviewModal } from "./AgentInjectionReviewModal";
import { ChatRoleplaySurface } from "./ChatRoleplaySurface";

type RoleplayModeRouteProps = {
  activeChatId: string;
  fallbackChatMode?: "roleplay" | "visual_novel";
};

function parseMessageExtraRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeMessageSpriteExpressions(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const expressions: Record<string, string> = {};
  for (const [key, expression] of Object.entries(value as Record<string, unknown>)) {
    if (typeof expression !== "string") continue;
    const trimmed = expression.trim();
    if (key && trimmed) expressions[key] = trimmed;
  }
  return expressions;
}

function resolveExpressionAvatarSpriteUrl(sprites: SpriteInfo[] | undefined, expression: string): string | null {
  const normalizedExpression = expression.trim().toLowerCase();
  if (!normalizedExpression) return null;
  const exact = (sprites ?? []).find(
    (sprite) =>
      !sprite.expression.toLowerCase().startsWith("full_") &&
      sprite.expression.trim().toLowerCase() === normalizedExpression,
  );
  return exact?.url ?? null;
}

export function RoleplayModeRoute({ activeChatId, fallbackChatMode = "roleplay" }: RoleplayModeRouteProps) {
  const messagesPerPage = useUIStore((state) => state.messagesPerPage);
  const centerCompact = useUIStore((state) => state.centerCompact);
  const weatherEffects = useUIStore((state) => state.weatherEffects);
  const pendingNewChatMode = useChatStore((state) => state.pendingNewChatMode);
  const overlays = useChatOverlays(activeChatId);
  const data = useChatSurfaceData({
    activeChatId,
    messagePageSize: messagesPerPage,
    fallbackChatMode,
    personaFallback: "active-persona",
  });
  const { chatBackground, updateMeta } = useChatMetadataSync({
    chat: data.chat,
    chatMeta: data.chatMeta,
    messages: data.messages,
    messagePageCount: data.pageCount,
  });

  const enabledAgentTypes = useMemo(() => {
    const set = new Set<string>();
    const activeAgentIds: string[] = Array.isArray(data.chatMeta.activeAgentIds) ? data.chatMeta.activeAgentIds : [];
    if (!data.chatMeta.enableAgents && activeAgentIds.length === 0) return set;
    for (const id of activeAgentIds) set.add(id);
    return set;
  }, [data.chatMeta.activeAgentIds, data.chatMeta.enableAgents]);
  const agentsUiEnabled = Boolean(data.chatMeta.enableAgents) || enabledAgentTypes.size > 0;
  const expressionAgentEnabled = enabledAgentTypes.has("expression");
  const combatAgentEnabled = enabledAgentTypes.has("combat");
  const timeline = useChatTimelineActions({
    activeChatId,
    messages: data.messages,
    messageIdByOrderIndex: data.messageIdByOrderIndex,
    enabledAgentTypes,
    refreshWorldStateOnTimelineChange: agentsUiEnabled,
  });
  const spriteState = useSpriteMetadataState({ chat: data.chat, chatMeta: data.chatMeta, messages: data.messages });
  const { startEncounter } = useEncounter();
  const { concludeScene, abandonScene, forkScene, isForking } = useScene();
  const encounterActive = useEncounterStore((state) => state.active || state.showConfigModal);
  const { request, drafts, onDraftChange, onContinue, onClose } = useAgentInjectionReview();

  const summaryContextSize: number = (data.chatMeta.summaryContextSize as number) ?? 50;
  const handleSummaryContextSizeChange = useCallback(
    (size: number) => {
      if (data.chat?.id) updateMeta.mutate({ id: data.chat.id, summaryContextSize: size });
    },
    [data.chat?.id, updateMeta],
  );

  const scroll = useRoleplayTranscriptScroll({
    activeChatId,
    messages: data.messages,
    pageCount: data.pageCount,
    msgData: data.msgData,
    hasNextPage: !!data.hasNextPage,
    isFetchingNextPage: data.isFetchingNextPage,
    fetchNextPage: data.fetchNextPage,
    isStreaming: timeline.isStreaming,
    totalMessageCount: data.totalMessageCount,
    messageOffset: data.messageOffset,
    messageIdByOrderIndex: data.messageIdByOrderIndex,
  });

  const shortcutsBlocked =
    overlays.settingsOpen ||
    overlays.filesOpen ||
    overlays.galleryOpen ||
    overlays.wizardOpen ||
    overlays.spriteArrangeMode ||
    timeline.multiSelectMode ||
    Boolean(timeline.deleteDialogMessageId) ||
    Boolean(timeline.peekPromptData) ||
    encounterActive;
  useChatTranscriptShortcuts({
    activeChatId,
    blocked: shortcutsBlocked,
    isStreaming: timeline.isStreaming,
    agentProcessing: timeline.agentProcessing,
    latestAssistantMessageForSwipes: timeline.latestAssistantMessageForSwipes,
    latestMessageForEdit: timeline.latestMessageForEdit,
    touchSurfaceRef: scroll.scrollRef,
    onSetActiveSwipe: timeline.handleSetActiveSwipe,
    onRegenerate: timeline.handleRegenerate,
  });
  useChatTtsAutoplay({
    chatId: activeChatId,
    mode: data.chatMode === "visual_novel" ? "visual_novel" : "roleplay",
    messages: data.messages,
    characterMap: data.characterMap,
    isStreaming: timeline.isStreaming,
  });

  const hasAnimatedRef = useRef(false);
  useEffect(() => {
    hasAnimatedRef.current = false;
  }, [activeChatId]);
  const shouldAnimateMessages = !hasAnimatedRef.current;
  if (data.messages?.length) hasAnimatedRef.current = true;

  const groupChatMode: string | undefined =
    data.chatCharIds.length > 1 ? (data.chatMeta.groupChatMode ?? "merged") : undefined;
  const msgPayload = (data.messages ?? []).map((message) => ({
    role: message.role,
    characterId: message.characterId,
    content: message.content,
  }));
  const isSceneChat = data.chatMeta.sceneStatus === "active" || Boolean(data.chatMeta.sceneOriginChatId);
  const isRoleplay = data.chatMode === "roleplay" || data.chatMode === "visual_novel";
  const expressionAvatarsEnabled =
    isRoleplay && data.chatMeta.expressionAvatarsEnabled === true && expressionAgentEnabled && data.chatCharIds.length > 0;
  const expressionAvatarCharacterIds = useMemo(() => {
    const configuredIds =
      spriteState.spriteCharacterIds.length > 0
        ? spriteState.spriteCharacterIds.filter((id) => data.chatCharIds.includes(id))
        : data.chatCharIds;
    return Array.from(new Set(configuredIds.filter((id) => typeof id === "string" && id.trim())));
  }, [data.chatCharIds, spriteState.spriteCharacterIds]);
  const expressionAvatarSpriteQueries = useQueries({
    queries: expressionAvatarCharacterIds.map((characterId) => ({
      queryKey: spriteKeys.list(characterId),
      queryFn: () => spriteApi.list<SpriteInfo[]>(characterId),
      enabled: expressionAvatarsEnabled,
      staleTime: 5 * 60_000,
    })),
  });
  const expressionAvatarSpriteMap = useMemo(() => {
    const map = new Map<string, SpriteInfo[]>();
    expressionAvatarCharacterIds.forEach((characterId, index) => {
      const sprites = expressionAvatarSpriteQueries[index]?.data;
      if (Array.isArray(sprites) && sprites.length > 0) map.set(characterId, sprites);
    });
    return map;
  }, [expressionAvatarCharacterIds, expressionAvatarSpriteQueries]);
  const expressionAvatarResolver = useMemo<ExpressionAvatarResolver | undefined>(() => {
    if (!expressionAvatarsEnabled) return undefined;
    return (message: MessageWithSwipes, characterId: string) => {
      const extra = parseMessageExtraRecord(message.extra);
      const expressions = normalizeMessageSpriteExpressions(extra.spriteExpressions);
      const characterName = data.characterMap.get(characterId)?.name;
      const expression = expressions[characterId] ?? (characterName ? expressions[characterName] : undefined);
      if (!expression) return null;
      return resolveExpressionAvatarSpriteUrl(expressionAvatarSpriteMap.get(characterId), expression);
    };
  }, [data.characterMap, expressionAvatarSpriteMap, expressionAvatarsEnabled]);

  const handleCloneSceneFromHere = useCallback(
    (messageId: string) => {
      if (isForking || timeline.isStreaming) return;
      forkScene(activeChatId, "clone", { upToMessageId: messageId });
    },
    [activeChatId, forkScene, isForking, timeline.isStreaming],
  );

  return (
    <>
      <ChatRoleplaySurface
        activeChatId={activeChatId}
        chat={data.chat}
        allChats={data.chatList}
        chatMeta={data.chatMeta}
        chatMode={data.chatMode}
        isRoleplay={isRoleplay}
        centerCompact={centerCompact}
        chatBackground={chatBackground}
        weatherEffects={weatherEffects}
        agentsUiEnabled={agentsUiEnabled}
        expressionAgentEnabled={expressionAgentEnabled}
        expressionAvatarsEnabled={expressionAvatarsEnabled}
        expressionAvatarResolver={expressionAvatarResolver}
        combatAgentEnabled={combatAgentEnabled}
        encounterActive={encounterActive}
        spritePosition={spriteState.spritePosition}
        spriteCharacterIds={spriteState.spriteCharacterIds}
        spriteDisplayModes={spriteState.spriteDisplayModes}
        spriteExpressions={spriteState.spriteExpressions}
        spritePlacements={spriteState.spritePlacements}
        spriteScale={spriteState.spriteScale}
        spriteOpacity={spriteState.spriteOpacity}
        hasCustomSpritePlacements={spriteState.hasCustomSpritePlacements}
        spriteArrangeMode={overlays.spriteArrangeMode}
        enabledAgentTypes={enabledAgentTypes}
        chatCharIds={data.chatCharIds}
        characterMap={data.characterMap}
        characterNames={data.characterNames}
        personaInfo={data.personaInfo}
        messages={data.messages}
        msgPayload={msgPayload}
        isLoading={data.isLoading}
        hasNextPage={!!data.hasNextPage}
        isFetchingNextPage={data.isFetchingNextPage}
        isStreaming={timeline.isStreaming}
        regenerateMessageId={timeline.regenerateMessageId}
        shouldAnimateMessages={shouldAnimateMessages}
        summaryContextSize={summaryContextSize}
        totalMessageCount={data.totalMessageCount}
        lastAssistantMessageId={timeline.lastAssistantMessageId}
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
        groupChatMode={groupChatMode}
        scrollRef={scroll.scrollRef}
        messagesEndRef={scroll.messagesEndRef}
        onLoadMore={scroll.handleLoadMore}
        onDelete={timeline.handleDelete}
        onRegenerate={timeline.handleRegenerate}
        onEdit={timeline.handleEdit}
        onSetActiveSwipe={timeline.handleSetActiveSwipe}
        onToggleConversationStart={timeline.handleToggleConversationStart}
        onToggleHiddenFromAI={timeline.handleToggleHiddenFromAI}
        onPeekPrompt={timeline.handlePeekPrompt}
        onBranch={isSceneChat ? undefined : timeline.handleBranch}
        onCloneSceneFromHere={isSceneChat ? handleCloneSceneFromHere : undefined}
        isCloneSceneFromHereDisabled={isForking || timeline.isStreaming}
        onToggleSelectMessage={timeline.handleToggleSelectMessage}
        onSummaryContextSizeChange={handleSummaryContextSizeChange}
        onRerunTrackers={timeline.handleRerunTrackers}
        onRerunSingleTracker={timeline.handleRerunSingleTracker}
        onRetryFailedAgents={timeline.handleRetryFailedAgents}
        onStartEncounter={() => startEncounter()}
        onConcludeScene={() => concludeScene(activeChatId)}
        onAbandonScene={() => abandonScene(activeChatId)}
        onForkScene={forkScene}
        isForkingScene={isForking || timeline.isStreaming}
        onOpenSettings={overlays.openSettings}
        onOpenFiles={overlays.openFiles}
        onOpenGallery={overlays.openGallery}
        onCloseSettings={overlays.closeSettings}
        onCloseFiles={overlays.closeFiles}
        onCloseGallery={overlays.closeGallery}
        onIllustrate={timeline.handleIllustrate}
        onWizardFinish={overlays.finishWizard}
        onClosePeekPrompt={timeline.closePeekPrompt}
        onResetSpritePlacements={spriteState.handleResetSpritePlacements}
        onSpriteSideChange={spriteState.handleSetSpritePosition}
        onToggleSpriteArrange={overlays.toggleSpriteArrange}
        onToggleSpritePosition={spriteState.handleToggleSpritePosition}
        onExpressionChange={spriteState.handleExpressionChange}
        onSpritePlacementChange={spriteState.handleSpritePlacementChange}
        onDeleteConfirm={timeline.handleDeleteConfirm}
        onDeleteSwipe={timeline.handleDeleteSwipe}
        onDeleteMore={timeline.handleDeleteMore}
        onCloseDeleteDialog={timeline.closeDeleteDialog}
        onBulkDelete={timeline.handleBulkDelete}
        onCancelMultiSelect={timeline.handleCancelMultiSelect}
        onUnselectAllMessages={timeline.handleUnselectAllMessages}
        onSelectAllAboveSelection={timeline.handleSelectAllAboveSelection}
        onSelectAllBelowSelection={timeline.handleSelectAllBelowSelection}
        isGrouped={timeline.isGrouped}
      />
      {request && (
        <AgentInjectionReviewModal
          request={request}
          drafts={drafts}
          onDraftChange={onDraftChange}
          onContinue={onContinue}
          onClose={onClose}
        />
      )}
      {pendingNewChatMode && (
        <NewChatConnectionGate mode={pendingNewChatMode} onClose={() => useChatStore.getState().setPendingNewChatMode(null)} />
      )}
    </>
  );
}
