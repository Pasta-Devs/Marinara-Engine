import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRoleplayCommandActivity, type Message } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { parseMessageExtraRecord } from "../lib/chat-message-extra";
import { chatKeys, forgetUnchangedMessageContentEdit } from "./use-chats";
import { advancedMemoryKeys } from "./use-advanced-memory";
import { lorebookKeys } from "./use-lorebooks";

const ROLEPLAY_HTML_MUTATION_KEY = ["roleplay-html"];

/**
 * While /html runs, the cached message lacks its new activity entry, and a marker edit saves the whole array from that
 * cache. Markers wait until the run settles, so an edit cannot erase the entry.
 */
export function useRoleplayHtmlArtifactRunning(chatId: string) {
  return (
    useIsMutating({
      mutationKey: ROLEPLAY_HTML_MUTATION_KEY,
      predicate: (mutation) => (mutation.state.variables as { chatId?: string } | undefined)?.chatId === chatId,
    }) > 0
  );
}

export function useRoleplayHtmlArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ROLEPLAY_HTML_MUTATION_KEY,
    mutationFn: ({ chatId, prompt }: { chatId: string; prompt: string }) =>
      api.post<{ messageId: string }>(`/chats/${chatId}/roleplay-html`, { prompt }),
    // A failed run is saved on its marker too, so the message refreshes either way.
    onSettled: (_data, _error, { chatId }) => qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) }),
  });
}

export function useRestoreRoleplayInterrupt(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      swipeIndex,
      activityIndex,
    }: {
      messageId: string;
      swipeIndex: number;
      activityIndex: number;
    }) =>
      api.post<{ message: Message; restoredMessages: Message[] }>(
        `/chats/${chatId}/messages/${messageId}/interrupt/restore`,
        { swipeIndex, activityIndex },
      ),
    onSuccess: async ({ message, restoredMessages }, { activityIndex }) => {
      const receipt = getRoleplayCommandActivity(parseMessageExtraRecord(message.extra))[activityIndex]?.interruption;
      if (receipt?.restored)
        forgetUnchangedMessageContentEdit(
          chatId,
          { id: receipt.targetMessageId, activeSwipeIndex: receipt.targetSwipeIndex },
          receipt.interruptedContent,
        );
      await Promise.all([
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) }),
        qc.invalidateQueries({ queryKey: chatKeys.messagePeek(chatId) }),
        qc.invalidateQueries({ queryKey: advancedMemoryKeys.status(chatId) }),
        qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) }),
        ...[
          ...new Set([
            message.id,
            ...restoredMessages.map((row) => row.id),
            ...(receipt ? [receipt.targetMessageId] : []),
          ]),
        ].map((messageId) => qc.invalidateQueries({ queryKey: [...chatKeys.all, "swipes", messageId] })),
      ]);
    },
  });
}
