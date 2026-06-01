export type GenerationGuideSource = "narrator" | "guide" | "amend" | "game_start" | "game_turn" | "game_retry";

export function buildNarratorInstructionMessage(direction: string): string {
  return `[Narrator instruction — do not include a reply from {{user}}. Instead, write the next part of the narrative steering it toward the following: ${direction.trim()}]`;
}

export function buildGuidedGenerationInstructionMessage(direction: string): string {
  return `[Guided generation instruction — do not include a reply from {{user}}. Instead, write the next generated message steering it toward the following: ${direction.trim()}]`;
}

export function buildAmendGenerationInstructionMessage(direction: string, previousResponse: string): string {
  return [
    "[Amend generation instruction — do not include a reply from {{user}}.",
    "Revise the previous generated response according to the instruction below.",
    "Preserve the parts that already work, keep the same speaker/format unless the instruction says otherwise, and output only the revised response.",
    "",
    "Previous generated response:",
    previousResponse.trim(),
    "",
    "Revision instruction:",
    direction.trim(),
    "]",
  ].join("\n");
}

export function stripGenerationGuideInstruction(value: string): string {
  const amendMatch = value.match(/^\[Amend generation instruction [\s\S]*?\nRevision instruction:\n([\s\S]*)\]$/);
  if (amendMatch) return amendMatch[1]?.trim() || value;
  const match = value.match(/^\[(?:Narrator|Guided generation) instruction [^\]]*? following:\s*([\s\S]*)\]$/);
  return match?.[1]?.trim() || value;
}
