import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useBranchChat,
  useDeleteMessage,
  useDeleteMessages,
  useDeleteSwipe,
  usePeekPrompt,
  useSetActiveSwipe,
  useUpdateMessage,
  useUpdateMessageExtra,
} from "../../../../catalog/chats/index";
import { useGenerate } from "../../../../runtime/generation/index";
import { useGameStateStore, worldStateApi, type WorldStateTarget } from "../../../../runtime/world-state/index";
import { BUILT_IN_AGENTS } from "../../../../../engine/contracts/types/agent";
import { buildGuidedGenerationInstructionMessage } from "../../../../../engine/shared/text/generation-guide";
import { showConfirmDialog } from "../../../../../shared/lib/app-dialogs";
import { formatTextQuotes } from "../../../../../shared/lib/dialogue-quotes";
import { useAgentStore } from "../../../../../shared/stores/agent.store";
import { useChatStore } from "../../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import type { MessageSelectionToggle, MessageWithSwipes, PeekPromptData, PeekPromptOptions } from "../types";

const TRACKER_AGENT_IDS = new Set(
  BUILT_IN_AGENTS.filter((agent) => agent.category === "tracker").map((agent) => agent.id),
);

type RegenerateOptions = {
  skipTouchConfirm?: boolean;
};

type UseChatTimelineActionsOptions = {
  activeChatId: string;
  messages: MessageWithSwipes[] | undefined;
  messageIdByOrderIndex: Map<number, string>;
  enabledAgentTypes?: Set<string>;
  refreshWorldStateOnTimelineChange?: boolean;
};

function readMessageExtra(message: MessageWithSwipes): Record<string, any> {
  return message.extra && typeof message.extra === "object" && !Array.isArray(message.extra)
    ? (message.extra as Record<string, any>)
    : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function promptSnapshotToPeekPromptData(value: unknown): PeekPromptData | null {
  const snapshot = readRecord(value);
  const rawMessages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const messages = rawMessages
    .map((message) => {
      const record = readRecord(message);
      const role = readString(record.role).trim();
      const content = readString(record.content);
      return role && content ? { role, content } : null;
    })
    .filter((message): message is { role: string; content: string } => !!message);
  if (messages.length === 0) return null;
  return {
    messages,
    parameters: snapshot.parameters ?? null,
    promptPresetId: readString(snapshot.promptPresetId).trim() || null,
    generationInfo: readRecord(snapshot.generationInfo) as PeekPromptData["generationInfo"],
  };
}

function promptSnapshotForMessage(message: MessageWithSwipes | undefined): PeekPromptData | null {
  if (!message) return null;
  const extra = readMessageExtra(message);
  const bySwipe = readRecord(extra.generationPromptSnapshotsBySwipe);
  const activeSwipeIndex =
    typeof message.activeSwipeIndex === "number" && Number.isFinite(message.activeSwipeIndex)
      ? Math.max(0, Math.trunc(message.activeSwipeIndex))
      : 0;
  return (
    promptSnapshotToPeekPromptData(bySwipe[String(activeSwipeIndex)]) ??
    promptSnapshotToPeekPromptData(extra.generationPromptSnapshot)
  );
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export function useChatTimelineActions({
  activeChatId,
  messages,
  messageIdByOrderIndex,
  enabledAgentTypes = new Set<string>(),
  refreshWorldStateOnTimelineChange = false,
}: UseChatTimelineActionsOptions) {
  const guideGenerations = useUIStore((state) => state.guideGenerations);
  const quoteFormat = useUIStore((state) => state.quoteFormat);
  const isStreamingGlobal = useChatStore((state) => state.isStreaming);
  const streamingChatId = useChatStore((state) => state.streamingChatId);
  const isStreaming = isStreamingGlobal && streamingChatId === activeChatId;
  const regenerateMessageId = useChatStore((state) => state.regenerateMessageId);
  const failedAgentTypes = useAgentStore((state) => state.failedAgentTypes);
  const agentProcessing = useAgentStore((state) => state.isProcessing);

  const deleteMessage = useDeleteMessage(activeChatId);
  const deleteMessages = useDeleteMessages(activeChatId);
  const deleteSwipe = useDeleteSwipe(activeChatId);
  const updateMessage = useUpdateMessage(activeChatId);
  const updateMessageExtra = useUpdateMessageExtra(activeChatId);
  const peekPrompt = usePeekPrompt();
  const branchChat = useBranchChat();
  const setActiveSwipe = useSetActiveSwipe(activeChatId);
  const { generate, retryAgents } = useGenerate();
  const updateMessageRef = useLatestRef(updateMessage);
  const updateMessageExtraRef = useLatestRef(updateMessageExtra);
  const setActiveSwipeRef = useLatestRef(setActiveSwipe);
  const peekPromptRef = useLatestRef(peekPrompt);
  const branchChatRef = useLatestRef(branchChat);

  const swipeActionSeq = useRef(0);
  const peekPromptActionSeq = useRef(0);
  const pendingSwipeMutationsRef = useRef(new Map<string, Promise<void>>());
  const [deleteDialogMessageId, setDeleteDialogMessageId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [selectionAnchorIndex, setSelectionAnchorIndex] = useState<number | null>(null);
  const [peekPromptData, setPeekPromptData] = useState<PeekPromptData | null>(null);

  const deleteDialogMessage = useMemo(
    () => messages?.find((message) => message.id === deleteDialogMessageId) ?? null,
    [deleteDialogMessageId, messages],
  );
  const deleteDialogCanDeleteSwipe = (deleteDialogMessage?.swipeCount ?? 0) > 1;
  const deleteDialogActiveSwipeIndex = deleteDialogMessage?.activeSwipeIndex ?? 0;
  const deleteDialogSwipeCount = deleteDialogMessage?.swipeCount ?? 0;

  const refreshVisibleWorldState = useCallback(
    async (target?: WorldStateTarget | null) => {
      if (!refreshWorldStateOnTimelineChange) return;
      try {
        const state = target ? await worldStateApi.get(activeChatId, target) : await worldStateApi.get(activeChatId);
        if (useChatStore.getState().activeChatId !== activeChatId) return;
        useGameStateStore.getState().setGameState(state ?? null);
      } catch {
        /* Non-critical refresh failure; the next tracker load will fetch again. */
      }
    },
    [activeChatId, refreshWorldStateOnTimelineChange],
  );

  const flushTrackerPatchesForTimelineAction = useCallback(async (actionId: number, errorMessage: string) => {
    const flushPatch = useGameStateStore.getState().flushPatch;
    if (!flushPatch) return true;
    try {
      await flushPatch();
      return true;
    } catch {
      if (swipeActionSeq.current === actionId) {
        toast.error(errorMessage);
      }
      return false;
    }
  }, []);

  const beginRefreshingTimeline = useCallback(() => {
    if (refreshWorldStateOnTimelineChange) useGameStateStore.getState().setRefreshingChat(activeChatId);
  }, [activeChatId, refreshWorldStateOnTimelineChange]);

  const clearRefreshingTimeline = useCallback(
    (actionId: number) => {
      if (swipeActionSeq.current === actionId) {
        useGameStateStore.getState().clearRefreshingChat(activeChatId);
      }
    },
    [activeChatId],
  );

  const handleDelete = useCallback((messageId: string) => {
    setDeleteDialogMessageId(messageId);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    const messageId = deleteDialogMessageId;
    setDeleteDialogMessageId(null);
    if (!messageId) return;
    const actionId = ++swipeActionSeq.current;
    void (async () => {
      beginRefreshingTimeline();
      try {
        if (
          !(await flushTrackerPatchesForTimelineAction(
            actionId,
            "Could not save tracker changes before deleting the message.",
          ))
        ) {
          return;
        }
        if (swipeActionSeq.current !== actionId) return;
        await deleteMessage.mutateAsync(messageId);
        if (swipeActionSeq.current !== actionId) return;
        await refreshVisibleWorldState();
      } catch {
        if (swipeActionSeq.current !== actionId) return;
        toast.error("Could not delete the message.");
      } finally {
        clearRefreshingTimeline(actionId);
      }
    })();
  }, [
    beginRefreshingTimeline,
    clearRefreshingTimeline,
    deleteDialogMessageId,
    deleteMessage,
    flushTrackerPatchesForTimelineAction,
    refreshVisibleWorldState,
  ]);

  const handleDeleteSwipe = useCallback(() => {
    const messageId = deleteDialogMessageId;
    const index = deleteDialogActiveSwipeIndex;
    setDeleteDialogMessageId(null);
    if (!messageId || !deleteDialogCanDeleteSwipe) return;
    const actionId = ++swipeActionSeq.current;
    void (async () => {
      beginRefreshingTimeline();
      try {
        if (
          !(await flushTrackerPatchesForTimelineAction(
            actionId,
            "Could not save tracker changes before deleting the swipe.",
          ))
        ) {
          return;
        }
        if (swipeActionSeq.current !== actionId) return;
        await deleteSwipe.mutateAsync({ messageId, index });
        if (swipeActionSeq.current !== actionId) return;
        await refreshVisibleWorldState();
      } catch {
        if (swipeActionSeq.current !== actionId) return;
        toast.error("Could not delete the swipe.");
      } finally {
        clearRefreshingTimeline(actionId);
      }
    })();
  }, [
    beginRefreshingTimeline,
    clearRefreshingTimeline,
    deleteDialogActiveSwipeIndex,
    deleteDialogCanDeleteSwipe,
    deleteDialogMessageId,
    deleteSwipe,
    flushTrackerPatchesForTimelineAction,
    refreshVisibleWorldState,
  ]);

  const handleDeleteMore = useCallback(() => {
    if (deleteDialogMessageId) {
      const startIdx = messages?.findIndex((message) => message.id === deleteDialogMessageId) ?? -1;
      if (messages && startIdx >= 0) {
        const ids = new Set<string>();
        for (let index = startIdx; index < messages.length; index += 1) ids.add(messages[index]!.id);
        setSelectedMessageIds(ids);
      } else {
        setSelectedMessageIds(new Set([deleteDialogMessageId]));
      }
    }
    setDeleteDialogMessageId(null);
    setMultiSelectMode(true);
  }, [deleteDialogMessageId, messages]);

  const handleToggleSelectMessage = useCallback(
    (toggle: MessageSelectionToggle) => {
      const { messageId, orderIndex, checked, shiftKey } = toggle;
      setSelectedMessageIds((previous) => {
        const next = new Set(previous);
        if (shiftKey && selectionAnchorIndex != null) {
          const start = Math.min(selectionAnchorIndex, orderIndex);
          const end = Math.max(selectionAnchorIndex, orderIndex);
          for (let current = start; current <= end; current += 1) {
            const rangeMessageId = messageIdByOrderIndex.get(current);
            if (!rangeMessageId) continue;
            if (checked) next.add(rangeMessageId);
            else next.delete(rangeMessageId);
          }
        } else {
          if (checked) next.add(messageId);
          else next.delete(messageId);
        }
        return next;
      });
      if (!shiftKey || selectionAnchorIndex == null) {
        setSelectionAnchorIndex(orderIndex);
      }
    },
    [messageIdByOrderIndex, selectionAnchorIndex],
  );

  const handleBulkDelete = useCallback(() => {
    const messageIds = [...selectedMessageIds];
    if (messageIds.length === 0) return;
    const actionId = ++swipeActionSeq.current;
    void (async () => {
      beginRefreshingTimeline();
      try {
        if (
          !(await flushTrackerPatchesForTimelineAction(
            actionId,
            "Could not save tracker changes before deleting messages.",
          ))
        ) {
          return;
        }
        if (swipeActionSeq.current !== actionId) return;
        await deleteMessages.mutateAsync(messageIds);
        if (swipeActionSeq.current !== actionId) return;
        await refreshVisibleWorldState();
        if (swipeActionSeq.current !== actionId) return;
        setMultiSelectMode(false);
        setSelectedMessageIds(new Set());
        setSelectionAnchorIndex(null);
      } catch {
        if (swipeActionSeq.current !== actionId) return;
        toast.error("Could not delete messages.");
      } finally {
        clearRefreshingTimeline(actionId);
      }
    })();
  }, [
    beginRefreshingTimeline,
    clearRefreshingTimeline,
    deleteMessages,
    flushTrackerPatchesForTimelineAction,
    refreshVisibleWorldState,
    selectedMessageIds,
  ]);

  const handleCancelMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedMessageIds(new Set());
    setSelectionAnchorIndex(null);
  }, []);

  useEffect(() => {
    setMultiSelectMode(false);
    setSelectedMessageIds(new Set());
    setSelectionAnchorIndex(null);
  }, [activeChatId]);

  const handleUnselectAllMessages = useCallback(() => {
    setSelectedMessageIds(new Set());
  }, []);

  const handleSelectAllAboveSelection = useCallback(() => {
    if (!messages || messages.length === 0) return;
    setSelectedMessageIds((previous) => {
      if (previous.size === 0) return previous;
      let firstIdx = -1;
      for (let index = 0; index < messages.length; index += 1) {
        if (previous.has(messages[index]!.id)) {
          firstIdx = index;
          break;
        }
      }
      if (firstIdx <= 0) return previous;
      const next = new Set(previous);
      for (let index = 0; index < firstIdx; index += 1) next.add(messages[index]!.id);
      return next;
    });
  }, [messages]);

  const handleSelectAllBelowSelection = useCallback(() => {
    if (!messages || messages.length === 0) return;
    setSelectedMessageIds((previous) => {
      if (previous.size === 0) return previous;
      let lastIdx = -1;
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (previous.has(messages[index]!.id)) {
          lastIdx = index;
          break;
        }
      }
      if (lastIdx < 0 || lastIdx >= messages.length - 1) return previous;
      const next = new Set(previous);
      for (let index = lastIdx + 1; index < messages.length; index += 1) next.add(messages[index]!.id);
      return next;
    });
  }, [messages]);

  const handleRegenerate = useCallback(
    async (messageId: string, options?: RegenerateOptions) => {
      if (!activeChatId || isStreaming) return;
      if (
        !options?.skipTouchConfirm &&
        window.matchMedia("(pointer: coarse)").matches &&
        !(await showConfirmDialog({
          title: "Regenerate Message",
          message: "Regenerate this message as a new swipe?",
          confirmLabel: "Regenerate",
        }))
      ) {
        return;
      }
      try {
        const currentInput = useChatStore.getState().currentInput;
        const generationGuide = currentInput.trim();
        const hasInput = generationGuide.length > 0;
        await generate(
          guideGenerations && hasInput
            ? {
                chatId: activeChatId,
                connectionId: null,
                regenerateMessageId: messageId,
                generationGuide: buildGuidedGenerationInstructionMessage(generationGuide),
                generationGuideSource: "guide",
              }
            : { chatId: activeChatId, connectionId: null, regenerateMessageId: messageId },
        );
      } catch {
        /* Error toast is shown by the generate hook. */
      }
    },
    [activeChatId, generate, guideGenerations, isStreaming],
  );

  const handleRetryFailedAgents = useCallback(async () => {
    if (!activeChatId || isStreaming || agentProcessing || failedAgentTypes.length === 0) return;
    await retryAgents(activeChatId, failedAgentTypes);
  }, [activeChatId, agentProcessing, failedAgentTypes, isStreaming, retryAgents]);

  const handleRerunTrackers = useCallback(async () => {
    if (!activeChatId || isStreaming || agentProcessing) return;
    const types = Array.from(enabledAgentTypes).filter((type) => TRACKER_AGENT_IDS.has(type));
    if (types.length === 0) return;
    await retryAgents(activeChatId, types);
  }, [activeChatId, agentProcessing, enabledAgentTypes, isStreaming, retryAgents]);

  const handleRerunSingleTracker = useCallback(
    async (agentType: string) => {
      if (!activeChatId || isStreaming || agentProcessing) return;
      if (!TRACKER_AGENT_IDS.has(agentType) || !enabledAgentTypes.has(agentType)) return;
      await retryAgents(activeChatId, [agentType]);
    },
    [activeChatId, agentProcessing, enabledAgentTypes, isStreaming, retryAgents],
  );

  const handleIllustrate = useCallback(async () => {
    await retryAgents(activeChatId, ["illustrator"]);
  }, [activeChatId, retryAgents]);

  const handleSetActiveSwipe = useCallback(
    (messageId: string, index: number) => {
      const actionId = ++swipeActionSeq.current;
      const mutation = setActiveSwipeRef.current.mutateAsync({ messageId, index });
      const trackedMutation = mutation.then(
        () => undefined,
        () => undefined,
      );
      pendingSwipeMutationsRef.current.set(messageId, trackedMutation);
      void (async () => {
        try {
          await mutation;
        } catch (error) {
          if (swipeActionSeq.current === actionId) {
            toast.error(error instanceof Error ? error.message : "Could not switch swipes.");
          }
        } finally {
          if (pendingSwipeMutationsRef.current.get(messageId) === trackedMutation) {
            pendingSwipeMutationsRef.current.delete(messageId);
          }
        }
      })();
    },
    [setActiveSwipeRef],
  );

  const handleEdit = useCallback(
    (messageId: string, content: string) => {
      const formattedContent = formatTextQuotes(content, quoteFormat);
      updateMessageRef.current.mutate(
        { messageId, content: formattedContent },
        {
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Could not save edit.");
          },
        },
      );
      return Promise.resolve();
    },
    [quoteFormat, updateMessageRef],
  );

  const handleToggleConversationStart = useCallback(
    (messageId: string, current: boolean) => {
      updateMessageExtraRef.current.mutate({ messageId, extra: { isConversationStart: !current } });
    },
    [updateMessageExtraRef],
  );

  const handleToggleHiddenFromAI = useCallback(
    (messageId: string, current: boolean) => {
      updateMessageExtraRef.current.mutate({ messageId, extra: { hiddenFromAI: !current, hiddenFromAi: !current } });
    },
    [updateMessageExtraRef],
  );

  const handleBranch = useCallback(
    (messageId: string) => {
      branchChatRef.current.mutate(
        { chatId: activeChatId, upToMessageId: messageId },
        {
          onSuccess: (newChat) => {
            if (newChat) useChatStore.getState().setActiveChatId(newChat.id);
          },
        },
      );
    },
    [activeChatId, branchChatRef],
  );

  const handlePeekPrompt = useCallback(
    (options?: PeekPromptOptions) => {
      const actionId = ++peekPromptActionSeq.current;
      const messageId = options?.messageId ?? null;
      setPeekPromptData({ messages: [], parameters: null, generationInfo: null, loading: true });

      void (async () => {
        while (messageId) {
          const pendingSwipeMutation = pendingSwipeMutationsRef.current.get(messageId);
          if (!pendingSwipeMutation) break;
          await pendingSwipeMutation;
          if (pendingSwipeMutationsRef.current.get(messageId) === pendingSwipeMutation) break;
        }
        if (peekPromptActionSeq.current !== actionId) return;
        const savedSnapshot =
          promptSnapshotToPeekPromptData(options?.promptSnapshot) ??
          promptSnapshotForMessage(messages?.find((message) => message.id === messageId));
        if (savedSnapshot) {
          setPeekPromptData(savedSnapshot);
          return;
        }
        peekPromptRef.current.mutate(
          {
            chatId: activeChatId,
            forCharacterId: options?.forCharacterId ?? null,
            beforeMessageId: messageId,
          },
          {
            onSuccess: (data) => {
              if (peekPromptActionSeq.current === actionId) {
                const peekData = data as PeekPromptData;
                setPeekPromptData({
                  ...peekData,
                  agentNote:
                    messageId != null
                      ? "No saved prompt snapshot was available for this response, so this was rebuilt from current chat data before the selected message."
                      : peekData.agentNote,
                });
              }
            },
            onError: (error) => {
              if (peekPromptActionSeq.current !== actionId) return;
              setPeekPromptData({
                messages: [],
                parameters: null,
                generationInfo: null,
                error: error instanceof Error ? error.message : "Could not assemble prompt.",
              });
            },
          },
        );
      })();
    },
    [activeChatId, messages, peekPromptRef],
  );

  const closePeekPrompt = useCallback(() => {
    peekPromptActionSeq.current++;
    setPeekPromptData(null);
  }, []);

  const lastAssistantMessageId = useMemo(() => {
    if (!messages) return null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]!.role === "assistant") return messages[index]!.id;
    }
    return null;
  }, [messages]);

  const latestAssistantMessageForSwipes = useMemo(() => {
    if (!messages) return null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = messages[index]!;
      if (candidate.role === "assistant") return candidate;
    }
    return null;
  }, [messages]);

  const latestMessageForEdit = useMemo(() => {
    if (!messages) return null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = messages[index]!;
      if (candidate.role !== "user" && candidate.role !== "assistant") continue;
      const extra = readMessageExtra(candidate);
      if (extra?.hiddenFromUser === true) continue;
      return candidate;
    }
    return null;
  }, [messages]);

  const isGrouped = useCallback(
    (index: number) => {
      if (index === 0 || !messages) return false;
      const prev = messages[index - 1];
      const curr = messages[index];
      if (!prev || !curr) return false;
      if (prev.role !== curr.role || prev.characterId !== curr.characterId) return false;
      if (prev.role === "user" && curr.role === "user") {
        const prevId = readMessageExtra(prev).personaSnapshot?.personaId;
        const currId = readMessageExtra(curr).personaSnapshot?.personaId;
        if (prevId && currId && prevId !== currId) return false;
      }
      return true;
    },
    [messages],
  );

  return {
    isStreaming,
    regenerateMessageId,
    agentProcessing,
    failedAgentTypes,
    deleteDialogMessageId,
    deleteDialogCanDeleteSwipe,
    deleteDialogActiveSwipeIndex,
    deleteDialogSwipeCount,
    multiSelectMode,
    selectedMessageIds,
    peekPromptData,
    latestAssistantMessageForSwipes,
    latestMessageForEdit,
    lastAssistantMessageId,
    isGrouped,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteSwipe,
    handleDeleteMore,
    handleToggleSelectMessage,
    handleBulkDelete,
    handleCancelMultiSelect,
    handleUnselectAllMessages,
    handleSelectAllAboveSelection,
    handleSelectAllBelowSelection,
    handleRegenerate,
    handleRetryFailedAgents,
    handleRerunTrackers,
    handleRerunSingleTracker,
    handleIllustrate,
    handleSetActiveSwipe,
    handleEdit,
    handleToggleConversationStart,
    handleToggleHiddenFromAI,
    handleBranch,
    handlePeekPrompt,
    closePeekPrompt,
    closeDeleteDialog: () => setDeleteDialogMessageId(null),
  };
}
