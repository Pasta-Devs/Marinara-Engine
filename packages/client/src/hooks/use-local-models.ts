// ──────────────────────────────────────────────
// React Query: settings and status shared by every built-in model
// (unload when unused, memory warnings, how many replies at once)
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LocalModelSettings, LocalModelsStatus } from "@marinara-engine/shared";
import { api } from "../lib/api-client";

export const localModelsKey = ["local-models", "status"] as const;
const isLite = import.meta.env.VITE_MARINARA_LITE === "true";

export function useLocalModels(enabled = true) {
  return useQuery({
    queryKey: localModelsKey,
    queryFn: () => api.get<LocalModelsStatus>("/local-models"),
    enabled: enabled && !isLite,
    staleTime: 5_000,
    // Loaded, unloaded and memory warnings change on the server on their own.
    refetchInterval: 20_000,
  });
}

export function useUpdateLocalModelSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: LocalModelSettings) => api.patch<LocalModelsStatus>("/local-models/settings", patch),
    onSuccess: (status) => qc.setQueryData(localModelsKey, status),
  });
}
