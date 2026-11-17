/**
 * Writer reference pictures (experiment, V-102 Fallback A).
 *
 * When the image connection drops reference pictures (NovelAI V5, and every backend the support table marks
 * false), the Illustrator's prompt writer gets them instead, with a user-editable instruction that says what to
 * carry over (art style, the character's look, or both). A writer cannot match a model that takes the picture,
 * but it can turn what it sees into prompt words instead of losing the reference entirely.
 */
import { DEFAULT_WRITER_REFERENCE_INSTRUCTION } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import type { BaseLLMProvider, ChatMessage } from "../llm/base-provider.js";
import { withLorebookImageCompatibility } from "../llm/lorebook-image-provider.js";
import { getSharp } from "../../utils/sharp.js";
import { isAllowedImageBuffer } from "../../utils/security.js";

/** Pictures prepared for the writer, set on the agent context by the generate route. */
export const WRITER_REFERENCE_MEMORY_KEY = "_writerReferencePictures";
/** Names from `[illustrate: characters="…"]`, so the writer gets exactly those cards. */
export const WRITER_REFERENCE_NAMES_MEMORY_KEY = "_writerReferenceNames";

export const WRITER_REFERENCE_MAX_PICTURES = 4;
const WRITER_REFERENCE_MAX_SIDE = 1568;
const WRITER_REFERENCE_JPEG_QUALITY = 88;

export interface WriterReferencePicture {
  label: string;
  dataUrl: string;
}

export interface WriterReferencePayload {
  instruction: string;
  pictures: WriterReferencePicture[];
}

export function readWriterReferencePayload(memory: Record<string, unknown>): WriterReferencePayload | null {
  const value = memory[WRITER_REFERENCE_MEMORY_KEY] as Partial<WriterReferencePayload> | undefined;
  if (!value || !Array.isArray(value.pictures) || value.pictures.length === 0) return null;
  const pictures = value.pictures.filter(
    (picture): picture is WriterReferencePicture =>
      !!picture && typeof picture.dataUrl === "string" && typeof picture.label === "string",
  );
  if (pictures.length === 0) return null;
  return {
    instruction: typeof value.instruction === "string" ? value.instruction : DEFAULT_WRITER_REFERENCE_INSTRUCTION,
    pictures,
  };
}

/** Shrinks a reference inside 1568 px as JPEG q88, so four sheets don't cost more than the illustration. */
export async function prepareWriterReferencePicture(input: string): Promise<string | null> {
  const base64 = input.startsWith("data:") ? input.slice(input.indexOf(",") + 1) : input;
  if (!base64) return null;
  const buffer = Buffer.from(base64, "base64");
  const validated = isAllowedImageBuffer(buffer);
  if (!validated) return null;
  const sharp = await getSharp();
  if (sharp) {
    try {
      const out = await sharp(buffer)
        .rotate()
        .resize({
          width: WRITER_REFERENCE_MAX_SIDE,
          height: WRITER_REFERENCE_MAX_SIDE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: WRITER_REFERENCE_JPEG_QUALITY })
        .toBuffer();
      return `data:image/jpeg;base64,${out.toString("base64")}`;
    } catch (error) {
      logger.warn(error, "[writer-references] Could not shrink a reference picture; sending it as it is");
    }
  }
  return `data:${validated.mimeType};base64,${base64}`;
}

/** Labels each picture by number, like the emoji-vision legend, so the writer can match pictures to names. */
export function buildWriterReferenceBlock(payload: WriterReferencePayload): string {
  return [
    "<reference_pictures>",
    payload.instruction,
    ...payload.pictures.map((picture, index) => `Picture ${index + 1}: ${picture.label}`),
    "If no pictures are attached, ignore this block.",
    "</reference_pictures>",
  ].join("\n");
}

/** Adds the block and the pictures to the last user message (several providers refuse images in system blocks). */
export function attachWriterReferencePictures(messages: ChatMessage[], payload: WriterReferencePayload): ChatMessage[] {
  const block = buildWriterReferenceBlock(payload);
  const images = payload.pictures.map((picture) => picture.dataUrl);
  const next = [...messages];
  const lastIndex = next.map((message) => message.role).lastIndexOf("user");
  if (lastIndex === -1) {
    next.push({ role: "user", content: block, images, contextKind: "prompt" });
    return next;
  }
  const last = next[lastIndex]!;
  next[lastIndex] = {
    ...last,
    content: `${last.content}\n\n${block}`,
    images: [...(last.images ?? []), ...images],
  };
  return next;
}

/** Writers that refused pictures, per connection + model, until the server restarts (Slurp's approach). */
const rejectedWriters = new Set<string>();

export function writerVisionKey(connectionId: string | null | undefined, model: string): string {
  return `${connectionId ?? "chat"}::${model}`;
}

export function writerRejectsPictures(key: string): boolean {
  return rejectedWriters.has(key);
}

/**
 * Try first, fail gracefully, remember: the writer gets the pictures; if its model refuses image input, the call
 * is retried once without them and the refusal is remembered for this connection and model.
 */
export function withWriterReferenceFallback(
  provider: BaseLLMProvider,
  payload: WriterReferencePayload,
  key: string,
): BaseLLMProvider {
  return withLorebookImageCompatibility(provider, new Set(payload.pictures.map((picture) => picture.dataUrl)), () => {
    if (rejectedWriters.has(key)) return;
    rejectedWriters.add(key);
    logger.info(
      "[writer-references] The prompt writer (%s) refused reference pictures; retried without them and remembered",
      key,
    );
  });
}

/** One line per attach, so "the writer saw it and it didn't help" can be told from "it never arrived". */
export function logWriterReferenceAttach(where: string, payload: WriterReferencePayload): void {
  const bytes = payload.pictures.reduce(
    (sum, picture) => sum + Math.floor(((picture.dataUrl.length - picture.dataUrl.indexOf(",") - 1) * 3) / 4),
    0,
  );
  logger.info(
    "[writer-references] %s: attached %d picture(s), %d KB (%s)",
    where,
    payload.pictures.length,
    Math.round(bytes / 1024),
    payload.pictures.map((picture) => picture.label).join(", "),
  );
}
