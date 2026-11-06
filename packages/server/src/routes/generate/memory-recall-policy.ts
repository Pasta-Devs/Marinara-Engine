import type { AgentInjection } from "../../services/agents/agent-pipeline.js";

/**
 * Decide where a turn's recalled memories go (#8359). An active Long-term memory package
 * replaces the built-in `memory_chunks` recall in the main prompt, regenerated turns included,
 * and its text goes in the conversation `memories` slot when the preset has one.
 */
export function resolveMemoryRecallPolicy(input: { longTermMemoryActive: boolean; memoriesSlot: boolean }): {
  builtInRecall: boolean;
  longTermMemoryPlacement: "memories-slot" | "agent" | "none";
} {
  if (!input.longTermMemoryActive) return { builtInRecall: true, longTermMemoryPlacement: "none" };
  return { builtInRecall: false, longTermMemoryPlacement: input.memoriesSlot ? "memories-slot" : "agent" };
}

/** On a slot-mode regenerate, cached Long-term memory notes fill the slot and stay out of the runtime-section replay. */
export function splitCachedLongTermMemory(injections: AgentInjection[]): {
  slotText: string;
  replay: AgentInjection[];
} {
  return {
    slotText: injections
      .filter((injection) => injection.agentType === "long-term-memory")
      .map((injection) => injection.text)
      .join("\n\n"),
    replay: injections.filter((injection) => injection.agentType !== "long-term-memory"),
  };
}
