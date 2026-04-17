// ──────────────────────────────────────────────
// Chat Preset Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { chatModeSchema } from "./chat.schema.js";

export const chatPresetSettingsSchema = z
  .object({
    connectionId: z.string().nullable().optional(),
    promptPresetId: z.string().nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export const createChatPresetSchema = z.object({
  name: z.string().min(1).max(120),
  mode: chatModeSchema,
  settings: chatPresetSettingsSchema.default({}),
});

export const updateChatPresetSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    settings: chatPresetSettingsSchema.optional(),
  })
  .strict();

export type CreateChatPresetInput = z.infer<typeof createChatPresetSchema>;
export type UpdateChatPresetInput = z.infer<typeof updateChatPresetSchema>;
export type ChatPresetSettingsInput = z.infer<typeof chatPresetSettingsSchema>;
