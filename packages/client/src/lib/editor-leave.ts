const EDITOR_IDS = [
  "characterDetailId",
  "personaDetailId",
  "lorebookDetailId",
  "presetDetailId",
  "connectionDetailId",
  "agentDetailId",
  "toolDetailId",
  "regexDetailId",
] as const;
type EditorIds = Partial<Record<(typeof EDITOR_IDS)[number], string | null>>;
type LeaveHandler = {
  key: string;
  request: (proceed: () => void) => boolean;
  /**
   * New layout: an editor that has its own tab keeps its unsaved edits as a draft in that tab instead of
   * asking, so switching tabs (or opening anything else) just switches. True when it parked them.
   */
  park?: () => boolean;
};
let handler: LeaveHandler | null = null;

export function editorLeaveKey(state: EditorIds): string | null {
  const field = EDITOR_IDS.find((id) => state[id]);
  return field ? `${field}:${state[field]}` : null;
}

export function registerEditorLeaveHandler(next: LeaveHandler) {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function hasEditorLeaveHandler(state: EditorIds): boolean {
  return handler !== null && editorLeaveKey(state) === handler.key;
}

/**
 * Guards every path that leaves an open editor, so no route skips the prompt. An editor with a leave
 * handler saves itself on the way out (the store routes the leave through it), so only editors without
 * one need the prompt.
 */
export function confirmEditorLeave(state: EditorIds & { editorDirty?: boolean }, message: string): boolean {
  return !state.editorDirty || hasEditorLeaveHandler(state) || window.confirm(message);
}

/** Explicit deletion/discard has already been confirmed by the editor. */
export function leaveWithoutSaving(proceed: () => void) {
  const previous = handler;
  handler = null;
  try {
    proceed();
  } finally {
    handler ??= previous;
  }
}

/** Synchronous routing gate; the mounted editor owns the asynchronous save. */
export function deferEditorLeave(state: EditorIds, patch: EditorIds, proceed: () => void): boolean {
  if (!handler || editorLeaveKey(state) !== handler.key) return false;
  if (editorLeaveKey({ ...state, ...patch }) === handler.key) return false;
  if (handler.park?.()) return false;
  return handler.request(proceed);
}

/**
 * Closing the open editor's own tab: that is leaving for real, so it asks (Save / Don't save / Keep
 * editing) and only then runs `proceed`. False when nothing needs asking and the caller goes on.
 */
export function requestEditorClose(key: string, proceed: () => void): boolean {
  if (!handler || handler.key !== key) return false;
  return handler.request(proceed);
}

/** The leave key an editor tab's editor registers (`characterDetailId:<id>`), or null for other tabs. */
export function editorLeaveKeyForTab(tab: { kind: string; id: string }): string | null {
  const field = TAB_EDITOR_FIELDS[tab.kind];
  return field ? `${field}:${tab.id}` : null;
}

const TAB_EDITOR_FIELDS: Record<string, (typeof EDITOR_IDS)[number]> = {
  character: "characterDetailId",
  persona: "personaDetailId",
  lorebook: "lorebookDetailId",
  preset: "presetDetailId",
  connection: "connectionDetailId",
  agent: "agentDetailId",
  regex: "regexDetailId",
};
