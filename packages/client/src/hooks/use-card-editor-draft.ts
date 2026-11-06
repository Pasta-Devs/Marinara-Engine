import { useCallback, useRef, useState } from "react";

/** Keep asynchronous save and upload handlers in sync with the latest keystroke. */
export function useCardEditorDraft<T extends object>() {
  const [draft, renderDraft] = useState<T | null>(null);
  const currentDraft = useRef<T | null>(null);
  const updateDraft = useCallback((update: T | null | ((current: T | null) => T | null)) => {
    const next = typeof update === "function" ? update(currentDraft.current) : update;
    currentDraft.current = next;
    renderDraft(next);
  }, []);
  return [draft, updateDraft, currentDraft] as const;
}
