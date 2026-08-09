import { z } from "zod";

/**
 * app_settings key carrying the one-time post-migration notice (#4756). The
 * file store writes it after a shard migration; the client shows the notice
 * once and acknowledges by clearing the value.
 */
export const STORAGE_MIGRATION_NOTICE_SETTINGS_KEY = "storage-migration-notice";

export const storageMigrationNoticeSchema = z.object({
  /** Manifest version before the migration; null when no manifest existed. */
  fromFormat: z.number().nullable(),
  toFormat: z.number(),
  migratedTables: z.array(z.string()),
  migratedAt: z.string(),
});

export type StorageMigrationNotice = z.infer<typeof storageMigrationNoticeSchema>;
