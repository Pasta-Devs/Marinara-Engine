/**
 * Illustrator writer reference pictures (experiment, V-102 Fallback A): when the image connection drops reference
 * pictures (NovelAI V5 and every backend that takes none), the prompt writer sees them instead. The instruction is
 * user text that says what to carry over — art style, the character's look, or both.
 */
export type WriterReferenceSource = "off" | "cast";

export const DEFAULT_WRITER_REFERENCE_INSTRUCTION =
  'Use the attached reference pictures as visual guidance. Carry over each character\'s look (face, hair, eyes, build, outfit) and the art style (medium, line work, shading, palette) as concrete prompt tags. Never write "reference image" or "as in the picture": the image model cannot see these pictures, so describe what you see.';

export interface WriterReferenceSettings {
  source: WriterReferenceSource;
  /** The instruction to send; the default when the saved text is empty. */
  instruction: string;
}

export function readWriterReferenceSettings(
  settings: Record<string, unknown> | null | undefined,
): WriterReferenceSettings {
  const source: WriterReferenceSource = settings?.writerReferenceSource === "cast" ? "cast" : "off";
  const saved =
    typeof settings?.writerReferenceInstruction === "string" ? settings.writerReferenceInstruction.trim() : "";
  return { source, instruction: saved || DEFAULT_WRITER_REFERENCE_INSTRUCTION };
}
