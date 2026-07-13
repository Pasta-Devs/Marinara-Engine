import type { GovernedAdapterRegistry } from "./governed-adapters.js";

export interface PlannableProposal {
  id: string;
  targetKind: string;
  targetKey: string;
  writerPriority: number;
  pipelineStage: string | null;
  logicalPatchSlot: string;
  patchHash: string;
  dependencyIdsJson: string;
  failureBoundary: string;
  failureMode: string;
}

export interface PlannedProposal extends PlannableProposal { commitOrder: number; }
export interface TargetPlan { targetKey: string; proposals: PlannedProposal[]; }

const pipelineRanks: Record<string, number> = { post_canonical_tracking: 0, post_canonical_commit: 1 };

export function planGovernedBatch(input: readonly PlannableProposal[], registry: GovernedAdapterRegistry): TargetPlan[] {
  const byId = new Map(input.map((proposal) => [proposal.id, proposal]));
  if (byId.size !== input.length) throw new Error("Duplicate proposal identity in batch");
  const slots = new Map<string, string>();
  for (const proposal of input) {
    const slotKey = `${proposal.targetKey}\u001f${proposal.logicalPatchSlot}`;
    const priorHash = slots.get(slotKey);
    if (priorHash && priorHash !== proposal.patchHash) throw new Error(`Conflicting logical patch slot ${slotKey}`);
    slots.set(slotKey, proposal.patchHash);
    const dependencies = JSON.parse(proposal.dependencyIdsJson) as unknown;
    if (!Array.isArray(dependencies) || dependencies.some((id) => typeof id !== "string")) throw new Error(`Invalid dependencies for ${proposal.id}`);
    for (const dependency of dependencies) if (!byId.has(dependency)) throw new Error(`Missing dependency ${dependency}`);
  }

  const indegree = new Map(input.map((proposal) => [proposal.id, 0]));
  const children = new Map(input.map((proposal) => [proposal.id, [] as string[]]));
  for (const proposal of input) for (const dependency of JSON.parse(proposal.dependencyIdsJson) as string[]) {
    indegree.set(proposal.id, (indegree.get(proposal.id) ?? 0) + 1);
    children.get(dependency)?.push(proposal.id);
  }
  const stableCompare = (a: PlannableProposal, b: PlannableProposal) => {
    const aa = registry.get(a.targetKind); const bb = registry.get(b.targetKind);
    return (pipelineRanks[a.pipelineStage ?? ""] ?? 99) - (pipelineRanks[b.pipelineStage ?? ""] ?? 99)
      || aa.phaseRank - bb.phaseRank
      || aa.targetKindRank - bb.targetKindRank
      || Buffer.from(a.targetKey).compare(Buffer.from(b.targetKey))
      || a.writerPriority - b.writerPriority
      || Buffer.from(a.id).compare(Buffer.from(b.id));
  };
  const ready = input.filter((proposal) => indegree.get(proposal.id) === 0).sort(stableCompare);
  const ordered: PlannableProposal[] = [];
  while (ready.length) {
    const next = ready.shift()!; ordered.push(next);
    for (const childId of children.get(next.id) ?? []) {
      const degree = (indegree.get(childId) ?? 0) - 1; indegree.set(childId, degree);
      if (degree === 0) { ready.push(byId.get(childId)!); ready.sort(stableCompare); }
    }
  }
  if (ordered.length !== input.length) throw new Error("Governed proposal dependencies contain a cycle");

  const groups = new Map<string, PlannedProposal[]>();
  for (const proposal of ordered) {
    const proposals = groups.get(proposal.targetKey) ?? [];
    proposals.push({ ...proposal, commitOrder: proposals.length });
    groups.set(proposal.targetKey, proposals);
  }
  return [...groups.entries()].map(([targetKey, proposals]) => ({ targetKey, proposals }));
}
