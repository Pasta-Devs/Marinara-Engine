// The Prompt viewer's console is a separate chunk: the tab strip asks it about unsaved edits through this small
// hook instead of importing it.
let guard: ((proceed: () => void) => boolean) | null = null;

export function setPromptViewerCloseGuard(next: typeof guard) {
  guard = next;
}

/** Closing the Prompt viewer tab: true when it asks first (unsaved edits) and runs `proceed` itself. */
export function requestPromptViewerTabClose(proceed: () => void): boolean {
  return guard ? guard(proceed) : false;
}
