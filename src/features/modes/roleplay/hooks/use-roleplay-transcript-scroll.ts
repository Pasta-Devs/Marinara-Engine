import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { toast } from "sonner";
import { useChatStore } from "../../../../shared/stores/chat.store";
import type { MessageWithSwipes } from "../../shared/chat-ui/types";

type UseRoleplayTranscriptScrollOptions = {
  activeChatId: string;
  messages: MessageWithSwipes[] | undefined;
  pageCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isStreaming: boolean;
  totalMessageCount: number;
  messageOffset: number;
  messageIdByOrderIndex: Map<number, string>;
};

export function useRoleplayTranscriptScroll({
  activeChatId,
  messages,
  pageCount,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  isStreaming,
  totalMessageCount,
  messageOffset,
  messageIdByOrderIndex,
}: UseRoleplayTranscriptScrollOptions) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const userScrolledAwayRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const userScrolledAtRef = useRef(0);
  const streamBuffer = useChatStore((state) => state.streamBuffers.get(activeChatId) ?? state.streamBuffer);
  const thinkingBuffer = useChatStore((state) => state.thinkingBuffers.get(activeChatId) ?? state.thinkingBuffer);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onScroll = () => {
      const distFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      const nearBottom = distFromBottom < 150;

      if (isStreaming && element.scrollTop < lastScrollTopRef.current - 10) {
        userScrolledAwayRef.current = true;
      }
      if (nearBottom && Date.now() - userScrolledAtRef.current > 300) {
        userScrolledAwayRef.current = false;
      }

      lastScrollTopRef.current = element.scrollTop;
      isNearBottomRef.current = nearBottom;
    };

    const onUserScroll = () => {
      if (isStreaming) {
        userScrolledAwayRef.current = true;
        userScrolledAtRef.current = Date.now();
      }
    };

    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("wheel", onUserScroll, { passive: true });
    element.addEventListener("touchmove", onUserScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("wheel", onUserScroll);
      element.removeEventListener("touchmove", onUserScroll);
    };
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming) userScrolledAwayRef.current = false;
  }, [isStreaming]);

  const newestMsgId = messages?.[messages.length - 1]?.id;
  const newestMsgSwipeIndex = messages?.[messages.length - 1]?.activeSwipeIndex;
  const newestMsgRole = messages?.[messages.length - 1]?.role;
  const isOptimistic = newestMsgId?.startsWith("__optimistic_");
  const forceScrollToNewest = isOptimistic || (isStreaming && newestMsgRole === "user");
  useEffect(() => {
    if (isLoadingMoreRef.current) return;
    if (forceScrollToNewest || (isNearBottomRef.current && !userScrolledAwayRef.current)) {
      messagesEndRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
    }
  }, [newestMsgId, newestMsgSwipeIndex, streamBuffer, thinkingBuffer, isStreaming, forceScrollToNewest]);

  useLayoutEffect(() => {
    if (isLoadingMoreRef.current && scrollRef.current && !isFetchingNextPage) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop += newScrollHeight - prevScrollHeightRef.current;
      isLoadingMoreRef.current = false;
    }
  }, [pageCount, isFetchingNextPage]);

  const handleLoadMore = useCallback(() => {
    if (!scrollRef.current || !hasNextPage || isFetchingNextPage) return;
    prevScrollHeightRef.current = scrollRef.current.scrollHeight;
    isLoadingMoreRef.current = true;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const gotoRequest = useChatStore((state) => state.gotoRequest);
  useEffect(() => {
    if (!gotoRequest || gotoRequest.chatId !== activeChatId) return;
    if (!messages) return;

    const targetNumber = gotoRequest.messageNumber;
    if (totalMessageCount > 0 && targetNumber > totalMessageCount) {
      toast.error(`Message #${targetNumber} doesn't exist - this chat has ${totalMessageCount} messages.`);
      useChatStore.getState().clearGotoRequest();
      return;
    }

    const targetIndex = targetNumber - 1;
    if (targetIndex >= messageOffset) {
      const targetId = messageIdByOrderIndex.get(targetIndex);
      if (!targetId) {
        useChatStore.getState().clearGotoRequest();
        return;
      }
      const raf = requestAnimationFrame(() => {
        const element = document.querySelector(`[data-message-id="${CSS.escape(targetId)}"]`);
        if (element instanceof HTMLElement) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          userScrolledAwayRef.current = true;
        }
        useChatStore.getState().clearGotoRequest();
      });
      return () => cancelAnimationFrame(raf);
    }

    if (hasNextPage && !isFetchingNextPage) {
      if (scrollRef.current) {
        prevScrollHeightRef.current = scrollRef.current.scrollHeight;
        isLoadingMoreRef.current = true;
      }
      fetchNextPage();
    } else if (!hasNextPage) {
      useChatStore.getState().clearGotoRequest();
    }
  }, [
    gotoRequest,
    activeChatId,
    messages,
    messageOffset,
    messageIdByOrderIndex,
    totalMessageCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  return { scrollRef, messagesEndRef, handleLoadMore };
}
