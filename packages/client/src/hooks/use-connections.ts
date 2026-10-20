import { useTranslation } from "react-i18next";
import { showConfirmDialog } from "../lib/app-dialogs";
// ──────────────────────────────────────────────
// React Query: Connection hooks
// ──────────────────────────────────────────────
import {
  DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY,
  OUTSIDE_READS_SETTINGS_KEY,
  connectionSavesModelList,
  MAX_PINNED_MODELS,
  parsePinnedModels,
  type ConnectionBilling,
  type ModelParameterCapabilities,
  type PlanUsage,
} from "@marinara-engine/shared";
import type { RemoteConnectionModel } from "../lib/connection-model-selection";
import { queryOptions, skipToken, useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ApiError, api, isRequestTimeoutError, requestTimeoutSignal } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";
import { useChatStore } from "../stores/chat.store";
import { captureChatMetadataVersion, chatKeys, guardServerChatSnapshot } from "./use-chats";
import { connectionAccountKeys } from "./use-connection-accounts";
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
  defaultEmbedding: () => [...connectionKeys.all, "default-embedding"] as const,
};

const DEFAULT_EMBEDDING_PATH = `/app-settings/${DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY}`;

/** Connection defaults > Embeddings: a connection id, the local sidecar id, or null. */
export function useDefaultEmbeddingConnection() {
  return useQuery({
    queryKey: connectionKeys.defaultEmbedding(),
    queryFn: () => api.get<{ connectionId: string | null }>(DEFAULT_EMBEDDING_PATH),
    staleTime: 5 * 60_000,
  });
}

export function useSetDefaultEmbeddingConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string | null) =>
      api.put<{ connectionId: string | null }>(DEFAULT_EMBEDDING_PATH, { connectionId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionKeys.defaultEmbedding() }),
  });
}

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

/** The connection list, for `useConnections` and for callers that must wait until it has loaded. */
export const connectionListQuery = queryOptions({
  queryKey: connectionKeys.list(),
  // Deadline so a frozen host cannot leave isLoading true forever — this
  // query gates the Support Diagnostics copy button alongside health (#5657).
  queryFn: ({ signal }) => api.get<unknown[]>("/connections", { signal: requestTimeoutSignal(10_000, signal) }),
  staleTime: 5 * 60_000,
  retry: (failureCount, error) => !isRequestTimeoutError(error) && failureCount < 1,
});

export function useConnections() {
  return useQuery(connectionListQuery);
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
  videoPromptInstructions?: string | null;
  audioSource?: string | null;
  decisionSource?: DecisionSource | null;
  credentialsFromConnectionId?: string | null;
  maxStateTokens?: number | null;
  decisionTimeoutMs?: number | null;
  audioVoice?: string | null;
  audioTimeoutMs?: number | null;
  audioSoundEffects?: boolean;
  audioMusic?: boolean;
  promptPresetId?: string | null;
  maxTokensOverride?: number | null;
  imageInput?: "reads" | "text" | null;
  maxParallelJobs?: number;
  maxRequestsPerMinute?: number | null;
  treatAsLocalEndpoint?: boolean;
  claudeFastMode?: boolean;
  /** Join this Connection: the Model takes its credentials (server-side). */
  accountId?: string | null;
};

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateConnectionPayload) => api.post("/connections", data),
    // The server links a new Model to its Connection, so the account list changes too.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: connectionKeys.list() }),
        qc.invalidateQueries({ queryKey: connectionAccountKeys.all }),
      ]),
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
        qc.invalidateQueries({ queryKey: connectionAccountKeys.all }),
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
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: connectionKeys.list() }),
        qc.invalidateQueries({ queryKey: connectionAccountKeys.all }),
      ]),
  });
}

/** "Move to connection…": the Model keeps its id and takes the target Connection's key and catalog. */
export function useMoveConnection() {
  const qc = useQueryClient();
  return useMutation({
    // `model` is the target catalog's id on a move to another service.
    mutationFn: ({ id, accountId, model }: { id: string; accountId: string; model?: string }) =>
      api.post(`/connections/${id}/move`, { accountId, ...(model ? { model } : {}) }),
    onSuccess: (_data, variables) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: connectionKeys.list() }),
        qc.invalidateQueries({ queryKey: connectionKeys.detail(variables.id) }),
        qc.invalidateQueries({ queryKey: connectionKeys.models(variables.id) }),
        qc.invalidateQueries({ queryKey: connectionAccountKeys.all }),
        // A move to another service changes the model id that chats show for this Model.
        qc.invalidateQueries({ queryKey: chatKeys.list() }),
        qc.invalidateQueries({ queryKey: [...chatKeys.all, "detail"] }),
      ]),
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
      qc.invalidateQueries({ queryKey: connectionAccountKeys.all });
      // Deleting the default embedding connection clears that default on the server.
      qc.invalidateQueries({ queryKey: connectionKeys.defaultEmbedding() });
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

/** Record a failed connection check so the omnibar can answer "fix this". */
function recordConnectionFailure(id: string, action: string, error: unknown) {
  useUIStore.getState().setLastAppError({
    message: error instanceof Error ? error.message : String(error),
    action,
    retry: { kind: "open-connection", id },
  });
}

/** A Model id, or one with a key or address typed in an editor but not saved yet. */
type TestInput = string | { id: string; apiKey?: string; baseUrl?: string };
const testId = (input: TestInput) => (typeof input === "string" ? input : input.id);

export function useTestConnection() {
  return useMutation({
    mutationFn: (input: TestInput) => {
      const { id, ...draft } = typeof input === "string" ? { id: input } : input;
      return api.post<ConnectionTestResult>(`/connections/${id}/test`, {
        debugMode: useUIStore.getState().debugMode,
        ...draft,
      });
    },
    onError: (error, input) => recordConnectionFailure(testId(input), "Test connection", error),
    // A failed check still answers 200 with `success: false`.
    onSuccess: (result, input) =>
      result.success
        ? useUIStore.getState().setLastAppError(null)
        : recordConnectionFailure(testId(input), "Test connection", result.message),
  });
}

export function useTestMessage() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ success: boolean; response: string; latencyMs: number; error?: string }>(
        `/connections/${id}/test-message`,
        { debugMode: useUIStore.getState().debugMode },
      ),
    onError: (error, id) => recordConnectionFailure(id, "Send test message", error),
    onSuccess: (result, id) =>
      result.success
        ? useUIStore.getState().setLastAppError(null)
        : recordConnectionFailure(id, "Send test message", result.error ?? "Unknown error"),
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
  /** "plan" or "free" when one word says how the whole Connection is paid for. */
  billing?: ConnectionBilling;
};

/** What the cached catalogs say about one model: its cost badge and price, whether it is retiring, what it reads. */
export type CachedModelFacts = Pick<
  RemoteConnectionModel,
  "cost" | "pricing" | "deprecated" | "retiresAt" | "inputModalities"
>;

export type CachedCatalogFacts = {
  of: (modelId: string | null | undefined) => CachedModelFacts | undefined;
  /** The catalog mixes models in the plan with paid ones (NanoGPT), so "Paid" says something. */
  showPaid: boolean;
  /** Models in the cached catalogs; undefined while none is cached. */
  count?: number;
};

type CatalogIndex = { byId: Map<string, CachedModelFacts>; ids: Set<string>; showPaid: boolean };
const catalogIndexes = new WeakMap<ConnectionModelList, CatalogIndex>();

/** One catalog's facts, indexed once per fetched list. */
function indexCatalog(list: ConnectionModelList): CatalogIndex {
  let index = catalogIndexes.get(list);
  if (index) return index;
  index = { byId: new Map(), ids: new Set(), showPaid: false };
  for (const model of list.models ?? []) {
    index.ids.add(model.id);
    if (model.cost === "included" || model.cost?.startsWith("multiplier:")) index.showPaid = true;
    if (model.cost || model.deprecated || model.retiresAt || model.inputModalities?.length) {
      index.byId.set(model.id, {
        cost: model.cost,
        pricing: model.pricing,
        deprecated: model.deprecated,
        retiresAt: model.retiresAt,
        inputModalities: model.inputModalities,
      });
    }
  }
  catalogIndexes.set(list, index);
  return index;
}

/**
 * Cost and retirement facts from the model catalogs, one result per group of Connection ids (a card's Models).
 * It shares the pickers' query keys. Each group loads one saved list (its first Model whose provider keeps one;
 * a Connection's Models share it), which the server answers without asking the provider; the rest read the cache.
 */
export function useCachedCatalogFacts(groups: ReadonlyArray<readonly string[]>): CachedCatalogFacts[] {
  const ids = [...new Set(groups.flat())];
  const { data: connections } = useConnections();
  const providerOf = new Map(
    ((connections ?? []) as Array<{ id: string; provider: string }>).map((row) => [row.id, row.provider]),
  );
  const loaded = new Set(
    groups.flatMap((group) => {
      const id = group.find((entry) => connectionSavesModelList(providerOf.get(entry) ?? "image_generation"));
      return id ? [id] : [];
    }),
  );
  const results = useQueries({
    queries: ids.map((id) =>
      loaded.has(id)
        ? {
            queryKey: connectionKeys.models(id),
            queryFn: () => api.get<ConnectionModelList>(connectionModelsPath(id)),
            staleTime: MODEL_LIST_TTL,
            gcTime: MODEL_LIST_TTL,
            retry: false,
            retryOnMount: false,
          }
        : { queryKey: connectionKeys.models(id), queryFn: skipToken },
    ),
  });
  const indexById = new Map(
    ids.flatMap((id, i) => {
      const data = results[i]?.data as ConnectionModelList | undefined;
      return data ? [[id, indexCatalog(data)] as const] : [];
    }),
  );
  return groups.map((group) => {
    const indexes = group.flatMap((id) => indexById.get(id) ?? []);
    return {
      of: (modelId) => {
        if (!modelId) return undefined;
        for (const index of indexes) {
          const facts = index.byId.get(modelId);
          if (facts) return facts;
        }
        return undefined;
      },
      showPaid: indexes.some((index) => index.showPaid),
      count: indexes.length ? new Set(indexes.flatMap((index) => [...index.ids])).size : undefined,
    };
  });
}

/**
 * The one yes for outside reads on Connections: NanoGPT plan badges, public price lists and balance reads.
 * "on", "off", or null while the user has not chosen (null reads as off). Asking names every site the server
 * reads; a choice reloads the model lists and the balances.
 */
export function useOutsideReads() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const path = `/app-settings/${OUTSIDE_READS_SETTINGS_KEY}`;
  const queryKey = [...connectionKeys.all, "setting", OUTSIDE_READS_SETTINGS_KEY];
  const query = useQuery({
    queryKey,
    queryFn: async () => (await api.get<{ value: string | null }>(path)).value,
    staleTime: Infinity,
  });
  const save = useMutation({
    mutationFn: (value: "on" | "off") => api.put(path, { value }),
    onSuccess: (_data, value) => {
      qc.setQueryData(queryKey, value);
      void qc.invalidateQueries({ queryKey: [...connectionKeys.all, "models"] });
      void qc.invalidateQueries({ queryKey: connectionAccountKeys.all });
    },
  });
  const ask = async () => {
    const allowed = await showConfirmDialog({
      title: t("connections.outsideReads.title"),
      message: t("connections.outsideReads.message"),
      confirmLabel: t("connections.outsideReads.allow"),
      cancelLabel: t("connections.outsideReads.notNow"),
    });
    save.mutate(allowed ? "on" : "off");
  };
  return { value: query.isSuccess ? (query.data ?? null) : undefined, ask, turnOff: () => save.mutate("off") };
}

/** A model list stays fresh for six hours; Refresh asks sooner. */
const MODEL_LIST_TTL = 6 * 60 * 60_000;

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
    staleTime: MODEL_LIST_TTL,
    gcTime: MODEL_LIST_TTL,
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

export type SubscriptionUsage = NanoGptSubscriptionUsage | PlanUsage;

/** Whether a plan window is used up. On NanoGPT only the models in the plan stop; paid ones still run. */
export function usageAtLimit(usage: SubscriptionUsage | undefined): boolean {
  if (!usage) return false;
  const windows = "windows" in usage ? usage.windows : [usage.dailyInputTokens, usage.weeklyInputTokens];
  return windows.some((window) => (window?.percentUsed ?? 0) >= 1);
}

/** Read a connection's subscription usage for the usage widget. */
export function useSubscriptionUsage(connectionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...connectionKeys.detail(connectionId ?? ""), "subscription-usage"],
    queryFn: () => api.get<SubscriptionUsage>(`/connections/${connectionId}/subscription-usage`),
    enabled: enabled && !!connectionId,
    // Quotas move slowly, NanoGPT and ChatGPT may rate limit reads, and a Claude
    // reading starts a Claude Code process on the host; keep it calm.
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

/** Upload a Connection's (account's) picture. Its icon and reset go through `useUpdateConnectionAccount` (`icon`). */
export function useUploadConnectionAccountImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, image }: { id: string; image: string }) =>
      api.post<Record<string, unknown>>(`/connection-accounts/${id}/image`, { image }),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionAccountKeys.all }),
  });
}
