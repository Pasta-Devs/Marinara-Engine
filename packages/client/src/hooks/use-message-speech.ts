// ──────────────────────────────────────────────
// Hook: speak one chat message aloud on demand
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Message } from "@marinara-engine/shared";
import { useTTSConfig } from "./use-tts";
import { ttsService } from "../lib/tts-service";
import {
  buildTTSVoiceRequests,
  findTTSCharacterIdBySpeakerName,
  getTTSPersonaVoice,
  isTTSSpeakerAmbiguous,
  resolveTTSMessagePersona,
  withTTSVoiceRequestCacheKeys,
} from "../lib/tts-dialogue";
import { useUIStore } from "../stores/ui.store";
import type { CharacterMap, PersonaInfo } from "../components/chat/chat-area.types";

type SpeakableMessage = Pick<Message, "id" | "chatId" | "role" | "characterId" | "content"> & { extra?: unknown };

/**
 * The Speak button of a message: the same voices and cache keys as autoplay (ChatArea), so a message that
 * autoplayed replays from cache. `enabled` is false while text to speech is off, and the button stays hidden.
 * `spokenContent` is the message text with its macros resolved as the message shows them ({{user}} → the name);
 * without it the stored text is read.
 */
export function useMessageSpeech(
  message: SpeakableMessage,
  characterMap?: CharacterMap,
  personaInfo?: PersonaInfo,
  spokenContent?: string,
) {
  const text = spokenContent ?? message.content;
  const { data: ttsConfig } = useTTSConfig();
  const enabled = ttsConfig?.enabled ?? false;
  const ttsLineVolume = useUIStore((s) => s.ttsLineVolume);
  const persona = useMemo(
    () => resolveTTSMessagePersona(message as Parameters<typeof resolveTTSMessagePersona>[0], personaInfo),
    [message, personaInfo],
  );

  const requests = useMemo(() => {
    if (!ttsConfig?.enabled) return [];
    const ownUserMessage = message.role === "user";
    const mappedUserPersona = ownUserMessage && getTTSPersonaVoice(ttsConfig, persona);
    const fallbackSpeaker = mappedUserPersona
      ? persona?.name
      : message.role === "narrator"
        ? "Narrator"
        : message.characterId
          ? characterMap?.get(message.characterId)?.name
          : undefined;
    const fallbackId = ownUserMessage ? (mappedUserPersona ? persona?.id : undefined) : message.characterId;
    const built = buildTTSVoiceRequests(
      text,
      ttsConfig,
      fallbackSpeaker,
      fallbackId,
      (speaker) => findTTSCharacterIdBySpeakerName(speaker, characterMap ?? [], persona),
      ownUserMessage && !mappedUserPersona ? undefined : persona,
      (speaker) => isTTSSpeakerAmbiguous(speaker, characterMap ?? [], persona),
    );
    return withTTSVoiceRequestCacheKeys(built, ttsConfig, message.id);
  }, [characterMap, message.characterId, message.id, message.role, persona, text, ttsConfig]);

  const [state, setState] = useState(ttsService.getState());
  const [activeId, setActiveId] = useState<string | null>(ttsService.getActiveId());
  useEffect(
    () =>
      ttsService.subscribe((next, id) => {
        setState(next);
        setActiveId(id);
      }),
    [],
  );
  const speaking = activeId === message.id;
  const loading = speaking && state === "loading";
  const busyElsewhere =
    !speaking && (state === "loading" || state === "playing" || state === "paused" || state === "blocked");

  const toggle = useCallback(() => {
    // Read the singleton, never stale React state.
    const liveState = ttsService.getState();
    const liveIsThis = ttsService.getActiveId() === message.id;
    const liveBusy =
      liveState === "loading" || liveState === "playing" || liveState === "paused" || liveState === "blocked";
    if (liveIsThis) {
      ttsService.stop();
      return;
    }
    if (liveBusy || requests.length === 0) return;
    void ttsService.speakSequence(requests, message.id, {
      chatId: message.chatId,
      progressive: ttsConfig?.progressivePlayback,
      volume: ttsLineVolume / 100,
    });
  }, [message.chatId, message.id, requests, ttsConfig?.progressivePlayback, ttsLineVolume]);

  return { enabled, hasContent: requests.length > 0, speaking, loading, busyElsewhere, toggle };
}
