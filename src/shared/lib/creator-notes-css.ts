const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

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
