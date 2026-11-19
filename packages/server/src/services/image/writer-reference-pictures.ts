/**
 * Writer reference pictures (experiment, V-102 Fallback A).
 *
 * When the image connection drops reference pictures (NovelAI V5, and every backend the support table marks
 * false), the Illustrator's prompt writer gets them instead, with a user-editable instruction that says what to
 * carry over (art style, the character's look, or both). A writer cannot match a model that takes the picture,
 * but it can turn what it sees into prompt words instead of losing the reference entirely.
 */
import {
  DEFAULT_WRITER_REFERENCE_INSTRUCTION,
  modelReadsImages,
  readWriterReferenceSettings,
  resolveReferencePictureTarget,
  routeReferencePictures,
} from "@marinara-engine/shared";
import { avatarImageService } from "../avatars/generation/generation-context.js";
import { imageConnectionTakesReferencePicture } from "./image-generation.js";
import {
  resolveIllustratorCharacterReferences,
  type IllustratorChatCharacterReference,
  type IllustratorPersonaReference,
} from "./illustrator-references.js";
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

/** One line per request that carries pictures; a writer that refuses them logs its own line (withWriterReferenceFallback). */
export function logWriterReferenceAttach(where: string, payload: WriterReferencePayload): void {
  const bytes = payload.pictures.reduce(
    (sum, picture) => sum + Math.floor(((picture.dataUrl.length - picture.dataUrl.indexOf(",") - 1) * 3) / 4),
    0,
  );
  logger.info(
    "[writer-references] %s: sending %d picture(s), %d KB (%s); a refusal is logged separately",
    where,
    payload.pictures.length,
    Math.round(bytes / 1024),
    payload.pictures.map((picture) => picture.label).join(", "),
  );
}

type AvatarConnection = Parameters<typeof avatarImageService>[0];
/** What the routing reads from an image connection; the API key is not needed, so a keyless row will do. */
export type ImageConnectionLike = Pick<AvatarConnection, "model" | "baseUrl" | "imageService" | "comfyuiWorkflow">;

/**
 * The writer's pictures for one Illustrator run, or null with a log line saying why not. Shared by the chat
 * pipeline, `[illustrate:]`, the retry route and the Gallery's illustrate button, so they all route alike.
 * Follows the effective "Send avatar references" (images: the chat override wins, then the agent's) and the
 * "Reference pictures go to" target.
 */
type CollectWriterReferenceArgs = {
  agentSettings: Record<string, unknown> | null | undefined;
  chatMeta: Record<string, unknown>;
  imageConnection: ImageConnectionLike;
  writer: { visionKey: string; connectionId: string; imageInput: string | null | undefined };
  /** Card names from `[illustrate: characters="…"]`; empty means the chat's active cast and persona. */
  namedCards: readonly string[];
  cast: { chatCharacters: IllustratorChatCharacterReference[]; persona: IllustratorPersonaReference | null };
  references: Pick<
    Parameters<typeof resolveIllustratorCharacterReferences>[0],
    "charactersStore" | "chatScope" | "characterGallery" | "personaGallery"
  >;
};

/** Never fails the run: pictures that can't be read leave the writer without them (a cancel still cancels). */
export async function collectWriterReferencePictures(
  args: CollectWriterReferenceArgs,
): Promise<WriterReferencePayload | null> {
  try {
    return await collectWriterReferencePicturesOrThrow(args);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    logger.warn(error, "[writer-references] Could not prepare reference pictures; the writer runs without them");
    return null;
  }
}

async function collectWriterReferencePicturesOrThrow(
  args: CollectWriterReferenceArgs,
): Promise<WriterReferencePayload | null> {
  const avatarReferencesOn =
    typeof args.chatMeta.illustratorUseAvatarReferences === "boolean"
      ? args.chatMeta.illustratorUseAvatarReferences
      : args.agentSettings?.useAvatarReferences === true;
  if (!avatarReferencesOn) return null;
  const target = resolveReferencePictureTarget(args.chatMeta.illustratorReferencePictureTarget, args.agentSettings);
  const takesReferences = imageConnectionTakesReferencePicture(
    avatarImageService(args.imageConnection as AvatarConnection),
  );
  if (!routeReferencePictures(target, takesReferences).toWriter) {
    if (target === "auto")
      logger.info("[writer-references] Skipped: the image connection takes reference pictures itself");
    return null;
  }
  const readsImages = modelReadsImages({ id: args.writer.connectionId, imageInput: args.writer.imageInput });
  if (readsImages === false || writerRejectsPictures(args.writer.visionKey)) {
    logger.info(
      "[writer-references] Skipped: the Illustrator's writer (%s) does not read images",
      args.writer.visionKey,
    );
    return null;
  }
  const inactiveIds = new Set(
    Array.isArray(args.chatMeta.inactiveCharacterIds) ? (args.chatMeta.inactiveCharacterIds as unknown[]) : [],
  );
  const activeCharacters = args.cast.chatCharacters.filter((character) => !inactiveIds.has(character.id));
  const namedCards = args.namedCards.filter((name) => name.trim().length > 0);
  const requestedNames = namedCards.length
    ? namedCards
    : [...activeCharacters.map((character) => character.name), ...(args.cast.persona ? [args.cast.persona.name] : [])];
  const resolution = await resolveIllustratorCharacterReferences({
    ...args.references,
    chatCharacters: activeCharacters,
    persona: args.cast.persona,
    requestedNames,
    promptText: "",
    fallbackToChatCharacters: false,
    includeReferenceImages: true,
    includePersonaWhenMentionedInPrompt: false,
    maxReferences: WRITER_REFERENCE_MAX_PICTURES,
  });
  const pictures: WriterReferencePicture[] = [];
  for (const [index, image] of resolution.referenceImages.entries()) {
    if (pictures.length >= WRITER_REFERENCE_MAX_PICTURES) break;
    const dataUrl = await prepareWriterReferencePicture(image);
    if (dataUrl) pictures.push({ label: resolution.referenceNames[index] ?? "reference", dataUrl });
  }
  if (pictures.length === 0) {
    logger.info("[writer-references] Skipped: no reference pictures for %s", requestedNames.join(", ") || "the cast");
    return null;
  }
  return { instruction: readWriterReferenceSettings(args.agentSettings).instruction, pictures };
}

/** Card names a `[illustrate: characters="…"]` command left in the agent memory. */
export function readWriterReferenceNames(memory: Record<string, unknown>): string[] {
  const names = memory[WRITER_REFERENCE_NAMES_MEMORY_KEY];
  return Array.isArray(names) ? names.filter((name): name is string => typeof name === "string") : [];
}

/**
 * Whether the image model still gets the avatar references once the writer may have them: not for "Prompt writer",
 * nor for "Automatic" when the image connection cannot take them.
 */
export function imageModelGetsReferencePictures(
  chatMeta: Record<string, unknown>,
  agentSettings: Record<string, unknown> | null | undefined,
  imageConnection: ImageConnectionLike,
): boolean {
  const target = resolveReferencePictureTarget(chatMeta.illustratorReferencePictureTarget, agentSettings);
  return routeReferencePictures(
    target,
    imageConnectionTakesReferencePicture(avatarImageService(imageConnection as AvatarConnection)),
  ).toImageModel;
}
