import { useCallback, useEffect, useRef } from "react";
import { formatTextQuotes } from "@marinara-engine/shared";
import { useUIStore } from "../stores/ui.store";
import { captureTextSelection, restoreTextSelectionAfterRender, type TextSelectionSnapshot } from "../lib/text-selection";

type TextInputElement = HTMLInputElement | HTMLTextAreaElement;

function getActiveTextInput(value: string): TextInputElement | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) && !(active instanceof HTMLTextAreaElement)) return null;
  if (active.value !== value || typeof active.selectionStart !== "number") return null;
  return active;
}

export function useQuoteFormatter() {
  const quoteFormat = useUIStore((s) => s.quoteFormat);
  const cancelSelectionRestoreRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cancelSelectionRestoreRef.current?.();
    };
  }, []);

  return useCallback(
    (value: string) => {
      const activeInput = getActiveTextInput(value);
      const selection: TextSelectionSnapshot | null = activeInput ? captureTextSelection(activeInput) : null;

      const formatted = formatTextQuotes(value, quoteFormat);

      if (selection && activeInput && activeInput.value !== formatted) {
        activeInput.value = formatted;
      }

      if (selection) {
        cancelSelectionRestoreRef.current?.();
        cancelSelectionRestoreRef.current = restoreTextSelectionAfterRender(selection);
      }

      return formatted;
    },
    [quoteFormat],
  );
}
