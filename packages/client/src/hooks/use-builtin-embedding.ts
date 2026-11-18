// ──────────────────────────────────────────────
// React Query: the built-in embedding model (its own llama-server for semantic search)
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BuiltinEmbeddingDevice, BuiltinEmbeddingModelId, BuiltinEmbeddingStatus } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { connectionKeys } from "./use-connections";

export const builtinEmbeddingKey = ["builtin-embedding", "status"] as const;
const BASE = "/builtin-embedding";
const isLite = import.meta.env.VITE_MARINARA_LITE === "true";

/** Status; polled while a download or a start is in progress, and now and then while it runs (memory, idle stop). */
export function useBuiltinEmbedding(enabled = true) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: builtinEmbeddingKey,
    queryFn: async () => {
      const before = qc.getQueryData<BuiltinEmbeddingStatus>(builtinEmbeddingKey);
      const status = await api.get<BuiltinEmbeddingStatus>(`${BASE}/status`);
      // A download that finishes on the server can make it the Embeddings default after the Download reply came back.
      if (before && before.activeModelId !== status.activeModelId) {
        void qc.invalidateQueries({ queryKey: connectionKeys.defaultEmbedding() });
      }
      return status;
    },
    enabled: enabled && !isLite,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.download?.status === "downloading" || data?.starting) return 1_000;
      return data?.running ? 15_000 : false;
    },
  });
}

/** Changing the model in use changes what Embeddings, Test embedding and the lorebook Vectorize report. */
function settle(qc: ReturnType<typeof useQueryClient>, status?: BuiltinEmbeddingStatus) {
  if (status) qc.setQueryData(builtinEmbeddingKey, status);
  void qc.invalidateQueries({ queryKey: builtinEmbeddingKey });
  void qc.invalidateQueries({ queryKey: connectionKeys.defaultEmbedding() });
}

function useBuiltinEmbeddingAction<TInput>(run: (input: TInput) => Promise<BuiltinEmbeddingStatus>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: run, onSuccess: (status) => settle(qc, status), onError: () => settle(qc) });
}

export const useDownloadBuiltinEmbedding = () =>
  useBuiltinEmbeddingAction((modelId: BuiltinEmbeddingModelId) =>
    api.post<BuiltinEmbeddingStatus>(`${BASE}/download`, { modelId }),
  );
export const useCancelBuiltinEmbeddingDownload = () =>
  useBuiltinEmbeddingAction(() => api.post<BuiltinEmbeddingStatus>(`${BASE}/download/cancel`, {}));
export const useUseBuiltinEmbeddingModel = () =>
  useBuiltinEmbeddingAction((modelId: BuiltinEmbeddingModelId) =>
    api.post<BuiltinEmbeddingStatus>(`${BASE}/use`, { modelId }),
  );
export const useLoadBuiltinEmbedding = () =>
  useBuiltinEmbeddingAction(() => api.post<BuiltinEmbeddingStatus>(`${BASE}/load`, {}));
export const useUnloadBuiltinEmbedding = () =>
  useBuiltinEmbeddingAction(() => api.post<BuiltinEmbeddingStatus>(`${BASE}/unload`, {}));
export const useRemoveBuiltinEmbeddingModel = () =>
  useBuiltinEmbeddingAction((modelId: BuiltinEmbeddingModelId) =>
    api.post<BuiltinEmbeddingStatus>(`${BASE}/remove`, { modelId }),
  );
export const useSetBuiltinEmbeddingDevice = () =>
  useBuiltinEmbeddingAction((device: BuiltinEmbeddingDevice) =>
    api.patch<BuiltinEmbeddingStatus>(`${BASE}/settings`, { device }),
  );
