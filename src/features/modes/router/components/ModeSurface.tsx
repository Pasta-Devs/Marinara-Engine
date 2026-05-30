import { Suspense, lazy, useEffect, useRef } from "react";
import { useChat, type ChatMode } from "../../../catalog/chats/index";
import { ApiError } from "../../../../shared/api/api-errors";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { ModeHomeSurface } from "./ModeHomeSurface";

const ConversationModeRoute = lazy(async () => {
  const module = await import("../../conversation/index");
  return { default: module.ConversationModeRoute };
});

const RoleplayModeRoute = lazy(async () => {
  const module = await import("../../roleplay/index");
  return { default: module.RoleplayModeRoute };
});

const GameModeRoute = lazy(async () => {
  const module = await import("../../game/index");
  return { default: module.GameModeRoute };
});

export function ModeSurface() {
  const activeChatId = useChatStore((state) => state.activeChatId);
  const setActiveChatId = useChatStore((state) => state.setActiveChatId);
  const { data: chat, error: chatError, isLoading: isChatLoading, isFetching: isChatFetching } = useChat(activeChatId);
  const lastChatRef = useRef<{ id: string; mode: ChatMode } | null>(null);

  useEffect(() => {
    if (!activeChatId || !(chatError instanceof ApiError) || chatError.status !== 404) return;
    setActiveChatId(null);
  }, [activeChatId, chatError, setActiveChatId]);

  if (!activeChatId) return <ModeHomeSurface />;

  const fallback = <div className="flex flex-1 overflow-hidden" />;
  if (chat?.mode) lastChatRef.current = { id: activeChatId, mode: chat.mode };

  const chatMode = chat?.mode ?? (lastChatRef.current?.id === activeChatId ? lastChatRef.current.mode : null);
  if (!chatMode && (isChatLoading || isChatFetching)) return fallback;
  if (!chatMode) return <ModeHomeSurface />;

  return (
    <Suspense fallback={fallback}>
      {chatMode === "game" ? (
        <GameModeRoute activeChatId={activeChatId} />
      ) : chatMode === "conversation" ? (
        <ConversationModeRoute activeChatId={activeChatId} />
      ) : (
        <RoleplayModeRoute activeChatId={activeChatId} fallbackChatMode="roleplay" />
      )}
    </Suspense>
  );
}
