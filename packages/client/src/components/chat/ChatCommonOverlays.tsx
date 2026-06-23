import { Suspense, lazy, useEffect, type ComponentProps } from "react";
import type { SpriteSide } from "@marinara-engine/shared";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import type { PeekPromptData } from "./chat-area.types";
import type { LocalSpriteVisualSettings } from "./local-sprite-visual-settings";

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

const ChatFilesDrawer = lazy(async () => {
  const module = await import("./ChatFilesDrawer");
  return { default: module.ChatFilesDrawer };
});

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

type ChatCommonOverlaysProps = {
  chat: ChatData | null | undefined;
  settingsOpen: boolean;
  settingsAnchor: ChatFloatingPanelAnchor;
  settingsInitialSection?: ChatSettingsInitialSection;
  filesOpen: boolean;
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
  onCloseFiles: () => void;
  onCloseGallery: () => void;
  /** Manually trigger the Illustrator agent */
  onIllustrate?: () => void;
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
  filesOpen,
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
  onCloseFiles,
  onCloseGallery,
  onIllustrate,
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
  useEffect(() => {
    if (typeof window === "undefined") return;
    const warmSettingsDrawer = () => {
      void preloadChatSettingsDrawer();
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(warmSettingsDrawer, { timeout: 1500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(warmSettingsDrawer, 600);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <>
      {chat && settingsOpen && (
        <Suspense fallback={null}>
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
          />
        </Suspense>
      )}
      {chat && (
        <Suspense fallback={null}>
          {filesOpen && <ChatFilesDrawer chat={chat} open={filesOpen} onClose={onCloseFiles} />}
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
