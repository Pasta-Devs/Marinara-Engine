// ──────────────────────────────────────────────
// Lets an open editor hold a chat switch while it asks about unsaved edits.
// The gate returns true when it took over: it asks, and runs `proceed` itself if the user agrees.
// ──────────────────────────────────────────────
type ChatSwitchGate = (proceed: () => void) => boolean;

let gate: ChatSwitchGate | null = null;
let bypass = false;

export function registerChatSwitchGate(next: ChatSwitchGate): () => void {
  gate = next;
  return () => {
    if (gate === next) gate = null;
  };
}

/** True when the switch waits on a question; `proceed` then runs once it is answered yes. */
export function deferChatSwitch(proceed: () => void): boolean {
  if (bypass || !gate) return false;
  return gate(() => {
    bypass = true;
    try {
      proceed();
    } finally {
      bypass = false;
    }
  });
}
