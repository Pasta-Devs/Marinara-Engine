import { formatTextQuotes, type QuoteFormat } from "@marinara-engine/shared";
import { captureTextSelection, restoreTextSelectionAfterRender } from "./text-selection";

const pendingSelectionRestores = new WeakMap<HTMLTextAreaElement, () => void>();
const QUOTE_INPUT_TRIGGER_RE = /["'\u2018\u2019\u201a\u201b\u201c\u201d\u201e\u201f]/;

export function shouldFormatTextareaQuotes(inputEvent: InputEvent | undefined, value: string): boolean {
  if (!inputEvent) return QUOTE_INPUT_TRIGGER_RE.test(value);
  const inputType = typeof inputEvent.inputType === "string" ? inputEvent.inputType : "";
  if (inputEvent.isComposing || inputType === "insertCompositionText" || inputType.startsWith("delete")) {
    return false;
  }
  if (typeof inputEvent.data === "string") return QUOTE_INPUT_TRIGGER_RE.test(inputEvent.data);
  if (inputType === "insertFromPaste" || inputType === "insertFromDrop" || inputType === "insertFromYank") {
    return QUOTE_INPUT_TRIGGER_RE.test(value);
  }
  return false;
}

export function applyTextareaQuoteFormat(
  textarea: HTMLTextAreaElement,
  quoteFormat: QuoteFormat,
  inputEvent?: InputEvent,
): string {
  if (!shouldFormatTextareaQuotes(inputEvent, textarea.value)) return textarea.value;
  pendingSelectionRestores.get(textarea)?.();
  pendingSelectionRestores.delete(textarea);

  const raw = textarea.value;
  const formatted = formatTextQuotes(raw, quoteFormat);
  if (raw === formatted) return formatted;

  const selection = captureTextSelection(textarea);
  textarea.value = formatted;
  if (selection) {
    pendingSelectionRestores.set(textarea, restoreTextSelectionAfterRender(selection));
  }
  return formatted;
}
