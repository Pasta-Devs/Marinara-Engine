// The read/write half of the `achievements` permission. Every id is checked against the registry
// before it reaches storage, so a package can only ever read or unlock a badge it registered
// itself — the unlock table is one flat keyspace shared with the Engine's own badges.

import type { CapabilityAchievementHost } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createAchievementsService } from "../achievements/achievements.service.js";
import { isCapabilityAchievementOwnedBy, qualifyAchievementId } from "./capability-achievement-registry.service.js";

export function createCapabilityAchievementHost(
  db: DB | undefined,
  packageId: string,
  permissions: readonly string[],
): CapabilityAchievementHost {
  function guard(id: string): string {
    if (!permissions.includes("achievements")) {
      throw new Error(`Capability package ${packageId} must declare the "achievements" permission`);
    }
    // A package may pass either its local id or the namespaced one it sees in the panel.
    const qualified = id.includes(".") ? id : qualifyAchievementId(packageId, id);
    if (!isCapabilityAchievementOwnedBy(packageId, qualified)) {
      throw new Error(`Capability package ${packageId} does not own achievement ${id}`);
    }
    return qualified;
  }

  function service() {
    if (!permissions.includes("achievements")) {
      throw new Error(`Capability package ${packageId} must declare the "achievements" permission`);
    }
    if (!db) throw new Error("Achievements are unavailable before the database is ready");
    return createAchievementsService(db);
  }

  return Object.freeze({
    async list() {
      return service().listForPackage(packageId);
    },
    async isUnlocked(id: string) {
      const qualified = guard(id);
      return service().isUnlocked(qualified);
    },
    async unlock(id: string) {
      const qualified = guard(id);
      return service().unlock(qualified);
    },
  });
}
