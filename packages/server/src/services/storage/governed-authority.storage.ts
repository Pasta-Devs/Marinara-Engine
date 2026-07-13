import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { stateAuthorityRecords } from "../../db/schema/index.js";
import { now } from "../../utils/id-generator.js";

export type GovernedActorType = "agent" | "user" | "administrator" | "system";
export type GovernedAuthorityPath = "canonical_turn" | "manual_edit" | "repair" | "migration";

export interface ExplicitAuthorityInput {
  actorType: "user" | "administrator" | "system";
  actorId: string;
  authorityPath: Exclude<GovernedAuthorityPath, "canonical_turn">;
  targetKey: string;
  reason: string;
  issuedBy: string;
  authorizationKey: string;
}

type AuthorityExecutor = Pick<DB, "select" | "insert">;

export function explicitAuthorityRecordId(authorizationKey: string) {
  return createHash("sha256").update(`authority:${authorizationKey}`).digest("hex");
}

export function createGovernedAuthorityStorage(db: DB) {
  return {
    async issueExplicit(input: ExplicitAuthorityInput, tx: AuthorityExecutor = db) {
      const existing = await tx
        .select()
        .from(stateAuthorityRecords)
        .where(eq(stateAuthorityRecords.authorizationKey, input.authorizationKey))
        .limit(1);
      if (existing[0]) {
        const row = existing[0];
        if (
          row.authorityKind !== "explicit" ||
          row.actorType !== input.actorType ||
          row.actorId !== input.actorId ||
          row.authorityPath !== input.authorityPath ||
          row.targetKey !== input.targetKey ||
          row.reason !== input.reason ||
          row.issuedBy !== input.issuedBy
        ) {
          throw new Error("Governed authority authorization key conflict");
        }
        return row;
      }

      const row: typeof stateAuthorityRecords.$inferInsert = {
        id: explicitAuthorityRecordId(input.authorizationKey),
        authorityKind: "explicit",
        ...input,
        createdAt: now(),
      };
      await tx.insert(stateAuthorityRecords).values(row);
      return row as typeof stateAuthorityRecords.$inferSelect;
    },
  };
}
