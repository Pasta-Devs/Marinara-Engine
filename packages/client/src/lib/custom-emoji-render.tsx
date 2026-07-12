// ──────────────────────────────────────────────
// Render `:name:` custom-emoji tokens as inline images within message text.
// Conversation-only: callers pass a name→url map; with an empty map this is a
// no-op pass-through, so other surfaces are unaffected. Inline styles override
// the `.mari-message-content img` rule (rounding/margins) without !important.
// ──────────────────────────────────────────────
import { type CSSProperties, type ReactNode } from "react";
import { resolveStandardEmojiShortcode } from "./emoji-shortcodes";

const CUSTOM_EMOJI_TOKEN_RE = /:([a-z0-9_]+):/gi;

const customEmojiStyle: CSSProperties = {
  display: "inline-block",
  height: "1.4em",
  width: "auto",
  verticalAlign: "-0.3em",
  margin: "0 0.05em",
  borderRadius: 0,
  objectFit: "contain",
};

// Discord-style: a segment that is ONLY custom emojis (+ whitespace) renders them large.
const customEmojiJumboStyle: CSSProperties = {
  ...customEmojiStyle,
  height: "2.5em",
  verticalAlign: "-0.45em",
  margin: "0.05em 0.1em",
};

/**
 * Replace known `:name:` tokens in `text` with their custom-emoji image, passing
 * everything else through `baseRender` (markdown / mentions). Unknown `:tokens:`
 * are left as text. Returns `baseRender(text, keyPrefix)` unchanged when the map
 * is empty or there is no `:` to match.
 */
export function renderInlineWithCustomEmojis(
  text: string,
  keyPrefix: string,
  emojiMap: Map<string, string>,
  baseRender: (text: string, keyPrefix: string) => ReactNode[],
): ReactNode[] {
  if (!text.includes(":")) return baseRender(text, keyPrefix);

  // Jumbo when the whole segment is only known custom emojis (+ whitespace).
  let knownCount = 0;
  const remainder = text.replace(
    new RegExp(CUSTOM_EMOJI_TOKEN_RE.source, CUSTOM_EMOJI_TOKEN_RE.flags),
    (full, name) => {
      if (name && emojiMap.has(name)) {
        knownCount++;
        return "";
      }
      return full;
    },
  );
  const style = knownCount > 0 && remainder.trim().length === 0 ? customEmojiJumboStyle : customEmojiStyle;

  const parts: ReactNode[] = [];
  const re = new RegExp(CUSTOM_EMOJI_TOKEN_RE.source, CUSTOM_EMOJI_TOKEN_RE.flags);
  let lastIndex = 0;
  let segment = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const name = match[1];
    const url = name ? emojiMap.get(name) : undefined;
    const standardEmoji = !url && name ? resolveStandardEmojiShortcode(name) : null;
    if (!url && !standardEmoji) continue; // not a known emoji — leave the token for the surrounding text
    if (match.index > lastIndex) {
      parts.push(baseRender(text.slice(lastIndex, match.index), `${keyPrefix}-t${segment}`));
    }
    if (url) {
      parts.push(<img key={`${keyPrefix}-e${segment}`} src={url} alt={match[0]} title={match[0]} style={style} />);
    } else {
      parts.push(baseRender(standardEmoji!, `${keyPrefix}-e${segment}`));
    }
    lastIndex = match.index + match[0].length;
    segment++;
  }

  if (parts.length === 0) return baseRender(text, keyPrefix);
  if (lastIndex < text.length) parts.push(baseRender(text.slice(lastIndex), `${keyPrefix}-t${segment}`));
  return parts;
}
