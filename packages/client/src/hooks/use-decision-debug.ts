import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import type { DecisionDebugPreview } from "@marinara-engine/shared";
import { api } from "../lib/api-client";

/** `characterId` previews that character's turn in a group chat where characters reply one by one. */
export function useDecisionDebug(chatId: string, characterId?: string) {
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [chatId, characterId]);
  const mutation = useMutation({
    mutationFn: (mode: "inspect" | "run") => {
      controller.current?.abort();
      controller.current = new AbortController();
      return api.post<DecisionDebugPreview>(
        "/generate/dryRun",
        {
          chatId,
          ...(characterId ? { forCharacterId: characterId } : {}),
          decisionDebug: mode,
          returnPrompt: true,
          streaming: false,
          wrapLastMessage: true,
          injectLorebook: true,
          injectTrackers: true,
          injectChatSummary: true,
        },
        { signal: controller.current.signal },
      );
    },
    // This action has no persisted changes, so live chat queries stay untouched.
  });
  return { ...mutation, cancel: () => controller.current?.abort() };
}
