import { formatTextQuotes, type QuoteFormat } from "@marinara-engine/shared";

export function applyTextareaQuoteFormat(textarea: HTMLTextAreaElement, quoteFormat: QuoteFormat): string {
  const raw = textarea.value;
  const formatted = formatTextQuotes(raw, quoteFormat);
  if (raw === formatted) return formatted;

  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  textarea.value = formatted;
  textarea.setSelectionRange(selectionStart, selectionEnd);
  return formatted;
}
