// ──────────────────────────────────────────────
// Hook: Regenerate a chat gallery image (#7767)
// ──────────────────────────────────────────────
// Kept out of use-gallery.ts on purpose: that file is reachable from the e2e type graph
// (slash-commands -> gallery.store), and importing use-chats there pulls in half the client.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { chatKeys } from "./use-chats";
import { galleryKeys, type ChatImage, type RegenerateChatImageInput } from "./use-gallery";
import { gameStoryboardKeys } from "./use-game-storyboards";

/** Re-send an image's final request, possibly edited; the new image replaces it in messages and storyboards. */
export function useRegenerateChatImage(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imageId, ...input }: RegenerateChatImageInput) =>
      api.post<{ image: ChatImage; replacedMessageIds: string[]; replacedKeyframeIds: string[] }>(
        `/gallery/${chatId}/images/${encodeURIComponent(imageId)}/regenerate`,
        input,
      ),
    onSuccess: (result) => {
      // The prefix, not this chat's keys: a Game gallery lists sibling sessions' images, and
      // regenerating one of those must refresh whichever gallery is open.
      qc.invalidateQueries({ queryKey: galleryKeys.all });
      if (result.replacedMessageIds.length > 0) qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      if (result.replacedKeyframeIds.length > 0) qc.invalidateQueries({ queryKey: gameStoryboardKeys.chat(chatId) });
    },
  });
}
