import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EntitySummaryBatch, EntitySummaryBatchItemRef, EntitySummaryKind } from "@marinara-engine/shared";
import { api, ApiError } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";
import { characterKeys } from "./use-characters";
import { lorebookKeys } from "./use-lorebooks";

const STORAGE_KEY = "marinara-entity-summary-batch";

export interface EntitySummaryBatchReference {
  batchId: string;
  names: Record<string, string>;
}

export const entitySummaryBatchKeys = {
  all: ["entity-summary-batches"] as const,
  detail: (batchId: string) => [...entitySummaryBatchKeys.all, batchId] as const,
};

function readStoredReference(): EntitySummaryBatchReference | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (typeof record.batchId !== "string" || !record.batchId) return null;
    const names = record.names && typeof record.names === "object" ? (record.names as Record<string, string>) : {};
    return { batchId: record.batchId, names };
  } catch {
    return null;
  }
}

export function getStoredEntitySummaryBatch() {
  return readStoredReference();
}

export function storeEntitySummaryBatch(reference: EntitySummaryBatchReference) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reference));
}

export function clearStoredEntitySummaryBatch(batchId?: string) {
  const stored = readStoredReference();
  if (!batchId || stored?.batchId === batchId) window.localStorage.removeItem(STORAGE_KEY);
}

function invalidateAppliedEntity(qc: ReturnType<typeof useQueryClient>, kind: EntitySummaryKind, entityId: string) {
  if (kind === "character") {
    void qc.invalidateQueries({ queryKey: characterKeys.all });
    void qc.invalidateQueries({ queryKey: characterKeys.detail(entityId) });
  } else if (kind === "persona") {
    void qc.invalidateQueries({ queryKey: characterKeys.personas });
    void qc.invalidateQueries({ queryKey: characterKeys.personaDetail(entityId) });
  } else {
    void qc.invalidateQueries({ queryKey: lorebookKeys.all });
    void qc.invalidateQueries({ queryKey: lorebookKeys.detail(entityId) });
  }
}

export function useEntitySummaryBatch(batchId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: entitySummaryBatchKeys.detail(batchId ?? ""),
    queryFn: () => api.get<EntitySummaryBatch>(`/library/summarize/${batchId}/status`),
    enabled: !!batchId,
    staleTime: 1_000,
    refetchInterval: (current) => {
      const status = current.state.data?.status;
      return status === "queued" || status === "running" ? 5_000 : false;
    },
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 3,
  });

  useEffect(() => {
    if (!batchId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of api.streamEvents(
          `/library/summarize/${batchId}/events`,
          undefined,
          controller.signal,
          { method: "GET", disconnectOnResume: true },
        )) {
          if (event.type !== "batch" || !event.batch || typeof event.batch !== "object") continue;
          const batch = event.batch as EntitySummaryBatch;
          qc.setQueryData(entitySummaryBatchKeys.detail(batchId), batch);
          if (batch.status === "completed" || batch.status === "cancelled") return;
        }
      } catch {
        if (!controller.signal.aborted) void qc.invalidateQueries({ queryKey: entitySummaryBatchKeys.detail(batchId) });
      }
    })();
    return () => controller.abort();
  }, [batchId, qc]);

  return query;
}

export function useStartEntitySummaryBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ items }: { items: EntitySummaryBatchItemRef[]; names: Record<string, string> }) =>
      api.post<EntitySummaryBatch>("/library/summarize/start", {
        items,
        debugMode: useUIStore.getState().debugMode,
      }),
    onSuccess: (batch, variables) => {
      qc.setQueryData(entitySummaryBatchKeys.detail(batch.id), batch);
      storeEntitySummaryBatch({ batchId: batch.id, names: variables.names });
    },
  });
}

export function useRetryEntitySummaryBatchItem(batchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api.post<EntitySummaryBatch>(`/library/summarize/${batchId}/items/${itemId}/retry`, {}),
    onSuccess: (batch) => qc.setQueryData(entitySummaryBatchKeys.detail(batchId), batch),
  });
}

export function useCancelEntitySummaryBatch(batchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EntitySummaryBatch>(`/library/summarize/${batchId}/cancel`, {}),
    onSuccess: (batch) => qc.setQueryData(entitySummaryBatchKeys.detail(batchId), batch),
  });
}

export function useApplyEntitySummaryBatchItem(batchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string; kind: EntitySummaryKind; entityId: string }) =>
      api.post<EntitySummaryBatch>(`/library/summarize/${batchId}/items/${itemId}/apply`, {}),
    onSuccess: (batch, variables) => {
      qc.setQueryData(entitySummaryBatchKeys.detail(batchId), batch);
      invalidateAppliedEntity(qc, variables.kind, variables.entityId);
    },
  });
}
