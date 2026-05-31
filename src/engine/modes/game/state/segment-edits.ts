import type { SkillCheckResult } from "../../../contracts/types/game";
import { formatSkillCheckResultSummary } from "../../../shared/scoring/skill-check-format";

/**
 * Strip GM command tags from message content.
 * Mirrors the client's `stripGmTagsKeepReadables`. Resolved skill checks are
 * preserved as plain text because the roll result is canonical history.
 */
function stripGmCommandTags(content: string): string {
  let text = preserveResolvedSkillCheckResults(content)
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
  // Balanced bracket tags
  text = stripMapUpdateTag(text);
  text = stripBalancedTag(text, "[choices:");
  // Catch-all for unknown [tag: value] (but NOT [Name] or [Note:/Book:])
  text = stripUnknownBracketTags(text, (tagName) => /^note$/i.test(tagName) || /^book$/i.test(tagName));
  text = stripDanglingTagClosers(text);
  return text.trim();
}

function preserveResolvedSkillCheckResults(content: string): string {
  return content.replace(/\[skill_check:\s*([^\]]+)\]/gi, (fullTag, body: string) => {
    const result = parseResolvedSkillCheckBody(body);
    return result ? `Skill check result: ${formatSkillCheckResultSummary(result)}` : fullTag;
  });
}

function parseSkillCheckAttributes(body: string): Map<string, string> {
  const values = new Map<string, string>();
  const attributes = Array.from(body.matchAll(/(\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s\]]+)/g));
  for (const match of attributes) {
    const key = match[1]?.trim().toLowerCase();
    const rawValue = match[2]?.trim();
    if (!key || !rawValue) continue;
    values.set(key, rawValue.replace(/^['"]|['"]$/g, ""));
  }
  return values;
}

function parseSkillCheckRolls(value: string): number[] {
  return value
    .split(/[|,]/)
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isFinite(entry));
}

function parseResolvedSkillCheckBody(body: string): SkillCheckResult | null {
  const values = parseSkillCheckAttributes(body);
  const skill = values.get("skill")?.trim() ?? "";
  const dc = Number.parseInt(values.get("dc") ?? "", 10);
  const rollsValue = values.get("rolls") ?? "";
  const modifier = Number.parseInt(values.get("modifier") ?? "", 10);
  const total = Number.parseInt(values.get("total") ?? "", 10);
  const resultValue = values.get("result")?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
  if (!skill || Number.isNaN(dc) || Number.isNaN(modifier) || Number.isNaN(total) || !resultValue) return null;

  const rolls = parseSkillCheckRolls(rollsValue);
  if (rolls.length === 0) return null;

  const modeValue = values.get("mode")?.trim().toLowerCase();
  const rollMode: SkillCheckResult["rollMode"] =
    modeValue === "advantage" ? "advantage" : modeValue === "disadvantage" ? "disadvantage" : "normal";
  const explicitUsedRoll = Number.parseInt(values.get("used") ?? "", 10);
  const inferredRollFromTotal = total - modifier;
  const usedRoll = Number.isFinite(explicitUsedRoll)
    ? explicitUsedRoll
    : rolls.includes(inferredRollFromTotal)
      ? inferredRollFromTotal
      : rollMode === "advantage"
        ? Math.max(...rolls)
        : rollMode === "disadvantage"
          ? Math.min(...rolls)
          : rolls[0]!;
  const criticalSuccess = resultValue === "critical_success";
  const criticalFailure = resultValue === "critical_failure";
  const success = criticalSuccess ? true : criticalFailure ? false : resultValue === "success";

  return {
    skill,
    dc,
    rolls,
    usedRoll,
    modifier,
    total,
    success,
    criticalSuccess,
    criticalFailure,
    rollMode,
  };
}

/** Remove dangling closers left behind by malformed or partially stripped tags. */
function stripDanglingTagClosers(text: string): string {
  return text.replace(/^\s*[\]}]+\s*$/gm, "");
}

/** Strip a balanced-bracket tag (handles nested brackets like JSON). */
function stripBalancedTag(text: string, tagPrefix: string): string {
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

function stripMapUpdateTag(text: string): string {
  return stripBalancedTag(text, "[map_update:").replace(/\[map_update:[^\r\n]*(?:\r?\n|$)/gi, "");
}

function stripUnknownBracketTags(text: string, keep?: (tagName: string) => boolean): string {
  let out = "";
  let index = 0;
  while (index < text.length) {
    if (text[index] === "[") {
      let cursor = index + 1;
      while (cursor < text.length && /[A-Za-z0-9_]/.test(text[cursor]!)) cursor += 1;
      const tagName = text.slice(index + 1, cursor);
      if (cursor > index + 1 && text[cursor] === ":") {
        let depth = 1;
        let inString: '"' | "'" | null = null;
        let escaped = false;
        let end = cursor + 1;
        for (; end < text.length; end += 1) {
          const char = text[end]!;
          if (escaped) {
            escaped = false;
            continue;
          }
          if (char === "\\") {
            escaped = true;
            continue;
          }
          if (inString) {
            if (char === inString) inString = null;
            continue;
          }
          if (char === '"' || char === "'") {
            inString = char;
            continue;
          }
          if (char === "[") depth += 1;
          if (char === "]") {
            depth -= 1;
            if (depth === 0) break;
          }
        }
        if (end < text.length) {
          if (keep?.(tagName)) {
            out += text.slice(index, end + 1);
          }
          index = end + 1;
          continue;
        }
      }
    }
    out += text[index];
    index += 1;
  }
  return out;
}

// ── Segment parsing (mirrors client parseNarrationSegments indexing) ──

interface ParsedSegment {
  /** Full original text of the segment as it appears in stripped content. */
  originalText: string;
  /** For dialogue lines, the prefix before the spoken content (e.g. `[Kaeya] [smirk]: `). */
  dialoguePrefix?: string;
  /** The original spoken content including any surrounding quotes. */
  dialogueContentRaw?: string;
  /** Whether surrounding quotes were stripped from dialogue content. */
  hadQuotes?: boolean;
  /** Readable subtype for `[Note: ...]` / `[Book: ...]` segments. */
  readableType?: "note" | "book";
}

interface SegmentEditValue {
  content?: string;
  speaker?: string;
  readableContent?: string;
  readableType?: "note" | "book";
}

type SegmentEditableMessage = {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  [key: string]: unknown;
};

const PARTY_LINE_RE =
  /^\s*\[([^\]]+)\]\s*\[(main|side|extra|action|thought|whisper(?::([^\]]+))?)\]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/i;
const COMPACT_DIALOGUE_RE = /^\s*\[([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/;
const LEGACY_DIALOGUE_RE = /^\s*Dialogue\s*\[([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/i;
const NARRATION_PREFIX_RE = /^\s*Narration\s*:\s*(.+)$/i;
const READABLE_PLACEHOLDER_RE = /^__READABLE_\d+__$/;

/** Check if a dialogue content string has surrounding quotes. */
function hasQuotes(s: string): boolean {
  if (s.length < 2) return false;
  return (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("\u201c") && s.endsWith("\u201d")) ||
    (s.startsWith("\u00ab") && s.endsWith("\u00bb"))
  );
}

function parseReadableType(originalText: string): "note" | "book" | undefined {
  const trimmed = originalText.trim();
  if (/^\[book:/i.test(trimmed)) return "book";
  if (/^\[note:/i.test(trimmed)) return "note";
  return undefined;
}

function replaceDialogueSpeaker(prefix: string, speaker: string): string {
  return prefix.replace(/^(\s*)\[[^\]]+\]/, `$1[${speaker}]`);
}

function normalizeSegmentEditValue(value: unknown): SegmentEditValue | null {
  if (typeof value === "string") {
    return { content: value };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const content = typeof record.content === "string" ? record.content : undefined;
  const speaker =
    typeof record.speaker === "string" && record.speaker.trim().length > 0 ? record.speaker.trim() : undefined;
  const readableContent = typeof record.readableContent === "string" ? record.readableContent : undefined;
  const readableType =
    record.readableType === "book" || record.readableType === "note" ? record.readableType : undefined;

  return content !== undefined || speaker !== undefined || readableContent !== undefined || readableType !== undefined
    ? { content, speaker, readableContent, readableType }
    : null;
}

function normalizeInlineVnDialogueLines(source: string): string {
  return source
    .replace(
      /([^\n])\s+(\[[^\]]+\]\s*\[(?:main|side|extra|action|thought|whisper(?::[^\]]+)?)\]\s*(?:\[[^\]]+\])?\s*:)/gi,
      "$1\n$2",
    )
    .replace(
      /(\[[^\]]+\]\s*\[(?:main|side|extra|whisper(?::[^\]]+)?)\]\s*(?:\[[^\]]+\])?\s*:\s*(?:"[^"]*"|“[^”]*”|«[^»]*»))\s+(?=\S)/gi,
      "$1\n",
    );
}

/**
 * Parse tag-stripped content into segments matching the client's indexing.
 * Only tracks enough info to locate and replace segment content.
 */
function parseSegments(stripped: string): ParsedSegment[] {
  // Handle readable placeholders the same way the client does:
  // replace [Note: ...] and [Book: ...] with __READABLE_N__ tokens.
  let source = stripped;
  let readableCount = 0;
  const readableByPlaceholder = new Map<string, string>();
  for (const tag of ["[Note:", "[Book:"] as const) {
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
      const placeholder = `__READABLE_${readableCount++}__`;
      readableByPlaceholder.set(placeholder, source.slice(idx, end + 1));
      source = source.slice(0, idx) + placeholder + source.slice(end + 1);
      searchFrom = idx + placeholder.length;
    }
  }

  const lines = normalizeInlineVnDialogueLines(source).split(/\r?\n/);
  const segments: ParsedSegment[] = [];
  let fallbackText = "";

  const flushFallback = () => {
    if (fallbackText.trim()) {
      segments.push({ originalText: fallbackText.trim() });
      fallbackText = "";
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushFallback();
      continue;
    }

    // Readable placeholder → segment
    if (READABLE_PLACEHOLDER_RE.test(line)) {
      flushFallback();
      const originalText = readableByPlaceholder.get(line) ?? line;
      segments.push({ originalText, readableType: parseReadableType(originalText) });
      continue;
    }

    // Party dialogue
    const partyMatch = line.match(PARTY_LINE_RE);
    if (partyMatch) {
      flushFallback();
      const spokenContent = partyMatch[5]!.trim();
      const prefixEnd = line.lastIndexOf(partyMatch[5]!);
      const prefix = line.slice(0, prefixEnd);
      const rawType = partyMatch[2]!.toLowerCase().replace(/:.*$/, "");
      const quoted = ["main", "side", "extra", "whisper"].includes(rawType) && hasQuotes(spokenContent);
      segments.push({
        originalText: line,
        dialoguePrefix: prefix,
        dialogueContentRaw: spokenContent,
        hadQuotes: quoted,
      });
      continue;
    }

    const narrationMatch = line.match(NARRATION_PREFIX_RE);
    if (narrationMatch) {
      flushFallback();
      segments.push({ originalText: narrationMatch[1]!.trim() });
      continue;
    }

    // Dialogue
    const dialogueMatch = line.match(LEGACY_DIALOGUE_RE) || line.match(COMPACT_DIALOGUE_RE);
    if (dialogueMatch) {
      flushFallback();
      const spokenContent = dialogueMatch[3]!.trim();
      const prefixEnd = line.lastIndexOf(dialogueMatch[3]!);
      const prefix = line.slice(0, prefixEnd);
      const quoted = hasQuotes(spokenContent);
      segments.push({
        originalText: line,
        dialoguePrefix: prefix,
        dialogueContentRaw: spokenContent,
        hadQuotes: quoted,
      });
      continue;
    }

    // Fallback: accumulate narration
    fallbackText += `${fallbackText ? "\n" : ""}${line}`;
  }

  flushFallback();
  return segments;
}

/**
 * Apply segment history overlays to a game message's content.
 *
 * @param content  Raw message content (with GM tags)
 * @param edits    Map of unfiltered segment index → edited content text
 * @param deletedSegments Set of unfiltered segment indices that should be omitted
 * @returns        Modified content with edits applied (command tags stripped,
 *                 since they've already been processed by the engine)
 */
function applySegmentEdits(
  content: string,
  edits: Record<number, SegmentEditValue>,
  deletedSegments: Set<number> = new Set(),
): string {
  if (Object.keys(edits).length === 0 && deletedSegments.size === 0) return content;

  const stripped = stripGmCommandTags(content);
  const segments = parseSegments(stripped);

  let anyApplied = false;
  const output: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const edit = edits[i];

    if (deletedSegments.has(i)) {
      anyApplied = true;
      continue;
    }

    if (edit !== undefined) {
      anyApplied = true;
      if (seg.readableType) {
        const nextReadableContent = edit.readableContent ?? edit.content;
        if (nextReadableContent !== undefined) {
          output.push(
            `[${(edit.readableType ?? seg.readableType) === "book" ? "Book" : "Note"}: ${nextReadableContent}]`,
          );
        } else {
          output.push(seg.originalText);
        }
      } else if (seg.dialoguePrefix) {
        const prefix = edit.speaker ? replaceDialogueSpeaker(seg.dialoguePrefix, edit.speaker) : seg.dialoguePrefix;
        if (edit.content !== undefined) {
          output.push(seg.hadQuotes ? `${prefix}"${edit.content}"` : `${prefix}${edit.content}`);
        } else {
          output.push(`${prefix}${seg.dialogueContentRaw ?? ""}`);
        }
      } else {
        output.push(edit.content ?? seg.originalText);
      }
    } else {
      output.push(seg.originalText);
    }
  }

  // If no edits actually matched any segment, return original content unchanged
  return anyApplied ? output.join("\n\n") : content;
}

function collectSegmentOverlayMaps(chatMeta: Record<string, unknown>): {
  editsByMessage: Map<string, Record<number, SegmentEditValue>>;
  deletesByMessage: Map<string, Set<number>>;
} {
  const editsByMessage = new Map<string, Record<number, SegmentEditValue>>();
  const deletesByMessage = new Map<string, Set<number>>();

  for (const [key, value] of Object.entries(chatMeta)) {
    const isEdit = key.startsWith("segmentEdit:");
    const isDelete = key.startsWith("segmentDelete:");
    if (!isEdit && !isDelete) continue;
    if (isDelete && value !== true && value !== "true") continue;

    const keyBody = key.slice(isEdit ? "segmentEdit:".length : "segmentDelete:".length);
    const lastColon = keyBody.lastIndexOf(":");
    if (lastColon < 0) continue;
    const messageId = keyBody.slice(0, lastColon);
    const segmentIndex = Number.parseInt(keyBody.slice(lastColon + 1), 10);
    if (!messageId || Number.isNaN(segmentIndex)) continue;

    if (isEdit) {
      const edit = normalizeSegmentEditValue(value);
      if (!edit) continue;
      let edits = editsByMessage.get(messageId);
      if (!edits) {
        edits = {};
        editsByMessage.set(messageId, edits);
      }
      edits[segmentIndex] = edit;
      continue;
    }

    let deleted = deletesByMessage.get(messageId);
    if (!deleted) {
      deleted = new Set<number>();
      deletesByMessage.set(messageId, deleted);
    }
    deleted.add(segmentIndex);
  }

  return { editsByMessage, deletesByMessage };
}

export function applyAllSegmentEdits<TMessage extends SegmentEditableMessage>(
  messages: readonly TMessage[],
  chatMeta: Record<string, unknown>,
): TMessage[] {
  const { editsByMessage, deletesByMessage } = collectSegmentOverlayMaps(chatMeta);
  if (editsByMessage.size === 0 && deletesByMessage.size === 0) return [...messages];

  const output: TMessage[] = [];
  for (const message of messages) {
    const messageId = typeof message.id === "string" ? message.id : "";
    const role = typeof message.role === "string" ? message.role : "";
    if (!messageId || (role !== "assistant" && role !== "narrator")) {
      output.push(message);
      continue;
    }

    const edits = editsByMessage.get(messageId);
    const deletedSegments = deletesByMessage.get(messageId);
    if (!edits && !deletedSegments) {
      output.push(message);
      continue;
    }

    const content = typeof message.content === "string" ? message.content : "";
    const nextContent = applySegmentEdits(content, edits ?? {}, deletedSegments ?? new Set<number>());
    if (!nextContent.trim()) continue;
    output.push({ ...message, content: nextContent });
  }

  return output;
}
