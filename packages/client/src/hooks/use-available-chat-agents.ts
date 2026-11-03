import { useMemo } from "react";
import {
  isAgentConfigDeleted,
  isAgentManifestAvailableInChatMode,
  isBuiltInAgentRuntimeDisabled,
  isRetiredBuiltInAgentId,
  normalizeAgentPhaseForType,
  type AgentPhase,
  type Chat,
  type ChatMode,
} from "@marinara-engine/shared";
import { useAgentConfigs, type AgentConfigRow } from "./use-agents";
import { useCapabilityAgentRegistry } from "./use-capability-packages";

export type AvailableAgent = {
  id: string;
  name: string;
  description: string;
  category: string;
  phase: AgentPhase;
  builtIn: boolean;
  runtimeDisabled?: boolean;
  execution?: "pipeline" | "feature" | "host";
};

export function getChatActiveAgentIds(chat: Chat): string[] {
  const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
  const activeIds =
    metadata && typeof metadata === "object" ? (metadata as { activeAgentIds?: unknown }).activeAgentIds : [];
  return Array.isArray(activeIds) ? activeIds.filter((id): id is string => typeof id === "string") : [];
}

/** Installed built-in agents the user deleted; a chat's stored helper list drops them on write. */
export function useDeletedBuiltInAgentTypes(): Set<string> {
  const { data: agentConfigs } = useAgentConfigs();
  const { data: installedAgentManifests = [] } = useCapabilityAgentRegistry();
  return useMemo(() => {
    const installed = new Set(installedAgentManifests.map((agent) => agent.id));
    return new Set(
      ((agentConfigs ?? []) as AgentConfigRow[])
        .filter((config) => installed.has(config.type) && isAgentConfigDeleted(config.settings))
        .map((config) => config.type),
    );
  }, [agentConfigs, installedAgentManifests]);
}

/** The helpers a chat of this mode can turn on, as Chat Settings and the setup stage list them. */
export function useAvailableChatAgents(chatMode: ChatMode): AvailableAgent[] {
  const { data: agentConfigs } = useAgentConfigs();
  const { data: installedAgentManifests = [] } = useCapabilityAgentRegistry();
  const agentConfigsByType = useMemo(() => {
    const map = new Map<string, AgentConfigRow>();
    for (const config of (agentConfigs ?? []) as AgentConfigRow[]) map.set(config.type, config);
    return map;
  }, [agentConfigs]);
  const installedAgentIds = useMemo(
    () => new Set(installedAgentManifests.map((agent) => agent.id)),
    [installedAgentManifests],
  );
  // Build the available agent list: built-in + custom agents from DB
  // Mode capabilities decide which built-ins are exposed for each chat mode.
  // Custom agents are user-authored and can be attached to any chat mode.
  return useMemo(() => {
    const agents: AvailableAgent[] = [];
    for (const a of installedAgentManifests) {
      if (a.libraryHidden) continue;
      if (!isAgentManifestAvailableInChatMode(chatMode, a)) continue;
      const existing = agentConfigsByType.get(a.id);
      if (existing && isAgentConfigDeleted(existing.settings)) continue;
      agents.push({
        id: a.id,
        name: a.name,
        description: existing?.description ?? a.description,
        category: a.category,
        phase: normalizeAgentPhaseForType(a.id, existing?.phase ?? a.phase),
        builtIn: true,
        runtimeDisabled: isBuiltInAgentRuntimeDisabled(a.id),
        execution: a.execution,
      });
    }
    // Custom agents from DB
    if (agentConfigs) {
      for (const c of agentConfigs as AgentConfigRow[]) {
        if (isAgentConfigDeleted(c.settings)) continue;
        if (isRetiredBuiltInAgentId(c.type)) continue;
        if (!installedAgentIds.has(c.type)) {
          agents.push({
            id: c.type,
            name: c.name,
            description: c.description,
            category: "custom",
            phase: normalizeAgentPhaseForType(c.type, c.phase),
            builtIn: false,
            runtimeDisabled: false,
            execution: "pipeline",
          });
        }
      }
    }
    return agents;
  }, [agentConfigs, agentConfigsByType, chatMode, installedAgentIds, installedAgentManifests]);
}
