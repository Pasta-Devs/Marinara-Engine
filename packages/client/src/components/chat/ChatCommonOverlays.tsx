import { Suspense, lazy, useEffect, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import type { SpriteSide } from "@marinara-engine/shared";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronUp,
  ChevronDown,
  Download,
  Layers,
  ListChecks,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import type { PeekPromptData } from "./chat-area.types";
import type { LocalSpriteVisualSettings } from "./local-sprite-visual-settings";
import type { AvatarLayoutControls } from "./AvatarLayoutSettings";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { NEUTRAL_PANEL_SHELL } from "../ui/neutral-surface-styles";
import { type ChatToolbarFloatingPanelAnchor } from "./ChatToolbarControls";
import { FloatingWindow } from "../ui/FloatingWindow";
import { useMatchMedia } from "../../hooks/use-match-media";
import { CHAT_SETTINGS_WINDOW_ID } from "../../stores/floating-window.store";
import { getChatSettingsWindowProps } from "./chat-settings-window";
import { ChatBranchGraphWindow } from "./ChatBranchGraphWindow";
import { useHostHasDetachedDrawers } from "../ui/drawer-host";
import { useOverhaulActive, useOverhaulMobile, useOverhaulStore } from "../../stores/overhaul.store";

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
export type ChatSettingsTools = NonNullable<ComponentProps<typeof ChatSettingsDrawer>["chatTools"]>;

type SharedSceneSettingsProps = {
  spriteArrangeMode: boolean;
  onToggleSpriteArrange: () => void;
  onResetSpritePlacements: () => void;
  onResetSpriteCharacterVisualSettings?: (characterId: string) => void;
  onSpriteSideChange: (side: SpriteSide, characterId?: string) => void;
  spriteVisualSettings?: LocalSpriteVisualSettings;
  onSpriteVisualSettingsChange?: (patch: Partial<LocalSpriteVisualSettings>) => void;
  /** The Avatars drawer's controls, in chats whose stage can show avatars. */
  avatarLayout?: AvatarLayoutControls;
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

const DELETE_DIALOG_ACTION_CLASS =
  "mari-chat-style-control mari-chrome-control min-h-10 w-full justify-start px-3 py-2 text-left text-xs";

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
  const sheet = useOverhaulMobile();

  // New layout on phones: an action sheet along the bottom, with Cancel on its own.
  if (sheet) {
    if (!messageId) return null;
    return createPortal(
      <>
        <div className="ovm-sheet-scrim ovm-action-sheet-scrim" aria-hidden="true" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("chat.delete.dialog.title")}
          className="ovm-action-sheet"
          data-chat-floating-panel
          data-component="MessageDeleteActions"
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
        >
          <div className="ovm-action-sheet__group">
            <div className="ovm-action-sheet__head">
              <strong>{t("chat.delete.dialog.title")}</strong>
              <span>{t("chat.delete.dialog.description")}</span>
            </div>
            <button type="button" className="is-danger" onClick={onConfirm}>
              {t("chat.delete.dialog.message")}
            </button>
            {canDeleteSwipe ? (
              <button type="button" className="is-danger" onClick={onDeleteSwipe}>
                {t("chat.delete.dialog.swipe", { current: activeSwipeIndex + 1, total: swipeCount })}
              </button>
            ) : null}
            {canDeleteOtherSwipes ? (
              <button type="button" className="is-danger" onClick={onDeleteOtherSwipes}>
                {t("chat.delete.dialog.otherSwipes")}
              </button>
            ) : null}
            <button type="button" onClick={onDeleteMore}>
              {t("chat.delete.dialog.more")}
            </button>
          </div>
          <div className="ovm-action-sheet__group">
            <button type="button" className="is-cancel" onClick={onClose} autoFocus>
              {t("chat.delete.dialog.cancel")}
            </button>
          </div>
        </div>
      </>,
      document.body,
    );
  }

  return (
    <Modal
      open={!!messageId}
      onClose={onClose}
      title={t("chat.delete.dialog.title")}
      width="max-w-sm"
      panelClassName="mari-chat-style-surface mari-chat-action-panel"
      chatFloatingPanel
    >
      <p className="mb-4 text-sm leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
        {t("chat.delete.dialog.description")}
      </p>
      <div className="grid gap-2" data-component="MessageDeleteActions">
        {canDeleteSwipe && (
          <button type="button" onClick={onDeleteSwipe} className={DELETE_DIALOG_ACTION_CLASS} data-tone="destructive">
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
          <button
            type="button"
            onClick={onDeleteOtherSwipes}
            className={DELETE_DIALOG_ACTION_CLASS}
            data-tone="destructive"
          >
            <Layers size="0.8rem" />
            <span>{t("chat.delete.dialog.otherSwipes")}</span>
          </button>
        )}
        <button type="button" onClick={onConfirm} className={DELETE_DIALOG_ACTION_CLASS} data-tone="destructive">
          <Trash2 size="0.8rem" />
          <span>{t("chat.delete.dialog.message")}</span>
        </button>
        <button type="button" onClick={onDeleteMore} className={DELETE_DIALOG_ACTION_CLASS}>
          <ListChecks size="0.8rem" />
          <span>{t("chat.delete.dialog.more")}</span>
        </button>
        {/* Focus starts on the least destructive choice, not the window's × (panel 3, PR7). */}
        <button
          type="button"
          onClick={onClose}
          className={DELETE_DIALOG_ACTION_CLASS}
          data-autofocus
          data-tone="cancel"
        >
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
  /** A delete selection passes onDelete; a range-export selection passes onExport and never changes the chat. */
  onDelete?: () => void;
  onExport?: () => void;
  /** Shown instead of the count until a message is picked, in a range-export selection. */
  hint?: string;
  onCancel: () => void;
  onUnselectAll: () => void;
  onSelectAllAbove: () => void;
  onSelectAllBelow: () => void;
};

/**
 * New layout (desktop): the selection bar takes the composer's place. Finds the chat's composer and returns its
 * parent so the bar can render there; CSS hides the composer while `data-ov-selecting` is set.
 */
function useComposerSlot(active: boolean) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) {
      setSlot(null);
      return;
    }
    const composer =
      document.querySelector<HTMLElement>('[data-component^="ChatArea"] .mari-chat-input') ??
      document.querySelector<HTMLElement>(".mari-chat-input");
    setSlot(composer?.parentElement ?? null);
    if (!composer) return;
    document.documentElement.setAttribute("data-ov-selecting", "");
    return () => document.documentElement.removeAttribute("data-ov-selecting");
  }, [active]);
  return slot;
}

function OvSelectionBar({
  selectedCount,
  onDelete,
  onCancel,
  onUnselectAll,
  onSelectAllAbove,
  onSelectAllBelow,
}: Omit<MultiSelectBarProps, "open">) {
  const { t } = useTranslation();
  const none = selectedCount === 0;
  return (
    <div
      data-component="MessageMultiSelectBar"
      className="ov-selbar"
      role="toolbar"
      aria-label={t("chat.delete.selection.count", { count: selectedCount })}
    >
      <span className="ov-selbar__count">{t("chat.delete.selection.count", { count: selectedCount })}</span>
      <button type="button" className="ov-selbar__link" onClick={onSelectAllAbove} disabled={none}>
        <ArrowUpToLine size={13} aria-hidden="true" />
        {t("chat.delete.selection.ovAbove")}
      </button>
      <button type="button" className="ov-selbar__link" onClick={onSelectAllBelow} disabled={none}>
        <ArrowDownToLine size={13} aria-hidden="true" />
        {t("chat.delete.selection.ovBelow")}
      </button>
      <button type="button" className="ov-selbar__link" onClick={onUnselectAll} disabled={none}>
        {t("chat.delete.selection.unselectAll")}
      </button>
      <span className="ov-selbar__grow" />
      <button type="button" className="ov-btn" onClick={onCancel}>
        {t("chat.delete.selection.cancel")}
      </button>
      <button type="button" className="ov-btn ov-btn--primary" onClick={onDelete} disabled={none}>
        <Trash2 size={13} aria-hidden="true" />
        {t("chat.delete.selection.ovDelete", { count: selectedCount })}
      </button>
    </div>
  );
}

function MultiSelectBar({
  open,
  selectedCount,
  onDelete,
  onExport,
  hint,
  onCancel,
  onUnselectAll,
  onSelectAllAbove,
  onSelectAllBelow,
}: MultiSelectBarProps) {
  const { t } = useTranslation();
  const overhaulActive = useOverhaulActive();
  const ovSlot = useComposerSlot(open && overhaulActive);
  if (!open) return null;
  if (overhaulActive && ovSlot) {
    return createPortal(
      <OvSelectionBar
        selectedCount={selectedCount}
        onDelete={onDelete}
        onCancel={onCancel}
        onUnselectAll={onUnselectAll}
        onSelectAllAbove={onSelectAllAbove}
        onSelectAllBelow={onSelectAllBelow}
      />,
      ovSlot,
    );
  }

  return (
    <div
      data-component="MessageMultiSelectBar"
      className={cn(
        NEUTRAL_PANEL_SHELL,
        "mari-chat-style-surface mari-chat-action-panel mari-chrome-token-scope fixed bottom-[max(1rem,var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))] left-1/2 z-50 flex w-[min(30rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-2 p-3",
      )}
    >
      <span className="text-center text-xs font-medium text-[var(--marinara-chat-chrome-panel-muted)]">
        {hint && selectedCount === 0 ? hint : t("chat.delete.selection.count", { count: selectedCount })}
      </span>
      <div className="grid grid-cols-2 gap-2">
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={selectedCount === 0}
            className="mari-chat-style-control mari-chrome-control min-h-10 w-full px-3 py-2 text-xs"
          >
            <Download size="0.75rem" />
            <span>{t("chat.rangeExport.export")}</span>
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={selectedCount === 0}
            className="mari-chat-style-control mari-chrome-control min-h-10 w-full px-3 py-2 text-xs"
          >
            <Trash2 size="0.75rem" />
            <span>{t("chat.delete.selection.delete")}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="mari-chat-style-control mari-chrome-control min-h-10 w-full px-3 py-2 text-xs"
        >
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
          className="mari-chat-style-control mari-chrome-control mari-chrome-control--small h-8 w-8 p-0"
        >
          <ChevronUp size="0.85rem" />
        </button>
        <button
          type="button"
          onClick={onUnselectAll}
          disabled={selectedCount === 0}
          className="mari-chat-style-control mari-chrome-control mari-chrome-control--small px-3 text-[0.6875rem]"
        >
          <span>{t("chat.delete.selection.unselectAll")}</span>
        </button>
        <button
          type="button"
          onClick={onSelectAllBelow}
          disabled={selectedCount === 0}
          title={t("chat.delete.selection.below")}
          aria-label={t("chat.delete.selection.below")}
          className="mari-chat-style-control mari-chrome-control mari-chrome-control--small h-8 w-8 p-0"
        >
          <ChevronDown size="0.85rem" />
        </button>
      </div>
    </div>
  );
}

function ChatSettingsLoadingFallback({
  anchor,
  onClose,
}: {
  anchor: ChatFloatingPanelAnchor;
  onClose: (options?: { force?: boolean }) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const phoneLayout = useMatchMedia("(max-width: 767px)");
  // UI overhaul: while the drawer loads, show the same docked pane it opens as, not the old floating window.
  const overhaulActive = useOverhaulActive() && !phoneLayout;
  const ovFloating = useOverhaulStore((state) => state.chatSettingsFloating);
  const ovDocked = overhaulActive && !ovFloating;
  const windowProps = getChatSettingsWindowProps(anchor);

  return (
    <FloatingWindow
      id={CHAT_SETTINGS_WINDOW_ID}
      presentation={phoneLayout ? "sheet" : "window"}
      title={localizeUi("chat.toolbar.settings")}
      titleIcon={<Loader2 size="0.8125rem" className="mari-chrome-accent-icon shrink-0 animate-spin" />}
      closeLabel={localizeUi("ui.chat.chatsettingsdrawer.closeChatSettings")}
      {...windowProps}
      className={cn(
        windowProps.className,
        overhaulActive && "mari-chat-settings-popover mari-chat-settings-drawer ov-cs",
        ovDocked && "ov-cs--docked",
      )}
      onRequestClose={() => onClose({ force: true })}
    >
      <div className="mari-chrome-text-muted flex min-h-32 items-center justify-center px-4 py-8 text-xs">
        {localizeUi("ui.chat.chatsettingsloadingfallback.loadingSettings")}
      </div>
    </FloatingWindow>
  );
}

type ChatCommonOverlaysProps = {
  chat: ChatData | null | undefined;
  settingsOpen: boolean;
  settingsAnchor: ChatFloatingPanelAnchor;
  settingsInitialSection?: ChatSettingsInitialSection;
  /** Drawers only the chat surface can fill (Roleplay's summary, notes, context and agent activity). */
  chatTools?: ChatSettingsTools;
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
  onCloseSettings: (options?: { force?: boolean }) => void;
  onOpenScheduleEditor?: (characterId: string, options?: { initialDay?: string | null }) => void;
  onWizardFinish: (discarded?: boolean) => void;
  onClosePeekPrompt: () => void;
  onDeleteConfirm: () => void;
  onDeleteSwipe: () => void;
  onDeleteOtherSwipes: () => void;
  onDeleteMore: () => void;
  onCloseDeleteDialog: () => void;
  onBulkDelete?: () => void;
  onExportSelected?: () => void;
  multiSelectHint?: string;
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
  chatTools,
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
  onOpenScheduleEditor,
  onWizardFinish,
  onClosePeekPrompt,
  onDeleteConfirm,
  onDeleteSwipe,
  onDeleteOtherSwipes,
  onDeleteMore,
  onCloseDeleteDialog,
  onBulkDelete,
  onExportSelected,
  multiSelectHint,
  onCancelMultiSelect,
  onUnselectAllMessages,
  onSelectAllAboveSelection,
  onSelectAllBelowSelection,
}: ChatCommonOverlaysProps) {
  // Popped-out sections render from inside Chat Settings, so it stays mounted (hidden) while any is out.
  // The setup wizard sits below floating windows, so they wait until it closes; their layout is kept.
  const settingsSectionsPoppedOut = useHostHasDetachedDrawers(CHAT_SETTINGS_WINDOW_ID) && !wizardOpen;
  return (
    <>
      {chat && (settingsOpen || settingsSectionsPoppedOut) && (
        <Suspense
          fallback={
            settingsOpen ? <ChatSettingsLoadingFallback anchor={settingsAnchor} onClose={onCloseSettings} /> : null
          }
        >
          <ChatSettingsDrawer
            chat={chat}
            open={settingsOpen}
            onClose={onCloseSettings}
            anchor={settingsAnchor}
            showHelpLayout
            initialSection={settingsInitialSection}
            chatTools={chatTools ?? {}}
            spriteArrangeMode={sceneSettings.spriteArrangeMode}
            onToggleSpriteArrange={sceneSettings.onToggleSpriteArrange}
            onResetSpritePlacements={sceneSettings.onResetSpritePlacements}
            onResetSpriteCharacterVisualSettings={sceneSettings.onResetSpriteCharacterVisualSettings}
            onSpriteSideChange={sceneSettings.onSpriteSideChange}
            spriteVisualSettings={sceneSettings.spriteVisualSettings}
            onSpriteVisualSettingsChange={sceneSettings.onSpriteVisualSettingsChange}
            avatarLayout={sceneSettings.avatarLayout}
            onOpenScheduleEditor={onOpenScheduleEditor}
          />
        </Suspense>
      )}
      {chat && <ChatBranchGraphWindow chatId={chat.id} groupId={chat.groupId ?? null} />}
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
        onExport={onExportSelected}
        hint={multiSelectHint}
        onCancel={onCancelMultiSelect}
        onUnselectAll={onUnselectAllMessages}
        onSelectAllAbove={onSelectAllAboveSelection}
        onSelectAllBelow={onSelectAllBelowSelection}
      />
    </>
  );
}
