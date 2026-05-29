// ──────────────────────────────────────────────
// Hook: TTS Config & Voices
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ttsApi } from "../api/tts-api";
import type { TTSConfig, TTSSource } from "../../engine/contracts/types/tts";

const KEYS = {
  config: ["tts", "config"] as const,
  voices: (source: TTSSource, baseUrl: string) => ["tts", "voices", source, baseUrl] as const,
};

// ── Config ───────────────────────────────────────

export function useTTSConfig() {
  return useQuery({
    queryKey: KEYS.config,
    queryFn: () => ttsApi.config(),
    staleTime: 60_000,
  });
}

export function useUpdateTTSConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: TTSConfig) => ttsApi.updateConfig(config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.config });
      qc.invalidateQueries({ queryKey: ["tts", "voices"] });
    },
  });
}

// ── Voices ───────────────────────────────────────

export function useTTSVoices(source: TTSSource, baseUrl: string, enabled: boolean) {
  return useQuery({
    queryKey: KEYS.voices(source, baseUrl),
    queryFn: () => ttsApi.voices(),
    enabled: enabled && Boolean(baseUrl),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
