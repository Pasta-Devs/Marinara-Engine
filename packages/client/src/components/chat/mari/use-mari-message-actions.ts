import { MessageExtra, MessageRole, ProfessorMariAskContext, Chat } from "@marinara-engine/shared";
import type { Message } from "@marinara-engine/shared";
import { RefObject, Dispatch, SetStateAction, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../lib/api-client";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { describeProfessorMariError } from "../../../lib/professor-mari-errors";
import {
  ProfessorMariRecovery,
  ProfessorMariAttachment,
  getProfessorMariAttachments,
  getProfessorMariMessageContext,
  toMessageExtra,
  retryOf,
} from "./mari-chat-helpers";

/** Actions on one message in her transcript: delete, edit, regenerate, edit and resend, remove an attachment. */
type MariMessageActionsInput = {
  activeChatIdRef: RefObject<string | null>;
  attachmentRemovalInFlightRef: RefObject<Set<string>>;
  chatId: string | null;
  effectiveConnectionId: string;
  failRun: (
    error: unknown,
    retry: Pick<ProfessorMariRecovery, "text" | "attachments" | "context" | "localMessageId">,
  ) => void;
  isBusy: boolean;
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
  messageLoadAbortRef: RefObject<AbortController | null>;
  messageMutationBusyRef: RefObject<boolean>;
  messagesRef: RefObject<Message[]>;
  refreshAfterWorkspaceRun: (completedChatId: string, runId: number) => Promise<void>;
  regenerationInFlightRef: RefObject<boolean>;
  sendWorkspaceMessage: (
    chat: Pick<Chat, "id">,
    text: string,
    attachments?: ProfessorMariAttachment[],
    existingUserMessageId?: string,
    context?: ProfessorMariAskContext | null,
  ) => Promise<{ received: boolean; runId: number; hiddenDuringStream: boolean }>;
  setConnectionMenuOpen: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setSending: Dispatch<SetStateAction<boolean>>;
};

export function useMariMessageActions({
  activeChatIdRef,
  attachmentRemovalInFlightRef,
  chatId,
  effectiveConnectionId,
  failRun,
  isBusy,
  loadMessages,
  messageLoadAbortRef,
  messageMutationBusyRef,
  messagesRef,
  refreshAfterWorkspaceRun,
  regenerationInFlightRef,
  sendWorkspaceMessage,
  setConnectionMenuOpen,
  setMessages,
  setSending,
}: MariMessageActionsInput) {
  const { t: localizeUi } = useTranslation();
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!chatId || isBusy) return;
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.chat.homeprofessormarichat.deleteMessage"),
        message: localizeUi("ui.chat.homeprofessormarichat.deleteMessageConfirmation"),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      });
      if (!confirmed || messageMutationBusyRef.current) return;
      messageLoadAbortRef.current?.abort();
      // Optimistic update from local state
      setMessages((current) => current.filter((m) => m.id !== messageId));
      try {
        await api.delete(`/chats/${chatId}/messages/${messageId}?trash=false`);
      } catch (error) {
        console.error("[Professor Mari] Failed to delete message", error);
        await loadMessages(chatId).catch(() => undefined);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotDeleteThatMessage"), {
          description: describeProfessorMariError(error),
        });
      }
    },
    [chatId, isBusy, loadMessages, localizeUi, messageLoadAbortRef, messageMutationBusyRef, setMessages],
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!chatId || isBusy) return;
      messageLoadAbortRef.current?.abort();
      setMessages((current) => current.map((m) => (m.id === messageId ? { ...m, content } : m)));
      try {
        await api.patch(`/chats/${chatId}/messages/${messageId}`, { content });
      } catch (error) {
        console.error("[Professor Mari] Failed to edit message", error);
        await loadMessages(chatId).catch(() => undefined);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotSaveThatEdit"), {
          description: describeProfessorMariError(error),
        });
      }
    },
    [chatId, isBusy, loadMessages, localizeUi, messageLoadAbortRef, setMessages],
  );

  const handleRegenerateMessage = useCallback(
    async (messageId: string) => {
      if (isBusy || regenerationInFlightRef.current || !chatId) return;
      if (!effectiveConnectionId) {
        // Fix inside the Mari pane, not the right panel: that panel renders behind
        // the omnibar (z-100) and would silently swallow this request.
        setConnectionMenuOpen(true);
        return;
      }
      const initialMessages = messagesRef.current;
      const initialIndex = initialMessages.findIndex((message) => message.id === messageId);
      if (
        initialIndex <= 0 ||
        initialIndex !== initialMessages.length - 1 ||
        initialMessages[initialIndex]?.role !== "assistant" ||
        initialMessages[initialIndex - 1]?.role !== "user"
      )
        return;

      regenerationInFlightRef.current = true;
      setSending(true);
      try {
        const confirmed = await showConfirmDialog({
          title: localizeUi("ui.chat.homeprofessormarichat.regenerateResponse"),
          message: localizeUi("ui.chat.homeprofessormarichat.regenerateResponseConfirmation"),
          confirmLabel: localizeUi("ui.chat.chatmessage.regenerate"),
          tone: "destructive",
        });
        if (!confirmed || activeChatIdRef.current !== chatId) return;

        const currentMessages = messagesRef.current;
        const index = currentMessages.findIndex((message) => message.id === messageId);
        if (index <= 0 || index !== currentMessages.length - 1 || currentMessages[index]?.role !== "assistant") return;
        const userMessage = currentMessages[index - 1];
        if (userMessage.role !== "user") return;

        messageLoadAbortRef.current?.abort();
        setMessages((current) => current.filter((message) => message.id !== messageId));
        await api.delete(`/chats/${chatId}/messages/${messageId}?trash=false`);
        const { received, runId, hiddenDuringStream } = await sendWorkspaceMessage(
          { id: chatId },
          userMessage.content,
          getProfessorMariAttachments(userMessage),
          userMessage.id,
          getProfessorMariMessageContext(userMessage) ?? null,
        );
        if (!received && !hiddenDuringStream) throw new Error("Professor Mari did not return a regenerated response");
        void refreshAfterWorkspaceRun(chatId, runId);
      } catch (error) {
        void loadMessages(chatId).catch(() => undefined);
        failRun(error, retryOf(initialMessages[initialIndex - 1]));
      } finally {
        regenerationInFlightRef.current = false;
        setSending(false);
      }
    },
    [
      activeChatIdRef,
      chatId,
      effectiveConnectionId,
      failRun,
      isBusy,
      loadMessages,
      localizeUi,
      messageLoadAbortRef,
      messagesRef,
      refreshAfterWorkspaceRun,
      regenerationInFlightRef,
      sendWorkspaceMessage,
      setConnectionMenuOpen,
      setMessages,
      setSending,
    ],
  );

  const handleEditAndResend = useCallback(
    async (messageId: string, content: string) => {
      if (isBusy || regenerationInFlightRef.current || !chatId || !content.trim()) return;
      if (!effectiveConnectionId) {
        setConnectionMenuOpen(true);
        return;
      }
      const initialMessages = messagesRef.current;
      const index = initialMessages.findIndex((message) => message.id === messageId);
      const userMessage = initialMessages[index];
      const later = initialMessages.slice(index + 1);
      // Only your latest turn: Mari keeps no branches, so an older edit would silently drop later turns.
      if (userMessage?.role !== "user" || later.some((message) => message.role === "user")) return;

      regenerationInFlightRef.current = true;
      setSending(true);
      try {
        if (later.length > 0) {
          const confirmed = await showConfirmDialog({
            title: localizeUi("ui.chat.homeprofessormarichat.editAndResendTitle"),
            message: localizeUi("ui.chat.homeprofessormarichat.editAndResendConfirmation"),
            confirmLabel: localizeUi("ui.chat.homeprofessormarichat.saveAndSend"),
            tone: "destructive",
          });
          if (!confirmed || activeChatIdRef.current !== chatId) return;
        }
        messageLoadAbortRef.current?.abort();
        const laterIds = new Set(later.map((message) => message.id));
        setMessages((current) =>
          current
            .filter((message) => !laterIds.has(message.id))
            .map((message) => (message.id === messageId ? { ...message, content } : message)),
        );
        await api.patch(`/chats/${chatId}/messages/${messageId}`, { content });
        for (const message of later) await api.delete(`/chats/${chatId}/messages/${message.id}`);
        const { received, runId, hiddenDuringStream } = await sendWorkspaceMessage(
          { id: chatId },
          content,
          getProfessorMariAttachments(userMessage),
          userMessage.id,
          getProfessorMariMessageContext(userMessage) ?? null,
        );
        if (!received && !hiddenDuringStream) throw new Error("Professor Mari did not answer the edited message");
        void refreshAfterWorkspaceRun(chatId, runId);
      } catch (error) {
        void loadMessages(chatId).catch(() => undefined);
        failRun(error, { ...retryOf(userMessage), text: content });
      } finally {
        regenerationInFlightRef.current = false;
        setSending(false);
      }
    },
    [
      activeChatIdRef,
      chatId,
      effectiveConnectionId,
      failRun,
      isBusy,
      loadMessages,
      localizeUi,
      messageLoadAbortRef,
      messagesRef,
      refreshAfterWorkspaceRun,
      regenerationInFlightRef,
      sendWorkspaceMessage,
      setConnectionMenuOpen,
      setMessages,
      setSending,
    ],
  );

  const handleRemoveAttachment = useCallback(
    async (messageId: string, attachmentIndex: number) => {
      if (!chatId || isBusy || attachmentRemovalInFlightRef.current.has(messageId)) return;
      attachmentRemovalInFlightRef.current.add(messageId);
      try {
        const confirmed = await showConfirmDialog({
          title: localizeUi("ui.chat.homeprofessormarichat.removeAttachment"),
          message: localizeUi("ui.chat.homeprofessormarichat.removeAttachmentConfirmation"),
          confirmLabel: localizeUi("ui.panels.agentspanel.remove"),
          tone: "destructive",
        });
        if (!confirmed || messageMutationBusyRef.current) return;
        const message = messagesRef.current.find((item) => item.id === messageId);
        if (!message) return;
        const currentAttachments = getProfessorMariAttachments(message);
        const updated = currentAttachments.filter((_, index) => index !== attachmentIndex);
        if (updated.length === currentAttachments.length) return;
        messageLoadAbortRef.current?.abort();
        setMessages((current) =>
          current.map((item) => {
            if (item.id !== messageId) return item;
            const extra = toMessageExtra(item);
            return { ...item, extra: { ...extra, attachments: updated } };
          }),
        );
        await api.patch(`/chats/${chatId}/messages/${messageId}/extra`, { attachments: updated });
      } catch (error) {
        console.error("[Professor Mari] Failed to remove attachment", error);
        await loadMessages(chatId).catch(() => undefined);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRemoveThatAttachment"), {
          description: describeProfessorMariError(error),
        });
      } finally {
        attachmentRemovalInFlightRef.current.delete(messageId);
      }
    },
    [
      attachmentRemovalInFlightRef,
      chatId,
      isBusy,
      loadMessages,
      localizeUi,
      messageLoadAbortRef,
      messageMutationBusyRef,
      messagesRef,
      setMessages,
    ],
  );

  return {
    handleDeleteMessage,
    handleEditMessage,
    handleRegenerateMessage,
    handleEditAndResend,
    handleRemoveAttachment,
  };
}
