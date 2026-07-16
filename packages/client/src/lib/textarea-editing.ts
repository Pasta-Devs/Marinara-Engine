const INDENT = "  ";

interface TextareaEdit {
  start: number;
  end: number;
  replacement: string;
  selectionStart: number;
  selectionEnd: number;
  selectionDirection: "forward" | "backward" | "none";
}

interface TextareaTabEvent {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  defaultPrevented: boolean;
  currentTarget: HTMLTextAreaElement;
  preventDefault: () => void;
}

function selectedLineRange(value: string, selectionStart: number, selectionEnd: number) {
  const start = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const endsAtNextLineStart = selectionEnd > selectionStart && value[selectionEnd - 1] === "\n";
  const effectiveEnd = endsAtNextLineStart ? selectionEnd - 1 : selectionEnd;
  const nextLineBreak = value.indexOf("\n", effectiveEnd);
  const end = nextLineBreak === -1 ? value.length : nextLineBreak;
  return { start, end };
}

function unindentPrefixLength(value: string): number {
  if (value.startsWith("\t")) return 1;
  if (value.startsWith(INDENT)) return INDENT.length;
  return value.startsWith(" ") ? 1 : 0;
}

function createTabEdit(textarea: HTMLTextAreaElement, unindent: boolean): TextareaEdit | null {
  const value = textarea.value;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const selectionDirection = textarea.selectionDirection ?? "none";

  if (selectionStart === selectionEnd) {
    if (!unindent) {
      return {
        start: selectionStart,
        end: selectionEnd,
        replacement: INDENT,
        selectionStart: selectionStart + INDENT.length,
        selectionEnd: selectionStart + INDENT.length,
        selectionDirection: "none",
      };
    }

    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const removeLength = unindentPrefixLength(value.slice(lineStart));
    if (removeLength === 0) return null;
    const nextCaret = Math.max(lineStart, selectionStart - removeLength);
    return {
      start: lineStart,
      end: lineStart + removeLength,
      replacement: "",
      selectionStart: nextCaret,
      selectionEnd: nextCaret,
      selectionDirection: "none",
    };
  }

  const range = selectedLineRange(value, selectionStart, selectionEnd);
  const lines = value.slice(range.start, range.end).split("\n");
  const replacement = lines
    .map((line) => {
      if (!unindent) return `${INDENT}${line}`;
      return line.slice(unindentPrefixLength(line));
    })
    .join("\n");

  if (replacement === value.slice(range.start, range.end)) return null;
  return {
    start: range.start,
    end: range.end,
    replacement,
    selectionStart: range.start,
    selectionEnd: range.start + replacement.length,
    selectionDirection,
  };
}

function dispatchInput(textarea: HTMLTextAreaElement, replacement: string) {
  const InputEventConstructor = textarea.ownerDocument.defaultView?.InputEvent;
  const event = InputEventConstructor
    ? new InputEventConstructor("input", { bubbles: true, data: replacement, inputType: "insertText" })
    : new Event("input", { bubbles: true });
  textarea.dispatchEvent(event);
}

function applyTextareaEdit(textarea: HTMLTextAreaElement, edit: TextareaEdit) {
  const before = textarea.value;
  const expected = `${before.slice(0, edit.start)}${edit.replacement}${before.slice(edit.end)}`;
  let inputDispatched = false;
  const markInputDispatched = () => {
    inputDispatched = true;
  };

  textarea.addEventListener("input", markInputDispatched, { once: true });
  textarea.setSelectionRange(edit.start, edit.end);

  let appliedWithNativeHistory = false;
  try {
    // execCommand is intentionally used here: unlike assigning `value` or
    // calling setRangeText, it records scripted textarea edits in the native
    // undo stack across Chromium, Firefox, and Safari.
    appliedWithNativeHistory = textarea.ownerDocument.execCommand("insertText", false, edit.replacement);
  } catch {
    // Older embedded browsers can reject execCommand. The fallback still
    // performs the edit, though those browsers cannot preserve native undo.
  }
  textarea.removeEventListener("input", markInputDispatched);

  if (!appliedWithNativeHistory || textarea.value !== expected) {
    if (textarea.value !== before) textarea.value = before;
    textarea.setRangeText(edit.replacement, edit.start, edit.end, "end");
  }
  if (!inputDispatched) dispatchInput(textarea, edit.replacement);

  const restoreSelection = () => {
    if (textarea.ownerDocument.activeElement !== textarea || textarea.value !== expected) return;
    textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd, edit.selectionDirection);
  };
  restoreSelection();
  textarea.ownerDocument.defaultView?.requestAnimationFrame(restoreSelection);
}

/**
 * Applies editor-style Tab and Shift+Tab behavior without discarding the
 * browser's native undo transaction.
 */
export function handleTextareaTab(event: TextareaTabEvent): boolean {
  if (
    event.defaultPrevented ||
    event.key !== "Tab" ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return false;
  }

  event.preventDefault();
  const edit = createTabEdit(event.currentTarget, event.shiftKey);
  if (edit) applyTextareaEdit(event.currentTarget, edit);
  return true;
}
