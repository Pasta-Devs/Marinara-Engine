import type { DB } from "../../db/connection.js";
import { flushDB } from "../../db/connection.js";
import { migrateLegacyChatCapabilitySelections } from "./legacy-capability-chat-migration.js";
import { capabilityPackageManager } from "./package-manager.service.js";

type AvailabilityMigrationResult = Awaited<ReturnType<typeof capabilityPackageManager.migrateLegacyAvailability>>;

export type LegacyCapabilityMigrationDependencies = {
  migrateAvailability: (legacyInstall: boolean) => Promise<AvailabilityMigrationResult>;
  migrateChatSelections: (db: DB) => Promise<void>;
  flush: () => Promise<void>;
  complete: () => Promise<void>;
};

const defaultDependencies: LegacyCapabilityMigrationDependencies = {
  migrateAvailability: (legacyInstall) => capabilityPackageManager.migrateLegacyAvailability(legacyInstall),
  migrateChatSelections: migrateLegacyChatCapabilitySelections,
  flush: flushDB,
  complete: () => capabilityPackageManager.completeLegacyAvailabilityMigration(),
};

/** Install legacy packages, persist per-chat selections, then commit completion. */
export async function migrateLegacyCapabilities(
  db: DB,
  legacyInstall: boolean,
  dependencies: LegacyCapabilityMigrationDependencies = defaultDependencies,
): Promise<AvailabilityMigrationResult> {
  const migration = await dependencies.migrateAvailability(legacyInstall);
  if (!migration.migrated) return migration;

  await dependencies.migrateChatSelections(db);
  await dependencies.flush();
  await dependencies.complete();
  return { ...migration, complete: true };
}
