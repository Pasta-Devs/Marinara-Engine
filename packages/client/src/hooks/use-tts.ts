// ──────────────────────────────────────────────
// Hook: TTS Config & Voices
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type {
  TTSConfig,
  TTSModelsResponse,
  TTSVoiceAssignmentInput,
  TTSVoiceModeInput,
  TTSVoicesResponse,
  TTSSource,
} from "@marinara-engine/shared";
import { TTS_API_KEY_MASK } from "@marinara-engine/shared";

const KEYS = {
  config: ["tts", "config"] as const,
  // The Audio connection ID keeps two connections on the same adapter and address apart.
  voices: (source: TTSSource, baseUrl: string, connectionId: string) =>
    ["tts", "voices", source, baseUrl, connectionId] as const,
  models: (source: TTSSource, baseUrl: string, connectionId: string) =>
    ["tts", "models", source, baseUrl, connectionId] as const,
};

// ── Config ───────────────────────────────────────

export function useTTSConfig() {
  return useQuery({
    queryKey: KEYS.config,
    queryFn: () => api.get<TTSConfig>("/tts/config"),
    staleTime: 60_000,
  });
}

function invalidateTTSSettings(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: KEYS.config });
  qc.invalidateQueries({ queryKey: ["tts", "voices"] });
  qc.invalidateQueries({ queryKey: ["tts", "models"] });
}

export function useUpdateTTSConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: TTSConfig) => api.put<void>("/tts/config", config),
    onSuccess: () => invalidateTTSSettings(qc),
  });
}

/** Sets or clears one character's voice on the server, leaving every other TTS setting as stored. */
export function useUpdateTTSVoiceAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TTSVoiceAssignmentInput) => api.put<void>("/tts/config/voice-assignment", input),
    onSuccess: () => invalidateTTSSettings(qc),
  });
}

/** Switches between one shared voice and a voice per character on the server, leaving every other TTS setting as stored. */
export function useUpdateTTSVoiceMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TTSVoiceModeInput) => api.put<void>("/tts/config/voice-mode", input),
    onSuccess: () => invalidateTTSSettings(qc),
  });
}

// ── Voices ───────────────────────────────────────

/** The voices of the card's saved choice: its source settings, or its Audio connection when `connectionId` is set. */
export function useTTSVoices(source: TTSSource, baseUrl: string, enabled: boolean, connectionId = "") {
  return useQuery({
    queryKey: KEYS.voices(source, baseUrl, connectionId),
    queryFn: () => api.get<TTSVoicesResponse>("/tts/voices"),
    enabled: enabled && Boolean(baseUrl),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useTTSModels(source: TTSSource, baseUrl: string, enabled: boolean, connectionId = "") {
  return useQuery({
    queryKey: KEYS.models(source, baseUrl, connectionId),
    queryFn: () => api.get<TTSModelsResponse>("/tts/models"),
    enabled: enabled && source === "elevenlabs" && Boolean(baseUrl),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

// ── Speak (fire-and-forget mutation used by tts-service) ─────────────────

export { TTS_API_KEY_MASK };
