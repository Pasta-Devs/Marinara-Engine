import type { ConversationCommandToggles } from "@marinara-engine/shared";

export type ConversationSelfieConnectionOption = {
  id: string;
  provider?: string;
  defaultForAgents?: boolean | string;
};

/** Resolve the image connection that Conversation setup should persist for enabled selfies. */
export function resolveConversationSelfieConnectionId(input: {
  currentConnectionId: unknown;
  selfieCommandEnabled: boolean;
  connections: readonly ConversationSelfieConnectionOption[];
}): string | null {
  const currentConnectionId =
    typeof input.currentConnectionId === "string" ? input.currentConnectionId.trim() : "";
  if (currentConnectionId) return currentConnectionId;
  if (!input.selfieCommandEnabled) return null;

  return (
    input.connections.find(
      (connection) =>
        connection.provider === "image_generation" &&
        String(connection.defaultForAgents) === "true",
    )?.id ?? null
  );
}

/** Build the chat metadata that setup must persist for the Selfie command. */
export function resolveConversationSelfieSetup(input: {
  commandToggles: ConversationCommandToggles;
  selfieCommandAvailable: boolean;
  selfieCommandEnabled: boolean;
  currentConnectionId: unknown;
  connections: readonly ConversationSelfieConnectionOption[];
}): {
  conversationCommandToggles: ConversationCommandToggles;
  imageGenConnectionId: string | null;
} {
  return {
    conversationCommandToggles: {
      ...input.commandToggles,
      ...(input.selfieCommandAvailable ? { selfie: input.selfieCommandEnabled } : {}),
    },
    imageGenConnectionId: resolveConversationSelfieConnectionId({
      currentConnectionId: input.currentConnectionId,
      selfieCommandEnabled: input.selfieCommandEnabled,
      connections: input.connections,
    }),
  };
}
