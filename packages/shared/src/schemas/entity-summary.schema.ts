import { z } from "zod";

export const entitySummarySourceSchema = z.enum(["ai", "manual"]);
export const entitySummaryContentHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const entitySummaryFieldsSchema = z.object({
  entitySummary: z.string().default(""),
  entitySummaryGeneratedAt: z.string().datetime().nullable().default(null),
  entitySummarySource: entitySummarySourceSchema.nullable().default(null),
  entitySummaryContentHash: entitySummaryContentHashSchema.nullable().default(null),
  entitySummaryProjectionVersion: z.number().int().positive().nullable().default(null),
});

export const characterEntitySummaryFieldsSchema = entitySummaryFieldsSchema.partial();
export const personaEntitySummaryFieldsSchema = entitySummaryFieldsSchema;
export const lorebookEntitySummaryFieldsSchema = entitySummaryFieldsSchema;

export const ENTITY_SUMMARY_BATCH_MAX_ITEMS = 500;
export const ENTITY_SUMMARY_BATCH_TIMEOUT_MIN_MS = 5_000;
export const ENTITY_SUMMARY_BATCH_TIMEOUT_MAX_MS = 10 * 60_000;

export const entitySummaryKindSchema = z.enum(["character", "persona", "lorebook"]);
export const entitySummaryBatchStatusSchema = z.enum(["queued", "running", "completed", "cancelled"]);
export const entitySummaryBatchItemStatusSchema = z.enum([
  "queued",
  "running",
  "candidate",
  "failed",
  "cancelled",
  "applied",
  "stale",
]);
export const entitySummaryBatchItemRefSchema = z.object({
  kind: entitySummaryKindSchema,
  entityId: z.string().trim().min(1).max(200),
});
export const entitySummaryBatchItemSchema = entitySummaryBatchItemRefSchema.extend({
  id: z.string().min(1).max(200),
  batchId: z.string().min(1).max(200),
  status: entitySummaryBatchItemStatusSchema,
  attempts: z.number().int().min(0),
  sourceHash: entitySummaryContentHashSchema.nullable(),
  candidateSummary: z.string().max(4_000).nullable(),
  error: z.string().max(2_000).nullable(),
  connectionId: z.string().max(200).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const entitySummaryBatchSchema = z.object({
  id: z.string().min(1).max(200),
  status: entitySummaryBatchStatusSchema,
  cancelRequested: z.boolean(),
  timeoutMs: z.number().int().min(ENTITY_SUMMARY_BATCH_TIMEOUT_MIN_MS).max(ENTITY_SUMMARY_BATCH_TIMEOUT_MAX_MS),
  debugMode: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  items: z.array(entitySummaryBatchItemSchema).max(ENTITY_SUMMARY_BATCH_MAX_ITEMS),
});
export const startEntitySummaryBatchSchema = z.object({
  items: z.array(entitySummaryBatchItemRefSchema).min(1).max(ENTITY_SUMMARY_BATCH_MAX_ITEMS),
  timeoutMs: z
    .number()
    .int()
    .min(ENTITY_SUMMARY_BATCH_TIMEOUT_MIN_MS)
    .max(ENTITY_SUMMARY_BATCH_TIMEOUT_MAX_MS)
    .optional()
    .default(120_000),
  debugMode: z.boolean().optional().default(false),
});
export const entitySummaryBatchIdParamsSchema = z.object({ batchId: z.string().trim().min(1).max(200) });
export const entitySummaryBatchItemParamsSchema = entitySummaryBatchIdParamsSchema.extend({
  itemId: z.string().trim().min(1).max(200),
});
