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
/**
 * An editor's unsaved edits, kept in this browser when the page is hidden or unloaded, so a reload
 * (iPad Safari reloads background tabs and ignores beforeunload) can offer them back (user panel 2, N6).
 * `ready`: the editor has loaded the saved item, so a restore lands on top of it.
 */
export interface EditorUnsavedDraft {
  ready: boolean;
  get: () => unknown;
  restore: (value: unknown) => void;
}

const DRAFT_PREFIX = "marinara-editor-draft:";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readDraft(key: string): { savedAt: number; value: unknown } | null {
  try {
    const stored = JSON.parse(localStorage.getItem(DRAFT_PREFIX + key) ?? "null") as {
      savedAt?: number;
      value?: unknown;
    } | null;
    if (!stored || typeof stored.savedAt !== "number" || stored.value === undefined) return null;
    if (Date.now() - stored.savedAt > DRAFT_MAX_AGE_MS) return null;
    return { savedAt: stored.savedAt, value: stored.value };
  } catch {
    return null;
  }
}

function dropDraft(key: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    /* blocked storage: nothing was kept */
  }
}

export function useEditorLeaveSave(
  key: string,
  dirty: boolean,
  save: () => Promise<boolean | void>,
  busy = false,
  draft?: EditorUnsavedDraft,
) {
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
          layout: "row",
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
  // Keep unsaved edits when the page goes away; offer them back once when the editor opens again.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (!dirty || !key || !draftRef.current) return;
    const keep = () => {
      const current = draftRef.current;
      if (!current) return;
      try {
        localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ savedAt: Date.now(), value: current.get() }));
      } catch {
        /* storage full or blocked */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") keep();
    };
    window.addEventListener("pagehide", keep);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", keep);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dirty, key]);
  const wasDirty = useRef(false);
  useEffect(() => {
    // Saved, or left with "Don't save": the kept copy is no longer wanted.
    if (wasDirty.current && !dirty && key) dropDraft(key);
    wasDirty.current = dirty;
  }, [dirty, key]);
  const offeredFor = useRef<string | null>(null);
  const draftReady = draft?.ready ?? false;
  useEffect(() => {
    if (!key || !draftReady || offeredFor.current === key) return;
    offeredFor.current = key;
    const stored = readDraft(key);
    if (!stored) return;
    const minutes = Math.max(1, Math.round((Date.now() - stored.savedAt) / 60_000));
    let restored = false;
    toast(latest.current.t("editor.draft.found", { defaultValue: "Unsaved changes from before the page reloaded" }), {
      id: `editor-draft-${key}`,
      duration: 30_000,
      description: latest.current.t("editor.draft.age", {
        count: minutes,
        defaultValue: "From {{count}} min ago. Restore them, then Save to keep them.",
      }),
      action: {
        label: latest.current.t("editor.draft.restore", { defaultValue: "Restore" }),
        onClick: () => {
          restored = true;
          draftRef.current?.restore(stored.value);
        },
      },
      onDismiss: () => {
        if (!restored) dropDraft(key);
      },
      onAutoClose: () => {
        if (!restored) dropDraft(key);
      },
    });
  }, [draftReady, key]);
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
