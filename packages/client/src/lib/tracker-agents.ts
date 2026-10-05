// ──────────────────────────────────────────────
// Tracker agents: which agents count as trackers and what a tracker re-run starts
// ──────────────────────────────────────────────
import { BUILT_IN_AGENTS } from "@marinara-engine/shared";

export const isBuiltInAgentType = (agentType: string) => BUILT_IN_AGENTS.some((agent) => agent.id === agentType);
export const isBuiltInTrackerAgentType = (agentType: string) =>
  BUILT_IN_AGENTS.some((agent) => agent.id === agentType && agent.category === "tracker" && !agent.libraryHidden);

/** What "Re-run trackers" starts: the manual trackers when any are set, else every tracker and custom agent. */
export function resolveTrackerRerunTypes(enabledAgentTypes: Set<string>, manualTrackerTypes: Set<string>): string[] {
  if (manualTrackerTypes.size > 0) return Array.from(manualTrackerTypes);
  return Array.from(enabledAgentTypes).filter((type) => isBuiltInTrackerAgentType(type) || !isBuiltInAgentType(type));
}
