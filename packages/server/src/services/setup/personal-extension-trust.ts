// ──────────────────────────────────────────────
// Personal Extension trust migration
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import { normalizePersonalExtensionCapabilities } from "@marinara-engine/shared";
import { eq } from "../../db/file-query.js";
import { installedExtensions } from "../../db/schema/index.js";
import { computePersonalExtensionHash } from "../extensions/personal-extension-hash.js";

export type PersonalExtensionTrustMigrationResult = {
  legacyRecordsQuarantined: number;
  changedRecordsDisabled: number;
};

export async function preparePersonalExtensionTrust(db: DB): Promise<PersonalExtensionTrustMigrationResult> {
  let legacyRecordsQuarantined = 0;
  let changedRecordsDisabled = 0;
  const rows = await db.select().from(installedExtensions);
  for (const row of rows) {
    const runtime = row.runtime === "server" ? "server" : "client";
    const contentHash = computePersonalExtensionHash({
      runtime,
      capabilities:
        runtime === "client"
          ? (() => {
              try {
                return normalizePersonalExtensionCapabilities(JSON.parse(row.capabilities || "[]"));
              } catch {
                return [];
              }
            })()
          : [],
      css: runtime === "client" ? row.css : null,
      js: runtime === "client" ? row.js : null,
      serverJs: runtime === "server" ? row.serverJs : null,
    });
    const isLegacy = !row.contentHash;
    const hashChanged = Boolean(row.contentHash) && row.contentHash !== contentHash;
    if (!isLegacy && !hashChanged) continue;
    await db
      .update(installedExtensions)
      .set({
        enabled: "false",
        contentHash,
        approvedHash: null,
        source: isLegacy ? "legacy" : row.source,
        revisions: row.revisions || "[]",
      })
      .where(eq(installedExtensions.id, row.id));
    if (isLegacy) legacyRecordsQuarantined += 1;
    else changedRecordsDisabled += 1;
  }
  if (legacyRecordsQuarantined > 0 || changedRecordsDisabled > 0) {
    await db._fileStore.flush();
  }
  return { legacyRecordsQuarantined, changedRecordsDisabled };
}
