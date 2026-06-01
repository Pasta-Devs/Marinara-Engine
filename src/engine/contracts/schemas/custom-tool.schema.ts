// ──────────────────────────────────────────────
// Custom Tool Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

const toolExecutionTypeSchema = z.enum(["webhook", "static"]);

export const createCustomToolSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, "Tool name must be lowercase snake_case"),
  description: z.string().min(1).max(500),
  parametersSchema: z.record(z.unknown()).default({}),
  executionType: toolExecutionTypeSchema.default("static"),
  webhookUrl: z.string().url().nullable().default(null),
  staticResult: z.string().nullable().default(null),
  enabled: z.boolean().default(true),
});

export const updateCustomToolSchema = createCustomToolSchema.partial();

export type CreateCustomToolInput = z.infer<typeof createCustomToolSchema>;
export type UpdateCustomToolInput = z.infer<typeof updateCustomToolSchema>;
