import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  checkConversationAutonomous,
  checkConversationCharacterExchange,
  clearGenerationInProgress,
  getConversationBusyDelay,
  markGenerationInProgress,
  recordAssistantActivity as recordAssistantActivityState,
  recordAutonomousClientPresence,
  recordUserActivity as recordUserActivityState,
} from "../../../../../engine/modes/chat/autonomous/autonomous.service";
import { generateConversationSchedules } from "../../../../../engine/modes/chat/schedules/schedule.service";
import { llmApi } from "../../../../../shared/api/llm-api";
import { storageApi } from "../../../../../shared/api/storage-api";
import { useChatStore } from "../../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import { invalidateCharacterCollectionQueries } from "../../../../catalog/characters/index";
import { chatKeys } from "../../../../catalog/chats/index";
import { useGenerate } from "../../../../runtime/generation/index";

export function useAutonomousMessaging(
  chatId: string | null,
  autonomousEnabled: boolean,
  exchangesEnabled: boolean,
  onAutonomousMessage?: (characterId: string) => void,
) {
  const { generate } = useGenerate();
  const qc = useQueryClient();
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busyGenerationStartedAtRef = useRef<number | null>(null);
  const generatingRef = useRef(false);
  const onAutonomousMessageRef = useRef(onAutonomousMessage);
  onAutonomousMessageRef.current = onAutonomousMessage;

  const schedulePoll = useCallback((run: () => Promise<void>, delayMs = 30_000) => {
    clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(() => {
      void run();
    }, delayMs);
  }, []);

  const recordAssistantActivity = useCallback(
    (characterId?: string) => {
      if (!chatId) return;
      recordAssistantActivityState(chatId, characterId);
    },
    [chatId],
  );

  const ensureSchedules = useCallback(
    async (characterIds?: string[]) => {
      if (!chatId) return;
      await generateConversationSchedules(
        { storage: storageApi, llm: llmApi },
        {
          chatId,
          characterIds,
          scheduleGenerationPreferences: useUIStore.getState().scheduleGenerationPreferences,
        },
      );
      invalidateCharacterCollectionQueries(qc);
      await qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    },
    [chatId, qc],
  );

  const recordUserActivity = useCallback(() => {
    if (!chatId) return;
    recordUserActivityState(chatId, {
      preserveGenerationInProgress: useChatStore.getState().abortControllers.has(chatId),
    });
  }, [chatId]);

  const triggerAutonomousGeneration = useCallback(
    async (characterId: string, poll: () => Promise<void>, lockedAt?: number) => {
      if (!chatId) return;
      generatingRef.current = true;
      const startedAt = lockedAt ?? markGenerationInProgress(chatId);
      let produced = false;
      let shouldSchedulePoll = true;
      try {
        produced = await generate({
          chatId,
          connectionId: null,
          forCharacterId: characterId,
        });
        if (produced) {
          recordAssistantActivityState(chatId, characterId);
          await qc.invalidateQueries({ queryKey: chatKeys.list() });
          await qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
          onAutonomousMessageRef.current?.(characterId);
        }
      } catch {
        // Autonomous generation is opportunistic; keep polling after failures.
      } finally {
        clearGenerationInProgress(chatId, startedAt);
        generatingRef.current = false;
      }

      if (produced && exchangesEnabled) {
        try {
          const exchange = await checkConversationCharacterExchange(storageApi, {
            chatId,
            lastSpeakerCharId: characterId,
          });
          const nextCharacterId = exchange.characterIds[0];
          if (exchange.shouldTrigger && nextCharacterId) {
            shouldSchedulePoll = false;
            clearTimeout(busyTimerRef.current);
            busyTimerRef.current = setTimeout(
              () => {
                if (!useChatStore.getState().abortControllers.has(chatId)) {
                  void triggerAutonomousGeneration(nextCharacterId, poll);
                } else {
                  schedulePoll(poll);
                }
              },
              2_000 + Math.random() * 3_000,
            );
          }
        } catch {
          // Exchange checks are best-effort.
        }
      }

      if (!produced) {
        recordAssistantActivityState(chatId);
      }
      if (shouldSchedulePoll) schedulePoll(poll);
    },
    [chatId, exchangesEnabled, generate, qc, schedulePoll],
  );

  useEffect(() => {
    if (!chatId || !autonomousEnabled) return;

    const poll = async () => {
      if (generatingRef.current || useChatStore.getState().abortControllers.has(chatId)) {
        schedulePoll(poll);
        return;
      }

      const userStatus = useUIStore.getState().userStatus;
      recordAutonomousClientPresence(chatId, userStatus);
      if (userStatus === "dnd") {
        schedulePoll(poll);
        return;
      }

      let startedAt: number | null = null;
      try {
        const result = await checkConversationAutonomous(storageApi, { chatId, userStatus });
        invalidateCharacterCollectionQueries(qc);
        const characterId = result.characterIds[0];
        if (!result.shouldTrigger || !characterId) {
          schedulePoll(poll);
          return;
        }
        startedAt = markGenerationInProgress(chatId);

        const delay = await getConversationBusyDelay(storageApi, { chatId, characterId });
        if (delay.delayMs > 0) {
          const lockedAt = startedAt;
          if (busyGenerationStartedAtRef.current != null) {
            clearGenerationInProgress(chatId, busyGenerationStartedAtRef.current);
          }
          clearTimeout(busyTimerRef.current);
          busyGenerationStartedAtRef.current = lockedAt;
          busyTimerRef.current = setTimeout(() => {
            busyGenerationStartedAtRef.current = null;
            if (generatingRef.current || useChatStore.getState().abortControllers.has(chatId)) {
              clearGenerationInProgress(chatId, lockedAt);
              schedulePoll(poll);
              return;
            }
            void triggerAutonomousGeneration(characterId, poll, lockedAt);
          }, delay.delayMs);
          return;
        }

        await triggerAutonomousGeneration(characterId, poll, startedAt);
      } catch {
        if (startedAt != null) {
          clearGenerationInProgress(chatId, startedAt);
        }
        if (busyGenerationStartedAtRef.current != null) {
          clearGenerationInProgress(chatId, busyGenerationStartedAtRef.current);
          busyGenerationStartedAtRef.current = null;
        }
        schedulePoll(poll);
      }
    };

    schedulePoll(poll, 10_000);
    return () => {
      clearTimeout(pollTimerRef.current);
      clearTimeout(busyTimerRef.current);
      if (busyGenerationStartedAtRef.current != null) {
        clearGenerationInProgress(chatId, busyGenerationStartedAtRef.current);
        busyGenerationStartedAtRef.current = null;
      }
    };
  }, [autonomousEnabled, chatId, exchangesEnabled, qc, schedulePoll, triggerAutonomousGeneration]);

  return {
    recordUserActivity,
    recordAssistantActivity,
    ensureSchedules,
  };
}
