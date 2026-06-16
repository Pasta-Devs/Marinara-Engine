// ──────────────────────────────────────────────
// Hook: Background Autonomous Polling
// ──────────────────────────────────────────────
// Polls for autonomous messages on inactive conversation chats.
// Lives at the AppShell level so it persists across chat switches.
// The active chat's autonomous messaging is handled by ConversationView.

import { useEffect, useRef } from "react";
import type { Chat } from "@marinara-engine/shared";
import type { AvatarCropValue } from "../lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../lib/api-client";
import { useChatStore, type DelayedCharacterInfo } from "../stores/chat.store";
import { useUIStore } from "../stores/ui.store";
import { showConversationLocalNotification } from "../lib/local-notifications";
import { playNotificationPing } from "../lib/notification-sound";
import { chatKeys } from "./use-chats";
import { characterKeys } from "./use-characters";

interface AutonomousCheckResult {
  shouldTrigger: boolean;
  characterIds: string[];
  reason: string;
  inactivityMs: number;
  generationStartedAt?: number;
}

interface RawChat {
  id: string;
  name: string;
  mode?: string;
  metadata?: string | Record<string, unknown>;
}

interface RawCharacter {
  id: string;
  data?: string | { name?: string };
  avatarPath?: string | null;
}

type StreamEvent = { type: string; data?: unknown; [key: string]: unknown };

function parseDelayedEvent(event: StreamEvent): DelayedCharacterInfo {
  const delayedNames = Array.isArray(event.characters)
    ? event.characters.filter((name): name is string => typeof name === "string")
    : [];
  const delayedIds = Array.isArray(event.characterIds)
    ? event.characterIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const delayedCharacters = Array.isArray(event.characterStatuses)
    ? event.characterStatuses.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const character = item as Record<string, unknown>;
        if (typeof character.id !== "string" || typeof character.name !== "string") return [];
        const status = typeof character.status === "string" ? character.status : "idle";
        return [{ id: character.id, name: character.name, status }];
      })
    : [];
  const delayedLabel = delayedNames.length === 1 ? delayedNames[0]! : delayedNames.join(", ") || "Character";
  const delayedStatus = typeof event.status === "string" ? event.status : "idle";

  return {
    name: delayedLabel,
    status: delayedStatus,
    ...(delayedIds.length ? { characterIds: delayedIds } : {}),
    ...(delayedCharacters.length ? { characters: delayedCharacters } : {}),
  };
}

/**
 * Parse chat metadata safely from either a JSON string or an object.
 */
function parseMeta(chat: RawChat): Record<string, unknown> {
  const raw = chat.metadata;
  if (!raw) return {};
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

/**
 * Background polling for autonomous messages on inactive conversation chats.
 * Fetches the chat list on each tick so the effect doesn't depend on
 * external React state (which would reset the timer on every re-render).
 */
export function useBackgroundAutonomousPolling() {
  const qc = useQueryClient();
  const pollTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const generationControllersRef = useRef<Map<string, { controller: AbortController; startedAt?: number }>>(new Map());
  const generatingForRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const generationControllers = generationControllersRef.current;

    const poll = async () => {
      if (!mountedRef.current) return;

      // Skip API calls while tab is hidden to prevent a burst of requests on return.
      // Server-side inactivity tracking is unaffected; the next visible poll picks up correctly.
      if (document.hidden) {
        schedulePoll();
        return;
      }

      const activeChatId = useChatStore.getState().activeChatId;

      // Fetch the current chat list directly from the API each tick.
      // This avoids the effect depending on useChats() data which would
      // cause frequent timer restarts.
      let allChats: RawChat[];
      try {
        allChats = await api.get<RawChat[]>("/chats");
      } catch {
        schedulePoll();
        return;
      }

      // Find conversation chats with autonomous messaging enabled, excluding active chat
      const backgroundChats = allChats.filter((chat) => {
        if (chat.id === activeChatId) return false;
        if (generatingForRef.current.has(chat.id)) return false;
        if (chat.mode !== "conversation") return false;
        try {
          const meta = parseMeta(chat);
          return !!meta.autonomousMessages;
        } catch {
          return false;
        }
      });

      const userStatus = useUIStore.getState().userStatus;

      // Don't trigger autonomous messages when user is DND
      if (userStatus === "dnd" || backgroundChats.length === 0) {
        if (userStatus === "dnd" && backgroundChats.length > 0) {
          await Promise.allSettled(
            backgroundChats.map((chat) =>
              api.post("/conversation/activity/presence", { chatId: chat.id, userStatus }).catch(() => {}),
            ),
          );
        }
        schedulePoll();
        return;
      }

      // Check each background chat (sequentially to avoid hammering the server)
      for (const chat of backgroundChats) {
        // Don't proceed if this chat already has an in-flight generation
        if (useChatStore.getState().abortControllers.has(chat.id)) continue;

        try {
          const result = await api.post<AutonomousCheckResult>("/conversation/autonomous/check", {
            chatId: chat.id,
            userStatus,
          });

          if (result.shouldTrigger && result.characterIds.length > 0) {
            const characterId = result.characterIds[0]!;
            const generationStartedAt = result.generationStartedAt;

            generatingForRef.current.add(chat.id);
            const doGenerate = async () => {
              let receivedTokens = false;
              let shouldClearAutonomousFlag = true;
              const abortController = new AbortController();
              try {
                // Re-check guard — a generation may have started for this chat
                // after the autonomous check returned.
                if (useChatStore.getState().abortControllers.has(chat.id)) {
                  shouldClearAutonomousFlag = false;
                  generatingForRef.current.delete(chat.id);
                  await api
                    .post("/conversation/autonomous/clear-in-progress", {
                      chatId: chat.id,
                      startedAt: generationStartedAt,
                    })
                    .catch(() => {});
                  return;
                }

                generationControllers.set(chat.id, { controller: abortController, startedAt: generationStartedAt });
                useChatStore.getState().setAbortController(chat.id, abortController);

                // Use streamEvents to drain the SSE — tokens aren't needed for background chats
                for await (const rawEvent of api.streamEvents(
                  "/generate",
                  {
                    chatId: chat.id,
                    connectionId: null,
                    forCharacterId: characterId,
                    streaming: useUIStore.getState().enableStreaming,
                  },
                  abortController.signal,
                )) {
                  const event = rawEvent as StreamEvent;
                  if (event.type === "delayed") {
                    const delayedInfo = parseDelayedEvent(event);
                    useChatStore.getState().setPerChatDelayed(chat.id, delayedInfo);
                    if (useChatStore.getState().activeChatId === chat.id) {
                      useChatStore.getState().setDelayedCharacterInfo(delayedInfo);
                    }
                    qc.invalidateQueries({ queryKey: characterKeys.list() });
                  }
                  if (event.type === "token") {
                    receivedTokens = true;
                    useChatStore.getState().setPerChatDelayed(chat.id, null);
                    if (useChatStore.getState().activeChatId === chat.id) {
                      useChatStore.getState().setDelayedCharacterInfo(null);
                    }
                  }
                }

                // Only notify if the generation actually produced a message
                if (!receivedTokens) return;

                // Reset + refetch messages so the cache has fresh data when the
                // user navigates to this chat. Without this, TanStack Query
                // would show stale cached data (missing the new message) until
                // the background refetch completes — making it look like the
                // message isn't there even though it was saved.
                qc.resetQueries({ queryKey: chatKeys.messages(chat.id) });
                qc.invalidateQueries({ queryKey: characterKeys.list() });
                void api
                  .post<Chat>(`/chats/${chat.id}/autonomous-unread`, { characterId })
                  .then((updatedChat) => {
                    qc.setQueryData(chatKeys.detail(chat.id), updatedChat);
                    qc.invalidateQueries({ queryKey: chatKeys.list() });
                  })
                  .catch(() => {
                    /* persistence is best-effort; keep the local notification */
                  });

                // Resolve character name for the notification
                let charName = "Someone";
                let charAvatar: string | null = null;
                let charAvatarCrop: AvatarCropValue | null = null;
                try {
                  // Find the triggering character's name
                  const charRow = await api.get<RawCharacter>(`/characters/${characterId}`);
                  if (charRow) {
                    const data = typeof charRow.data === "string" ? JSON.parse(charRow.data) : charRow.data;
                    if (data?.name) charName = data.name;
                    charAvatarCrop = data?.extensions?.avatarCrop ?? null;
                    charAvatar = charRow.avatarPath ?? null;
                  }
                } catch {
                  /* use fallback name */
                }

                // Play notification sound
                if (useUIStore.getState().convoNotificationSound) {
                  playNotificationPing();
                }

                // Increment unread badge
                useChatStore.getState().incrementUnread(chat.id);

                // Add floating avatar notification bubble
                useChatStore.getState().addNotification(chat.id, charName, charAvatar, charAvatarCrop);

                void showConversationLocalNotification({
                  enabled: useUIStore.getState().conversationBrowserNotifications,
                  characterName: charName,
                  tag: `marinara-conversation-${chat.id}`,
                });

                // Show a global toast so the user knows even from a different chat
                toast(`${charName} sent you a message`, { icon: "💬" });
              } catch {
                // generation failed — non-critical
              } finally {
                useChatStore.getState().setPerChatDelayed(chat.id, null);
                if (useChatStore.getState().activeChatId === chat.id) {
                  useChatStore.getState().setDelayedCharacterInfo(null);
                }
                if (!receivedTokens && shouldClearAutonomousFlag) {
                  try {
                    await api.post("/conversation/autonomous/clear-in-progress", {
                      chatId: chat.id,
                      startedAt: generationStartedAt,
                    });
                  } catch {
                    /* non-critical */
                  }
                }
                if (useChatStore.getState().abortControllers.get(chat.id) === abortController) {
                  useChatStore.getState().setAbortController(chat.id, null);
                }
                if (useChatStore.getState().activeChatId === chat.id) {
                  useChatStore.getState().setStreaming(false, chat.id);
                }
                generationControllers.delete(chat.id);
                generatingForRef.current.delete(chat.id);
              }
            };
            doGenerate();
          }
        } catch {
          // Check failed — skip this chat, try next
        }
      }

      schedulePoll();
    };

    const schedulePoll = () => {
      if (!mountedRef.current) return;
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = setTimeout(poll, 30_000);
    };

    // Start polling after an initial delay (staggered from active autonomous polling at 10s)
    pollTimerRef.current = setTimeout(poll, 20_000);

    return () => {
      mountedRef.current = false;
      clearTimeout(pollTimerRef.current);
      for (const [chatId, generation] of generationControllers) {
        generation.controller.abort();
        useChatStore.getState().setAbortController(chatId, null);
        if (useChatStore.getState().activeChatId === chatId) {
          useChatStore.getState().setStreaming(false, chatId);
        }
        useChatStore.getState().setPerChatDelayed(chatId, null);
        void api
          .post("/conversation/autonomous/clear-in-progress", {
            chatId,
            startedAt: generation.startedAt,
          })
          .catch(() => {});
      }
      generationControllers.clear();
    };
  }, [qc]); // Only depends on qc (which is stable) — timer lifecycle is self-managed
}
