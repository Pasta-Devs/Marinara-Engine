// ──────────────────────────────────────────────
// Hooks: Agent Configs (React Query)
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgentSuiteRewriteInput, CustomAgentImportPolicy, ImportAgentConfigInput } from "@marinara-engine/shared";
import { ApiError, api } from "../lib/api-client";

export const agentKeys = {
  all: ["agents"] as const,
  detail: (id: string) => ["agents", id] as const,
  customRuns: (chatId: string) => ["agents", "runs", "custom", chatId] as const,
  // SecretPlotPanel also uses agentKeys.memory() directly, so invalidations stay coherent.
  memory: (agentType: string, chatId: string) => ["agent-memory", agentType, chatId] as const,
  importPolicy: () => ["agents", "policy", "import"] as const,
};

export interface AgentConfigRow {
  id: string;
  type: string;
  name: string;
  description: string;
  phase: string;
  enabled: string;
  connectionId: string | null;
  imagePath: string | null;
  promptTemplate: string;
  settings: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRunRow {
  id: string;
  agentConfigId: string;
  agentType: string;
  agentName: string;
  chatId: string;
  messageId: string;
  resultType: string;
  resultData: unknown;
  tokensUsed: number;
  durationMs: number;
  success: boolean;
  error: string | null;
  createdAt: string;
}

function upsertAgentConfig(rows: AgentConfigRow[] | undefined, agent: AgentConfigRow) {
  if (!rows) return [agent];
  const existingIndex = rows.findIndex((row) => row.id === agent.id);
  if (existingIndex === -1) return [agent, ...rows];
  return rows.map((row) => (row.id === agent.id ? agent : row));
}

export function useAgentConfigs(enabled = true) {
  return useQuery({
    queryKey: agentKeys.all,
    queryFn: () => api.get<AgentConfigRow[]>("/agents"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useAgentImportPolicy() {
  return useQuery({
    queryKey: agentKeys.importPolicy(),
    queryFn: () => api.get<CustomAgentImportPolicy>("/agents/import-policy"),
    staleTime: 5_000,
  });
}

export function useSetAgentImportsEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => api.patch<CustomAgentImportPolicy>("/agents/import-policy", { enabled }),
    onSuccess: (policy) => {
      qc.setQueryData(agentKeys.importPolicy(), policy);
    },
  });
}

export function useImportAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportAgentConfigInput) => api.post<AgentConfigRow>("/agents/import", input),
    onSuccess: (agent) => {
      qc.setQueryData<AgentConfigRow[] | undefined>(agentKeys.all, (rows) => upsertAgentConfig(rows, agent));
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useCustomAgentRuns(chatId: string | null, enabled = true) {
  return useQuery({
    queryKey: agentKeys.customRuns(chatId ?? ""),
    queryFn: () => api.get<AgentRunRow[]>(`/agents/runs/${chatId}/custom`),
    enabled: !!chatId && enabled,
    staleTime: 15_000,
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => api.patch(`/agents/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

/** PATCH an agent by its type, creating the config row for a built-in that has
 *  never been configured. Used by bulk connection assignment (#5539). */
export function useUpdateAgentByType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentType, ...data }: { agentType: string } & Record<string, unknown>) =>
      api.patch(`/agents/type/${encodeURIComponent(agentType)}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useUploadAgentImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, image }: { id: string; image: string }) =>
      api.post<AgentConfigRow>(`/agents/${id}/image`, { image }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
      qc.invalidateQueries({ queryKey: agentKeys.detail(variables.id) });
    },
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<AgentConfigRow>("/agents", data),
    onSuccess: (agent) => {
      if (agent?.id) {
        qc.setQueryData(agentKeys.detail(agent.id), agent);
        qc.setQueryData<AgentConfigRow[] | undefined>(agentKeys.all, (rows) => upsertAgentConfig(rows, agent));
      }
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export interface AgentMemoryResponse {
  agentConfigId: string;
  memory: Record<string, unknown>;
}

export function useAgentMemory(agentType: string | null, chatId: string | null, enabled = true) {
  return useQuery({
    queryKey: agentKeys.memory(agentType ?? "", chatId ?? ""),
    queryFn: async (): Promise<AgentMemoryResponse> => {
      try {
        return await api.get<AgentMemoryResponse>(
          `/agents/memory/${encodeURIComponent(agentType ?? "")}/${encodeURIComponent(chatId ?? "")}`,
        );
      } catch (err) {
        // Agents without a saved config 404 here — that just means no stored memory.
        if (err instanceof ApiError && err.status === 404) {
          return { agentConfigId: "", memory: {} };
        }
        throw err;
      }
    },
    enabled: !!agentType && !!chatId && enabled,
    staleTime: 15_000,
  });
}

export function useUpdateAgentMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentType, chatId, patch }: { agentType: string; chatId: string; patch: Record<string, unknown> }) =>
      api.patch<AgentMemoryResponse>(`/agents/memory/${encodeURIComponent(agentType)}/${encodeURIComponent(chatId)}`, {
        patch,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: agentKeys.memory(variables.agentType, variables.chatId) });
    },
  });
}

export function useAgentSuiteRewrite() {
  return useMutation({
    mutationFn: (body: AgentSuiteRewriteInput) => api.post<{ rewrittenText: string }>("/agents/suite/rewrite", body),
  });
}

export function useUpdateAgentRunData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, chatId, resultData }: { id: string; chatId: string; resultData: unknown }) =>
      // chatId is the run's owning chat — the server uses it to scope the
      // run lookup to one chat's storage instead of loading every chat's (#5615).
      api.patch(`/agents/runs/${id}`, { resultData, chatId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: agentKeys.customRuns(variables.chatId) });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}
