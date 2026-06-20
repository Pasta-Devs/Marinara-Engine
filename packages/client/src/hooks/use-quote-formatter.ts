import { useCallback, useEffect, useRef } from "react";
import { formatTextQuotes } from "@marinara-engine/shared";
import { useUIStore } from "../stores/ui.store";

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
  const restoreFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (restoreFrameRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(restoreFrameRef.current);
      }
    };
  }, []);

  return useCallback(
    (value: string) => {
      const activeInput = getActiveTextInput(value);
      const selection =
        activeInput && activeInput.selectionStart !== null
          ? {
              element: activeInput,
              start: activeInput.selectionStart,
              end: activeInput.selectionEnd ?? activeInput.selectionStart,
              direction: activeInput.selectionDirection ?? "none",
            }
          : null;

      const formatted = formatTextQuotes(value, quoteFormat);

      if (selection && activeInput && activeInput.value !== formatted) {
        activeInput.value = formatted;
        const max = formatted.length;
        activeInput.setSelectionRange(
          Math.min(selection.start, max),
          Math.min(selection.end, max),
          selection.direction,
        );
      }

      if (selection && typeof window !== "undefined") {
        if (restoreFrameRef.current !== null) window.cancelAnimationFrame(restoreFrameRef.current);
        restoreFrameRef.current = window.requestAnimationFrame(() => {
          restoreFrameRef.current = null;
          if (document.activeElement !== selection.element) return;
          const max = selection.element.value.length;
          selection.element.setSelectionRange(
            Math.min(selection.start, max),
            Math.min(selection.end, max),
            selection.direction,
          );
        });
      }

      return formatted;
    },
    [quoteFormat],
  );
}
