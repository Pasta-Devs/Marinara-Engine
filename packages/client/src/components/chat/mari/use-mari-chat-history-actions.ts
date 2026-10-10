import { Chat, MessageExtra, MessageRole } from "@marinara-engine/shared";
import { useQueryClient } from "@tanstack/react-query";
import { RefObject, Dispatch, SetStateAction, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { chatKeys } from "../../../hooks/use-chats";
import { homeFeedKeys } from "../../../hooks/use-home-feed";
import { api } from "../../../lib/api-client";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { describeProfessorMariError } from "../../../lib/professor-mari-errors";
import { ProfessorMariWorkspaceDestination } from "../../../lib/professor-mari-workspace-navigation";
import { useChatStore } from "../../../stores/chat.store";
import { ProfessorMariChatSummary } from "./mari-chat-helpers";
import { WorkspaceTimelineItem } from "./mari-tool-presentation";

/** The Chats panel's actions: open a past conversation, rename, /title, delete and bulk delete. */
type MariChatHistoryActionsInput = {
  chatHistory: ProfessorMariChatSummary[];
  chatId: string | null;
  effectiveConnectionId: string;
  ensureProfessorMariChat: (connectionId: string | null) => Promise<Chat>;
  isBusy: boolean;
  loadChatHistory: () => Promise<void>;
  loadMessages: (
    id: string,
    options?: { restoreFocus?: boolean | (() => boolean); shouldApply?: () => boolean },
  ) => Promise<
    | {
        extra: MessageExtra;
        id: string;
        chatId: string;
        role: MessageRole;
        characterId: string | null;
        content: string;
        activeSwipeIndex: number;
        swipeCount?: number;
        rowid?: number;
        createdAt: string;
      }[]
    | undefined
  >;
  openChatId: string | null;
  renameDraft: string;
  requestedChatIdRef: RefObject<string | null>;
  selectedChatHistoryIds: Set<string>;
  setActiveChatId: (id: string) => void;
  setChatHistorySelectionMode: Dispatch<SetStateAction<boolean>>;
  setDraft: (next: string | ((current: string) => string)) => void;
  setRenameDraft: Dispatch<SetStateAction<string>>;
  setRenamingChatId: Dispatch<SetStateAction<string | null>>;
  setSelectedChatHistoryIds: Dispatch<SetStateAction<Set<string>>>;
  setWorkspaceDestination: Dispatch<SetStateAction<ProfessorMariWorkspaceDestination>>;
  setWorkspaceRunClock: Dispatch<SetStateAction<{ startedAt: number; endedAt: number | null } | null>>;
  setWorkspaceTimeline: Dispatch<SetStateAction<WorkspaceTimelineItem[]>>;
};

export function useMariChatHistoryActions({
  chatHistory,
  chatId,
  effectiveConnectionId,
  ensureProfessorMariChat,
  isBusy,
  loadChatHistory,
  loadMessages,
  openChatId,
  renameDraft,
  requestedChatIdRef,
  selectedChatHistoryIds,
  setActiveChatId,
  setChatHistorySelectionMode,
  setDraft,
  setRenameDraft,
  setRenamingChatId,
  setSelectedChatHistoryIds,
  setWorkspaceDestination,
  setWorkspaceRunClock,
  setWorkspaceTimeline,
}: MariChatHistoryActionsInput) {
  const { t: localizeUi } = useTranslation();
  const qc = useQueryClient();
  const handleSelectProfessorChat = useCallback(
    async (id: string) => {
      if (isBusy) {
        toast.info(localizeUi("ui.chat.homeprofessormarichat.waitForProfessorMariToFinishBeforeSwitchingChats"));
        return false;
      }
      try {
        const chat = await api.post<Chat>(`/chats/internal/professor-mari/chats/${id}/activate`);
        setActiveChatId(chat.id);
        qc.setQueryData(chatKeys.detail(chat.id), chat);
        setWorkspaceDestination("chat");
        setWorkspaceTimeline([]);
        setWorkspaceRunClock(null);
        useChatStore.getState().clearStreamBuffer(chat.id);
        useChatStore.getState().clearThinkingBuffer(chat.id);
        await loadMessages(chat.id);
        await loadChatHistory();
        return true;
      } catch (error) {
        console.error("[Professor Mari] Failed to open previous chat", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotOpenThatChat"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
        return false;
      }
    },
    [
      isBusy,
      localizeUi,
      setActiveChatId,
      qc,
      setWorkspaceDestination,
      setWorkspaceTimeline,
      setWorkspaceRunClock,
      loadMessages,
      loadChatHistory,
    ],
  );

  useEffect(() => {
    if (isBusy || !openChatId || openChatId === chatId || requestedChatIdRef.current === openChatId) return;
    requestedChatIdRef.current = openChatId;
    void handleSelectProfessorChat(openChatId).then((selected) => {
      if (!selected && requestedChatIdRef.current === openChatId) requestedChatIdRef.current = null;
    });
  }, [chatId, handleSelectProfessorChat, isBusy, openChatId, requestedChatIdRef]);

  const handleRenameProfessorChat = useCallback(
    async (id: string) => {
      const name = renameDraft.trim();
      if (!name) return;
      try {
        await api.patch(`/chats/internal/professor-mari/chats/${id}`, { name });
        setRenamingChatId(null);
        setRenameDraft("");
        await Promise.all([
          loadChatHistory(),
          qc.invalidateQueries({ queryKey: chatKeys.detail(id) }),
          qc.invalidateQueries({ queryKey: chatKeys.list() }),
          qc.invalidateQueries({ queryKey: homeFeedKeys.all }),
        ]);
      } catch (error) {
        console.error("[Professor Mari] Failed to rename chat", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRenameThatChat"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      }
    },
    [renameDraft, setRenamingChatId, setRenameDraft, loadChatHistory, qc, localizeUi],
  );

  const handleTitleCommand = useCallback(
    async (messageText: string) => {
      const match = /^\/title(?:\s+(.*))?$/iu.exec(messageText);
      if (!match) return false;
      const name = match[1]?.trim() ?? "";
      if (!name) {
        toast.info(localizeUi("ui.chat.homeprofessormarichat.titleCommandUsage"));
        return true;
      }
      if (!chatId) {
        toast.error(localizeUi("ui.chat.homeprofessormarichat.titleCommandNoActiveChat"));
        return true;
      }
      try {
        await api.patch(`/chats/internal/professor-mari/chats/${chatId}`, { name });
        setDraft("");
        await Promise.all([
          loadChatHistory(),
          qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) }),
          qc.invalidateQueries({ queryKey: chatKeys.list() }),
          qc.invalidateQueries({ queryKey: homeFeedKeys.all }),
        ]);
        toast.success(localizeUi("ui.chat.homeprofessormarichat.titleCommandRenamed", { name }));
      } catch (error) {
        console.error("[Professor Mari] Failed to rename chat with /title", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRenameThatChat"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      }
      return true;
    },
    [chatId, loadChatHistory, qc, setDraft, localizeUi],
  );

  const handleDeleteProfessorChat = useCallback(
    async (id: string) => {
      const item = chatHistory.find((chat) => chat.id === id);
      if (!item) return;
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.chat.homeprofessormarichat.deleteValue1", {
          value1: item.name || localizeUi("ui.chat.homeprofessormarichat.thisProfessorMariChat"),
        }),
        message: localizeUi("ui.chat.homeprofessormarichat.deleteSelectedChatsConfirmation", { count: 1 }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      });
      if (!confirmed) return;
      try {
        await api.delete(`/chats/internal/professor-mari/chats/${id}`);
        if (id === chatId) {
          const chat = await ensureProfessorMariChat(effectiveConnectionId);
          setActiveChatId(chat.id);
          await loadMessages(chat.id);
        }
        await loadChatHistory();
      } catch (error) {
        console.error("[Professor Mari] Failed to delete chat", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotDeleteThatChat"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      }
    },
    [
      chatHistory,
      chatId,
      effectiveConnectionId,
      ensureProfessorMariChat,
      loadChatHistory,
      loadMessages,
      setActiveChatId,
      localizeUi,
    ],
  );

  const toggleProfessorChatSelection = useCallback(
    (id: string) => {
      setSelectedChatHistoryIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setSelectedChatHistoryIds],
  );

  const handleBulkDeleteProfessorChats = useCallback(async () => {
    if (selectedChatHistoryIds.size === 0) return;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.chat.homeprofessormarichat.deleteSelectedChats"),
      message: localizeUi("ui.chat.homeprofessormarichat.deleteSelectedChatsConfirmation", {
        count: selectedChatHistoryIds.size,
      }),
      confirmLabel: localizeUi("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (!confirmed) return;

    const selectedIds = [...selectedChatHistoryIds];
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => api.delete(`/chats/internal/professor-mari/chats/${id}`)),
      );
      const deletedIds = new Set(selectedIds.filter((_, index) => results[index]?.status === "fulfilled"));
      const failedDeletion = results.find((result) => result.status === "rejected");
      setChatHistorySelectionMode(false);
      setSelectedChatHistoryIds(new Set());
      if (chatId && deletedIds.has(chatId)) {
        const chat = await ensureProfessorMariChat(effectiveConnectionId);
        setActiveChatId(chat.id);
        await loadMessages(chat.id);
      }
      await loadChatHistory();
      if (failedDeletion?.status === "rejected") throw failedDeletion.reason;
    } catch (error) {
      console.error("[Professor Mari] Failed to delete selected chats", error);
      await loadChatHistory().catch(() => undefined);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotDeleteSelectedChats"), {
        description: describeProfessorMariError(error),
        duration: 12_000,
      });
    }
  }, [
    selectedChatHistoryIds,
    localizeUi,
    setChatHistorySelectionMode,
    setSelectedChatHistoryIds,
    chatId,
    loadChatHistory,
    ensureProfessorMariChat,
    effectiveConnectionId,
    setActiveChatId,
    loadMessages,
  ]);

  return {
    handleSelectProfessorChat,
    handleRenameProfessorChat,
    handleTitleCommand,
    handleDeleteProfessorChat,
    toggleProfessorChatSelection,
    handleBulkDeleteProfessorChats,
  };
}
