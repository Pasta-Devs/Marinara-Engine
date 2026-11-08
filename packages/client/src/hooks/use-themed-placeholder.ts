// ──────────────────────────────────────────────
// Message box placeholder from the theme (token contract v1.1)
//
// A theme sets `--mari-composer-placeholder: "> waiting for user input..."` on :root, or on one
// composer (`[data-composer="game"]`), and the message box shows it while it's empty. Text that
// asks for keys or passwords is ignored, the same rule as a theme's added text.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { looksLikeSecretRequest } from "../lib/theme-guard";

const MAX_LENGTH = 120;

/** Reads a CSS string token (`"text"` or `'text'`); anything else, or nothing, is null. */
export function parseCssStringToken(raw: string): string | null {
  const value = raw.trim();
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value.length < 2 || value[value.length - 1] !== quote) return null;
  const text = value
    .slice(1, -1)
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\(.)/g, "$1")
    .trim();
  return text ? text.slice(0, MAX_LENGTH) : null;
}

export function useThemedPlaceholder(composer: "roleplay" | "conversation" | "game", fallback: string) {
  const [themed, setThemed] = useState<string | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const read = () => {
      const element =
        document.querySelector(`[data-mari-part="composer"][data-composer="${composer}"]`) ?? document.documentElement;
      const text = parseCssStringToken(getComputedStyle(element).getPropertyValue("--mari-composer-placeholder"));
      setThemed(text && !looksLikeSecretRequest(text) ? text : null);
    };
    read();
    // Themes arrive as <style> elements in <head>; per-chat themes and tags change <html> attributes.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-custom-theme", "data-chat-id", "data-chat-tags", "data-theme", "data-visual-theme"],
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [composer]);
  return themed ?? fallback;
}
