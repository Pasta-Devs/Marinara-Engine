import { showConfirmDialog } from "../../lib/app-dialogs";
import { afterEditorLeave, editorLeaveKey, hasEditorLeaveHandler } from "../../lib/editor-leave";
import { translate } from "../../localization/i18n";
import { useChatStore } from "../../stores/chat.store";
import { isMobileShellViewport, useUIStore } from "../../stores/ui.store";

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

/**
 * Closes the open detail views, then runs `next`. An editor with its own leave handler saves first, and `next` waits
 * for that save, so the active chat never changes under an editor that stayed open (busy, or a failed save).
 */
export function closeDetailsThen(next: () => void) {
  afterEditorLeave(useUIStore.getState(), () => {
    useUIStore.getState().closeAllDetails();
    // An edit made during the save can hold the editor open again; then the navigation does not happen either.
    if (editorLeaveKey(useUIStore.getState()) !== null) return;
    next();
  });
}

export async function openChatFromPalette(chatId: string) {
  if (!(await confirmLeaveDirtyEditor())) return;
  closeDetailsThen(() => {
    useChatStore.getState().setActiveChatId(chatId);
    // Same test as the shell's overlay layout: while panels overlay the chat, close them so it shows.
    if (isMobileShellViewport()) {
      const ui = useUIStore.getState();
      ui.setSidebarOpen(false);
      ui.closeRightPanel();
    }
  });
}

export async function openEditorFromPalette(open: () => void) {
  if (!(await confirmLeaveDirtyEditor())) return;
  open();
}
