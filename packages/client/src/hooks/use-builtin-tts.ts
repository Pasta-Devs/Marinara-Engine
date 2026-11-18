// ──────────────────────────────────────────────
// React Query: the built-in voice models (Kokoro-82M, Supertonic 3), run inside the Engine for the Voice job
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BuiltinTtsModelId,
  BuiltinTtsReadingLanguage,
  BuiltinTtsStatus,
  BuiltinTtsSupertonicLanguage,
} from "@marinara-engine/shared";
import { api, ApiError, getApiErrorMessage } from "../lib/api-client";

export const builtinTtsKey = ["builtin-tts", "status"] as const;
const BASE = "/builtin-tts";
const isLite = import.meta.env.VITE_MARINARA_LITE === "true";

/** Status; polled every second while a model downloads or loads. */
export function useBuiltinTts(enabled = true) {
  return useQuery({
    queryKey: builtinTtsKey,
    queryFn: () => api.get<BuiltinTtsStatus>(`${BASE}/status`),
    enabled: enabled && !isLite,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.download?.status === "downloading" || data?.loading) return 1_000;
      return data?.loaded ? 30_000 : false;
    },
  });
}

/** The model in use and its blends decide which voices the Voice job's pickers list. */
function settle(qc: ReturnType<typeof useQueryClient>, status?: BuiltinTtsStatus) {
  if (status) qc.setQueryData(builtinTtsKey, status);
  void qc.invalidateQueries({ queryKey: builtinTtsKey });
  void qc.invalidateQueries({ queryKey: ["tts", "voices"] });
}

function useBuiltinTtsAction<TInput>(run: (input: TInput) => Promise<BuiltinTtsStatus>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: run, onSuccess: (status) => settle(qc, status), onError: () => settle(qc) });
}

export const useDownloadBuiltinTts = () =>
  useBuiltinTtsAction((body: { modelId: BuiltinTtsModelId; use?: boolean }) =>
    api.post<BuiltinTtsStatus>(`${BASE}/download`, body),
  );
export const useCancelBuiltinTtsDownload = () =>
  useBuiltinTtsAction(() => api.post<BuiltinTtsStatus>(`${BASE}/download/cancel`, {}));
export const useUseBuiltinTtsModel = () =>
  useBuiltinTtsAction((modelId: BuiltinTtsModelId) => api.post<BuiltinTtsStatus>(`${BASE}/use`, { modelId }));
export const useSetBuiltinTtsSettings = () =>
  useBuiltinTtsAction(
    (settings: { language?: BuiltinTtsReadingLanguage; latinLanguage?: BuiltinTtsSupertonicLanguage }) =>
      api.patch<BuiltinTtsStatus>(`${BASE}/settings`, settings),
  );
export const useLoadBuiltinTts = () => useBuiltinTtsAction(() => api.post<BuiltinTtsStatus>(`${BASE}/load`, {}));
export const useUnloadBuiltinTts = () => useBuiltinTtsAction(() => api.post<BuiltinTtsStatus>(`${BASE}/unload`, {}));
export const useRemoveBuiltinTtsModel = () =>
  useBuiltinTtsAction((modelId: BuiltinTtsModelId) => api.post<BuiltinTtsStatus>(`${BASE}/remove`, { modelId }));
export const useSaveBuiltinTtsBlend = () =>
  useBuiltinTtsAction((blend: { name: string; voice: string }) => api.post<BuiltinTtsStatus>(`${BASE}/blends`, blend));
export const useDeleteBuiltinTtsBlend = () =>
  useBuiltinTtsAction((voice: string) => api.post<BuiltinTtsStatus>(`${BASE}/blends/delete`, { voice }));

/** One line in a voice or a blend, as a WAV blob. */
export async function previewBuiltinTts(voice: string, text: string, speed = 1): Promise<Blob> {
  const res = await api.raw(`${BASE}/preview`, { method: "POST", body: JSON.stringify({ voice, text, speed }) });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: unknown };
    throw new ApiError(res.status, getApiErrorMessage(body.error, res.statusText), body);
  }
  return res.blob();
}
