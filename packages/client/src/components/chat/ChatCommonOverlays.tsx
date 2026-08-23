import { Suspense, lazy, type ComponentProps, type CSSProperties } from "react";
import type { SpriteSide } from "@marinara-engine/shared";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { ChevronUp, ChevronDown, Layers, ListChecks, Loader2, Trash2, X } from "lucide-react";
import type { PeekPromptData } from "./chat-area.types";
import type { LocalSpriteVisualSettings } from "./local-sprite-visual-settings";
import type { ChatImage } from "../../hooks/use-gallery";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { NEUTRAL_PANEL_SHELL } from "../ui/neutral-surface-styles";
import { getChatFloatingPanelDesktopRight, type ChatToolbarFloatingPanelAnchor } from "./ChatToolbarControls";

const loadChatSettingsDrawer = async () => {
  const module = await import("./ChatSettingsDrawer");
  return { default: module.ChatSettingsDrawer };
};

let chatSettingsDrawerLoadPromise: ReturnType<typeof loadChatSettingsDrawer> | null = null;

export function preloadChatSettingsDrawer() {
  chatSettingsDrawerLoadPromise ??= loadChatSettingsDrawer();
  return chatSettingsDrawerLoadPromise;
}

const ChatSettingsDrawer = lazy(preloadChatSettingsDrawer);

const ChatGalleryDrawer = lazy(async () => {
  const module = await import("./ChatGalleryDrawer");
  return { default: module.ChatGalleryDrawer };
});

const ChatSetupWizard = lazy(async () => {
  const module = await import("./ChatSetupWizard");
  return { default: module.ChatSetupWizard };
});

const PeekPromptModal = lazy(async () => {
  const module = await import("./PeekPromptModal");
  return { default: module.PeekPromptModal };
});

type ChatData = ComponentProps<typeof ChatSettingsDrawer>["chat"];
export type ChatFloatingPanelAnchor = ChatToolbarFloatingPanelAnchor;
export type ChatSettingsInitialSection = ComponentProps<typeof ChatSettingsDrawer>["initialSection"];

type SharedSceneSettingsProps = {
  spriteArrangeMode: boolean;
  onToggleSpriteArrange: () => void;
  onResetSpritePlacements: () => void;
  onResetSpriteCharacterVisualSettings?: (characterId: string) => void;
  onSpriteSideChange: (side: SpriteSide, characterId?: string) => void;
  spriteVisualSettings?: LocalSpriteVisualSettings;
  onSpriteVisualSettingsChange?: (patch: Partial<LocalSpriteVisualSettings>) => void;
};

type DeleteDialogProps = {
  messageId: string | null;
  canDeleteSwipe: boolean;
  canDeleteOtherSwipes: boolean;
  activeSwipeIndex: number;
  swipeCount: number;
  onConfirm: () => void;
  onDeleteSwipe: () => void;
  onDeleteOtherSwipes: () => void;
  onDeleteMore: () => void;
  onClose: () => void;
};

const DELETE_DIALOG_ACTION_CLASS = "mari-chrome-control min-h-10 w-full justify-start px-3 py-2 text-left text-xs";

function DeleteConfirmationDialog({
  messageId,
  canDeleteSwipe,
  canDeleteOtherSwipes,
  activeSwipeIndex,
  swipeCount,
  onConfirm,
  onDeleteSwipe,
  onDeleteOtherSwipes,
  onDeleteMore,
  onClose,
}: DeleteDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={!!messageId}
      onClose={onClose}
      title={t("chat.delete.dialog.title")}
      width="max-w-sm"
      chatFloatingPanel
    >
      <p className="mb-4 text-sm leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
        {t("chat.delete.dialog.description")}
      </p>
      <div className="grid gap-2" data-component="MessageDeleteActions">
        {canDeleteSwipe && (
          <button type="button" onClick={onDeleteSwipe} className={DELETE_DIALOG_ACTION_CLASS}>
            <Layers size="0.8rem" />
            <span>
              {t("chat.delete.dialog.swipe", {
                current: activeSwipeIndex + 1,
                total: swipeCount,
              })}
            </span>
          </button>
        )}
        {canDeleteOtherSwipes && (
          <button type="button" onClick={onDeleteOtherSwipes} className={DELETE_DIALOG_ACTION_CLASS}>
            <Layers size="0.8rem" />
            <span>{t("chat.delete.dialog.otherSwipes")}</span>
          </button>
        )}
        <button type="button" onClick={onConfirm} className={DELETE_DIALOG_ACTION_CLASS}>
          <Trash2 size="0.8rem" />
          <span>{t("chat.delete.dialog.message")}</span>
        </button>
        <button type="button" onClick={onDeleteMore} className={DELETE_DIALOG_ACTION_CLASS}>
          <ListChecks size="0.8rem" />
          <span>{t("chat.delete.dialog.more")}</span>
        </button>
        <button type="button" onClick={onClose} className={DELETE_DIALOG_ACTION_CLASS}>
          <X size="0.8rem" />
          <span>{t("chat.delete.dialog.cancel")}</span>
        </button>
      </div>
    </Modal>
  );
}

type MultiSelectBarProps = {
  open: boolean;
  selectedCount: number;
  onDelete: () => void;
  onCancel: () => void;
  onUnselectAll: () => void;
  onSelectAllAbove: () => void;
  onSelectAllBelow: () => void;
};

function MultiSelectBar({
  open,
  selectedCount,
  onDelete,
  onCancel,
  onUnselectAll,
  onSelectAllAbove,
  onSelectAllBelow,
}: MultiSelectBarProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      data-component="MessageMultiSelectBar"
      className={cn(
        NEUTRAL_PANEL_SHELL,
        "mari-chrome-token-scope fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[min(30rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-2 p-3",
      )}
    >
      <span className="text-center text-xs font-medium text-[var(--marinara-chat-chrome-panel-muted)]">
        {t("chat.delete.selection.count", { count: selectedCount })}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={selectedCount === 0}
          className="mari-chrome-control min-h-10 w-full px-3 py-2 text-xs"
        >
          <Trash2 size="0.75rem" />
          <span>{t("chat.delete.selection.delete")}</span>
        </button>
        <button type="button" onClick={onCancel} className="mari-chrome-control min-h-10 w-full px-3 py-2 text-xs">
          <X size="0.75rem" />
          <span>{t("chat.delete.selection.cancel")}</span>
        </button>
      </div>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={onSelectAllAbove}
          disabled={selectedCount === 0}
          title={t("chat.delete.selection.above")}
          aria-label={t("chat.delete.selection.above")}
          className="mari-chrome-control mari-chrome-control--small h-8 w-8 p-0"
        >
          <ChevronUp size="0.85rem" />
        </button>
        <button
          type="button"
          onClick={onUnselectAll}
          disabled={selectedCount === 0}
          className="mari-chrome-control mari-chrome-control--small px-3 text-[0.6875rem]"
        >
          <span>{t("chat.delete.selection.unselectAll")}</span>
        </button>
        <button
          type="button"
          onClick={onSelectAllBelow}
          disabled={selectedCount === 0}
          title={t("chat.delete.selection.below")}
          aria-label={t("chat.delete.selection.below")}
          className="mari-chrome-control mari-chrome-control--small h-8 w-8 p-0"
        >
          <ChevronDown size="0.85rem" />
        </button>
      </div>
    </div>
  );
}

function ChatSettingsLoadingFallback({ anchor }: { anchor: ChatFloatingPanelAnchor }) {
  const { t: localizeUi } = useUiTranslation();
  const anchoredOnMobile = !!anchor && typeof window !== "undefined" && window.innerWidth < 768;
  const panelStyle: CSSProperties | undefined = anchor
    ? anchoredOnMobile
      ? {
          bottom: "auto",
          left: "auto",
          right: `${anchor.right}px`,
          top: `${anchor.top}px`,
          width: `min(34rem, calc(100vw - ${anchor.right}px - 0.75rem))`,
        }
      : { right: getChatFloatingPanelDesktopRight(anchor), top: `${anchor.top}px` }
    : undefined;

  return (
    <div
      data-chat-floating-panel
      className="mari-chrome-token-scope fixed bottom-3 right-[calc(var(--mari-chat-ui-inset-right,0px)+0.75rem)] top-14 z-[70] flex w-[min(34rem,calc(100vw-var(--mari-chat-ui-inset-left,0px)-var(--mari-chat-ui-inset-right,0px)-1.5rem))] flex-col overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-panel-text)] shadow-2xl shadow-black/40 backdrop-blur-md max-md:inset-x-2 max-md:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:w-auto"
      style={panelStyle}
    >
      <div className="mari-chrome-text-strong flex shrink-0 items-center gap-2 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3 text-sm font-semibold">
        <Loader2 size="0.875rem" className="mari-chrome-accent-icon animate-spin" />
        {localizeUi("chat.toolbar.settings")}
      </div>
      <div className="mari-chrome-text-muted flex min-h-32 items-center justify-center px-4 py-8 text-xs">
        {localizeUi("ui.chat.chatsettingsloadingfallback.loadingSettings")}
      </div>
    </div>
  );
}

type ChatCommonOverlaysProps = {
  chat: ChatData | null | undefined;
  settingsOpen: boolean;
  settingsAnchor: ChatFloatingPanelAnchor;
  settingsInitialSection?: ChatSettingsInitialSection;
  galleryOpen: boolean;
  galleryAnchor: ChatFloatingPanelAnchor;
  wizardOpen: boolean;
  peekPromptData: PeekPromptData | null;
  deleteDialogMessageId: string | null;
  deleteDialogCanDeleteSwipe: boolean;
  deleteDialogCanDeleteOtherSwipes: boolean;
  deleteDialogActiveSwipeIndex: number;
  deleteDialogSwipeCount: number;
  multiSelectMode: boolean;
  selectedMessageCount: number;
  sceneSettings: SharedSceneSettingsProps;
  onCloseSettings: () => void;
  onCloseGallery: () => void;
  onOpenScheduleEditor?: (characterId: string, options?: { initialDay?: string | null }) => void;
  /** Manually trigger the Illustrator agent */
  onIllustrate?: () => void;
  onIllustrateWithAgent?: (agentType: string) => void | Promise<void>;
  /** Generate an on-demand Conversation selfie. */
  onGenerateSelfie?: (characterId?: string) => void | Promise<void>;
  selfieCharacters?: Array<{ id: string; name: string }>;
  /** Run Illustrator in its background prompt mode. */
  onGenerateBackground?: () => void | Promise<void>;
  /** Generate a storyboard for the latest completed Game or Roleplay episode. */
  onGenerateStoryboard?: () => void | Promise<void>;
  /** Show the latest Game Mode storyboard viewer. */
  onViewStoryboard?: () => void;
  /** Generate a scene video from the latest gallery image. */
  onGenerateVideo?: () => void | Promise<void>;
  /** Generate a scene video from a specific gallery image. */
  onAnimateImage?: (image: ChatImage) => void | Promise<void>;
  onWizardFinish: () => void;
  onClosePeekPrompt: () => void;
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
};

export function ChatCommonOverlays({
  chat,
  settingsOpen,
  settingsAnchor,
  settingsInitialSection,
  galleryOpen,
  galleryAnchor,
  wizardOpen,
  peekPromptData,
  deleteDialogMessageId,
  deleteDialogCanDeleteSwipe,
  deleteDialogCanDeleteOtherSwipes,
  deleteDialogActiveSwipeIndex,
  deleteDialogSwipeCount,
  multiSelectMode,
  selectedMessageCount,
  sceneSettings,
  onCloseSettings,
  onCloseGallery,
  onOpenScheduleEditor,
  onIllustrate,
  onIllustrateWithAgent,
  onGenerateSelfie,
  selfieCharacters,
  onGenerateBackground,
  onGenerateStoryboard,
  onViewStoryboard,
  onGenerateVideo,
  onAnimateImage,
  onWizardFinish,
  onClosePeekPrompt,
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
}: ChatCommonOverlaysProps) {
  return (
    <>
      {chat && settingsOpen && (
        <Suspense fallback={<ChatSettingsLoadingFallback anchor={settingsAnchor} />}>
          <ChatSettingsDrawer
            chat={chat}
            open={settingsOpen}
            onClose={onCloseSettings}
            anchor={settingsAnchor}
            initialSection={settingsInitialSection}
            spriteArrangeMode={sceneSettings.spriteArrangeMode}
            onToggleSpriteArrange={sceneSettings.onToggleSpriteArrange}
            onResetSpritePlacements={sceneSettings.onResetSpritePlacements}
            onResetSpriteCharacterVisualSettings={sceneSettings.onResetSpriteCharacterVisualSettings}
            onSpriteSideChange={sceneSettings.onSpriteSideChange}
            spriteVisualSettings={sceneSettings.spriteVisualSettings}
            onSpriteVisualSettingsChange={sceneSettings.onSpriteVisualSettingsChange}
            onOpenScheduleEditor={onOpenScheduleEditor}
          />
        </Suspense>
      )}
      {chat && (
        <Suspense fallback={null}>
          {galleryOpen && (
            <ChatGalleryDrawer
              chat={chat}
              open={galleryOpen}
              onClose={onCloseGallery}
              anchor={galleryAnchor}
              onIllustrate={onIllustrate}
              onIllustrateWithAgent={onIllustrateWithAgent}
              onGenerateSelfie={onGenerateSelfie}
              selfieCharacters={selfieCharacters}
              onGenerateStoryboard={onGenerateStoryboard}
              onViewStoryboard={onViewStoryboard}
              onGenerateVideo={onGenerateVideo}
              onAnimateImage={onAnimateImage}
              onGenerateBackground={onGenerateBackground}
            />
          )}
        </Suspense>
      )}
      {chat && (
        <Suspense fallback={null}>{wizardOpen && <ChatSetupWizard chat={chat} onFinish={onWizardFinish} />}</Suspense>
      )}
      <Suspense fallback={null}>
        {peekPromptData && <PeekPromptModal data={peekPromptData} onClose={onClosePeekPrompt} />}
      </Suspense>
      <DeleteConfirmationDialog
        messageId={deleteDialogMessageId}
        canDeleteSwipe={deleteDialogCanDeleteSwipe}
        canDeleteOtherSwipes={deleteDialogCanDeleteOtherSwipes}
        activeSwipeIndex={deleteDialogActiveSwipeIndex}
        swipeCount={deleteDialogSwipeCount}
        onConfirm={onDeleteConfirm}
        onDeleteSwipe={onDeleteSwipe}
        onDeleteOtherSwipes={onDeleteOtherSwipes}
        onDeleteMore={onDeleteMore}
        onClose={onCloseDeleteDialog}
      />
      <MultiSelectBar
        open={multiSelectMode}
        selectedCount={selectedMessageCount}
        onDelete={onBulkDelete}
        onCancel={onCancelMultiSelect}
        onUnselectAll={onUnselectAllMessages}
        onSelectAllAbove={onSelectAllAboveSelection}
        onSelectAllBelow={onSelectAllBelowSelection}
      />
    </>
  );
}
