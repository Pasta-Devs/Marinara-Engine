import { useCallback, useEffect, useState } from "react";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useGenerate } from "../../../runtime/generation/index";

type AgentInjectionReviewItem = {
  agentType: string;
  agentName: string;
  text: string;
};

export type AgentInjectionReviewRequest = {
  chatId: string;
  injections: AgentInjectionReviewItem[];
};

export function useAgentInjectionReview() {
  const { generate } = useGenerate();
  const [request, setRequest] = useState<AgentInjectionReviewRequest | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleReviewRequest = (event: Event) => {
      const detail = (event as CustomEvent<AgentInjectionReviewRequest>).detail;
      if (!detail?.chatId || !Array.isArray(detail.injections)) return;
      if (detail.chatId !== useChatStore.getState().activeChatId) return;
      setRequest(detail);
      setDrafts(Object.fromEntries(detail.injections.map((injection) => [injection.agentType, injection.text])));
    };
    window.addEventListener("marinara:agent-injection-review", handleReviewRequest);
    return () => window.removeEventListener("marinara:agent-injection-review", handleReviewRequest);
  }, []);

  const handleDraftChange = useCallback((agentType: string, text: string) => {
    setDrafts((current) => ({ ...current, [agentType]: text }));
  }, []);

  const close = useCallback(() => {
    setRequest(null);
    setDrafts({});
  }, []);

  const continueGeneration = useCallback(() => {
    if (!request) return;
    const overrides = request.injections.map((injection) => ({
      agentType: injection.agentType,
      agentName: injection.agentName,
      text: drafts[injection.agentType] ?? injection.text,
    }));
    const chatId = request.chatId;
    setRequest(null);
    setDrafts({});
    void generate({ chatId, connectionId: null, agentInjectionOverrides: overrides });
  }, [drafts, generate, request]);

  return {
    request,
    drafts,
    onDraftChange: handleDraftChange,
    onContinue: continueGeneration,
    onClose: close,
  };
}
