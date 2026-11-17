/**
 * Illustrator reference pictures: where "Send avatar references" sends them (experiment, V-102 Fallback A).
 * The image model takes them as references; the prompt writer sees them and describes what it sees. The writer
 * is the fallback for image connections that drop reference pictures (NovelAI V5 and every backend that takes
 * none). The instruction is user text that says what to carry over: art style, the character's look, or both.
 */
export const REFERENCE_PICTURE_TARGETS = ["auto", "image", "writer", "both"] as const;
export type ReferencePictureTarget = (typeof REFERENCE_PICTURE_TARGETS)[number];

export const DEFAULT_WRITER_REFERENCE_INSTRUCTION =
  'Use the attached reference pictures as visual guidance. Carry over each character\'s look (face, hair, eyes, build, outfit) and the art style (medium, line work, shading, palette) as concrete prompt tags. Never write "reference image" or "as in the picture": assume the image model cannot see these pictures, so describe what you see.';

export function isReferencePictureTarget(value: unknown): value is ReferencePictureTarget {
  return typeof value === "string" && (REFERENCE_PICTURE_TARGETS as readonly string[]).includes(value);
}

export interface WriterReferenceSettings {
  /** The agent's own target; a chat can override it (`ChatMetadata.illustratorReferencePictureTarget`). */
  target: ReferencePictureTarget;
  /** The instruction to send; the default when the saved text is empty. */
  instruction: string;
}

export function readWriterReferenceSettings(
  settings: Record<string, unknown> | null | undefined,
): WriterReferenceSettings {
  const target = isReferencePictureTarget(settings?.referencePictureTarget) ? settings.referencePictureTarget : "auto";
  const saved =
    typeof settings?.writerReferenceInstruction === "string" ? settings.writerReferenceInstruction.trim() : "";
  return { target, instruction: saved || DEFAULT_WRITER_REFERENCE_INSTRUCTION };
}

/** The chat's target when it sets one, else the agent's. */
export function resolveReferencePictureTarget(
  chatTarget: unknown,
  agentSettings: Record<string, unknown> | null | undefined,
): ReferencePictureTarget {
  return isReferencePictureTarget(chatTarget) ? chatTarget : readWriterReferenceSettings(agentSettings).target;
}

/**
 * Who gets the pictures once "Send avatar references" is on for images. `auto` sends them to the image model when
 * its connection takes them, else to the writer.
 */
export function routeReferencePictures(
  target: ReferencePictureTarget,
  imageConnectionTakesReferences: boolean,
): { toImageModel: boolean; toWriter: boolean } {
  return {
    toImageModel: target === "image" || target === "both" || (target === "auto" && imageConnectionTakesReferences),
    toWriter: target === "writer" || target === "both" || (target === "auto" && !imageConnectionTakesReferences),
  };
}
