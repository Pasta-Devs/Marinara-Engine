// ──────────────────────────────────────────────
// Message box placeholder from the theme (token contract v1.1)
//
// A theme sets `--mari-composer-placeholder: "> waiting for user input..."` on :root, or on one
// composer (`[data-composer="game"]`), and the message box shows it while it's empty. Text that
// asks for keys or passwords is ignored, the same rule as a theme's added text.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { looksLikeSecretRequest } from "../lib/theme-guard";
import { afterNextPaint } from "../lib/after-paint";

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

// The last text each kind of message box got, so a box mounting with a new chat tab starts with it.
const lastThemed = new Map<string, string | null>();

export function useThemedPlaceholder(composer: "roleplay" | "conversation" | "game", fallback: string) {
  const [themed, setThemed] = useState<string | null>(() => lastThemed.get(composer) ?? null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const read = () => {
      const element =
        document.querySelector(`[data-mari-part="composer"][data-composer="${composer}"]`) ?? document.documentElement;
      const text = parseCssStringToken(getComputedStyle(element).getPropertyValue("--mari-composer-placeholder"));
      const next = text && !looksLikeSecretRequest(text) ? text : null;
      lastThemed.set(composer, next);
      setThemed(next);
    };
    // Read once the frame is painted: reading a computed style right after a chat tab mounts made Safari
    // restyle the whole page on the spot (about 0.1-0.3 s on a tablet, Nov 15).
    let cancel = afterNextPaint(read);
    const schedule = () => {
      cancel();
      cancel = afterNextPaint(read);
    };
    // Themes arrive as <style> elements in <head>; per-chat themes and tags change <html> attributes.
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-custom-theme", "data-chat-id", "data-chat-tags", "data-theme", "data-visual-theme"],
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      cancel();
    };
  }, [composer]);
  return themed ?? fallback;
}
