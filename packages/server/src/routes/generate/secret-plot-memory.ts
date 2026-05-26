import { logger } from "../../lib/logger.js";
import { createAgentsStorage } from "../../services/storage/agents.storage.js";
import { normalizeSecretPlotSceneDirections, normalizeStringArray } from "./agent-normalizers.js";

type AgentsStore = ReturnType<typeof createAgentsStorage>;

export async function persistSecretPlotMemory(args: {
  agentsStore: AgentsStore;
  agentConfigId: string | null | undefined;
  chatId: string;
  plotData: Record<string, unknown>;
  preserveOverarchingArc?: boolean;
  clearMissingSceneDirections?: boolean;
  source: string;
}) {
  const {
    agentsStore,
    agentConfigId,
    chatId,
    plotData,
    preserveOverarchingArc = false,
    clearMissingSceneDirections = false,
    source,
  } = args;

  if (!agentConfigId) {
    logger.warn("[secret-plot-driver] Could not persist state from %s: missing agent config id", source);
    return;
  }

  let activeDirections = 0;
  if (!preserveOverarchingArc && plotData.overarchingArc !== undefined) {
    await agentsStore.setMemory(agentConfigId, chatId, "overarchingArc", plotData.overarchingArc ?? null);
  }

  if (plotData.sceneDirections !== undefined) {
    const allDirections = normalizeSecretPlotSceneDirections(plotData.sceneDirections);
    const active = allDirections.filter((direction) => !direction.fulfilled);
    const justFulfilled = allDirections.filter((direction) => direction.fulfilled).map((direction) => direction.direction);
    activeDirections = active.length;
    await agentsStore.setMemory(agentConfigId, chatId, "sceneDirections", active);

    if (justFulfilled.length > 0) {
      const mem = await agentsStore.getMemory(agentConfigId, chatId);
      const prev = normalizeStringArray(mem.recentlyFulfilled);
      await agentsStore.setMemory(agentConfigId, chatId, "recentlyFulfilled", [...prev, ...justFulfilled].slice(-10));
    }
  } else if (clearMissingSceneDirections) {
    await agentsStore.setMemory(agentConfigId, chatId, "sceneDirections", []);
  }

  if (plotData.pacing !== undefined) {
    await agentsStore.setMemory(agentConfigId, chatId, "pacing", plotData.pacing ?? null);
  }
  await agentsStore.setMemory(agentConfigId, chatId, "staleDetected", plotData.staleDetected === true);

  logger.info(
    "[secret-plot-driver] Persisted state from %s: arc=%s directions=%d pacing=%s",
    source,
    plotData.overarchingArc !== undefined && !preserveOverarchingArc ? "updated" : "unchanged",
    activeDirections,
    String(plotData.pacing ?? "unknown"),
  );
}
