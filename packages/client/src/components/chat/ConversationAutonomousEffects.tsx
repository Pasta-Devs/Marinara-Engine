import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Message } from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { playNotificationPing } from "../../lib/notification-sound";
import { generateClientId } from "../../lib/utils";
import { useAutonomousMessaging } from "../../hooks/use-autonomous-messaging";
import type { CharacterMap } from "./chat-area.types";

type ConversationAutonomousEffectsProps = {
  chatId: string;
  messages: Message[] | undefined;
  characterMap: CharacterMap;
  chatMeta: Record<string, any>;
};

export function ConversationAutonomousEffects({
  chatId,
  messages,
  characterMap,
  chatMeta,
}: ConversationAutonomousEffectsProps) {
  const autonomousEnabled = !!chatMeta.autonomousMessages;
  const exchangesEnabled = !!chatMeta.characterExchanges;
  const [notification, setNotification] = useState<{ name: string; id: string } | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleAutonomousMessage = useCallback(
    (characterId: string) => {
      const charInfo = characterMap.get(characterId);
      const name = charInfo?.name ?? "Someone";

      if (useUIStore.getState().convoNotificationSound) {
        playNotificationPing();
      }

      if (useChatStore.getState().activeChatId !== chatId) {
        useChatStore.getState().incrementUnread(chatId);
      }

      clearTimeout(notificationTimerRef.current);
      setNotification({ name, id: generateClientId() });
      notificationTimerRef.current = setTimeout(() => setNotification(null), 5000);
    },
    [characterMap, chatId],
  );

  const { recordUserActivity, recordAssistantActivity } = useAutonomousMessaging(
    chatId,
    autonomousEnabled,
    exchangesEnabled,
    handleAutonomousMessage,
  );

  const prevMsgCountRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    prevMsgCountRef.current = undefined;
  }, [chatId]);

  useEffect(() => {
    if (!messages) return;
    const count = messages.length;

    // The first hydrated history load is not new activity and must not reset timers.
    if (prevMsgCountRef.current === undefined) {
      prevMsgCountRef.current = count;
      return;
    }

    if (count > prevMsgCountRef.current) {
      const newest = messages[count - 1];
      if (newest?.role === "user") {
        recordUserActivity();
      } else if (newest?.role === "assistant") {
        recordAssistantActivity(newest.characterId ?? undefined);
      }
    }
    prevMsgCountRef.current = count;
  }, [messages, recordAssistantActivity, recordUserActivity]);

  useEffect(() => {
    return () => {
      clearTimeout(notificationTimerRef.current);
    };
  }, []);

  if (!autonomousEnabled && !exchangesEnabled && !notification) {
    return null;
  }

  return (
    <>
      {notification && (
        <div
          key={notification.id}
          className="pointer-events-auto absolute right-4 top-14 z-20 flex animate-slide-in-right items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white shadow-lg"
        >
          <span>{notification.name} messaged you!</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-1 rounded p-0.5 transition-colors hover:bg-foreground/20"
          >
            <X size="0.75rem" />
          </button>
        </div>
      )}
    </>
  );
}
