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

/** A persona whose creator-notes CSS should also apply (Conversation about-me popout). */
export type PersonaCssRow = {
  id: string;
  creatorNotes?: string | null;
};

interface CreatorNotesCssInjectorProps {
  /** IDs of the characters active in this chat. */
  characterIds: string[];
  /** Catalog rows for resolving each character's card data. */
  allCharacters: CharacterRow[] | undefined;
  /** Personas whose creator-notes CSS should apply (e.g. the active persona). */
  personas?: PersonaCssRow[];
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
export function CreatorNotesCssInjector({
  characterIds,
  allCharacters,
  personas,
  mode,
  chatMode,
}: CreatorNotesCssInjectorProps) {
  const scopedCss = useMemo(() => {
    if (mode === "disabled") return "";

    // Scope + sanitize one creator-notes CSS blob for a given id.
    const scopeCreatorNotesCss = (id: string, creatorNotes: string | null | undefined): string | null => {
      if (!creatorNotes) return null;
      const { css: rawCss } = extractCreatorNotesCss(creatorNotes);
      if (!rawCss) return null;
      const css = filterCssByMode(rawCss, chatMode);
      if (!css.trim()) return null;
      const scope = mode === "exclusive" ? `${SCOPE_SELECTOR} [data-card-css="${id}"]` : SCOPE_SELECTOR;
      const scoped = scopeChatCss(css, scope);
      return scoped || null;
    };

    const cssChunks: string[] = [];

    const charMap = new Map<string, CharacterRow>();
    for (const char of allCharacters ?? []) {
      charMap.set(char.id, char);
    }
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

      const scoped = scopeCreatorNotesCss(charId, (parsed as { creator_notes?: string }).creator_notes);
      if (scoped) cssChunks.push(scoped);
    }

    // Personas: their creator-notes CSS themes the Conversation about-me popout
    // (which carries data-card-css="<personaId>"). Persona message rows have no
    // data-card-css hook, so exclusive-mode persona CSS only reaches the popout.
    for (const persona of personas ?? []) {
      const scoped = scopeCreatorNotesCss(persona.id, persona.creatorNotes);
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
  }, [characterIds, allCharacters, personas, mode, chatMode]);

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
