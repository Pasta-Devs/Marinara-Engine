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
        // Unbalanced (truncated/streaming) — leave the `[` in place and move on
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
  const lower = tagPrefix.toLowerCase();
  let result = text;
  let searchFrom = 0;
  while (true) {
    const idx = result.toLowerCase().indexOf(lower, searchFrom);
    if (idx === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = idx; i < result.length; i++) {
      if (result[i] === "[") depth++;
      else if (result[i] === "]") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) {
      searchFrom = idx + 1;
      continue;
    }
    result = result.slice(0, idx) + result.slice(end + 1);
  }
  return result;
}

export function stripMapUpdateTag(text: string): string {
  return stripBalancedTag(text, "[map_update:").replace(/\[map_update:[^\r\n]*(?:\r?\n|$)/gi, "");
}

/** Remove dangling closers left behind by malformed or partially stripped tags. */
export function stripDanglingTagClosers(text: string): string {
  return text.replace(/^\s*[\]}]+\s*$/gm, "");
}

/**
 * Strip all GM tags EXCEPT [Note:] and [Book:] — these are kept inline
 * so the narration parser can create readable segments at the correct
 * story position.
 */
export function stripGmTagsKeepReadables(content: string): string {
  let text = content
    // Strip the tactical-combat recap block sent after a battle (multiline, no colon).
    .replace(/\[combat_result\][\s\S]*?\[\/combat_result\]/gi, "")
    .replace(/\[music:\s*[^\]]+\]/gi, "")
    .replace(/\[sfx:\s*[^\]]+\]/gi, "")
    .replace(/\[bg:\s*[^\]]+\]/gi, "")
    .replace(/\[ambient:\s*[^\]]+\]/gi, "")
    .replace(/\[qte:\s*[^\]]+\]/gi, "")
    .replace(/\[state:\s*[^\]]+\]/gi, "")
    .replace(/\[reputation:\s*[^\]]+\]/gi, "")
    .replace(/\[combat:\s*[^\]]+\]/gi, "")
    .replace(/\[direction:\s*[^\]]+\]/gi, "")
    .replace(/\[widget:\s*[^\]]+\]/gi, "")
    .replace(/\[dialogue:\s*npc="[^"]*"\]/gi, "")
    .replace(/\[session_end:\s*[^\]]*\]/gi, "")
    .replace(/\[skill_check:\s*[^\]]+\]/gi, "")
    .replace(/\[element_attack:\s*[^\]]+\]/gi, "")
    .replace(/\[inventory:\s*[^\]]+\]/gi, "")
    .replace(/\[party_change:\s*[^\]]+\]/gi, "")
    .replace(/\[party_add:\s*[^\]]+\]/gi, "")
    .replace(/\[party-turn\]/gi, "")
    .replace(/\[party-chat\]/gi, "")
    .replace(/\[dice:\s*[^\]]+\]/gi, "");
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
  // Catch-all: strip unknown [tag: ...] except [Note:] and [Book:]
  text = text.replace(/\[(?!Note:|Book:)\w+:[^\]]*\]/g, "");
  // NOTE: [Note:] and [Book:] are intentionally kept!
  text = stripDanglingTagClosers(text);
  return text.trim();
}
