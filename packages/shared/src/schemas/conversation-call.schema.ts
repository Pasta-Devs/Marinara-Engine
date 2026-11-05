import { z } from "zod";

export const conversationCallStatusSchema = z.enum(["ringing", "active", "ended", "declined", "missed"]);
export const conversationCallModeSchema = z.enum(["audio", "video"]);
export const conversationCallInitiatorSchema = z.enum(["user", "character"]);
export const conversationCallMessageKindSchema = z.enum(["speech", "text", "system", "command", "soundboard"]);
export const conversationCallTurnModeSchema = z.enum(["voice", "text", "command"]);
export const conversationCallAudioInputModeSchema = z.enum(["system", "auto", "transcribe", "local_whisper"]);
export const conversationCallMusicPlayerSourceSchema = z.enum(["spotify", "youtube", "custom"]);

export const startConversationCallSchema = z.object({
  chatId: z.string().min(1),
  mode: conversationCallModeSchema.default("audio"),
  initiator: conversationCallInitiatorSchema.default("user"),
  initiatorCharacterId: z.string().nullable().optional().default(null),
  metadata: z.record(z.string(), z.unknown()).prefault({}),
});

export const conversationCallIdParamSchema = z.object({
  id: z.string().min(1),
});

export const sendConversationCallMessageSchema = z.object({
  content: z.string().min(1).max(50_000),
  inputMode: z.enum(["typed", "speech"]).default("typed"),
  debugMode: z.boolean().optional().default(false),
  musicPlayerEnabled: z.boolean().optional(),
  musicPlayerSource: conversationCallMusicPlayerSourceSchema.optional(),
});

export const conversationCallIdleSchema = z.object({
  quietMs: z
    .number()
    .int()
    .min(30_000)
    .max(30 * 60_000)
    .default(150_000),
  debugMode: z.boolean().optional().default(false),
  musicPlayerEnabled: z.boolean().optional(),
  musicPlayerSource: conversationCallMusicPlayerSourceSchema.optional(),
});

export const conversationCallInterruptionSchema = z.object({
  characterId: z.string().nullable().optional().default(null),
  speakerName: z.string().max(200).nullable().optional().default(null),
  spokenText: z.string().max(10_000).optional().default(""),
});

export const conversationCallTurnSchema = z.object({
  id: z.string().optional(),
  speakerName: z.string().min(1).max(200),
  mode: conversationCallTurnModeSchema,
  content: z.string().max(50_000).default(""),
  tone: z.string().max(200).nullable().optional(),
});

export const conversationCallModelResponseSchema = z.object({
  turns: z.array(conversationCallTurnSchema).default([]),
});

export type StartConversationCallInput = z.infer<typeof startConversationCallSchema>;
export type SendConversationCallMessageInput = z.infer<typeof sendConversationCallMessageSchema>;
export type ConversationCallIdleInput = z.infer<typeof conversationCallIdleSchema>;
export type ConversationCallInterruptionInput = z.infer<typeof conversationCallInterruptionSchema>;
export type ConversationCallModelResponseInput = z.infer<typeof conversationCallModelResponseSchema>;
