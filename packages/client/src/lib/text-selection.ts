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

  const restore = () => {
    if (!canceled) applyTextSelection(snapshot);
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
