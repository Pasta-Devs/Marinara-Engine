import type { AgentResult } from "@marinara-engine/shared";
import { logger } from "../../../lib/logger.js";
import type { AgentResultEffectDeps } from "./types.js";

/** Saves the choice buttons on the message's active swipe, so they survive a page refresh. */
export async function applyCyoaChoicesResult(result: AgentResult, deps: AgentResultEffectDeps): Promise<void> {
  const cyoaData = result.data as { choices?: Array<{ label: string; text: string }> };
  if (!deps.messageId || !cyoaData.choices || cyoaData.choices.length === 0) return;
  try {
    deps.signal?.throwIfAborted();
    const updated = await deps.chats.updateMessageExtraForSwipe(deps.messageId, deps.swipeIndex, {
      cyoaChoices: cyoaData.choices,
    });
    deps.signal?.throwIfAborted();
    // A null return means the message or that swipe is gone (deleted meanwhile), which is ordinary.
    logger.debug(
      updated === null
        ? "[agent-effects] CYOA choices not saved, message or swipe not found origin=%s chatId=%s messageId=%s swipeIndex=%d choiceCount=%d"
        : "[agent-effects] CYOA choices saved origin=%s chatId=%s messageId=%s swipeIndex=%d choiceCount=%d",
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
      "[agent-effects] Could not save CYOA choices origin=%s chatId=%s messageId=%s swipeIndex=%d",
      deps.origin,
      deps.chatId,
      deps.messageId,
      deps.swipeIndex,
    );
  }
}
