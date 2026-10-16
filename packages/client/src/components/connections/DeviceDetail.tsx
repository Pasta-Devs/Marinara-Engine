// ──────────────────────────────────────────────
// DeviceDetail — the "On this device" engines in the Connections panel (decisions 32 + 33): Local Model, Text to
// Speech and Speech to Text. A row in the list once set up, and a detail page with the same anatomy as a
// Connection's: hero with state, labelled actions, one facts card, then the engine's own controls.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  ChevronDown,
  HardDriveDownload,
  Link,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  getDefaultAgentPrompt,
  type SidecarQuantization,
  type SidecarSpeechModelId,
  type SidecarSpeechRuntimeDiagnostics,
} from "@marinara-engine/shared";
import { useAgentConfigs, useCreateAgent, useUpdateAgent } from "../../hooks/use-agents";
import {
  selectVisibleTrackerCapabilityAgents,
  useCapabilityAgentRegistry,
  useInstalledCapabilityPackages,
} from "../../hooks/use-capability-packages";
import { useDefaultEmbeddingConnection } from "../../hooks/use-connections";
import { useDecisionOptions } from "../../hooks/use-decision-model";
import { useDeviceSetup, type DeviceItem } from "../../hooks/use-device-setup";
import { useTTSConfig } from "../../hooks/use-tts";
import { GEMMA_RESTART_MESSAGE, useSidecarStore } from "../../stores/sidecar.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { DecisionModelModal } from "../modals/DecisionModelModal";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { SpeechToTextCard } from "../panels/settings/SpeechToTextCard";
import { TTSConfigCard } from "../panels/settings/TTSConfigCard";
import { ProviderIcon } from "./ProviderIcon";

const isLite = import.meta.env.VITE_MARINARA_LITE === "true";

export const SMALL_ACTION =
  "mari-chrome-control mari-chrome-control--small text-[0.6875rem] max-md:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";
/** The facts and models card of a detail page, coloured from the Connections panel tokens. */
export const DETAIL_CARD_CLASS =
  "mari-panel-gradient--connections rounded-xl border border-[color-mix(in_srgb,var(--mari-panel-gradient-start)_20%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--mari-panel-gradient-start)_5%,transparent),color-mix(in_srgb,var(--mari-panel-gradient-end)_5%,transparent))] p-3";

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function describeSpeechRuntimeUnavailable(
  runtime: SidecarSpeechRuntimeDiagnostics | null,
  localizeUi: TFunction,
): string {
  if (!runtime) {
    return localizeUi("connections.device.whisper.runtimeMissing");
  }

  const runtimeTuple = `${runtime.platform}/${runtime.arch}`;
  const installed =
    runtime.installedBindingArchs.length > 0
      ? runtime.installedBindingArchs.map((arch) => `${runtime.platform}/${arch}`).join(", ")
      : "";

  if (runtime.liteMode) {
    return localizeUi("connections.device.whisper.liteMode");
  }

  if (!runtime.packageFound) {
    return localizeUi("connections.device.whisper.noPackage", { node: runtime.nodeVersion, tuple: runtimeTuple });
  }

  if (installed && !runtime.installedBindingArchs.includes(runtime.arch)) {
    return localizeUi("connections.device.whisper.archMismatch", { tuple: runtimeTuple, installed });
  }

  return localizeUi("connections.device.whisper.runtimeNotFound", { tuple: runtimeTuple });
}

function formatRuntimeVariantLabel(variant: string | null): string | null {
  if (!variant) return null;
  return variant.replace(/-/g, " ");
}

const QUANT_LABEL: Record<SidecarQuantization, string> = { q4_k_m: "Q4", q8_0: "Q8" };

export type EngineTone = "ok" | "warn" | "off";
export const TONE_DOT: Record<EngineTone, string> = {
  ok: "bg-emerald-400",
  warn: "bg-[var(--marinara-app-accent-static)]",
  off: "bg-[var(--muted-foreground)]",
};

/** A coloured dot and one word, the state on a row or a hero. */
export function StateWord({ tone, label }: { tone: EngineTone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1",
        tone === "warn" && "text-[var(--marinara-app-accent-static)]",
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} />
      {label}
    </span>
  );
}

export function DetailHero({
  icon,
  title,
  children,
  dim = false,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  dim?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn(dim && "opacity-50")}>{icon}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold leading-tight [overflow-wrap:anywhere] text-[var(--foreground)]">
          {title}
        </h3>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-3 text-xs">
      <span className="w-20 shrink-0 text-[var(--muted-foreground)]">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export type DeviceEngine = {
  item: DeviceItem;
  name: string;
  tone: EngineTone;
  state: string;
  detail: string;
  fix?: { label: string; run: () => void };
};

/** The engines set up on this device, with the state their row shows and its one inline fix. */
export function useDeviceEngines(): DeviceEngine[] {
  const { t } = useTranslation();
  const setup = useDeviceSetup();
  const status = useSidecarStore((s) => s.status);
  const inferenceReady = useSidecarStore((s) => s.inferenceReady);
  const startupError = useSidecarStore((s) => s.startupError);
  const modelDisplayName = useSidecarStore((s) => s.modelDisplayName);
  const quantization = useSidecarStore((s) => s.config.quantization);
  const { data: tts } = useTTSConfig();

  const engines: DeviceEngine[] = [];
  if (setup["local-model"].setUp) {
    const sidecar = useSidecarStore.getState();
    const model = [modelDisplayName, quantization ? QUANT_LABEL[quantization] : null].filter(Boolean).join(" ");
    const base = { item: "local-model" as const, name: t("connections.add.device.local_model"), detail: model };
    if (status === "server_error" || startupError) {
      engines.push({
        ...base,
        tone: "warn",
        state: t("connections.device.state.error"),
        fix: { label: t("connections.device.retry"), run: () => void sidecar.restartRuntime() },
      });
    } else if (status === "starting_server" || status === "downloading_model" || status === "downloading_runtime") {
      engines.push({ ...base, tone: "off", state: t("connections.device.state.starting") });
    } else if (inferenceReady) {
      engines.push({ ...base, tone: "ok", state: t("connections.device.state.running") });
    } else {
      engines.push({
        ...base,
        tone: "off",
        state: t("connections.device.state.notLoaded"),
        fix: {
          label: t("connections.device.load"),
          run: () =>
            void sidecar
              .loadModel()
              .catch((error: unknown) =>
                toast.error(
                  error instanceof Error ? error.message : t("ui.panels.sidecarcard.failedToChangeLocalModelLoadState"),
                ),
              ),
        },
      });
    }
  }
  if (setup.tts.setUp) {
    engines.push({
      item: "tts",
      name: t("connections.add.device.tts"),
      tone: "ok",
      state: t("connections.accounts.state.ok"),
      detail: tts ? t(`connections.device.ttsSource.${tts.source}`) : "",
    });
  }
  if (setup.stt.setUp) {
    engines.push({
      item: "stt",
      name: t("connections.add.device.stt"),
      tone: "ok",
      state: t("connections.accounts.state.ok"),
      detail: t("connections.add.device.stt"),
    });
  }
  return engines;
}

/** The Local Model's page: state, load, model variant, memory, what uses it, and its helper settings. */
function LocalModelDetail({ onOpenDefaults }: { onOpenDefaults: () => void }) {
  const { t: localizeUi } = useTranslation();
  /** The managed decision model installer, opened from inside this page. */
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const { data: agentConfigs } = useAgentConfigs();
  const { data: capabilityAgents } = useCapabilityAgentRegistry();
  const createAgent = useCreateAgent();
  const updateAgentConnection = useUpdateAgent();
  const embeddingDefault = useDefaultEmbeddingConnection();
  const decisionOptions = useDecisionOptions();
  const {
    status,
    config,
    inferenceReady,
    modelDownloaded,
    modelDisplayName,
    modelSize,
    startupError,
    failedRuntimeVariant,
    curatedModels,
    downloadProgress,
    setShowDownloadModal,
    startDownload,
    loadModel,
    unloadModel,
    restartRuntime,
    updateConfig,
    fetchStatus,
  } = useSidecarStore();
  const isDownloaded = modelDownloaded;
  const [assigningTrackers, setAssigningTrackers] = useState(false);
  const [changingModelLoadState, setChangingModelLoadState] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const backendLabel = config.backend === "mlx" ? "MLX" : "GGUF";
  const trackerAgents = useMemo(() => selectVisibleTrackerCapabilityAgents(capabilityAgents), [capabilityAgents]);
  const trackerLocalCount = useMemo(() => {
    const configs = (agentConfigs ?? []) as Array<{ type: string; connectionId: string | null }>;
    const byType = new Map(configs.map((cfg) => [cfg.type, cfg.connectionId]));
    return trackerAgents.filter((agent) => byType.get(agent.id) === LOCAL_SIDECAR_CONNECTION_ID).length;
  }, [agentConfigs, trackerAgents]);

  // Fetch status on mount (handles HMR store resets and initial load)
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleAssignTrackersToLocal = async () => {
    if (!isDownloaded || assigningTrackers) return;

    setAssigningTrackers(true);
    try {
      const configs = (agentConfigs ?? []) as Array<{
        id: string;
        type: string;
        connectionId: string | null;
      }>;
      const configByType = new Map(configs.map((cfg) => [cfg.type, cfg]));

      await Promise.all(
        trackerAgents.map(async (agent) => {
          const existing = configByType.get(agent.id);
          if (existing) {
            if (existing.connectionId === LOCAL_SIDECAR_CONNECTION_ID) return;
            await updateAgentConnection.mutateAsync({ id: existing.id, connectionId: LOCAL_SIDECAR_CONNECTION_ID });
            return;
          }

          await createAgent.mutateAsync({
            type: agent.id,
            name: agent.name,
            description: agent.description,
            phase: agent.phase,
            enabled: true,
            connectionId: LOCAL_SIDECAR_CONNECTION_ID,
            promptTemplate: getDefaultAgentPrompt(agent.id),
            settings: {},
          });
        }),
      );

      toast.success(localizeUi("ui.panels.sidecarcard.allBuiltInTrackerAgentsNowPointToThe"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi("ui.panels.sidecarcard.failedToUpdateTrackerAgentConnections"),
      );
    } finally {
      setAssigningTrackers(false);
    }
  };

  const handleModelLoadToggle = async () => {
    if (changingModelLoadState) return;
    setChangingModelLoadState(true);
    try {
      if (inferenceReady) {
        await unloadModel();
        toast.success(localizeUi("ui.panels.sidecarcard.localModelUnloaded"));
      } else {
        await loadModel();
        toast.success(localizeUi("ui.panels.sidecarcard.localModelLoaded"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.panels.sidecarcard.failedToChangeLocalModelLoadState"),
      );
    } finally {
      setChangingModelLoadState(false);
    }
  };

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await restartRuntime();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("connections.device.retryFailed"));
    } finally {
      setRetrying(false);
    }
  };

  const openLocalModelSettings = () => {
    void fetchStatus();
    setShowDownloadModal(true);
  };

  const handleDownloadNow = async () => {
    const quantization =
      curatedModels.find((model) => model.quantization === "q4_k_m")?.quantization ??
      curatedModels[0]?.quantization ??
      "q4_k_m";
    if (await startDownload(quantization)) {
      toast.success(GEMMA_RESTART_MESSAGE);
    }
  };

  const variants = curatedModels.filter((model) => model.backend === config.backend);
  const active = variants.find((model) => model.quantization === config.quantization);
  const switchVariant = async (quantization: SidecarQuantization, sizeBytes: number) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("connections.device.switchVariant", { variant: QUANT_LABEL[quantization] }),
      message: localizeUi("connections.device.switchVariantConfirm", { size: formatBytes(sizeBytes) }),
      confirmLabel: localizeUi("ui.panels.sidecarcard.download"),
    });
    if (confirmed && (await startDownload(quantization))) toast.success(GEMMA_RESTART_MESSAGE);
  };

  const decisionSlot = decisionOptions.data?.options.find((entry) => entry.selected)?.slot;
  const usedBy = [
    config.useAsAgentsDefault && localizeUi("connections.defaults.role.agents"),
    config.useForTrackers && localizeUi("connections.device.usedBy.trackers"),
    config.useForGameScene && localizeUi("connections.device.usedBy.gameScene"),
    embeddingDefault.data?.connectionId === LOCAL_SIDECAR_CONNECTION_ID &&
      localizeUi("connections.defaults.role.embeddings"),
    decisionSlot === "primary" && localizeUi("connections.defaults.role.decision"),
  ].filter((entry): entry is string => !!entry);

  const isDownloading = downloadProgress?.status === "downloading";
  const busy = changingModelLoadState || status === "starting_server";
  const failed = status === "server_error" || !!startupError;
  const state: { tone: EngineTone; label: string } = failed
    ? { tone: "warn", label: localizeUi("connections.device.state.error") }
    : status === "starting_server"
      ? { tone: "off", label: localizeUi("connections.device.state.starting") }
      : inferenceReady
        ? { tone: "ok", label: localizeUi("connections.device.state.running") }
        : isDownloaded
          ? { tone: "off", label: localizeUi("connections.device.state.notLoaded") }
          : { tone: "off", label: localizeUi("connections.device.state.notDownloaded") };

  return (
    <div className="flex flex-col gap-3">
      <DetailHero
        icon={<ProviderIcon provider="local-model" size="lg" />}
        title={localizeUi("ui.panels.sidecarcard.localModel")}
      >
        <StateWord tone={state.tone} label={state.label} />
        <span>· {localizeUi("connections.accounts.section.device")}</span>
      </DetailHero>
      <div className="flex flex-wrap gap-1.5">
        {isDownloaded && (
          <button type="button" onClick={() => void handleModelLoadToggle()} disabled={busy} className={SMALL_ACTION}>
            {busy ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : inferenceReady ? (
              <PowerOff size="0.75rem" />
            ) : (
              <Power size="0.75rem" />
            )}
            {busy
              ? localizeUi("ui.panels.sidecarcard.changingLocalModelState")
              : inferenceReady
                ? localizeUi("ui.panels.sidecarcard.unloadLocalModel")
                : localizeUi("ui.panels.sidecarcard.loadLocalModel")}
          </button>
        )}
        <button type="button" onClick={() => void retry()} disabled={retrying} className={SMALL_ACTION}>
          <RefreshCw size="0.75rem" className={cn(retrying && "animate-spin")} />
          {localizeUi("connections.device.retry")}
        </button>
        <button type="button" onClick={openLocalModelSettings} className={SMALL_ACTION}>
          <Settings2 size="0.75rem" />
          {localizeUi("connections.device.runtimeSettings")}
        </button>
      </div>

      {failed && (
        <div
          className="rounded-lg border border-[var(--marinara-app-accent-static)]/20 bg-[var(--marinara-app-accent-static)]/5 p-2.5"
          role="alert"
        >
          <div className="text-[0.6875rem] font-medium text-[var(--marinara-app-accent-static)]">
            {localizeUi("ui.panels.sidecarcard.localRuntimeUnavailable")}
          </div>
          <div className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
            {startupError ?? localizeUi("connections.device.keepsRunning")}
          </div>
          {failedRuntimeVariant && (
            <div className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]/80">
              {localizeUi("ui.panels.sidecarcard.runtime")} {formatRuntimeVariantLabel(failedRuntimeVariant)}
            </div>
          )}
        </div>
      )}

      <section className={DETAIL_CARD_CLASS}>
        <FactRow label={localizeUi("connections.device.fact.model")}>
          <span className="block">{modelDisplayName ?? localizeUi("connections.device.state.notDownloaded")}</span>
          {variants.length > 1 && (
            <span className="mt-1 flex flex-wrap gap-1">
              {variants.map((variant) => {
                const current = variant.quantization === config.quantization;
                return (
                  <button
                    key={variant.quantization}
                    type="button"
                    aria-pressed={current}
                    disabled={current || isDownloading}
                    onClick={() => void switchVariant(variant.quantization, variant.sizeBytes)}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-[0.6875rem] max-md:min-h-11",
                      current
                        ? "border-[var(--primary)]/50 bg-[var(--accent)] font-medium"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)]",
                    )}
                  >
                    {QUANT_LABEL[variant.quantization]} · {formatBytes(variant.sizeBytes)}
                  </button>
                );
              })}
            </span>
          )}
        </FactRow>
        <FactRow label={localizeUi("connections.device.fact.memory")}>
          {active
            ? localizeUi("connections.device.memory", { size: formatBytes(active.ramBytes), backend: backendLabel })
            : modelSize
              ? localizeUi("connections.device.sizeBackend", { size: formatBytes(modelSize), backend: backendLabel })
              : backendLabel}
        </FactRow>
        <FactRow label={localizeUi("connections.device.fact.usedBy")}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{usedBy.length ? usedBy.join(", ") : localizeUi("connections.device.usedBy.none")}</span>
            <button type="button" onClick={onOpenDefaults} className={SMALL_ACTION}>
              {localizeUi("connections.device.changeInDefaults")}
            </button>
          </span>
        </FactRow>
      </section>

      <div className="rounded-lg border border-[var(--marinara-app-accent-static)]/30 bg-[var(--marinara-app-accent-static)]/10 p-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--marinara-app-accent-static)]">
          <AlertTriangle size="0.875rem" className="shrink-0" />
          {localizeUi("ui.panels.sidecarcard.localModelIsNotForRoleplay")}
        </div>
        <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
          {localizeUi("ui.panels.sidecarcard.theBundledLocalModelIsIntentionallySmallUseIt")}
        </p>
      </div>

      {isDownloaded ? (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => void handleAssignTrackersToLocal()}
            disabled={assigningTrackers}
            className="mari-chrome-control w-full justify-between gap-3 px-3 py-2 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">
                {localizeUi("ui.panels.sidecarcard.useLocalModelForAllTrackerAgents")}
              </div>
              <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.sidecarcard.assignsTheBuiltInLocalModelAsTheConnection")}
              </div>
            </div>
            {assigningTrackers ? (
              <BrainCircuit size="0.875rem" className="animate-pulse text-sky-300" />
            ) : (
              <Link size="0.875rem" className="text-sky-300" />
            )}
          </button>
          <p className="px-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
            {trackerLocalCount}/{trackerAgents.length}{" "}
            {localizeUi("ui.panels.sidecarcard.builtInTrackerAgentsCurrentlyPointAtTheLocal")}
          </p>
          <SettingsSwitch
            label={localizeUi("ui.panels.sidecarcard.useForTrackerAgentsRoleplay")}
            checked={config.useForTrackers}
            onChange={(checked) => updateConfig({ useForTrackers: checked })}
            className="p-0 hover:bg-transparent"
            labelClassName="text-xs text-[var(--muted-foreground)]"
          />
          <SettingsSwitch
            label={localizeUi("ui.panels.sidecarcard.useForGameSceneAnalysis")}
            checked={config.useForGameScene}
            onChange={(checked) => updateConfig({ useForGameScene: checked })}
            className="p-0 hover:bg-transparent"
            labelClassName="text-xs text-[var(--muted-foreground)]"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleDownloadNow}
          disabled={isDownloading}
          className="mari-chrome-control w-full px-3 py-2 text-xs"
        >
          {isDownloading
            ? localizeUi("ui.panels.sidecarcard.downloading")
            : localizeUi("ui.panels.sidecarcard.downloadNow")}
        </button>
      )}
      {/* The decision sidecar is its own model and its own process, so it does not wait for a chat model. */}
      <button
        type="button"
        onClick={() => setDecisionModalOpen(true)}
        className="mari-chrome-control mari-chrome-control--compact w-full text-center"
      >
        {localizeUi("ui.panels.sidecarcard.decisionSidecar")}
      </button>
      <DecisionModelModal open={decisionModalOpen} onClose={() => setDecisionModalOpen(false)} />
    </div>
  );
}

/** Local Whisper: the speech model Speech to Text can run on this device (Calls package only). */
export function LocalWhisper() {
  const { t: localizeUi } = useTranslation();
  const {
    speechStatus,
    speechAvailable,
    speechModelDownloaded,
    speechModelDisplayName,
    speechModelSize,
    speechModels,
    speechRuntime,
    speechDownloadProgress,
    speechError,
    startSpeechDownload,
    deleteSpeechModel,
    fetchSpeechStatus,
  } = useSidecarStore();
  const [speechModelChoice, setSpeechModelChoice] = useState<SidecarSpeechModelId>("whisper_tiny");
  const [deletingSpeechModel, setDeletingSpeechModel] = useState(false);

  useEffect(() => {
    fetchSpeechStatus();
  }, [fetchSpeechStatus]);

  useEffect(() => {
    const firstModel = speechModels[0]?.id;
    if (firstModel && !speechModels.some((model) => model.id === speechModelChoice)) {
      setSpeechModelChoice(firstModel);
    }
  }, [speechModelChoice, speechModels]);

  const handleDeleteSpeechModel = async () => {
    if (deletingSpeechModel) return;
    setDeletingSpeechModel(true);
    try {
      await deleteSpeechModel();
      toast.success(localizeUi("ui.panels.sidecarcard.localWhisperModelDeleted"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.panels.sidecarcard.failedToDeleteTheLocalWhisperModel"),
      );
    } finally {
      setDeletingSpeechModel(false);
    }
  };

  const speechDownloading = speechDownloadProgress?.status === "downloading" || speechStatus === "downloading_model";
  const activeSpeechModel = speechModels.find((model) => model.id === speechModelChoice) ?? speechModels[0];
  const speechStatusLabel = speechModelDownloaded
    ? [
        speechModelDisplayName ?? "Whisper",
        localizeUi(
          `connections.device.whisper.${speechStatus === "ready" || speechStatus === "loading" ? speechStatus : "downloaded"}`,
        ),
        ...(speechModelSize ? [formatBytes(speechModelSize)] : []),
      ].join(" • ")
    : speechAvailable
      ? localizeUi("connections.device.state.notDownloaded")
      : localizeUi("connections.device.whisper.unavailable");

  const handleDownloadWhisper = async () => {
    if (!activeSpeechModel || speechDownloading) return;
    if (await startSpeechDownload(activeSpeechModel.id)) {
      toast.success(
        localizeUi("ui.panels.sidecarcard.whisperDownloadedCompletelyRestartMarinaraEngineBeforeUsingCalls"),
      );
    }
  };

  return (
    <section className={DETAIL_CARD_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-[var(--foreground)]">
          {localizeUi("ui.panels.sidecarcard.localSpeechModel")}
        </div>
        {speechModelDownloaded && (
          <button
            type="button"
            onClick={() => void handleDeleteSpeechModel()}
            disabled={deletingSpeechModel}
            className="mari-chrome-control mari-chrome-control--small p-1 max-md:min-h-11 max-md:min-w-11"
            title={localizeUi("ui.panels.sidecarcard.deleteLocalWhisper")}
            aria-label={localizeUi("ui.panels.sidecarcard.deleteLocalWhisper")}
          >
            {deletingSpeechModel ? <Loader2 size="0.75rem" className="animate-spin" /> : <Trash2 size="0.75rem" />}
          </button>
        )}
      </div>
      <div className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">{speechStatusLabel}</div>
      {!speechAvailable && (
        <div className="mt-1 space-y-1">
          <p className="text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
            {describeSpeechRuntimeUnavailable(speechRuntime, localizeUi)}
          </p>
          {speechRuntime && (
            <p className="text-[0.59375rem] leading-relaxed text-[var(--muted-foreground)]/80">
              {localizeUi("ui.panels.sidecarcard.node")} {speechRuntime.nodeVersion}{" "}
              {localizeUi("ui.panels.sidecarcard.at")} {speechRuntime.nodeExecPath}
            </p>
          )}
        </div>
      )}
      {!speechModelDownloaded && speechAvailable && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="relative">
            <select
              value={speechModelChoice}
              onChange={(event) => setSpeechModelChoice(event.target.value as SidecarSpeechModelId)}
              className="mari-chrome-field h-8 w-full min-w-0 appearance-none pl-2.5 pr-8 text-xs max-md:h-11"
              aria-label={localizeUi("ui.panels.sidecarcard.localSpeechModel")}
              disabled={speechDownloading || speechModels.length === 0}
            >
              {speechModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size="0.875rem"
              aria-hidden="true"
              className="mari-chrome-field-icon pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            />
          </div>
          {activeSpeechModel && (
            <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
              {activeSpeechModel.description} {localizeUi("ui.noodle.stageprofileview.about")}{" "}
              {formatBytes(activeSpeechModel.sizeBytes)} {localizeUi("ui.panels.sidecarcard.download")}{" "}
              {formatBytes(activeSpeechModel.ramBytes)} {localizeUi("ui.panels.sidecarcard.ramWhileRunning")}
            </p>
          )}
          <button
            type="button"
            onClick={handleDownloadWhisper}
            disabled={speechDownloading || !activeSpeechModel}
            className="mari-chrome-control w-full justify-center px-3 py-2 text-xs"
          >
            <HardDriveDownload size="0.8125rem" className={cn(speechDownloading && "animate-pulse")} />
            {speechDownloading
              ? localizeUi("ui.panels.sidecarcard.downloadingWhisper")
              : localizeUi("ui.panels.sidecarcard.downloadWhisper")}
          </button>
        </div>
      )}
      {speechDownloading && speechDownloadProgress && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-sky-400/10">
            <div
              className="h-full rounded-full bg-sky-300 transition-[width]"
              style={{
                width: `${
                  speechDownloadProgress.total > 0
                    ? Math.min(
                        100,
                        Math.round((speechDownloadProgress.downloaded / speechDownloadProgress.total) * 100),
                      )
                    : 12
                }%`,
              }}
            />
          </div>
          <div className="mt-1 truncate text-[0.625rem] text-[var(--muted-foreground)]">
            {speechDownloadProgress.label ?? localizeUi("connections.device.whisper.downloading")}
          </div>
        </div>
      )}
      {speechError && (
        <div className="mt-2 rounded-md border border-[var(--marinara-app-accent-static)]/20 bg-[var(--marinara-app-accent-static)]/10 px-2 py-1.5 text-[0.625rem] text-[var(--marinara-app-accent-static)]">
          {speechError}
        </div>
      )}
    </section>
  );
}

/** One "On this device" engine's page. */
export function DeviceDetail({ item, onOpenDefaults }: { item: DeviceItem; onOpenDefaults: () => void }) {
  const { t } = useTranslation();
  const engine = useDeviceEngines().find((entry) => entry.item === item);
  const { data: installedPackages } = useInstalledCapabilityPackages();
  const callsInstalled = (installedPackages ?? []).some(
    (entry) => entry.status !== "error" && entry.manifest.kind.includes("conversation-calls"),
  );
  if (item === "local-model") return isLite ? null : <LocalModelDetail onOpenDefaults={onOpenDefaults} />;
  return (
    <div className="flex flex-col gap-3">
      <DetailHero
        icon={<ProviderIcon provider={item} size="lg" />}
        title={t(item === "tts" ? "connections.add.device.tts" : "connections.add.device.stt")}
      >
        {engine ? (
          <StateWord tone={engine.tone} label={engine.state} />
        ) : (
          <StateWord tone="off" label={t("connections.accounts.state.off")} />
        )}
        <span>· {engine?.detail || t("connections.accounts.section.device")}</span>
      </DetailHero>
      {item === "tts" ? <TTSConfigCard defaultExpanded /> : <SpeechToTextCard defaultExpanded />}
      {item === "stt" && callsInstalled && !isLite && <LocalWhisper />}
    </div>
  );
}
