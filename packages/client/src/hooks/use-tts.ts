// ──────────────────────────────────────────────
// Hook: TTS Config & Voices
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { TTSConfig, TTSModelsResponse, TTSVoicesResponse, TTSSource } from "@marinara-engine/shared";
import { TTS_API_KEY_MASK } from "@marinara-engine/shared";

const KEYS = {
  config: ["tts", "config"] as const,
  voices: (source: TTSSource, baseUrl: string, connectionId?: string) =>
    ["tts", "voices", source, baseUrl, connectionId ?? ""] as const,
  models: (source: TTSSource, baseUrl: string, connectionId?: string) =>
    ["tts", "models", source, baseUrl, connectionId ?? ""] as const,
};

// ── Config ───────────────────────────────────────

type TTSConfigResponse = TTSConfig & { legacyConfig?: TTSConfig };

export function useTTSConfig(legacy = false) {
  return useQuery({
    queryKey: KEYS.config,
    queryFn: () => api.get<TTSConfigResponse>("/tts/config"),
    select: (config) => (legacy ? (config.legacyConfig ?? config) : config),
    staleTime: 60_000,
  });
}

export function useUpdateTTSConfig() {
  const qc = useQueryClient();
  return useMutation({
    // Keep response metadata on read-modify-write saves so the server preserves
    // stored legacy identity while applying shared-setting changes.
    mutationFn: (config: TTSConfigResponse) => api.put<void>("/tts/config", config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.config });
      qc.invalidateQueries({ queryKey: ["tts", "voices"] });
      qc.invalidateQueries({ queryKey: ["tts", "models"] });
    },
  });
}

// ── Voices ───────────────────────────────────────

export function useTTSVoices(source: TTSSource, baseUrl: string, enabled: boolean, connectionId?: string) {
  const qc = useQueryClient();
  connectionId ??= qc.getQueryData<TTSConfigResponse>(KEYS.config)?.cacheConnectionId;
  return useQuery({
    queryKey: KEYS.voices(source, baseUrl, connectionId),
    queryFn: () =>
      api.get<TTSVoicesResponse>(
        connectionId ? `/tts/voices?connectionId=${encodeURIComponent(connectionId)}` : "/tts/voices",
      ),
    enabled: enabled && Boolean(baseUrl),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useTTSModels(source: TTSSource, baseUrl: string, enabled: boolean, connectionId?: string) {
  return useQuery({
    queryKey: KEYS.models(source, baseUrl, connectionId),
    queryFn: () =>
      api.get<TTSModelsResponse>(
        connectionId ? `/tts/models?connectionId=${encodeURIComponent(connectionId)}` : "/tts/models",
      ),
    enabled: enabled && source === "elevenlabs" && Boolean(baseUrl),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

// ── Speak (fire-and-forget mutation used by tts-service) ─────────────────

export { TTS_API_KEY_MASK };
