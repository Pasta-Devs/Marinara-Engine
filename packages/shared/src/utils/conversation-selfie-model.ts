/**
 * The image model a Conversation selfie uses: the chat's own Selfie model, else the Images default once Generated
 * Selfies is switched on. Older chats that never switched selfies on and never chose a model take none, so setting an
 * Images default does not start selfies in chats that never asked for them.
 */
function ownSelfieModel(chatMeta: Record<string, unknown>): string {
  return typeof chatMeta.imageGenConnectionId === "string" ? chatMeta.imageGenConnectionId.trim() : "";
}

/** True when this chat's selfies are drawn by the Images default (no Selfie model of its own, selfies switched on). */
export function selfieFollowsImagesDefault(chatMeta: Record<string, unknown>): boolean {
  if (ownSelfieModel(chatMeta)) return false;
  const toggles =
    chatMeta.conversationCommandToggles && typeof chatMeta.conversationCommandToggles === "object"
      ? (chatMeta.conversationCommandToggles as Record<string, unknown>)
      : {};
  return toggles.selfie === true;
}

export function resolveSelfieImageConnectionId(
  chatMeta: Record<string, unknown>,
  imagesDefaultId: string | null | undefined,
): string {
  const own = ownSelfieModel(chatMeta);
  if (own) return own;
  if (!selfieFollowsImagesDefault(chatMeta)) return "";
  return typeof imagesDefaultId === "string" ? imagesDefaultId.trim() : "";
}
