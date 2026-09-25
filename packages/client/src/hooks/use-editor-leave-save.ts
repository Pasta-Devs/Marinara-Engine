import { useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { registerEditorLeaveHandler } from "../lib/editor-leave";

/** Flush the existing save before an editor is replaced, keeping failed drafts mounted. */
export function useEditorLeaveSave(key: string, dirty: boolean, save: () => Promise<boolean | void>, busy = false) {
  const { t } = useTranslation();
  const latest = useRef({ dirty, save, busy, t });
  useLayoutEffect(() => {
    latest.current = { dirty, save, busy, t };
  });
  useLayoutEffect(() => {
    let pending = false;
    let active = true;
    let latestNavigation: (() => void) | null = null;
    const unregister = registerEditorLeaveHandler({
      key,
      request: (proceed) => {
        latestNavigation = proceed;
        if (pending) return true;
        // Keyboard/back navigation does not necessarily blur first. Let the
        // existing field-level autosavers commit before their editor unmounts.
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
        void current
          .save()
          .then((saved) => {
            if (active && saved !== false) latestNavigation?.();
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
}
