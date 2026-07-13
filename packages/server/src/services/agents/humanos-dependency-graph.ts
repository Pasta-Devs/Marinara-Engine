import type { ResolvedAgent } from "./agent-pipeline.js";

export interface HumanOSDependencyPlan { waves: ResolvedAgent[][]; }

export class HumanOSDependencyError extends Error {
  constructor(message: string, readonly code: "DUPLICATE_KEY" | "MISSING_DEPENDENCY" | "MISSING_ARTIFACT" | "CYCLE") {
    super(message);
  }
}

export function humanOSDependencyStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

export function humanOSAgentKey(agent: Pick<ResolvedAgent, "type" | "settings">): string {
  const configured = agent.settings.pipelineKey;
  return typeof configured === "string" && configured.trim() ? configured.trim() : agent.type;
}

export function humanOSAgentDependencies(agent: Pick<ResolvedAgent, "settings">): string[] {
  return humanOSDependencyStrings(agent.settings.dependencies)
    .filter((dependency) => dependency.startsWith("agent:"))
    .map((dependency) => dependency.slice(6));
}

export function isDeterministicHumanOSAgent(agent: Pick<ResolvedAgent, "settings">): boolean {
  return agent.settings.deterministicPipeline === true;
}

export function planHumanOSDependencyWaves(
  agents: ResolvedAgent[],
  availableArtifacts: Iterable<string>,
  availableAgentResults: Iterable<string> = [],
): HumanOSDependencyPlan {
  const byKey = new Map<string, ResolvedAgent>();
  for (const agent of agents) {
    const agentKey = humanOSAgentKey(agent);
    if (byKey.has(agentKey)) throw new HumanOSDependencyError(`Duplicate HumanOS pipeline key: ${agentKey}`, "DUPLICATE_KEY");
    byKey.set(agentKey, agent);
  }
  const artifacts = new Set(availableArtifacts);
  const priorAgentResults = new Set(availableAgentResults);
  const dependencies = new Map<string, Set<string>>();
  for (const [agentKey, agent] of byKey) {
    const edges = new Set<string>();
    for (const raw of humanOSDependencyStrings(agent.settings.dependencies)) {
      const explicitAgent = raw.startsWith("agent:") ? raw.slice(6) : null;
      const explicitArtifact = raw.startsWith("artifact:") ? raw.slice(9) : null;
      if (explicitArtifact !== null || (!explicitAgent && artifacts.has(raw))) {
        const artifact = explicitArtifact ?? raw;
        if (!artifacts.has(artifact)) throw new HumanOSDependencyError(`${agentKey} requires unavailable artifact: ${artifact}`, "MISSING_ARTIFACT");
        continue;
      }
      const target = explicitAgent ?? raw;
      if (byKey.has(target)) edges.add(target);
      else if (!priorAgentResults.has(target)) throw new HumanOSDependencyError(`${agentKey} requires missing agent: ${target}`, "MISSING_DEPENDENCY");
    }
    dependencies.set(agentKey, edges);
  }
  const remaining = new Set(byKey.keys());
  const completed = new Set<string>();
  const waves: ResolvedAgent[][] = [];
  while (remaining.size) {
    const ready = [...remaining].filter((agentKey) => [...(dependencies.get(agentKey) ?? [])].every((dep) => completed.has(dep))).sort();
    if (!ready.length) throw new HumanOSDependencyError(`HumanOS dependency cycle: ${[...remaining].sort().join(", ")}`, "CYCLE");
    waves.push(ready.map((agentKey) => byKey.get(agentKey)!));
    for (const agentKey of ready) { remaining.delete(agentKey); completed.add(agentKey); }
  }
  return { waves };
}
