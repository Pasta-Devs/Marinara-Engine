// ──────────────────────────────────────────────
// Avatar director: reading the visible reply text
// ──────────────────────────────────────────────
// Pure helpers over the text the chat shows while a reply streams:
//   - which participant each paragraph belongs to (the speaking character when the Engine knows it, otherwise the
//     first participant a paragraph names, carried on to the next paragraphs);
//   - the dialogue each participant has spoken so far, with the same extractor text-to-speech uses;
//   - the sentences finished since the last read, for the emotion classifier.
import { AVATAR_CLASSIFY_LIMITS } from "@marinara-engine/shared";
import {
  cleanTTSInputText,
  extractDialogueUtterances,
  findTTSCharacterIdBySpeakerName,
} from "../../../lib/tts-dialogue";

export interface ReplySpeaker {
  ownerId: string;
  name: string;
}

export interface ReplyParagraph {
  start: number;
  end: number;
  ownerId: string | null;
  /** The owner came from the paragraph before (or the fallback): this paragraph names nobody yet. */
  inherited: boolean;
  /** A speaker tag or [Name]: line owns this span, including a tag whose closing tag is still streaming. */
  explicitSpeaker?: boolean;
}

/** A sentence runs on past this many characters before it is cut at a clause. */
export const MAX_SEGMENT_CHARS = 160;

const SENTENCE_END = /[.!?…]+["'”’»)\]*_]*(?=\s)|[。！？]+[」』”’)\]]*|\n+/gu;
const CLAUSE_BREAK = /[,;:—–、，；：]\s*/gu;
const HAS_LETTER = /\p{L}/u;
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const INCOMPLETE_TAG = /<\/?\p{L}[^<>\r\n]*(?:[\r\n]\s*)?$/u;

function namePattern(name: string): RegExp | null {
  const full = name.trim();
  if (!full) return null;
  const first = full.split(/\s+/u)[0] ?? "";
  const names = [full, ...(first.length >= 3 && first !== full ? [first] : [])].map((value) =>
    value.replace(REGEX_SPECIAL, "\\$&"),
  );
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.join("|")})(?![\\p{L}\\p{N}])`, "u");
}

/** Splits the reply at blank-line or line breaks and gives each paragraph an owner. `knownOwnerId` (the Engine's
 *  streaming character) wins; with one candidate every paragraph is theirs; otherwise a paragraph belongs to the
 *  candidate it names first, else to the paragraph before it, else to `fallbackOwnerId`. */
export function attributeReplyParagraphs(
  text: string,
  candidates: readonly ReplySpeaker[],
  knownOwnerId: string | null,
  fallbackOwnerId: string | null,
): ReplyParagraph[] {
  const paragraphs: ReplyParagraph[] = [];
  const fixedOwner = knownOwnerId ?? (candidates.length === 1 ? candidates[0]!.ownerId : null);
  const patterns = fixedOwner
    ? []
    : candidates.flatMap((candidate) => {
        const pattern = namePattern(candidate.name);
        return pattern ? [{ ownerId: candidate.ownerId, pattern }] : [];
      });
  let owner = fixedOwner ?? fallbackOwnerId;
  const byName = candidates.map((candidate) => [candidate.ownerId, { name: candidate.name }] as const);
  // A partial HTML tag is structure, never a quoted name to be spoken or classified.
  const visibleEnd = text.replace(INCOMPLETE_TAG, "").length;
  const breaks = /\n+/gu;
  const appendProse = (from: number, to: number) => {
    let start = from;
    breaks.lastIndex = from;
    for (;;) {
      const match = breaks.exec(text);
      const end = match && match.index < to ? match.index : to;
      const paragraph = text.slice(start, end);
      const prefix = paragraph.match(/^\s*(?:Dialogue\s*)?\[([^\]\r\n]+)\]\s*(?:\[[^\]\r\n]+\]\s*){0,2}:\s*/iu);
      let inherited = false;
      if (prefix) {
        owner = findTTSCharacterIdBySpeakerName(prefix[1], byName);
        if (owner && knownOwnerId) owner = knownOwnerId;
      } else if (!fixedOwner) {
        let firstIndex = Infinity;
        for (const { ownerId, pattern } of patterns) {
          const index = paragraph.search(pattern);
          if (index >= 0 && index < firstIndex) {
            firstIndex = index;
            owner = ownerId;
          }
        }
        inherited = firstIndex === Infinity;
      }
      if (paragraph.trim()) {
        paragraphs.push({
          start,
          end,
          ownerId: prefix ? owner : (fixedOwner ?? owner),
          inherited,
          ...(prefix ? { explicitSpeaker: true } : {}),
        });
      }
      if (!match || match.index >= to) break;
      start = match.index + match[0].length;
    }
  };
  const tags = /<speaker="([^"]*)">/giu;
  let cursor = 0;
  for (let tag = tags.exec(text); tag && tag.index < visibleEnd; tag = tags.exec(text)) {
    appendProse(cursor, tag.index);
    const close = /<\/speaker\s*>/giu;
    close.lastIndex = tags.lastIndex;
    const closing = close.exec(text);
    const end = closing ? closing.index + closing[0].length : visibleEnd;
    owner = findTTSCharacterIdBySpeakerName(tag[1], byName);
    if (owner && knownOwnerId) owner = knownOwnerId;
    paragraphs.push({ start: tag.index, end, ownerId: owner, inherited: false, explicitSpeaker: true });
    cursor = tags.lastIndex = end;
  }
  appendProse(cursor, visibleEnd);
  return paragraphs;
}

const OPEN_QUOTES: ReadonlyArray<readonly [string, string]> = [
  ["“", "”"],
  ["«", "»"],
  ["「", "」"],
  ["『", "』"],
];

/** Closes a quotation the stream has opened but not closed yet, so the words already shown count as dialogue. */
export function closeOpenQuote(text: string): string {
  if ((text.match(/"/g)?.length ?? 0) % 2 === 1) return `${text}"`;
  for (const [open, close] of OPEN_QUOTES) {
    if (text.lastIndexOf(open) > text.lastIndexOf(close)) return text + close;
  }
  return text;
}

/** Everything each owner has said so far, in reading order, joined by spaces. Speaker tags and `[Name]:` lines
 *  go to the named participant; plain quotes go to the paragraph's owner. */
export function collectReplyDialogue(
  text: string,
  paragraphs: readonly ReplyParagraph[],
  speakers: readonly ReplySpeaker[],
): Map<string, string> {
  const byName = speakers.map((speaker) => [speaker.ownerId, { name: speaker.name }] as const);
  const nameOf = new Map(speakers.map((speaker) => [speaker.ownerId, speaker.name]));
  const spoken = new Map<string, string[]>();
  paragraphs.forEach((paragraph, index) => {
    let body = text.slice(paragraph.start, paragraph.end).replace(INCOMPLETE_TAG, "");
    if (index === paragraphs.length - 1) body = closeOpenQuote(body);
    if (paragraph.explicitSpeaker && /<speaker="/iu.test(body) && !/<\/speaker\s*>/iu.test(body)) {
      body += "</speaker>";
    }
    const fallbackName = paragraph.ownerId ? (nameOf.get(paragraph.ownerId) ?? null) : null;
    const explicitLines = new Set<string>();
    for (const utterance of extractDialogueUtterances(body, fallbackName)) {
      if (paragraph.explicitSpeaker) {
        if (explicitLines.has(utterance.text)) continue;
        explicitLines.add(utterance.text);
      }
      const ownerId = paragraph.explicitSpeaker
        ? paragraph.ownerId
        : utterance.speaker
          ? findTTSCharacterIdBySpeakerName(utterance.speaker, byName)
          : paragraph.ownerId;
      if (!ownerId) continue;
      const lines = spoken.get(ownerId) ?? [];
      lines.push(utterance.text);
      spoken.set(ownerId, lines);
    }
  });
  return new Map([...spoken].map(([ownerId, lines]) => [ownerId, lines.join(" ")]));
}

function clauseCut(text: string, start: number): number {
  const limit = start + MAX_SEGMENT_CHARS;
  let cut = -1;
  CLAUSE_BREAK.lastIndex = start;
  for (let match = CLAUSE_BREAK.exec(text); match && match.index < limit; match = CLAUSE_BREAK.exec(text)) {
    cut = match.index + match[0].length;
  }
  if (cut > start) return cut;
  const space = text.lastIndexOf(" ", limit);
  return space > start ? space + 1 : limit;
}

export interface ReplySegment {
  start: number;
  /** Plain text for the classifier (markup removed), at most the classifier's text limit. */
  text: string;
}

/** Sentences finished in `text` after `from`, cutting a long sentence at a clause. `done` also returns the rest.
 *  Returns the segments and where the next read starts. Segments without letters are dropped. */
export function readReplySegments(
  text: string,
  from: number,
  done: boolean,
): { segments: ReplySegment[]; next: number } {
  const segments: ReplySegment[] = [];
  const push = (start: number, end: number) => {
    const plain = cleanTTSInputText(text.slice(start, end)).slice(0, AVATAR_CLASSIFY_LIMITS.maxTextLength);
    if (HAS_LETTER.test(plain)) segments.push({ start, text: plain });
  };
  let start = Math.max(0, Math.min(from, text.length));
  for (;;) {
    SENTENCE_END.lastIndex = start;
    const match = SENTENCE_END.exec(text);
    let end = match ? match.index + match[0].length : -1;
    if ((end === -1 || end - start > MAX_SEGMENT_CHARS) && text.length - start > MAX_SEGMENT_CHARS) {
      end = clauseCut(text, start);
    }
    if (end === -1) break;
    push(start, end);
    start = end;
  }
  if (done && start < text.length) {
    push(start, text.length);
    start = text.length;
  }
  return { segments, next: start };
}
