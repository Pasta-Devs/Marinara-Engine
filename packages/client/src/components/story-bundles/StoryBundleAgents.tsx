// ──────────────────────────────────────────────
// Story Bundle Agents Tab
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dices, Plus, Search, Sparkles, X } from "lucide-react";
import { useAgentConfigs, type AgentConfigRow } from "../../hooks/use-agents";
import { useCapabilityAgentRegistry } from "../../hooks/use-capability-packages";
import {
  isAgentConfigDeleted,
  isAgentManifestAvailableInChatMode,
  isBuiltInAgentRuntimeDisabled,
  isRetiredBuiltInAgentId,
  normalizeAgentPhaseForType,
  type AgentPhase,
  type ChatMode,
} from "@marinara-engine/shared";

const AGENT_PICKER_PAGE_SIZE = 20;

/** A selectable agent, mirroring the RP wizard's `AvailableAgent` shape. */
interface AvailableAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  phase: AgentPhase;
  builtIn: boolean;
  runtimeDisabled?: boolean;
  execution?: "pipeline" | "feature" | "host";
}

export interface StoryBundleAgentsProps {
  agentIds: string[];
  onAgentIdsChange: (ids: string[]) => void;
}

function getAgentCategoryLabel(agent: AvailableAgent): string {
  return agent.category ?? "misc";
}

export function StoryBundleAgents({ agentIds, onAgentIdsChange }: StoryBundleAgentsProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [agentPickerLimit, setAgentPickerLimit] = useState(AGENT_PICKER_PAGE_SIZE);

  const { data: agentConfigs, isLoading: agentConfigsLoading } = useAgentConfigs();
  const { data: installedAgentManifests = [], isLoading: installedAgentsLoading } = useCapabilityAgentRegistry();

  useEffect(() => {
    setAgentPickerLimit(AGENT_PICKER_PAGE_SIZE);
  }, [search]);

  const selectedIds = useMemo(() => new Set(agentIds), [agentIds]);

  const agentConfigsByType = useMemo(() => {
    const map = new Map<string, AgentConfigRow>();
    for (const config of (agentConfigs ?? []) as AgentConfigRow[]) {
      map.set(config.type, config);
    }
    return map;
  }, [agentConfigs]);

  const installedAgentIds = useMemo(
    () => new Set(installedAgentManifests.map((agent) => agent.id)),
    [installedAgentManifests],
  );

  // Build the same available-agent list the RP wizard uses, scoped to roleplay.
  const availableAgents = useMemo<AvailableAgent[]>(() => {
    const activeChatMode: ChatMode = "roleplay";
    const agents: AvailableAgent[] = [];
    for (const agent of installedAgentManifests) {
      if (agent.libraryHidden) continue;
      if (!isAgentManifestAvailableInChatMode(activeChatMode, agent)) continue;
      const existing = agentConfigsByType.get(agent.id);
      if (existing && isAgentConfigDeleted(existing.settings)) continue;
      agents.push({
        id: agent.id,
        name: agent.name,
        description: existing?.description ?? agent.description,
        category: agent.category,
        phase: normalizeAgentPhaseForType(agent.id, existing?.phase ?? agent.phase),
        builtIn: true,
        runtimeDisabled: isBuiltInAgentRuntimeDisabled(agent.id),
        execution: agent.execution,
      });
    }
    for (const config of (agentConfigs ?? []) as AgentConfigRow[]) {
      if (isAgentConfigDeleted(config.settings)) continue;
      if (isRetiredBuiltInAgentId(config.type)) continue;
      if (installedAgentIds.has(config.type)) continue;
      agents.push({
        id: config.type,
        name: config.name,
        description: config.description,
        category: "custom",
        phase: normalizeAgentPhaseForType(config.type, config.phase),
        builtIn: false,
        runtimeDisabled: false,
        execution: "pipeline",
      });
    }
    return agents;
  }, [agentConfigs, agentConfigsByType, installedAgentIds, installedAgentManifests]);

  const available = useMemo(() => {
    const query = search.toLowerCase().trim();
    return availableAgents.filter((agent) => {
      if (selectedIds.has(agent.id)) return false;
      if (!query) return true;
      const name = agent.name.toLowerCase();
      const desc = agent.description.toLowerCase();
      const category = getAgentCategoryLabel(agent).toLowerCase();
      return name.includes(query) || desc.includes(query) || category.includes(query);
    });
  }, [availableAgents, selectedIds, search]);

  const visibleAvailable = useMemo(() => available.slice(0, agentPickerLimit), [available, agentPickerLimit]);

  const selectedAgents = useMemo(
    () => availableAgents.filter((agent) => selectedIds.has(agent.id)),
    [availableAgents, selectedIds],
  );

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onAgentIdsChange([...next]);
  };

  const handleRandom = () => {
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    const next = new Set(selectedIds);
    next.add(pick.id);
    onAgentIdsChange([...next]);
  };

  if (agentConfigsLoading || installedAgentsLoading) {
    return (
      <div
        data-testid="story-bundle-editor-agents-loading"
        className="flex min-h-40 items-center justify-center gap-2 text-xs text-[var(--muted-foreground)]"
      >
        <Sparkles size="0.875rem" className="animate-pulse" />
        {t("storyBundles.loadingAgents", "Loading agents…")}
      </div>
    );
  }

  return (
    <div data-testid="story-bundle-editor-agents" className="flex flex-col gap-6">
      {/* Add Agents */}
      <section>
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.addAgents", "Add Agents")}
        </h3>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size="0.875rem"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              data-testid="story-bundle-editor-agents-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("storyBundles.searchAgents", "Search agents…")}
              className="mari-input w-full rounded-lg border border-[var(--border)] bg-[var(--input)] py-1.5 pl-8 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>
          <button
            data-testid="story-bundle-editor-agents-random"
            onClick={handleRandom}
            disabled={available.length === 0}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            title={t("storyBundles.agentRandomHint", "Pick a random agent")}
          >
            <Dices size="0.75rem" />
            <span className="block truncate text-xs">{t("storyBundles.random", "Random")}</span>
          </button>
        </div>

        {visibleAvailable.length > 0 ? (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
            {visibleAvailable.map((agent) => {
              const category = getAgentCategoryLabel(agent);
              return (
                <button
                  key={agent.id}
                  data-testid={`story-bundle-editor-agents-add-${agent.id}`}
                  onClick={() => handleToggle(agent.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-all hover:bg-[var(--accent)]"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                    <Sparkles size="0.75rem" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">{agent.name}</div>
                    <div className="truncate text-xs text-[var(--muted-foreground)] capitalize">{category}</div>
                  </div>
                  <Plus size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
                </button>
              );
            })}
            {available.length > agentPickerLimit && (
              <button
                data-testid="story-bundle-editor-agents-load-more"
                onClick={() => setAgentPickerLimit((limit) => limit + AGENT_PICKER_PAGE_SIZE)}
                className="w-full rounded-md px-2 py-1.5 text-center text-xs text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
              >
                {t("storyBundles.loadMore", "Load more")} ({visibleAvailable.length} {t("storyBundles.of", "of")}{" "}
                {available.length})
              </button>
            )}
          </div>
        ) : (
          <div
            data-testid="story-bundle-editor-agents-empty"
            className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm text-[var(--muted-foreground)]"
          >
            {search
              ? t("storyBundles.noAgentsMatch", "No agents match your search.")
              : t("storyBundles.allAgentsAdded", "All agents have been added.")}
          </div>
        )}
      </section>

      {/* Selected Agents */}
      <section data-testid="story-bundle-editor-agents-selected">
        <h3 className="mari-chrome-text-strong mb-3 text-sm font-semibold">
          {t("storyBundles.selectedAgents", "Selected Agents")}
        </h3>

        {selectedAgents.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
            {selectedAgents.map((agent) => {
              const category = getAgentCategoryLabel(agent);
              return (
                <div key={agent.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                    <Sparkles size="0.75rem" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">{agent.name}</div>
                    <div className="truncate text-xs text-[var(--muted-foreground)] capitalize">{category}</div>
                  </div>
                  <button
                    data-testid={`story-bundle-editor-agents-remove-${agent.id}`}
                    onClick={() => handleToggle(agent.id)}
                    className="shrink-0 rounded p-1 text-[var(--muted-foreground)] transition-all hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                    title={t("storyBundles.removeAgent", "Remove")}
                  >
                    <X size="0.875rem" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            data-testid="story-bundle-editor-agents-selected-empty"
            className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm text-[var(--muted-foreground)]"
          >
            {t("storyBundles.agentsEmpty", "No agents assigned yet.")}
          </div>
        )}
      </section>
    </div>
  );
}
