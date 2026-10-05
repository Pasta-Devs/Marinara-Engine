// ──────────────────────────────────────────────
// Agent activity: the actions every Agent activity surface shares
//
// The Roleplay HUD menu, the Tracker window and the Tracker Panel all clear and
// re-run trackers the same way. Everything here works from the chat id alone,
// so a surface outside the chat (the Tracker Panel) needs nothing else.
// ──────────────────────────────────────────────
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { hashKey, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { normalizeManualTrackerAgentTypes, type GameState, type Message } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { illustratorRetryTargetsForFailures } from "../lib/agent-failures";
import { isBuiltInTrackerAgentType, resolveTrackerRerunTypes } from "../lib/tracker-agents";
import { useAgentStore, EMPTY_AGENT_FAILURES, EMPTY_AGENT_TYPES } from "../stores/agent.store";
import { useChatStore } from "../stores/chat.store";
import { useGameStateStore } from "../stores/game-state.store";
import { chatKeys, useChat, useUpdateMessageExtra } from "./use-chats";
import { discardPendingGameStatePatch } from "./use-game-state-patcher";
import { useGenerate } from "./use-generate";

const EMPTY_MESSAGES: Message[] = [];

function readCachedMessages(data: InfiniteData<Message[]> | undefined): Message[] {
  if (!data) return EMPTY_MESSAGES;
  return data.pages.flat().sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

/**
 * The chat's loaded messages, oldest first, read from the transcript cache without observing it: a
 * second observer of that query would replace the transcript's paging options (#4721).
 */
export function useCachedChatMessages(chatId: string): Message[] {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => chatKeys.messages(chatId), [chatId]);
  const data = useSyncExternalStore(
    useCallback(
      (onChange: () => void) => {
        const queryHash = hashKey(queryKey);
        return queryClient.getQueryCache().subscribe((event) => {
          if (event.query.queryHash === queryHash) onChange();
        });
      },
      [queryClient, queryKey],
    ),
    () => queryClient.getQueryData<InfiniteData<Message[]>>(queryKey),
  );
  return useMemo(() => readCachedMessages(data), [data]);
}

const CLEARED_TRACKER_STATE = {
  date: null,
  time: null,
  location: null,
  weather: null,
  temperature: null,
  worldCustomFields: [],
  presentCharacters: [],
  recentEvents: [],
  playerStats: {
    stats: [],
    attributes: null,
    skills: {},
    inventory: [],
    inventoryTrackerCurrencies: [],
    inventoryTrackerEquipped: [],
    inventoryTrackerInventory: [],
    activeQuests: [],
    status: "",
  },
  personaStats: [],
  fieldLocks: null,
  hiddenTrackerFields: null,
};

/** Wipes the chat's tracker data, its saved agent runs and the active choice prompt. Cannot be undone. */
export function useClearTrackers(chatId: string) {
  const queryClient = useQueryClient();
  const updateMessageExtra = useUpdateMessageExtra(chatId);
  const setGameState = useGameStateStore((s) => s.setGameState);
  const resetAgentStore = useAgentStore((s) => s.reset);
  return useCallback(() => {
    discardPendingGameStatePatch(chatId);
    const prev = useGameStateStore.getState().current;
    if (prev?.chatId === chatId) {
      setGameState({ ...prev, ...CLEARED_TRACKER_STATE } as GameState);
    } else {
      setGameState({
        id: "",
        chatId,
        messageId: "",
        swipeIndex: 0,
        createdAt: "",
        ...CLEARED_TRACKER_STATE,
      } as GameState);
    }
    api
      .patch(`/chats/${chatId}/game-state`, { ...CLEARED_TRACKER_STATE, manual: true, clearOverrides: true })
      .catch(() => {});
    // Clear committed agent runs & memory from DB + reset client state
    api.delete(`/agents/runs/${chatId}`).catch(() => {});
    const messages = readCachedMessages(queryClient.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId)));
    const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
    if (latestAssistantMessage) {
      updateMessageExtra.mutate({ messageId: latestAssistantMessage.id, extra: { cyoaChoices: [] } });
    }
    resetAgentStore();
  }, [chatId, queryClient, resetAgentStore, setGameState, updateMessageExtra]);
}

/** Stops the chat's running agents; throws when none was running. */
export async function stopChatAgents(chatId: string) {
  const result = await api.post<{ aborted: boolean }>("/generate/abort", { chatId, agentsOnly: true });
  if (!result.aborted) throw new Error("No active agent run was found");
}

function readChatMetadata(metadata: unknown): Record<string, any> {
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return metadata && typeof metadata === "object" ? (metadata as Record<string, any>) : {};
}

/**
 * The agents a chat runs and the shared re-run actions, for surfaces that only know the chat id.
 * Inside the chat, ChatArea's own handlers do the same with the chat it already has.
 */
export function useChatAgentRuns(chatId: string) {
  const { data: chat } = useChat(chatId);
  const meta = useMemo(() => readChatMetadata(chat?.metadata), [chat?.metadata]);
  const enabledAgentTypes = useMemo(() => {
    const set = new Set<string>();
    if (!meta.enableAgents) return set;
    for (const id of Array.isArray(meta.activeAgentIds) ? meta.activeAgentIds : []) {
      if (typeof id === "string") set.add(id);
    }
    return set;
  }, [meta.enableAgents, meta.activeAgentIds]);
  const manualTrackerTypes = useMemo(() => {
    const manualTypes = normalizeManualTrackerAgentTypes(meta.manualTrackerAgentTypes);
    const set = new Set<string>();
    for (const type of enabledAgentTypes) {
      if (!isBuiltInTrackerAgentType(type)) continue;
      if (meta.manualTrackers === true || manualTypes[type] === true) set.add(type);
    }
    return set;
  }, [enabledAgentTypes, meta.manualTrackerAgentTypes, meta.manualTrackers]);
  const isAgentProcessing = useAgentStore((s) => s.processingChatIds.includes(chatId));
  const isStreaming = useChatStore((s) => s.isStreaming && s.streamingChatId === chatId);
  const gameStateRefreshing = useGameStateStore((s) => s.isRefreshing);
  const failedAgentTypes = useAgentStore((s) =>
    s.failedAgentChatId && s.failedAgentChatId !== chatId ? EMPTY_AGENT_TYPES : s.failedAgentTypes,
  );
  const failedAgentFailures = useAgentStore((s) =>
    s.failedAgentChatId && s.failedAgentChatId !== chatId ? EMPTY_AGENT_FAILURES : s.failedAgentFailures,
  );
  const busy = isAgentProcessing || isStreaming || gameStateRefreshing;
  const { retryAgents } = useGenerate();
  const rerunTypes = useMemo(
    () => resolveTrackerRerunTypes(enabledAgentTypes, manualTrackerTypes),
    [enabledAgentTypes, manualTrackerTypes],
  );

  const rerunTrackers = useCallback(() => {
    if (busy || rerunTypes.length === 0) return;
    void retryAgents(chatId, rerunTypes);
  }, [busy, chatId, rerunTypes, retryAgents]);

  const retryFailedAgents = useCallback(() => {
    if (busy || failedAgentTypes.length === 0) return;
    const illustratorRetryTargets = illustratorRetryTargetsForFailures(failedAgentFailures);
    void retryAgents(chatId, failedAgentTypes, illustratorRetryTargets ? { illustratorRetryTargets } : undefined);
  }, [busy, chatId, failedAgentFailures, failedAgentTypes, retryAgents]);

  return {
    meta,
    enabledAgentTypes,
    isAgentProcessing,
    busy,
    failedAgentTypes,
    failedAgentFailures,
    rerunTrackers: rerunTypes.length > 0 ? rerunTrackers : undefined,
    retryFailedAgents,
  };
}
