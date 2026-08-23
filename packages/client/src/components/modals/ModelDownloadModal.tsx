// ──────────────────────────────────────────────
// Model Download Modal
//
// Handles curated Gemma downloads plus BYO
// HuggingFace model selection for the local
// sidecar runtime.
// ──────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  HardDrive,
  Loader2,
  MessageSquare,
  Search,
  Server,
  Settings2,
  X,
  Zap,
} from "lucide-react";
import {
  SIDECAR_EMBEDDING_POOLING_TYPES,
  type SidecarBackend,
  type SidecarEmbeddingPooling,
  type SidecarQuantization,
  type SidecarRuntimePreference,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal.js";
import { GEMMA_RESTART_MESSAGE, useSidecarStore } from "../../stores/sidecar.store.js";
import { useTranslation as useUiTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
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

function formatQuantizationLabel(quantization: SidecarQuantization | null, backend: SidecarBackend): string {
  if (backend === "mlx") {
    return quantization === "q4_k_m" ? "4-bit" : "8-bit";
  }
  return quantization?.toUpperCase() ?? "Curated";
}

function formatRuntimeVariantLabel(variant: string | null): string | null {
  if (!variant) return null;
  return variant.replace(/-/g, " ");
}

function formatRuntimePreferenceLabel(preference: SidecarRuntimePreference, platform?: string): string {
  switch (preference) {
    case "auto":
      return "Auto detect";
    case "nvidia":
      return platform === "linux" ? "NVIDIA GPU (Vulkan fallback)" : "NVIDIA GPU (CUDA)";
    case "amd":
      return "AMD GPU";
    case "intel":
      return "Intel GPU";
    case "vulkan":
      return "Vulkan GPU";
    case "cpu":
      return "CPU only";
    case "system":
      return "System llama-server";
    default:
      return preference;
  }
}

function describeGpuLayers(gpuLayers: number): string {
  if (gpuLayers === -1) return "Auto offload";
  if (gpuLayers === 0) return "CPU only";
  return `${gpuLayers} GPU layers`;
}

function formatEmbeddingPoolingLabel(pooling: SidecarEmbeddingPooling): string {
  switch (pooling) {
    case "none":
      return "None";
    case "mean":
      return "Mean";
    case "cls":
      return "CLS";
    case "last":
      return "Last token";
    case "rank":
      return "Rank";
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
      <div className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
        {label}
      </div>
      <div className="rounded-lg bg-[var(--secondary)] p-3 text-sm leading-relaxed text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

export function ModelDownloadModal({ open, onClose }: Props) {
  const { t: localizeUi } = useUiTranslation();
  const {
    status,
    config,
    modelDownloaded,
    modelDisplayName,
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
  const [selectedCustomPath, setSelectedCustomPath] = useState("");
  const [showRuntimeSettings, setShowRuntimeSettings] = useState(false);
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
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const previousScrollLayoutRef = useRef({ showSetupProgress: false, showRuntimeSettings: false });

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
      ? `MLX runtime • ${formatCompactTokens(config.contextSize)} ctx • ${formatCompactTokens(config.maxTokens)} max`
      : [
          formatRuntimePreferenceLabel(config.runtimePreference, platform),
          describeGpuLayers(config.gpuLayers),
          config.enableNativeToolCalls ? "native tools on" : "native tools off",
          `${formatEmbeddingPoolingLabel(config.embeddingPooling)} pooling`,
          `${formatCompactTokens(config.contextSize)} ctx`,
          `${formatCompactTokens(config.maxTokens)} max`,
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

  useEffect(() => {
    if (status === "server_error" || testMessageResult) {
      setShowRuntimeSettings(true);
    }
  }, [status, testMessageResult]);

  const progress = downloadProgress;
  const progressPercent = progress && progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : 0;
  const setupLabel =
    progress?.phase === "runtime"
      ? activeBackend === "mlx"
        ? `Preparing MLX runtime${progress.label ? ` (${progress.label})` : ""}...`
        : `Downloading local runtime${progress.label ? ` (${progress.label})` : ""}...`
      : progress?.phase === "model"
        ? `Downloading model${progress.label ? ` (${progress.label})` : ""}...`
        : isPreparingServer
          ? "Starting local runtime..."
          : "Setting up local runtime...";
  const setupDescription =
    progress?.phase === "model"
      ? isAppleSilicon
        ? "Saving your selected MLX repo and preparing it for local use."
        : "Downloading your selected GGUF and preparing it for local use."
      : progress?.phase === "runtime"
        ? activeBackend === "mlx"
          ? "Downloading a private uv bootstrap and creating an isolated MLX environment inside Marinara's sidecar runtime folder."
          : "Downloading the official local runtime for this device."
        : activeBackend === "mlx"
          ? "Starting the MLX server in the background. You can close this window while Marinara finishes booting it."
          : "Starting the local sidecar server in the background. You can close this window while Marinara finishes booting it.";
  const runtimeStatusLabel = canFinish
    ? "Ready"
    : isBlockingSetup
      ? "Setting up now"
      : isPreparingServer
        ? "Starting runtime"
        : status === "server_error"
          ? "Setup error"
          : runtime.installed
            ? isSystemRuntime
              ? "Using system runtime"
              : "Installed"
            : "Not downloaded yet";

  useEffect(() => {
    const previous = previousScrollLayoutRef.current;
    previousScrollLayoutRef.current = { showSetupProgress, showRuntimeSettings };

    if (!open) return;

    const runtimeSettingsOpened = showRuntimeSettings && !previous.showRuntimeSettings;
    const setupVisibilityChanged = showSetupProgress !== previous.showSetupProgress;
    if (!runtimeSettingsOpened && !setupVisibilityChanged) return;

    modalScrollRef.current?.scrollTo({ top: 0 });
  }, [open, showRuntimeSettings, showSetupProgress]);

  const handleSkip = () => {
    markPrompted();
    onClose();
  };

  const handleCuratedDownload = async () => {
    markPrompted();
    if (await startDownload(selectedQuant)) {
      toast.success(GEMMA_RESTART_MESSAGE);
    }
  };

  const handleCustomDownload = async () => {
    if (!repoInput.trim()) return;
    markPrompted();
    if (await startCustomDownload(repoInput.trim(), isAppleSilicon ? undefined : selectedCustomPath)) {
      toast.success(
        localizeUi("ui.modals.modeldownloadmodal.localModelDownloadedCompletelyRestartMarinaraEngineBeforeUsing"),
      );
    }
  };

  const handleListModels = async () => {
    await listHuggingFaceModels(repoInput.trim());
  };

  const handleDone = () => {
    markPrompted();
    onClose();
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={localizeUi("ui.modals.modeldownloadmodal.localAiModel")}
      width="max-w-2xl"
      contentRef={modalScrollRef}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="mari-chrome-accent-soft-tile mari-accent-animated flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <BrainCircuit size="1.25rem" />
          </div>
          <div className="text-sm text-[var(--muted-foreground)]">
            <p>{localizeUi("ui.modals.modeldownloadmodal.marinaraEngineCanRunALocalSidecarForTrackers")}</p>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]/70">
              {isAppleSilicon
                ? localizeUi("ui.modals.modeldownloadmodal.setUpTheMlxRuntimeFirstIfYouWant")
                : localizeUi("ui.modals.modeldownloadmodal.setUpTheRuntimeFirstThenChooseEitherA")}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--warning)]">
            <AlertTriangle size="0.95rem" className="shrink-0" />
            {localizeUi("ui.modals.modeldownloadmodal.localModelIsForHelpersNotMainRoleplay")}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.modals.modeldownloadmodal.theBundledModelIsDeliberatelySmallSoItCan")}
          </p>
        </div>

        {hasModel && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/15">
                <Check size="1rem" className="text-green-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-green-300">{activeModelName ?? "Model Installed"}</div>
                <div className="text-xs text-[var(--muted-foreground)]/70">
                  {config.customModelRepo
                    ? config.backend === "mlx"
                      ? localizeUi("ui.modals.modeldownloadmodal.customMlxRepoValue1", {
                          value1: config.customModelRepo,
                        })
                      : localizeUi("ui.modals.modeldownloadmodal.customGgufFromValue1", {
                          value1: config.customModelRepo,
                        })
                    : localizeUi("ui.modals.modeldownloadmodal.value1Gemma4Value2Preset", {
                        value1: formatQuantizationLabel(config.quantization, config.backend),
                        value2:
                          config.backend === "mlx"
                            ? localizeUi("ui.modals.modeldownloadmodal.mlx")
                            : localizeUi("ui.modals.modeldownloadmodal.gguf"),
                      })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-3">
          <div className="flex items-start justify-between gap-3 max-sm:flex-col">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Server size="0.95rem" className="mari-chrome-accent-icon mari-accent-animated" />
                {localizeUi("ui.panels.extensionsettings.runtime")}
              </div>
              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                <span>
                  {localizeUi("ui.modals.modeldownloadmodal.status")} {runtimeStatusLabel}
                </span>
                <span> • </span>
                <span>{quickRuntimeSummary}</span>
              </div>
              <div className="mt-1 text-xs text-[var(--muted-foreground)]/75">
                {runtime.installed
                  ? isSystemRuntime
                    ? localizeUi("ui.modals.modeldownloadmodal.usingSystemLlamaServerValue1", {
                        value1: runtime.systemPath
                          ? localizeUi("ui.modals.modeldownloadmodal.value1", { value1: runtime.systemPath })
                          : "",
                      })
                    : runtime.variant
                      ? localizeUi("ui.modals.modeldownloadmodal.installedRuntimeValue1", {
                          value1: formatRuntimeVariantLabel(runtime.variant),
                        })
                      : localizeUi("ui.modals.modeldownloadmodal.runtimeInstalledAndReadyToUse")
                  : hasModel
                    ? localizeUi("ui.modals.modeldownloadmodal.yourModelIsReadyButTheRuntimeHasNot")
                    : localizeUi("ui.modals.modeldownloadmodal.installAndConfigureTheRuntimeHereThenChooseA")}
              </div>
              {status === "server_error" && (
                <div className="mt-2 text-xs text-amber-200">
                  {localizeUi("ui.modals.modeldownloadmodal.runtimeStartupFailedOpenRuntimeSettingsForDetails")}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowRuntimeSettings((current) => !current)}
              className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)]"
            >
              <Settings2 size="0.875rem" />
              {localizeUi("ui.modals.modeldownloadmodal.runtimeSettings")}
              {showRuntimeSettings ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
            </button>
          </div>

          {!showSetupProgress && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!runtime.installed ? (
                <button
                  onClick={() => void installRuntime()}
                  className="mari-chrome-accent-surface mari-accent-animated flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                >
                  <Download size="0.875rem" />
                  {activeBackend === "mlx"
                    ? localizeUi("ui.modals.modeldownloadmodal.installMlxRuntime")
                    : localizeUi("ui.modals.modeldownloadmodal.installRuntime")}
                </button>
              ) : (
                <>
                  {hasModel && (
                    <button
                      onClick={() => void restartRuntime()}
                      className="mari-chrome-accent-surface mari-accent-animated flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                    >
                      <Loader2 size="0.875rem" />
                      {status === "server_error"
                        ? localizeUi("ui.modals.modeldownloadmodal.retryStartup")
                        : inferenceReady
                          ? localizeUi("ui.modals.modeldownloadmodal.restartRuntime")
                          : localizeUi("ui.modals.modeldownloadmodal.startRuntime")}
                    </button>
                  )}
                  {canReinstallRuntime && (
                    <button
                      onClick={() => void reinstallRuntime()}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)]"
                    >
                      <Download size="0.875rem" />
                      {localizeUi("ui.modals.modeldownloadmodal.reinstallRuntime")}
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => {
                  setShowRuntimeSettings(true);
                  void sendTestMessage();
                }}
                disabled={!hasModel || !runtime.installed || testMessagePending}
                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testMessagePending ? (
                  <Loader2 size="0.875rem" className="animate-spin" />
                ) : (
                  <MessageSquare size="0.875rem" />
                )}
                {localizeUi("ui.connections.connectioneditor.sendTestMessage")}
              </button>
            </div>
          )}

          {showRuntimeSettings && (
            <div className="mt-4 flex flex-col gap-4 rounded-xl border border-[var(--border)]/80 bg-[var(--secondary)]/40 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                    {localizeUi("ui.modals.modeldownloadmodal.runtimeTarget")}
                  </div>
                  {activeBackend === "mlx" ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/60 px-3 py-2 text-sm text-[var(--muted-foreground)]/75">
                      {localizeUi("ui.modals.modeldownloadmodal.mlxChoosesTheAppleSiliconAcceleratorPathAutomatically")}
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <select
                          value={config.runtimePreference}
                          onChange={(event) =>
                            handleRuntimePreferenceChange(event.target.value as SidecarRuntimePreference)
                          }
                          className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 pr-10 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                        >
                          {runtimePreferenceOptions.map((option) => (
                            <option key={option} value={option}>
                              {formatRuntimePreferenceLabel(option, platform)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size="0.95rem"
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]/70"
                        />
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]/70">
                        {localizeUi("ui.modals.modeldownloadmodal.pickTheGpuFamilyYouActuallyWantMarinaraTo")}
                      </div>
                      {platform === "linux" && config.runtimePreference === "nvidia" && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                          {localizeUi("ui.modals.modeldownloadmodal.linuxCudaBinariesAreNotCurrentlyPublishedByLlama")}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                    {localizeUi("ui.modals.modeldownloadmodal.gpuOffload")}
                  </div>
                  {activeBackend === "mlx" ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/60 px-3 py-2 text-sm text-[var(--muted-foreground)]/75">
                      {localizeUi("ui.modals.modeldownloadmodal.mlxManagesGpuOffloadAutomatically")}
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <select
                          value={gpuLayersMode}
                          onChange={(event) =>
                            handleGpuLayersModeChange(event.target.value as "auto" | "cpu" | "custom")
                          }
                          className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 pr-10 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                        >
                          <option value="auto">{localizeUi("ui.modals.modeldownloadmodal.autoOffload")}</option>
                          <option value="cpu">{localizeUi("ui.modals.modeldownloadmodal.cpuOnly")}</option>
                          <option value="custom">{localizeUi("ui.modals.modeldownloadmodal.customGpuLayers")}</option>
                        </select>
                        <ChevronDown
                          size="0.95rem"
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]/70"
                        />
                      </div>
                      {gpuLayersMode === "custom" && (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            value={gpuLayersInput}
                            onChange={(event) => setGpuLayersInput(event.target.value.replace(/[^\d]/g, ""))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                handleApplyCustomGpuLayers();
                              }
                            }}
                            placeholder="1-1024"
                            inputMode="numeric"
                            className="w-24 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 text-center text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                          />
                          <button
                            onClick={handleApplyCustomGpuLayers}
                            className="flex shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--card)]"
                          >
                            {localizeUi("ui.modals.modeldownloadmodal.apply")}
                          </button>
                        </div>
                      )}
                      <div className="text-xs text-[var(--muted-foreground)]/70">
                        {localizeUi("ui.modals.modeldownloadmodal.autoTriesMaxOffloadFirstCpuOnlyDisablesGpu")}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-4">
                <div className="flex items-start justify-between gap-3 max-sm:flex-col">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                      {localizeUi("ui.modals.modeldownloadmodal.nativeToolCalls")}
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]/75">
                      {activeBackend === "mlx"
                        ? localizeUi("ui.modals.modeldownloadmodal.thisLlamaCppJinjaOptionDoesNotApplyTo")
                        : localizeUi("ui.modals.modeldownloadmodal.startsLlamaServerWithJinjaSoOpenaiCompatibleTool")}
                    </div>
                  </div>
                  {activeBackend === "mlx" ? (
                    <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted-foreground)]">
                      {localizeUi("ui.modals.modeldownloadmodal.llamaCppOnly")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNativeToolCallsToggle}
                      className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--card)]"
                    >
                      <span
                        className={`relative h-4 w-7 rounded-full transition-colors ${
                          config.enableNativeToolCalls ? "bg-emerald-400/70" : "bg-[var(--border)]"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                            config.enableNativeToolCalls ? "translate-x-3" : ""
                          }`}
                        />
                      </span>
                      {config.enableNativeToolCalls
                        ? localizeUi("ui.noodle.noodlehome.enabled")
                        : localizeUi("ui.agents.agenteditor.disabled")}
                    </button>
                  )}
                </div>
                {!config.enableNativeToolCalls && activeBackend !== "mlx" && (
                  <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                    {localizeUi("ui.modals.modeldownloadmodal.professorMariAndCustomAgentsNeedThisEnabledBefore")}
                  </div>
                )}
              </div>

              {activeBackend !== "mlx" && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                    {localizeUi("ui.modals.modeldownloadmodal.embeddingEndpoint")}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                        {localizeUi("ui.modals.modeldownloadmodal.poolingType")}
                      </span>
                      <div className="relative">
                        <select
                          value={config.embeddingPooling}
                          onChange={(event) =>
                            handleEmbeddingPoolingChange(event.target.value as SidecarEmbeddingPooling)
                          }
                          className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 pr-10 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                        >
                          {SIDECAR_EMBEDDING_POOLING_TYPES.map((pooling) => (
                            <option key={pooling} value={pooling}>
                              {formatEmbeddingPoolingLabel(pooling)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size="0.95rem"
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]/70"
                        />
                      </div>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                        {localizeUi("ui.modals.modeldownloadmodal.physicalBatchSize")}
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          value={embeddingBatchSizeInput}
                          onChange={(event) => setEmbeddingBatchSizeInput(event.target.value.replace(/[^\d]/g, ""))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              handleApplyEmbeddingBatchSize();
                            }
                          }}
                          inputMode="numeric"
                          placeholder="512"
                          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                        />
                        <button
                          onClick={handleApplyEmbeddingBatchSize}
                          disabled={!embeddingBatchSizeValid || !embeddingBatchSizeDirty}
                          className="flex shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--card)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {localizeUi("ui.modals.modeldownloadmodal.apply")}
                        </button>
                      </div>
                    </label>
                  </div>
                  <div className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]/70">
                    {localizeUi(
                      "ui.modals.modeldownloadmodal.useMeanPoolingForOpenaiCompatibleLorebookEmbeddingsRaise",
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-4">
                <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                  {localizeUi("ui.modals.modeldownloadmodal.inferenceSettings")}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                      {localizeUi("ui.modals.modeldownloadmodal.contextWindow")}
                    </span>
                    <input
                      value={contextSizeInput}
                      onChange={(event) => setContextSizeInput(event.target.value.replace(/[^\d]/g, ""))}
                      inputMode="numeric"
                      placeholder="8192"
                      className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                      {localizeUi("ui.modals.modeldownloadmodal.maxResponseTokens")}
                    </span>
                    <input
                      value={maxTokensInput}
                      onChange={(event) => setMaxTokensInput(event.target.value.replace(/[^\d]/g, ""))}
                      inputMode="numeric"
                      placeholder="4096"
                      className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                      {localizeUi("ui.modals.modeldownloadmodal.temperature")}
                    </span>
                    <input
                      value={temperatureInput}
                      onChange={(event) => setTemperatureInput(event.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      placeholder="0.3"
                      className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                      {localizeUi("ui.modals.modeldownloadmodal.topP")}
                    </span>
                    <input
                      value={topPInput}
                      onChange={(event) => setTopPInput(event.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      placeholder="0.95"
                      className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 md:max-w-[12rem]">
                    <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                      {localizeUi("ui.modals.modeldownloadmodal.topK")}
                    </span>
                    <input
                      value={topKInput}
                      onChange={(event) => setTopKInput(event.target.value.replace(/[^\d]/g, ""))}
                      inputMode="numeric"
                      placeholder="64"
                      className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                      {localizeUi("ui.connections.connectioneditor.maxParallelAgentJobs")}
                    </span>
                    <input
                      value={maxParallelJobsInput}
                      onChange={(event) => setMaxParallelJobsInput(event.target.value.replace(/[^\d]/g, ""))}
                      inputMode="numeric"
                      min={1}
                      max={16}
                      placeholder="2"
                      className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                    />
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
                  <div className="text-xs text-[var(--muted-foreground)]/70">
                    {localizeUi("ui.modals.modeldownloadmodal.maxResponseTokensCapsHowMuchTheLocalRuntime")}
                  </div>
                  <button
                    onClick={handleApplyGenerationSettings}
                    disabled={!generationSettingsValid || !generationSettingsDirty}
                    className="flex shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--card)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {localizeUi("ui.modals.modeldownloadmodal.applySettings")}
                  </button>
                </div>
              </div>

              {runtime.installed && (
                <div className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-3 text-xs text-[var(--muted-foreground)]/75">
                  <span>
                    {localizeUi("ui.modals.modeldownloadmodal.status")} {runtimeStatusLabel}
                  </span>
                  {runtime.build && runtime.variant && (
                    <span>
                      {localizeUi("ui.modals.modeldownloadmodal.runtimeBuild")} {runtime.build} • {runtime.variant}
                    </span>
                  )}
                  {isSystemRuntime && runtime.systemPath && (
                    <span>
                      {localizeUi("ui.modals.modeldownloadmodal.usingSystemLlamaServer")} {runtime.systemPath}
                    </span>
                  )}
                </div>
              )}

              {status === "server_error" && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                  <div className="text-sm font-medium text-amber-200">
                    {localizeUi("ui.modals.modeldownloadmodal.localRuntimeFailedToStart")}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted-foreground)]/85">
                    {localizeUi("ui.modals.modeldownloadmodal.marinaraWillKeepWorkingWithoutTheLocalModelUntil")}
                  </div>
                  <div className="mt-3 flex flex-col gap-1 text-xs text-[var(--muted-foreground)]/75">
                    {failedRuntimeVariant && (
                      <span>
                        {localizeUi("ui.panels.sidecarcard.runtime")} {formatRuntimeVariantLabel(failedRuntimeVariant)}
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
                  <div className="mt-3 flex gap-2 max-sm:flex-col">
                    <button
                      onClick={() => void restartRuntime()}
                      className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/25"
                    >
                      <Loader2 size="0.875rem" />
                      {localizeUi("ui.modals.modeldownloadmodal.retryStartup")}
                    </button>
                    {canReinstallRuntime && (
                      <button
                        onClick={() => void reinstallRuntime()}
                        className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 px-4 py-2.5 text-sm text-amber-100 transition-colors hover:bg-amber-500/10"
                      >
                        <Download size="0.875rem" />
                        {localizeUi("ui.modals.modeldownloadmodal.reinstallRuntime")}
                      </button>
                    )}
                    <button
                      onClick={() => void updateConfig({ useForTrackers: false, useForGameScene: false })}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)]"
                    >
                      {localizeUi("ui.modals.modeldownloadmodal.continueWithoutLocalAi")}
                    </button>
                  </div>
                </div>
              )}

              {testMessageResult && (
                <div
                  className={`rounded-xl border p-4 ${
                    testMessageResult.success
                      ? "border-emerald-500/25 bg-emerald-500/5"
                      : "border-red-500/25 bg-red-500/5"
                  }`}
                >
                  <div
                    className={`text-sm font-medium ${testMessageResult.success ? "text-emerald-300" : "text-red-300"}`}
                  >
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
                              {localizeUi("ui.modals.modeldownloadmodal.usagePrompt")}{" "}
                              {testMessageResult.usage.promptTokens ?? "?"}
                              {localizeUi("ui.modals.modeldownloadmodal.completion")}{" "}
                              {testMessageResult.usage.completionTokens ?? "?"}
                              {localizeUi("ui.modals.modeldownloadmodal.total")}{" "}
                              {testMessageResult.usage.totalTokens ?? "?"}
                            </span>
                          )}
                          {testMessageResult.usage && testMessageResult.timings && <span> • </span>}
                          {testMessageResult.timings && (
                            <span>
                              {localizeUi("ui.modals.modeldownloadmodal.timingsPrompt")}{" "}
                              {testMessageResult.timings.promptMs ?? "?"}
                              {localizeUi("ui.modals.modeldownloadmodal.msGen")}{" "}
                              {testMessageResult.timings.predictedMs ?? "?"}
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
                          {localizeUi("ui.panels.sidecarcard.runtime")}{" "}
                          {formatRuntimeVariantLabel(testMessageResult.failedRuntimeVariant)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {runtimeDiagnostics && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-3">
                  <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                    {localizeUi("ui.modals.modeldownloadmodal.diagnostics")}
                  </div>
                  <div className="mt-2 flex flex-col gap-1 text-xs text-[var(--muted-foreground)]/75">
                    {runtimeDiagnostics.gpuVendors.length > 0 && (
                      <span>
                        {localizeUi("ui.modals.modeldownloadmodal.detectedGpuVendors")}{" "}
                        {runtimeDiagnostics.gpuVendors.join(", ")}
                      </span>
                    )}
                    <span>
                      {localizeUi("ui.modals.modeldownloadmodal.backendHints")}
                      {runtimeDiagnostics.preferCuda ? localizeUi("ui.modals.modeldownloadmodal.cuda") : ""}
                      {runtimeDiagnostics.preferHip ? localizeUi("ui.modals.modeldownloadmodal.hip") : ""}
                      {runtimeDiagnostics.preferRocm ? localizeUi("ui.modals.modeldownloadmodal.rocm") : ""}
                      {runtimeDiagnostics.preferSycl ? localizeUi("ui.modals.modeldownloadmodal.sycl") : ""}
                      {runtimeDiagnostics.preferVulkan ? localizeUi("ui.modals.modeldownloadmodal.vulkan") : ""}
                      {!runtimeDiagnostics.preferCuda &&
                      !runtimeDiagnostics.preferHip &&
                      !runtimeDiagnostics.preferRocm &&
                      !runtimeDiagnostics.preferSycl &&
                      !runtimeDiagnostics.preferVulkan
                        ? localizeUi("ui.modals.modeldownloadmodal.none")
                        : ""}
                    </span>
                    {runtimeDiagnostics.systemLlamaPath && (
                      <span>
                        {localizeUi("ui.modals.modeldownloadmodal.systemLlamaServer")}{" "}
                        {runtimeDiagnostics.systemLlamaPath}
                      </span>
                    )}
                    {runtimeDiagnostics.launchCommand && (
                      <span>
                        {localizeUi("ui.modals.modeldownloadmodal.lastLaunchCommand")}{" "}
                        {runtimeDiagnostics.launchCommand}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showSetupProgress && (
          <div className="rounded-xl border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] p-4">
            <div className="flex items-start gap-3">
              <div className="mari-chrome-accent-soft-tile mari-accent-animated mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                <Loader2 size="1rem" className="animate-spin" />
              </div>
              <div className="flex-1">
                <div className="mari-chrome-text-strong text-sm font-medium">{setupLabel}</div>
                <div className="mt-1 text-xs text-[var(--muted-foreground)]/80">{setupDescription}</div>
              </div>
            </div>

            {progress ? (
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span>{setupLabel}</span>
                  <span>
                    {formatBytes(progress.downloaded)}
                    {progress.total > 0 && ` / ${formatBytes(progress.total)}`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="mari-chrome-accent-progress mari-accent-animated h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]/60">
                  <span>{progressPercent}%</span>
                  {progress.speed > 0 && <span>{formatSpeed(progress.speed)}</span>}
                </div>
              </div>
            ) : (
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <div className="mari-chrome-accent-progress mari-accent-animated h-full w-1/3 animate-pulse rounded-full" />
              </div>
            )}
          </div>
        )}

        {!showSetupProgress && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                {isAppleSilicon
                  ? localizeUi("ui.modals.modeldownloadmodal.curatedGemma4PresetsForAppleSilicon")
                  : localizeUi("ui.modals.modeldownloadmodal.curatedGemma4Presets")}
              </span>
              {curatedModels.map((model) => (
                <label
                  key={`${model.backend}-${model.quantization}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                    selectedQuant === model.quantization
                      ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
                      : "border-[var(--border)] hover:bg-[var(--secondary)]/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="quantization"
                    value={model.quantization}
                    checked={selectedQuant === model.quantization}
                    onChange={() => setSelectedQuant(model.quantization)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                      selectedQuant === model.quantization
                        ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-accent)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {selectedQuant === model.quantization && (
                      <div className="flex h-full items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{model.label}</div>
                    <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]/70">
                      <span className="flex items-center gap-1">
                        <Download size="0.75rem" />
                        {formatBytes(model.sizeBytes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive size="0.75rem" />~{formatBytes(model.ramBytes)}{" "}
                        {localizeUi("ui.modals.modeldownloadmodal.ram")}
                      </span>
                    </div>
                  </div>
                  {model.quantization === "q8_0" && (
                    <span className="mari-chrome-accent-surface mari-accent-animated rounded-full px-2 py-0.5 text-[0.625rem] font-medium">
                      {localizeUi("ui.modals.modeldownloadmodal.recommended")}
                    </span>
                  )}
                </label>
              ))}
              <button
                onClick={handleCuratedDownload}
                disabled={!selectedPreset}
                className="mari-chrome-accent-surface mari-accent-animated mt-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Zap size="0.875rem" />
                {hasModel
                  ? localizeUi("ui.modals.modeldownloadmodal.switchToCuratedPreset")
                  : localizeUi("ui.modals.modeldownloadmodal.useCuratedPreset")}
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-3">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                {isAppleSilicon
                  ? localizeUi("ui.modals.modeldownloadmodal.useYourOwnMlxModelFromHuggingface")
                  : localizeUi("ui.modals.modeldownloadmodal.useYourOwnModelFromHuggingface")}
              </div>
              <div className="mt-2 text-xs text-[var(--muted-foreground)]/70">
                {isAppleSilicon
                  ? localizeUi("ui.modals.modeldownloadmodal.enterAnMlxNativeHuggingfaceRepoMarinaraWillValidate")
                  : localizeUi("ui.modals.modeldownloadmodal.enterAGgufRepoOnHuggingfaceListTheAvailable")}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex gap-2 max-sm:flex-col">
                  <input
                    value={repoInput}
                    onChange={(event) => {
                      setRepoInput(event.target.value);
                      if (customModels.length > 0 || customModelsError) {
                        clearCustomModels();
                        setSelectedCustomPath("");
                      }
                    }}
                    placeholder={localizeUi("ui.modals.modeldownloadmodal.ownerRepo")}
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)]"
                  />
                  <button
                    onClick={() => void handleListModels()}
                    disabled={!repoInput.trim() || customModelsLoading}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)] disabled:opacity-50"
                  >
                    {customModelsLoading ? (
                      <Loader2 size="0.875rem" className="animate-spin" />
                    ) : (
                      <Search size="0.875rem" />
                    )}
                    {isAppleSilicon
                      ? localizeUi("ui.modals.modeldownloadmodal.validateRepo")
                      : localizeUi("ui.modals.modeldownloadmodal.listModels")}
                  </button>
                </div>

                {customModelsError && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
                    {customModelsError}
                  </div>
                )}

                {isAppleSilicon && selectedCustomEntry && (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                    <div className="text-sm font-medium text-emerald-300">{selectedCustomEntry.filename}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]/75">
                      {selectedCustomEntry.quantizationLabel && <span>{selectedCustomEntry.quantizationLabel}</span>}
                      {selectedCustomEntry.sizeBytes && <span>{formatBytes(selectedCustomEntry.sizeBytes)}</span>}
                      <span>{localizeUi("ui.modals.modeldownloadmodal.mlxRepoValidated")}</span>
                    </div>
                  </div>
                )}

                {!isAppleSilicon && customModels.length > 0 && (
                  <>
                    <select
                      value={selectedCustomPath}
                      onChange={(event) => setSelectedCustomPath(event.target.value)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--marinara-chat-chrome-input-border-focus)]"
                    >
                      {customModels.map((entry) => (
                        <option key={entry.path} value={entry.path}>
                          {entry.filename}
                          {entry.quantizationLabel
                            ? localizeUi("ui.modals.modeldownloadmodal.value1_8a04cf4", {
                                value1: entry.quantizationLabel,
                              })
                            : ""}
                          {entry.sizeBytes
                            ? localizeUi("ui.modals.modeldownloadmodal.value1_8a04cf4", {
                                value1: formatBytes(entry.sizeBytes),
                              })
                            : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleCustomDownload}
                      disabled={!selectedCustomPath}
                      className="flex items-center justify-center gap-2 rounded-xl bg-sky-500/15 px-4 py-2.5 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
                    >
                      <Download size="0.875rem" />
                      {hasModel
                        ? localizeUi("ui.modals.modeldownloadmodal.switchToSelectedGguf")
                        : localizeUi("ui.modals.modeldownloadmodal.downloadSelectedGguf")}
                    </button>
                  </>
                )}

                {isAppleSilicon && (
                  <button
                    onClick={handleCustomDownload}
                    disabled={!repoInput.trim() || customModelsLoading || !isCustomRepoValidated}
                    className="flex items-center justify-center gap-2 rounded-xl bg-sky-500/15 px-4 py-2.5 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
                  >
                    <Download size="0.875rem" />
                    {hasModel
                      ? localizeUi("ui.modals.modeldownloadmodal.switchToValidatedMlxRepo")
                      : localizeUi("ui.modals.modeldownloadmodal.useValidatedMlxRepo")}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {progress?.status === "error" && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
            {progress.error || "Download failed. Please try again."}
          </div>
        )}

        <div className="flex items-center gap-2">
          {showSetupProgress ? (
            <button
              onClick={handleCancelSetup}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)]"
            >
              <X size="0.875rem" />
              {localizeUi("ui.modals.modeldownloadmodal.cancelSetup")}
            </button>
          ) : (
            <>
              <button
                onClick={handleSkip}
                className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)]"
              >
                {hasModel
                  ? localizeUi("capabilities.actions.close")
                  : localizeUi("ui.modals.modeldownloadmodal.skipForNow")}
              </button>
              <button
                onClick={handleDone}
                disabled={!canFinish}
                className="mari-chrome-accent-surface mari-accent-animated flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {localizeUi("lorebook.editor.batch.done")}
              </button>
            </>
          )}
        </div>

        {!hasModel && !showSetupProgress && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-3">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
              {localizeUi("ui.modals.modeldownloadmodal.whatTheLocalModelHandles")}
            </span>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-[var(--muted-foreground)]/80">
              <li>{localizeUi("ui.modals.modeldownloadmodal.trackerAgentsInRoleplayMode")}</li>
              <li>{localizeUi("ui.modals.modeldownloadmodal.sceneEffectsInGameModeBackgroundsMusicSfxAmbient")}</li>
              <li>{localizeUi("ui.modals.modeldownloadmodal.widgetUpdatesWeatherAndTimeOfDayChanges")}</li>
              <li>{localizeUi("ui.modals.modeldownloadmodal.npcReputationTrackingAndExpressionSelection")}</li>
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
