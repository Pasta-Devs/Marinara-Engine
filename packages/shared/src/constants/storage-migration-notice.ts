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
  /** Tables split from one monolith file into per-owner shard files. */
  migratedTables: z.array(z.string()),
  /**
   * Tables whose rows were rewritten into a new row format (format 11: personas stored as
   * character cards). Absent on notices written before format 11.
   */
  convertedTables: z.array(z.string()).optional(),
  migratedAt: z.string(),
});

export type StorageMigrationNotice = z.infer<typeof storageMigrationNoticeSchema>;
