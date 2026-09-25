import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getRoleplayCommandActivity, type Message } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { parseMessageExtraRecord } from "../lib/chat-message-extra";
import { chatKeys, forgetUnchangedMessageContentEdit } from "./use-chats";
import { advancedMemoryKeys } from "./use-advanced-memory";
import { lorebookKeys } from "./use-lorebooks";

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
