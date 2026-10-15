// ──────────────────────────────────────────────
// React Query: Connection (account) hooks, the quick-switch pick and the global feature Models
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY,
  type ConnectionAccountListItem,
  type CreateConnectionAccountInput,
  type FeatureModelConnections,
  type UpdateConnectionAccountInput,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { connectionKeys } from "./use-connections";

export const connectionAccountKeys = {
  all: ["connection-accounts"] as const,
  list: () => [...connectionAccountKeys.all, "list"] as const,
  catalog: (query: string, limit: number) => [...connectionAccountKeys.all, "catalog", query, limit] as const,
  featureModels: () => [...connectionKeys.all, "feature-models"] as const,
};

const FEATURE_MODELS_PATH = `/app-settings/${FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY}`;

export type CatalogSearchHit = { accountId: string; model: string; name: string };

export function useConnectionAccounts() {
  return useQuery({
    queryKey: connectionAccountKeys.list(),
    queryFn: () => api.get<ConnectionAccountListItem[]>("/connection-accounts"),
    staleTime: 5 * 60_000,
  });
}

/** Account edits write through to Model rows, so both key families reload. */
function useInvalidateConnections() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: connectionAccountKeys.all }),
      qc.invalidateQueries({ queryKey: connectionKeys.all }),
    ]);
}

export function useCreateConnectionAccount() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: (
      input: Partial<CreateConnectionAccountInput> &
        Pick<CreateConnectionAccountInput, "provider"> & { model?: string },
    ) => api.post<{ account: ConnectionAccountListItem; connectionId: string }>("/connection-accounts", input),
    onSuccess: invalidate,
  });
}

export function useUpdateConnectionAccount() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateConnectionAccountInput & { id: string }) =>
      api.patch<ConnectionAccountListItem>(`/connection-accounts/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteConnectionAccount() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/connection-accounts/${id}`),
    onSuccess: invalidate,
  });
}

/** Finds or creates the Model for `model` under a Connection and returns its id. */
export function usePickModel() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: ({
      accountId,
      ...body
    }: {
      accountId: string;
      model: string;
      name?: string;
      maxContext?: number;
      maxTokensOverride?: number;
    }) => api.post<{ connectionId: string }>(`/connection-accounts/${accountId}/for-model`, body),
    onSuccess: invalidate,
  });
}

/** Saved model lists of every enabled Connection; no provider calls. */
export function useCatalogSearch(query: string, limit = 30) {
  const q = query.trim();
  return useQuery({
    queryKey: connectionAccountKeys.catalog(q, limit),
    queryFn: () =>
      api.get<CatalogSearchHit[]>(`/connection-accounts/catalog-search?q=${encodeURIComponent(q)}&limit=${limit}`),
    enabled: q.length > 0,
    staleTime: 30_000,
  });
}

export function useFeatureModels() {
  return useQuery({
    queryKey: connectionAccountKeys.featureModels(),
    queryFn: () => api.get<FeatureModelConnections>(FEATURE_MODELS_PATH),
    staleTime: 5 * 60_000,
  });
}

export function useSetFeatureModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FeatureModelConnections) => api.put<FeatureModelConnections>(FEATURE_MODELS_PATH, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionAccountKeys.featureModels() }),
  });
}
