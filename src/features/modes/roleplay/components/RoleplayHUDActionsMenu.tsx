import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Code2,
  MessageCircle,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { BUILT_IN_AGENTS } from "../../../../engine/contracts/types/agent";
import type { Message } from "../../../../engine/contracts/types/chat";
import {
  agentConfigEnabled,
  useUpdateAgentRunData,
  type AgentConfigRow,
  type AgentRunRow,
} from "../../../catalog/agents/index";
import {
  formatAgentFailureDetail,
  formatAgentFailureTitle,
  toAgentFailure,
  type AgentFailure,
} from "../../../../shared/lib/agent-failures";
import { ContinuityIssueChecklist } from "../../../catalog/agents/activity";
import { ContextInjectionPanel } from "./ContextInjectionPanel";

const SecretPlotPanel = lazy(async () => import("./SecretPlotPanel").then((m) => ({ default: m.SecretPlotPanel })));

interface ThoughtBubble {
  agentId: string;
  agentName: string;
  content: string;
  timestamp: number;
}

type AgentsMenuTab = "activity" | "injections" | "secret";

interface RoleplayHUDActionsMenuProps {
  chatId: string;
  injectionSourceMessages?: Message[];
  isAgentProcessing: boolean;
  isGenerationBusy?: boolean;
  thoughtBubbles: ThoughtBubble[];
  clearThoughtBubbles: () => void;
  dismissThoughtBubble: (index: number) => void;
  customAgentRuns: AgentRunRow[];
  customAgentRunsLoading: boolean;
  agentConfigs?: AgentConfigRow[];
  enabledAgentTypes?: Set<string>;
  showEcho: boolean;
  echoChamberOpen: boolean;
  toggleEchoChamber: () => void;
  echoMessageCount: number;
  clearGameState: () => void;
  onRetriggerTrackers?: () => void;
  onRetryFailedAgents?: () => void;
  onRetryAgent?: (agentType: string) => void;
  failedAgentTypes?: string[];
  failedAgentFailures?: AgentFailure[];
  onClose: () => void;
  showInjectionsTab?: boolean;
  showSecretPlotTab?: boolean;
}

export function RoleplayHUDActionsMenu({
  chatId,
  injectionSourceMessages,
  isAgentProcessing,
  isGenerationBusy = isAgentProcessing,
  thoughtBubbles,
  clearThoughtBubbles,
  dismissThoughtBubble,
  customAgentRuns,
  customAgentRunsLoading,
  agentConfigs,
  enabledAgentTypes,
  showEcho,
  echoChamberOpen,
  toggleEchoChamber,
  echoMessageCount,
  clearGameState,
  onRetriggerTrackers,
  onRetryFailedAgents,
  onRetryAgent,
  failedAgentTypes,
  failedAgentFailures,
  onClose,
  showInjectionsTab,
  showSecretPlotTab,
}: RoleplayHUDActionsMenuProps) {
  const [tab, setTab] = useState<AgentsMenuTab>("activity");
  const uniqueAgentCount = new Set(thoughtBubbles.map((bubble) => bubble.agentId)).size;
  const hasCustomRuns = customAgentRuns.length > 0;
  const injectableCustomRuns = useMemo(
    () => getLatestInjectableCustomRuns(customAgentRuns, agentConfigs ?? [], enabledAgentTypes),
    [customAgentRuns, agentConfigs, enabledAgentTypes],
  );
  const runnableCustomAgents = useMemo(
    () => getRunnableCustomAgents(agentConfigs ?? [], enabledAgentTypes),
    [agentConfigs, enabledAgentTypes],
  );
  const hasActiveCustomPromptAgent = useMemo(
    () => hasActiveInjectableCustomAgent(agentConfigs ?? [], enabledAgentTypes),
    [agentConfigs, enabledAgentTypes],
  );
  const showCustomAgentRetrySection = !!onRetryAgent && runnableCustomAgents.length > 0;
  const hasAnyActivity =
    isAgentProcessing ||
    thoughtBubbles.length > 0 ||
    hasCustomRuns ||
    customAgentRunsLoading ||
    showCustomAgentRetrySection;
  const tabs = [
    { id: "activity" as const, label: "Activity" },
    ...(showInjectionsTab ? [{ id: "injections" as const, label: "Injections" }] : []),
    ...(showSecretPlotTab ? [{ id: "secret" as const, label: "Secret plot" }] : []),
  ] as const;
  const currentTabIndex = tabs.findIndex((t) => t.id === tab);
  const safeTabIndex = currentTabIndex >= 0 ? currentTabIndex : 0;
  const currentTab = tabs[safeTabIndex] ?? tabs[0];
  const activeTab = currentTab.id;
  const showTrackerActions = activeTab === "activity";
  const showRetryFailedAction = !!(
    (onRetryFailedAgents || onRetryAgent) &&
    failedAgentTypes &&
    failedAgentTypes.length > 0
  );
  const displayedFailures = useMemo(
    () =>
      failedAgentFailures && failedAgentFailures.length > 0
        ? failedAgentFailures
        : (failedAgentTypes ?? []).map((agentType) => toAgentFailure({ agentType })),
    [failedAgentFailures, failedAgentTypes],
  );
  const showFooterActions = showEcho || showTrackerActions || showRetryFailedAction;

  useEffect(() => {
    if (!showInjectionsTab && tab === "injections") {
      setTab("activity");
      return;
    }
    if (!showSecretPlotTab && tab === "secret") {
      setTab("activity");
    }
  }, [showInjectionsTab, showSecretPlotTab, tab]);

  return (
    <>
      {tabs.length > 1 && (
        <div className="border-b border-[var(--border)] p-1">
          <div className="flex rounded-lg bg-[var(--secondary)]/40 p-0.5 ring-1 ring-[var(--border)]">
            {tabs.map((item) => {
              const active = currentTab.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  title={
                    item.id === "secret"
                      ? "Values here are stored in agent memory - the same source used when injecting arc and directions before each reply."
                      : undefined
                  }
                  className={
                    active
                      ? "min-h-6 min-w-0 flex-1 rounded-md bg-[var(--primary)]/15 px-1.5 py-0.5 text-center text-[0.5625rem] font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] max-md:min-h-7"
                      : "min-h-6 min-w-0 flex-1 rounded-md px-1.5 py-0.5 text-center text-[0.5625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/45 hover:text-[var(--accent-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] max-md:min-h-7"
                  }
                >
                  <span className="block truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <>
          {isAgentProcessing && (
            <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
              <Sparkles size="0.75rem" className="animate-pulse text-foreground/65" />
              <span className="text-[0.625rem] text-foreground/65">Agents thinking...</span>
            </div>
          )}
          {!hasAnyActivity && (
            <div className="px-3 py-4 text-center text-[0.625rem] text-white/30">No agent activity yet</div>
          )}
          {thoughtBubbles.length > 0 && (
            <>
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
                <span className="text-[0.625rem] text-white/40">
                  {uniqueAgentCount} agent{uniqueAgentCount !== 1 ? "s" : ""} triggered
                </span>
                <button
                  onClick={clearThoughtBubbles}
                  className="text-[0.625rem] text-white/30 transition-colors hover:text-white/60"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-col gap-1 p-2">
                {thoughtBubbles.map((bubble, index) => (
                  <div
                    key={`${bubble.agentId}-${bubble.timestamp}`}
                    className="relative rounded-lg bg-white/5 p-2 text-[0.625rem]"
                  >
                    <button
                      onClick={() => dismissThoughtBubble(index)}
                      className="absolute right-1.5 top-1.5 text-white/20 transition-colors hover:text-white/60"
                    >
                      <X size="0.625rem" />
                    </button>
                    <div className="pr-4">
                      <span className="font-semibold text-foreground/75">{bubble.agentName}</span>
                      {bubble.agentId === "continuity" ? (
                        <ContinuityIssueChecklist content={bubble.content} compact />
                      ) : (
                        <p className="mt-0.5 whitespace-pre-wrap text-white/50 leading-relaxed">{bubble.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {(hasCustomRuns || customAgentRunsLoading) && (
            <CustomAgentRunsSection
              runs={customAgentRuns}
              loading={customAgentRunsLoading}
              title="Custom outputs"
              countMode="all"
              onRetryAgent={onRetryAgent}
              retryBusy={isGenerationBusy}
              onClose={onClose}
            />
          )}

          {onRetryAgent && runnableCustomAgents.length > 0 && (
            <CustomAgentsRetrySection
              agents={runnableCustomAgents}
              retryBusy={isGenerationBusy}
              onRetryAgent={onRetryAgent}
              onClose={onClose}
            />
          )}
        </>
      )}

      {activeTab === "injections" && showInjectionsTab && (
        <>
          <ContextInjectionPanel
            chatId={chatId}
            messages={injectionSourceMessages}
            isAgentProcessing={isAgentProcessing}
            isGenerationBusy={isGenerationBusy}
            agentConfigs={agentConfigs}
            enabledAgentTypes={enabledAgentTypes}
          />
          {hasActiveCustomPromptAgent && (
            <CustomAgentRunsSection
              runs={injectableCustomRuns}
              loading={customAgentRunsLoading}
              title="Custom prompt sections"
              emptyText="No saved prompt-section output yet."
              countMode="latest"
              collapsible
              onRetryAgent={onRetryAgent}
              retryBusy={isGenerationBusy}
              onClose={onClose}
            />
          )}
        </>
      )}

      {activeTab === "secret" && showSecretPlotTab && (
        <Suspense
          fallback={<div className="px-3 py-4 text-center text-[0.625rem] text-white/35">Loading secret plot...</div>}
        >
          <SecretPlotPanel
            chatId={chatId}
            messages={injectionSourceMessages}
            isAgentProcessing={isAgentProcessing}
            isGenerationBusy={isGenerationBusy}
          />
        </Suspense>
      )}

      {showFooterActions && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {showRetryFailedAction && displayedFailures.length > 0 && (
            <div className="space-y-1.5 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[0.5625rem] font-semibold uppercase tracking-wide text-amber-300/90">
                <AlertTriangle size="0.625rem" />
                Failed agents
              </div>
              <div className="space-y-1">
                {displayedFailures.map((failure) => (
                  <div
                    key={failure.agentType}
                    className="flex items-start gap-2 rounded-md border border-amber-400/15 bg-amber-500/10 px-2 py-1.5 text-[0.625rem]"
                    title={failure.error ?? undefined}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-amber-200">{formatAgentFailureTitle(failure)}</div>
                      <div className="mt-0.5 max-h-8 overflow-hidden break-words text-amber-100/65">
                        {formatAgentFailureDetail(failure)}
                      </div>
                    </div>
                    {onRetryAgent && (
                      <button
                        type="button"
                        onClick={() => {
                          onRetryAgent(failure.agentType);
                          onClose();
                        }}
                        disabled={isGenerationBusy}
                        className="mt-0.5 rounded p-1 text-amber-200/75 transition-colors hover:bg-amber-400/15 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/60 disabled:opacity-45"
                        title={isGenerationBusy ? "Agents are busy" : `Retry ${failure.agentName}`}
                        aria-label={`Retry ${failure.agentName}`}
                      >
                        <RefreshCw size="0.6875rem" className={isGenerationBusy ? "animate-spin" : ""} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {showEcho && (
            <button
              onClick={toggleEchoChamber}
              className="flex w-full items-center gap-2 px-3 py-2 text-[0.625rem] transition-colors hover:bg-white/5"
            >
              <MessageCircle size="0.75rem" className={echoChamberOpen ? "text-foreground/75" : "text-foreground/50"} />
              <span className={echoChamberOpen ? "font-medium text-foreground/75" : "text-foreground/55"}>
                Echo Chamber {echoChamberOpen ? "On" : "Off"}
              </span>
              {echoMessageCount > 0 && (
                <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-foreground/15 px-1 text-[0.5rem] font-bold text-foreground/80 ring-1 ring-foreground/10">
                  {echoMessageCount}
                </span>
              )}
            </button>
          )}
          {showTrackerActions && (
            <button
              onClick={() => {
                clearGameState();
                onClose();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[0.625rem] text-white/60 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 size="0.75rem" className="text-foreground/45" />
              <span>Clear Trackers</span>
            </button>
          )}
          {showTrackerActions && onRetriggerTrackers && (
            <button
              onClick={() => {
                onRetriggerTrackers();
                onClose();
              }}
              disabled={isGenerationBusy}
              className="flex w-full items-center gap-2 px-3 py-2 text-[0.625rem] font-medium text-foreground/60 transition-colors hover:bg-white/5 hover:text-foreground/75 disabled:opacity-50"
            >
              <RefreshCw size="0.6875rem" className={isGenerationBusy ? "animate-spin" : ""} />
              {isGenerationBusy ? "Running..." : "Re-run Trackers"}
            </button>
          )}
          {showRetryFailedAction && onRetryFailedAgents && (
            <button
              onClick={() => {
                onRetryFailedAgents();
                onClose();
              }}
              disabled={isGenerationBusy}
              className="flex w-full items-center gap-2 px-3 py-2 text-[0.625rem] font-medium text-amber-300 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
            >
              <AlertTriangle size="0.6875rem" className={isGenerationBusy ? "animate-pulse" : ""} />
              {isAgentProcessing ? "Retrying..." : `Retry Failed Agents (${failedAgentTypes?.length ?? 0})`}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function CustomAgentRunsSection({
  runs,
  loading,
  title,
  emptyText,
  countMode,
  collapsible,
  onRetryAgent,
  retryBusy,
  onClose,
}: {
  runs: AgentRunRow[];
  loading: boolean;
  title: string;
  emptyText?: string;
  countMode: "all" | "latest";
  collapsible?: boolean;
  onRetryAgent?: (agentType: string) => void;
  retryBusy?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(!collapsible);
  const countLabel = loading ? "Loading..." : runs.length > 0 ? String(runs.length) : "";
  const heading = (
    <>
      <span className="flex items-center gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
        <Code2 size="0.6875rem" className="text-[var(--primary)]" />
        {title}
      </span>
      <span className="ml-auto text-[0.5625rem] text-[var(--muted-foreground)]/70">{countLabel}</span>
      {collapsible && (
        <ChevronDown
          size="0.75rem"
          className={
            open
              ? "text-[var(--muted-foreground)] transition-transform rotate-180"
              : "text-[var(--muted-foreground)] transition-transform"
          }
        />
      )}
    </>
  );

  return (
    <div className="border-t border-white/5">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-7 w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors hover:bg-[var(--accent)]/45 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
          aria-expanded={open}
        >
          {heading}
        </button>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1.5">{heading}</div>
      )}
      {open && (
        <div className="flex flex-col gap-1 p-2 pt-0">
          {runs.map((run) => (
            <CustomAgentRunItem
              key={run.id}
              run={run}
              onRetryAgent={onRetryAgent}
              retryBusy={retryBusy}
              onClose={onClose}
            />
          ))}
          {!loading && runs.length === 0 && emptyText && (
            <div className="px-2 py-2 text-center text-[0.625rem] text-[var(--muted-foreground)]">{emptyText}</div>
          )}
          {!loading && countMode === "latest" && runs.length > 0 && (
            <div className="px-1 text-[0.5625rem] text-[var(--muted-foreground)]/70">
              Showing the latest saved output per custom agent with Add as Prompt Section enabled.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomAgentsRetrySection({
  agents,
  retryBusy,
  onRetryAgent,
  onClose,
}: {
  agents: AgentConfigRow[];
  retryBusy: boolean;
  onRetryAgent: (agentType: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="border-t border-white/5">
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <span className="flex items-center gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
          <Sparkles size="0.6875rem" className="text-[var(--primary)]" />
          Custom agents
        </span>
        <span className="ml-auto text-[0.5625rem] text-[var(--muted-foreground)]/70">{agents.length}</span>
      </div>
      <div className="flex flex-col gap-1 p-2 pt-0">
        {agents.map((agent) => (
          <button
            key={agent.id || agent.type}
            type="button"
            onClick={() => {
              onRetryAgent(agent.type);
              onClose();
            }}
            disabled={retryBusy}
            className="flex min-h-8 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/55 px-2 py-1.5 text-left text-[0.625rem] transition-colors hover:bg-[var(--accent)]/45 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:opacity-50"
            title={retryBusy ? "Agents are busy" : `Re-run ${agent.name}`}
          >
            <RefreshCw size="0.6875rem" className={retryBusy ? "animate-spin" : "text-[var(--primary)]"} />
            <span className="min-w-0 flex-1 truncate text-[var(--popover-foreground)]">{agent.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function isCustomAgentConfig(config: AgentConfigRow): boolean {
  return !BUILT_IN_AGENTS.some((agent) => agent.id === config.type);
}

function isAgentConfigActiveForMenu(config: AgentConfigRow, enabledAgentTypes?: Set<string>): boolean {
  if (!agentConfigEnabled(config.enabled, true)) return false;
  if (enabledAgentTypes && enabledAgentTypes.size > 0) {
    return enabledAgentTypes.has(config.type) || enabledAgentTypes.has(config.id);
  }
  return true;
}

function getRunnableCustomAgents(configs: AgentConfigRow[], enabledAgentTypes?: Set<string>): AgentConfigRow[] {
  return configs.filter((config) => isCustomAgentConfig(config) && isAgentConfigActiveForMenu(config, enabledAgentTypes));
}

function hasActiveInjectableCustomAgent(configs: AgentConfigRow[], enabledAgentTypes?: Set<string>): boolean {
  return configs.some((config) => {
    if (!isCustomAgentConfig(config)) return false;
    if (!isAgentConfigActiveForMenu(config, enabledAgentTypes)) return false;
    const settings = parseAgentSettings(config.settings);
    return settings.injectAsSection === true;
  });
}

function getLatestInjectableCustomRuns(
  runs: AgentRunRow[],
  configs: AgentConfigRow[],
  enabledAgentTypes?: Set<string>,
): AgentRunRow[] {
  const injectableTypes = new Set(
    configs
      .filter((config) => {
        if (!isCustomAgentConfig(config)) return false;
        if (!isAgentConfigActiveForMenu(config, enabledAgentTypes)) return false;
        const settings = parseAgentSettings(config.settings);
        return settings.injectAsSection === true;
      })
      .map((config) => config.type),
  );
  const seen = new Set<string>();
  const latest: AgentRunRow[] = [];
  for (const run of runs) {
    if (!injectableTypes.has(run.agentType) || seen.has(run.agentType)) continue;
    seen.add(run.agentType);
    latest.push(run);
  }
  return latest;
}

function parseAgentSettings(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function getEditableMode(data: unknown): "text" | "json" {
  if (typeof data === "string") return "text";
  if (data && typeof data === "object" && typeof (data as Record<string, unknown>).text === "string") return "text";
  return "json";
}

function getEditorValue(data: unknown, mode: "text" | "json"): string {
  if (mode === "text") {
    if (typeof data === "string") return data;
    if (data && typeof data === "object") return String((data as Record<string, unknown>).text ?? "");
    return "";
  }
  return JSON.stringify(data ?? {}, null, 2);
}

function parseDraft(
  originalData: unknown,
  mode: "text" | "json",
  draft: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (mode === "text") {
    if (typeof originalData === "string") return { ok: true, value: draft };
    if (originalData && typeof originalData === "object") {
      return { ok: true, value: { ...(originalData as Record<string, unknown>), text: draft } };
    }
    return { ok: true, value: draft };
  }

  try {
    return { ok: true, value: JSON.parse(draft) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

function getRunPreview(data: unknown): string {
  if (typeof data === "string") return data.trim();
  if (data && typeof data === "object") {
    const text = (data as Record<string, unknown>).text;
    if (typeof text === "string" && text.trim()) return text.trim();
    return JSON.stringify(data, null, 2);
  }
  return data == null ? "" : String(data);
}

function formatRunTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function CustomAgentRunItem({
  run,
  onRetryAgent,
  retryBusy,
  onClose,
}: {
  run: AgentRunRow;
  onRetryAgent?: (agentType: string) => void;
  retryBusy?: boolean;
  onClose?: () => void;
}) {
  const updateRun = useUpdateAgentRunData();
  const mode = getEditableMode(run.resultData);
  const initialDraft = useMemo(() => getEditorValue(run.resultData, mode), [run.resultData, mode]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(initialDraft);
  }, [editing, initialDraft]);

  const preview = getRunPreview(run.resultData);
  const timestamp = formatRunTime(run.createdAt);

  const save = async () => {
    const parsed = parseDraft(run.resultData, mode, draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    await updateRun.mutateAsync({ id: run.id, chatId: run.chatId, resultData: parsed.value });
    setEditing(false);
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]/55 p-2 text-[0.625rem] text-[var(--popover-foreground)]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="font-semibold text-[var(--primary)]">{run.agentName}</span>
            <span className="rounded bg-[var(--secondary)]/55 px-1 py-0.5 text-[0.5rem] uppercase tracking-wide text-[var(--muted-foreground)]">
              {run.resultType.replace(/_/g, " ")}
            </span>
            {timestamp && <span className="text-[0.5rem] text-[var(--muted-foreground)]/70">{timestamp}</span>}
          </div>
          {!editing && (
            <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--secondary)]/35 p-1.5 font-sans text-[var(--muted-foreground)] leading-relaxed">
              {preview || "Empty output"}
            </pre>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onRetryAgent && run.agentType && (
            <button
              type="button"
              onClick={() => {
                onRetryAgent(run.agentType);
                onClose?.();
              }}
              disabled={retryBusy}
              className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/45 hover:text-[var(--accent-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:opacity-45"
              title={retryBusy ? "Agents are busy" : `Re-run ${run.agentName}`}
              aria-label={`Re-run ${run.agentName}`}
            >
              <RefreshCw size="0.6875rem" className={retryBusy ? "animate-spin" : ""} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing((value) => !value);
              setError(null);
            }}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/45 hover:text-[var(--accent-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
            title={editing ? "Close editor" : "Edit output"}
          >
            {editing ? <X size="0.6875rem" /> : <Pencil size="0.6875rem" />}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-2 space-y-1.5">
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            spellCheck={false}
            className="min-h-24 w-full resize-y rounded-md border border-[var(--input)] bg-[var(--secondary)]/45 px-2 py-1.5 font-mono text-[0.625rem] leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
          {error && <div className="text-[0.5625rem] text-[var(--destructive)]">{error}</div>}
          <div className="flex items-center justify-between">
            <span className="text-[0.5625rem] uppercase tracking-wide text-[var(--muted-foreground)]/70">
              {mode === "json" ? "JSON" : "Text"}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={updateRun.isPending}
              className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-2 py-1 text-[0.5625rem] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:opacity-50"
            >
              <Check size="0.625rem" />
              {updateRun.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
