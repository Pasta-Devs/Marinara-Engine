const THINKING_TAG_NAMES = ["thinking", "thoughts", "thought", "reasoning", "reason", "think"] as const;
const THINKING_TAG_PATTERN = THINKING_TAG_NAMES.join("|");
const OPEN_THINKING_TAG_RE = new RegExp(`^<\\s*(${THINKING_TAG_PATTERN})\\b[^>]*>`, "i");
const CLOSE_THINKING_TAG_RE = new RegExp(`^<\\s*\\/\\s*(${THINKING_TAG_PATTERN})\\s*>`, "i");

export type InlineThinkingPart = { type: "content" | "thinking"; text: string };

function possibleTagPrefix(buffer: string, closing: boolean): boolean {
  if (!buffer.startsWith("<") || buffer.includes(">")) return false;
  const body = buffer.slice(1).replace(/^\s+/, "").toLowerCase();
  const normalized = closing ? body.replace(/^\/\s*/, "") : body;
  if (closing && !body.startsWith("/") && !"/".startsWith(body)) return false;
  if (!/^[\w-]*$/.test(normalized)) return false;
  return THINKING_TAG_NAMES.some((tag) => tag.startsWith(normalized));
}

export function createInlineThinkingStreamParser() {
  let buffer = "";
  let inThinking = false;

  const drain = (final = false): InlineThinkingPart[] => {
    const parts: InlineThinkingPart[] = [];

    while (buffer.length > 0) {
      if (!inThinking) {
        const tagIndex = buffer.indexOf("<");
        if (tagIndex < 0) {
          parts.push({ type: "content", text: buffer });
          buffer = "";
          break;
        }
        if (tagIndex > 0) {
          parts.push({ type: "content", text: buffer.slice(0, tagIndex) });
          buffer = buffer.slice(tagIndex);
          continue;
        }

        const opening = buffer.match(OPEN_THINKING_TAG_RE);
        if (opening) {
          inThinking = true;
          buffer = buffer.slice(opening[0].length);
          continue;
        }
        if (!final && possibleTagPrefix(buffer, false)) break;
        parts.push({ type: "content", text: buffer[0]! });
        buffer = buffer.slice(1);
        continue;
      }

      const tagIndex = buffer.indexOf("<");
      if (tagIndex < 0) {
        parts.push({ type: "thinking", text: buffer });
        buffer = "";
        break;
      }
      if (tagIndex > 0) {
        parts.push({ type: "thinking", text: buffer.slice(0, tagIndex) });
        buffer = buffer.slice(tagIndex);
        continue;
      }

      const closingTag = buffer.match(CLOSE_THINKING_TAG_RE);
      if (closingTag) {
        inThinking = false;
        buffer = buffer.slice(closingTag[0].length);
        continue;
      }
      if (!final && possibleTagPrefix(buffer, true)) break;
      parts.push({ type: "thinking", text: buffer[0]! });
      buffer = buffer.slice(1);
    }

    if (final && buffer.length > 0) {
      parts.push({ type: inThinking ? "thinking" : "content", text: buffer });
      buffer = "";
    }

    return parts;
  };

  return {
    push(text: string): InlineThinkingPart[] {
      if (!text) return [];
      buffer += text;
      return drain(false);
    },
    flush(): InlineThinkingPart[] {
      return drain(true);
    },
  };
}
