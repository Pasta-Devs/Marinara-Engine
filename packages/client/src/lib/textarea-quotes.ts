import { formatTextQuotes, type QuoteFormat } from "@marinara-engine/shared";
import { captureTextSelection, restoreTextSelectionAfterRender } from "./text-selection";

export function applyTextareaQuoteFormat(textarea: HTMLTextAreaElement, quoteFormat: QuoteFormat): string {
  const raw = textarea.value;
  const formatted = formatTextQuotes(raw, quoteFormat);
  if (raw === formatted) return formatted;

  const selection = captureTextSelection(textarea);
  textarea.value = formatted;
  if (selection) restoreTextSelectionAfterRender(selection);
  return formatted;
}
