import type { ComponentProps } from "react";
import type { Message, SpriteSide } from "@marinara-engine/shared";
import { ConversationView } from "./ConversationView";
import { ChatCommonOverlays } from "./ChatCommonOverlays";
import { useRenderTimer } from "../../lib/perf-diagnostics";
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
  galleryOpen: boolean;
  galleryAnchor: ComponentProps<typeof ChatCommonOverlays>["galleryAnchor"];
  wizardOpen: boolean;
  peekPromptData: PeekPromptData | null;
  deleteDialogMessageId: string | null;
  deleteDialogCanDeleteSwipe: boolean;
  deleteDialogActiveSwipeIndex: number;
  deleteDialogSwipeCount: number;
  multiSelectMode: boolean;
  selectedMessageIds: Set<string>;
  spriteArrangeMode: boolean;
  onDelete: (messageId: string) => void;
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onSetActiveSwipe: (messageId: string, index: number) => void;
  onToggleHiddenFromAI: (messageId: string, current: boolean) => void;
  onPeekPrompt: () => void;
  onBranch?: (messageId: string) => void;
  onToggleSelectMessage: (toggle: MessageSelectionToggle) => void;
  onSwitchChat?: () => void;
  onConcludeScene?: () => void;
  onAbandonScene?: () => void;
  onOpenSettings: ComponentProps<typeof ConversationView>["onOpenSettings"];
  onOpenGallery: ComponentProps<typeof ConversationView>["onOpenGallery"];
  onOpenScheduleEditor?: ComponentProps<typeof ConversationView>["onOpenScheduleEditor"];
  onCloseSettings: () => void;
  onCloseGallery: () => void;
  onIllustrate?: () => void;
  onWizardFinish: () => void;
  onClosePeekPrompt: () => void;
  onResetSpritePlacements: () => void;
  onSpriteSideChange: (side: SpriteSide) => void;
  onToggleSpriteArrange: () => void;
  onDeleteConfirm: () => void;
  onDeleteSwipe: () => void;
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
  galleryOpen,
  galleryAnchor,
  wizardOpen,
  peekPromptData,
  deleteDialogMessageId,
  deleteDialogCanDeleteSwipe,
  deleteDialogActiveSwipeIndex,
  deleteDialogSwipeCount,
  multiSelectMode,
  selectedMessageIds,
  spriteArrangeMode,
  onDelete,
  onRegenerate,
  onEdit,
  onSetActiveSwipe,
  onToggleHiddenFromAI,
  onPeekPrompt,
  onBranch,
  onToggleSelectMessage,
  onSwitchChat,
  onConcludeScene,
  onAbandonScene,
  onOpenSettings,
  onOpenGallery,
  onOpenScheduleEditor,
  onCloseSettings,
  onCloseGallery,
  onIllustrate,
  onWizardFinish,
  onClosePeekPrompt,
  onResetSpritePlacements,
  onSpriteSideChange,
  onToggleSpriteArrange,
  onDeleteConfirm,
  onDeleteSwipe,
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
          chatName={chat?.name}
          chatGroupId={chat?.groupId ?? null}
          chatCharIds={chatCharIds}
          onDelete={onDelete}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
          onSetActiveSwipe={onSetActiveSwipe}
          onToggleHiddenFromAI={onToggleHiddenFromAI}
          onPeekPrompt={onPeekPrompt}
          onIllustrate={onIllustrate}
          lastAssistantMessageId={lastAssistantMessageId}
          onOpenSettings={onOpenSettings}
          onOpenGallery={onOpenGallery}
          onOpenScheduleEditor={onOpenScheduleEditor}
          onBranch={onBranch}
          multiSelectMode={multiSelectMode}
          selectedMessageIds={selectedMessageIds}
          onToggleSelectMessage={onToggleSelectMessage}
          connectedChatName={connectedChatName}
          onSwitchChat={onSwitchChat}
          sceneInfo={sceneInfo}
          onConcludeScene={onConcludeScene}
          onAbandonScene={onAbandonScene}
        />
      </div>

      <ChatCommonOverlays
        chat={chat}
        settingsOpen={settingsOpen}
        settingsAnchor={settingsAnchor}
        settingsInitialSection={settingsInitialSection}
        galleryOpen={galleryOpen}
        galleryAnchor={galleryAnchor}
        wizardOpen={wizardOpen}
        peekPromptData={peekPromptData}
        deleteDialogMessageId={deleteDialogMessageId}
        deleteDialogCanDeleteSwipe={deleteDialogCanDeleteSwipe}
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
        onCloseGallery={onCloseGallery}
        onOpenScheduleEditor={onOpenScheduleEditor}
        onIllustrate={onIllustrate}
        onWizardFinish={onWizardFinish}
        onClosePeekPrompt={onClosePeekPrompt}
        onDeleteConfirm={onDeleteConfirm}
        onDeleteSwipe={onDeleteSwipe}
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
