// ──────────────────────────────────────────────
// CreatorNotesCssInjector — extracts CSS from the
// active characters' creator_notes, sanitizes +
// scopes it, and injects a single <style> element
// into <head>. Renders nothing.
// ──────────────────────────────────────────────
import { useEffect, useMemo } from "react";
import { extractCreatorNotesCss } from "../../lib/creator-notes-css";
import { scopeChatCss, filterCssByMode, type ChatModeFilter } from "../../lib/card-css";

export type CardCssMode = "disabled" | "exclusive" | "chat";

type CharacterRow = {
  id: string;
  /** Raw character-card payload — a JSON string or an already-parsed object. */
  data: unknown;
};

interface CreatorNotesCssInjectorProps {
  /** IDs of the characters active in this chat. */
  characterIds: string[];
  /** Catalog rows for resolving each character's card data. */
  allCharacters: CharacterRow[] | undefined;
  /** Injection mode: disabled | exclusive (per-character) | chat (whole area). */
  mode: CardCssMode;
  /** Current chat surface — drives `@chat-mode` filtering. */
  chatMode: ChatModeFilter;
}

const STYLE_ELEMENT_ID = "marinara-card-css";
const SCOPE_SELECTOR = ".mari-card-css";

/**
 * Pulls `<style>` blocks out of every active character's `creator_notes`,
 * sanitizes + scopes them per the selected mode, and injects the combined CSS
 * into the document head. The CSS is injected unlayered so its scoped selectors
 * can override the app's own (partly unlayered) message styling; the sanitizer
 * and per-card scope keep it from reaching anything outside the chat. A single
 * shared `<style>` node is reused/cleared as the active set or mode changes.
 */
export function CreatorNotesCssInjector({ characterIds, allCharacters, mode, chatMode }: CreatorNotesCssInjectorProps) {
  const scopedCss = useMemo(() => {
    if (mode === "disabled" || !allCharacters || characterIds.length === 0) return "";

    const charMap = new Map<string, CharacterRow>();
    for (const char of allCharacters) {
      charMap.set(char.id, char);
    }

    const cssChunks: string[] = [];
    for (const charId of characterIds) {
      const row = charMap.get(charId);
      if (!row) continue;

      let parsed: Record<string, unknown>;
      try {
        if (typeof row.data === "string") {
          parsed = JSON.parse(row.data) as Record<string, unknown>;
        } else if (row.data && typeof row.data === "object") {
          parsed = row.data as Record<string, unknown>;
        } else {
          continue;
        }
      } catch {
        continue;
      }

      const creatorNotes = (parsed as { creator_notes?: string }).creator_notes;
      if (!creatorNotes) continue;

      const { css: rawCss } = extractCreatorNotesCss(creatorNotes);
      if (!rawCss) continue;

      // Keep only rules that target the active surface (@chat-mode blocks).
      const css = filterCssByMode(rawCss, chatMode);
      if (!css.trim()) continue;

      // Exclusive → scope to this character's own messages; chat → whole area.
      const scope = mode === "exclusive" ? `${SCOPE_SELECTOR} [data-card-css="${charId}"]` : SCOPE_SELECTOR;
      const scoped = scopeChatCss(css, scope);
      if (scoped) cssChunks.push(scoped);
    }

    if (cssChunks.length === 0) return "";
    // Injected unlayered (not wrapped in @layer): the app styles some message
    // elements with unlayered rules (e.g. `.mari-message-content { color }` in
    // globals.css), and any @layer always loses to unlayered rules — which would
    // silently neuter most card theming. The scoped selectors above are specific
    // enough to win on their own, while the sanitizer + per-card scope keep card
    // CSS contained to the chat.
    return cssChunks.join("\n");
  }, [characterIds, allCharacters, mode, chatMode]);

  useEffect(() => {
    let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;

    if (!scopedCss) {
      if (styleEl) styleEl.textContent = "";
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ELEMENT_ID;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = scopedCss;

    return () => {
      const el = document.getElementById(STYLE_ELEMENT_ID);
      if (el) el.textContent = "";
    };
  }, [scopedCss]);

  return null;
}
