// ──────────────────────────────────────────────
// Hooks: Agent Configs (React Query)
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createAgentConfigSchema, updateAgentConfigSchema } from "../../../../engine/contracts/schemas/agent.schema";
import { BUILT_IN_AGENTS, DEFAULT_AGENT_CREDIT } from "../../../../engine/contracts/types/agent";
import { agentApi } from "../../../../shared/api/agent-api";
import { storageApi } from "../../../../shared/api/storage-api";

export const agentKeys = {
  all: ["agents"] as const,
  customRuns: (chatId: string) => ["agents", "runs", "custom", chatId] as const,
};

export interface AgentConfigRow {
  id: string;
  type: string;
  name: string;
  description: string;
  credit?: string;
  phase: string;
  enabled?: boolean | number | string | null;
  connectionId: string | null;
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

const builtInAgentTypes = new Set(BUILT_IN_AGENTS.map((agent) => agent.id));

export function agentCreditLabel(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_AGENT_CREDIT;
}

export function agentConfigEnabled(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    if (!normalized) return fallback;
  }
  return fallback;
}

function normalizeAgentUpdatePayload(data: Record<string, unknown>): Record<string, unknown> {
  const nested = data.data;
  const patch =
    Object.keys(data).length === 1 && nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : data;
  return updateAgentConfigSchema.parse(patch);
}

export function useAgentConfigs(enabled = true) {
  return useQuery({
    queryKey: agentKeys.all,
    queryFn: () => storageApi.list<AgentConfigRow>("agents"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCustomAgentRuns(chatId: string | null, enabled = true) {
  return useQuery({
    queryKey: agentKeys.customRuns(chatId ?? ""),
    queryFn: async () =>
      (await storageApi.list<AgentRunRow>("agent-runs", { filters: { chatId } })).filter(
        (run) => !!run.agentType && !builtInAgentTypes.has(run.agentType),
      ),
    enabled: !!chatId && enabled,
    staleTime: 15_000,
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      storageApi.update("agents", id, normalizeAgentUpdatePayload(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useUpdateAgentByType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentType, ...data }: { agentType: string } & Record<string, unknown>) =>
      agentApi.patchByType(agentType, updateAgentConfigSchema.parse(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => storageApi.create("agents", createAgentConfigSchema.parse(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useUpdateAgentRunData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resultData }: { id: string; chatId: string; resultData: unknown }) =>
      storageApi.update("agent-runs", id, { resultData }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: agentKeys.customRuns(variables.chatId) });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("agents", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}
