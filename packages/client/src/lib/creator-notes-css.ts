// ──────────────────────────────────────────────
// Creator-notes CSS — pull <style> blocks out of a
// character card's creator_notes field.
// ──────────────────────────────────────────────

const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

/**
 * Split a character's `creator_notes` into its embedded CSS and the remaining
 * note text. Card authors wrap custom styling in `<style>…</style>` blocks;
 * this lifts every block out so the CSS can be sanitized + scoped separately
 * (see {@link file://./card-css.ts}) and the prose shown on its own.
 */
export function extractCreatorNotesCss(creatorNotes: string): { css: string; text: string } {
  const cssBlocks: string[] = [];
  const text = creatorNotes
    .replace(STYLE_BLOCK_RE, (_match, css: string) => {
      cssBlocks.push(css);
      return "";
    })
    .trim();
  return { css: cssBlocks.join("\n"), text };
}
