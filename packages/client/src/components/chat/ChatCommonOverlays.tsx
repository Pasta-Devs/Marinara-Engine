import { Suspense, lazy, type ComponentProps, type CSSProperties } from "react";
import type { SpriteSide } from "@marinara-engine/shared";
import { ChevronUp, ChevronDown, Loader2, Trash2 } from "lucide-react";
import type { PeekPromptData } from "./chat-area.types";
import type { LocalSpriteVisualSettings } from "./local-sprite-visual-settings";
import type { ChatImage } from "../../hooks/use-gallery";

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
export type ChatFloatingPanelAnchor = { right: number; top: number } | null;
export type ChatSettingsInitialSection = ComponentProps<typeof ChatSettingsDrawer>["initialSection"];

type SharedSceneSettingsProps = {
  spriteArrangeMode: boolean;
  onToggleSpriteArrange: () => void;
  onResetSpritePlacements: () => void;
  onSpriteSideChange: (side: SpriteSide) => void;
  spriteVisualSettings?: LocalSpriteVisualSettings;
  onSpriteVisualSettingsChange?: (patch: Partial<LocalSpriteVisualSettings>) => void;
};

type DeleteDialogProps = {
  messageId: string | null;
  canDeleteSwipe: boolean;
  activeSwipeIndex: number;
  swipeCount: number;
  onConfirm: () => void;
  onDeleteSwipe: () => void;
  onDeleteMore: () => void;
  onClose: () => void;
};

function DeleteConfirmationDialog({
  messageId,
  canDeleteSwipe,
  activeSwipeIndex,
  swipeCount,
  onConfirm,
  onDeleteSwipe,
  onDeleteMore,
  onClose,
}: DeleteDialogProps) {
  if (!messageId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)] sm:p-4"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-xs rounded-xl bg-[var(--card)] p-5 shadow-2xl ring-1 ring-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-center text-sm font-semibold">How to proceed?</p>
        <div className="flex flex-col gap-2">
          {canDeleteSwipe && (
            <button
              onClick={onDeleteSwipe}
              className="rounded-lg bg-[var(--secondary)] px-4 py-2 text-xs font-medium transition-colors hover:bg-[var(--accent)]"
            >
              Delete only this swipe ({activeSwipeIndex + 1}/{swipeCount})
            </button>
          )}
          <button
            onClick={onConfirm}
            className="rounded-lg bg-[var(--destructive)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--destructive)]/80"
          >
            Delete this message
          </button>
          <button
            onClick={onDeleteMore}
            className="rounded-lg bg-[var(--secondary)] px-4 py-2 text-xs font-medium transition-colors hover:bg-[var(--accent)]"
          >
            Delete more
          </button>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
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
  if (!open) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-stretch gap-2 rounded-xl bg-[var(--card)] px-5 py-3 shadow-2xl ring-1 ring-[var(--border)]">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">{selectedCount} selected</span>
        <button
          onClick={onDelete}
          disabled={selectedCount === 0}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--destructive)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--destructive)]/80 disabled:opacity-40"
        >
          <Trash2 size="0.75rem" />
          Delete selected
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
        >
          Cancel
        </button>
      </div>
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onSelectAllAbove}
          disabled={selectedCount === 0}
          title="Select all messages above"
          aria-label="Select all messages above"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
        >
          <ChevronUp size="0.85rem" />
        </button>
        <button
          onClick={onUnselectAll}
          disabled={selectedCount === 0}
          className="rounded-lg px-3 py-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
        >
          Unselect all
        </button>
        <button
          onClick={onSelectAllBelow}
          disabled={selectedCount === 0}
          title="Select all messages below"
          aria-label="Select all messages below"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
        >
          <ChevronDown size="0.85rem" />
        </button>
      </div>
    </div>
  );
}

function ChatSettingsLoadingFallback({ anchor }: { anchor: ChatFloatingPanelAnchor }) {
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
      : { right: `${anchor.right}px`, top: `${anchor.top}px` }
    : undefined;

  return (
    <div
      data-chat-floating-panel
      className="mari-chrome-token-scope fixed bottom-3 right-[calc(var(--mari-chat-ui-inset-right,0px)+0.75rem)] top-14 z-[70] flex w-[min(34rem,calc(100vw-var(--mari-chat-ui-inset-left,0px)-var(--mari-chat-ui-inset-right,0px)-1.5rem))] flex-col overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-panel-text)] shadow-2xl shadow-black/40 backdrop-blur-md max-md:inset-x-2 max-md:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:w-auto"
      style={panelStyle}
    >
      <div className="mari-chrome-text-strong flex shrink-0 items-center gap-2 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3 text-sm font-semibold">
        <Loader2 size="0.875rem" className="mari-chrome-accent-icon animate-spin" />
        Chat Settings
      </div>
      <div className="mari-chrome-text-muted flex min-h-32 items-center justify-center px-4 py-8 text-xs">
        Loading settings...
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
  /** Generate an on-demand Conversation selfie. */
  onGenerateSelfie?: (characterId?: string) => void | Promise<void>;
  selfieCharacters?: Array<{ id: string; name: string }>;
  /** Run Illustrator in its background prompt mode. */
  onGenerateBackground?: () => void | Promise<void>;
  /** Generate a storyboard for the latest completed Game Mode GM turn. */
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
  deleteDialogActiveSwipeIndex,
  deleteDialogSwipeCount,
  multiSelectMode,
  selectedMessageCount,
  sceneSettings,
  onCloseSettings,
  onCloseGallery,
  onOpenScheduleEditor,
  onIllustrate,
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
        activeSwipeIndex={deleteDialogActiveSwipeIndex}
        swipeCount={deleteDialogSwipeCount}
        onConfirm={onDeleteConfirm}
        onDeleteSwipe={onDeleteSwipe}
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
