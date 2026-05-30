// ──────────────────────────────────────────────
// Theme Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

export const createThemeSchema = z.object({
  name: z.string().min(1).max(200),
  css: z.string().default(""),
  installedAt: z.string().datetime().optional(),
});

export const updateThemeSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    css: z.string().optional(),
    isActive: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Must update at least one field",
  });

export const setActiveThemeSchema = z.object({
  id: z.string().nullable(),
});

export type CreateThemeInput = z.infer<typeof createThemeSchema>;
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;
export type SetActiveThemeInput = z.infer<typeof setActiveThemeSchema>;
