// ──────────────────────────────────────────────
// Render `sticker:name:` tokens as block images (own line, large) in message text.
// Conversation-only: with an empty map this is a pass-through, so other surfaces
// are unaffected. Stickers are ALWAYS block-level regardless of token position
// (Discord-style). Sticker tokens are split out BEFORE the inline emoji pass so a
// `sticker:kekw:` is never mistaken for the emoji `:kekw:`. Inline styles override
// the `.mari-message-content img` rule without !important.
// ──────────────────────────────────────────────
import { type CSSProperties, type ReactNode } from "react";

const STICKER_TOKEN_RE = /sticker:([a-z0-9_]+):/g;

const stickerStyle: CSSProperties = {
  display: "block",
  maxHeight: "10rem",
  maxWidth: "100%",
  width: "auto",
  margin: "0.25rem 0",
  borderRadius: "0.5rem",
  objectFit: "contain",
};

/**
 * Split `content` on known `sticker:name:` tokens, rendering each as a block image
 * on its own line and everything else through `renderText`. Unknown sticker tokens
 * are left in the surrounding text. Returns `renderText(content, ...)` unchanged
 * when the map is empty or there is no `sticker:` to match.
 */
export function renderWithStickerBlocks(
  content: string,
  stickerMap: Map<string, string>,
  renderText: (text: string, keyPrefix: string) => ReactNode,
): ReactNode {
  if (stickerMap.size === 0 || !content.includes("sticker:")) return renderText(content, "sc");

  const parts: ReactNode[] = [];
  const re = new RegExp(STICKER_TOKEN_RE.source, STICKER_TOKEN_RE.flags);
  let lastIndex = 0;
  let segment = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    const url = match[1] ? stickerMap.get(match[1]) : undefined;
    if (!url) continue; // unknown sticker — leave the token in the surrounding text
    // A sticker is its own block, so whitespace touching the token (the space/newline a user
    // types around it) is cosmetic — trim it so the adjacent text isn't pushed in / indented.
    const before = content.slice(lastIndex, match.index).trim();
    if (before) parts.push(renderText(before, `sc-t${segment}`));
    parts.push(<img key={`sc-${segment}`} src={url} alt={match[0]} title={match[0]} style={stickerStyle} />);
    lastIndex = match.index + match[0].length;
    segment++;
  }

  if (parts.length === 0) return renderText(content, "sc");
  const tail = content.slice(lastIndex).trim();
  if (tail) parts.push(renderText(tail, `sc-t${segment}`));
  return <>{parts}</>;
}
