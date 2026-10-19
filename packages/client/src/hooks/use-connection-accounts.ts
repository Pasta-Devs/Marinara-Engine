// ──────────────────────────────────────────────
// React Query: Connection (account) hooks, the quick-switch pick and the global feature Models
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY,
  LOCAL_SIDECAR_CONNECTION_ID,
  type ConnectionAccountListItem,
  type CreateConnectionAccountInput,
  type FeatureModelConnections,
  type UpdateConnectionAccountInput,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { translate } from "../localization/i18n";
import { clearStagedFeatureModels, readStagedFeatureModels } from "../lib/legacy-feature-models";
import { connectionKeys } from "./use-connections";

export const connectionAccountKeys = {
  all: ["connection-accounts"] as const,
  list: () => [...connectionAccountKeys.all, "list"] as const,
  catalog: (query: string, limit: number) => [...connectionAccountKeys.all, "catalog", query, limit] as const,
  featureModels: () => [...connectionKeys.all, "feature-models"] as const,
};

const FEATURE_MODELS_PATH = `/app-settings/${FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY}`;

export type CatalogSearchHit = { accountId: string; provider: string; model: string; name: string };

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

/** "Move to a new connection": a copy of the Connection (same key, address and limits) takes the Model. */
export function useSplitModel() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: ({ accountId, ...body }: { accountId: string; connectionId: string; name: string }) =>
      api.post<{ account: ConnectionAccountListItem }>(`/connection-accounts/${accountId}/split`, body),
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

/** Sends only the changed fields; the server merges them, so concurrent edits of different fields both stay. */
export function useSetFeatureModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<FeatureModelConnections>) =>
      api.put<FeatureModelConnections>(FEATURE_MODELS_PATH, input),
    onSuccess: (saved) => qc.setQueryData(connectionAccountKeys.featureModels(), saved),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : translate("connections.defaults.saveFailed")),
  });
}

/**
 * One-shot: copies the browser's old feature picks (staged by the ui.store migration) to the server, but only
 * where the server still holds its default. The server stores unknown ids as null. Mount once near the app root.
 */
export function useMigrateFeatureModels() {
  const { data: server } = useFeatureModels();
  const setFeatureModels = useSetFeatureModels();
  useEffect(() => {
    if (!server) return;
    const staged = readStagedFeatureModels();
    if (!staged) return;
    const changes: Partial<FeatureModelConnections> = {};
    if (!server.mariConnectionId && staged.mariConnectionId) changes.mariConnectionId = staged.mariConnectionId;
    if (server.omnibarAsideConnectionId === LOCAL_SIDECAR_CONNECTION_ID && staged.omnibarAsideConnectionId) {
      changes.omnibarAsideConnectionId = staged.omnibarAsideConnectionId;
    }
    if (!server.impersonateConnectionId && staged.impersonateConnectionId) {
      changes.impersonateConnectionId = staged.impersonateConnectionId;
    }
    if (!Object.keys(changes).length) {
      clearStagedFeatureModels();
      return;
    }
    // Keep the staged picks until the server has them, so a failed request retries on the next load.
    setFeatureModels.mutate(changes, { onSuccess: clearStagedFeatureModels });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per loaded server value
  }, [server]);
}

/** Removes a saved Model's star (decision 30); `removable` says nothing else keeps the Model. */
export function useUnstarModel() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: ({ accountId, connectionId }: { accountId: string; connectionId: string }) =>
      api.post<{ removable: boolean; reason: ModelKeepReason | null }>(
        `/connection-accounts/${accountId}/models/${connectionId}/unstar`,
        {},
      ),
    onSuccess: invalidate,
  });
}

export type ModelKeepReason = "starred" | "role" | "settings" | "in_use" | "last" | "not_chat";

/** Removes an unstarred saved Model; the server keeps it when something still needs it. */
export function useRemoveUnstarredModel() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: ({ accountId, connectionId }: { accountId: string; connectionId: string }) =>
      api.delete(`/connection-accounts/${accountId}/models/${connectionId}`),
    onSettled: invalidate,
  });
}
