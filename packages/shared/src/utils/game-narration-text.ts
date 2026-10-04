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

/** Strip the Engine's complete result blocks from a player's message, the combat recap and the report
 *  of an item used, without retrying every unclosed opening tag. */
export function stripEngineResultBlocks(content: string): string {
  return stripResultBlocks(stripResultBlocks(content, /\[\/?combat_result\]/gi), /\[\/?item_used\]/gi);
}

function stripResultBlocks(content: string, tags: RegExp): string {
  // Remove complete blocks with a forward-only scan. A malformed block with repeated opening tags must
  // not search the entire suffix for each one.
  const chunks: string[] = [];
  let from = 0;
  let start: number | undefined;
  for (const tag of content.matchAll(tags)) {
    if (tag[0][1] !== "/") {
      start ??= tag.index;
      continue;
    }
    if (start === undefined) continue;
    chunks.push(content.slice(from, start));
    from = tag.index + tag[0].length;
    start = undefined;
  }
  chunks.push(content.slice(from));
  return chunks.join("");
}

/**
 * Strip all GM tags EXCEPT [Note:] and [Book:] — these are kept inline
 * so the narration parser can create readable segments at the correct
 * story position.
 */
export function stripGmTagsKeepReadables(content: string): string {
  let text = stripEngineResultBlocks(content).replace(/\[(?:party-turn|party-chat)\]/gi, "");
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

const DIALOGUE_QUOTE_PAIRS = [
  ['"', '"'],
  ["“", "”"],
  ["«", "»"],
  ["「", "」"],
  ["『", "』"],
] as const;

export const DIALOGUE_QUOTE_PATTERN_SOURCE = '"[^"]+"|“[^”]+”|«[^»]+»|「[^」]+」|『[^』]+』';

export const DIALOGUE_QUOTE_CAPTURE_GROUP_PATTERN_SOURCE = '"([^"]+)"|“([^”]+)”|«([^»]+)»|「([^」]+)」|『([^』]+)』';

export const HTML_SAFE_DIALOGUE_QUOTE_PATTERN_SOURCE = '"[^"<>]+"|“[^”<>]+”|«[^»<>]+»|「[^」<>]+」|『[^』<>]+』';

export function stripSurroundingDialogueQuotes(content: string): string {
  if (content.length < 2) return content;

  for (const [open, close] of DIALOGUE_QUOTE_PAIRS) {
    if (content.startsWith(open) && content.endsWith(close)) {
      return content.slice(open.length, content.length - close.length);
    }
  }

  return content;
}

/** One beat of a Game turn as the narration screen shows it. */
export interface GameNarrationTextSegment {
  id: string;
  type: "narration" | "dialogue" | "readable";
  speaker?: string;
  sprite?: string;
  content: string;
  /** Party dialogue delivery subtype for visual styling */
  partyType?: "main" | "side" | "extra" | "action" | "thought" | "whisper";
  /** Whisper target character */
  whisperTarget?: string;
  /** Readable subtype (note or book) — only set when type === "readable" */
  readableType?: "note" | "book";
  /** Full readable content for overlay display — only set when type === "readable" */
  readableContent?: string;
}

/** Split PascalCase/camelCase identifiers into space-separated words.
 *  "FatuiAgent" → "Fatui Agent", "darkKnight" → "dark Knight"
 *  Already-spaced names pass through unchanged. */
function humanizeName(name: string): string {
  if (name.includes(" ") || name.includes("_")) return name;
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

function normalizeInlineVnDialogueLines(source: string): string {
  // The server runs this on every auto-translated Game turn. A non-space lead, `[`-free bracket bodies and
  // one whitespace run around the optional sprite keep long whitespace or `[` runs from rescanning the rest.
  return source
    .replace(
      /(\S)\s+(\[[^[\]]+\]\s*\[(?:main|side|extra|action|thought|whisper(?::[^[\]]+)?)\]\s*(?:\[[^[\]]+\]\s*)?:)/gi,
      "$1\n$2",
    )
    .replace(
      /(\[[^[\]]+\]\s*\[(?:main|side|extra|whisper(?::[^[\]]+)?)\]\s*(?:\[[^[\]]+\]\s*)?:\s*(?:"[^"]*"|“[^”]*”|«[^»]*»))\s+(?=\S)/gi,
      "$1\n",
    );
}

/** Split a Game turn into the narration, dialogue and readable beats the narration screen shows. */
export function parseGameNarrationSegments(
  message: { id: string; content: string },
  extractInlineDialogue = true,
): GameNarrationTextSegment[] {
  // Use stripGmTagsKeepReadables so [Note:] and [Book:] stay inline for position-aware display.
  // Extract them first as placeholders so multi-line readables don't break line-based parsing.
  const withReadables = stripGmTagsKeepReadables(message.content || "");
  const readableContents: Array<{ type: "note" | "book"; content: string }> = [];
  let source = withReadables;
  // Replace [Note: ...] and [Book: ...] with placeholders (balanced bracket aware)
  for (const tag of ["[Note:", "[Book:"] as const) {
    const rType = tag === "[Note:" ? "note" : "book";
    let searchFrom = 0;
    while (true) {
      const idx = source.toLowerCase().indexOf(tag.toLowerCase(), searchFrom);
      if (idx === -1) break;
      let depth = 0;
      let end = -1;
      for (let i = idx; i < source.length; i++) {
        if (source[i] === "[") depth++;
        else if (source[i] === "]") {
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
      const inner = source.slice(idx + tag.length, end).trim();
      const placeholderIdx = readableContents.length;
      readableContents.push({ type: rType, content: inner });
      const placeholder = `\n__READABLE_${placeholderIdx}__\n`;
      source = source.slice(0, idx) + placeholder + source.slice(end + 1);
      searchFrom = idx + placeholder.length;
    }
  }

  const lines = normalizeInlineVnDialogueLines(source).split(/\r?\n/);
  const parsed: GameNarrationTextSegment[] = [];
  // Readable placeholder regex
  const readablePlaceholderRe = /^__READABLE_(\d+)__$/;
  // Legacy format (backward compat): Narration: text
  const narrationRegex = /^\s*Narration\s*:\s*(.+)$/i;
  // Legacy format (backward compat): Dialogue [Name] [expression]: "text"
  const legacyDialogueRegex = /^\s*Dialogue\s*\[([^\]]+)\]\s*(?:\[([^\]]+)\]\s*)?:\s*(.+)$/i;
  // New compact format: [Name]: "text", [Name] [expression]: "text", plus any extra
  // bracket groups a translator may add (e.g. [Name] [main] [patient]: "text").
  // Group 1 = speaker, group 2 = sprite/expression (last bracket), group 3 = dialogue text.
  const compactDialogueRegex = /^\s*\[([^\]]+)\]\s*(?:\[[^\]]+\]\s*)*?(?:\[([^\]]+)\]\s*)?:\s*(.+)$/;
  // Party dialogue lines — parsed inline as VN segments
  const partyLineRegex =
    /^\s*\[([^\]]+)\]\s*\[(main|side|extra|action|thought|whisper(?::([^\]]+))?)\]\s*(?:\[([^\]]+)\]\s*)?:\s*(.+)$/i;

  let fallbackText = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (fallbackText.trim()) {
        parsed.push({
          id: `${message.id}-fallback-${parsed.length}`,
          type: "narration",
          content: fallbackText.trim(),
        });
        fallbackText = "";
      }
      continue;
    }

    // Detect readable placeholders ([Note:] / [Book:] inline markers)
    const readableMatch = line.match(readablePlaceholderRe);
    if (readableMatch) {
      if (fallbackText.trim()) {
        parsed.push({
          id: `${message.id}-fallback-${parsed.length}`,
          type: "narration",
          content: fallbackText.trim(),
        });
        fallbackText = "";
      }
      const rIdx = parseInt(readableMatch[1]!, 10);
      const readable = readableContents[rIdx];
      if (readable) {
        parsed.push({
          id: `${message.id}-readable-${parsed.length}`,
          type: "readable",
          content: readable.type === "book" ? "You find a book..." : "You find a note...",
          readableType: readable.type,
          readableContent: readable.content,
        });
      }
      continue;
    }

    // Parse party dialogue lines inline as VN segments
    const partyMatch = line.match(partyLineRegex);
    if (partyMatch) {
      if (fallbackText.trim()) {
        parsed.push({
          id: `${message.id}-fallback-${parsed.length}`,
          type: "narration",
          content: fallbackText.trim(),
        });
        fallbackText = "";
      }
      const character = humanizeName(partyMatch[1]!.trim());
      let rawType = partyMatch[2]!.toLowerCase().replace(/:.*$/, "") as NonNullable<
        GameNarrationTextSegment["partyType"]
      >;
      const whisperTarget = partyMatch[3]?.trim() ? humanizeName(partyMatch[3].trim()) : undefined;
      const expression = partyMatch[4]?.trim() || undefined;
      let content = partyMatch[5]!.trim();

      // Normalize legacy `extra` → `side` so historical messages render with the single popup style.
      if (rawType === "extra") rawType = "side";

      // Strip surrounding dialogue quotes for spoken dialogue types
      if ((rawType === "main" || rawType === "side" || rawType === "whisper") && content.length >= 2) {
        content = stripSurroundingDialogueQuotes(content);
      }

      // Remap action → plain narration (no special styling)
      if (rawType === "action") {
        parsed.push({
          id: `${message.id}-party-action-${character}-${parsed.length}`,
          type: "narration",
          content,
        });
        continue;
      }
      const isSpoken = rawType === "main" || rawType === "whisper" || rawType === "thought" || rawType === "side";
      parsed.push({
        id: `${message.id}-party-${rawType}-${character}-${parsed.length}`,
        type: isSpoken ? "dialogue" : "narration",
        speaker: character,
        sprite: expression,
        content,
        partyType: rawType,
        whisperTarget,
      });
      continue;
    }

    const narrationMatch = line.match(narrationRegex);
    if (narrationMatch) {
      if (fallbackText.trim()) {
        parsed.push({
          id: `${message.id}-fallback-${parsed.length}`,
          type: "narration",
          content: fallbackText.trim(),
        });
        fallbackText = "";
      }
      parsed.push({
        id: `${message.id}-n-${parsed.length}`,
        type: "narration",
        content: narrationMatch[1]!.trim(),
      });
      continue;
    }

    const dialogueMatch = line.match(legacyDialogueRegex) || line.match(compactDialogueRegex);
    if (dialogueMatch) {
      if (fallbackText.trim()) {
        parsed.push({
          id: `${message.id}-fallback-${parsed.length}`,
          type: "narration",
          content: fallbackText.trim(),
        });
        fallbackText = "";
      }
      const speaker = humanizeName(dialogueMatch[1]!.trim());
      let content = dialogueMatch[3]!.trim();
      content = stripSurroundingDialogueQuotes(content);
      parsed.push({
        id: `${message.id}-d-${parsed.length}`,
        type: "dialogue",
        speaker,
        sprite: dialogueMatch[2]?.trim() || undefined,
        content,
      });
      continue;
    }

    fallbackText += `${fallbackText ? "\n" : ""}${line}`;
  }

  if (fallbackText.trim()) {
    parsed.push({
      id: `${message.id}-fallback-${parsed.length}`,
      type: "narration",
      content: fallbackText.trim(),
    });
  }

  // If all segments are plain fallback narration (GM didn't use structured format),
  // try to extract inline dialogue like: "Hello," she said. / «Hmm,» he muttered.
  if (extractInlineDialogue && parsed.length > 0 && parsed.every((s) => s.type === "narration")) {
    const expanded = splitInlineDialogue(parsed, message.id);
    if (expanded.some((s) => s.type === "dialogue")) {
      return expanded;
    }
  }

  return parsed;
}

/**
 * Fallback: split narration segments that contain inline quoted speech into
 * separate narration + dialogue segments. Handles patterns like:
 *   "Hello there," she said warmly.
 *   «Watch out!» Alaric warned.
 *   「小心！」 Alaric warned.
 */
function splitInlineDialogue(segments: GameNarrationTextSegment[], msgId: string): GameNarrationTextSegment[] {
  const result: GameNarrationTextSegment[] = [];
  // Match common dialogue quote pairs followed by optional comma/period and a speaker name.
  const inlineDialogueRe = new RegExp(
    `(?:^|(?<=\\s))(?:${DIALOGUE_QUOTE_CAPTURE_GROUP_PATTERN_SOURCE}|'([^']+)')[,.]?\\s+([A-Z][a-z]+(?:\\s[A-Z][a-z]+)?)\\s+(?:said|says|whispered|whispers|muttered|mutters|replied|replies|called|calls|shouted|shouts|asked|asks|warned|warns|growled|growls|hissed|hisses|exclaimed|exclaims|murmured|murmurs|sighed|sighs|snapped|snaps|barked|barks|declared|declares|continued|continues|added|adds|spoke|speaks|began|begins|remarked|remarks|chuckled|chuckles|laughed|laughs|cried|cries)\\b`,
    "gi",
  );

  for (const seg of segments) {
    if (seg.type !== "narration") {
      result.push(seg);
      continue;
    }

    const text = seg.content;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let didSplit = false;
    inlineDialogueRe.lastIndex = 0;

    while ((match = inlineDialogueRe.exec(text)) !== null) {
      didSplit = true;
      const before = text.slice(lastIndex, match.index).trim();
      if (before) {
        result.push({
          id: `${msgId}-fallback-split-${result.length}`,
          type: "narration",
          content: before,
        });
      }

      const speech = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? "";
      const speaker = match[7]!;
      result.push({
        id: `${msgId}-inline-d-${result.length}`,
        type: "dialogue",
        speaker,
        content: `"${speech}"`,
      });
      lastIndex = match.index + match[0].length;
    }

    if (didSplit) {
      const after = text.slice(lastIndex).trim();
      if (after) {
        result.push({
          id: `${msgId}-fallback-split-${result.length}`,
          type: "narration",
          content: after,
        });
      }
    } else {
      result.push(seg);
    }
  }

  return result;
}

/** Write one beat back as translator-safe text that parseGameNarrationSegments reads back into the same beat. */
export function formatGameTranslationSegment(
  segment: Pick<GameNarrationTextSegment, "content" | "speaker" | "readableType" | "readableContent"> & {
    type: string;
  },
): string {
  if (segment.type === "readable") {
    const body = (segment.readableContent ?? segment.content).trim();
    return `[${segment.readableType === "book" ? "Book" : "Note"}: ${body}]`;
  }
  if (segment.type === "dialogue" && segment.speaker) {
    // Keep single-line dialogue: a newline inside the body would split this line into
    // an extra segment when parseGameNarrationSegments reads the rebuilt text back.
    // One pass over each whitespace run (no backtracking): a run that holds a newline becomes one space.
    const body = segment.content.replace(/\s+/g, (run) => (run.includes("\n") ? " " : run)).trim();
    // Use strictly single-bracket format `[Speaker]: "text"` so external translators
    // cannot translate internal tags (e.g. `[main] [patient]` -> `[главный] [пациент]`),
    // which would otherwise break reverse parsing and desync segment indices.
    return `[${segment.speaker}]: "${stripSurroundingDialogueQuotes(body)}"`;
  }
  // A blank line inside a narration segment splits it in two on the way back through
  // the parser and shifts every later segment index, so keep single newlines only.
  return segment.content.replace(/\r?\n(?:[ \t]*\r?\n)+/g, "\n");
}

/**
 * The text a Game message sends to a translator. The server's automatic translation and
 * the Game screen must build it the same way: the screen only shows a saved translation
 * whose source equals this text. GM turns are rebuilt beat by beat so the translator never
 * sees internal tags such as `[main]`. `rebuild` lets the Game screen apply segment edits.
 */
export function buildGameTranslationSource(
  message: { id: string; role: string; content: string },
  rebuild?: (segments: GameNarrationTextSegment[]) => string[],
): string {
  const isGmMessage = message.role === "assistant" || message.role === "narrator" || message.role === "system";
  const plainSource = (
    isGmMessage
      ? stripGmTagsKeepReadables(message.content)
      : message.content.replace(/^\[(?:To the party|To the GM)]\s*/i, "")
  ).trim();
  if (!isGmMessage && !rebuild) return plainSource;
  const segments = parseGameNarrationSegments(message);
  const rebuilt = rebuild ? rebuild(segments) : segments.map(formatGameTranslationSegment);
  return rebuilt.join("\n\n").trim() || plainSource;
}
