// ──────────────────────────────────────────────
// Adding a card to a running chat asks its character questions first, then
// offers its greeting. The two add paths (Chat Settings and drag-and-drop) share
// these two decisions so they cannot drift apart.
// ──────────────────────────────────────────────
import {
  getRelevantCardVariables,
  hasOnboardingContent,
  readCardOnboarding,
  type CardOnboarding,
} from "@marinara-engine/shared";
import { parseChatMetadata } from "./chat-display";

/**
 * Whether a card added to this chat may ask its questions. Roleplay only, like
 * the setup wizard: Conversation and Game have their own setup, and a hosted room
 * keeps its answers with the room.
 */
export function mayAskCardQuestions(chat: { mode?: string | null; metadata?: unknown } | null | undefined): boolean {
  if (!chat || chat.mode !== "roleplay") return false;
  return !parseChatMetadata(chat.metadata).multiplayer;
}

/**
 * The card's onboarding when it has character questions the no-answer context
 * makes relevant (the rule the wizard and the Characters list use), else `null`.
 */
export function readCardWithQuestions(cardData: unknown): CardOnboarding | null {
  const cardOnboarding = readCardOnboarding(cardData);
  if (!cardOnboarding?.onboarding.enabled || !hasOnboardingContent(cardOnboarding.onboarding)) return null;
  return getRelevantCardVariables(cardOnboarding.onboarding, cardOnboarding.cardFields, {}).length > 0
    ? cardOnboarding
    : null;
}
