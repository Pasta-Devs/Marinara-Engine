// ──────────────────────────────────────────────
// Chat Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { GENERATION_GUIDE_SOURCES } from "../../shared/text/generation-guide";

const canonicalChatModeSchema = z.enum(["conversation", "roleplay", "game"]);

export const chatModeSchema = z.preprocess(
  (value) => (value === "visual_novel" ? "roleplay" : value),
  canonicalChatModeSchema,
);

const messageRoleSchema = z.enum(["user", "assistant", "system", "narrator"]);

export const createChatSchema = z.object({
  name: z.string().min(1).max(200),
  mode: chatModeSchema,
  characterIds: z.array(z.string()).default([]),
  groupId: z.string().nullable().default(null),
  personaId: z.string().nullable().default(null),
  promptPresetId: z.string().nullable().default(null),
  connectionId: z.string().nullable().default(null),
});

export const createMessageSchema = z.object({
  chatId: z.string(),
  role: messageRoleSchema,
  characterId: z.string().nullable().default(null),
  content: z.string(),
});

export const generateRequestSchema = z.object({
  chatId: z.string(),
  userMessage: z.string().nullable().default(null),
  regenerateMessageId: z.string().nullable().default(null),
  connectionId: z.string().nullable().default(null),

  impersonate: z.boolean().optional().default(false),
  streaming: z.boolean().optional().default(true),
  userStatus: z.enum(["active", "idle", "dnd"]).optional().default("active"),
  userActivity: z.string().max(120).optional().default(""),
  userTimeZone: z.string().max(128).optional(),
  mentionedCharacterNames: z.array(z.string()).optional().default([]),
  forCharacterId: z.string().nullable().optional().default(null),
  generationGuide: z.string().nullable().optional().default(null),
  generationGuideSource: z
    .enum(GENERATION_GUIDE_SOURCES)
    .nullable()
    .optional()
    .default(null),
  agentInjectionOverrides: z
    .array(
      z.object({
        agentType: z.string().min(1).max(100),
        agentName: z.string().min(1).max(200).optional(),
        text: z.string().max(50_000),
      }),
    )
    .optional()
    .default([]),
  debugMode: z.boolean().optional().default(false),
  trimIncompleteModelOutput: z.boolean().optional().default(false),
  attachments: z
    .array(
      z.object({
        type: z.string(),
        url: z.string().nullable().optional(),
        data: z.string().nullable().optional(),
        imageUrl: z.string().nullable().optional(),
        filePath: z.string().nullable().optional(),
        filename: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        prompt: z.string().nullable().optional(),
        galleryId: z.string().nullable().optional(),
      }),
    )
    .optional()
    .default([]),

  // Impersonate overrides (applied only when impersonate=true)
  impersonatePresetId: z.string().nullish(),
  impersonateConnectionId: z.string().nullish(),
  impersonateBlockAgents: z.boolean().optional().default(false),
  impersonatePromptTemplate: z.string().optional(),
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
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type GenerateRequestInput = z.infer<typeof generateRequestSchema>;
export type SummariesPatchInput = z.infer<typeof summariesPatchSchema>;
export type MarkAutonomousUnreadInput = z.infer<typeof markAutonomousUnreadSchema>;
