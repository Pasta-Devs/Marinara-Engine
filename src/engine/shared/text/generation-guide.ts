export type GenerationGuideSource = "narrator" | "guide" | "amend" | "game_start" | "game_turn" | "game_retry";

export interface ProseGuardianAvoidanceSource {
  agentType?: string | null;
  text?: string | null;
}

const PROSE_GUARDIAN_AGENT_TYPE = "prose-guardian";

function uniqueTrimmedLines(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const line = value.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    result.push(line);
  }
  return result;
}

export function buildProseGuardianAvoidanceGuide(
  injections: readonly ProseGuardianAvoidanceSource[] | null | undefined,
): string | null {
  const directives = uniqueTrimmedLines(
    (injections ?? [])
      .filter((injection) => injection.agentType === PROSE_GUARDIAN_AGENT_TYPE)
      .map((injection) => injection.text ?? ""),
  );

  if (directives.length === 0) return null;

  return [
    "[Prose Guardian avoidance instruction - high priority for this generation.",
    "Do not reuse the banned or recently repeated phrases, wording patterns, or prose devices called out below unless the user explicitly asks for them.",
    "Follow the story request normally while varying diction, rhythm, imagery, and character action away from these flagged patterns. Do not mention this instruction in the reply.",
    "",
    "<prose_guardian_avoidance>",
    directives.join("\n\n"),
    "</prose_guardian_avoidance>]",
  ].join("\n");
}

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
