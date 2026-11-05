import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useUIStore } from "../stores/ui.store";
import { fieldLabel } from "../lib/mari-edit-diff";
import type { LorebookEntry } from "@marinara-engine/shared";
import { findMariField, mariFieldDraft, mariFieldPath, type MariEditorKind } from "../lib/mari-editor-fields";
import { confirmEditorLeave } from "../lib/editor-leave";
import { queryClient } from "../lib/query-client";
import { lorebookKeys } from "./use-lorebooks";
import { agentKeys, type AgentConfigRow } from "./use-agents";

/**
 * Prof. Mari and the `[data-mari-field]` fields of one editor scroll root: reports the focused field,
 * shows a field she asks for (scroll + one pulse), glows the field her running step writes and tells
 * whether that field is above or below the visible area. `memberIds`: records shown inside this one
 * (a lorebook's entries).
 */
export function useMariEditorFields(
  contentRef: RefObject<HTMLDivElement | null>,
  entityId: string | null,
  ready: boolean,
  scrollToElement: (target: HTMLElement) => void,
  memberIds?: ReadonlySet<string>,
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
      setActiveEditorField(id ? { id, label: mariFieldLabel(id) } : null);
    };
    // The editor header (name, title inputs) sits outside the scroll root.
    const focusRoot = root.closest<HTMLElement>(".mari-editor-shell") ?? root;
    focusRoot.addEventListener("focusin", onFocusIn);
    return () => focusRoot.removeEventListener("focusin", onFocusIn);
  }, [contentRef, ready, setActiveEditorField]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root || !ready || !reveal || (reveal.entityId !== entityId && !memberIds?.has(reveal.entityId))) return;
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
  }, [contentRef, ready, reveal, entityId, memberIds, scrollToElement, endPulse]);

  useEffect(() => {
    const root = contentRef.current;
    const mine = working && (working.entityId === entityId || memberIds?.has(working.entityId));
    const field = root && ready && mine ? findMariField(root, working.path) : null;
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
  }, [contentRef, ready, working, entityId, memberIds]);

  const revealWorkingField = useCallback(() => {
    if (working) useUIStore.getState().revealMariField(working.entityId, working.path);
  }, [working]);

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

// ponytail: an entry's lorebook comes from the entry lists loaded this session; an entry of a lorebook
// never opened here cannot open at its field. Upgrade: the server names the lorebook on entry changes.
function cachedEntry(entryId: string): LorebookEntry | undefined {
  for (const [, entries] of queryClient.getQueriesData<LorebookEntry[]>({
    queryKey: [...lorebookKeys.all, "entries"],
  })) {
    const entry = Array.isArray(entries) ? entries.find((item) => item.id === entryId) : undefined;
    if (entry) return entry;
  }
}
function entryLorebookId(entryId: string): string | null {
  return cachedEntry(entryId)?.lorebookId ?? null;
}

/** A field's label; an entry field also names its entry ("Smugglers · Content"). */
export function mariFieldLabel(fieldId: string, label = fieldLabel(fieldId)): string {
  const [, entryId] = /^entries\.([^.]+)\./.exec(fieldId) ?? [];
  const name = entryId ? cachedEntry(entryId)?.name : undefined;
  return name ? `${name} · ${label}` : label;
}

const LOREBOOK_DETAIL = {
  openId: (ui: UIState) => ui.lorebookDetailId,
  open: (ui: UIState, id: string, entityId: string, path?: string) => {
    ui.openLorebookDetail(id);
    if (path) ui.revealMariField(entityId, path);
  },
};

// Which record each editor kind has open, the record a field's editor opens (an entry's lorebook),
// and how to open it at a field.
const EDITOR_DETAIL: Record<
  MariEditorKind,
  {
    openId: (ui: UIState) => string | null;
    recordId?: (entityId: string) => string | null;
    open: (ui: UIState, id: string, entityId: string, path?: string) => void;
  }
> = {
  character: {
    openId: (ui) => ui.characterDetailId,
    open: (ui, id, _entityId, path) => ui.openCharacterDetail(id, path ? { revealField: path } : undefined),
  },
  persona: {
    openId: (ui) => ui.personaDetailId,
    open: (ui, id, _entityId, path) => {
      ui.openPersonaDetail(id);
      if (path) ui.revealMariField(id, path);
    },
  },
  lorebook: LOREBOOK_DETAIL,
  lorebookEntry: { ...LOREBOOK_DETAIL, recordId: entryLorebookId },
  preset: {
    openId: (ui) => ui.presetDetailId,
    open: (ui, id, _entityId, path) => {
      ui.openPresetDetail(id);
      if (path) ui.revealMariField(id, path);
    },
  },
  agent: {
    // The agent editor opens by agent type or config id; her changes name the config id.
    openId: (ui) => {
      const open = ui.agentDetailId;
      const configs = queryClient.getQueryData<AgentConfigRow[]>(agentKeys.all);
      return configs?.find((config) => config.type === open || config.id === open)?.id ?? open;
    },
    open: (ui, id, _entityId, path) => {
      ui.openAgentDetail(id);
      if (path) ui.revealMariField(id, path);
    },
  },
};

function editorRecordId(kind: MariEditorKind, entityId: string): string | null {
  const recordId = EDITOR_DETAIL[kind].recordId;
  return recordId ? recordId(entityId) : entityId;
}

/** True when an editor shows this record. */
export function isMariEditorOpen(entityId: string): boolean {
  const ui = useUIStore.getState();
  return (Object.keys(EDITOR_DETAIL) as MariEditorKind[]).some((kind) => {
    const id = editorRecordId(kind, entityId);
    return !!id && EDITOR_DETAIL[kind].openId(ui) === id;
  });
}

/** Opens a record's editor, at one field when given (`data.first_mes` or `first_mes`). False when the user
 * stays or the editor cannot be found. */
export function openEditorAtField(
  kind: MariEditorKind,
  entityId: string,
  path: string | undefined,
  leavePrompt: string,
): boolean {
  const ui = useUIStore.getState();
  const id = editorRecordId(kind, entityId);
  if (!id) return false;
  const target = path && mariFieldPath(kind, entityId, path);
  // Already open: nothing is left, so no leave prompt.
  if (EDITOR_DETAIL[kind].openId(ui) === id) {
    if (target) ui.revealMariField(entityId, target);
    return true;
  }
  if (!confirmEditorLeave(ui, leavePrompt)) return false;
  EDITOR_DETAIL[kind].open(ui, id, entityId, target || undefined);
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
