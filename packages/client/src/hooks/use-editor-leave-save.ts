import { useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { create } from "zustand";
import { editorLeaveKeyForTab, registerEditorLeaveHandler } from "../lib/editor-leave";
import { showChoiceDialog } from "../lib/app-dialogs";
import { isOverhaulLook, useOverhaulStore } from "../stores/overhaul.store";
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
  /** The item's name, so the offer says whose changes they are (user panel 3, PN3). */
  name?: string;
}

/**
 * The open editor's offer of kept edits, shown as a banner under its header (OvEditorHead) rather than a
 * global toast that outlives the editor (user panel 3, PV6/PN3). It stays until Restore or Discard.
 */
export interface EditorDraftOffer {
  key: string;
  name: string;
  savedAt: number;
  /** "found": kept edits to restore; "restored": they are back in the editor, not saved yet. */
  state: "found" | "restored";
  restore: () => void;
  discard: () => void;
}

export const useEditorDraftOfferStore = create<{
  offer: EditorDraftOffer | null;
  setOffer: (offer: EditorDraftOffer | null) => void;
}>((set) => ({
  offer: null,
  setOffer: (offer) => set({ offer }),
}));

function clearOffer(key: string) {
  const store = useEditorDraftOfferStore.getState();
  if (store.offer?.key === key) store.setOffer(null);
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

const PARKED_KEY = "marinara-editor-parked";

function readParked(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(PARKED_KEY) ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Editors whose unsaved edits wait as a draft in their tab (new layout): the tab shows a dot, and the
 * edits come back when the tab is opened again. Kept in this browser, so the dot survives a reload.
 */
export const useParkedDraftsStore = create<{
  keys: string[];
  /**
   * Keys that were already waiting when the page loaded. Their edits come back through the Restore banner
   * like any kept copy, so every tab behaves the same after a reload (keyboard QC round 2, PN24/TP18).
   */
  reloaded: string[];
  park: (key: string) => void;
  unpark: (key: string) => void;
}>((set, get) => {
  const write = (keys: string[]) => {
    try {
      localStorage.setItem(PARKED_KEY, JSON.stringify(keys));
    } catch {
      /* blocked storage: the dot lasts this session */
    }
    set({ keys, reloaded: get().reloaded.filter((key) => keys.includes(key)) });
  };
  const initial = waitingAtLoad();
  return {
    keys: initial,
    reloaded: initial,
    park: (key) => {
      if (!get().keys.includes(key)) write([...get().keys, key]);
    },
    unpark: (key) => {
      if (get().keys.includes(key)) write(get().keys.filter((item) => item !== key));
    },
  };
});

/**
 * Tabs with edits kept in this browser when the page loads: the ones parked before, and any open editor tab
 * whose kept copy survived a reload or crash, so after a reload every such tab shows its dot and asks
 * before it closes (keyboard QC round 2, AC15).
 */
function waitingAtLoad(): string[] {
  const keys = new Set(readParked());
  try {
    for (const tab of useOverhaulStore.getState().tabs) {
      const key = editorLeaveKeyForTab(tab);
      if (key) keys.add(key);
    }
  } catch {
    /* no tabs yet */
  }
  return [...keys].filter((key) => readDraft(key) !== null);
}

/** Drops a tab's waiting draft (closing it with "Discard"). */
export function discardParkedDraft(key: string) {
  dropDraft(key);
  useParkedDraftsStore.getState().unpark(key);
}

/**
 * An item was deleted: its tab closes and any edits waiting for it go, so no tab is left editing
 * something that no longer exists (keyboard QC round 2, TP16).
 */
export function forgetDeletedEditorItem(kind: string, id: string) {
  const overhaul = useOverhaulStore.getState();
  const key = editorLeaveKeyForTab({ kind, id });
  if (key) discardParkedDraft(key);
  const tab = overhaul.tabs.find((entry) => entry.kind === kind && entry.id === id);
  if (tab) overhaul.closeTab(tab);
}

/** Writes the kept copy now. */
function keepDraft(key: string, draft: EditorUnsavedDraft | undefined, lastWritten?: { current: string }) {
  if (!draft) return;
  try {
    const value = JSON.stringify(draft.get());
    if (value === undefined) return;
    if (lastWritten && lastWritten.current === value) return;
    localStorage.setItem(DRAFT_PREFIX + key, `{"savedAt":${Date.now()},"value":${value}}`);
    if (lastWritten) lastWritten.current = value;
  } catch {
    /* storage full or blocked */
  }
}

/** While you type, the kept copy is written this long after the last change (and at least this often). */
const DRAFT_WRITE_DELAY_MS = 1000;
const DRAFT_WRITE_MAX_WAIT_MS = 5000;

export function useEditorLeaveSave(
  key: string,
  dirty: boolean,
  save: () => Promise<boolean | void>,
  busy = false,
  draft?: EditorUnsavedDraft,
) {
  const { t } = useTranslation();
  const latest = useRef({ dirty, save, busy, t });
  const draftRef = useRef(draft);
  draftRef.current = draft;
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
      park: () => {
        // New layout only, and only when this editor has a tab to come back to: the edits wait there.
        if (!isOverhaulLook() || saving || pending || !draftRef.current) return false;
        const tabs = useOverhaulStore.getState().tabs;
        if (!tabs.some((tab) => editorLeaveKeyForTab(tab) === key)) return false;
        const focused = document.activeElement;
        if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
          flushSync(() => focused.blur());
        }
        if (!latest.current.dirty) return false;
        keepDraft(key, draftRef.current);
        useParkedDraftsStore.getState().park(key);
        // The editor is about to unmount; its edits wait in the tab.
        latest.current = { ...latest.current, dirty: false };
        return true;
      },
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
            // "Don't save" throws the edits away, kept copy included, so it is never offered again (PR3).
            if (choice === "discard") {
              discardParkedDraft(key);
              clearOffer(key);
            }
            // The editor is about to unmount; its edits go with it.
            latest.current = { ...latest.current, dirty: false };
            const navigate = latestNavigation;
            latestNavigation = null;
            // Not waiting on the dialog any more: a route the navigation itself takes (closing the editor's
            // tab goes Home, which closes the editor) must pass, not wait for an answer that already came (PN16).
            pending = false;
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
  // Keep unsaved edits in this browser while you work: a moment after each change (so a crash or a killed
  // tab loses at most a second or so of typing), and again when the page goes away. Offered back once
  // when the editor opens again. The copy is only rewritten when it changed.
  const lastWritten = useRef("");
  const writeTimer = useRef<{ timer: number; firstAt: number } | null>(null);
  useEffect(() => {
    if (!dirty || !key || !draftRef.current) return;
    const pendingWrite = writeTimer.current;
    const now = Date.now();
    const firstAt = pendingWrite?.firstAt ?? now;
    if (pendingWrite) window.clearTimeout(pendingWrite.timer);
    const delay = Math.max(0, Math.min(DRAFT_WRITE_DELAY_MS, firstAt + DRAFT_WRITE_MAX_WAIT_MS - now));
    writeTimer.current = {
      firstAt,
      timer: window.setTimeout(() => {
        writeTimer.current = null;
        keepDraft(key, draftRef.current, lastWritten);
      }, delay),
    };
  });
  useEffect(() => {
    if (!dirty || !key) return;
    const keep = () => keepDraft(key, draftRef.current, lastWritten);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") keep();
    };
    window.addEventListener("pagehide", keep);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", keep);
      document.removeEventListener("visibilitychange", onVisibility);
      // Saved, discarded, or the editor closed: a write still waiting is no longer wanted.
      if (writeTimer.current) window.clearTimeout(writeTimer.current.timer);
      writeTimer.current = null;
      lastWritten.current = "";
    };
  }, [dirty, key]);
  const wasDirty = useRef(false);
  useEffect(() => {
    // Saved, or left with "Don't save": the kept copy is no longer wanted.
    if (wasDirty.current && !dirty && key) {
      discardParkedDraft(key);
      const offer = useEditorDraftOfferStore.getState().offer;
      if (offer?.key === key && offer.state === "restored") clearOffer(key);
    }
    wasDirty.current = dirty;
  }, [dirty, key]);
  const offeredFor = useRef<string | null>(null);
  const draftReady = draft?.ready ?? false;
  useEffect(() => {
    if (!key || !draftReady || offeredFor.current === key) return;
    offeredFor.current = key;
    const stored = readDraft(key);
    const parkedStore = useParkedDraftsStore.getState();
    const parked = parkedStore.keys.includes(key) && !parkedStore.reloaded.includes(key);
    parkedStore.unpark(key);
    if (!stored) return;
    // Back to a tab whose edits waited there: they simply come back, still unsaved (the Save button says so).
    if (parked) {
      draftRef.current?.restore(stored.value);
      return;
    }
    const offer: EditorDraftOffer = {
      key,
      name: draftRef.current?.name?.trim() || "",
      savedAt: stored.savedAt,
      state: "found",
      restore: () => {
        // Back in the editor now. The stored copy stays (rewritten as you edit) until Save or "Don't save"
        // drops it, so it never comes back after either (user panel 3, PR3).
        draftRef.current?.restore(stored.value);
        useEditorDraftOfferStore.getState().setOffer({ ...offer, state: "restored" });
      },
      discard: () => {
        dropDraft(key);
        clearOffer(key);
      },
    };
    useEditorDraftOfferStore.getState().setOffer(offer);
  }, [draftReady, key]);
  // The offer belongs to this editor: it goes when the editor does, and comes back when it opens again.
  useEffect(() => {
    if (!key) return;
    return () => {
      offeredFor.current = null;
      clearOffer(key);
    };
  }, [key]);
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
