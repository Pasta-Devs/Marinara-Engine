// ──────────────────────────────────────────────
// Agent Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH } from "../constants/agent-activation.js";

export const agentPhaseSchema = z.enum(["pre_generation", "parallel", "post_processing"]);

export const agentResultTypeSchema = z.enum([
  "game_state_update",
  "text_rewrite",
  "sprite_change",
  "echo_message",
  "quest_update",
  "image_prompt",
  "context_injection",
  "continuity_check",
  "director_event",
  "lorebook_update",
  "character_card_update",
  "background_change",
  "character_tracker_update",
  "persona_stats_update",
  "custom_tracker_update",
  "spotify_control",
  "youtube_control",
  "local_music_control",
  "haptic_command",
  "cyoa_choices",
  "secret_plot",
  "game_master_narration",
  "party_action",
  "game_map_update",
  "game_state_transition",
  "prompt_patch",
  "frontend_theme_update",
]);

export const customAgentActivationSettingsSchema = z.object({
  activationKeywords: z.array(z.string().trim().min(1)).max(100).optional(),
  activationScanDepth: z.number().int().min(1).max(MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH).optional(),
});

export const createAgentConfigSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().default(""),
  phase: agentPhaseSchema,
  /** Legacy compatibility only. Agent activation is chat-scoped via chat metadata. */
  enabled: z.boolean().optional(),
  connectionId: z.string().nullable().default(null),
  imagePath: z.string().nullable().default(null),
  resultType: agentResultTypeSchema.optional(),
  promptTemplate: z.string().default(""),
  settings: z.record(z.unknown()).default({}),
});

export const updateAgentConfigSchema = createAgentConfigSchema.partial();

export type CreateAgentConfigInput = z.infer<typeof createAgentConfigSchema>;
export type UpdateAgentConfigInput = z.infer<typeof updateAgentConfigSchema>;
