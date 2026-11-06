// ──────────────────────────────────────────────
// Model Download Modal
//
// Handles curated Gemma downloads plus BYO
// HuggingFace model selection for the local
// sidecar runtime.
// ──────────────────────────────────────────────

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  Info,
  Loader2,
  MessageSquare,
  RotateCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  SIDECAR_EMBEDDING_POOLING_TYPES,
  type SidecarEmbeddingPooling,
  type SidecarQuantization,
  type SidecarRuntimePreference,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal.js";
import { GEMMA_RESTART_MESSAGE, useSidecarStore, type SidecarTestMessageResult } from "../../stores/sidecar.store.js";
import { cn } from "../../lib/utils";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { PRIMARY_CLASS as PRIMARY, SECONDARY_CLASS } from "./create-connection/shared";
import type { TFunction } from "i18next";
import { useTranslation as useUiTranslation } from "react-i18next";
import { api } from "../../lib/api-client.js";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Render the content in place (inside the Add window) instead of in its own dialog. */
  embedded?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatRuntimeVariantLabel(variant: string | null): string | null {
  if (!variant) return null;
  return variant.replace(/-/g, " ");
}

function formatRuntimePreferenceLabel(preference: SidecarRuntimePreference, t: TFunction, platform?: string): string {
  switch (preference) {
    case "auto":
      return t("connections.device.runtime.auto");
    case "nvidia":
      return platform === "linux"
        ? t("connections.device.runtime.nvidiaVulkan")
        : t("connections.device.runtime.nvidiaCuda");
    case "amd":
      return t("connections.device.runtime.amd");
    case "intel":
      return t("connections.device.runtime.intel");
    case "vulkan":
      return t("connections.device.runtime.vulkan");
    case "cpu":
      return t("connections.device.runtime.cpu");
    case "system":
      return t("connections.device.runtime.system");
    default:
      return preference;
  }
}

function describeGpuLayers(gpuLayers: number, t: TFunction): string {
  if (gpuLayers === -1) return t("connections.device.runtime.autoOffload");
  if (gpuLayers === 0) return t("connections.device.runtime.cpu");
  return t("connections.device.runtime.gpuLayers", { count: gpuLayers });
}

function formatEmbeddingPoolingLabel(pooling: SidecarEmbeddingPooling, t: TFunction): string {
  switch (pooling) {
    case "none":
      return t("connections.device.pooling.none");
    case "mean":
      return t("connections.device.pooling.mean");
    case "cls":
      return t("connections.device.pooling.cls");
    case "last":
      return t("connections.device.pooling.last");
    case "rank":
      return t("connections.device.pooling.rank");
    default:
      return pooling;
  }
}

function formatCompactTokens(value: number): string {
  if (value >= 1000) {
    const shortened = value / 1000;
    return `${Number.isInteger(shortened) ? shortened.toFixed(0) : shortened.toFixed(1)}k`;
  }
  return String(value);
}

function getRuntimePreferenceOptions(platform: string, arch: string): SidecarRuntimePreference[] {
  if (platform === "win32" && arch === "x64") {
    return ["auto", "nvidia", "amd", "intel", "vulkan", "cpu", "system"];
  }

  if (platform === "linux" && arch === "x64") {
    return ["auto", "nvidia", "amd", "intel", "vulkan", "cpu", "system"];
  }

  if (platform === "linux" && arch === "arm64") {
    return ["auto", "vulkan", "cpu", "system"];
  }

  if (platform === "win32" && arch === "arm64") {
    return ["auto", "cpu", "system"];
  }

  if (platform === "darwin" && arch === "x64") {
    return ["auto", "cpu", "system"];
  }

  if (platform === "android") {
    return ["auto", "cpu"];
  }

  return ["auto", "cpu", "system"];
}

function ResponseBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)]/60">{label}</div>
      <div className="rounded-lg bg-[var(--secondary)] p-3 text-sm leading-relaxed text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

type SettingsScreen = "settings" | "speed" | "memory" | "replies" | "expert";

const LABEL = "text-xs font-medium text-[var(--muted-foreground)]";
const HINT = "text-xs text-[var(--muted-foreground)]";
const LIST =
  "flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]";
const ROW =
  "flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-foreground/[0.04]";
const OPTION =
  "flex min-h-14 w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3 text-left transition-colors hover:border-foreground/20";
const OPTION_ON =
  "border-[var(--mari-panel-gradient-start)] bg-[var(--mari-connection-tint)] hover:border-[var(--mari-panel-gradient-start)]";
const RADIO =
  "h-4 w-4 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--foreground)_30%,transparent)]";
const RADIO_ON = "shadow-[inset_0_0_0_4.5px_var(--mari-panel-gradient-start)]";
const GOOD = "shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.6875rem] font-medium text-emerald-400";
const DISCLOSE =
  "flex min-h-11 items-center gap-2 rounded-lg px-1 text-left text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]";
const SECONDARY = `${SECONDARY_CLASS} px-3`;
const QUIET = "mari-chrome-control mari-chrome-control--quiet text-sm px-3";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      {children}
    </div>
  );
}

function TestResult({ result: testMessageResult }: { result: SidecarTestMessageResult }) {
  const localizeUi = useUiTranslation().t;
  return (
    <div
      className={`rounded-xl border p-4 ${
        testMessageResult.success ? "border-emerald-500/25 bg-emerald-500/5" : "border-red-500/25 bg-red-500/5"
      }`}
    >
      <div className={`text-sm font-medium ${testMessageResult.success ? "text-emerald-300" : "text-red-300"}`}>
        {localizeUi("ui.modals.modeldownloadmodal.localTestMessage")}{" "}
        {testMessageResult.success
          ? localizeUi("ui.modals.modeldownloadmodal.succeeded")
          : localizeUi("ui.connections.testresultcard.failed")}
      </div>
      <div className="mt-1 text-xs text-[var(--muted-foreground)]/75">
        {testMessageResult.latencyMs}
        {localizeUi("ui.connections.testresultcard.ms")}
      </div>
      {testMessageResult.success ? (
        <div className="mt-3 flex flex-col gap-3">
          {testMessageResult.nonce && (
            <div className="text-xs text-[var(--muted-foreground)]/75">
              {localizeUi("ui.modals.modeldownloadmodal.verificationToken")}{" "}
              <span className="font-mono text-[var(--foreground)]">{testMessageResult.nonce}</span>
              {testMessageResult.nonceVerified
                ? localizeUi("ui.modals.modeldownloadmodal.echoedByModel")
                : localizeUi("ui.modals.modeldownloadmodal.notEchoed")}
            </div>
          )}
          {(testMessageResult.usage || testMessageResult.timings) && (
            <div className="text-xs text-[var(--muted-foreground)]/75">
              {testMessageResult.usage && (
                <span>
                  {localizeUi("ui.modals.modeldownloadmodal.usagePrompt")} {testMessageResult.usage.promptTokens ?? "?"}
                  {localizeUi("ui.modals.modeldownloadmodal.completion")}{" "}
                  {testMessageResult.usage.completionTokens ?? "?"}
                  {localizeUi("ui.modals.modeldownloadmodal.total")} {testMessageResult.usage.totalTokens ?? "?"}
                </span>
              )}
              {testMessageResult.usage && testMessageResult.timings && <span> • </span>}
              {testMessageResult.timings && (
                <span>
                  {localizeUi("ui.modals.modeldownloadmodal.timingsPrompt")} {testMessageResult.timings.promptMs ?? "?"}
                  {localizeUi("ui.modals.modeldownloadmodal.msGen")} {testMessageResult.timings.predictedMs ?? "?"}
                  {localizeUi("ui.connections.testresultcard.ms")}
                </span>
              )}
            </div>
          )}
          {!!testMessageResult.messageContent && (
            <ResponseBlock
              label={localizeUi("ui.modals.modeldownloadmodal.messageContent")}
              value={testMessageResult.messageContent}
            />
          )}
          {!!testMessageResult.reasoningContent && (
            <ResponseBlock
              label={localizeUi("ui.modals.modeldownloadmodal.reasoningContent")}
              value={testMessageResult.reasoningContent}
            />
          )}
          {!testMessageResult.messageContent && !testMessageResult.reasoningContent && (
            <ResponseBlock
              label={localizeUi("ui.modals.modeldownloadmodal.response")}
              value={testMessageResult.response}
            />
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1 text-xs text-red-200/90">
          <span>{testMessageResult.error || "No response received from the local runtime."}</span>
          {testMessageResult.failedRuntimeVariant && (
            <span>
              {localizeUi("connections.device.runtimeVariant", {
                variant: formatRuntimeVariantLabel(testMessageResult.failedRuntimeVariant),
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function EmbeddedShell({ children }: ComponentProps<typeof Modal>) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}

export function ModelDownloadModal({ open, onClose, embedded }: Props) {
  const { t: localizeUi } = useUiTranslation();
  const {
    status,
    config,
    modelDownloaded,
    modelDisplayName,
    gpuMemory,
    runtime,
    inferenceReady,
    logPath,
    startupError,
    failedRuntimeVariant,
    runtimeDiagnostics,
    platform,
    arch,
    curatedModels,
    downloadProgress,
    customModels,
    customModelsLoading,
    customModelsError,
    startDownload,
    startCustomDownload,
    listHuggingFaceModels,
    clearCustomModels,
    cancelDownload,
    restartRuntime,
    installRuntime,
    sendTestMessage,
    testMessagePending,
    testMessageResult,
    reinstallRuntime,
    updateConfig,
    markPrompted,
    fetchStatus,
  } = useSidecarStore();

  const isAppleSilicon = platform === "darwin" && arch === "arm64";
  const defaultCustomRepo = isAppleSilicon ? "mlx-community/gemma-4-e2b-it-4bit" : "unsloth/gemma-4-E2B-it-GGUF";
  const [selectedQuant, setSelectedQuant] = useState<SidecarQuantization>("q8_0");
  const [repoInput, setRepoInput] = useState(config.customModelRepo ?? "");
  const [localModelPathDraft, setLocalModelPath] = useState<string | null>(null);
  const localModelPath = localModelPathDraft ?? config.externalModelPath ?? "";
  const [selectingLocalModel, setSelectingLocalModel] = useState(false);
  const [selectedCustomPath, setSelectedCustomPath] = useState("");
  const [screen, setScreen] = useState<"main" | SettingsScreen>("main");
  const [changing, setChanging] = useState(false);
  const [choice, setChoice] = useState<"preset" | "own">(
    config.externalModelPath || config.customModelRepo ? "own" : "preset",
  );
  const [ownTab, setOwnTab] = useState<"hf" | "file">(config.externalModelPath ? "file" : "hf");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [gpuLayersInput, setGpuLayersInput] = useState(config.gpuLayers > 0 ? String(config.gpuLayers) : "");
  const [gpuLayersModeDraft, setGpuLayersModeDraft] = useState<"auto" | "cpu" | "custom">(
    config.gpuLayers === -1 ? "auto" : config.gpuLayers === 0 ? "cpu" : "custom",
  );
  const [contextSizeInput, setContextSizeInput] = useState(String(config.contextSize));
  const [maxTokensInput, setMaxTokensInput] = useState(String(config.maxTokens));
  const [temperatureInput, setTemperatureInput] = useState(String(config.temperature));
  const [topPInput, setTopPInput] = useState(String(config.topP));
  const [topKInput, setTopKInput] = useState(String(config.topK));
  const [maxParallelJobsInput, setMaxParallelJobsInput] = useState(String(config.maxParallelJobs));
  const [embeddingBatchSizeInput, setEmbeddingBatchSizeInput] = useState(String(config.embeddingBatchSize));
  const Shell = embedded ? EmbeddedShell : Modal;
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const activeBackend = runtime.backend ?? config.backend;
  const isSystemRuntime = runtime.source === "system";
  const canReinstallRuntime = !isSystemRuntime;
  const selectedPreset =
    curatedModels.find((model) => model.quantization === selectedQuant) ?? curatedModels[0] ?? null;
  const selectedCustomEntry =
    customModels.find((entry) => entry.path === selectedCustomPath) ?? customModels[0] ?? null;
  const isCustomRepoValidated = selectedCustomEntry?.path === repoInput.trim();
  const isDownloading = downloadProgress?.status === "downloading";
  const hasModel = modelDownloaded;
  const activeModelName = hasModel ? modelDisplayName : null;
  const shouldAutoStart = config.useForTrackers || config.useForGameScene;
  const isBlockingSetup = isDownloading || status === "downloading_runtime" || status === "downloading_model";
  const isPreparingServer =
    runtime.installed && hasModel && shouldAutoStart && !inferenceReady && status === "starting_server";
  const showSetupProgress = isBlockingSetup || isPreparingServer;
  const canFinish = status === "ready" && inferenceReady;
  const runtimePreferenceOptions = getRuntimePreferenceOptions(platform, arch);
  const gpuLayersMode = gpuLayersModeDraft;
  const quickRuntimeSummary =
    activeBackend === "mlx"
      ? localizeUi("connections.device.runtime.mlxSummary", {
          context: formatCompactTokens(config.contextSize),
          max: formatCompactTokens(config.maxTokens),
        })
      : [
          formatRuntimePreferenceLabel(config.runtimePreference, localizeUi, platform),
          describeGpuLayers(config.gpuLayers, localizeUi),
          config.enableNativeToolCalls
            ? localizeUi("connections.device.runtime.nativeToolsOn")
            : localizeUi("connections.device.runtime.nativeToolsOff"),
          localizeUi("connections.device.pooling.summary", {
            pooling: formatEmbeddingPoolingLabel(config.embeddingPooling, localizeUi),
          }),
          localizeUi("connections.device.runtime.context", { value: formatCompactTokens(config.contextSize) }),
          localizeUi("connections.device.runtime.maxTokens", { value: formatCompactTokens(config.maxTokens) }),
        ].join(" • ");

  useEffect(() => {
    if (!open) {
      clearCustomModels();
      return;
    }

    void fetchStatus();
    if (config.customModelRepo) {
      setRepoInput(config.customModelRepo);
    } else {
      setRepoInput(defaultCustomRepo);
    }
  }, [open, config.customModelRepo, defaultCustomRepo, fetchStatus, clearCustomModels]);

  useEffect(() => {
    if (curatedModels.length > 0 && !curatedModels.some((model) => model.quantization === selectedQuant)) {
      setSelectedQuant(curatedModels[0]!.quantization);
    }
  }, [curatedModels, selectedQuant]);

  useEffect(() => {
    if (customModels.length > 0 && !customModels.some((entry) => entry.path === selectedCustomPath)) {
      setSelectedCustomPath(customModels[0]!.path);
    }
  }, [customModels, selectedCustomPath]);

  useEffect(() => {
    setGpuLayersInput(config.gpuLayers > 0 ? String(config.gpuLayers) : "");
    setGpuLayersModeDraft(config.gpuLayers === -1 ? "auto" : config.gpuLayers === 0 ? "cpu" : "custom");
  }, [config.gpuLayers]);

  useEffect(() => {
    setContextSizeInput(String(config.contextSize));
    setMaxTokensInput(String(config.maxTokens));
    setTemperatureInput(String(config.temperature));
    setTopPInput(String(config.topP));
    setTopKInput(String(config.topK));
    setMaxParallelJobsInput(String(config.maxParallelJobs));
    setEmbeddingBatchSizeInput(String(config.embeddingBatchSize));
  }, [
    config.contextSize,
    config.maxTokens,
    config.temperature,
    config.topP,
    config.topK,
    config.maxParallelJobs,
    config.embeddingBatchSize,
  ]);

  const progress = downloadProgress;
  const progressPercent = progress && progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : 0;
  const progressDetail = progress?.label ? ` (${progress.label})` : "";
  const setupLabel =
    progress?.phase === "runtime"
      ? activeBackend === "mlx"
        ? localizeUi("connections.device.setup.preparingMlx", { detail: progressDetail })
        : localizeUi("connections.device.setup.downloadingRuntime", { detail: progressDetail })
      : progress?.phase === "model"
        ? localizeUi("connections.device.setup.downloadingModel", { detail: progressDetail })
        : isPreparingServer
          ? localizeUi("connections.device.setup.startingRuntime")
          : localizeUi("connections.device.setup.settingUp");
  const setupDescription =
    progress?.phase === "model"
      ? isAppleSilicon
        ? localizeUi("connections.device.setup.savingMlxRepo")
        : localizeUi("connections.device.setup.savingGguf")
      : progress?.phase === "runtime"
        ? activeBackend === "mlx"
          ? localizeUi("connections.device.setup.mlxRuntimeHelp")
          : localizeUi("connections.device.setup.runtimeHelp")
        : activeBackend === "mlx"
          ? localizeUi("connections.device.setup.startingMlxHelp")
          : localizeUi("connections.device.setup.startingServerHelp");
  const runtimeStatusLabel = canFinish
    ? localizeUi("connections.device.setup.ready")
    : isBlockingSetup
      ? localizeUi("connections.device.setup.settingUpNow")
      : isPreparingServer
        ? localizeUi("connections.device.setup.startingRuntimeShort")
        : status === "server_error"
          ? localizeUi("connections.device.setup.error")
          : runtime.installed
            ? isSystemRuntime
              ? localizeUi("connections.device.setup.systemRuntime")
              : localizeUi("connections.device.setup.installed")
            : localizeUi("connections.device.state.notDownloaded");

  useEffect(() => {
    modalScrollRef.current?.scrollTo({ top: 0 });
  }, [screen, changing, showSetupProgress]);

  const handleCuratedDownload = async () => {
    markPrompted();
    if (!(await startDownload(selectedQuant))) return false;
    toast.success(GEMMA_RESTART_MESSAGE);
    return true;
  };

  const handleCustomDownload = async () => {
    if (!repoInput.trim()) return false;
    markPrompted();
    if (!(await startCustomDownload(repoInput.trim(), isAppleSilicon ? undefined : selectedCustomPath))) return false;
    toast.success(
      localizeUi("ui.modals.modeldownloadmodal.localModelDownloadedCompletelyRestartMarinaraEngineBeforeUsing"),
    );
    return true;
  };

  const handleLocalModel = async () => {
    setSelectingLocalModel(true);
    try {
      await api.post("/sidecar/model/local", { path: localModelPath.trim() });
      markPrompted();
      await fetchStatus();
      setLocalModelPath(null);
      toast.success(localizeUi("ui.modals.modeldownloadmodal.localGgufSelected"));
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.modals.modeldownloadmodal.localGgufFailed"));
      return false;
    } finally {
      setSelectingLocalModel(false);
    }
  };

  const handleListModels = async () => {
    await listHuggingFaceModels(repoInput.trim());
  };

  const handleRuntimePreferenceChange = (preference: SidecarRuntimePreference) => {
    void updateConfig({ runtimePreference: preference });
  };

  const handleGpuLayersModeChange = (mode: "auto" | "cpu" | "custom") => {
    setGpuLayersModeDraft(mode);

    if (mode === "auto") {
      void updateConfig({ gpuLayers: -1 });
      return;
    }

    if (mode === "cpu") {
      void updateConfig({ gpuLayers: 0 });
      return;
    }

    if (config.gpuLayers <= 0) {
      setGpuLayersInput("999");
    }
  };

  const handleNativeToolCallsToggle = () => {
    void updateConfig({ enableNativeToolCalls: !config.enableNativeToolCalls });
  };

  const handleEmbeddingPoolingChange = (pooling: SidecarEmbeddingPooling) => {
    void updateConfig({ embeddingPooling: pooling });
  };

  const handleApplyEmbeddingBatchSize = () => {
    const parsed = Number.parseInt(embeddingBatchSizeInput, 10);
    if (!Number.isFinite(parsed) || parsed < 128 || parsed > 32768) {
      return;
    }
    void updateConfig({ embeddingBatchSize: parsed });
  };

  const handleApplyCustomGpuLayers = () => {
    const parsed = Number.parseInt(gpuLayersInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1024) {
      return;
    }
    setGpuLayersModeDraft("custom");
    void updateConfig({ gpuLayers: parsed });
  };

  const handleApplyGenerationSettings = () => {
    const parsedContextSize = Number.parseInt(contextSizeInput, 10);
    const parsedMaxTokens = Number.parseInt(maxTokensInput, 10);
    const parsedTemperature = Number.parseFloat(temperatureInput);
    const parsedTopP = Number.parseFloat(topPInput);
    const parsedTopK = Number.parseInt(topKInput, 10);
    const parsedMaxParallelJobs = Number.parseInt(maxParallelJobsInput, 10);

    if (
      !Number.isFinite(parsedContextSize) ||
      parsedContextSize < 512 ||
      !Number.isFinite(parsedMaxTokens) ||
      parsedMaxTokens < 64 ||
      !Number.isFinite(parsedTemperature) ||
      parsedTemperature < 0 ||
      parsedTemperature > 2 ||
      !Number.isFinite(parsedTopP) ||
      parsedTopP <= 0 ||
      parsedTopP > 1 ||
      !Number.isFinite(parsedTopK) ||
      parsedTopK < 0 ||
      parsedTopK > 500 ||
      !Number.isFinite(parsedMaxParallelJobs) ||
      parsedMaxParallelJobs < 1 ||
      parsedMaxParallelJobs > 16
    ) {
      return;
    }

    void updateConfig({
      contextSize: parsedContextSize,
      maxTokens: parsedMaxTokens,
      temperature: parsedTemperature,
      topP: parsedTopP,
      topK: parsedTopK,
      maxParallelJobs: parsedMaxParallelJobs,
    });
  };

  const parsedContextSize = Number.parseInt(contextSizeInput, 10);
  const parsedMaxTokens = Number.parseInt(maxTokensInput, 10);
  const parsedTemperature = Number.parseFloat(temperatureInput);
  const parsedTopP = Number.parseFloat(topPInput);
  const parsedTopK = Number.parseInt(topKInput, 10);
  const parsedMaxParallelJobs = Number.parseInt(maxParallelJobsInput, 10);
  const parsedEmbeddingBatchSize = Number.parseInt(embeddingBatchSizeInput, 10);
  const embeddingBatchSizeValid =
    Number.isFinite(parsedEmbeddingBatchSize) && parsedEmbeddingBatchSize >= 128 && parsedEmbeddingBatchSize <= 32768;
  const embeddingBatchSizeDirty = embeddingBatchSizeInput !== String(config.embeddingBatchSize);
  const generationSettingsValid =
    Number.isFinite(parsedContextSize) &&
    parsedContextSize >= 512 &&
    Number.isFinite(parsedMaxTokens) &&
    parsedMaxTokens >= 64 &&
    Number.isFinite(parsedTemperature) &&
    parsedTemperature >= 0 &&
    parsedTemperature <= 2 &&
    Number.isFinite(parsedTopP) &&
    parsedTopP > 0 &&
    parsedTopP <= 1 &&
    Number.isFinite(parsedTopK) &&
    parsedTopK >= 0 &&
    parsedTopK <= 500 &&
    Number.isFinite(parsedMaxParallelJobs) &&
    parsedMaxParallelJobs >= 1 &&
    parsedMaxParallelJobs <= 16;
  const generationSettingsDirty =
    contextSizeInput !== String(config.contextSize) ||
    maxTokensInput !== String(config.maxTokens) ||
    temperatureInput !== String(config.temperature) ||
    topPInput !== String(config.topP) ||
    topKInput !== String(config.topK) ||
    maxParallelJobsInput !== String(config.maxParallelJobs);

  const handleCancelSetup = () => {
    void cancelDownload();
  };

  const close = () => {
    markPrompted();
    onClose();
  };
  const gb = (bytes?: number | null) => (bytes ? (bytes / 1024 ** 3).toFixed(1) : null);
  const ownFile = choice === "own" && ownTab === "file";
  const ownRepo = choice === "own" && ownTab === "hf";
  const downloadBytes =
    choice === "preset"
      ? selectedPreset?.sizeBytes
      : ownRepo && !isAppleSilicon
        ? selectedCustomEntry?.sizeBytes
        : null;
  const primaryLabel = ownFile
    ? localizeUi("connections.builtin.useFile")
    : gb(downloadBytes)
      ? localizeUi("connections.builtin.downloadSize", { size: gb(downloadBytes) })
      : localizeUi("connections.builtin.downloadPlain");
  const primaryDisabled =
    isBlockingSetup ||
    selectingLocalModel ||
    (choice === "preset"
      ? !selectedPreset
      : ownFile
        ? !localModelPath.trim()
        : isAppleSilicon
          ? !repoInput.trim() || customModelsLoading || !isCustomRepoValidated
          : !selectedCustomPath);
  // Change model opens on what is in use now.
  const startChange = () => {
    setChoice(config.externalModelPath || config.customModelRepo ? "own" : "preset");
    setOwnTab(config.externalModelPath ? "file" : "hf");
    setChanging(true);
  };
  // One button: the runtime installs first when it is missing, then the model.
  const startSetup = async () => {
    if (!useSidecarStore.getState().runtime.installed) await installRuntime();
    if (!useSidecarStore.getState().runtime.installed) return;
    const started =
      choice === "preset"
        ? await handleCuratedDownload()
        : ownFile
          ? await handleLocalModel()
          : await handleCustomDownload();
    if (started) setChanging(false);
  };
  const gpuHint =
    runtimeDiagnostics && runtimeDiagnostics.gpuVendors.length > 0
      ? localizeUi("connections.builtin.gpuFound", { vendors: runtimeDiagnostics.gpuVendors.join(", ") })
      : null;
  const progressText = progress
    ? [
        `${formatBytes(progress.downloaded)}${progress.total > 0 ? ` / ${formatBytes(progress.total)}` : ""}`,
        progress.speed > 0 ? formatSpeed(progress.speed) : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const runtimeDone = runtime.installed && status !== "downloading_runtime";
  const steps: { key: string; label: string; state: "ok" | "run" | "wait"; detail?: string | null }[] = [
    {
      key: "runtime",
      label: localizeUi("connections.builtin.step.runtime"),
      state: status === "downloading_runtime" ? "run" : runtimeDone ? "ok" : "wait",
      detail: status === "downloading_runtime" ? progressText : formatRuntimeVariantLabel(runtime.variant),
    },
    {
      key: "model",
      label: localizeUi("connections.builtin.step.model"),
      state: status === "downloading_model" ? "run" : hasModel ? "ok" : "wait",
      detail: status === "downloading_model" ? progressText : null,
    },
    {
      key: "start",
      label: localizeUi("connections.builtin.step.start"),
      state: isPreparingServer || status === "starting_server" ? "run" : inferenceReady ? "ok" : "wait",
    },
  ];
  const view = showSetupProgress ? "busy" : screen !== "main" ? screen : hasModel && !changing ? "ready" : "pick";
  const groups: { key: SettingsScreen; value: string }[] = [
    {
      key: "speed",
      value:
        activeBackend === "mlx" ? "MLX" : formatRuntimePreferenceLabel(config.runtimePreference, localizeUi, platform),
    },
    { key: "memory", value: `${formatCompactTokens(config.contextSize)} · ${config.kvCacheType ?? "f16"}` },
    {
      key: "replies",
      value: localizeUi("connections.device.runtime.maxTokens", { value: formatCompactTokens(config.maxTokens) }),
    },
    {
      key: "expert",
      value: config.enableNativeToolCalls
        ? localizeUi("connections.device.runtime.nativeToolsOn")
        : localizeUi("connections.device.runtime.nativeToolsOff"),
    },
  ];
  const settingsList = (
    <div className={LIST}>
      {groups.map((group) => (
        <button key={group.key} type="button" onClick={() => setScreen(group.key)} className={ROW}>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-[var(--foreground)]">
              {localizeUi(`connections.builtin.group.${group.key}`)}
            </span>
            <span className="block text-xs text-[var(--muted-foreground)]">
              {localizeUi(`connections.builtin.group.${group.key}Hint`)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-[var(--muted-foreground)]">
            {group.value}
            <ChevronRight size="0.875rem" aria-hidden />
          </span>
        </button>
      ))}
    </div>
  );
  const numberInput = (
    label: string,
    value: string,
    set: (value: string) => void,
    placeholder: string,
    decimal = false,
    onEnter?: () => void,
  ) => (
    <input
      value={value}
      onChange={(event) => set(event.target.value.replace(decimal ? /[^0-9.]/g : /[^\d]/g, ""))}
      onKeyDown={(event) => {
        if (event.key === "Enter") onEnter?.();
      }}
      inputMode={decimal ? "decimal" : "numeric"}
      placeholder={placeholder}
      aria-label={label}
      className="mari-editor-field w-full px-3 py-2 text-sm tabular-nums"
    />
  );
  const isGroup = view === "speed" || view === "memory" || view === "replies" || view === "expert";

  let body: ReactNode;
  let footerLeft: ReactNode = null;
  let footerRight: ReactNode = null;

  if (view === "busy") {
    body = (
      <div className="flex flex-col gap-4" role="status">
        <p className="text-sm font-medium text-[var(--foreground)]">{setupLabel}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
          {progress && progress.total > 0 ? (
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--mari-panel-gradient-start),var(--mari-panel-gradient-end))] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          ) : (
            <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--mari-panel-gradient-start)]" />
          )}
        </div>
        <ol className="flex flex-col gap-2.5 text-sm">
          {steps.map((step) => (
            <li key={step.key} className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full",
                  step.state === "ok" && "bg-emerald-500/15 text-emerald-400",
                  step.state === "run" && "text-[var(--mari-panel-gradient-start)]",
                  step.state === "wait" &&
                    "shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--foreground)_20%,transparent)]",
                )}
                aria-hidden
              >
                {step.state === "ok" && <Check size="0.6875rem" />}
                {step.state === "run" && <Loader2 size="1.125rem" className="animate-spin" />}
              </span>
              <span className={step.state === "wait" ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"}>
                {step.label}
              </span>
              {step.detail && (
                <span className="ms-auto min-w-0 truncate text-xs tabular-nums text-[var(--muted-foreground)]">
                  {step.detail}
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="text-xs text-[var(--muted-foreground)]">{setupDescription}</p>
      </div>
    );
    footerLeft = (
      <button type="button" onClick={handleCancelSetup} className={QUIET}>
        {localizeUi("ui.modals.modeldownloadmodal.cancelSetup")}
      </button>
    );
    footerRight = (
      <button type="button" onClick={close} className={SECONDARY}>
        {localizeUi("capabilities.actions.close")}
      </button>
    );
  } else if (view === "pick") {
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--muted-foreground)]">{localizeUi("connections.builtin.tagline")}</p>
          <div className="flex items-start gap-2 text-[0.8125rem] text-[var(--muted-foreground)]">
            <Info size="0.9375rem" className="mt-0.5 shrink-0" aria-hidden />
            <p>
              <span className="font-medium text-[var(--foreground)]">{localizeUi("connections.builtin.fitTitle")}</span>{" "}
              {localizeUi("connections.builtin.fitBody")}{" "}
              <button
                type="button"
                aria-expanded={aboutOpen}
                onClick={() => setAboutOpen((value) => !value)}
                className="underline underline-offset-2 hover:text-[var(--foreground)]"
              >
                {localizeUi("connections.builtin.whatCanItDo")}
              </button>
            </p>
          </div>
          {aboutOpen && (
            <div className="flex flex-col gap-2 rounded-xl bg-foreground/[0.04] p-3.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
              <p className="text-[var(--foreground)]">
                {localizeUi("ui.modals.modeldownloadmodal.marinaraEngineCanRunALocalSidecarForTrackers")}
              </p>
              <p className="font-medium text-[var(--foreground)]">
                {localizeUi("ui.modals.modeldownloadmodal.whatTheLocalModelHandles")}
              </p>
              <ul className="flex list-disc flex-col gap-1 ps-4">
                <li>{localizeUi("ui.modals.modeldownloadmodal.trackerAgentsInRoleplayMode")}</li>
                <li>{localizeUi("ui.modals.modeldownloadmodal.sceneEffectsInGameModeBackgroundsMusicSfxAmbient")}</li>
                <li>{localizeUi("ui.modals.modeldownloadmodal.widgetUpdatesWeatherAndTimeOfDayChanges")}</li>
                <li>{localizeUi("ui.modals.modeldownloadmodal.npcReputationTrackingAndExpressionSelection")}</li>
              </ul>
              <p>{localizeUi("ui.modals.modeldownloadmodal.theBundledModelIsDeliberatelySmallSoItCan")}</p>
            </div>
          )}
        </div>

        <div role="radiogroup" aria-labelledby="builtin-which-model" className="flex flex-col gap-2">
          <h3 id="builtin-which-model" className={LABEL}>
            {localizeUi("connections.builtin.whichModel")}
          </h3>
          {curatedModels.map((model) => {
            const on = choice === "preset" && selectedQuant === model.quantization;
            return (
              <button
                key={`${model.backend}-${model.quantization}`}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setChoice("preset");
                  setSelectedQuant(model.quantization);
                }}
                className={cn(OPTION, on && OPTION_ON)}
              >
                <span className={cn(RADIO, on && RADIO_ON)} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[0.9375rem] font-semibold text-[var(--foreground)]">{model.label}</span>
                  <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                    {localizeUi("connections.builtin.size", { size: gb(model.sizeBytes), ram: gb(model.ramBytes) })}
                  </span>
                </span>
                {model.quantization === "q8_0" && (
                  <span className={GOOD}>{localizeUi("ui.modals.modeldownloadmodal.recommended")}</span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={choice === "own"}
            onClick={() => setChoice("own")}
            className={cn(OPTION, choice === "own" && OPTION_ON)}
          >
            <span className={cn(RADIO, choice === "own" && RADIO_ON)} aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[0.9375rem] font-semibold text-[var(--foreground)]">
                {localizeUi("connections.builtin.ownModel")}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("connections.builtin.ownModelHint")}
              </span>
            </span>
            <ChevronDown
              size="1rem"
              className={cn(
                "shrink-0 text-[var(--muted-foreground)] transition-transform",
                choice === "own" && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          {choice === "own" && (
            <div className="flex flex-col gap-3 rounded-xl bg-foreground/[0.04] p-3.5">
              <div className="mari-editor-navigation-tabs flex self-start" role="tablist">
                {(["hf", "file"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={ownTab === tab}
                    data-active={ownTab === tab}
                    className="mari-editor-tab"
                    onClick={() => setOwnTab(tab)}
                  >
                    {localizeUi(`connections.builtin.tab.${tab}`)}
                  </button>
                ))}
              </div>
              {ownTab === "file" ? (
                <>
                  <input
                    value={localModelPath}
                    onChange={(event) => setLocalModelPath(event.target.value)}
                    placeholder={localizeUi("ui.modals.modeldownloadmodal.localGgufPathPlaceholder")}
                    aria-label={localizeUi("ui.modals.modeldownloadmodal.localGgufPath")}
                    className="mari-editor-field w-full px-3 py-2 font-mono text-sm"
                    disabled={selectingLocalModel || isBlockingSetup}
                  />
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.modals.modeldownloadmodal.localGgufPathHint")}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={repoInput}
                      onChange={(event) => {
                        setRepoInput(event.target.value);
                        if (customModels.length > 0 || customModelsError) {
                          clearCustomModels();
                          setSelectedCustomPath("");
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && repoInput.trim()) void handleListModels();
                      }}
                      placeholder={localizeUi("ui.modals.modeldownloadmodal.ownerRepo")}
                      aria-label={localizeUi("ui.modals.modeldownloadmodal.ownerRepo")}
                      className="mari-editor-field min-w-0 flex-1 px-3 py-2 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void handleListModels()}
                      disabled={!repoInput.trim() || customModelsLoading}
                      className={SECONDARY}
                    >
                      {customModelsLoading ? (
                        <Loader2 size="0.875rem" className="animate-spin" aria-hidden />
                      ) : (
                        <Search size="0.875rem" aria-hidden />
                      )}
                      {isAppleSilicon
                        ? localizeUi("ui.modals.modeldownloadmodal.validateRepo")
                        : localizeUi("connections.builtin.findFiles")}
                    </button>
                  </div>
                  {customModelsError && <p className="text-xs text-[var(--destructive)]">{customModelsError}</p>}
                  {isAppleSilicon && selectedCustomEntry && (
                    <p className="text-xs text-emerald-400">
                      {selectedCustomEntry.filename} · {localizeUi("ui.modals.modeldownloadmodal.mlxRepoValidated")}
                    </p>
                  )}
                  {!isAppleSilicon && customModels.length > 0 && (
                    <div
                      role="radiogroup"
                      aria-label={localizeUi("connections.builtin.findFiles")}
                      className="flex flex-col gap-0.5"
                    >
                      {customModels.map((entry) => {
                        const on = selectedCustomPath === entry.path;
                        return (
                          <button
                            key={entry.path}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setSelectedCustomPath(entry.path)}
                            className={cn(
                              "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[0.8125rem] transition-colors hover:bg-foreground/[0.05]",
                              on && "bg-[var(--mari-connection-tint)] hover:bg-[var(--mari-connection-tint)]",
                            )}
                          >
                            <span className={cn(RADIO, on && RADIO_ON)} aria-hidden />
                            <span className="min-w-0 flex-1 font-mono [overflow-wrap:anywhere]">
                              {entry.quantizationLabel ?? entry.filename}
                            </span>
                            {entry.sizeBytes ? (
                              <span className="shrink-0 tabular-nums text-[var(--muted-foreground)]">
                                {formatBytes(entry.sizeBytes)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {isAppleSilicon
                      ? localizeUi("ui.modals.modeldownloadmodal.enterAnMlxNativeHuggingfaceRepoMarinaraWillValidate")
                      : localizeUi("connections.builtin.ownHint")}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {progress?.status === "error" && (
          <p className="rounded-lg bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]">
            {progress.error || localizeUi("connections.builtin.failed")}
          </p>
        )}

        <button type="button" onClick={() => setScreen("settings")} className={DISCLOSE}>
          <SlidersHorizontal size="0.9375rem" aria-hidden />
          <span className="font-medium text-[var(--foreground)]">{localizeUi("connections.builtin.settings")}</span>
          <span className="min-w-0 truncate">{groups[0].value}</span>
          <ChevronRight size="0.875rem" className="ms-auto shrink-0" aria-hidden />
        </button>
      </div>
    );
    footerLeft = changing ? (
      <button type="button" onClick={() => setChanging(false)} className={QUIET}>
        {localizeUi("connections.builtin.cancel")}
      </button>
    ) : gpuHint ? (
      <span className="truncate text-xs text-[var(--muted-foreground)]">{gpuHint}</span>
    ) : null;
    footerRight = (
      <button type="button" onClick={() => void startSetup()} disabled={primaryDisabled} className={PRIMARY}>
        {selectingLocalModel ? (
          <Loader2 size="0.875rem" className="animate-spin" aria-hidden />
        ) : (
          <Download size="0.875rem" aria-hidden />
        )}
        {primaryLabel}
      </button>
    );
  } else if (view === "ready") {
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.625rem] bg-foreground/[0.06] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent)]">
            <Cpu size="1.25rem" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold text-[var(--foreground)] [overflow-wrap:anywhere]">
              {activeModelName ?? localizeUi("connections.device.setup.modelInstalled")}
            </span>
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs",
                canFinish
                  ? "text-emerald-400"
                  : status === "server_error"
                    ? "text-amber-300"
                    : "text-[var(--muted-foreground)]",
              )}
            >
              {canFinish && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />}
              {[runtimeStatusLabel, formatRuntimeVariantLabel(runtime.variant)].filter(Boolean).join(" · ")}
            </span>
          </div>
          {inferenceReady ? (
            <button
              type="button"
              onClick={() => void sendTestMessage()}
              disabled={testMessagePending}
              className={SECONDARY}
            >
              {testMessagePending ? (
                <Loader2 size="0.875rem" className="animate-spin" aria-hidden />
              ) : (
                <MessageSquare size="0.875rem" aria-hidden />
              )}
              {localizeUi("connections.builtin.test")}
            </button>
          ) : runtime.installed && status !== "server_error" ? (
            <button type="button" onClick={() => void restartRuntime()} className={SECONDARY}>
              {localizeUi("ui.modals.modeldownloadmodal.startRuntime")}
            </button>
          ) : !runtime.installed ? (
            <button type="button" onClick={() => void installRuntime()} className={SECONDARY}>
              <Download size="0.875rem" aria-hidden />
              {localizeUi("ui.modals.modeldownloadmodal.installRuntime")}
            </button>
          ) : null}
        </div>

        {status === "server_error" && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
              <AlertTriangle size="0.9375rem" aria-hidden />
              {localizeUi("ui.modals.modeldownloadmodal.localRuntimeFailedToStart")}
            </div>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.modals.modeldownloadmodal.marinaraWillKeepWorkingWithoutTheLocalModelUntil")}
            </p>
            {(failedRuntimeVariant || startupError || logPath) && (
              <div className="mt-2 flex flex-col gap-1 text-xs text-[var(--muted-foreground)] [overflow-wrap:anywhere]">
                {failedRuntimeVariant && (
                  <span>
                    {localizeUi("connections.device.runtimeVariant", {
                      variant: formatRuntimeVariantLabel(failedRuntimeVariant),
                    })}
                  </span>
                )}
                {startupError && (
                  <span>
                    {localizeUi("ui.modals.modeldownloadmodal.error")} {startupError}
                  </span>
                )}
                {logPath && (
                  <span>
                    {localizeUi("ui.modals.modeldownloadmodal.log")} {logPath}
                  </span>
                )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void restartRuntime()} className={SECONDARY}>
                <RotateCw size="0.875rem" aria-hidden />
                {localizeUi("ui.modals.modeldownloadmodal.retryStartup")}
              </button>
              {canReinstallRuntime && (
                <button type="button" onClick={() => void reinstallRuntime()} className={SECONDARY}>
                  {localizeUi("ui.modals.modeldownloadmodal.reinstallRuntime")}
                </button>
              )}
              <button
                type="button"
                onClick={() => void updateConfig({ useForTrackers: false, useForGameScene: false })}
                className={QUIET}
              >
                {localizeUi("ui.modals.modeldownloadmodal.continueWithoutLocalAi")}
              </button>
            </div>
          </div>
        )}

        {testMessageResult && <TestResult result={testMessageResult} />}

        <div className="flex flex-col gap-2">
          <h3 className={LABEL}>{localizeUi("connections.builtin.usedFor")}</h3>
          <div className={LIST}>
            {(
              [
                [
                  "useForTrackers",
                  "connections.builtin.card.trackers",
                  "ui.modals.modeldownloadmodal.trackerAgentsInRoleplayMode",
                ],
                [
                  "useForGameScene",
                  "connections.builtin.sceneEffects",
                  "ui.modals.modeldownloadmodal.sceneEffectsInGameModeBackgroundsMusicSfxAmbient",
                ],
              ] as const
            ).map(([field, title, hint]) => (
              <SettingsSwitch
                key={field}
                label={localizeUi(title)}
                description={localizeUi(hint)}
                checked={config[field]}
                onChange={(value) => void updateConfig({ [field]: value })}
                labelPosition="start"
                className="justify-between px-3.5 py-2.5"
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className={LABEL}>{localizeUi("connections.builtin.settings")}</h3>
          {settingsList}
        </div>
      </div>
    );
    footerLeft = (
      <button type="button" onClick={startChange} className={QUIET}>
        {localizeUi("connections.builtin.changeModel")}
      </button>
    );
    footerRight = (
      <button type="button" onClick={close} className={PRIMARY}>
        {localizeUi("connections.add.done")}
      </button>
    );
  } else if (view === "settings") {
    body = settingsList;
  } else {
    body = (
      <div className="flex flex-col gap-5">
        {view === "speed" && (
          <>
            <Field label={localizeUi("ui.modals.modeldownloadmodal.runtimeTarget")}>
              {activeBackend === "mlx" ? (
                <p className={HINT}>
                  {localizeUi("ui.modals.modeldownloadmodal.mlxChoosesTheAppleSiliconAcceleratorPathAutomatically")}
                </p>
              ) : (
                <>
                  <select
                    value={config.runtimePreference}
                    aria-label={localizeUi("ui.modals.modeldownloadmodal.runtimeTarget")}
                    onChange={(event) => handleRuntimePreferenceChange(event.target.value as SidecarRuntimePreference)}
                    className="mari-editor-field w-full px-3 py-2 text-sm"
                  >
                    {runtimePreferenceOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatRuntimePreferenceLabel(option, localizeUi, platform)}
                      </option>
                    ))}
                  </select>
                  <p className={HINT}>
                    {localizeUi("ui.modals.modeldownloadmodal.pickTheGpuFamilyYouActuallyWantMarinaraTo")}
                  </p>
                  {platform === "linux" && config.runtimePreference === "nvidia" && (
                    <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      {localizeUi("ui.modals.modeldownloadmodal.linuxCudaBinariesAreNotCurrentlyPublishedByLlama")}
                    </p>
                  )}
                </>
              )}
            </Field>
            <Field label={localizeUi("ui.modals.modeldownloadmodal.gpuOffload")}>
              {activeBackend === "mlx" ? (
                <p className={HINT}>{localizeUi("ui.modals.modeldownloadmodal.mlxManagesGpuOffloadAutomatically")}</p>
              ) : (
                <>
                  <div className="mari-editor-navigation-tabs flex self-start" role="radiogroup">
                    {(
                      [
                        ["auto", "autoOffload"],
                        ["cpu", "cpuOnly"],
                        ["custom", "customGpuLayers"],
                      ] as const
                    ).map(([mode, key]) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={gpuLayersMode === mode}
                        data-active={gpuLayersMode === mode}
                        className="mari-editor-tab"
                        onClick={() => handleGpuLayersModeChange(mode)}
                      >
                        {localizeUi(`ui.modals.modeldownloadmodal.${key}`)}
                      </button>
                    ))}
                  </div>
                  {gpuLayersMode === "custom" && (
                    <div className="flex items-center gap-2">
                      <div className="w-28">
                        {numberInput(
                          localizeUi("ui.modals.modeldownloadmodal.customGpuLayers"),
                          gpuLayersInput,
                          setGpuLayersInput,
                          "1-1024",
                          false,
                          handleApplyCustomGpuLayers,
                        )}
                      </div>
                      <button type="button" onClick={handleApplyCustomGpuLayers} className={SECONDARY}>
                        {localizeUi("ui.modals.modeldownloadmodal.apply")}
                      </button>
                    </div>
                  )}
                  <p className={HINT}>
                    {localizeUi("ui.modals.modeldownloadmodal.autoTriesMaxOffloadFirstCpuOnlyDisablesGpu")}
                  </p>
                </>
              )}
            </Field>
          </>
        )}
        {view === "memory" && (
          <>
            <Field label={localizeUi("ui.modals.modeldownloadmodal.contextWindow")}>
              {numberInput(
                localizeUi("ui.modals.modeldownloadmodal.contextWindow"),
                contextSizeInput,
                setContextSizeInput,
                "8192",
              )}
            </Field>
            {activeBackend !== "mlx" && (
              <Field label={localizeUi("ui.modals.modeldownloadmodal.kvCacheType")}>
                <select
                  value={config.kvCacheType ?? "f16"}
                  aria-label={localizeUi("ui.modals.modeldownloadmodal.kvCacheType")}
                  onChange={(event) =>
                    void updateConfig({ kvCacheType: event.target.value as "f16" | "q8_0" | "q4_0" })
                  }
                  disabled={isBlockingSetup}
                  className="mari-editor-field w-full px-3 py-2 text-sm"
                >
                  {(["f16", "q8_0", "q4_0"] as const).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <p className={HINT}>{localizeUi("ui.modals.modeldownloadmodal.kvCacheTypeHint")}</p>
              </Field>
            )}
            {inferenceReady && activeBackend !== "mlx" && (
              <Field label={localizeUi("ui.modals.modeldownloadmodal.gpuAllocations")}>
                {gpuMemory ? (
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    {(["weightsBytes", "kvCacheBytes", "buffersBytes"] as const).map((field) => (
                      <div key={field}>
                        <dt className="text-[var(--muted-foreground)]">
                          {localizeUi(`ui.modals.modeldownloadmodal.${field}`)}
                        </dt>
                        <dd className="tabular-nums">
                          {gpuMemory[field] === null
                            ? localizeUi("ui.modals.modeldownloadmodal.gpuMemoryUnavailable")
                            : formatBytes(gpuMemory[field])}
                        </dd>
                      </div>
                    ))}
                    {gpuMemory.weightsBytes !== null &&
                      gpuMemory.kvCacheBytes !== null &&
                      gpuMemory.buffersBytes !== null && (
                        <div>
                          <dt className="text-[var(--muted-foreground)]">
                            {localizeUi("ui.modals.modeldownloadmodal.totalGpuAllocations")}
                          </dt>
                          <dd className="tabular-nums">
                            {formatBytes(gpuMemory.weightsBytes + gpuMemory.kvCacheBytes + gpuMemory.buffersBytes)}
                          </dd>
                        </div>
                      )}
                  </dl>
                ) : (
                  <p className={HINT}>{localizeUi("ui.modals.modeldownloadmodal.gpuMemoryUnavailable")}</p>
                )}
                <p className={HINT}>{localizeUi("ui.modals.modeldownloadmodal.gpuAllocationsHint")}</p>
              </Field>
            )}
          </>
        )}
        {view === "replies" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={localizeUi("ui.modals.modeldownloadmodal.maxResponseTokens")}>
                {numberInput(
                  localizeUi("ui.modals.modeldownloadmodal.maxResponseTokens"),
                  maxTokensInput,
                  setMaxTokensInput,
                  "4096",
                )}
              </Field>
              <Field label={localizeUi("ui.modals.modeldownloadmodal.temperature")}>
                {numberInput(
                  localizeUi("ui.modals.modeldownloadmodal.temperature"),
                  temperatureInput,
                  setTemperatureInput,
                  "0.3",
                  true,
                )}
              </Field>
              <Field label={localizeUi("ui.modals.modeldownloadmodal.topP")}>
                {numberInput(localizeUi("ui.modals.modeldownloadmodal.topP"), topPInput, setTopPInput, "0.95", true)}
              </Field>
              <Field label={localizeUi("ui.modals.modeldownloadmodal.topK")}>
                {numberInput(localizeUi("ui.modals.modeldownloadmodal.topK"), topKInput, setTopKInput, "64")}
              </Field>
            </div>
            <p className={HINT}>
              {localizeUi("ui.modals.modeldownloadmodal.maxResponseTokensCapsHowMuchTheLocalRuntime")}
            </p>
          </>
        )}
        {view === "expert" && (
          <>
            <div className="flex flex-col gap-2">
              {activeBackend === "mlx" ? (
                <p className={HINT}>
                  {localizeUi("ui.modals.modeldownloadmodal.thisLlamaCppJinjaOptionDoesNotApplyTo")}
                </p>
              ) : (
                <SettingsSwitch
                  label={localizeUi("ui.modals.modeldownloadmodal.nativeToolCalls")}
                  description={localizeUi(
                    "ui.modals.modeldownloadmodal.startsLlamaServerWithJinjaSoOpenaiCompatibleTool",
                  )}
                  checked={config.enableNativeToolCalls}
                  onChange={handleNativeToolCallsToggle}
                  labelPosition="start"
                  className="justify-between px-0"
                />
              )}
              {!config.enableNativeToolCalls && activeBackend !== "mlx" && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  {localizeUi("ui.modals.modeldownloadmodal.professorMariAndCustomAgentsNeedThisEnabledBefore")}
                </p>
              )}
            </div>
            <Field label={localizeUi("ui.connections.connectioneditor.maxParallelAgentJobs")}>
              <div className="w-28">
                {numberInput(
                  localizeUi("ui.connections.connectioneditor.maxParallelAgentJobs"),
                  maxParallelJobsInput,
                  setMaxParallelJobsInput,
                  "2",
                )}
              </div>
            </Field>
            {activeBackend !== "mlx" && (
              <Field label={localizeUi("ui.modals.modeldownloadmodal.embeddingEndpoint")}>
                <select
                  value={config.embeddingPooling}
                  onChange={(event) => handleEmbeddingPoolingChange(event.target.value as SidecarEmbeddingPooling)}
                  aria-label={localizeUi("ui.modals.modeldownloadmodal.poolingType")}
                  className="mari-editor-field w-full px-3 py-2 text-sm"
                >
                  {SIDECAR_EMBEDDING_POOLING_TYPES.map((pooling) => (
                    <option key={pooling} value={pooling}>
                      {formatEmbeddingPoolingLabel(pooling, localizeUi)}
                    </option>
                  ))}
                </select>
                <p className={HINT}>
                  {localizeUi("ui.modals.modeldownloadmodal.useMeanPoolingForOpenaiCompatibleLorebookEmbeddingsRaise")}
                </p>
              </Field>
            )}
            {activeBackend !== "mlx" && (
              <Field label={localizeUi("ui.modals.modeldownloadmodal.physicalBatchSize")}>
                <div className="flex gap-2">
                  {numberInput(
                    localizeUi("ui.modals.modeldownloadmodal.physicalBatchSize"),
                    embeddingBatchSizeInput,
                    setEmbeddingBatchSizeInput,
                    "512",
                    false,
                    handleApplyEmbeddingBatchSize,
                  )}
                  <button
                    type="button"
                    onClick={handleApplyEmbeddingBatchSize}
                    disabled={!embeddingBatchSizeValid || !embeddingBatchSizeDirty}
                    className={SECONDARY}
                  >
                    {localizeUi("ui.modals.modeldownloadmodal.apply")}
                  </button>
                </div>
              </Field>
            )}
            <Field label={localizeUi("ui.modals.modeldownloadmodal.diagnostics")}>
              <div className="flex flex-col gap-1 text-xs text-[var(--muted-foreground)] [overflow-wrap:anywhere]">
                <span>
                  {localizeUi("ui.modals.modeldownloadmodal.status")} {runtimeStatusLabel} · {quickRuntimeSummary}
                </span>
                {runtime.build && runtime.variant && (
                  <span>
                    {localizeUi("ui.modals.modeldownloadmodal.runtimeBuild")} {runtime.build} · {runtime.variant}
                  </span>
                )}
                {runtimeDiagnostics?.gpuVendors.length ? (
                  <span>
                    {localizeUi("ui.modals.modeldownloadmodal.detectedGpuVendors")}{" "}
                    {runtimeDiagnostics.gpuVendors.join(", ")}
                  </span>
                ) : null}
                {isSystemRuntime && runtime.systemPath && (
                  <span>
                    {localizeUi("ui.modals.modeldownloadmodal.usingSystemLlamaServer")} {runtime.systemPath}
                  </span>
                )}
                {runtimeDiagnostics?.launchCommand && (
                  <span className="font-mono">
                    {localizeUi("ui.modals.modeldownloadmodal.lastLaunchCommand")} {runtimeDiagnostics.launchCommand}
                  </span>
                )}
              </div>
              {canReinstallRuntime && runtime.installed && (
                <button type="button" onClick={() => void reinstallRuntime()} className={cn(SECONDARY, "self-start")}>
                  <Download size="0.875rem" aria-hidden />
                  {localizeUi("ui.modals.modeldownloadmodal.reinstallRuntime")}
                </button>
              )}
            </Field>
          </>
        )}
      </div>
    );
    if (view !== "speed")
      footerRight = (
        <button
          type="button"
          onClick={handleApplyGenerationSettings}
          disabled={!generationSettingsValid || !generationSettingsDirty}
          className={PRIMARY}
        >
          {localizeUi("ui.modals.modeldownloadmodal.applySettings")}
        </button>
      );
  }

  const subTitle =
    view === "settings"
      ? localizeUi("connections.builtin.settings")
      : isGroup
        ? localizeUi(`connections.builtin.group.${view}`)
        : null;

  return (
    <Shell
      open={open}
      onClose={onClose}
      title={localizeUi("ui.modals.modeldownloadmodal.localAiModel")}
      opaque
      width="max-w-xl"
      contentRef={modalScrollRef}
      contentClassName="p-0"
    >
      <div className="mari-connection-scope flex min-h-full flex-1 flex-col" data-builtin-model={view}>
        <div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-5">
          {subTitle && (
            <div className="-ms-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setScreen(isGroup && (!hasModel || changing) ? "settings" : "main")}
                aria-label={localizeUi("connections.add.back")}
                className="mari-chrome-control mari-chrome-control--icon mari-chrome-control--quiet"
              >
                <ChevronLeft size="1.125rem" aria-hidden />
              </button>
              <h3 className="text-base font-semibold text-[var(--foreground)]">{subTitle}</h3>
            </div>
          )}
          {body}
        </div>
        {(footerLeft || footerRight) && (
          <div className="sticky bottom-0 z-10 mt-auto flex items-center justify-between gap-3 border-t border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--mari-modal-opaque-bg)] px-4 py-3 [background-image:linear-gradient(var(--marinara-chat-chrome-panel-bg),var(--marinara-chat-chrome-panel-bg))] sm:px-5">
            <div className="flex min-w-0 items-center">{footerLeft}</div>
            {footerRight}
          </div>
        )}
      </div>
    </Shell>
  );
}
