import { useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { registerEditorLeaveHandler } from "../lib/editor-leave";
import { showChoiceDialog } from "../lib/app-dialogs";
import { useUIStore } from "../stores/ui.store";

/**
 * Every Library editor's save rules, in one place:
 * - Leaving with unsaved edits asks first: Save, Don't save, or Keep editing. Nothing saves on its own.
 * - Ctrl+S (⌘S) saves the open editor.
 * - Reloading or closing the window with unsaved edits asks the browser's own question.
 *
 * `key` is the editor's leave key (`<detailField>:<id>`, see lib/editor-leave), so routing in the
 * UI store asks this editor before it replaces it. An empty key turns all of it off (an editor
 * embedded somewhere that is not the open Library item).
 */
export function useEditorLeaveSave(key: string, dirty: boolean, save: () => Promise<boolean | void>, busy = false) {
  const { t } = useTranslation();
  const latest = useRef({ dirty, save, busy, t });
  useLayoutEffect(() => {
    latest.current = { dirty, save, busy, t };
  });
  useLayoutEffect(() => {
    if (!key) return;
    let pending = false;
    let saving = false;
    let active = true;
    let latestNavigation: (() => void) | null = null;
    const unregister = registerEditorLeaveHandler({
      key,
      request: (proceed) => {
        // A save run from the dialog may itself re-route (a new item reopening under its id).
        if (saving) return false;
        latestNavigation = proceed;
        if (pending) return true;
        // Keyboard/back navigation does not necessarily blur first; let a field commit its text.
        const focused = document.activeElement;
        if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
          flushSync(() => focused.blur());
        }
        const current = latest.current;
        if (current.busy) {
          toast.info(current.t("editor.autosave.busy"));
          return true;
        }
        if (!current.dirty) return false;
        pending = true;
        void showChoiceDialog({
          title: current.t("editor.leave.title"),
          message: current.t("editor.leave.message"),
          choices: [
            { key: "save", label: current.t("connections.accounts.editor.saveAndContinue") },
            { key: "discard", label: current.t("editor.leave.discard"), tone: "destructive" },
          ],
          cancelLabel: current.t("connections.accounts.editor.keepEditing"),
        })
          .then(async (choice) => {
            if (!active || !choice) return;
            if (choice === "save") {
              saving = true;
              try {
                if ((await latest.current.save()) === false) return;
              } finally {
                saving = false;
              }
            }
            // The editor is about to unmount; its edits go with it.
            latest.current = { ...latest.current, dirty: false };
            const navigate = latestNavigation;
            latestNavigation = null;
            navigate?.();
          })
          .catch(() => toast.error(current.t("editor.autosave.failed")))
          .finally(() => {
            pending = false;
          });
        return true;
      },
    });
    return () => {
      active = false;
      unregister();
    };
  }, [key]);
  useEditorSaveShortcut(save, busy, !key);
  // Leaving through "Don't save" drops the edits with the editor; nothing is unsaved any more.
  useEffect(() => () => useUIStore.getState().setEditorDirty(false), []);
  useEffect(() => {
    if (!dirty || !key) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, key]);
}

/** Ctrl+S / ⌘S saves the open editor instead of the browser's "Save page". */
export function useEditorSaveShortcut(save: () => unknown, busy = false, off = false) {
  const latest = useRef({ save, busy });
  useLayoutEffect(() => {
    latest.current = { save, busy };
  });
  useEffect(() => {
    if (off) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (latest.current.busy) return;
      // Commit the field being typed in first, so its text is part of the save.
      const focused = document.activeElement;
      if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
        flushSync(() => focused.blur());
        focused.focus({ preventScroll: true });
      }
      void Promise.resolve()
        .then(latest.current.save)
        .catch(() => undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [off]);
}
