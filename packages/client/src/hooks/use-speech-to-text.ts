// ──────────────────────────────────────────────
// Hook: Speech to Text server settings
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TTS_API_KEY_MASK, type SpeechToTextConfig } from "@marinara-engine/shared";
import { api } from "../lib/api-client";

const KEYS = {
  config: ["speech-to-text", "config"] as const,
};

export function useSpeechToTextConfig(enabled = true) {
  return useQuery({
    queryKey: KEYS.config,
    queryFn: () => api.get<SpeechToTextConfig>("/speech-to-text/config"),
    staleTime: 60_000,
    enabled,
  });
}

export function useUpdateSpeechToTextConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: SpeechToTextConfig) => api.put<void>("/speech-to-text/config", config),
    // Cache the edit as it is sent: the card seeds its fields once, so on a phone, where closing
    // Connections unmounts it, reopening must not show the settings from before the last save.
    onMutate: async (config) => {
      await qc.cancelQueries({ queryKey: KEYS.config });
      const previous = qc.getQueryData<SpeechToTextConfig>(KEYS.config);
      qc.setQueryData<SpeechToTextConfig>(KEYS.config, {
        ...config,
        apiKey: config.apiKey ? TTS_API_KEY_MASK : "",
      });
      return { previous };
    },
    onError: (_error, _config, context) => qc.setQueryData(KEYS.config, context?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: KEYS.config }),
  });
}

/** Sends a short silent clip to the saved server; rejects with the server's reason when it does not answer. */
export function useTestSpeechToText() {
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>("/speech-to-text/test", {}),
  });
}
