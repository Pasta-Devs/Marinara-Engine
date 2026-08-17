// ──────────────────────────────────────────────
// Game: Apply segment history overlays to message content
// ──────────────────────────────────────────────
//
// The VN narration UI lets users edit or delete individual narration/dialogue
// segments. These changes are stored as chat-metadata overlays instead of
// rewriting the raw message (which has multi-segment text + GM tags).
//
// Before sending messages to the model we need to apply those overlays so the
// model sees the corrected text. This module mirrors the client-side
// parseNarrationSegments segment-indexing logic just enough to do that.
// ──────────────────────────────────────────────

import { formatSkillCheckResultSummary, type SkillCheckResult } from "@marinara-engine/shared";

/**
 * Strip GM command tags from message content.
 * Mirrors the client's `stripGmTagsKeepReadables` (minus readable
 * preservation which is irrelevant for segment editing). Resolved skill checks
 * are preserved as plain text because the roll result is canonical history.
 */
export function stripGmCommandTags(content: string): string {
  let text = stripSimpleGmTags(preserveResolvedSkillCheckResults(content));
  // Catch-all for unknown [tag: value] (but NOT [Name] or [Note:/Book:])
  text = stripUnknownGmTags(text);
  text = stripDanglingTagClosers(text);
  return text.trim();
}

const REMOVABLE_GM_TAGS = new Set([
  "music",
  "sfx",
  "bg",
  "ambient",
  "qte",
  "state",
  "reputation",
  "combat",
  "direction",
  "widget",
  "dialogue",
  "session_end",
  "skill_check",
  "element_attack",
  "inventory",
  "party_change",
  "party_add",
  "party-turn",
  "party-chat",
  "dice",
  "choices",
  "map_update",
]);
const VALUELESS_GM_TAGS = new Set(["party-turn", "party-chat"]);
const BALANCED_GM_TAGS = new Set(["choices", "map_update"]);

interface GmTagHead {
  name: string;
  rawName: string;
  delimiter: ":" | "]";
  delimiterIndex: number;
}

function isAsciiWordCharacter(character: string | undefined): boolean {
  if (!character) return false;
  const code = character.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || code === 95 || (code >= 97 && code <= 122);
}

/** Parse only the name immediately after `[`, so malformed nested input stays linear. */
function readGmTagHead(content: string, start: number, allowHyphen: boolean): GmTagHead | null {
  let cursor = start + 1;
  while (isAsciiWordCharacter(content[cursor]) || (allowHyphen && content[cursor] === "-")) {
    cursor++;
  }
  if (cursor === start + 1 || (content[cursor] !== ":" && content[cursor] !== "]")) return null;
  const rawName = content.slice(start + 1, cursor);
  return {
    name: rawName.toLowerCase(),
    rawName,
    delimiter: content[cursor] as ":" | "]",
    delimiterIndex: cursor,
  };
}

function stripSimpleGmTags(content: string): string {
  let result = "";
  let outputCursor = 0;
  let searchCursor = 0;
  while (searchCursor < content.length) {
    const start = content.indexOf("[", searchCursor);
    if (start < 0) break;
    const head = readGmTagHead(content, start, true);
    if (!head || !REMOVABLE_GM_TAGS.has(head.name)) {
      searchCursor = start + 1;
      continue;
    }

    if (head.delimiter === "]" && !VALUELESS_GM_TAGS.has(head.name)) {
      searchCursor = start + 1;
      continue;
    }
    if (head.delimiter === ":" && VALUELESS_GM_TAGS.has(head.name)) {
      searchCursor = start + 1;
      continue;
    }

    let endExclusive: number;
    if (head.delimiter === "]") {
      endExclusive = head.delimiterIndex + 1;
    } else if (BALANCED_GM_TAGS.has(head.name)) {
      const close = findBalancedBracketClose(content, start);
      if (close >= 0) {
        endExclusive = close + 1;
      } else if (head.name === "map_update") {
        const newline = content.indexOf("\n", head.delimiterIndex + 1);
        endExclusive = newline < 0 ? content.length : newline + 1;
      } else {
        searchCursor = start + 1;
        continue;
      }
    } else {
      const close = content.indexOf("]", head.delimiterIndex + 1);
      if (close < 0) break;
      const hasValue = content.slice(head.delimiterIndex + 1, close).trim().length > 0;
      if (!hasValue && head.name !== "session_end") {
        searchCursor = start + 1;
        continue;
      }
      endExclusive = close + 1;
    }

    result += content.slice(outputCursor, start);
    outputCursor = endExclusive;
    searchCursor = endExclusive;
  }
  return result + content.slice(outputCursor);
}

function findBalancedBracketClose(content: string, start: number): number {
  let depth = 0;
  for (let index = start; index < content.length; index++) {
    if (content[index] === "[") depth++;
    else if (content[index] === "]" && --depth === 0) return index;
  }
  return -1;
}

function stripUnknownGmTags(content: string): string {
  let result = "";
  let outputCursor = 0;
  let searchCursor = 0;
  while (searchCursor < content.length) {
    const start = content.indexOf("[", searchCursor);
    if (start < 0) break;
    const head = readGmTagHead(content, start, false);
    if (!head || head.delimiter !== ":" || head.name === "note" || head.name === "book") {
      searchCursor = start + 1;
      continue;
    }
    const close = content.indexOf("]", head.delimiterIndex + 1);
    if (close < 0) break;
    result += content.slice(outputCursor, start);
    outputCursor = close + 1;
    searchCursor = close + 1;
  }
  return result + content.slice(outputCursor);
}

function preserveResolvedSkillCheckResults(content: string): string {
  const prefix = "[skill_check:";
  const prefixPattern = /\[skill_check:/gi;
  let cursor = 0;
  let resultText = "";

  while (cursor < content.length) {
    prefixPattern.lastIndex = cursor;
    const match = prefixPattern.exec(content);
    if (!match) break;
    const start = match.index;
    const close = content.indexOf("]", start + prefix.length);
    if (close < 0) break;
    const rawBody = content.slice(start + prefix.length, close);
    const body = rawBody.trimStart();
    const result = body ? parseResolvedSkillCheckBody(body) : null;
    resultText += content.slice(cursor, start);
    if (result) resultText += `Skill check result: ${formatSkillCheckResultSummary(result)}`;
    else if (!rawBody) resultText += content.slice(start, close + 1);
    cursor = close + 1;
  }

  return resultText + content.slice(cursor);
}

function parseSkillCheckAttributes(body: string): Map<string, string> {
  const values = new Map<string, string>();
  let cursor = 0;
  while (cursor < body.length) {
    while (/\s/u.test(body[cursor] ?? "")) cursor++;
    const keyStart = cursor;
    while (/\w/u.test(body[cursor] ?? "")) cursor++;
    if (cursor === keyStart) {
      cursor++;
      continue;
    }
    const key = body.slice(keyStart, cursor).toLowerCase();
    while (/\s/u.test(body[cursor] ?? "")) cursor++;
    if (body[cursor] !== "=") continue;
    cursor++;
    while (/\s/u.test(body[cursor] ?? "")) cursor++;
    const quote = body[cursor] === '"' || body[cursor] === "'" ? body[cursor++] : null;
    const valueStart = cursor;
    if (quote) while (cursor < body.length && body[cursor] !== quote) cursor++;
    else while (cursor < body.length && !/\s/u.test(body[cursor]!) && body[cursor] !== "]") cursor++;
    const rawValue = body.slice(valueStart, cursor);
    if (quote && body[cursor] === quote) cursor++;
    if (rawValue) values.set(key, rawValue);
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
  const resolution: SkillCheckResult["resolution"] =
    values.get("resolution")?.trim().toLowerCase() === "successes" ? "successes" : "sum";
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
    resolution,
    dice: values.get("dice")?.trim().toLowerCase(),
  };
}

/** Remove dangling closers left behind by malformed or partially stripped tags. */
function stripDanglingTagClosers(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      return trimmed && [...trimmed].every((character) => character === "]" || character === "}") ? "" : line;
    })
    .join("\n");
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

function parseReadableType(originalText: string): "note" | "book" | undefined {
  const trimmed = originalText.trim();
  if (/^\[book:/i.test(trimmed)) return "book";
  if (/^\[note:/i.test(trimmed)) return "note";
  return undefined;
}

function replaceDialogueSpeaker(prefix: string, speaker: string): string {
  return prefix.replace(/^(\s*)\[[^\]]+\]/, `$1[${speaker}]`);
}

function normalizeInlineVnDialogueLines(source: string): string {
  return source
    .replace(
      /(\S)[^\S\r\n]+(\[[^\r\n[\]]+\][^\S\r\n]*\[(?:main|side|extra|action|thought|whisper(?::[^\r\n[\]]+)?)\][^\S\r\n]*(?:\[[^\r\n[\]]+\])?[^\S\r\n]*:)/gi,
      "$1\n$2",
    )
    .replace(
      /(\[[^\r\n[\]]+\][^\S\r\n]*\[(?:main|side|extra|whisper(?::[^\r\n[\]]+)?)\][^\S\r\n]*(?:\[[^\r\n[\]]+\])?[^\S\r\n]*:[^\S\r\n]*(?:"[^"\r\n]*"|“[^”\r\n]*”|«[^»\r\n]*»))[^\S\r\n]+(?=\S)/gi,
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

    // Legacy `Narration: text`
    const narrationMatch = line.match(NARRATION_PREFIX_RE);
    if (narrationMatch) {
      flushFallback();
      segments.push({ originalText: narrationMatch[1]!.trim() });
      continue;
    }

    // Dialogue (legacy or compact)
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
export function applySegmentEdits(
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

/**
 * Collect segment edit overlays from chat metadata and apply them to the
 * corresponding messages.
 *
 * @param messages   Array of mapped messages (role + content)
 * @param chatMeta   Chat metadata object (contains segmentEdit:* keys)
 * @param allDbMessages  Original DB messages (to map messageId → index in messages array)
 */
export function applyAllSegmentEdits(
  messages: Array<{ role: string; content: string; [k: string]: unknown }>,
  chatMeta: Record<string, unknown>,
  allDbMessages: Array<{ id: string; role: string }>,
): void {
  // Collect edits grouped by messageId
  const editsByMessage = new Map<string, Record<number, SegmentEditValue>>();
  const deletesByMessage = new Map<string, Set<number>>();
  for (const [key, value] of Object.entries(chatMeta)) {
    const isEdit = key.startsWith("segmentEdit:");
    const isDelete = key.startsWith("segmentDelete:");
    if (!isEdit && !isDelete) continue;
    if (isDelete && value !== true && value !== "true") continue;
    // Format: segment(Edit|Delete):messageId:segmentIndex
    const parts = key.slice(isEdit ? "segmentEdit:".length : "segmentDelete:".length);
    const lastColon = parts.lastIndexOf(":");
    if (lastColon < 0) continue;
    const messageId = parts.slice(0, lastColon);
    const segIdx = parseInt(parts.slice(lastColon + 1), 10);
    if (isNaN(segIdx)) continue;

    if (isEdit) {
      const edit = normalizeSegmentEditValue(value);
      if (!edit) continue;
      let edits = editsByMessage.get(messageId);
      if (!edits) {
        edits = {};
        editsByMessage.set(messageId, edits);
      }
      edits[segIdx] = edit;
      continue;
    }

    let deleted = deletesByMessage.get(messageId);
    if (!deleted) {
      deleted = new Set<number>();
      deletesByMessage.set(messageId, deleted);
    }
    deleted.add(segIdx);
  }

  if (editsByMessage.size === 0 && deletesByMessage.size === 0) return;

  const messageIds = new Set<string>([...editsByMessage.keys(), ...deletesByMessage.keys()]);
  const removals: number[] = [];

  // Map messageId → index in messages array
  // allDbMessages and messages should be in the same order (both from the same query)
  for (const messageId of messageIds) {
    const dbIdx = allDbMessages.findIndex((m) => m.id === messageId);
    if (dbIdx < 0) continue;
    const msg = messages[dbIdx];
    if (!msg || (msg.role !== "assistant" && msg.role !== "narrator")) continue;
    const nextContent = applySegmentEdits(
      msg.content,
      editsByMessage.get(messageId) ?? {},
      deletesByMessage.get(messageId) ?? new Set(),
    );
    if (!nextContent.trim()) {
      removals.push(dbIdx);
      continue;
    }
    msg.content = nextContent;
  }

  removals.sort((a, b) => b - a);
  for (const index of removals) {
    messages.splice(index, 1);
  }
}
