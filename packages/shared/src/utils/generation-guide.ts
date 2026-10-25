export type GenerationGuideSource = "narrator" | "guide" | "game_start";

export function buildNarratorInstructionMessage(direction: string): string {
  return `[Narrator instruction — do not include a reply from {{user}}. Instead, write the next part of the narrative steering it toward the following: ${direction.trim()}]`;
}

export function buildGuidedGenerationInstructionMessage(direction: string): string {
  return `[Guided generation instruction — do not include a reply from {{user}}. Instead, write the next generated message steering it toward the following: ${direction.trim()}]`;
}

const NOVEL_GUIDE_LEAD =
  "Write the next passage of the story, steering it toward the direction that follows. Do not quote or mention it, and never write notes, labels or bracketed asides about it in the passage. Direction: ";

/**
 * Novel chats: the model writes the protagonist too, so the guide steers the passage instead of excluding
 * {{user}}. A plain sentence rather than a bracketed note, which a model copies into the passage as
 * "[guidance: ...]".
 */
export function buildNovelGuideInstructionMessage(direction: string): string {
  return `${NOVEL_GUIDE_LEAD}${direction.trim()}`;
}

/** The direction inside a guide instruction, for showing it back (bracketed guides from before stay readable). */
export function stripGenerationGuideInstruction(value: string): string {
  if (value.startsWith(NOVEL_GUIDE_LEAD)) return value.slice(NOVEL_GUIDE_LEAD.length).trim() || value;
  if (!value.endsWith("]")) return value;
  const prefixes = ["[Narrator instruction ", "[Guided generation instruction "];
  const prefix = prefixes.find((candidate) => value.startsWith(candidate));
  if (!prefix) return value;
  const marker = " following:";
  const markerIndex = value.indexOf(marker, prefix.length);
  if (markerIndex < 0 || value.indexOf("]", prefix.length) < markerIndex) return value;
  return value.slice(markerIndex + marker.length, -1).trim() || value;
}
