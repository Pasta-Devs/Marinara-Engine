import type { SceneIllustrationCharacterPrompt } from "../types/sidecar.js";

/**
 * The outgoing image request a chat gallery image was rendered from, saved so the
 * image can be regenerated faithfully (#7767). Provider, model and size live on the
 * gallery row itself.
 *
 * This is always the primary connection's request, even when a fallback connection drew
 * the image: a regeneration re-sends it and the fallback still applies if it fails.
 *
 * Reference images are not copied: the record names their sources, and a
 * regeneration re-reads the current avatars and location image.
 */
export interface ChatImageGenerationRecord {
  version: 1;
  /**
   * The prompt as sent, before the provider folds in character prompts. The row's own
   * `prompt` is the provider's display version (NovelAI joins captions with " | ", other
   * providers append "Name: prompt" lines), so editing that would send them twice.
   */
  prompt: string | null;
  connectionId: string | null;
  negativePrompt: string;
  /** NovelAI V4+ native character captions sent with the request. */
  characterPrompts: SceneIllustrationCharacterPrompt[];
  references: {
    characterIds: string[];
    personaId: string | null;
    /** Maps location reference id (chat gallery id or `global-gallery:<id>`). */
    locationImageId: string | null;
  };
}

export type ChatImageGenerationRecordInput = {
  prompt?: string | null;
  connectionId?: string | null;
  negativePrompt?: string | null;
  characterPrompts?: readonly SceneIllustrationCharacterPrompt[] | null;
  referenceCharacterIds?: readonly string[] | null;
  referencePersonaId?: string | null;
  locationImageId?: string | null;
};

function readTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readCharacterPrompts(value: unknown): SceneIllustrationCharacterPrompt[] {
  if (!Array.isArray(value)) return [];
  const prompts: SceneIllustrationCharacterPrompt[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = readTrimmed(record.name);
    const prompt = readTrimmed(record.prompt);
    if (!name || !prompt) continue;
    const negativePrompt = readTrimmed(record.negativePrompt);
    const position = record.position as Record<string, unknown> | undefined;
    const hasPosition =
      !!position && typeof position === "object" && Number.isFinite(position.x) && Number.isFinite(position.y);
    prompts.push({
      name,
      prompt,
      ...(negativePrompt ? { negativePrompt } : {}),
      ...(hasPosition ? { position: { x: Number(position.x), y: Number(position.y) } } : {}),
    });
  }
  return prompts;
}

function readIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(readTrimmed).filter((id): id is string => id !== null))];
}

/** Build the record a gallery row stores for a freshly generated image. */
export function buildChatImageGenerationRecord(input: ChatImageGenerationRecordInput): ChatImageGenerationRecord {
  return {
    version: 1,
    prompt: readTrimmed(input.prompt),
    connectionId: readTrimmed(input.connectionId),
    negativePrompt: input.negativePrompt?.trim() ?? "",
    characterPrompts: readCharacterPrompts(input.characterPrompts),
    references: {
      characterIds: readIds(input.referenceCharacterIds),
      personaId: readTrimmed(input.referencePersonaId),
      locationImageId: readTrimmed(input.locationImageId),
    },
  };
}

/**
 * Read a stored record. Returns null for images saved before records existed
 * (or for anything malformed), which callers treat as "only the prompt is known".
 */
export function parseChatImageGenerationRecord(value: unknown): ChatImageGenerationRecord | null {
  let raw: unknown = value;
  if (typeof raw === "string") {
    if (!raw.trim()) return null;
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== 1) return null;
  const references = (record.references ?? {}) as Record<string, unknown>;
  return buildChatImageGenerationRecord({
    prompt: typeof record.prompt === "string" ? record.prompt : null,
    connectionId: typeof record.connectionId === "string" ? record.connectionId : null,
    negativePrompt: typeof record.negativePrompt === "string" ? record.negativePrompt : "",
    characterPrompts: Array.isArray(record.characterPrompts)
      ? (record.characterPrompts as SceneIllustrationCharacterPrompt[])
      : [],
    referenceCharacterIds: Array.isArray(references.characterIds) ? (references.characterIds as string[]) : [],
    referencePersonaId: typeof references.personaId === "string" ? references.personaId : null,
    locationImageId: typeof references.locationImageId === "string" ? references.locationImageId : null,
  });
}
