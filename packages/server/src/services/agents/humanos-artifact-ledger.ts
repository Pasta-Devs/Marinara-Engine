import type { AgentResult } from "@marinara-engine/shared";
import { fingerprintHumanOSSnapshot } from "../generation/humanos-turn-snapshot.js";
import type { ResolvedAgent } from "./agent-pipeline.js";
import { humanOSAgentKey } from "./humanos-dependency-graph.js";

export type HumanOSFailureMode = "REQUIRED" | "DEGRADABLE" | "OPTIONAL";
export type HumanOSResultDisposition = "succeeded" | "failed" | "blocked_dependency";

export interface HumanOSArtifactRecord {
  name: string;
  source: string;
  available: boolean;
  contentHash: string | null;
}

export interface HumanOSAgentLedgerRecord {
  pipelineKey: string;
  agentId: string;
  agentType: string;
  failureMode: HumanOSFailureMode;
  disposition: HumanOSResultDisposition;
  outputHash: string | null;
  diagnostic: string | null;
  blockedBy: string[];
}

export interface HumanOSLedgerSnapshot {
  turnId: string;
  artifacts: HumanOSArtifactRecord[];
  agents: HumanOSAgentLedgerRecord[];
}

export class HumanOSRequiredAgentFailure extends Error {
  constructor(readonly records: HumanOSAgentLedgerRecord[]) {
    super(`Required HumanOS pipeline agent failed: ${records.map((record) => record.pipelineKey).join(", ")}`);
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function humanOSFailureMode(agent: Pick<ResolvedAgent, "settings">): HumanOSFailureMode {
  const value = agent.settings.failureMode;
  return value === "DEGRADABLE" || value === "OPTIONAL" || value === "REQUIRED" ? value : "REQUIRED";
}

export class HumanOSTurnArtifactLedger {
  private readonly artifacts = new Map<string, HumanOSArtifactRecord>();
  private readonly agents = new Map<string, HumanOSAgentLedgerRecord>();

  constructor(readonly turnId: string, artifacts: Iterable<string> = []) {
    for (const name of artifacts) this.recordArtifact(name, "turn_capture", true);
  }

  recordArtifact(name: string, source: string, available: boolean, value?: unknown): void {
    this.artifacts.set(name, deepFreeze({
      name,
      source,
      available,
      contentHash: available && value !== undefined ? fingerprintHumanOSSnapshot(value) : null,
    }));
  }

  availableArtifacts(): string[] {
    return [...this.artifacts.values()].filter((record) => record.available).map((record) => record.name).sort();
  }

  recordResult(agent: ResolvedAgent, result: AgentResult): HumanOSAgentLedgerRecord {
    return this.recordAgent(agent, result.success ? "succeeded" : "failed", result.success ? null : (result.error ?? "Agent execution failed"), [], result.success ? result.data : undefined);
  }

  recordBlocked(agent: ResolvedAgent, blockedBy: string[]): HumanOSAgentLedgerRecord {
    return this.recordAgent(agent, "blocked_dependency", `Blocked by failed dependency: ${blockedBy.join(", ")}`, blockedBy);
  }

  private recordAgent(agent: ResolvedAgent, disposition: HumanOSResultDisposition, diagnostic: string | null, blockedBy: string[], output?: unknown): HumanOSAgentLedgerRecord {
    const record = deepFreeze({
      pipelineKey: humanOSAgentKey(agent),
      agentId: agent.id,
      agentType: agent.type,
      failureMode: humanOSFailureMode(agent),
      disposition,
      outputHash: disposition === "succeeded" ? fingerprintHumanOSSnapshot(output) : null,
      diagnostic,
      blockedBy: [...blockedBy].sort(),
    });
    this.agents.set(record.pipelineKey, record);
    return record;
  }

  resultFor(pipelineKey: string): HumanOSAgentLedgerRecord | undefined {
    return this.agents.get(pipelineKey);
  }

  recordedAgentKeys(): string[] {
    return [...this.agents.keys()].sort();
  }

  assertNoRequiredFailure(records: HumanOSAgentLedgerRecord[]): void {
    const blocking = records.filter((record) => record.failureMode === "REQUIRED" && record.disposition !== "succeeded");
    if (blocking.length) throw new HumanOSRequiredAgentFailure(blocking);
  }

  snapshot(): HumanOSLedgerSnapshot {
    return deepFreeze({
      turnId: this.turnId,
      artifacts: [...this.artifacts.values()].sort((a, b) => a.name.localeCompare(b.name)).map((record) => ({ ...record })),
      agents: [...this.agents.values()].sort((a, b) => a.pipelineKey.localeCompare(b.pipelineKey)).map((record) => ({ ...record, blockedBy: [...record.blockedBy] })),
    });
  }
}
