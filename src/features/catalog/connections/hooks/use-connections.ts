// ──────────────────────────────────────────────
// React Query: Connection hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { connectionKeys } from "../query-keys";
import { storageApi } from "../../../../shared/api/storage-api";
import { invokeTauri } from "../../../../shared/api/tauri-client";
import type { ConnectionRow, ConnectionTestResult } from "../types";

export { connectionKeys } from "../query-keys";


export function useConnections(enabled = true) {
  return useQuery({
    queryKey: connectionKeys.list(),
    queryFn: () => storageApi.list<ConnectionRow>("connections"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useConnection(id: string | null) {
  return useQuery({
    queryKey: connectionKeys.detail(id ?? ""),
    queryFn: () => storageApi.get<Record<string, unknown>>("connections", id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      provider: string;
      apiKey: string;
      baseUrl?: string;
      model?: string;
      maxContext?: number;
    }) => storageApi.create("connections", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionKeys.list() }),
  });
}

export function useUpdateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      storageApi.update("connections", id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: connectionKeys.list() });
      qc.invalidateQueries({ queryKey: connectionKeys.detail(variables.id) });
    },
  });
}

export function useDuplicateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invokeTauri<ConnectionRow>("storage_duplicate", { entity: "connections", id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionKeys.list() }),
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("connections", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionKeys.list() }),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (id: string) => invokeTauri<ConnectionTestResult>("connection_test", { id }),
  });
}

export function useTestMessage() {
  return useMutation({
    mutationFn: (id: string) =>
      invokeTauri<{ success: boolean; response: string; latencyMs: number }>("connection_test_message", { id }),
  });
}

export function useTestImageGeneration() {
  return useMutation({
    mutationFn: (id: string) =>
      invokeTauri<{
        success: boolean;
        base64: string | null;
        mimeType: string | null;
        latencyMs: number;
        prompt: string;
        error?: string;
      }>("connection_test_image", { id }),
  });
}

export function useFetchModels() {
  return useMutation({
    mutationFn: (id: string) =>
      invokeTauri<{
        models: Array<{ id: string; name: string; fallback?: boolean; fromProvider?: boolean; providerError?: string }>;
        fromProvider: boolean;
        fallback?: boolean;
        providerError?: string;
        providerErrorCode?: string;
      }>("connection_models", { id }),
  });
}

export function useSaveConnectionDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: Record<string, unknown> | null }) =>
      invokeTauri("connection_save_default_parameters", { id, params }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: connectionKeys.list() });
      qc.invalidateQueries({ queryKey: connectionKeys.detail(variables.id) });
    },
  });
}
