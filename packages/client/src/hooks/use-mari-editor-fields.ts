import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useUIStore } from "../stores/ui.store";
import { fieldLabel } from "../lib/mari-edit-diff";
import { findMariField, mariFieldDraft, type MariEditorKind } from "../lib/mari-editor-fields";
import { confirmEditorLeave } from "../lib/editor-leave";

/**
 * Prof. Mari and the `[data-mari-field]` fields of one editor scroll root: reports the focused field,
 * shows a field she asks for (scroll + one pulse), glows the field her running step writes and tells
 * whether that field is above or below the visible area.
 */
export function useMariEditorFields(
  contentRef: RefObject<HTMLDivElement | null>,
  entityId: string | null,
  ready: boolean,
  scrollToElement: (target: HTMLElement) => void,
) {
  const setActiveEditorField = useUIStore((s) => s.setActiveEditorField);
  const reveal = useUIStore((s) => s.mariRevealField);
  const working = useUIStore((s) => s.mariWorkingField);
  const [offscreen, setOffscreen] = useState<"above" | "below" | null>(null);
  const pulse = useRef<{ field: HTMLElement; timer: number } | null>(null);
  const endPulse = useCallback(() => {
    if (!pulse.current) return;
    window.clearTimeout(pulse.current.timer);
    delete pulse.current.field.dataset.mariPulse;
    pulse.current = null;
  }, []);
  useEffect(() => endPulse, [endPulse]);

  useEffect(() => () => setActiveEditorField(null), [entityId, setActiveEditorField]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root || !ready) return;
    const onFocusIn = (event: FocusEvent) => {
      const id = (event.target as Element).closest<HTMLElement>("[data-mari-field]")?.dataset.mariField;
      setActiveEditorField(id ? { id, label: fieldLabel(id) } : null);
    };
    // The editor header (name, title inputs) sits outside the scroll root.
    const focusRoot = root.closest<HTMLElement>(".mari-editor-shell") ?? root;
    focusRoot.addEventListener("focusin", onFocusIn);
    return () => focusRoot.removeEventListener("focusin", onFocusIn);
  }, [contentRef, ready, setActiveEditorField]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root || !ready || !reveal || reveal.entityId !== entityId) return;
    useUIStore.getState().clearMariRevealField();
    const field = findMariField(root, reveal.path);
    if (!field) return;
    if (reveal.scroll !== false) scrollToElement(field);
    // A new reveal restarts the pulse. Not the effect's cleanup: clearing the request above re-runs
    // this effect, and the pulse must still end.
    endPulse();
    void field.offsetWidth;
    field.dataset.mariPulse = "";
    pulse.current = { field, timer: window.setTimeout(endPulse, 1200) };
  }, [contentRef, ready, reveal, entityId, scrollToElement, endPulse]);

  useEffect(() => {
    const root = contentRef.current;
    const field = root && ready && working?.entityId === entityId ? findMariField(root, working.path) : null;
    if (!root || !field) return;
    field.dataset.mariGlow = "";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const rootTop = entry.rootBounds?.top ?? 0;
        setOffscreen(entry.isIntersecting ? null : entry.boundingClientRect.top < rootTop ? "above" : "below");
      },
      { root },
    );
    observer.observe(field);
    return () => {
      observer.disconnect();
      delete field.dataset.mariGlow;
      setOffscreen(null);
    };
  }, [contentRef, ready, working, entityId]);

  const revealWorkingField = useCallback(() => {
    if (working && entityId) useUIStore.getState().revealMariField(entityId, working.path);
  }, [working, entityId]);

  return { workingOffscreen: offscreen, revealWorkingField };
}

/**
 * Lets Prof. Mari dock as a companion panel beside this editor (desktop) while
 * it is mounted. `contentRef` is the scroll root holding `.mari-editor-content-inner`
 * inside a `.mari-editor-shell` with a `.mari-editor-header`.
 */
export function useMariCompanionEditor(contentRef: RefObject<HTMLElement | null>, ready: boolean) {
  useEffect(() => {
    const root = contentRef.current;
    if (!root || !ready) return;
    const ui = useUIStore.getState();
    ui.setMariCompanionRoot(root);
    return () => {
      if (useUIStore.getState().mariCompanionRoot === root) useUIStore.getState().setMariCompanionRoot(null);
    };
  }, [contentRef, ready]);
}

type UIState = ReturnType<typeof useUIStore.getState>;

// Which record each editor kind has open, and how to open it at a field.
const EDITOR_DETAIL: Record<
  MariEditorKind,
  { openId: (ui: UIState) => string | null; open: (ui: UIState, id: string, path?: string) => void }
> = {
  character: {
    openId: (ui) => ui.characterDetailId,
    open: (ui, id, path) => ui.openCharacterDetail(id, path ? { revealField: path } : undefined),
  },
  persona: {
    openId: (ui) => ui.personaDetailId,
    open: (ui, id, path) => {
      ui.openPersonaDetail(id);
      if (path) ui.revealMariField(id, path);
    },
  },
};

/** True when an editor shows this record. */
export function isMariEditorOpen(entityId: string): boolean {
  const ui = useUIStore.getState();
  return Object.values(EDITOR_DETAIL).some(({ openId }) => openId(ui) === entityId);
}

/** Opens a record's editor, at one field when given (`data.first_mes` or `first_mes`). False when the user stays. */
export function openEditorAtField(
  kind: MariEditorKind,
  entityId: string,
  path: string | undefined,
  leavePrompt: string,
): boolean {
  const ui = useUIStore.getState();
  // Already open: nothing is left, so no leave prompt.
  if (EDITOR_DETAIL[kind].openId(ui) === entityId) {
    if (path) ui.revealMariField(entityId, path);
    return true;
  }
  if (!confirmEditorLeave(ui, leavePrompt)) return false;
  EDITOR_DETAIL[kind].open(ui, entityId, path);
  return true;
}

/** Store the focused editor field's current text and selection for the next Prof. Mari handoff. */
export function captureMariFieldDraft() {
  const active = document.activeElement;
  if (
    !(active instanceof HTMLTextAreaElement) &&
    (!(active instanceof HTMLInputElement) || !["text", "search", "url"].includes(active.type))
  )
    return;
  const fieldId = active.closest<HTMLElement>("[data-mari-field]")?.dataset.mariField;
  if (!fieldId) return;
  useUIStore
    .getState()
    .setMariFieldDraft(mariFieldDraft(fieldId, active.value, active.selectionStart, active.selectionEnd));
}
