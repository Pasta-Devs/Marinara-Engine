import {
  getMessageConversationStartCharacterIds,
  isMessageHiddenFromAIForCharacter,
} from "../../routes/generate/generate-route-utils.js";

export interface SceneVideoPromptLimits {
  narrationSummary: number;
  illustrationPrompt: number;
  artStyle: number;
  title: number;
  finalPrompt: number | null;
}

export interface GalleryVideoNarrationMessage {
  id: string;
  role?: string | null;
  content?: string | null;
  extra?: unknown;
}

export interface GalleryVideoNarrationSwipe {
  messageId: string;
  content?: string | null;
  extra?: unknown;
}

export interface GalleryVideoSourceExchange {
  sourceMessageId: string | null;
  content: string;
}

const XAI_PROMPT_MAX_LENGTH = 3800;
const UNBOUNDED_PROMPT_PART_LENGTH = Number.MAX_SAFE_INTEGER;

const BOILERPLATE_PROMPT_CHUNK_PATTERNS = [
  /^(anime style|illustration|best quality|detailed eyes|clean lineart)$/i,
  /^(visual novel CG|game CG|cinematic composition|full-frame single scene)$/i,
  /^image type:/i,
  /^camera \/ pov:/i,
  /^sd\/illustrious tags:/i,
  /^composition:/i,
  /^avoid:/i,
  /not a selfie/i,
  /comic page|manga panel|background-only plate/i,
  /subtitles|captions|speech bubbles|watermarks|logos|signatures|ui/i,
];

export function getSceneVideoPromptLimits(isXai: boolean, isGeminiOmni = false): SceneVideoPromptLimits {
  if (isXai) {
    return {
      narrationSummary: 360,
      illustrationPrompt: 900,
      artStyle: 260,
      title: 96,
      finalPrompt: XAI_PROMPT_MAX_LENGTH,
    };
  }
  if (isGeminiOmni) {
    return {
      narrationSummary: UNBOUNDED_PROMPT_PART_LENGTH,
      illustrationPrompt: UNBOUNDED_PROMPT_PART_LENGTH,
      artStyle: UNBOUNDED_PROMPT_PART_LENGTH,
      title: UNBOUNDED_PROMPT_PART_LENGTH,
      finalPrompt: null,
    };
  }
  return {
    narrationSummary: 650,
    illustrationPrompt: 1400,
    artStyle: 420,
    title: 120,
    finalPrompt: null,
  };
}

export function compactVideoPromptText(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || maxLength <= 0) return "";
  const clean = normalizePromptWhitespace(value);
  if (clean.length <= maxLength) return clean;
  return clipAtBoundary(clean, maxLength);
}

export function summarizeVideoNarration(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || maxLength <= 0) return "";
  const withoutDialogue = value
    .replace(/\[[^\]\r\n]{1,80}\]\s*:?\s*/g, " ")
    .replace(/"[^"\r\n]{1,500}"/g, " ")
    .replace(/\u201c[^\u201d\r\n]{1,500}\u201d/g, " ");
  const clean = normalizePromptWhitespace(withoutDialogue);
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;

  const chunks = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [clean];
  const useful = chunks.map((chunk) => chunk.trim()).filter((chunk) => chunk.length > 24 && !/^\[[^\]]+\]/.test(chunk));
  const selected: string[] = [];
  let length = 0;
  for (const chunk of useful) {
    const nextLength = length + chunk.length + (selected.length ? 1 : 0);
    if (nextLength > maxLength) break;
    selected.push(chunk);
    length = nextLength;
  }
  return selected.length ? selected.join(" ") : clipAtBoundary(clean, maxLength);
}

export function resolveGalleryVideoNarrationSummary(
  messages: GalleryVideoNarrationMessage[],
  swipes: GalleryVideoNarrationSwipe[],
  galleryImageId: string,
  maxLength: number,
): string {
  const targetGalleryImageId = galleryImageId.trim();
  if (targetGalleryImageId) {
    const sourceSwipe = swipes.find((swipe) => extraReferencesGalleryImage(swipe.extra, targetGalleryImageId));
    if (sourceSwipe) {
      return (
        summarizeVideoNarration(sourceSwipe.content, maxLength) ||
        "Animate the illustrated roleplay scene with motion that fits the reference image."
      );
    }

    const sourceMessage = messages.find((message) => extraReferencesGalleryImage(message.extra, targetGalleryImageId));
    if (sourceMessage) {
      return (
        summarizeVideoNarration(sourceMessage.content, maxLength) ||
        "Animate the illustrated roleplay scene with motion that fits the reference image."
      );
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "assistant") continue;
    const summary = summarizeVideoNarration(message.content, maxLength);
    if (summary) return summary;
  }
  return "Animate the latest illustrated roleplay scene with motion that fits the reference image.";
}

export function clipVerbatimVideoSource(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || maxLength <= 0) return "";
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trimEnd();
}

export function resolveGalleryVideoSourceExchange(
  messages: GalleryVideoNarrationMessage[],
  swipes: GalleryVideoNarrationSwipe[],
  galleryImageId: string,
  maxLength = 12_000,
): GalleryVideoSourceExchange {
  const targetGalleryImageId = galleryImageId.trim();
  const sourceSwipe = targetGalleryImageId
    ? swipes.find((swipe) => extraReferencesGalleryImage(swipe.extra, targetGalleryImageId))
    : undefined;
  const sourceMessage = sourceSwipe
    ? messages.find((message) => message.id === sourceSwipe.messageId)
    : targetGalleryImageId
      ? messages.find((message) => extraReferencesGalleryImage(message.extra, targetGalleryImageId))
      : undefined;
  const fallbackMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const anchor = sourceMessage ?? fallbackMessage ?? null;
  const anchorIndex = anchor ? messages.findIndex((message) => message.id === anchor.id) : -1;
  const precedingUser =
    anchorIndex > 0
      ? messages
          .slice(0, anchorIndex)
          .reverse()
          .find((message) => message.role === "user")
      : undefined;
  const assistantContent = clipVerbatimVideoSource(
    sourceSwipe?.content ?? anchor?.content,
    Math.floor(maxLength * 0.75),
  );
  const userContent = clipVerbatimVideoSource(precedingUser?.content, Math.floor(maxLength * 0.25));
  const content = [
    userContent ? `User:\n${userContent}` : "",
    assistantContent ? `Assistant:\n${assistantContent}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { sourceMessageId: anchor?.id ?? null, content };
}

export function excerptIllustrationPromptForVideo(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || maxLength <= 0) return "";
  const clean = normalizePromptWhitespace(value);
  if (!clean) return "";
  const chunks = clean
    .split(/(?:\r?\n|,\s+|;\s+)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const filtered = dedupeInOrder(
    chunks.filter((chunk) => !BOILERPLATE_PROMPT_CHUNK_PATTERNS.some((pattern) => pattern.test(chunk))),
  );
  const candidate = (filtered.length ? filtered : chunks).join(", ");
  return compactVideoPromptText(candidate, maxLength);
}

export function limitSceneVideoPromptForProvider(prompt: string, maxLength: number | null): string {
  if (!maxLength || prompt.length <= maxLength) return prompt;
  const suffix = "\nUse the reference image as the visual source and keep the motion coherent.";
  const bodyLimit = Math.max(0, maxLength - suffix.length);
  return `${clipAtBoundary(prompt, bodyLimit)}${suffix}`;
}

function normalizePromptWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clipAtBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const limit = Math.max(0, maxLength - 3);
  const slice = value.slice(0, limit);
  const boundary = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(", "), slice.lastIndexOf("; "));
  const clipped = (boundary > Math.floor(limit * 0.55) ? slice.slice(0, boundary + 1) : slice).trim();
  return `${clipped}...`;
}

function dedupeInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function extraReferencesGalleryImage(extra: unknown, galleryImageId: string): boolean {
  const record = parseExtraRecord(extra);
  const attachments = Array.isArray(record.attachments) ? record.attachments : [];
  return attachments.some((attachment) => {
    if (!attachment || typeof attachment !== "object") return false;
    return (attachment as Record<string, unknown>).galleryId === galleryImageId;
  });
}

function parseExtraRecord(extra: unknown): Record<string, unknown> {
  if (extra && typeof extra === "object" && !Array.isArray(extra)) return extra as Record<string, unknown>;
  if (typeof extra !== "string" || !extra.trim()) return {};
  try {
    const parsed = JSON.parse(extra) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * The recent chat a new video should know about, the way Illustrator reads it for a picture: the last `count`
 * user and assistant messages with text, up to `endMessageId` (else the newest), each labelled with who said it.
 * Messages before the latest conversation start, and messages hidden from the AI (or from `characterId`), are left
 * out; over `maxLength`, the oldest text goes first so the latest moment is kept.
 */
export function formatRecentVideoContext(
  messages: ReadonlyArray<{ id: string; role?: string | null; content?: string | null; extra?: unknown }>,
  options: {
    count: number;
    endMessageId?: string | null;
    speaker?: (message: { role?: string | null; extra?: unknown } & Record<string, unknown>) => string;
    maxLength?: number;
    /** Who the clip is for: messages hidden from that character are left out, as their replies leave them out. */
    characterId?: string | null;
  },
): string {
  const end = options.endMessageId ? messages.findIndex((message) => message.id === options.endMessageId) : -1;
  const upTo = end >= 0 ? messages.slice(0, end + 1) : messages;
  // A conversation start marker (for everyone, or for this character) cuts off what came before, as replies do.
  let start = 0;
  for (let index = upTo.length - 1; index >= 0; index--) {
    const message = upTo[index]!;
    if (
      parseExtraRecord(message.extra).isConversationStart === true ||
      (!!options.characterId && getMessageConversationStartCharacterIds(message).includes(options.characterId))
    ) {
      start = index;
      break;
    }
  }
  const text = upTo
    .slice(start)
    .filter((message) => message.role === "user" || message.role === "assistant")
    .filter((message) => !isMessageHiddenFromAIForCharacter(message, options.characterId))
    // A message with no text (a video message, for one) says nothing here and would use up the count.
    .filter((message) => (message.content ?? "").trim().length > 0)
    .slice(-Math.max(1, options.count))
    .map((message) => {
      const speaker =
        options.speaker?.(message as Parameters<NonNullable<typeof options.speaker>>[0]) ??
        (message.role === "user" ? "User" : "Assistant");
      return `${speaker}:\n${(message.content ?? "").trim()}`;
    })
    .join("\n\n");
  const maxLength = options.maxLength ?? 12_000;
  return text.length > maxLength ? text.slice(-maxLength) : text;
}
