// ──────────────────────────────────────────────
// Interrupt truncation
//
// Cuts a Game turn's raw content after the Nth beat the narration
// screen shows, as a byte-for-byte prefix of the raw text.
// ──────────────────────────────────────────────

import { repairGameSpeakerLine } from "@marinara-engine/shared";
import { stripGmTagsKeepReadables } from "./game-tag-parser";

type TruncationLine = {
  text: string;
  originalStart: number;
  originalEnd: number;
};

function findReadableBlockEnd(source: string, start: number): number {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "[") depth++;
    else if (source[i] === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTextIntoBoundedLines(text: string, originalStart: number): TruncationLine[] {
  const lines: TruncationLine[] = [];
  let lineStart = 0;

  for (let i = 0; i <= text.length; i++) {
    if (i < text.length && text[i] !== "\n") continue;
    const rawLine = text.slice(lineStart, i);
    const lineText = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    lines.push({
      text: lineText,
      originalStart: originalStart + lineStart,
      originalEnd: originalStart + lineStart + lineText.length,
    });
    lineStart = i + 1;
  }

  return lines;
}

function splitInlineVnDialogueLineMetadata(line: TruncationLine): TruncationLine[] {
  const headerRe = /\[[^\]]+\]\s*\[(?:main|side|extra|action|thought|whisper(?::[^\]]+)?)\]\s*(?:\[[^\]]+\])?\s*:/gi;
  const pieces: TruncationLine[] = [];
  let chunkStart = 0;
  let match: RegExpExecArray | null;

  while ((match = headerRe.exec(line.text))) {
    if (match.index > chunkStart && /\s/.test(line.text[match.index - 1] ?? "")) {
      pieces.push({
        text: line.text.slice(chunkStart, match.index),
        originalStart: line.originalStart + chunkStart,
        originalEnd: line.originalStart + match.index,
      });
      chunkStart = match.index;
    }
  }
  pieces.push({
    text: line.text.slice(chunkStart),
    originalStart: line.originalStart + chunkStart,
    originalEnd: line.originalEnd,
  });

  return pieces.flatMap((piece) => {
    const splitRe =
      /^(\s*\[[^\]]+\]\s*\[(?:main|side|extra|whisper(?::[^\]]+)?)\]\s*(?:\[[^\]]+\])?\s*:\s*(?:"[^"]*"|“[^”]*”|«[^»]*»))\s+(?=\S)/i;
    const split = splitRe.exec(piece.text);
    if (!split || split[1].length >= piece.text.length) return [piece];

    const splitAt = split[1].length;
    return [
      {
        text: piece.text.slice(0, splitAt),
        originalStart: piece.originalStart,
        originalEnd: piece.originalStart + splitAt,
      },
      {
        text: piece.text.slice(splitAt).trimStart(),
        originalStart: piece.originalStart + splitAt + (piece.text.slice(splitAt).match(/^\s*/)?.[0].length ?? 0),
        originalEnd: piece.originalEnd,
      },
    ];
  });
}

function buildTruncationLines(rawContent: string): TruncationLine[] {
  const chunks: TruncationLine[] = [];
  const readableTagRe = /\[(?:Note|Book):/gi;
  let cursor = 0;
  let placeholderIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = readableTagRe.exec(rawContent))) {
    const start = match.index;
    const end = findReadableBlockEnd(rawContent, start);
    if (end < 0) continue;

    if (start > cursor) {
      chunks.push(...splitTextIntoBoundedLines(rawContent.slice(cursor, start), cursor));
    }
    chunks.push({
      text: `__READABLE_${placeholderIndex}__`,
      originalStart: start,
      originalEnd: end + 1,
    });
    placeholderIndex += 1;
    cursor = end + 1;
    readableTagRe.lastIndex = cursor;
  }

  if (cursor < rawContent.length) {
    chunks.push(...splitTextIntoBoundedLines(rawContent.slice(cursor), cursor));
  }

  return chunks.flatMap((chunk) => {
    if (/^__READABLE_\d+__$/.test(chunk.text)) return [chunk];
    return splitRepairedLineMetadata(chunk).map((line) => ({
      ...line,
      text: stripGmTagsKeepReadables(line.text),
    }));
  });
}

/**
 * A speaker line the screen repairs (`repairGameSpeakerLine`) is split and classified as repaired, so
 * it counts as the beats the screen shows. The repair rewrites only the bracket prefix and keeps the
 * text after it, so each piece's raw offsets are read back from the end of the line, and the first
 * piece starts where the line does.
 */
function splitRepairedLineMetadata(line: TruncationLine): TruncationLine[] {
  // The screen repairs a line after its command tags are stripped, so tags ahead of the speaker are skipped.
  let at = 0;
  for (let tags = 0; tags < 8; tags++) {
    while (line.text[at] === " " || line.text[at] === "\t") at++;
    if (!/^\[\w+\s*:/.test(line.text.slice(at, at + 40))) break;
    const close = line.text.indexOf("]", at);
    if (close < 0) break;
    at = close + 1;
  }
  const body = line.text.slice(at);
  const repaired = repairGameSpeakerLine(body);
  if (repaired === body) return splitInlineVnDialogueLineMetadata(line);
  const contentEnd = line.originalStart + line.text.trimEnd().length;
  const rawOffset = (offset: number) => Math.max(line.originalStart, contentEnd - (repaired.length - offset));
  return splitInlineVnDialogueLineMetadata({ text: repaired, originalStart: 0, originalEnd: repaired.length }).map(
    (piece) => ({
      text: piece.text,
      originalStart: piece.originalStart === 0 ? line.originalStart : rawOffset(piece.originalStart),
      originalEnd: piece.originalEnd === repaired.length ? line.originalEnd : rawOffset(piece.originalEnd),
    }),
  );
}

/**
 * Truncate an assistant message's raw content so that it ends just after the
 * Nth segment (inclusive) that `parseNarrationSegments` would emit. Used by
 * the Interrupt feature so the model on the next turn can't see narration
 * the player never read.
 *
 * The parser-facing text is normalized for segment detection, but the returned
 * string is always a byte-for-byte prefix of the original raw content.
 */
export function truncateMessageContentAtSegment(rawContent: string, segmentIndexInclusive: number): string {
  if (segmentIndexInclusive < 0) return "";

  const lines = buildTruncationLines(rawContent || "");
  const readablePlaceholderRe = /^__READABLE_(\d+)__$/;
  const narrationRegex = /^\s*Narration\s*:\s*(.+)$/i;
  const legacyDialogueRegex = /^\s*Dialogue\s*\[([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/i;
  const compactDialogueRegex = /^\s*\[([^\]]+)\](?:\s*\[[^\]]+\])*?\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/;
  const partyLineRegex =
    /^\s*\[([^\]]+)\]\s*\[(main|side|extra|action|thought|whisper(?::([^\]]+))?)\]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/i;

  const target = segmentIndexInclusive + 1;
  let segmentCount = 0;
  let pendingFallback = false;
  let lastIncludedLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (segmentCount >= target) break;
    const line = lines[i]!.text.trim();

    if (!line) {
      if (pendingFallback) {
        segmentCount++;
        pendingFallback = false;
      }
      continue;
    }

    const isSpecial =
      readablePlaceholderRe.test(line) ||
      partyLineRegex.test(line) ||
      narrationRegex.test(line) ||
      legacyDialogueRegex.test(line) ||
      compactDialogueRegex.test(line);

    if (isSpecial) {
      if (pendingFallback) {
        segmentCount++;
        pendingFallback = false;
        if (segmentCount >= target) break;
      }
      segmentCount++;
      lastIncludedLineIdx = i;
    } else {
      pendingFallback = true;
      lastIncludedLineIdx = i;
    }
  }

  if (lastIncludedLineIdx < 0) return rawContent;
  return rawContent.slice(0, lines[lastIncludedLineIdx]!.originalEnd);
}
