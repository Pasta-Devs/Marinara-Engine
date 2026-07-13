import type { DB } from "../../db/connection.js";
import type { CommitEvidence } from "./governed-proposals.storage.js";

export interface TargetIdentity {
  kind: string;
  scope: string;
  id: string;
  key: string;
}

export interface CommitAuthority {
  evidence: CommitEvidence;
  actor: { type: "agent" | "user" | "administrator" | "system"; id: string; authorityPath: "canonical_turn" | "manual_edit" | "repair" | "migration" };
}

export interface GovernedStateAdapter<Patch = unknown, Projection = unknown> {
  readonly targetKind: string;
  readonly schemaVersion: number;
  readonly phaseRank: number;
  readonly targetKindRank: number;
  normalizeTarget(input: unknown, authority: CommitAuthority): TargetIdentity;
  normalizePatch(operation: string, input: unknown): Patch;
  validatePolicy(input: { operation: string; target: TargetIdentity; patch: Patch; authority: CommitAuthority }): void;
  loadProjection(tx: DB, target: TargetIdentity, operation: string, patch: Patch): Promise<Projection | null>;
  applyPatch(current: Projection | null, operation: string, patch: Patch): Projection;
  validateResult(current: Projection | null, result: Projection): void;
  persistProjection(tx: DB, target: TargetIdentity, result: Projection, revision: number, commitId: string): Promise<void>;
  hashProjection(result: Projection): string;
  inversePatch?(current: Projection, previous: Projection): { operation: string; patch: Patch };
}

export class GovernedAdapterRegistry {
  readonly #adapters = new Map<string, GovernedStateAdapter>();

  register(adapter: GovernedStateAdapter) {
    if (!adapter.targetKind || !Number.isInteger(adapter.schemaVersion) || adapter.schemaVersion < 1) throw new Error("Invalid governed adapter metadata");
    if (this.#adapters.has(adapter.targetKind)) throw new Error(`Duplicate governed adapter ${adapter.targetKind}`);
    this.#adapters.set(adapter.targetKind, adapter);
    return this;
  }

  get(targetKind: string) {
    const adapter = this.#adapters.get(targetKind);
    if (!adapter) throw new Error(`Unregistered governed target kind ${targetKind}`);
    return adapter;
  }

  list() { return [...this.#adapters.values()].sort((a, b) => a.targetKind.localeCompare(b.targetKind)); }
}
