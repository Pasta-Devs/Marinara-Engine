// ──────────────────────────────────────────────
// Creator Notes: CSS extraction
// ──────────────────────────────────────────────

const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

/**
 * Separate CSS `<style>` blocks from the human-readable portion
 * of a character card's `creator_notes` field.
 */
export function extractCreatorNotesCss(creatorNotes: string): {
  css: string;
  text: string;
} {
  const cssBlocks: string[] = [];
  const text = creatorNotes
    .replace(STYLE_BLOCK_RE, (_match, css: string) => {
      cssBlocks.push(css);
      return "";
    })
    .trim();
  return { css: cssBlocks.join("\n"), text };
}
