import type { DB } from "../../db/connection.js";
import { stateParityVerifications } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { canonicalJson } from "./canonical-json.js";
import type { CommitAuthority, GovernedStateAdapter, TargetIdentity } from "./governed-adapters.js";

export function createGovernedParityStorage(db: DB) {
  return {
    async verify<Patch, Projection>(input: { proposalId?: string; adapter: GovernedStateAdapter<Patch, Projection>; target: TargetIdentity; operation: string; patch: Patch; authority: CommitAuthority; legacyProjection: Projection | null }) {
      input.adapter.validatePolicy({ operation: input.operation, target: input.target, patch: input.patch, authority: input.authority });
      const current = await input.adapter.loadProjection(db, input.target, input.operation, input.patch);
      const predicted = input.adapter.applyPatch(current, input.operation, input.patch);
      input.adapter.validateResult(current, predicted);
      const predictedHash = input.adapter.hashProjection(predicted);
      const legacyHash = input.legacyProjection === null ? "" : input.adapter.hashProjection(input.legacyProjection);
      const row: typeof stateParityVerifications.$inferInsert = { id: newId(), proposalId: input.proposalId ?? null, adapterKind: input.adapter.targetKind, targetKey: input.target.key, legacyHash, predictedHash, matched: predictedHash === legacyHash, diagnosticJson: predictedHash === legacyHash ? null : canonicalJson({ mismatch: true }), createdAt: now() };
      await db.insert(stateParityVerifications).values(row);
      return row as typeof stateParityVerifications.$inferSelect;
    },
  };
}
