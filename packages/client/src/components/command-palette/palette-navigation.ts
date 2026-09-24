import { showConfirmDialog } from "../../lib/app-dialogs";
import { hasEditorLeaveHandler } from "../../lib/editor-leave";
import { translate } from "../../localization/i18n";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";

/**
 * Same guard the chat sidebar uses before navigating away from an editor:
 * editors with their own leave handler prompt themselves; others get a
 * generic "discard unsaved changes?" confirmation.
 */
export async function confirmLeaveDirtyEditor(): Promise<boolean> {
  const ui = useUIStore.getState();
  if (!ui.editorDirty || hasEditorLeaveHandler(ui)) return true;
  return showConfirmDialog({
    title: translate("ui.layout.chatsidebar.unsavedChanges"),
    message: translate("ui.layout.chatsidebar.youHaveUnsavedChangesDiscardAndContinue"),
    confirmLabel: translate("ui.agents.agenteditor.discard"),
    tone: "destructive",
  });
}

export async function openChatFromPalette(chatId: string) {
  if (!(await confirmLeaveDirtyEditor())) return;
  const ui = useUIStore.getState();
  if (ui.hasAnyDetailOpen()) ui.closeAllDetails();
  useChatStore.getState().setActiveChatId(chatId);
  if (window.innerWidth < 768) {
    ui.setSidebarOpen(false);
    ui.closeRightPanel();
  }
}

export async function openEditorFromPalette(open: () => void) {
  if (!(await confirmLeaveDirtyEditor())) return;
  open();
}
