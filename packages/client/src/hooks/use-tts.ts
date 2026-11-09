// ──────────────────────────────────────────────
// Hook: TTS Config & Voices
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type {
  TTSConfig,
  TTSConfigResponse,
  TTSModelsResponse,
  TTSVoiceAssignmentInput,
  TTSVoiceModeInput,
  TTSVoicesResponse,
  TTSSource,
} from "@marinara-engine/shared";
import { TTS_API_KEY_MASK } from "@marinara-engine/shared";
import type { ConnectionModelRow } from "../lib/connection-groups";
import { voiceJobMigration, voiceRowOf } from "../lib/connection-jobs";
import { useConnections } from "./use-connections";

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
    // A character with a voice of its own always speaks with it; everyone else uses the default voice or pool.
    queryFn: () =>
      api
        .get<TTSConfigResponse>("/tts/config")
        .then((config): TTSConfigResponse => ({ ...config, voiceMode: "per-character" })),
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
    // The Voice job's switch is visible at once, so a card draft made before it is known to be out of date.
    onMutate: ({ enabled, source, connectionId }) =>
      qc.setQueryData<TTSConfigResponse>(KEYS.config, (old) => old && { ...old, enabled, source, connectionId }),
    onSuccess: () => invalidateTTSSettings(qc),
  });
}

/** Whether the Voice job turned voice on or off or moved its source or row after `draft` was made. */
export function useVoiceJobMoved() {
  const qc = useQueryClient();
  return useCallback(
    (draft: Pick<TTSConfig, "enabled" | "source" | "connectionId">) => {
      const live = qc.getQueryData<TTSConfigResponse>(KEYS.config);
      return (
        !!live &&
        (live.enabled !== draft.enabled || live.source !== draft.source || live.connectionId !== draft.connectionId)
      );
    },
    [qc],
  );
}

/**
 * The Voice job is the switch: a Model turns text to speech on with that Audio connection, a built-in `source`
 * (no connection) turns it on with that source, and `null` turns it off. The connection's own saved voices come
 * along. Returns an undo, or null when nothing changed.
 */
export function useFollowVoiceJob() {
  const { data: config } = useTTSConfig();
  const update = useUpdateTTSConfig();
  return async (connectionId: string | null, source?: TTSSource) => {
    if (!config) return null;
    const enabled = connectionId !== null || source !== undefined;
    const nextSource = source ?? config.source;
    if (config.enabled === enabled && config.connectionId === (connectionId ?? "") && config.source === nextSource) {
      return null;
    }
    // While a row is chosen the top-level voice fields are the row's, so leaving it loads the source's own.
    const leavesRow = !connectionId && Boolean(config.connectionId.trim());
    const profile = connectionId
      ? (config.connectionProfiles?.[connectionId] ?? { voice: "" })
      : nextSource !== config.source || leavesRow
        ? (config.sourceProfiles?.[nextSource] ?? { baseUrl: "", apiKey: "", model: "", voice: "" })
        : {};
    await update.mutateAsync({ ...config, ...profile, source: nextSource, connectionId: connectionId ?? "", enabled });
    return () => void update.mutateAsync(config).catch(() => {});
  };
}

/** Saves settings from before the Voice job once (`voiceJobMigration`), after they and the rows have loaded. */
export function useMigrateVoiceJob() {
  const { data: config } = useTTSConfig();
  const { data: rows } = useConnections();
  const update = useUpdateTTSConfig();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !config || !rows) return;
    const next = voiceJobMigration(config, rows as ConnectionModelRow[]);
    if (!next) return;
    done.current = true;
    update.mutate(next);
  }, [config, rows, update]);
}

/** The id of the audio row Text to speech really uses (`voiceRowOf`), for the Voice badge. */
export function useVoiceRowId() {
  const { data: tts } = useTTSConfig();
  const { data: rows } = useConnections();
  return voiceRowOf((rows ?? []) as ConnectionModelRow[], tts?.connectionId).row?.id ?? null;
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
