// ──────────────────────────────────────────────
// React Query: Connection hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";
import { useChatStore } from "../stores/chat.store";
import { captureChatMetadataVersion, chatKeys, guardServerChatSnapshot } from "./use-chats";
import type { APIProvider, Chat, ConnectionTestResult, ImageGenerationQuality } from "@marinara-engine/shared";

export const connectionKeys = {
  all: ["connections"] as const,
  list: () => [...connectionKeys.all, "list"] as const,
  detail: (id: string) => [...connectionKeys.all, "detail", id] as const,
};

export function useConnections() {
  return useQuery({
    queryKey: connectionKeys.list(),
    queryFn: () => api.get<unknown[]>("/connections"),
    staleTime: 5 * 60_000,
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
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: connectionKeys.list() });
      qc.invalidateQueries({ queryKey: connectionKeys.detail(variables.id) });
    },
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
  return useMutation({
    mutationFn: (id: string) => api.delete(`/connections/${id}`),
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

export type RemoteConnectionModel = {
  id: string;
  name: string;
  context?: number;
  maxOutput?: number;
};

export function useFetchModels() {
  return useMutation({
    mutationFn: (id: string) =>
      api.get<{ models: RemoteConnectionModel[]; loras?: RemoteConnectionModel[] }>(`/connections/${id}/models`),
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
