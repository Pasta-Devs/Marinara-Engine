import {
  ttsRoleplaySpeakerExtractorResponseSchema,
  type TTSConfig,
  type TTSRoleplaySpeakerExtractorResponse,
  type TTSRoleplaySpeakerSegment,
} from "@marinara-engine/shared";
import { api } from "./api-client";
import {
  cleanTTSInputText,
  normalizeTTSCharacterName,
  resolveTTSNarratorVoice,
  resolveTTSVoiceForSpeaker,
  splitTTSChunks,
  type TTSVoiceRequest,
} from "./tts-dialogue";

export type ExtractRoleplayTTSSpeakersInput = {
  message: string;
  group: string;
  user: string;
  characters: string[];
  messageAuthor?: string;
  debugMode: boolean;
};

export async function extractRoleplayTTSSpeakers(
  input: ExtractRoleplayTTSSpeakersInput,
): Promise<TTSRoleplaySpeakerExtractorResponse> {
  const response = await api.post<unknown>("/tts/roleplay-speaker-extractor", input);
  return ttsRoleplaySpeakerExtractorResponseSchema.parse(response);
}

export function buildExtractedRoleplayTTSVoiceRequests(
  segments: readonly TTSRoleplaySpeakerSegment[],
  config: TTSConfig,
  fallbackSpeaker?: string | null,
  fallbackCharacterId?: string | null,
  resolveCharacterIdForSpeaker?: (speaker?: string | null) => string | null | undefined,
): TTSVoiceRequest[] {
  const fallbackSpeakerKey = normalizeTTSCharacterName(fallbackSpeaker);
  const spokenSegments = config.dialogueOnly ? segments.filter((segment) => segment.kind === "dialogue") : segments;

  return spokenSegments.flatMap<TTSVoiceRequest>((segment, segmentIndex) => {
    if (segment.kind === "narration") {
      const voice = resolveTTSNarratorVoice(config);
      if (config.source === "elevenlabs" && !voice) return [];
      return splitTTSChunks(cleanTTSInputText(segment.text)).map((text) => ({
        text,
        speaker: "Narrator",
        voice,
      }));
    }

    const speaker = segment.speaker || fallbackSpeaker || undefined;
    const speakerKey = normalizeTTSCharacterName(speaker);
    const characterId = speaker
      ? (resolveCharacterIdForSpeaker?.(speaker) ??
        (speakerKey && speakerKey === fallbackSpeakerKey ? fallbackCharacterId : undefined))
      : fallbackCharacterId;
    // A configured character voice always wins. If per-character routing cannot
    // find one, let the enabled NPC pool provide a stable fallback for that
    // speaker, including known chat characters without an assignment.
    const npcFallbackHint = !characterId || config.voiceMode === "per-character" ? { name: speaker ?? "" } : null;
    const voice = resolveTTSVoiceForSpeaker(config, speaker, characterId, npcFallbackHint);
    if (config.source === "elevenlabs" && !voice) return [];

    const chunks = splitTTSChunks(segment.text, { preserveEmotionIndicators: true });
    return chunks.map((text, chunkIndex) => ({
      text,
      speaker,
      voice,
      ...(config.dialogueOnly &&
      segmentIndex < spokenSegments.length - 1 &&
      chunkIndex === chunks.length - 1 &&
      config.dialoguePauseMs > 0
        ? { pauseAfterMs: config.dialoguePauseMs }
        : {}),
    }));
  });
}
