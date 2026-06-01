// ──────────────────────────────────────────────
// CreatorNotesCssInjector — extracts CSS from active
// characters' creator_notes, scopes it, and injects
// a <style> element into <head>.
// ──────────────────────────────────────────────
import { useEffect, useMemo } from "react";
import { extractCreatorNotesCss } from "../../../../../shared/lib/creator-notes-css";
import { scopeChatCss, filterCssByMode, type ChatModeFilter } from "../../../../../shared/lib/chat-css";

type CardCssMode = "disabled" | "exclusive" | "chat";

type CharacterRow = {
  id: string;
  data: string;
};

interface CreatorNotesCssInjectorProps {
  /** Active character IDs in this chat. */
  characterIds: string[];
  /** All characters from the catalog. */
  allCharacters: CharacterRow[] | undefined;
  /** CSS injection mode: disabled | exclusive | chat */
  mode: CardCssMode;
  /** Current chat surface mode — controls @chat-mode filtering. */
  chatMode: ChatModeFilter;
}

const STYLE_ELEMENT_ID = "marinara-card-css";
const SCOPE_SELECTOR = ".mari-card-css";

/**
 * Extracts `<style>` blocks from the creator_notes of all active characters,
 * sanitizes and scopes them, then injects the combined CSS into the document head.
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
        parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      } catch {
        continue;
      }

      const creatorNotes = (parsed as { creator_notes?: string }).creator_notes;
      if (!creatorNotes) continue;

      const { css: rawCss } = extractCreatorNotesCss(creatorNotes);
      if (!rawCss) continue;

      // Filter by @chat-mode blocks — only include rules targeting the active surface
      const css = filterCssByMode(rawCss, chatMode);
      if (!css.trim()) continue;

      // Scope mode determines the selector target
      const scope = mode === "exclusive" ? `${SCOPE_SELECTOR} [data-card-css="${charId}"]` : SCOPE_SELECTOR;
      const scoped = scopeChatCss(css, scope);
      if (scoped) cssChunks.push(scoped);
    }

    if (cssChunks.length === 0) return "";
    return `@layer card-css {\n${cssChunks.join("\n")}\n}`;
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
      // Cleanup on unmount
      const el = document.getElementById(STYLE_ELEMENT_ID);
      if (el) el.textContent = "";
    };
  }, [scopedCss]);

  return null;
}
