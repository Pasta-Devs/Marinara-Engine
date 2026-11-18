// Effects that an agent result has after an agent runs, shared by normal generation (`routes/generate.routes.ts`) and
// the retry-agents route (`routes/generate/retry-agents-route.ts`). Both routes used to carry their own copy of each
// effect, so every change had to be made twice and the copies drifted (#9508).
import type { AgentResult, AgentResultType } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import type { createChatsStorage } from "../storage/chats.storage.js";

export type AgentResultEffectOrigin = "generate" | "retry";

export interface AgentResultEffectDeps {
  origin: AgentResultEffectOrigin;
  chatId: string;
  /** The assistant message the agents ran for. */
  messageId: string | null;
  swipeIndex: number;
  chats: Pick<ReturnType<typeof createChatsStorage>, "updateMessageExtraForSwipe">;
  /** Stops the effect when the run was cancelled (retry passes its abort signal). */
  signal?: AbortSignal;
}

type AgentResultEffect = (result: AgentResult, deps: AgentResultEffectDeps) => Promise<void>;

/**
 * How each result type is applied today.
 * - `shared`: one handler below, called by both routes.
 * - `not_shared_yet`: each route still applies it on its own, or not at all (#9508 moves them one family per PR).
 *
 * ponytail: two states until the first type needs a recorded difference between the routes; then add
 * `generate_only` / `retry_only` with a reason, so that difference is written down here instead of being a
 * forgotten branch.
 */
export const AGENT_RESULT_EFFECT_COVERAGE: Record<AgentResultType, "shared" | "not_shared_yet"> = {
  game_state_update: "not_shared_yet",
  text_rewrite: "not_shared_yet",
  sprite_change: "not_shared_yet",
  echo_message: "not_shared_yet",
  quest_update: "not_shared_yet",
  image_prompt: "not_shared_yet",
  context_injection: "not_shared_yet",
  continuity_check: "not_shared_yet",
  director_event: "not_shared_yet",
  lorebook_update: "not_shared_yet",
  character_card_update: "not_shared_yet",
  character_card_create: "not_shared_yet",
  background_change: "not_shared_yet",
  character_tracker_update: "not_shared_yet",
  persona_stats_update: "not_shared_yet",
  custom_tracker_update: "not_shared_yet",
  inventory_tracker_update: "not_shared_yet",
  spotify_control: "not_shared_yet",
  youtube_control: "not_shared_yet",
  local_music_control: "not_shared_yet",
  haptic_command: "not_shared_yet",
  cyoa_choices: "shared",
  secret_plot: "not_shared_yet",
  game_master_narration: "not_shared_yet",
  party_action: "not_shared_yet",
  game_map_update: "not_shared_yet",
  game_state_transition: "not_shared_yet",
  prompt_patch: "not_shared_yet",
  character_activity_update: "not_shared_yet",
  frontend_theme_update: "not_shared_yet",
  about_me_update: "not_shared_yet",
  memory_nag: "not_shared_yet",
};

/** Saves the choice buttons on the message's active swipe, so they survive a page refresh. */
async function applyCyoaChoicesResult(result: AgentResult, deps: AgentResultEffectDeps): Promise<void> {
  const cyoaData = result.data as { choices?: Array<{ label: string; text: string }> };
  if (!deps.messageId || !cyoaData.choices || cyoaData.choices.length === 0) return;
  try {
    deps.signal?.throwIfAborted();
    await deps.chats.updateMessageExtraForSwipe(deps.messageId, deps.swipeIndex, { cyoaChoices: cyoaData.choices });
    deps.signal?.throwIfAborted();
    logger.debug(
      "[agent-effects] CYOA choices saved origin=%s chatId=%s messageId=%s swipeIndex=%d choiceCount=%d",
      deps.origin,
      deps.chatId,
      deps.messageId,
      deps.swipeIndex,
      cyoaData.choices.length,
    );
  } catch (err) {
    deps.signal?.throwIfAborted();
    logger.warn(
      err,
      "[agent-effects] Could not save CYOA choices origin=%s chatId=%s messageId=%s",
      deps.origin,
      deps.chatId,
      deps.messageId,
    );
  }
}

const SHARED_AGENT_RESULT_EFFECTS: Partial<Record<AgentResultType, AgentResultEffect>> = {
  cyoa_choices: applyCyoaChoicesResult,
};

export const SHARED_AGENT_RESULT_EFFECT_TYPES = Object.keys(SHARED_AGENT_RESULT_EFFECTS) as AgentResultType[];

/**
 * Applies a successful result's shared effect. Returns false when the result failed, has no data, or its type is not
 * shared yet (the route then applies it itself).
 */
export async function applyAgentResultEffect(result: AgentResult, deps: AgentResultEffectDeps): Promise<boolean> {
  if (!result.success || !result.data || typeof result.data !== "object") return false;
  const effect = SHARED_AGENT_RESULT_EFFECTS[result.type];
  if (!effect) return false;
  await effect(result, deps);
  return true;
}
