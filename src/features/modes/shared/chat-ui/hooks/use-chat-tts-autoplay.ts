import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTTSConfig } from "../../../../../shared/hooks/use-tts";
import {
  buildTTSVoiceRequests,
  clientSidePlaybackRate,
  normalizeTTSCharacterName,
} from "../../../../../shared/lib/tts-dialogue";
import { ttsService } from "../../../../../shared/lib/tts-service";
import { useChatStore } from "../../../../../shared/stores/chat.store";
import type { CharacterMap, MessageWithSwipes } from "../types";
import { useStreamingTTS } from "./use-streaming-tts";

type ChatTtsAutoplayMode = "conversation" | "roleplay" | "visual_novel";

type UseChatTtsAutoplayOptions = {
  chatId: string | null;
  mode: ChatTtsAutoplayMode;
  messages: MessageWithSwipes[] | undefined;
  characterMap: CharacterMap;
  isStreaming: boolean;
};

function findLastAssistantMessage(messages: MessageWithSwipes[] | undefined): MessageWithSwipes | undefined {
  const messageList = messages ?? [];
  for (let index = messageList.length - 1; index >= 0; index -= 1) {
    const candidate = messageList[index];
    if (candidate.role === "assistant" || candidate.role === "narrator") {
      return candidate;
    }
  }
  return undefined;
}

export function useChatTtsAutoplay({ chatId, mode, messages, characterMap, isStreaming }: UseChatTtsAutoplayOptions) {
  const { data: ttsConfig } = useTTSConfig();
  const streamingCharacterId = useChatStore((state) => state.streamingCharacterId);
  const typingCharacterName = useChatStore((state) => state.typingCharacterName);
  const ttsConfigRef = useRef(ttsConfig);
  ttsConfigRef.current = ttsConfig;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const prevIsStreamingRef = useRef(false);
  const streamingTTSEnabled = Boolean(
    ttsConfig?.enabled &&
      ttsConfig.autoplayStreaming &&
      (mode === "roleplay" || mode === "visual_novel" ? ttsConfig.autoplayRP : ttsConfig.autoplayConvo),
  );
  const fallbackTTSMessage = findLastAssistantMessage(messages);
  const streamingFallbackCharacterId =
    streamingCharacterId && characterMap.has(streamingCharacterId) ? streamingCharacterId : fallbackTTSMessage?.characterId;
  const streamingFallbackSpeaker =
    (streamingFallbackCharacterId ? characterMap.get(streamingFallbackCharacterId)?.name : undefined) ??
    typingCharacterName ??
    (fallbackTTSMessage?.role === "narrator"
      ? "Narrator"
      : fallbackTTSMessage?.characterId
        ? characterMap.get(fallbackTTSMessage.characterId)?.name
        : undefined);
  const characterNameLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const [characterId, character] of characterMap) {
      lookup.set(normalizeTTSCharacterName(character.name), characterId);
    }
    return lookup;
  }, [characterMap]);
  const resolveCharacterIdForSpeaker = useCallback(
    (speaker?: string | null) => {
      const normalizedSpeaker = normalizeTTSCharacterName(speaker);
      if (!normalizedSpeaker) return null;
      return characterNameLookup.get(normalizedSpeaker) ?? null;
    },
    [characterNameLookup],
  );

  useStreamingTTS({
    enabled: streamingTTSEnabled,
    chatId,
    ttsConfig,
    fallbackSpeaker: streamingFallbackSpeaker,
    fallbackCharacterId: streamingFallbackCharacterId,
    resolveCharacterIdForSpeaker,
  });

  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;
    if (!wasStreaming || isStreaming) return;

    const config = ttsConfigRef.current;
    if (!config?.enabled) return;

    const currentMode = modeRef.current;
    const shouldAutoplay =
      currentMode === "roleplay" || currentMode === "visual_novel" ? config.autoplayRP : config.autoplayConvo;
    if (!shouldAutoplay) return;
    if (config.autoplayStreaming) return;

    const messageList = messagesRef.current ?? [];
    const lastMessage = findLastAssistantMessage(messageList);
    if (!lastMessage?.content) return;

    const fallbackSpeaker =
      lastMessage.role === "narrator"
        ? "Narrator"
        : lastMessage.characterId
          ? characterMap.get(lastMessage.characterId)?.name
          : undefined;
    const requests = buildTTSVoiceRequests(lastMessage.content, config, fallbackSpeaker, lastMessage.characterId).filter(
      (request) => request.text.trim().length > 0,
    );
    if (requests.length === 0) return;

    void ttsService.speakSequence(requests, lastMessage.id, {
      playbackRate: clientSidePlaybackRate(config),
    });
  }, [characterMap, isStreaming]);
}
