import { stripGameBranchDelimiters } from "./dice-branch.js";
import { stripSheetCommandTags } from "./sheet-command-tag.js";

/**
 * Strip any unknown `[word: ...]` tag the model invents. Walks the text
 * tracking quote state and bracket depth so JSON content like
 * `[some_tag: {"x":[1,2]}]` is removed entirely. The naive
 * `/\[\w+:[^\]]*\]/g` stops at the FIRST `]` and leaves `}]` trailing.
 *
 * `keep` is an optional predicate — return true to skip stripping for
 * tag names that should remain in place (e.g. Note, Book).
 */
export function stripUnknownBracketTags(text: string, keep?: (tagName: string) => boolean): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "[") {
      // Look ahead for `\w+:` — minimum signature of a model-invented tag
      let j = i + 1;
      while (j < text.length && /[A-Za-z0-9_]/.test(text[j]!)) j++;
      const tagName = text.slice(i + 1, j);
      if (j > i + 1 && text[j] === ":" && (!keep || !keep(tagName))) {
        // Walk to balanced `]`, respecting `"`/`'` strings (and `\` escapes)
        let depth = 1;
        let inString: '"' | "'" | null = null;
        let escaped = false;
        let k = j + 1;
        for (; k < text.length; k++) {
          const c = text[k]!;
          if (escaped) {
            escaped = false;
            continue;
          }
          if (c === "\\") {
            escaped = true;
            continue;
          }
          if (inString) {
            if (c === inString) inString = null;
            continue;
          }
          if (c === '"' || c === "'") {
            inString = c;
            continue;
          }
          if (c === "[") depth++;
          else if (c === "]") {
            depth--;
            if (depth === 0) break;
          }
        }
        if (k < text.length) {
          // Found the balanced closing `]` — drop the whole tag
          i = k + 1;
          continue;
        }
        // A truncated tag keeps its remaining text. Do not rescan every nested opener.
        return out + text.slice(i);
      }
    }
    out += text[i];
    i++;
  }
  return out;
}

/**
 * Remove all instances of a bracket-enclosed tag whose content may contain
 * nested brackets (e.g. JSON arrays/objects).  Counts `[` / `]` so the match
 * extends to the *balanced* closing bracket rather than the first `]`.
 */
export function stripBalancedTag(text: string, tagPrefix: string): string {
  // Pair brackets once so repeated unclosed tags cannot rescan the same suffix.
  const ends = new Map<number, number>();
  const opens: number[] = [];
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
    } else if (opens.length > 0 && (char === '"' || char === "'")) quote = char;
    else if (char === "[") opens.push(i);
    else if (char === "]" && opens.length) ends.set(opens.pop()!, i);
  }
  const lower = text.toLowerCase();
  const prefix = tagPrefix.toLowerCase();
  const chunks: string[] = [];
  let from = 0;
  let index = lower.indexOf(prefix);
  while (index !== -1) {
    const end = ends.get(index);
    if (end !== undefined) {
      chunks.push(text.slice(from, index));
      from = end + 1;
    }
    index = lower.indexOf(prefix, end === undefined ? index + 1 : from);
  }
  chunks.push(text.slice(from));
  return chunks.join("");
}

export function stripMapUpdateTag(text: string): string {
  return stripBalancedTag(text, "[map_update:").replace(/\[map_update:[^\r\n]*(?:\r\n|\r|\n)?/gi, "");
}

/** Remove dangling closers left behind by malformed or partially stripped tags. */
export function stripDanglingTagClosers(text: string): string {
  return text.replace(/^[^\S\r\n]*[\]}]+[^\S\r\n]*$/gm, "");
}

/**
 * Strip all GM tags EXCEPT [Note:] and [Book:] — these are kept inline
 * so the narration parser can create readable segments at the correct
 * story position.
 */
export function stripGmTagsKeepReadables(content: string): string {
  // Remove complete combat recaps with a forward-only scan. A malformed recap
  // with repeated opening tags must not search the entire suffix for each one.
  const lower = content.toLowerCase();
  const open = "[combat_result]";
  const close = "[/combat_result]";
  const chunks: string[] = [];
  let from = 0;
  let start = lower.indexOf(open);
  while (start !== -1) {
    const end = lower.indexOf(close, start + open.length);
    if (end === -1) break;
    chunks.push(content.slice(from, start));
    from = end + close.length;
    start = lower.indexOf(open, from);
  }
  chunks.push(content.slice(from));
  let text = chunks.join("").replace(/\[(?:party-turn|party-chat)\]/gi, "");
  // The one-request dice branch delimiters. Three of the four are unreachable by
  // everything below: `stripUnknownBracketTags` and the `[\w+:` catch-all both require a
  // `:` after the name, and `[on success]` has a space before its `]` while `[/branch]`
  // is not a `[name:` head at all. The prose between them is kept — a block only reaches
  // this stripper when the engine's chance pass never ran for it, and deleting narration
  // the player already read would be the worse failure.
  // The Engine resolves every sheet command and rewrites it with the outcome it actually
  // applied, so the bookkeeping is never narration.
  text = stripSheetCommandTags(text);
  text = stripGameBranchDelimiters(text);
  // Quote-aware catch-all for unknown tags, keeping Note/Book inline.
  // Case-insensitive to match extractBalancedTags (which lowercases the prefix);
  // otherwise `[note:]` / `[book:]` would slip past extraction and get stripped.
  text = stripUnknownBracketTags(text, (name) => {
    const lower = name.toLowerCase();
    return lower === "note" || lower === "book";
  });
  // Balanced bracket stripping for non-readable tags
  text = stripMapUpdateTag(text);
  text = stripBalancedTag(text, "[choices:");
  // NOTE: [Note:] and [Book:] are intentionally kept!
  text = stripDanglingTagClosers(text);
  return text.trim();
}
