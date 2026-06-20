import type { BuiltInAgentManifest } from "./agent-manifest.types.js";
import { BUILT_IN_AGENT_MANIFESTS } from "./agent-registry.generated.js";

export { BUILT_IN_AGENT_MANIFESTS } from "./agent-registry.generated.js";

export function getBuiltInAgentManifest(agentId: string): BuiltInAgentManifest | null {
  return BUILT_IN_AGENT_MANIFESTS.find((agent) => agent.id === agentId) ?? null;
}

export function isBuiltInAgentHiddenFromLibrary(agentId: string): boolean {
  return getBuiltInAgentManifest(agentId)?.libraryHidden === true;
}

export function isBuiltInAgentRuntimeDisabled(agentId: string): boolean {
  return getBuiltInAgentManifest(agentId)?.runtimeDisabled === true;
}
