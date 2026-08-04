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
