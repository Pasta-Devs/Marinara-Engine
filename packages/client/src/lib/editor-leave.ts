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
type LeaveHandler = { key: string; request: (proceed: () => void) => boolean };
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
  return handler.request(proceed);
}
