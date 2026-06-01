import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Chat } from "../../../../engine/contracts/types/chat";
import { chatCommandApi } from "../../../../shared/api/chat-command-api";
import { chatKeys } from "../query-keys";

export function useClearAutonomousUnread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => chatCommandApi.clearAutonomousUnread<Chat>(chatId),
    onSuccess: (data, chatId) => {
      if (data) {
        qc.setQueryData(chatKeys.detail(chatId), data);
      }
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}
