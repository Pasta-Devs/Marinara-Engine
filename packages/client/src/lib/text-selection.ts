type EditableTextInput = HTMLInputElement | HTMLTextAreaElement;
type TextSelectionDirection = "forward" | "backward" | "none";

export interface TextSelectionSnapshot {
  element: EditableTextInput;
  start: number;
  end: number;
  direction: TextSelectionDirection;
}

export function captureTextSelection(element: EditableTextInput): TextSelectionSnapshot | null {
  if (typeof element.selectionStart !== "number") return null;
  return {
    element,
    start: element.selectionStart,
    end: element.selectionEnd ?? element.selectionStart,
    direction: element.selectionDirection ?? "none",
  };
}

function applyTextSelection(snapshot: TextSelectionSnapshot) {
  if (typeof document !== "undefined" && document.activeElement !== snapshot.element) return;
  const max = snapshot.element.value.length;
  snapshot.element.setSelectionRange(Math.min(snapshot.start, max), Math.min(snapshot.end, max), snapshot.direction);
}

export function restoreTextSelectionAfterRender(snapshot: TextSelectionSnapshot): () => void {
  let canceled = false;
  const frameIds: number[] = [];
  const expectedValue = snapshot.element.value;

  const restore = () => {
    if (!canceled && snapshot.element.value === expectedValue) applyTextSelection(snapshot);
  };

  restore();

  if (typeof queueMicrotask === "function") {
    queueMicrotask(restore);
  }

  if (typeof window !== "undefined") {
    frameIds.push(
      window.requestAnimationFrame(() => {
        restore();
        frameIds.push(window.requestAnimationFrame(restore));
      }),
    );
  }

  return () => {
    canceled = true;
    if (typeof window !== "undefined") {
      frameIds.forEach((id) => window.cancelAnimationFrame(id));
    }
  };
}

/** Native selections belong to the browser, including selections inside editors. */
export function hasActiveTextSelection(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (
    (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) &&
    active.selectionStart !== null &&
    active.selectionEnd !== null &&
    active.selectionStart !== active.selectionEnd
  )
    return true;
  const selection = document.getSelection();
  return !!selection && !selection.isCollapsed;
}
