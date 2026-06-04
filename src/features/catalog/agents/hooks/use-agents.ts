// ──────────────────────────────────────────────
// Hooks: Agent Configs (React Query)
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createAgentConfigSchema, updateAgentConfigSchema } from "../../../../engine/contracts/schemas/agent.schema";
import { BUILT_IN_AGENTS, DEFAULT_AGENT_CREDIT, type AgentResultType } from "../../../../engine/contracts/types/agent";
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
const agentResultTypeValues = [
  "game_state_update",
  "text_rewrite",
  "sprite_change",
  "echo_message",
  "quest_update",
  "image_prompt",
  "context_injection",
  "continuity_check",
  "director_event",
  "lorebook_update",
  "character_card_update",
  "prompt_review",
  "background_change",
  "character_tracker_update",
  "persona_stats_update",
  "custom_tracker_update",
  "chat_summary",
  "spotify_control",
  "haptic_command",
  "cyoa_choices",
  "secret_plot",
  "game_master_narration",
  "party_action",
  "game_map_update",
  "game_state_transition",
] satisfies AgentResultType[];
const agentResultTypes = new Set<string>(agentResultTypeValues);

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function parseStoredResultData(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function builtinAgentTypeFromConfigId(agentConfigId: string): string {
  return agentConfigId.startsWith("builtin:") ? agentConfigId.slice("builtin:".length).trim() : "";
}

function rawTypeLooksLikeAgentType(rawType: string, resultType: string): boolean {
  return !!rawType && rawType !== resultType && !agentResultTypes.has(rawType);
}

function normalizeAgentRunRow(
  raw: Record<string, unknown>,
  configsById: Map<string, AgentConfigRow>,
): AgentRunRow | null {
  const id = readString(raw.id);
  const agentConfigId = readString(raw.agentConfigId) || readString(raw.agent_config_id);
  const config = agentConfigId ? configsById.get(agentConfigId) : undefined;
  const resultType = readString(raw.resultType) || readString(raw.result_type);
  const rawType = readString(raw.type);
  const agentType =
    readString(raw.agentType) ||
    readString(raw.agent_type) ||
    readString(config?.type) ||
    builtinAgentTypeFromConfigId(agentConfigId) ||
    (rawTypeLooksLikeAgentType(rawType, resultType) ? rawType : "");
  const chatId = readString(raw.chatId) || readString(raw.chat_id);
  const messageId = readString(raw.messageId) || readString(raw.message_id);
  if (!id || !agentType || !chatId) return null;

  return {
    id,
    agentConfigId,
    agentType,
    agentName: readString(raw.agentName) || readString(config?.name) || agentType,
    chatId,
    messageId,
    resultType: resultType || agentType,
    resultData: parseStoredResultData(raw.resultData ?? raw.result_data),
    tokensUsed: readNumber(raw.tokensUsed ?? raw.tokens_used),
    durationMs: readNumber(raw.durationMs ?? raw.duration_ms),
    success: readBoolean(raw.success),
    error: readString(raw.error) || null,
    createdAt: readString(raw.createdAt) || readString(raw.created_at),
  };
}

export function agentCreditLabel(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_AGENT_CREDIT;
}

export function agentEnabledFlag(value: unknown, fallback = true): boolean {
  return readBoolean(value, fallback);
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
    queryFn: async () => {
      const [currentRuns, legacyRuns, configs] = await Promise.all([
        storageApi.list<Record<string, unknown>>("agent-runs", { filters: { chatId } }),
        storageApi.list<Record<string, unknown>>("agent-runs", { filters: { chat_id: chatId } }),
        storageApi.list<AgentConfigRow>("agents"),
      ]);
      const runsById = new Map<string, Record<string, unknown>>();
      let missingIdCount = 0;
      for (const run of [...currentRuns, ...legacyRuns]) {
        const id = readString(run.id);
        runsById.set(id || `__missing_agent_run_id__:${missingIdCount++}`, run);
      }
      if (missingIdCount > 0) {
        console.warn("[agents] Loaded agent run row(s) without ids.", { count: missingIdCount });
      }
      const configsById = new Map(configs.map((config) => [config.id, config]));
      return [...runsById.values()]
        .map((run) => normalizeAgentRunRow(run, configsById))
        .filter((run): run is AgentRunRow => !!run && !builtInAgentTypes.has(run.agentType));
    },
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

export function useSetAgentEnabledByType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentType, enabled }: { agentType: string; enabled: boolean }) =>
      agentApi.patchByType(agentType, { enabled }),
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
