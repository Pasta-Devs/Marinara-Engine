// ──────────────────────────────────────────────
// Chat Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

const canonicalChatModeSchema = z.enum(["conversation", "roleplay", "game"]);

export const chatModeSchema = z.preprocess(
  (value) => (value === "visual_novel" ? "roleplay" : value),
  canonicalChatModeSchema,
);

const messageRoleSchema = z.enum(["user", "assistant", "system", "narrator"]);
const jsonObjectSchema = z.record(z.string(), z.unknown());
const createMessageSwipeSchema = z.object({ content: z.string() }).passthrough();

export const createChatSchema = z.object({
  name: z.string().min(1).max(200),
  mode: chatModeSchema,
  characterIds: z.array(z.string()).default([]),
  groupId: z.string().nullable().default(null),
  personaId: z.string().nullable().default(null),
  promptPresetId: z.string().nullable().default(null),
  connectionId: z.string().nullable().default(null),
});

export const createMessageSchema = z
  .object({
    chatId: z.string(),
    role: messageRoleSchema,
    characterId: z.string().nullable().default(null),
    content: z.string(),
    extra: jsonObjectSchema.optional(),
    activeSwipeIndex: z.number().int().nonnegative().optional(),
    swipes: z.array(createMessageSwipeSchema).optional(),
  })
  .superRefine((message, ctx) => {
    const effectiveSwipeCount = message.swipes && message.swipes.length > 0 ? message.swipes.length : 1;
    if (message.activeSwipeIndex !== undefined && message.activeSwipeIndex >= effectiveSwipeCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activeSwipeIndex"],
        message: "activeSwipeIndex must resolve to an existing swipe",
      });
    }
  });

// Auto-summarization entries — shape-only validation (no length caps).
const summaryEntrySchema = z.object({
  summary: z.string(),
  keyDetails: z.array(z.string()),
});

export const summariesPatchSchema = z.object({
  daySummaries: z.record(z.string(), summaryEntrySchema).optional(),
  weekSummaries: z.record(z.string(), summaryEntrySchema).optional(),
});

export const markAutonomousUnreadSchema = z.object({
  characterId: z.string().min(1).nullable().optional().default(null),
  count: z.number().int().positive().max(100).optional().default(1),
});

export type CreateChatInput = z.infer<typeof createChatSchema>;
export type CreateMessageInput = z.input<typeof createMessageSchema>;
export type SummariesPatchInput = z.infer<typeof summariesPatchSchema>;
export type MarkAutonomousUnreadInput = z.infer<typeof markAutonomousUnreadSchema>;
