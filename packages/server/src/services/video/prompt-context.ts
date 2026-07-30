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
  activeSwipeIndex?: number | null;
  content?: string | null;
  extra?: unknown;
}

export interface GalleryVideoNarrationSwipe {
  messageId: string;
  index?: number | null;
  content?: string | null;
  extra?: unknown;
}

export function resolveGalleryImageSourceAnchor(
  messages: GalleryVideoNarrationMessage[],
  swipes: GalleryVideoNarrationSwipe[],
  galleryImageId: string,
): { messageId: string; swipeIndex: number } | null {
  const targetGalleryImageId = galleryImageId.trim();
  if (!targetGalleryImageId) return null;
  const sourceSwipe = swipes.find((swipe) => extraReferencesGalleryImage(swipe.extra, targetGalleryImageId));
  if (sourceSwipe) {
    return {
      messageId: sourceSwipe.messageId,
      swipeIndex: typeof sourceSwipe.index === "number" ? sourceSwipe.index : 0,
    };
  }
  const sourceMessage = messages.find((message) =>
    extraReferencesGalleryImage(message.extra, targetGalleryImageId),
  );
  if (!sourceMessage) return null;
  return {
    messageId: sourceMessage.id,
    swipeIndex: typeof sourceMessage.activeSwipeIndex === "number" ? sourceMessage.activeSwipeIndex : 0,
  };
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

    const sourceMessage = messages.find((message) =>
      extraReferencesGalleryImage(message.extra, targetGalleryImageId),
    );
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
