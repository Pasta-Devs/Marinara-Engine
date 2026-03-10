// ──────────────────────────────────────────────
// Full-Page Agent Editor
// Click an agent → opens this editor
// ──────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useUIStore } from "../../stores/ui.store";
import { useAgentConfigs, useUpdateAgent, useCreateAgent, type AgentConfigRow } from "../../hooks/use-agents";
import { useConnections } from "../../hooks/use-connections";
import { useCustomTools, type CustomToolRow } from "../../hooks/use-custom-tools";
import {
  ArrowLeft,
  Save,
  Sparkles,
  Check,
  AlertCircle,
  X,
  Zap,
  Link2,
  FileText,
  RotateCcw,
  Clock,
  Activity,
  Info,
  Wrench,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Layers,
  Music,
  ExternalLink,
} from "lucide-react";
import { useDeleteAgent } from "../../hooks/use-agents";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import {
  BUILT_IN_AGENTS,
  BUILT_IN_TOOLS,
  DEFAULT_AGENT_TOOLS,
  getDefaultAgentPrompt,
  type AgentPhase,
  type ToolDefinition,
} from "@marinara-engine/shared";

// ═══════════════════════════════════════════════
//  Phase metadata
// ═══════════════════════════════════════════════
const PHASE_META: Record<AgentPhase, { label: string; color: string; icon: typeof Zap; description: string }> = {
  pre_generation: {
    label: "Pre-Generation",
    color: "text-amber-400",
    icon: Zap,
    description: "Runs before the main AI response. Can inject context or modify the prompt.",
  },
  parallel: {
    label: "Parallel",
    color: "text-sky-400",
    icon: Activity,
    description: "Runs alongside or after the main generation. Independent processing.",
  },
  post_processing: {
    label: "Post-Processing",
    color: "text-emerald-400",
    icon: Clock,
    description: "Runs after the main AI response. Can analyze and extract data from it.",
  },
};

// ═══════════════════════════════════════════════
//  Main Editor
// ═══════════════════════════════════════════════
export function AgentEditor() {
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const closeAgentDetail = useUIStore((s) => s.closeAgentDetail);

  const { data: agentConfigs } = useAgentConfigs();
  const { data: connections } = useConnections();
  const { data: customToolsRaw } = useCustomTools();
  const updateAgent = useUpdateAgent();
  const createAgent = useCreateAgent();
  const deleteAgent = useDeleteAgent();

  // Find built-in meta (null for custom agents)
  const builtIn = useMemo(() => BUILT_IN_AGENTS.find((a) => a.id === agentDetailId) ?? null, [agentDetailId]);

  // Find DB config — for built-ins, match by type; for custom agents, match by id
  const dbConfig = useMemo(() => {
    if (!agentDetailId || !agentConfigs) return null;
    return (agentConfigs as AgentConfigRow[]).find((c) => c.type === agentDetailId || c.id === agentDetailId) ?? null;
  }, [agentDetailId, agentConfigs]);

  // Custom agent = DB entry with no matching built-in
  const isCustomAgent = !builtIn && !!dbConfig;

  // Default prompt for this agent type
  const defaultPrompt = useMemo(() => (agentDetailId ? getDefaultAgentPrompt(agentDetailId) : ""), [agentDetailId]);

  // ── Local editable state ──
  const [localName, setLocalName] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const [localPhase, setLocalPhase] = useState<AgentPhase>("post_processing");
  const [localConnectionId, setLocalConnectionId] = useState("");
  const [localContextSize, setLocalContextSize] = useState<number | "">("");
  const [localPrompt, setLocalPrompt] = useState("");
  const [localInjectAsSection, setLocalInjectAsSection] = useState(false);
  const [localEnabledTools, setLocalEnabledTools] = useState<string[]>([]);
  const [localSpotifyClientId, setLocalSpotifyClientId] = useState("");
  const [spotifyStatus, setSpotifyStatus] = useState<{
    connected: boolean;
    expired: boolean;
    redirectUri: string | null;
  } | null>(null);
  const [spotifyConnecting, setSpotifyConnecting] = useState(false);
  const spotifyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spotifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Populate from DB config or built-in defaults
  useEffect(() => {
    if (!agentDetailId) return;
    if (dbConfig) {
      setLocalName(dbConfig.name);
      setLocalDescription(dbConfig.description);
      setLocalPhase(dbConfig.phase as AgentPhase);
      setLocalConnectionId(dbConfig.connectionId ?? "");
      const settings = dbConfig.settings
        ? typeof dbConfig.settings === "string"
          ? JSON.parse(dbConfig.settings)
          : dbConfig.settings
        : {};
      setLocalContextSize(settings.contextSize ?? "");
      setLocalInjectAsSection(settings.injectAsSection ?? false);
      setLocalEnabledTools(settings.enabledTools ?? DEFAULT_AGENT_TOOLS[dbConfig.type] ?? []);
      setLocalSpotifyClientId(settings.spotifyClientId ?? "");
      setLocalPrompt(dbConfig.promptTemplate || "");
    } else if (builtIn) {
      setLocalName(builtIn.name);
      setLocalDescription(builtIn.description);
      setLocalPhase(builtIn.phase);
      setLocalConnectionId("");
      setLocalContextSize("");
      setLocalInjectAsSection(builtIn.defaultInjectAsSection ?? false);
      setLocalEnabledTools(DEFAULT_AGENT_TOOLS[builtIn.id] ?? []);
      setLocalSpotifyClientId("");
      setLocalPrompt("");
    } else {
      // Brand new custom agent — start empty
      setLocalName("New Agent");
      setLocalDescription("");
      setLocalPhase("post_processing");
      setLocalConnectionId("");
      setLocalContextSize("");
      setLocalInjectAsSection(false);
      setLocalEnabledTools([]);
      setLocalSpotifyClientId("");
      setLocalPrompt("");
    }
    setDirty(false);
    setSaveError(null);
  }, [agentDetailId, dbConfig, builtIn]);

  // Fetch Spotify connection status when viewing a Spotify agent
  const isSpotifyAgent = agentDetailId === "spotify" || dbConfig?.type === "spotify";
  useEffect(() => {
    if (!isSpotifyAgent || !dbConfig?.id) {
      setSpotifyStatus(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/spotify/status?agentId=${encodeURIComponent(dbConfig.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled)
          setSpotifyStatus({ connected: data.connected, expired: data.expired, redirectUri: data.redirectUri ?? null });
      })
      .catch(() => {
        if (!cancelled) setSpotifyStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isSpotifyAgent, dbConfig?.id]);

  // Clean up Spotify polling timers on unmount
  useEffect(() => {
    return () => {
      if (spotifyPollRef.current) clearInterval(spotifyPollRef.current);
      if (spotifyTimeoutRef.current) clearTimeout(spotifyTimeoutRef.current);
    };
  }, []);

  // Whether the prompt textarea shows the default or a custom override
  const isUsingDefaultPrompt = !localPrompt.trim();
  const displayPrompt = isUsingDefaultPrompt ? defaultPrompt : localPrompt;

  const handleClose = useCallback(() => {
    if (dirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closeAgentDetail();
  }, [dirty, closeAgentDetail]);

  const openAgentDetail = useUIStore((s) => s.openAgentDetail);

  const handleSave = useCallback(async () => {
    if (!agentDetailId) return;
    setSaveError(null);

    const payload = {
      name: localName,
      description: localDescription,
      phase: localPhase,
      connectionId: localConnectionId || null,
      promptTemplate: localPrompt,
      settings: {
        ...(localContextSize !== "" ? { contextSize: Number(localContextSize) } : {}),
        ...(localInjectAsSection ? { injectAsSection: true } : {}),
        enabledTools: localEnabledTools,
        ...(localSpotifyClientId ? { spotifyClientId: localSpotifyClientId } : {}),
      },
    };

    try {
      if (dbConfig) {
        await updateAgent.mutateAsync({ id: dbConfig.id, ...payload });
      } else {
        // For built-in agents, use their type; for custom, generate a slug
        const typeId = builtIn
          ? agentDetailId
          : `custom-${localName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "")}`;
        const created = (await createAgent.mutateAsync({
          ...payload,
          type: typeId,
          enabled: builtIn?.enabledByDefault ?? true,
        })) as { id?: string } | undefined;
        // After creating a new custom agent, switch agentDetailId to its DB id
        if (!builtIn && created?.id) {
          openAgentDetail(created.id);
        }
      }
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save agent config");
    }
  }, [
    agentDetailId,
    localName,
    localDescription,
    localPhase,
    localConnectionId,
    localPrompt,
    localContextSize,
    localInjectAsSection,
    localEnabledTools,
    localSpotifyClientId,
    dbConfig,
    builtIn,
    updateAgent,
    createAgent,
  ]);

  const handleResetPrompt = useCallback(() => {
    setLocalPrompt("");
    setDirty(true);
  }, []);

  const handleLoadDefault = useCallback(() => {
    setLocalPrompt(defaultPrompt);
    setDirty(true);
  }, [defaultPrompt]);

  const markDirty = useCallback(() => setDirty(true), []);

  const phaseMeta = PHASE_META[localPhase];

  // ── Loading / not found ──
  if (!agentDetailId || (!builtIn && !dbConfig && agentDetailId !== "__new__")) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted-foreground)]">
        Agent not found.
      </div>
    );
  }

  const handleDelete = async () => {
    if (!dbConfig) return;
    if (!confirm("Delete this custom agent? This cannot be undone.")) return;
    await deleteAgent.mutateAsync(dbConfig.id);
    closeAgentDetail();
  };

  const isPending = updateAgent.isPending || createAgent.isPending;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--background)]">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <button
          onClick={handleClose}
          className="rounded-xl p-2 transition-all hover:bg-[var(--accent)] active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--y2k-pink)] to-[var(--y2k-purple)] text-white shadow-sm">
          <Sparkles size={18} />
        </div>
        <input
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            markDirty();
          }}
          className="flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-[var(--muted-foreground)]"
          placeholder="Agent name…"
        />
        <div className="flex items-center gap-1.5">
          {saveError && (
            <span className="mr-2 flex items-center gap-1 text-[10px] font-medium text-red-400">
              <AlertCircle size={11} /> Save failed
            </span>
          )}
          {savedFlash && !dirty && (
            <span className="mr-2 flex items-center gap-1 text-[10px] font-medium text-emerald-400">
              <Check size={11} /> Saved
            </span>
          )}
          {dirty && !saveError && <span className="mr-2 text-[10px] font-medium text-amber-400">Unsaved</span>}
          {isCustomAgent && dbConfig && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/15 active:scale-[0.98]"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--y2k-pink)] to-[var(--y2k-purple)] px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            <Save size={13} /> Save
          </button>
        </div>
      </div>

      {/* Unsaved warning */}
      {showUnsavedWarning && (
        <div className="flex items-center justify-between bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
          <span>You have unsaved changes.</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUnsavedWarning(false)}
              className="rounded-lg px-3 py-1 hover:bg-[var(--accent)]"
            >
              Keep editing
            </button>
            <button
              onClick={() => closeAgentDetail()}
              className="rounded-lg px-3 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/15"
            >
              Discard
            </button>
            <button
              onClick={async () => {
                await handleSave();
                closeAgentDetail();
              }}
              className="rounded-lg bg-amber-500/20 px-3 py-1 hover:bg-amber-500/30"
            >
              Save & close
            </button>
          </div>
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-2 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          <AlertCircle size={13} />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="rounded-lg px-2 py-0.5 hover:bg-red-500/20">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* ── Description ── */}
          <FieldGroup
            label="Description"
            icon={<Info size={14} className="text-[var(--y2k-pink)]" />}
            help="A short summary of what this agent does. Shown in the agents panel to help you identify each agent."
          >
            <input
              value={localDescription}
              onChange={(e) => {
                setLocalDescription(e.target.value);
                markDirty();
              }}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="What does this agent do…"
            />
          </FieldGroup>

          {/* ── Pipeline Phase ── */}
          <FieldGroup
            label="Pipeline Phase"
            icon={<Zap size={14} className="text-[var(--y2k-pink)]" />}
            help="When this agent runs during generation. Pre-Generation runs before the AI replies, Parallel runs alongside, Post-Processing runs after the reply is complete."
          >
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(PHASE_META) as [AgentPhase, typeof phaseMeta][]).map(([phase, meta]) => {
                const isActive = localPhase === phase;
                const Icon = meta.icon;
                return (
                  <button
                    key={phase}
                    onClick={() => {
                      setLocalPhase(phase);
                      markDirty();
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs ring-1 transition-all",
                      isActive
                        ? "bg-[var(--primary)]/10 ring-[var(--primary)] " + meta.color
                        : "ring-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    <Icon size={16} />
                    <span className="font-medium">{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-[var(--muted-foreground)]">{phaseMeta.description}</p>
          </FieldGroup>

          {/* ── Connection Override ── */}
          <FieldGroup
            label="Connection Override"
            icon={<Link2 size={14} className="text-[var(--y2k-pink)]" />}
            help="Use a different AI connection for this agent. For example, use a faster/cheaper model for background processing tasks."
          >
            <select
              value={localConnectionId}
              onChange={(e) => {
                setLocalConnectionId(e.target.value);
                markDirty();
              }}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="">Use default connection</option>
              {(connections as Array<{ id: string; name: string; provider: string }> | undefined)?.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.provider})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
              Optionally use a different API connection for this agent (e.g. a cheaper model for background tasks).
            </p>
          </FieldGroup>

          {/* ── Context Size ── */}
          <FieldGroup
            label="Context Size"
            icon={<Clock size={14} className="text-[var(--y2k-pink)]" />}
            help="How many recent chat messages this agent receives as context. More messages = more context but higher token usage. Leave blank for the default (20 messages)."
          >
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={200}
                value={localContextSize}
                onChange={(e) => {
                  const v = e.target.value;
                  setLocalContextSize(v === "" ? "" : Math.max(1, Math.min(200, parseInt(v) || 1)));
                  markDirty();
                }}
                placeholder="20"
                className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm tabular-nums ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <span className="text-[11px] text-[var(--muted-foreground)]">messages</span>
            </div>
            <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
              When agents are batched together (same model), the highest context size in the group is used.
            </p>
          </FieldGroup>

          {/* ── Inject as Prompt Section ── */}
          <FieldGroup
            label="Add as Prompt Section"
            icon={<Layers size={14} className="text-[var(--y2k-pink)]" />}
            help="When enabled, this agent's output becomes available as a marker section in prompt presets. Add the section in your preset to inject the agent's latest data into the prompt."
          >
            <button
              onClick={() => {
                setLocalInjectAsSection(!localInjectAsSection);
                markDirty();
              }}
              className="flex items-center gap-3 rounded-xl bg-[var(--secondary)] px-4 py-3 ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)]"
            >
              {localInjectAsSection ? (
                <ToggleRight size={20} className="text-emerald-400" />
              ) : (
                <ToggleLeft size={20} className="text-[var(--muted-foreground)]" />
              )}
              <div className="text-left">
                <p className="text-sm font-medium">{localInjectAsSection ? "Enabled" : "Disabled"}</p>
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  {localInjectAsSection
                    ? `"${localName}" appears as a section option in prompt presets`
                    : "Agent output is not injected into prompts"}
                </p>
              </div>
            </button>
          </FieldGroup>

          {/* ── Spotify Settings (only shown for Spotify agent) ── */}
          {(agentDetailId === "spotify" || dbConfig?.type === "spotify") && (
            <FieldGroup
              label="Spotify Connection"
              icon={<Music size={14} className="text-green-400" />}
              help="Connect your Spotify account to let this agent control playback."
            >
              <div className="space-y-3">
                {/* Client ID input */}
                <div>
                  <label className="block text-[11px] font-medium text-white/60 mb-1">Spotify Client ID</label>
                  <input
                    type="text"
                    value={localSpotifyClientId}
                    onChange={(e) => {
                      setLocalSpotifyClientId(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="Paste your Spotify app Client ID..."
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 font-mono"
                  />
                </div>

                {/* Connection status & buttons */}
                {spotifyStatus?.connected ? (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400">
                      <Check size={12} />
                      {spotifyStatus.expired ? "Connected (token expired — will auto-refresh)" : "Connected to Spotify"}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!dbConfig?.id) return;
                        await fetch("/api/spotify/disconnect", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ agentId: dbConfig.id }),
                        });
                        setSpotifyStatus({
                          connected: false,
                          expired: false,
                          redirectUri: spotifyStatus?.redirectUri ?? null,
                        });
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 transition-colors hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!localSpotifyClientId.trim() || !dbConfig?.id || spotifyConnecting}
                    onClick={async () => {
                      if (!localSpotifyClientId.trim() || !dbConfig?.id) return;
                      setSpotifyConnecting(true);
                      try {
                        // Save clientId first if dirty
                        if (dirty) {
                          await updateAgent.mutateAsync({
                            id: dbConfig.id,
                            settings: {
                              ...(dbConfig.settings
                                ? typeof dbConfig.settings === "string"
                                  ? JSON.parse(dbConfig.settings as string)
                                  : dbConfig.settings
                                : {}),
                              spotifyClientId: localSpotifyClientId,
                            },
                          });
                        }
                        const res = await fetch(
                          `/api/spotify/authorize?${new URLSearchParams({
                            clientId: localSpotifyClientId,
                            agentId: dbConfig.id,
                          })}`,
                        );
                        const data = await res.json();
                        if (data.authUrl) {
                          window.open(data.authUrl, "_blank", "width=500,height=700");
                          // Clear any existing poll before starting a new one
                          if (spotifyPollRef.current) clearInterval(spotifyPollRef.current);
                          if (spotifyTimeoutRef.current) clearTimeout(spotifyTimeoutRef.current);
                          // Poll for connection status
                          spotifyPollRef.current = setInterval(async () => {
                            try {
                              const statusRes = await fetch(
                                `/api/spotify/status?agentId=${encodeURIComponent(dbConfig.id)}`,
                              );
                              const status = await statusRes.json();
                              if (status.connected) {
                                clearInterval(spotifyPollRef.current!);
                                spotifyPollRef.current = null;
                                if (spotifyTimeoutRef.current) {
                                  clearTimeout(spotifyTimeoutRef.current);
                                  spotifyTimeoutRef.current = null;
                                }
                                setSpotifyStatus({
                                  connected: true,
                                  expired: false,
                                  redirectUri: status.redirectUri ?? null,
                                });
                                setSpotifyConnecting(false);
                              }
                            } catch {
                              // keep polling
                            }
                          }, 2000);
                          // Stop polling after 5 minutes
                          spotifyTimeoutRef.current = setTimeout(() => {
                            if (spotifyPollRef.current) {
                              clearInterval(spotifyPollRef.current);
                              spotifyPollRef.current = null;
                            }
                            spotifyTimeoutRef.current = null;
                            setSpotifyConnecting(false);
                          }, 5 * 60_000);
                        }
                      } catch {
                        setSpotifyConnecting(false);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium transition-all",
                      localSpotifyClientId.trim() && dbConfig?.id
                        ? "bg-[#1DB954] text-white hover:bg-[#1ed760] active:scale-95"
                        : "bg-white/5 text-white/30 cursor-not-allowed",
                    )}
                  >
                    <Music size={14} />
                    {spotifyConnecting ? "Waiting for authorization..." : "Connect Spotify Account"}
                  </button>
                )}

                {/* Setup instructions */}
                <div className="rounded-lg border border-green-500/10 bg-green-500/5 p-3 text-[11px] text-white/50 space-y-2">
                  <p className="font-medium text-green-400/80">Setup:</p>
                  <ol className="list-decimal list-inside space-y-1 text-white/40">
                    <li>
                      Go to the{" "}
                      <a
                        href="https://developer.spotify.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        Spotify Developer Dashboard <ExternalLink size={9} />
                      </a>
                    </li>
                    <li>Create a new app — select &quot;Web API&quot;</li>
                    <li>
                      In Redirect URIs, add:{" "}
                      <code className="text-white/50 select-all">
                        {spotifyStatus?.redirectUri ?? `http://127.0.0.1:7860/api/spotify/callback`}
                      </code>
                    </li>
                    <li>
                      Copy the <strong>Client ID</strong> and paste it above
                    </li>
                    <li>
                      Save the agent, then click <strong>Connect Spotify Account</strong>
                    </li>
                  </ol>
                  <p className="text-[10px] text-white/30 mt-1">
                    Requires Spotify Premium. Tokens refresh automatically — no need to reconnect.
                  </p>
                </div>
              </div>
            </FieldGroup>
          )}

          {/* ── Prompt Template ── */}
          <FieldGroup
            label="Prompt Template"
            icon={<FileText size={14} className="text-[var(--y2k-pink)]" />}
            help="The system instructions this agent receives. Built-in agents have sensible defaults. You can override to customize behavior."
          >
            {/* Toolbar — only show default/override status for built-in agents */}
            {builtIn && (
              <div className="flex items-center gap-2 mb-2">
                {isUsingDefaultPrompt ? (
                  <span className="flex items-center gap-1 rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                    <Check size={10} /> Using built-in default
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-lg bg-amber-400/10 px-2.5 py-1 text-[10px] font-medium text-amber-400">
                    <FileText size={10} /> Custom override
                  </span>
                )}
                <div className="flex-1" />
                {!isUsingDefaultPrompt && (
                  <button
                    onClick={handleResetPrompt}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    <RotateCcw size={10} /> Reset to default
                  </button>
                )}
                {isUsingDefaultPrompt && defaultPrompt && (
                  <button
                    onClick={handleLoadDefault}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    <FileText size={10} /> Copy default to edit
                  </button>
                )}
              </div>
            )}

            {builtIn && isUsingDefaultPrompt ? (
              <div className="relative">
                <pre className="w-full max-h-[50vh] overflow-y-auto resize-y rounded-xl bg-[var(--secondary)] px-4 py-3 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] text-[var(--muted-foreground)] whitespace-pre-wrap">
                  {defaultPrompt || "No default prompt."}
                </pre>
                <span className="absolute right-3 top-2 rounded-md bg-[var(--card)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  Default — click "Copy default to edit" to customize
                </span>
              </div>
            ) : (
              <textarea
                value={localPrompt}
                onChange={(e) => {
                  setLocalPrompt(e.target.value);
                  markDirty();
                }}
                rows={16}
                placeholder="Write the system prompt for this agent…"
                className="w-full resize-y rounded-xl bg-[var(--secondary)] px-4 py-3 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] max-h-[60vh] overflow-y-auto"
              />
            )}
            <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
              {builtIn
                ? "Leave empty to use the built-in default prompt. Edit to override with your own instructions."
                : "Write the full system prompt for this custom agent."}
            </p>

            {/* Default prompt preview removed — now shown inline above */}
          </FieldGroup>

          {/* ── Available Tools (Function Calling) ── */}
          <FieldGroup
            label="Tools / Function Calling"
            icon={<Wrench size={14} className="text-[var(--y2k-pink)]" />}
            help="Select which tools this agent can use during generation. The AI can call these functions and receive results back for multi-step interactions."
          >
            <p className="text-[10px] text-[var(--muted-foreground)] mb-3">
              Toggle tools on or off for this agent. When enabled for a chat, only selected tools will be available
              during generation.
            </p>
            <div className="space-y-2">
              {BUILT_IN_TOOLS.map((tool: ToolDefinition) => (
                <ToolCard
                  key={tool.name}
                  tool={tool}
                  enabled={localEnabledTools.includes(tool.name)}
                  onToggle={(name) => {
                    setLocalEnabledTools((prev) =>
                      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                    );
                    markDirty();
                  }}
                />
              ))}
              {(customToolsRaw as CustomToolRow[] | undefined)
                ?.filter((t) => t.enabled === "true")
                .map((tool) => (
                  <ToolCard
                    key={tool.name}
                    tool={{
                      name: tool.name,
                      description: tool.description,
                      parameters: JSON.parse(tool.parametersSchema || "{}"),
                    }}
                    enabled={localEnabledTools.includes(tool.name)}
                    onToggle={(name) => {
                      setLocalEnabledTools((prev) =>
                        prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                      );
                      markDirty();
                    }}
                    isCustom
                  />
                ))}
            </div>
            <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
              Tool-use must also be enabled per chat via Chat Settings → "Enable Function Calling".
            </p>
          </FieldGroup>

          {/* ── Agent Info Card ── */}
          <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
            <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)]">About this Agent</h3>
            <div className="space-y-1.5 text-[11px] text-[var(--muted-foreground)]">
              <p>
                <strong className="text-[var(--foreground)]">Type:</strong> {isCustomAgent ? "Custom" : agentDetailId}
              </p>
              <p>
                <strong className="text-[var(--foreground)]">Phase:</strong> {phaseMeta.label} — {phaseMeta.description}
              </p>
              <p>
                <strong className="text-[var(--foreground)]">DB Status:</strong>{" "}
                {dbConfig ? `Persisted (ID: ${dbConfig.id})` : "Not yet saved — click Save to persist"}
              </p>
              {builtIn && (
                <p>
                  <strong className="text-[var(--foreground)]">Enabled:</strong>{" "}
                  {dbConfig
                    ? dbConfig.enabled === "true"
                      ? "Yes"
                      : "No"
                    : builtIn.enabledByDefault
                      ? "Yes (default)"
                      : "No (default)"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Shared Components
// ═══════════════════════════════════════════════

function FieldGroup({
  label,
  icon,
  help,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-semibold text-[var(--foreground)]">{label}</h3>
        {help && <HelpTooltip text={help} />}
      </div>
      {children}
    </div>
  );
}

function ToolCard({
  tool,
  enabled,
  onToggle,
  isCustom,
}: {
  tool: ToolDefinition;
  enabled: boolean;
  onToggle: (name: string) => void;
  isCustom?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const params = tool.parameters.properties ?? {};
  const required = tool.parameters.required ?? [];

  return (
    <div
      className={cn(
        "rounded-xl ring-1 overflow-hidden transition-all",
        enabled ? "ring-[var(--primary)]/50 bg-[var(--primary)]/5" : "ring-[var(--border)] bg-[var(--card)]",
      )}
    >
      <div className="flex w-full items-center gap-2.5 px-3 py-2.5">
        <button onClick={() => onToggle(tool.name)} className="shrink-0">
          {enabled ? (
            <ToggleRight size={20} className="text-[var(--primary)]" />
          ) : (
            <ToggleLeft size={20} className="text-[var(--muted-foreground)]" />
          )}
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
        >
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
              isCustom
                ? "bg-[var(--y2k-pink)]/15 text-[var(--y2k-pink)]"
                : "bg-[var(--y2k-purple)]/15 text-[var(--y2k-purple)]",
            )}
          >
            <Wrench size={12} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold font-mono text-[var(--foreground)]">
              {tool.name}
              {isCustom && <span className="ml-1.5 text-[9px] font-normal text-[var(--y2k-pink)]">custom</span>}
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)] truncate">{tool.description}</p>
          </div>
          <span className="text-[10px] text-[var(--muted-foreground)]">{expanded ? "▲" : "▼"}</span>
        </button>
      </div>
      {expanded && (
        <div className="border-t border-[var(--border)] px-3 py-2.5 space-y-1.5">
          <p className="text-[10px] font-medium text-[var(--muted-foreground)]">Parameters:</p>
          {Object.entries(params).map(([name, prop]) => {
            const p = prop as { type?: string; description?: string; enum?: string[] };
            const isRequired = required.includes(name);
            return (
              <div key={name} className="flex items-start gap-2 text-[11px]">
                <code className="shrink-0 rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--foreground)]">
                  {name}
                  {isRequired && <span className="text-red-400">*</span>}
                </code>
                <span className="text-[var(--muted-foreground)]">
                  <span className="text-[var(--y2k-pink)]">{p.type}</span>
                  {p.description && ` — ${p.description}`}
                  {p.enum && <span className="ml-1 text-[10px]">[{p.enum.join(", ")}]</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
