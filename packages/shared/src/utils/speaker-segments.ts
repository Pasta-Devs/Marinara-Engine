// ──────────────────────────────────────────────
// Speaker-segment parsing for merged multi-character conversation replies.
// A merged reply carries several characters' turns in one message, either as
// <speaker="Name">...</speaker> tags or as `Name: text` line prefixes. The client
// splits on these for the grouped display; the server splits on them to attribute
// reactions to the exact part they were aimed at. Shared so the two sides can
// never drift: a segment index stored by one is resolvable by the other.
// ──────────────────────────────────────────────
import { normalizeTextForMatch } from "./text-matching.js";

const ENCODED_SPEAKER_TAG_RE = /&(?:lt|#0*60|#x0*3c);([^<>]*?\bspeaker\b[^<>]*?)&(?:gt|#0*62|#x0*3e);/gi;
export const CLOCK_TOKEN_SOURCE = String.raw`\d{1,2}[:.]\d{2}(?:\s*(?:am|pm))?`;
export const FULL_DATE_TOKEN_SOURCE = String.raw`\d{1,2}\.\d{1,2}\.\d{2,4}`;
export const DATE_TIME_TOKEN_SOURCE = String.raw`\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\s+${CLOCK_TOKEN_SOURCE}`;
const CONVERSATION_TIMESTAMP_TOKEN_SOURCE = String.raw`\[(?:${DATE_TIME_TOKEN_SOURCE}|${CLOCK_TOKEN_SOURCE}|${FULL_DATE_TOKEN_SOURCE})\]`;
const LEADING_CONVERSATION_TIMESTAMPS_RE = new RegExp(
  String.raw`^([^\S\n]*(?:${CONVERSATION_TIMESTAMP_TOKEN_SOURCE})\s*)+`,
  "gm",
);

function decodeSpeakerTagAttributeEntities(value: string): string {
  return value.replace(/&quot;|&#0*34;|&#x0*22;/gi, '"').replace(/&apos;|&#0*39;|&#x0*27;/gi, "'");
}

export function decodeEncodedSpeakerTags(value: string): string {
  return value.replace(ENCODED_SPEAKER_TAG_RE, (match, tagBody: string) => {
    const decoded = decodeSpeakerTagAttributeEntities(tagBody).trim();
    if (/^\/\s*speaker\s*$/i.test(decoded)) return "</speaker>";

    const open = decoded.match(/^speaker\s*=\s*(["'])([^"']*)\1\s*$/i);
    if (!open?.[2]) return match;
    return `<speaker="${open[2].trim()}">`;
  });
}

/**
 * Strip leaked line-leading `[HH:MM]`, `[DD.MM.YYYY]`, or combined
 * `[DD.MM HH:MM]` / `[DD.MM.YYYY HH:MM]` timestamp tokens — the
 * display shape the conversation client renders and segments. The server strips
 * the same way before resolving reaction segment indexes, so both sides parse
 * identical content. Only line-leading tokens go; interior text is untouched
 * and — unlike the prompt sanitizer — trailing whitespace is preserved, so an
 * empty `Name: ` part keeps parsing as a (filtered) speaker line on both sides.
 */
export function stripLeadingMessageTimestamps(text: string): string {
  // The leading whitespace class is deliberately same-line-only ([^\S\n], not
  // \s): with \s* every line start inside a long blank run re-scanned the rest
  // of the run before failing, going quadratic (~1s per call at 40KB of
  // newlines). Same-line whitespace fails in O(1) at non-timestamp lines.
  return text.replace(LEADING_CONVERSATION_TIMESTAMPS_RE, "").trim();
}

/** One parsed speaker turn: the speaker's name (null = narration) + its text. */
export interface SpeakerSegment {
  speaker: string | null;
  text: string;
  /** Character offset in the source content where this segment's raw span starts. */
  start: number;
  /**
   * Character offset just past this segment's content: the closing tag for a
   * tagged segment, the end of the last non-blank line for a name-prefixed one
   * (untagged narration chunks keep their raw span, trailing whitespace included).
   */
  end: number;
}

/** Consecutive same-speaker segments merged into one display group. */
export interface GroupedSegment {
  speaker: string | null;
  lines: string[];
  /** Raw source span the group covers: start of its first part... */
  start: number;
  /** ...to the end of its last part. Lets callers inject text directly under a group. */
  end: number;
}

/**
 * Parse `<speaker="Name">...</speaker>` tagged segments. Returns null when the
 * content contains no complete tag (callers then fall back to the `Name: `
 * line-prefix format). Unknown speaker names become narration (null speaker);
 * `knownNames` holds normalizeTextForMatch()-normalized character names.
 */
export function parseSpeakerTags(content: string, knownNames: Set<string>): SpeakerSegment[] | null {
  const decodedContent = decodeEncodedSpeakerTags(content);
  const regex = /<speaker="([^"]*)">([\s\S]*?)<\/speaker>/g;
  let match: RegExpExecArray | null;
  const segments: SpeakerSegment[] = [];
  let lastIndex = 0;
  let foundTag = false;
  while ((match = regex.exec(decodedContent)) !== null) {
    foundTag = true;
    const speakerName = match[1]!.trim();
    const knownSpeaker = knownNames.has(normalizeTextForMatch(speakerName));
    if (match.index > lastIndex) {
      const before = decodedContent.slice(lastIndex, match.index).trim();
      if (before) segments.push({ speaker: null, text: before, start: lastIndex, end: match.index });
    }
    segments.push({
      speaker: knownSpeaker ? speakerName : null,
      text: match[2]!.trim(),
      start: match.index,
      end: regex.lastIndex,
    });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < decodedContent.length) {
    const after = decodedContent.slice(lastIndex).trim();
    if (after) segments.push({ speaker: null, text: after, start: lastIndex, end: decodedContent.length });
  }
  return foundTag ? segments : null;
}

/**
 * Parse `Name: text` line-prefixed segments (the fallback format when no speaker
 * tags are present). Returns null when no known name prefixes any line.
 * `knownNames` holds normalizeTextForMatch()-normalized character names.
 */
export function parseNamePrefixFormat(
  content: string,
  knownNames: Set<string>,
  leadingSpeaker?: string | null,
): SpeakerSegment[] | null {
  if (!knownNames.size) return null;
  const lines = content.split("\n");
  // Start offset of each line in `content` (lines are separated by exactly "\n").
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }
  const segments: SpeakerSegment[] = [];
  let currentSpeaker: string | null = null;
  let currentLines: string[] = [];
  let currentStartLine = 0;
  // Last line of the current segment with visible text — the segment's `end`
  // stops there, so injections land under the text, not after trailing blanks.
  let currentLastContentLine = -1;
  const flush = () => {
    if (currentLines.length === 0) return;
    const endLine = currentLastContentLine >= 0 ? currentLastContentLine : currentStartLine + currentLines.length - 1;
    segments.push({
      speaker: currentSpeaker,
      text: currentLines.join("\n"),
      start: lineStarts[currentStartLine]!,
      end: lineStarts[endLine]! + lines[endLine]!.length,
    });
  };
  let found = false;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    const colonIdx = line.indexOf(": ");
    if (colonIdx > 0) {
      const potentialName = line.slice(0, colonIdx).trim();
      if (knownNames.has(normalizeTextForMatch(potentialName))) {
        flush();
        currentSpeaker = potentialName;
        currentLines = [line.slice(colonIdx + 2)];
        currentStartLine = li;
        currentLastContentLine = line.slice(colonIdx + 2).trim() ? li : -1;
        found = true;
        continue;
      }
    }
    if (currentLines.length === 0) currentStartLine = li;
    currentLines.push(line);
    if (line.trim()) currentLastContentLine = li;
  }
  flush();
  if (!found) return null;
  const visibleSegments = segments.filter((s) => s.text.trim());
  const normalizedLeadingSpeaker = leadingSpeaker ? normalizeTextForMatch(leadingSpeaker) : "";
  if (visibleSegments[0]?.speaker === null && normalizedLeadingSpeaker && knownNames.has(normalizedLeadingSpeaker)) {
    visibleSegments[0] = { ...visibleSegments[0], speaker: leadingSpeaker!.trim() };
  }
  return visibleSegments;
}

/** Merge consecutive segments by the same speaker into one grouped segment. */
export function groupConsecutiveSegments(segments: SpeakerSegment[]): GroupedSegment[] {
  const groups: GroupedSegment[] = [];
  for (const seg of segments) {
    const last = groups[groups.length - 1];
    const trimmed = seg.text.replace(/^\n+|\n+$/g, "");
    if (
      last &&
      last.speaker &&
      seg.speaker &&
      normalizeTextForMatch(last.speaker) === normalizeTextForMatch(seg.speaker)
    ) {
      last.lines.push(trimmed);
      last.end = seg.end;
    } else {
      groups.push({ speaker: seg.speaker, lines: [trimmed], start: seg.start, end: seg.end });
    }
  }
  return groups;
}

/**
 * The full grouped-segment derivation for a message's content: complete speaker
 * tags win; the `Name: ` prefix format is only consulted when no tag exists;
 * null when the content has no recognizable speaker structure. This is the
 * canonical definition of "segment index N" — both the client's grouped layout
 * and the server's reaction attribution must derive indexes through it.
 */
export function parseGroupedSpeakerSegments(
  content: string,
  knownNames: Set<string>,
  leadingSpeaker?: string | null,
): GroupedSegment[] | null {
  const speakerSegs = parseSpeakerTags(content, knownNames);
  if (speakerSegs) return groupConsecutiveSegments(speakerSegs);
  const nameSegs = parseNamePrefixFormat(content, knownNames, leadingSpeaker);
  if (nameSegs) return groupConsecutiveSegments(nameSegs);
  return null;
}
