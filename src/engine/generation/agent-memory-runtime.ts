import type { AgentResult } from "../contracts/types/agent";
import type { StorageGateway } from "../capabilities/storage";
import { normalizeSecretPlotSceneDirections, normalizeStringArray } from "./agent-normalizers";
import { isRecord, nowIso, readString, type JsonRecord } from "./runtime-records";

export async function loadAgentMemory(
  storage: StorageGateway,
  agentId: string,
  chatId: string,
): Promise<Record<string, unknown>> {
  const rows = await storage.list<JsonRecord>("agent-memory", { filters: { agentConfigId: agentId, chatId } });
  const memory: Record<string, unknown> = {};
  for (const row of rows) {
    if (readString(row.agentConfigId) !== agentId || readString(row.chatId) !== chatId) continue;
    const key = readString(row.key);
    if (!key) continue;
    memory[key] = parseMaybeJson(row.value);
  }
  return memory;
}

export function secretPlotStateFromMemory(memory: Record<string, unknown>): Record<string, unknown> | null {
  const state: Record<string, unknown> = {};
  if (memory.overarchingArc) state.overarchingArc = memory.overarchingArc;
  const sceneDirections = normalizeSecretPlotSceneDirections(memory.sceneDirections);
  if (sceneDirections.length > 0) state.sceneDirections = sceneDirections;
  if (memory.pacing) state.pacing = memory.pacing;
  const recentlyFulfilled = normalizeStringArray(memory.recentlyFulfilled);
  if (recentlyFulfilled.length > 0) state.recentlyFulfilled = recentlyFulfilled;
  if (memory.staleDetected != null) state.staleDetected = memory.staleDetected;
  return Object.keys(state).length > 0 ? state : null;
}

export async function persistSecretPlotAgentMemory(
  storage: StorageGateway,
  chatId: string,
  results: AgentResult[],
): Promise<void> {
  const result = results.find((entry) => entry.success && entry.type === "secret_plot" && isRecord(entry.data));
  if (!result || !isRecord(result.data)) return;
  const agentConfigId = result.agentId;
  const data = result.data;

  if (data.overarchingArc) {
    await setAgentMemoryValue(storage, agentConfigId, chatId, "overarchingArc", data.overarchingArc);
  }

  if (data.sceneDirections !== undefined) {
    const allDirections = normalizeSecretPlotSceneDirections(data.sceneDirections);
    const active = allDirections.filter((direction) => !direction.fulfilled);
    const justFulfilled = allDirections.filter((direction) => direction.fulfilled).map((direction) => direction.direction);
    await setAgentMemoryValue(storage, agentConfigId, chatId, "sceneDirections", active);
    if (justFulfilled.length > 0) {
      const memory = await loadAgentMemory(storage, agentConfigId, chatId);
      const merged = [...normalizeStringArray(memory.recentlyFulfilled), ...justFulfilled].slice(-10);
      await setAgentMemoryValue(storage, agentConfigId, chatId, "recentlyFulfilled", merged);
    }
  } else {
    await setAgentMemoryValue(storage, agentConfigId, chatId, "sceneDirections", []);
  }

  if (data.pacing) {
    await setAgentMemoryValue(storage, agentConfigId, chatId, "pacing", data.pacing);
  }
  await setAgentMemoryValue(storage, agentConfigId, chatId, "staleDetected", data.staleDetected ?? false);
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function setAgentMemoryValue(
  storage: StorageGateway,
  agentConfigId: string,
  chatId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const storedValue = typeof value === "string" ? value : JSON.stringify(value);
  const rows = await storage.list<JsonRecord>("agent-memory", { filters: { agentConfigId, chatId, key } });
  const existing = rows.find(
    (row) =>
      readString(row.agentConfigId) === agentConfigId &&
      readString(row.chatId) === chatId &&
      readString(row.key) === key,
  );
  const updatedAt = nowIso();
  if (existing) {
    const id = readString(existing.id).trim();
    if (id) await storage.update("agent-memory", id, { value: storedValue, updatedAt });
    return;
  }
  await storage.create("agent-memory", {
    agentConfigId,
    chatId,
    key,
    value: storedValue,
    updatedAt,
  });
}
