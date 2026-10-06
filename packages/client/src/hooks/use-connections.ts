import { useTranslation } from "react-i18next";
import { showConfirmDialog } from "../lib/app-dialogs";
// ──────────────────────────────────────────────
// React Query: Connection hooks
// ──────────────────────────────────────────────
import { MAX_PINNED_MODELS, parsePinnedModels, type ModelParameterCapabilities } from "@marinara-engine/shared";
import type { RemoteConnectionModel } from "../lib/connection-model-selection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ApiError, api, isRequestTimeoutError, requestTimeoutSignal } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";
import { useChatStore } from "../stores/chat.store";
import { captureChatMetadataVersion, chatKeys, guardServerChatSnapshot } from "./use-chats";
import type {
  APIProvider,
  Chat,
  ConnectionTestResult,
  DecisionSource,
  ImageGenerationQuality,
} from "@marinara-engine/shared";

export const connectionKeys = {
  all: ["connections"] as const,
  list: () => [...connectionKeys.all, "list"] as const,
  detail: (id: string) => [...connectionKeys.all, "detail", id] as const,
  /** Invalidated with every connection save, so a new key or address reloads the list. */
  models: (id: string) => [...connectionKeys.all, "models", id] as const,
};

/** Refresh once per page load, keeping startup and the saved connection usable if a backend is offline. */
export function useRefreshLocalContext() {
  const qc = useQueryClient();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void api
      .post<{ updated: string[] }>("/connections/refresh-local-context", {})
      .then(({ updated }) => {
        if (!updated.length) return;
        void qc.invalidateQueries({ queryKey: connectionKeys.list() });
        for (const id of updated) void qc.invalidateQueries({ queryKey: connectionKeys.detail(id) });
      })
      .catch((error) => console.warn("Local context refresh failed", error));
  }, [qc]);
}

export function useConnections() {
  return useQuery({
    queryKey: connectionKeys.list(),
    // Deadline so a frozen host cannot leave isLoading true forever — this
    // query gates the Support Diagnostics copy button alongside health (#5657).
    queryFn: ({ signal }) => api.get<unknown[]>("/connections", { signal: requestTimeoutSignal(10_000, signal) }),
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => !isRequestTimeoutError(error) && failureCount < 1,
  });
}

export function useConnection(id: string | null) {
  return useQuery({
    queryKey: connectionKeys.detail(id ?? ""),
    queryFn: () => api.get<Record<string, unknown>>(`/connections/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export type CreateConnectionPayload = {
  name: string;
  provider: APIProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  pinnedModels?: string[];
  maxContext?: number;
  isDefault?: boolean;
  fallbackForMain?: boolean;
  useForRandom?: boolean;
  defaultForAgents?: boolean;
  fallbackForAgents?: boolean;
  enableCaching?: boolean;
  anthropicExtendedCacheTtl?: boolean;
  cachingAtDepth?: number;
  embeddingModel?: string;
  embeddingBaseUrl?: string;
  embeddingConnectionId?: string | null;
  openrouterProvider?: string | null;
  imageGenerationSource?: string | null;
  comfyuiWorkflow?: string | null;
  imageService?: string | null;
  imageEndpointId?: string | null;
  imagePromptInstructions?: string | null;
  imageGenerationQuality?: ImageGenerationQuality;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  audioSource?: string | null;
  decisionSource?: DecisionSource | null;
  credentialsFromConnectionId?: string | null;
  maxStateTokens?: number | null;
  decisionTimeoutMs?: number | null;
  audioVoice?: string | null;
  audioSoundEffects?: boolean;
  audioMusic?: boolean;
  promptPresetId?: string | null;
  maxTokensOverride?: number | null;
  maxParallelJobs?: number;
  maxRequestsPerMinute?: number | null;
  treatAsLocalEndpoint?: boolean;
  claudeFastMode?: boolean;
};

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateConnectionPayload) => api.post("/connections", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionKeys.list() }),
  });
}

export function useUpdateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => api.patch(`/connections/${id}`, data),
    // Auto-save before testing must finish refreshing the editor before a fast
    // test response arrives, otherwise hydration clears the new result.
    onSuccess: (_data, variables) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: connectionKeys.list() }),
        qc.invalidateQueries({ queryKey: connectionKeys.detail(variables.id) }),
        qc.invalidateQueries({ queryKey: connectionKeys.models(variables.id) }),
      ]),
  });
}

export function useUploadConnectionImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, image }: { id: string; image: string }) =>
      api.post<Record<string, unknown>>(`/connections/${id}/image`, { image }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: connectionKeys.list() });
      qc.invalidateQueries({ queryKey: connectionKeys.detail(variables.id) });
    },
  });
}

export function useDuplicateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/connections/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionKeys.list() }),
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const rows = await api.get<Array<{ name: string; credentialsFromConnectionId?: string | null }>>("/connections");
      const dependants = rows.filter((row) => row.credentialsFromConnectionId === id);
      if (
        dependants.length &&
        !(await showConfirmDialog({
          title: t("connections.decision.deleteTitle"),
          message: t("connections.decision.deleteWarning", { names: dependants.map((row) => row.name).join(", ") }),
          confirmLabel: t("connections.decision.deleteConfirm"),
          tone: "destructive",
        }))
      )
        throw new Error(t("connections.decision.deleteCancelled"));
      return api.delete(`/connections/${id}`);
    },
    onSuccess: async (_data, id) => {
      qc.invalidateQueries({ queryKey: connectionKeys.list() });
      const activeChatId = useChatStore.getState().activeChatId;
      if (!activeChatId) return;
      const activeChat = qc.getQueryData<Chat>(chatKeys.detail(activeChatId));
      if (activeChat?.connectionId !== id) return;
      try {
        const metadataVersion = captureChatMetadataVersion(activeChatId);
        const updated = await api.patch<Chat>(`/chats/${activeChatId}`, { connectionId: null });
        qc.setQueryData<Chat>(chatKeys.detail(activeChatId), guardServerChatSnapshot(qc, updated, metadataVersion));
        qc.invalidateQueries({ queryKey: chatKeys.list() });
      } catch {
        qc.invalidateQueries({ queryKey: chatKeys.detail(activeChatId) });
      }
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ConnectionTestResult>(`/connections/${id}/test`, { debugMode: useUIStore.getState().debugMode }),
  });
}

export function useTestMessage() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ success: boolean; response: string; latencyMs: number }>(`/connections/${id}/test-message`, {
        debugMode: useUIStore.getState().debugMode,
      }),
  });
}

export interface ClaudeSubscriptionDiagnosis {
  success: boolean;
  requestedModel: string;
  modelsBilled: string[];
  modelUsageDetail: Array<{ model: string; inputTokens: number; outputTokens: number }>;
  billedDifferent: boolean;
  fastModeState: "off" | "cooldown" | "on" | null;
  response: string;
  errors: string[];
  latencyMs: number;
}

export function useDiagnoseClaudeSubscription() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ClaudeSubscriptionDiagnosis>(`/connections/${id}/diagnose-claude-subscription`),
  });
}

export function useTestImageGeneration() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{
        success: boolean;
        base64: string | null;
        mimeType: string | null;
        latencyMs: number;
        prompt: string;
        error?: string;
      }>(`/connections/${id}/test-image`),
  });
}

export function useTestVideoGeneration() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{
        success: boolean;
        base64: string | null;
        mimeType: string | null;
        latencyMs: number;
        prompt: string;
        error?: string;
      }>(`/connections/${id}/test-video`),
  });
}

export type { RemoteConnectionModel };

/** A connection's model list; `fetchedAt` is set when the list is the one saved on the connection. */
export type ConnectionModelList = {
  models: RemoteConnectionModel[];
  loras?: RemoteConnectionModel[];
  fetchedAt?: string;
};

const connectionModelsPath = (id: string, refresh = false) =>
  `/connections/${encodeURIComponent(id)}/models${refresh ? "?refresh=true" : ""}`;

/** 409: the connection's provider, address or key changed while its list loaded, so that list is not kept. */
const isStaleModelList = (error: unknown) => error instanceof ApiError && error.status === 409;

/**
 * A connection's model list. The server answers from the list saved on the connection and asks the provider
 * only when nothing is saved yet, so opening a picker again costs no provider call. A failed load is not
 * retried each time a picker opens; Refresh asks again.
 */
export function useConnectionModels(id: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: connectionKeys.models(id ?? ""),
    queryFn: () => api.get<ConnectionModelList>(connectionModelsPath(id ?? "")),
    enabled: enabled && !!id && id !== "random",
    staleTime: 6 * 60 * 60_000,
    gcTime: 6 * 60 * 60_000,
    // A list that went stale while loading is asked for again once; other failures wait for Refresh.
    retry: (failureCount, error) => isStaleModelList(error) && failureCount < 1,
    retryOnMount: false,
  });
}

/** Fetch the provider's list again and replace the saved one. */
export function useRefreshConnectionModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.get<ConnectionModelList>(connectionModelsPath(id, true)),
    onSuccess: (data, id) => qc.setQueryData(connectionKeys.models(id), data),
    // A refresh made with settings that have since changed is not cached; load the list for the new ones.
    onError: (error, id) => {
      if (isStaleModelList(error)) void qc.invalidateQueries({ queryKey: connectionKeys.models(id) });
    },
  });
}

/** Pin or unpin a model on a connection. The pin shows at once and is undone if saving fails. */
export function useSetConnectionModelPinned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, model, pinned }: { id: string; model: string; pinned: boolean }) =>
      api.post<{ pinnedModels: string[] }>(`/connections/${encodeURIComponent(id)}/pinned-models`, { model, pinned }),
    onMutate: async ({ id, model, pinned }) => {
      await qc.cancelQueries({ queryKey: connectionKeys.list() });
      const previous = qc.getQueryData<unknown[]>(connectionKeys.list());
      qc.setQueryData<unknown[]>(connectionKeys.list(), (rows) =>
        rows?.map((row) => {
          const record = row as Record<string, unknown>;
          if (record.id !== id) return row;
          const current = parsePinnedModels(record.pinnedModels);
          const next = pinned
            ? current.includes(model)
              ? current
              : [...current, model].slice(0, MAX_PINNED_MODELS)
            : current.filter((entry) => entry !== model);
          return { ...record, pinnedModels: JSON.stringify(next) };
        }),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData(connectionKeys.list(), context.previous);
    },
    onSettled: (_data, _error, variables) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: connectionKeys.list() }),
        qc.invalidateQueries({ queryKey: connectionKeys.detail(variables.id) }),
      ]),
  });
}

/** Providers whose model list reports what each model accepts. Other providers get no background fetch. */
const LIVE_CAPABILITY_PROVIDERS = new Set(["openrouter"]);

/**
 * The selected model's live capabilities, for the parameter panel. Reads the connection's model list (the one saved
 * on the connection, fetched once when there is none) and only for providers that report capabilities. Returns null
 * while loading, on failure, or when the provider reports nothing, and the panel then falls back to its built-in rules.
 */
export function useModelParameterCapabilities(
  connection: { id?: string | null; provider?: string | null; model?: string | null } | null | undefined,
): ModelParameterCapabilities | null {
  const id = connection?.id ?? "";
  const provider = connection?.provider ?? "";
  const enabled = !!id && id !== "random" && LIVE_CAPABILITY_PROVIDERS.has(provider);
  const { data } = useConnectionModels(id, enabled);
  if (!enabled || !connection?.model) return null;
  return data?.models?.find((model) => model.id === connection.model)?.capabilities ?? null;
}

/** The editor's Fetch Models button: always asks the provider, and the result replaces the saved list. */
export function useFetchModels() {
  return useRefreshConnectionModels();
}

/** One NanoGPT quota window; counters are null when the lookup was unavailable. */
export type NanoGptQuotaWindow = {
  used: number | null;
  remaining: number | null;
  /** A fraction, not a percentage; may exceed 1. */
  percentUsed: number | null;
  /** UNIX epoch milliseconds. */
  resetAt: number | null;
  degraded: boolean;
};

export type NanoGptSubscriptionUsage = {
  active: boolean;
  state: string;
  limits: {
    dailyInputTokens: number | null;
    weeklyInputTokens: number | null;
    dailyImages: number | null;
  };
  dailyInputTokens: NanoGptQuotaWindow | null;
  weeklyInputTokens: NanoGptQuotaWindow | null;
  dailyImages: NanoGptQuotaWindow | null;
  currentPeriodEnd: string | null;
  credential: "management_token" | "api_key";
  /** Provider id the reading belongs to, so the meter is labelled from data. */
  provider: string;
};

/** Read the NanoGPT subscription quotas for the usage widget. */
export function useNanoGptSubscriptionUsage(connectionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...connectionKeys.detail(connectionId ?? ""), "subscription-usage"],
    queryFn: () => api.get<NanoGptSubscriptionUsage>(`/connections/${connectionId}/subscription-usage`),
    enabled: enabled && !!connectionId,
    // Quotas move slowly and NanoGPT may rate limit reads; keep it calm.
    staleTime: 60_000,
    retry: false,
  });
}

export function useSaveConnectionDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: Record<string, unknown> | null }) =>
      api.put(`/connections/${id}/default-parameters`, params),
    // Returning the promise makes mutateAsync wait for the refetches, so the
    // follow-up connection save cannot race in an older defaults snapshot.
    onSuccess: (_data, variables) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: connectionKeys.list() }),
        qc.invalidateQueries({ queryKey: connectionKeys.detail(variables.id) }),
      ]),
  });
}
