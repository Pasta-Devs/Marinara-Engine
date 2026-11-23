import type { ConversationCommandToggles } from "@marinara-engine/shared";

/**
 * Build the chat metadata that setup saves for the Selfie command. Setup keeps a Selfie model the chat already has
 * and never copies the Images default in: a chat without its own model follows the Images default, so changing that
 * default moves its selfies too.
 */
export function resolveConversationSelfieSetup(input: {
  commandToggles: ConversationCommandToggles;
  selfieCommandAvailable: boolean;
  selfieCommandEnabled: boolean;
  currentConnectionId: unknown;
}): {
  conversationCommandToggles: ConversationCommandToggles;
  imageGenConnectionId: string | null;
} {
  const current = typeof input.currentConnectionId === "string" ? input.currentConnectionId.trim() : "";
  return {
    conversationCommandToggles: {
      ...input.commandToggles,
      ...(input.selfieCommandAvailable ? { selfie: input.selfieCommandEnabled } : {}),
    },
    imageGenConnectionId: current || null,
  };
}
