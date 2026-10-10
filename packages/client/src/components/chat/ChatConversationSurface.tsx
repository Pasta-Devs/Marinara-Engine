import { useMemo, type ComponentProps, type ReactNode } from "react";
import type { Message, SpriteSide } from "@marinara-engine/shared";
import { ConversationPackageWindows, ConversationView } from "./ConversationView";
import { ChatCommonOverlays } from "./ChatCommonOverlays";
import { ChatConnectedChatWindow } from "./ChatControlWindow";
import { useRenderTimer } from "../../lib/perf-diagnostics";
import { useProvideChatGalleryActions } from "../../hooks/use-chat-gallery-actions";
import type { CharacterMap, MessageSelectionToggle, PeekPromptData, PersonaInfo } from "./chat-area.types";

type SceneInfo =
  | {
      variant: "origin";
      sceneChatId: string;
      sceneChatName?: string;
    }
  | {
      variant: "scene";
      sceneChatId: string;
      originChatId?: string;
      description?: string;
    };

type ConversationSurfaceProps = {
  activeChatId: string;
  chat: ComponentProps<typeof ChatCommonOverlays>["chat"];
  messages: Message[] | undefined;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  pageCount: number;
  totalMessageCount: number;
  characterMap: CharacterMap;
  characterNames: string[];
  personaInfo?: PersonaInfo;
  chatMeta: Record<string, any>;
  chatCharIds: string[];
  connectedChatName?: string;
  sceneInfo?: SceneInfo;
  settingsOpen: boolean;
  settingsAnchor: ComponentProps<typeof ChatCommonOverlays>["settingsAnchor"];
  settingsInitialSection?: ComponentProps<typeof ChatCommonOverlays>["settingsInitialSection"];
  wizardOpen: boolean;
  peekPromptData: PeekPromptData | null;
  deleteDialogMessageId: string | null;
  deleteDialogCanDeleteSwipe: boolean;
  deleteDialogCanDeleteOtherSwipes: boolean;
  deleteDialogActiveSwipeIndex: number;
  deleteDialogSwipeCount: number;
  multiSelectMode: boolean;
  selectedMessageIds: Set<string>;
  spriteArrangeMode: boolean;
  onDelete: (messageId: string) => void;
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => void;
  /** N1: the user message whose reply failed, if any — drives the "Failed · Retry" line. */
  failedReplyMessageId?: string | null;
  failedReplyReason?: string;
  onRetryFailedReply?: () => void;
  /** R2: the reply that gets the checkup's quiet line, and the line itself. */
  replyCheckupMessageId?: string | null;
  replyCheckup?: ReactNode;
  onSetActiveSwipe: (messageId: string, index: number) => void;
  onToggleHiddenFromAI: (messageId: string, current: boolean) => void;
  onPeekPrompt: (messageId?: string) => void;
  onBranch?: (messageId: string) => void;
  onToggleSelectMessage: (toggle: MessageSelectionToggle) => void;
  onSwitchChat?: () => void;
  onConcludeScene?: () => void;
  onAbandonScene?: () => void;
  onOpenSettings: ComponentProps<typeof ConversationView>["onOpenSettings"];
  onOpenScheduleEditor?: ComponentProps<typeof ConversationView>["onOpenScheduleEditor"];
  onCloseSettings: (options?: { force?: boolean }) => void;
  onIllustrate?: (prompt?: string, messageRange?: [string, string]) => void;
  onIllustrateWithAgent?: (agentType: string) => void | Promise<void>;
  onGenerateSelfie?: (characterId?: string) => void | Promise<void>;
  onWizardFinish: () => void;
  onClosePeekPrompt: () => void;
  onResetSpritePlacements: () => void;
  onSpriteSideChange: (side: SpriteSide, characterId?: string) => void;
  onToggleSpriteArrange: () => void;
  onDeleteConfirm: () => void;
  onDeleteSwipe: () => void;
  onDeleteOtherSwipes: () => void;
  onDeleteMore: () => void;
  onCloseDeleteDialog: () => void;
  onBulkDelete: () => void;
  onCancelMultiSelect: () => void;
  onUnselectAllMessages: () => void;
  onSelectAllAboveSelection: () => void;
  onSelectAllBelowSelection: () => void;
  lastAssistantMessageId: string | null;
};

export function ChatConversationSurface({
  activeChatId,
  chat,
  messages,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  pageCount,
  totalMessageCount,
  characterMap,
  characterNames,
  personaInfo,
  chatMeta,
  chatCharIds,
  connectedChatName,
  sceneInfo,
  settingsOpen,
  settingsAnchor,
  settingsInitialSection,
  wizardOpen,
  peekPromptData,
  deleteDialogMessageId,
  deleteDialogCanDeleteSwipe,
  deleteDialogCanDeleteOtherSwipes,
  deleteDialogActiveSwipeIndex,
  deleteDialogSwipeCount,
  multiSelectMode,
  selectedMessageIds,
  spriteArrangeMode,
  onDelete,
  onRegenerate,
  onEdit,
  failedReplyMessageId,
  failedReplyReason,
  onRetryFailedReply,
  replyCheckupMessageId,
  replyCheckup,
  onSetActiveSwipe,
  onToggleHiddenFromAI,
  onPeekPrompt,
  onBranch,
  onToggleSelectMessage,
  onSwitchChat,
  onConcludeScene,
  onAbandonScene,
  onOpenSettings,
  onOpenScheduleEditor,
  onCloseSettings,
  onIllustrate,
  onIllustrateWithAgent,
  onGenerateSelfie,
  onWizardFinish,
  onClosePeekPrompt,
  onResetSpritePlacements,
  onSpriteSideChange,
  onToggleSpriteArrange,
  onDeleteConfirm,
  onDeleteSwipe,
  onDeleteOtherSwipes,
  onDeleteMore,
  onCloseDeleteDialog,
  onBulkDelete,
  onCancelMultiSelect,
  onUnselectAllMessages,
  onSelectAllAboveSelection,
  onSelectAllBelowSelection,
  lastAssistantMessageId,
}: ConversationSurfaceProps) {
  useRenderTimer("convo-surface"); // [#3104 diagnostic]
  const galleryActions = useMemo(
    () => ({
      onIllustrate,
      onIllustrateWithAgent,
      onGenerateSelfie,
      selfieCharacters: chatCharIds
        .map((id) => {
          const character = characterMap.get(id);
          return character ? { id, name: character.name } : null;
        })
        .filter((character): character is { id: string; name: string } => Boolean(character)),
    }),
    [characterMap, chatCharIds, onGenerateSelfie, onIllustrate, onIllustrateWithAgent],
  );
  useProvideChatGalleryActions(activeChatId, galleryActions);
  return (
    <div data-component="ChatArea.Conversation" className="flex flex-1 overflow-hidden">
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <ConversationView
          chatId={activeChatId}
          messages={messages}
          isLoading={isLoading}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          pageCount={pageCount}
          totalMessageCount={totalMessageCount}
          characterMap={characterMap}
          characterNames={characterNames}
          personaInfo={personaInfo}
          chatMeta={chatMeta}
          chatCharIds={chatCharIds}
          onDelete={onDelete}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
          failedReplyMessageId={failedReplyMessageId}
          failedReplyReason={failedReplyReason}
          onRetryFailedReply={onRetryFailedReply}
          replyCheckupMessageId={replyCheckupMessageId}
          replyCheckup={replyCheckup}
          onSetActiveSwipe={onSetActiveSwipe}
          onToggleHiddenFromAI={onToggleHiddenFromAI}
          onPeekPrompt={onPeekPrompt}
          onIllustrate={onIllustrate}
          onGenerateSelfie={onGenerateSelfie}
          lastAssistantMessageId={lastAssistantMessageId}
          onOpenSettings={onOpenSettings}
          onOpenScheduleEditor={onOpenScheduleEditor}
          onBranch={onBranch}
          multiSelectMode={multiSelectMode}
          selectedMessageIds={selectedMessageIds}
          onToggleSelectMessage={onToggleSelectMessage}
          sceneInfo={sceneInfo}
          onConcludeScene={onConcludeScene}
          onAbandonScene={onAbandonScene}
        />
      </div>

      {/* The connected chat and package toolbars are windows that minimize to bubbles. */}
      {onSwitchChat && <ChatConnectedChatWindow name={connectedChatName} onSwitch={onSwitchChat} />}
      <ConversationPackageWindows
        chatId={activeChatId}
        chatMeta={chatMeta}
        characterMap={characterMap}
        chatCharIds={chatCharIds}
        personaInfo={personaInfo}
      />

      <ChatCommonOverlays
        chat={chat}
        settingsOpen={settingsOpen}
        settingsAnchor={settingsAnchor}
        settingsInitialSection={settingsInitialSection}
        wizardOpen={wizardOpen}
        peekPromptData={peekPromptData}
        deleteDialogMessageId={deleteDialogMessageId}
        deleteDialogCanDeleteSwipe={deleteDialogCanDeleteSwipe}
        deleteDialogCanDeleteOtherSwipes={deleteDialogCanDeleteOtherSwipes}
        deleteDialogActiveSwipeIndex={deleteDialogActiveSwipeIndex}
        deleteDialogSwipeCount={deleteDialogSwipeCount}
        multiSelectMode={multiSelectMode}
        selectedMessageCount={selectedMessageIds.size}
        sceneSettings={{
          spriteArrangeMode,
          onToggleSpriteArrange,
          onResetSpritePlacements,
          onSpriteSideChange,
        }}
        onCloseSettings={onCloseSettings}
        onOpenScheduleEditor={onOpenScheduleEditor}
        onWizardFinish={onWizardFinish}
        onClosePeekPrompt={onClosePeekPrompt}
        onDeleteConfirm={onDeleteConfirm}
        onDeleteSwipe={onDeleteSwipe}
        onDeleteOtherSwipes={onDeleteOtherSwipes}
        onDeleteMore={onDeleteMore}
        onCloseDeleteDialog={onCloseDeleteDialog}
        onBulkDelete={onBulkDelete}
        onCancelMultiSelect={onCancelMultiSelect}
        onUnselectAllMessages={onUnselectAllMessages}
        onSelectAllAboveSelection={onSelectAllAboveSelection}
        onSelectAllBelowSelection={onSelectAllBelowSelection}
      />
    </div>
  );
}
