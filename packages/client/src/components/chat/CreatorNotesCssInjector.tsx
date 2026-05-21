// ──────────────────────────────────────────────
// Creator Notes CSS Injector
//
// Extracts <style> blocks from each active character's
// creator_notes, sanitises + scopes them, then injects
// a single <style> element into <head>.
//
// Scoped to `.mari-card-css` — the chat surface wrapper
// sets this class so card styles only affect the chat area.
// ──────────────────────────────────────────────
import { useEffect, useMemo } from "react";
import { extractCreatorNotesCss } from "@marinara-engine/shared";
import { scopeChatCss } from "../../lib/chat-css";

const CARD_CSS_SCOPE = ".mari-card-css";
const STYLE_ELEMENT_ID = "marinara-card-css";

export function CreatorNotesCssInjector({
  characters,
  chatCharacterIds,
}: {
  characters: Array<{ id: string; data: string; avatarPath: string | null }> | undefined;
  chatCharacterIds: string[];
}) {
  const scopedCss = useMemo(() => {
    if (!characters?.length || !chatCharacterIds.length) return "";

    const activeIdSet = new Set(chatCharacterIds);
    const cssBlocks: string[] = [];

    for (const char of characters) {
      if (!activeIdSet.has(char.id)) continue;
      try {
        const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
        const creatorNotes: string = parsed.creator_notes ?? "";
        if (!creatorNotes) continue;
        const { css } = extractCreatorNotesCss(creatorNotes);
        if (css) cssBlocks.push(css);
      } catch {
        // Malformed data — skip silently
      }
    }

    if (!cssBlocks.length) return "";
    return scopeChatCss(cssBlocks.join("\n"), CARD_CSS_SCOPE);
  }, [characters, chatCharacterIds]);

  useEffect(() => {
    let style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;

    if (!scopedCss) {
      style?.remove();
      return;
    }

    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ELEMENT_ID;
      document.head.appendChild(style);
    }
    style.textContent = scopedCss;

    return () => {
      style?.remove();
    };
  }, [scopedCss]);

  return null;
}
