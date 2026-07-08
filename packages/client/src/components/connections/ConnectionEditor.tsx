// ──────────────────────────────────────────────
// Full-Page Connection Editor
// Click a connection → opens this editor (like presets/characters)
// ──────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useUIStore } from "../../stores/ui.store";
import {
  useConnection,
  useConnections,
  useUpdateConnection,
  useDeleteConnection,
  useTestConnection,
  useTestMessage,
  useTestImageGeneration,
  useTestVideoGeneration,
  useDiagnoseClaudeSubscription,
  useFetchModels,
  useSaveConnectionDefaults,
  type ClaudeSubscriptionDiagnosis,
  type RemoteConnectionModel,
} from "../../hooks/use-connections";
import { usePresets } from "../../hooks/use-presets";
import {
  ArrowLeft,
  Save,
  Trash2,
  Upload,
  Link,
  Wifi,
  MessageSquare,
  FileText,
  Search,
  Tag,
  Check,
  X,
  Loader2,
  AlertCircle,
  Zap,
  Globe,
  Key,
  Server,
  Sparkles,
  ChevronDown,
  ExternalLink,
  ImageIcon,
  Film,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";
import {
  CONNECTION_EXPORT_WARNING,
  createConnectionExportEnvelope,
  type ConnectionTransferRow,
} from "../../lib/connection-transfer";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { HelpTooltip } from "../ui/HelpTooltip";
import { SettingsCheckbox, SettingsSwitch } from "../panels/settings/SettingControls";
import {
  CONNECTION_PARAMETER_DEFAULTS,
  GenerationParametersFields,
  STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS,
  getEditableGenerationParameters,
  parseEditableGenerationParameters,
  type EditableGenerationParameters,
} from "../ui/GenerationParametersEditor";
import {
  PROVIDERS,
  LOCAL_SIDECAR_CONNECTION_ID,
  MODEL_LISTS,
  IMAGE_GENERATION_SOURCES,
  VIDEO_GENERATION_SOURCES,
  inferImageSource,
  inferVideoSource,
  isLocalAuthProvider as isLocalAuthConnectionProvider,
  IMAGE_DEFAULTS_STORAGE_KEY,
  VIDEO_DEFAULTS_STORAGE_KEY,
  COMFYUI_SAMPLER_OPTIONS,
  COMFYUI_SCHEDULER_OPTIONS,
  NOVELAI_NOISE_SCHEDULE_OPTIONS,
  NOVELAI_SAMPLER_OPTIONS,
  SD_WEBUI_SAMPLER_OPTIONS,
  SD_WEBUI_SCHEDULER_OPTIONS,
  createDefaultImageGenerationProfile,
  createDefaultVideoGenerationProfile,
  imageSourceToDefaultsService,
  normalizeImageGenerationProfile,
  normalizeVideoGenerationProfile,
  sanitizeImageGenerationProfile,
  sanitizeVideoGenerationProfile,
  suggestImageStyleProfileIdForModel,
  type APIProvider,
  type ImageDefaultsService,
  type ImageGenerationDefaultsProfile,
  type ImageStyleProfileSettings,
  type VideoDefaultsService,
  type VideoGenerationDefaultsProfile,
  type VideoReferenceUploadExpiry,
  type VideoResolution,
} from "@marinara-engine/shared";

/** Links where users can obtain API keys for each provider */
const API_KEY_LINKS: Partial<Record<APIProvider, { label: string; url: string }>> = {
  openai: { label: "Get your OpenAI API key", url: "https://platform.openai.com/api-keys" },
  anthropic: { label: "Get your Anthropic API key", url: "https://console.anthropic.com/settings/keys" },
  google: { label: "Get your Google AI API key", url: "https://aistudio.google.com/apikey" },
  google_vertex: {
    label: "Open Vertex AI credentials docs",
    url: "https://cloud.google.com/vertex-ai/docs/authentication",
  },
  mistral: { label: "Get your Mistral API key", url: "https://console.mistral.ai/api-keys" },
  cohere: { label: "Get your Cohere API key", url: "https://dashboard.cohere.com/api-keys" },
  openrouter: { label: "Get your OpenRouter API key", url: "https://openrouter.ai/keys" },
  nanogpt: { label: "Get your NanoGPT API key", url: "https://nano-gpt.com/api" },
  xai: { label: "Get your xAI API key", url: "https://console.x.ai" },
  video_generation: { label: "Get your Google AI API key", url: "https://aistudio.google.com/apikey" },
};

const DEFAULT_CACHING_AT_DEPTH = 5;
const MAX_CACHING_AT_DEPTH = 100;
const DEFAULT_MAX_PARALLEL_JOBS = 1;
const MAX_PARALLEL_JOBS = 16;
const GROK_CLI_DEFAULT_CONTEXT_TOKENS = 32_000;
const STALE_GROK_CLI_MODEL_IDS = new Set(["grok-build-latest", "grok-build-0.1"]);
const DEFAULT_VIDEO_MODELS: Record<VideoDefaultsService, string> = {
  gemini_omni: "gemini-omni-flash-preview",
  google_veo: "veo-3.1-generate-preview",
  xai: "grok-imagine-video-1.5",
  openrouter: "google/veo-3.1",
  seedance: "seedance-2-0",
};
const VIDEO_RESOLUTION_OPTIONS: Array<{ value: VideoResolution; label: string }> = [
  { value: "480p", label: "480p" },
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
];
const VIDEO_REFERENCE_UPLOAD_EXPIRY_OPTIONS: Array<{ value: VideoReferenceUploadExpiry; label: string }> = [
  { value: "1h", label: "1 hour" },
  { value: "12h", label: "12 hours" },
  { value: "24h", label: "24 hours" },
  { value: "72h", label: "72 hours" },
];

function videoSourceToDefaultsService(value: string | null | undefined): VideoDefaultsService {
  return value === "xai" || value === "openrouter" || value === "seedance" || value === "google_veo"
    ? value
    : "gemini_omni";
}

function videoSelectionToDefaultsService(
  value: string | null | undefined,
  model = "",
  baseUrl = "",
): VideoDefaultsService {
  const normalized = value?.trim();
  if (normalized === "google_ai_studio") {
    return videoSourceToDefaultsService(inferVideoSource(model, baseUrl));
  }
  return videoSourceToDefaultsService(normalized || inferVideoSource(model, baseUrl));
}

function videoSourceToProviderOption(value: string | null | undefined): string {
  const service = videoSourceToDefaultsService(value);
  return service === "gemini_omni" || service === "google_veo" ? "google_ai_studio" : service;
}

function videoProviderServiceForModel(
  provider: string | null | undefined,
  model = "",
  baseUrl = "",
): VideoDefaultsService {
  const normalized = provider?.trim();
  if (normalized === "google_ai_studio") {
    return videoSourceToDefaultsService(inferVideoSource(model, baseUrl));
  }
  return videoSourceToDefaultsService(normalized);
}

function defaultVideoModelForService(value: string | null | undefined): string {
  return DEFAULT_VIDEO_MODELS[videoSourceToDefaultsService(value)];
}

function normalizeEndpointUrlInput(raw: string, label: string): { value: string; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: "", error: null };

  const value = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    new URL(value);
  } catch {
    return { value: trimmed, error: `${label} must be a valid URL, like http://localhost:11434/v1.` };
  }
  return { value, error: null };
}

function canProviderTreatAsLocalEndpoint(provider: APIProvider): boolean {
  return provider !== "image_generation" && provider !== "video_generation" && !isLocalAuthConnectionProvider(provider);
}

function providerSupportsDirectEmbeddingConfig(provider: APIProvider): boolean {
  return (
    provider !== "image_generation" &&
    provider !== "video_generation" &&
    provider !== "anthropic" &&
    !isLocalAuthConnectionProvider(provider)
  );
}

function normalizeGrokCliEditorModel(provider: APIProvider, model: string): string {
  return provider === "grok_subscription" && STALE_GROK_CLI_MODEL_IDS.has(model.trim()) ? "" : model;
}

function normalizeConnectionMaxContext(provider: APIProvider, value: unknown): number {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  if (provider === "grok_subscription") return numericValue > 0 ? numericValue : GROK_CLI_DEFAULT_CONTEXT_TOKENS;
  return numericValue || 128000;
}

function normalizeCachingAtDepth(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return DEFAULT_CACHING_AT_DEPTH;
  return Math.min(MAX_CACHING_AT_DEPTH, Math.floor(value));
}

function normalizeMaxParallelJobs(value: unknown): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric) || numeric < 1) return DEFAULT_MAX_PARALLEL_JOBS;
  return Math.min(MAX_PARALLEL_JOBS, Math.floor(numeric));
}

// ═══════════════════════════════════════════════
//  Main Editor
// ═══════════════════════════════════════════════

export function ConnectionEditor() {
  const connectionDetailId = useUIStore((s) => s.connectionDetailId);
  const closeConnectionDetail = useUIStore((s) => s.closeConnectionDetail);

  const { data: conn, isLoading } = useConnection(connectionDetailId);
  const updateConnection = useUpdateConnection();
  const deleteConnection = useDeleteConnection();
  const testConnection = useTestConnection();
  const testMessage = useTestMessage();
  const testImageGeneration = useTestImageGeneration();
  const testVideoGeneration = useTestVideoGeneration();
  const diagnoseClaudeSubscription = useDiagnoseClaudeSubscription();
  const fetchModels = useFetchModels();
  const saveConnectionDefaults = useSaveConnectionDefaults();
  const { data: allConnections } = useConnections();
  const { data: allPresets } = usePresets();

  const [dirty, setDirty] = useState(false);
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  const imageStyleProfiles = useUIStore((s) => s.imageStyleProfiles);
  useEffect(() => {
    setEditorDirty(dirty);
  }, [dirty, setEditorDirty]);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Local editable state
  const [localName, setLocalName] = useState("");
  const [localProvider, setLocalProvider] = useState<APIProvider>("openai");
  const [localBaseUrl, setLocalBaseUrl] = useState("");
  const [localApiKey, setLocalApiKey] = useState("");
  const [clearStoredApiKeyOnSave, setClearStoredApiKeyOnSave] = useState(false);
  const [localModel, setLocalModel] = useState("");
  const [localMaxContext, setLocalMaxContext] = useState(128000);
  const [localMaxParallelJobs, setLocalMaxParallelJobs] = useState(DEFAULT_MAX_PARALLEL_JOBS);
  const [localEnableCaching, setLocalEnableCaching] = useState(false);
  const [localAnthropicExtendedCacheTtl, setLocalAnthropicExtendedCacheTtl] = useState(false);
  const [localCachingAtDepth, setLocalCachingAtDepth] = useState(DEFAULT_CACHING_AT_DEPTH);
  const [localDefaultForAgents, setLocalDefaultForAgents] = useState(false);
  const [localEmbeddingModel, setLocalEmbeddingModel] = useState("");
  const [localEmbeddingBaseUrl, setLocalEmbeddingBaseUrl] = useState("");
  const [localEmbeddingConnectionId, setLocalEmbeddingConnectionId] = useState("");
  const [localPromptPresetId, setLocalPromptPresetId] = useState("");
  const [localOpenrouterProvider, setLocalOpenrouterProvider] = useState("");
  const [localImageGenerationSource, setLocalImageGenerationSource] = useState("");
  const [localComfyuiWorkflow, setLocalComfyuiWorkflow] = useState("");
  const [localImageService, setLocalImageService] = useState<string | null>(null);
  const [localImageEndpointId, setLocalImageEndpointId] = useState("");
  const [localVideoGenerationSource, setLocalVideoGenerationSource] = useState("");
  const [localVideoService, setLocalVideoService] = useState<string | null>(null);
  const [localMaxTokensOverride, setLocalMaxTokensOverride] = useState<number | null>(null);
  const [localClaudeFastMode, setLocalClaudeFastMode] = useState(false);
  const [localTreatAsLocalEndpoint, setLocalTreatAsLocalEndpoint] = useState(false);
  const [localDefaultParametersEnabled, setLocalDefaultParametersEnabled] = useState(false);
  const [localDefaultParameters, setLocalDefaultParameters] =
    useState<EditableGenerationParameters>(CONNECTION_PARAMETER_DEFAULTS);
  const [localImageDefaults, setLocalImageDefaults] = useState<ImageGenerationDefaultsProfile | null>(null);
  const [localVideoDefaults, setLocalVideoDefaults] = useState<VideoGenerationDefaultsProfile | null>(null);
  const [imageDefaultsExpanded, setImageDefaultsExpanded] = useState(false);
  const [videoDefaultsExpanded, setVideoDefaultsExpanded] = useState(false);

  // Test results
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs: number } | null>(null);
  const [msgResult, setMsgResult] = useState<{
    success: boolean;
    response: string;
    latencyMs: number;
    error?: string;
  } | null>(null);
  const [imgTestResult, setImgTestResult] = useState<{
    success: boolean;
    base64: string | null;
    mimeType: string | null;
    latencyMs: number;
    prompt: string;
    error?: string;
  } | null>(null);
  const [vidTestResult, setVidTestResult] = useState<{
    success: boolean;
    base64: string | null;
    mimeType: string | null;
    latencyMs: number;
    prompt: string;
    error?: string;
  } | null>(null);
  const [claudeDiagResult, setClaudeDiagResult] = useState<ClaudeSubscriptionDiagnosis | null>(null);

  // Model search
  const [modelSearch, setModelSearch] = useState("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const modelSearchInputRef = useRef<HTMLInputElement>(null);
  const comfyWorkflowTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Remote models fetched from provider API
  const [remoteModels, setRemoteModels] = useState<RemoteConnectionModel[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const baseUrlValidation = useMemo(
    () =>
      isLocalAuthConnectionProvider(localProvider)
        ? { value: "", error: null }
        : normalizeEndpointUrlInput(localBaseUrl, "Base URL"),
    [localBaseUrl, localProvider],
  );
  const embeddingBaseUrlValidation = useMemo(
    () => normalizeEndpointUrlInput(localEmbeddingBaseUrl, "Embedding endpoint URL"),
    [localEmbeddingBaseUrl],
  );

  // Populate from server
  useEffect(() => {
    if (!conn) return;
    const c = conn as Record<string, unknown>;
    setLocalName((c.name as string) ?? "");
    const provider = (c.provider as APIProvider) ?? "openai";
    setLocalProvider(provider);
    setLocalBaseUrl((c.baseUrl as string) ?? "");
    setLocalApiKey(""); // never pre-fill (it's masked)
    setClearStoredApiKeyOnSave(false);
    setLocalModel(normalizeGrokCliEditorModel(provider, (c.model as string) ?? ""));
    setLocalMaxContext(normalizeConnectionMaxContext(provider, c.maxContext));
    setLocalMaxParallelJobs(normalizeMaxParallelJobs(c.maxParallelJobs));
    setLocalEnableCaching(c.enableCaching === "true" || c.enableCaching === true);
    setLocalAnthropicExtendedCacheTtl(c.anthropicExtendedCacheTtl === "true" || c.anthropicExtendedCacheTtl === true);
    setLocalCachingAtDepth(normalizeCachingAtDepth(c.cachingAtDepth));
    setLocalDefaultForAgents(c.defaultForAgents === "true" || c.defaultForAgents === true);
    setLocalEmbeddingModel((c.embeddingModel as string) ?? "");
    setLocalEmbeddingBaseUrl((c.embeddingBaseUrl as string) ?? "");
    setLocalEmbeddingConnectionId((c.embeddingConnectionId as string) ?? "");
    setLocalPromptPresetId((c.promptPresetId as string) ?? "");
    setLocalOpenrouterProvider((c.openrouterProvider as string) ?? "");
    const imageGenerationSource =
      (c.provider as APIProvider) === "image_generation"
        ? ((c.imageGenerationSource as string) ??
          (c.imageService as string) ??
          inferImageSource((c.model as string) ?? "", (c.baseUrl as string) ?? ""))
        : "";
    const imageService = ((c.imageService as string | null) ?? (c.imageGenerationSource as string | null)) || null;
    const defaultsService = imageSourceToDefaultsService(imageService || imageGenerationSource);
    const storedImageDefaults = defaultsService
      ? getStoredImageGenerationDefaults(c.defaultParameters, defaultsService)
      : null;
    const explicitVideoService = ((c.videoService as string | null) ?? null) || null;
    const videoGenerationSource =
      (c.provider as APIProvider) === "video_generation"
        ? ((c.videoGenerationSource as string) ??
          explicitVideoService ??
          inferVideoSource((c.model as string) ?? "", (c.baseUrl as string) ?? ""))
        : "";
    const storedVideoDefaults =
      (c.provider as APIProvider) === "video_generation" ? getStoredVideoGenerationDefaults(c.defaultParameters) : null;
    const videoDefaultsService = videoSelectionToDefaultsService(
      explicitVideoService || storedVideoDefaults?.service || videoGenerationSource,
      (c.model as string) ?? "",
      (c.baseUrl as string) ?? "",
    );
    const videoProviderSource = videoSourceToProviderOption(
      videoGenerationSource || explicitVideoService || videoDefaultsService,
    );
    setLocalImageGenerationSource(imageGenerationSource);
    setLocalComfyuiWorkflow((c.comfyuiWorkflow as string) ?? "");
    setLocalImageService(imageService);
    setLocalImageEndpointId((c.imageEndpointId as string) ?? "");
    setLocalVideoGenerationSource(videoProviderSource);
    setLocalVideoService(videoDefaultsService);
    setLocalMaxTokensOverride(typeof c.maxTokensOverride === "number" ? (c.maxTokensOverride as number) : null);
    setLocalClaudeFastMode(c.claudeFastMode === "true" || c.claudeFastMode === true);
    setLocalTreatAsLocalEndpoint(c.treatAsLocalEndpoint === "true" || c.treatAsLocalEndpoint === true);
    setLocalDefaultParametersEnabled(!!parseEditableGenerationParameters(c.defaultParameters));
    setLocalDefaultParameters(getEditableGenerationParameters(CONNECTION_PARAMETER_DEFAULTS, c.defaultParameters));
    setLocalImageDefaults(
      defaultsService ? (storedImageDefaults ?? createDefaultImageGenerationProfile(defaultsService)) : null,
    );
    setLocalVideoDefaults(
      (c.provider as APIProvider) === "video_generation"
        ? storedVideoDefaults
          ? sanitizeVideoGenerationProfile({ ...storedVideoDefaults, service: videoDefaultsService })
          : createDefaultVideoGenerationProfile(videoDefaultsService)
        : null,
    );
    setImageDefaultsExpanded(!!storedImageDefaults);
    setVideoDefaultsExpanded(!!storedVideoDefaults);
    setDirty(false);
    setSaveError(null);
    setTestResult(null);
    setMsgResult(null);
    setImgTestResult(null);
    setVidTestResult(null);
    setClaudeDiagResult(null);
  }, [conn]);

  const comfyWorkflowValidation = useMemo(() => {
    const wf = localComfyuiWorkflow;
    if (!wf.trim()) return null;
    try {
      JSON.parse(wf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Extract character offset. "at position 123", "at line 5 column 12"
      let charPos: number | null = null;
      const byPos = msg.match(/at position (\d+)/);
      if (byPos) {
        charPos = parseInt(byPos[1]!, 10);
      } else {
        const byLineCol = msg.match(/at line (\d+) column[^\d]*(\d+)/i);
        if (byLineCol) {
          const targetLine = parseInt(byLineCol[1]!, 10) - 1;
          const targetCol = parseInt(byLineCol[2]!, 10) - 1;
          const lines = wf.split("\n");
          let offset = 0;
          for (let i = 0; i < Math.min(targetLine, lines.length); i++) offset += lines[i]!.length + 1;
          charPos = offset + targetCol;
        }
      }
      const lineNum = charPos !== null ? wf.slice(0, charPos).split("\n").length : null;
      const labelMsg = lineNum !== null ? `Invalid JSON on line ${lineNum}` : "Invalid JSON";
      const label = labelMsg + ": " + msg.split("\n")[0];
      return { parseError: true as const, label, charPos };
    }
    const KNOWN_SUBS = [
      { token: "%prompt%", label: "%prompt%", critical: true },
      { token: "%negative_prompt%", label: "%negative_prompt%", critical: false },
      { token: "%width%", label: "%width%", critical: false },
      { token: "%height%", label: "%height%", critical: false },
      { token: "%seed%", label: "%seed%", critical: false },
      { token: "%model%", label: "%model%", critical: false },
      { token: "%reference_image%", label: "%reference_image%", critical: false },
      { token: "%reference_image_name%", label: "%reference_image_name%", critical: false },
    ];
    const hasReferenceImage = /%reference_image(?:_0[1-4])?%/.test(wf);
    const hasReferenceImageName = /%reference_image_name(?:_0[1-4])?%/.test(wf);
    const missing = KNOWN_SUBS.filter(({ token }) => {
      if (token === "%reference_image%" && hasReferenceImageName) return false;
      if (token === "%reference_image_name%" && hasReferenceImage) return false;
      return !wf.includes(token);
    });
    return { parseError: false as const, missing };
  }, [localComfyuiWorkflow]);

  const effectiveImageGenerationSource = useMemo(() => {
    if (localProvider !== "image_generation") return "";
    return localImageGenerationSource || localImageService || inferImageSource(localModel, localBaseUrl);
  }, [localProvider, localImageGenerationSource, localImageService, localModel, localBaseUrl]);

  const effectiveVideoGenerationSource = useMemo(() => {
    if (localProvider !== "video_generation") return "";
    return videoSourceToProviderOption(
      localVideoGenerationSource || localVideoService || inferVideoSource(localModel, localBaseUrl),
    );
  }, [localProvider, localVideoGenerationSource, localVideoService, localModel, localBaseUrl]);

  const selectedImageService =
    localProvider === "image_generation"
      ? localImageGenerationSource || localImageService || effectiveImageGenerationSource
      : "";
  const selectedImageDefaultsService = imageSourceToDefaultsService(selectedImageService);
  const selectedVideoService =
    localProvider === "video_generation"
      ? localVideoGenerationSource || localVideoService || effectiveVideoGenerationSource
      : "";
  const selectedVideoProvider = videoSourceToProviderOption(selectedVideoService);
  const selectedVideoDefaultsService = videoSelectionToDefaultsService(selectedVideoService, localModel, localBaseUrl);
  const apiKeyLink =
    localProvider === "video_generation" && selectedVideoDefaultsService === "xai"
      ? API_KEY_LINKS.xai
      : localProvider === "video_generation" && selectedVideoDefaultsService === "openrouter"
        ? API_KEY_LINKS.openrouter
        : localProvider === "video_generation" && selectedVideoDefaultsService === "seedance"
          ? { label: "Open Seedance API docs", url: "https://seedance2.ai/api-docs" }
          : API_KEY_LINKS[localProvider];

  useEffect(() => {
    if (localProvider !== "image_generation" || !selectedImageDefaultsService) {
      setLocalImageDefaults(null);
      return;
    }
    setLocalImageDefaults((current) =>
      current?.service === selectedImageDefaultsService
        ? sanitizeImageGenerationProfile(current, selectedImageDefaultsService)
        : createDefaultImageGenerationProfile(selectedImageDefaultsService),
    );
  }, [localProvider, selectedImageDefaultsService]);

  useEffect(() => {
    if (localProvider !== "video_generation") {
      setLocalVideoDefaults(null);
      return;
    }
    setLocalVideoDefaults((current) =>
      current
        ? sanitizeVideoGenerationProfile({ ...current, service: selectedVideoDefaultsService })
        : createDefaultVideoGenerationProfile(selectedVideoDefaultsService),
    );
  }, [localProvider, selectedVideoDefaultsService]);

  // Model list for current provider
  const providerModels = useMemo(() => {
    return MODEL_LISTS[localProvider] ?? [];
  }, [localProvider]);

  // Merge known models with remote models (remote first, deduped)
  const allModels = useMemo(() => {
    const remote = remoteModels.map((m) => ({
      id: m.id,
      name: m.name,
      context: m.context ?? 0,
      maxOutput: m.maxOutput ?? 0,
      isRemote: true as const,
    }));
    const remoteIds = new Set(remote.map((m) => m.id));
    const known = providerModels.filter((m) => !remoteIds.has(m.id)).map((m) => ({ ...m, isRemote: false as const }));
    return [...remote, ...known];
  }, [providerModels, remoteModels]);

  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return allModels;
    const q = modelSearch.toLowerCase();
    return allModels.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  }, [allModels, modelSearch]);

  const selectedModelInfo = useMemo(() => {
    return allModels.find((m) => m.id === localModel) ?? null;
  }, [allModels, localModel]);

  // Clear remote models when provider changes
  useEffect(() => {
    setRemoteModels([]);
    setFetchError(null);
  }, [localProvider]);

  useEffect(() => {
    if (!showModelDropdown) return;

    const closeDropdown = () => {
      setShowModelDropdown(false);
      setModelSearch("");
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && modelDropdownRef.current?.contains(target)) return;
      closeDropdown();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDropdown();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showModelDropdown]);

  const handleClose = useCallback(() => {
    if (dirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closeConnectionDetail();
  }, [dirty, closeConnectionDetail]);

  const handleSave = useCallback(async () => {
    if (!connectionDetailId) return;
    setSaveError(null);
    if (baseUrlValidation.error) {
      setSaveError(baseUrlValidation.error);
      throw new Error(baseUrlValidation.error);
    }
    const supportsDirectEmbeddings = providerSupportsDirectEmbeddingConfig(localProvider);
    if (supportsDirectEmbeddings && embeddingBaseUrlValidation.error) {
      setSaveError(embeddingBaseUrlValidation.error);
      throw new Error(embeddingBaseUrlValidation.error);
    }
    const isImageProvider = localProvider === "image_generation";
    const isVideoProvider = localProvider === "video_generation";
    const isMediaProvider = isImageProvider || isVideoProvider;
    const isLocalAuthProvider = isLocalAuthConnectionProvider(localProvider);
    const canTreatAsLocalEndpoint = canProviderTreatAsLocalEndpoint(localProvider);
    const existingEmbeddingModel = (conn as { embeddingModel?: string | null } | undefined)?.embeddingModel ?? "";
    const existingEmbeddingBaseUrl = (conn as { embeddingBaseUrl?: string | null } | undefined)?.embeddingBaseUrl ?? "";
    const normalizedModel = normalizeGrokCliEditorModel(localProvider, localModel);
    const payload: Record<string, unknown> = {
      id: connectionDetailId,
      name: localName,
      provider: localProvider,
      baseUrl: isLocalAuthProvider ? "" : baseUrlValidation.value,
      model: normalizedModel,
      maxContext: localMaxContext,
      maxParallelJobs: localMaxParallelJobs,
      enableCaching: localEnableCaching,
      anthropicExtendedCacheTtl:
        localProvider === "anthropic" && localEnableCaching ? localAnthropicExtendedCacheTtl : false,
      cachingAtDepth: localCachingAtDepth,
      defaultForAgents: localDefaultForAgents,
      embeddingModel: supportsDirectEmbeddings ? localEmbeddingModel : existingEmbeddingModel,
      embeddingBaseUrl: supportsDirectEmbeddings ? embeddingBaseUrlValidation.value : existingEmbeddingBaseUrl,
      embeddingConnectionId: localEmbeddingConnectionId || null,
      promptPresetId: !isMediaProvider ? localPromptPresetId || null : null,
      openrouterProvider: localOpenrouterProvider || null,
      imageGenerationSource: isImageProvider ? localImageGenerationSource || localImageService || null : null,
      comfyuiWorkflow: isImageProvider ? localComfyuiWorkflow || null : null,
      imageService: isImageProvider ? localImageGenerationSource || localImageService || null : null,
      imageEndpointId:
        isImageProvider && selectedImageService === "runpod_comfyui" ? localImageEndpointId || null : null,
      videoGenerationSource: isVideoProvider ? selectedVideoProvider || null : null,
      videoService: isVideoProvider ? selectedVideoDefaultsService : null,
      maxTokensOverride: localMaxTokensOverride ?? null,
      claudeFastMode: localClaudeFastMode,
      treatAsLocalEndpoint: canTreatAsLocalEndpoint ? localTreatAsLocalEndpoint : false,
    };
    // Only send API key if user typed a new one
    if (isLocalAuthProvider) {
      payload.apiKey = "";
    } else if (localApiKey.trim()) {
      payload.apiKey = localApiKey;
    } else if (clearStoredApiKeyOnSave) {
      payload.apiKey = "";
    }
    try {
      await updateConnection.mutateAsync(payload as { id: string } & Record<string, unknown>);
      if (!isMediaProvider) {
        await saveConnectionDefaults.mutateAsync({
          id: connectionDetailId,
          params: localDefaultParametersEnabled ? (localDefaultParameters as unknown as Record<string, unknown>) : null,
        });
      } else if (isImageProvider) {
        const nextImageDefaults =
          selectedImageDefaultsService && localImageDefaults
            ? sanitizeImageGenerationProfile(localImageDefaults, selectedImageDefaultsService)
            : null;
        await saveConnectionDefaults.mutateAsync({
          id: connectionDetailId,
          params: buildImageDefaultParameters(
            (conn as Record<string, unknown> | null)?.defaultParameters,
            nextImageDefaults,
          ),
        });
      } else {
        const nextVideoDefaults = localVideoDefaults
          ? sanitizeVideoGenerationProfile({ ...localVideoDefaults, service: selectedVideoDefaultsService })
          : null;
        await saveConnectionDefaults.mutateAsync({
          id: connectionDetailId,
          params: buildVideoDefaultParameters(
            (conn as Record<string, unknown> | null)?.defaultParameters,
            nextVideoDefaults,
          ),
        });
      }
      if (isLocalAuthProvider && localBaseUrl) {
        setLocalBaseUrl("");
      } else if (baseUrlValidation.value !== localBaseUrl.trim()) {
        setLocalBaseUrl(baseUrlValidation.value);
      }
      if (normalizedModel !== localModel) {
        setLocalModel(normalizedModel);
      }
      if (supportsDirectEmbeddings && embeddingBaseUrlValidation.value !== localEmbeddingBaseUrl.trim()) {
        setLocalEmbeddingBaseUrl(embeddingBaseUrlValidation.value);
      }
      setDirty(false);
      setClearStoredApiKeyOnSave(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save connection";
      setSaveError(message);
      throw err instanceof Error ? err : new Error(message);
    }
  }, [
    connectionDetailId,
    localName,
    localProvider,
    localBaseUrl,
    baseUrlValidation,
    localApiKey,
    clearStoredApiKeyOnSave,
    localModel,
    localMaxContext,
    localMaxParallelJobs,
    localEnableCaching,
    localAnthropicExtendedCacheTtl,
    localCachingAtDepth,
    localDefaultForAgents,
    localEmbeddingModel,
    localEmbeddingBaseUrl,
    embeddingBaseUrlValidation,
    localEmbeddingConnectionId,
    localPromptPresetId,
    localOpenrouterProvider,
    localImageGenerationSource,
    localComfyuiWorkflow,
    localImageService,
    localImageEndpointId,
    localMaxTokensOverride,
    localClaudeFastMode,
    localTreatAsLocalEndpoint,
    localDefaultParametersEnabled,
    localDefaultParameters,
    selectedImageService,
    selectedImageDefaultsService,
    selectedVideoProvider,
    selectedVideoDefaultsService,
    localImageDefaults,
    localVideoDefaults,
    updateConnection,
    saveConnectionDefaults,
    conn,
  ]);

  const handleDelete = useCallback(async () => {
    if (!connectionDetailId) return;
    if (
      !(await showConfirmDialog({
        title: "Delete Connection",
        message: "Delete this connection?",
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }
    deleteConnection.mutate(connectionDetailId, { onSuccess: () => closeConnectionDetail() });
  }, [connectionDetailId, deleteConnection, closeConnectionDetail]);

  const handleExportConnection = useCallback(async () => {
    if (!conn) return;
    const confirmed = await showConfirmDialog({
      title: "Export Connection Data",
      message: CONNECTION_EXPORT_WARNING,
      confirmLabel: "Export",
      cancelLabel: "Close",
    });
    if (!confirmed) return;

    const currentConnection = conn as Record<string, unknown>;
    const isImageProvider = localProvider === "image_generation";
    const isVideoProvider = localProvider === "video_generation";
    const isMediaProvider = isImageProvider || isVideoProvider;
    const isLocalAuthProvider = isLocalAuthConnectionProvider(localProvider);
    const defaultParameters = isImageProvider
      ? buildImageDefaultParameters(
          currentConnection.defaultParameters,
          selectedImageDefaultsService && localImageDefaults
            ? sanitizeImageGenerationProfile(localImageDefaults, selectedImageDefaultsService)
            : null,
        )
      : isVideoProvider
        ? buildVideoDefaultParameters(
            currentConnection.defaultParameters,
            localVideoDefaults
              ? sanitizeVideoGenerationProfile({ ...localVideoDefaults, service: selectedVideoDefaultsService })
              : null,
          )
        : localDefaultParametersEnabled
          ? (localDefaultParameters as unknown as Record<string, unknown>)
          : null;
    const imageService = isImageProvider ? localImageGenerationSource || localImageService || null : null;
    const videoProvider = isVideoProvider ? selectedVideoProvider || null : null;
    const videoService = isVideoProvider ? selectedVideoDefaultsService : null;
    const canTreatAsLocalEndpoint = canProviderTreatAsLocalEndpoint(localProvider);
    const supportsDirectEmbeddings = providerSupportsDirectEmbeddingConfig(localProvider);
    const existingEmbeddingModel = (conn as { embeddingModel?: string | null } | undefined)?.embeddingModel ?? "";
    const existingEmbeddingBaseUrl = (conn as { embeddingBaseUrl?: string | null } | undefined)?.embeddingBaseUrl ?? "";
    const exportRow: ConnectionTransferRow = {
      ...currentConnection,
      name: localName,
      provider: localProvider,
      baseUrl: isLocalAuthProvider ? "" : localBaseUrl,
      model: normalizeGrokCliEditorModel(localProvider, localModel),
      maxContext: localMaxContext,
      maxTokensOverride: localMaxTokensOverride ?? null,
      maxParallelJobs: localMaxParallelJobs,
      treatAsLocalEndpoint: canTreatAsLocalEndpoint ? localTreatAsLocalEndpoint : false,
      promptPresetId: !isMediaProvider ? localPromptPresetId || null : null,
      defaultParameters,
      enableCaching: localEnableCaching,
      cachingAtDepth: localCachingAtDepth,
      defaultForAgents: localDefaultForAgents,
      embeddingModel: supportsDirectEmbeddings ? localEmbeddingModel : existingEmbeddingModel,
      embeddingBaseUrl: supportsDirectEmbeddings ? embeddingBaseUrlValidation.value : existingEmbeddingBaseUrl,
      embeddingConnectionId: localEmbeddingConnectionId || null,
      openrouterProvider: localOpenrouterProvider || null,
      imageGenerationSource: imageService,
      imageService,
      videoGenerationSource: videoProvider,
      videoService,
      imageEndpointId:
        isImageProvider && selectedImageService === "runpod_comfyui" ? localImageEndpointId || null : null,
      comfyuiWorkflow: isImageProvider ? localComfyuiWorkflow || null : null,
      claudeFastMode: localClaudeFastMode,
    };

    downloadJsonFile(
      createConnectionExportEnvelope([exportRow]),
      `${sanitizeExportFilenamePart(localName || String(currentConnection.name ?? ""), "connection")}.connection.json`,
    );
    toast.success(`Exported ${localName || "connection"}`);
  }, [
    conn,
    localProvider,
    localName,
    localBaseUrl,
    localModel,
    localMaxContext,
    localMaxTokensOverride,
    localMaxParallelJobs,
    localTreatAsLocalEndpoint,
    localPromptPresetId,
    localDefaultParametersEnabled,
    localDefaultParameters,
    localEnableCaching,
    localCachingAtDepth,
    localDefaultForAgents,
    localEmbeddingModel,
    embeddingBaseUrlValidation.value,
    localEmbeddingConnectionId,
    localOpenrouterProvider,
    localImageGenerationSource,
    localImageService,
    selectedVideoProvider,
    selectedImageService,
    localImageEndpointId,
    localComfyuiWorkflow,
    localClaudeFastMode,
    selectedImageDefaultsService,
    selectedVideoDefaultsService,
    localImageDefaults,
    localVideoDefaults,
  ]);

  const handleTestConnection = useCallback(async () => {
    if (!connectionDetailId) return;
    // Save first if dirty, and wait for it to complete
    if (dirty) {
      try {
        await handleSave();
      } catch {
        return;
      }
    }
    setTestResult(null);
    testConnection.mutate(connectionDetailId, {
      onSuccess: (data) => setTestResult(data as { success: boolean; message: string; latencyMs: number }),
      onError: (err) =>
        setTestResult({ success: false, message: err instanceof Error ? err.message : "Failed", latencyMs: 0 }),
    });
  }, [connectionDetailId, dirty, handleSave, testConnection]);

  const handleTestMessage = useCallback(async () => {
    if (!connectionDetailId) return;
    if (dirty) {
      try {
        await handleSave();
      } catch {
        return;
      }
    }
    setMsgResult(null);
    testMessage.mutate(connectionDetailId, {
      onSuccess: (data) =>
        setMsgResult(data as { success: boolean; response: string; latencyMs: number; error?: string }),
      onError: (err) =>
        setMsgResult({
          success: false,
          response: "",
          latencyMs: 0,
          error: err instanceof Error ? err.message : "Failed",
        }),
    });
  }, [connectionDetailId, dirty, handleSave, testMessage]);

  const handleDiagnoseClaudeSubscription = useCallback(async () => {
    if (!connectionDetailId) return;
    if (dirty) {
      try {
        await handleSave();
      } catch {
        return;
      }
    }
    setClaudeDiagResult(null);
    diagnoseClaudeSubscription.mutate(connectionDetailId, {
      onSuccess: (data) => setClaudeDiagResult(data),
      onError: (err) =>
        setClaudeDiagResult({
          success: false,
          requestedModel: localModel,
          modelsBilled: [],
          modelUsageDetail: [],
          billedDifferent: false,
          fastModeState: null,
          response: "",
          errors: [err instanceof Error ? err.message : "Failed"],
          latencyMs: 0,
        }),
    });
  }, [connectionDetailId, dirty, handleSave, diagnoseClaudeSubscription, localModel]);

  const handleTestImage = useCallback(async () => {
    if (!connectionDetailId) return;
    if (dirty) {
      try {
        await handleSave();
      } catch {
        return;
      }
    }
    setImgTestResult(null);
    testImageGeneration.mutate(connectionDetailId, {
      onSuccess: (data) =>
        setImgTestResult(
          data as {
            success: boolean;
            base64: string | null;
            mimeType: string | null;
            latencyMs: number;
            prompt: string;
            error?: string;
          },
        ),
      onError: (err) =>
        setImgTestResult({
          success: false,
          base64: null,
          mimeType: null,
          latencyMs: 0,
          prompt: "",
          error: err instanceof Error ? err.message : "Failed",
        }),
    });
  }, [connectionDetailId, dirty, handleSave, testImageGeneration]);

  const handleTestVideo = useCallback(async () => {
    if (!connectionDetailId) return;
    if (dirty) {
      try {
        await handleSave();
      } catch {
        return;
      }
    }
    setVidTestResult(null);
    testVideoGeneration.mutate(connectionDetailId, {
      onSuccess: (data) =>
        setVidTestResult(
          data as {
            success: boolean;
            base64: string | null;
            mimeType: string | null;
            latencyMs: number;
            prompt: string;
            error?: string;
          },
        ),
      onError: (err) =>
        setVidTestResult({
          success: false,
          base64: null,
          mimeType: null,
          latencyMs: 0,
          prompt: "",
          error: err instanceof Error ? err.message : "Failed",
        }),
    });
  }, [connectionDetailId, dirty, handleSave, testVideoGeneration]);

  const handleFetchModels = useCallback(async () => {
    if (!connectionDetailId) return;
    setFetchError(null);
    // Save first if dirty so the server has the right baseUrl/apiKey/provider
    if (dirty) {
      try {
        await handleSave();
      } catch {
        return;
      }
    }
    fetchModels.mutate(connectionDetailId, {
      onSuccess: (data) => {
        const result = data as { models: RemoteConnectionModel[] };
        setRemoteModels(result.models);
        setShowModelDropdown(true);
        requestAnimationFrame(() => {
          modelSearchInputRef.current?.focus();
          modelSearchInputRef.current?.select();
        });
      },
      onError: (err) => {
        setFetchError(err instanceof Error ? err.message : "Failed to fetch models");
      },
    });
  }, [connectionDetailId, dirty, handleSave, fetchModels]);

  const selectModel = useCallback(
    (model: { id: string; context?: number; maxOutput?: number; isRemote?: boolean }) => {
      setLocalModel(model.id);
      if (localProvider === "video_generation") {
        const provider = videoSourceToProviderOption(
          localVideoGenerationSource || localVideoService || inferVideoSource(model.id, localBaseUrl),
        );
        setLocalVideoGenerationSource(provider);
        setLocalVideoService(videoProviderServiceForModel(provider, model.id, localBaseUrl));
      }
      if (model.context) setLocalMaxContext(Number(model.context));
      if (model.isRemote && model.maxOutput) setLocalMaxTokensOverride(Number(model.maxOutput));
      setShowModelDropdown(false);
      setModelSearch("");
      setDirty(true);
    },
    [localBaseUrl, localProvider, localVideoGenerationSource, localVideoService],
  );

  const markDirty = useCallback(() => setDirty(true), []);

  const handleManualModelChange = useCallback(
    (model: string) => {
      setLocalModel(model);
      if (localProvider === "video_generation") {
        const provider = videoSourceToProviderOption(
          localVideoGenerationSource || localVideoService || inferVideoSource(model, localBaseUrl),
        );
        setLocalVideoGenerationSource(provider);
        setLocalVideoService(videoProviderServiceForModel(provider, model, localBaseUrl));
      }
      markDirty();
    },
    [localBaseUrl, localProvider, localVideoGenerationSource, localVideoService, markDirty],
  );

  const handleJumpToJsonError = useCallback(() => {
    const ta = comfyWorkflowTextareaRef.current;
    if (!ta || !comfyWorkflowValidation || !comfyWorkflowValidation.parseError) return;
    const pos = comfyWorkflowValidation.charPos ?? 0;
    ta.focus();
    ta.setSelectionRange(pos, pos);
  }, [comfyWorkflowValidation]);

  const providerDef = PROVIDERS[localProvider];
  const isImageGenerationProvider = localProvider === "image_generation";
  const isVideoGenerationProvider = localProvider === "video_generation";
  const isMediaGenerationProvider = isImageGenerationProvider || isVideoGenerationProvider;
  const isClaudeSubscriptionProvider = localProvider === "claude_subscription";
  const isOpenAIChatGPTProvider = localProvider === "openai_chatgpt";
  const isGrokSubscriptionProvider = localProvider === "grok_subscription";
  const isLocalAuthProvider = isLocalAuthConnectionProvider(localProvider);
  const supportsDirectEmbeddingConfig = providerSupportsDirectEmbeddingConfig(localProvider);
  const canTreatAsLocalEndpoint = canProviderTreatAsLocalEndpoint(localProvider);
  const modelFetchSourceLabel = isGrokSubscriptionProvider ? "Grok CLI" : "API";
  const modelFetchButtonLabel = isGrokSubscriptionProvider ? "Fetch Models from Grok CLI" : "Fetch Models from API";
  const emptyModelLabel = isGrokSubscriptionProvider ? "Use Grok CLI default model" : "Select a model…";
  const canSendTestMessage = isGrokSubscriptionProvider || Boolean(localModel.trim());

  if (!connectionDetailId) return null;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="shimmer h-8 w-48 rounded-xl" />
          <div className="shimmer h-4 w-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!conn) {
    return (
      <div className="mari-editor-shell flex flex-1 items-center justify-center">
        <p className="mari-editor-empty px-4 py-3 text-sm">Connection not found</p>
      </div>
    );
  }

  return (
    <div className="mari-editor-shell mari-editor-legacy-bridge flex flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="mari-editor-header">
        <button onClick={handleClose} className="mari-editor-action inline-flex shrink-0">
          <ArrowLeft size="1.125rem" />
        </button>
        <div className="mari-editor-icon-tile">
          <Link size="1.125rem" />
        </div>
        <input
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            markDirty();
          }}
          className="mari-editor-title-input min-w-0 flex-1 placeholder:text-[var(--marinara-editor-muted)]"
          placeholder="Connection name…"
        />
        <div className="mari-editor-actions flex shrink-0">
          {saveError && (
            <span className="mari-editor-status mr-2 text-red-400">
              <AlertCircle size="0.6875rem" /> <span className="max-md:hidden">Save failed</span>
            </span>
          )}
          {savedFlash && !dirty && (
            <span className="mari-editor-status mr-2 text-emerald-400">
              <Check size="0.6875rem" /> <span className="max-md:hidden">Saved</span>
            </span>
          )}
          {dirty && !saveError && <span className="mari-editor-status mr-2 text-amber-400 max-md:hidden">Unsaved</span>}
          <button
            onClick={handleSave}
            disabled={updateConnection.isPending || saveConnectionDefaults.isPending}
            className="mari-editor-action mari-editor-action--primary inline-flex disabled:opacity-50"
          >
            <Save size="0.8125rem" /> <span className="max-md:hidden">Save</span>
          </button>
          <button
            onClick={handleExportConnection}
            className="mari-editor-action inline-flex"
            title="Export connection"
            aria-label="Export connection"
          >
            <Upload size="0.9375rem" />
          </button>
          <button
            onClick={handleDelete}
            className="mari-editor-action inline-flex"
            title="Delete connection"
            aria-label="Delete connection"
          >
            <Trash2 size="0.9375rem" />
          </button>
        </div>
      </div>

      {/* Unsaved warning */}
      {showUnsavedWarning && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
          <span>You have unsaved changes.</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUnsavedWarning(false)}
              className="rounded-lg px-3 py-1 hover:bg-[var(--accent)]"
            >
              Keep editing
            </button>
            <button
              onClick={() => closeConnectionDetail()}
              className="rounded-lg px-3 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/15"
            >
              Discard
            </button>
            <button
              onClick={async () => {
                try {
                  await handleSave();
                  closeConnectionDetail();
                } catch {
                  // Keep the editor open so the user can fix the failed save.
                }
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
          <AlertCircle size="0.8125rem" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="rounded-lg px-2 py-0.5 hover:bg-red-500/20">
            <X size="0.75rem" />
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div className="mari-editor-content max-md:p-4">
        <div className="mari-editor-content-inner space-y-6">
          {/* ── Connection Name ── */}
          <FieldGroup
            label="Connection Name"
            icon={<Tag size="0.875rem" className="text-sky-400" />}
            help="A friendly name to identify this connection. Use something descriptive like 'Claude Sonnet — RP' or 'GPT-4o Main'."
          >
            <input
              value={localName}
              onChange={(e) => {
                setLocalName(e.target.value);
                markDirty();
              }}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="e.g. Claude Sonnet — RP"
            />
          </FieldGroup>

          {/* ── Provider ── */}
          <FieldGroup
            label="Provider"
            icon={<Globe size="0.875rem" className="text-sky-400" />}
            help="The AI service you want to connect to. Each provider has its own models, pricing, and features. OpenAI and Anthropic are the most popular."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {(Object.entries(PROVIDERS) as [APIProvider, typeof providerDef][]).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === localProvider) return;
                    const defaultModel = MODEL_LISTS[key]?.[0];
                    setLocalProvider(key);
                    // Auto-fill base URL
                    setLocalBaseUrl(info.defaultBaseUrl);
                    // Leave Grok CLI blank so the local CLI can use its
                    // account/default model until the user fetches
                    // `grok models`. Other providers keep their usual seeded
                    // default model when we know one.
                    setLocalModel(
                      key === "grok_subscription" ? "" : (defaultModel?.id ?? (key === "xai" ? "grok-4.5" : "")),
                    );
                    setLocalMaxContext(
                      key === "grok_subscription"
                        ? GROK_CLI_DEFAULT_CONTEXT_TOKENS
                        : Number(defaultModel?.context) || 128000,
                    );
                    setLocalMaxTokensOverride(null);
                    setLocalDefaultParametersEnabled(false);
                    setLocalDefaultParameters(CONNECTION_PARAMETER_DEFAULTS);
                    // Provider switches must not keep an encrypted key from
                    // the previous provider under the new provider identity.
                    setLocalApiKey("");
                    setClearStoredApiKeyOnSave(true);
                    markDirty();
                  }}
                  className={cn(
                    "truncate rounded-xl px-3 py-2.5 text-xs font-medium transition-all",
                    localProvider === key
                      ? "bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/30"
                      : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                  )}
                >
                  {info.name}
                </button>
              ))}
            </div>
          </FieldGroup>

          {/* ── Claude (Subscription) — prerequisites notice ── */}
          {isClaudeSubscriptionProvider && (
            <div className="rounded-xl bg-sky-400/5 px-3 py-2.5 ring-1 ring-sky-400/30">
              <p className="flex items-start gap-1.5 text-[0.6875rem] text-sky-300">
                <AlertCircle size="0.75rem" className="mt-px shrink-0" />
                <span>
                  Routes chat through your local <strong>Claude Code</strong> install so it bills against your Anthropic{" "}
                  <strong>Pro / Max</strong> subscription instead of an API key. Prerequisites on the Marinara host:
                </span>
              </p>
              <ol className="mt-1.5 ml-4 list-decimal space-y-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                <li>
                  Install Claude Code:{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">npm i -g @anthropic-ai/claude-code</code>
                </li>
                <li>
                  Sign in once: <code className="rounded bg-[var(--secondary)] px-1">claude login</code>
                </li>
                <li>API Key and Base URL are not required for this provider.</li>
              </ol>
              <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
                Subscription auth is the same mechanism Visual Studio Code and other Anthropic-endorsed IDE integrations
                use. Embeddings are not available on this provider; configure a separate connection for embedding work.
              </p>
            </div>
          )}

          {/* ── OpenAI (ChatGPT) — prerequisites notice ── */}
          {isOpenAIChatGPTProvider && (
            <div className="rounded-xl bg-sky-400/5 px-3 py-2.5 ring-1 ring-sky-400/30">
              <p className="flex items-start gap-1.5 text-[0.6875rem] text-sky-300">
                <AlertCircle size="0.75rem" className="mt-px shrink-0" />
                <span>
                  Routes chat through your local <strong>Codex ChatGPT</strong> login so it uses your ChatGPT account
                  instead of an OpenAI API key. Prerequisites on the Marinara host:
                </span>
              </p>
              <ol className="mt-1.5 ml-4 list-decimal space-y-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                <li>
                  Install Codex CLI: <code className="rounded bg-[var(--secondary)] px-1">npm i -g @openai/codex</code>
                </li>
                <li>
                  Sign in once: <code className="rounded bg-[var(--secondary)] px-1">codex login</code>
                </li>
                <li>API Key and Base URL are not required for this provider.</li>
              </ol>
              <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
                Marinara reads the local Codex auth file and refreshes the ChatGPT session when possible. Embeddings are
                not available on this provider; configure a separate connection for embedding work.
              </p>
            </div>
          )}

          {/* ── Grok CLI (Subscription) — prerequisites notice ── */}
          {isGrokSubscriptionProvider && (
            <div className="rounded-xl bg-sky-400/5 px-3 py-2.5 ring-1 ring-sky-400/30">
              <p className="flex items-start gap-1.5 text-[0.6875rem] text-sky-300">
                <AlertCircle size="0.75rem" className="mt-px shrink-0" />
                <span>
                  Routes chat through your local <strong>Grok CLI</strong> install so it uses your signed-in{" "}
                  <strong>SuperGrok / X Premium+</strong> account instead of an xAI API key. Prerequisites on the
                  Marinara host:
                </span>
              </p>
              <ol className="mt-1.5 ml-4 list-decimal space-y-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                <li>
                  Install Grok CLI:{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">
                    curl -fsSL https://x.ai/cli/install.sh | bash
                  </code>
                </li>
                <li>
                  Sign in once: <code className="rounded bg-[var(--secondary)] px-1">grok login</code>
                </li>
                <li>API Key and Base URL are not required for this provider.</li>
              </ol>
              <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
                Marinara runs <code className="rounded bg-[var(--secondary)] px-1">grok</code> headlessly with Grok-side
                tools, memory, web search, plans, and subagents disabled. Embeddings are not available on this provider;
                configure a separate connection for embedding work. The safest roleplay model is usually{" "}
                <code className="rounded bg-[var(--secondary)] px-1">grok-composer-2.5-fast</code>; leave the model
                blank to use the CLI default when unsure.
              </p>
            </div>
          )}

          {localProvider === "google_vertex" && (
            <div className="rounded-xl bg-sky-400/5 px-3 py-2.5 ring-1 ring-sky-400/30">
              <p className="flex items-start gap-1.5 text-[0.6875rem] text-sky-300">
                <AlertCircle size="0.75rem" className="mt-px shrink-0" />
                <span>
                  Uses Vertex AI&apos;s Gemini endpoint. Set Base URL to your project and location, then paste either a
                  service account JSON key, an OAuth access token, or a Vertex API key when your project supports API
                  key auth.
                </span>
              </p>
              <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
                Example Base URL:{" "}
                <code className="rounded bg-[var(--secondary)] px-1">
                  https://us-central1-aiplatform.googleapis.com/v1/projects/my-project/locations/us-central1
                </code>
              </p>
            </div>
          )}

          {/* ── OpenRouter Provider Preference ── */}
          {localProvider === "openrouter" && (
            <FieldGroup
              label="Preferred Provider"
              icon={<Server size="0.875rem" className="text-sky-400" />}
              help="Choose which backend provider OpenRouter should route your requests to. Leave empty to let OpenRouter choose automatically based on price and availability."
            >
              <input
                value={localOpenrouterProvider}
                onChange={(e) => {
                  setLocalOpenrouterProvider(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                placeholder="e.g. Anthropic, Google, Amazon Bedrock…"
              />
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                Forces OpenRouter to route through a specific provider. The provider name must match exactly as shown on{" "}
                <a
                  href="https://openrouter.ai/models"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline"
                >
                  openrouter.ai/models
                </a>
                . Leave empty for automatic routing.
              </p>
            </FieldGroup>
          )}

          {!isLocalAuthProvider && (
            <>
              {/* ── API Key ── */}
              <FieldGroup
                label="API Key"
                icon={<Key size="0.875rem" className="text-sky-400" />}
                help="Your authentication key from the AI provider. You can get one from their website. It's like a password that lets Marinara talk to the AI service."
              >
                <input
                  value={localApiKey}
                  onChange={(e) => {
                    setLocalApiKey(e.target.value);
                    markDirty();
                  }}
                  type="password"
                  className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  placeholder="••••••••  (leave empty to keep existing key)"
                />
                <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                  Your key is encrypted at rest. Leave blank when editing to keep the existing key.
                </p>
                {apiKeyLink && (
                  <a
                    href={apiKeyLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[0.6875rem] font-medium text-sky-400 transition-colors hover:text-sky-300"
                  >
                    <ExternalLink size="0.625rem" />
                    {apiKeyLink.label}
                  </a>
                )}
                {localProvider === "custom" && (
                  <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
                    For local models (Ollama, LM Studio, KoboldCpp, etc.) you can leave this empty — just set the Base
                    URL below.
                  </p>
                )}
              </FieldGroup>

              {/* ── Base URL ── */}
              <FieldGroup
                label="Base URL"
                icon={<Globe size="0.875rem" className="text-sky-400" />}
                help="The API endpoint URL. Usually auto-filled for known providers. Only change this if you're using a proxy, local server, or custom endpoint."
              >
                <input
                  value={localBaseUrl}
                  onChange={(e) => {
                    setLocalBaseUrl(e.target.value);
                    markDirty();
                  }}
                  className={cn(
                    "w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm font-mono ring-1 placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                    baseUrlValidation.error ? "ring-[var(--destructive)]" : "ring-[var(--border)]",
                  )}
                  placeholder={providerDef?.defaultBaseUrl || "https://api.example.com/v1"}
                />
                {providerDef?.defaultBaseUrl && !localBaseUrl && (
                  <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                    Default: {providerDef.defaultBaseUrl}
                  </p>
                )}
                {baseUrlValidation.error && (
                  <p className="mt-1 text-[0.625rem] text-[var(--destructive)]">{baseUrlValidation.error}</p>
                )}
                {!baseUrlValidation.error && baseUrlValidation.value !== localBaseUrl.trim() && (
                  <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                    Will save as {baseUrlValidation.value}
                  </p>
                )}
                {localProvider === "custom" && (
                  <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
                    Local model examples: Ollama →{" "}
                    <code className="rounded bg-[var(--secondary)] px-1">http://localhost:11434/v1</code> · LM Studio →{" "}
                    <code className="rounded bg-[var(--secondary)] px-1">http://localhost:1234/v1</code> · KoboldCpp →{" "}
                    <code className="rounded bg-[var(--secondary)] px-1">http://localhost:5001/v1</code>
                  </p>
                )}
                <p className="mt-1.5 flex items-start gap-1 text-[0.625rem] text-amber-400/80">
                  <AlertCircle size="0.625rem" className="mt-px shrink-0" />
                  <span>
                    Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API
                    keys.
                  </span>
                </p>
                {localProvider === "custom" && (
                  <p className="mt-1.5 flex items-start gap-1 text-[0.625rem] text-sky-400/80">
                    <AlertCircle size="0.625rem" className="mt-px shrink-0" />
                    <span>
                      <strong>Windows users:</strong> If your proxy or local server isn't detected, Windows Defender
                      Firewall may be blocking the connection. Open{" "}
                      <em>Windows Security → Firewall & network protection → Allow an app through firewall</em> and add
                      Node.js or your proxy application.
                    </span>
                  </p>
                )}
              </FieldGroup>
            </>
          )}

          {/* ── Image Service (only for image_generation provider) ── */}
          {localProvider === "image_generation" && (
            <FieldGroup
              label="Service"
              icon={<Globe size="0.875rem" className="text-sky-400" />}
              help="Pick the backend type once, then point Base URL to any host or port. Provider-specific features such as ComfyUI workflow JSON and checkpoint fetching use this selection."
            >
              <div className="grid grid-cols-2 gap-1.5">
                {IMAGE_GENERATION_SOURCES.map((src) => {
                  const isActive = selectedImageService === src.id;
                  return (
                    <button
                      key={src.id}
                      onClick={() => {
                        const previousSource = IMAGE_GENERATION_SOURCES.find(
                          (candidate) => candidate.id === selectedImageService,
                        );
                        const shouldSeedBaseUrl = !localBaseUrl || localBaseUrl === previousSource?.defaultBaseUrl;
                        setLocalImageGenerationSource(src.id);
                        setLocalImageService(src.id);
                        if (shouldSeedBaseUrl) {
                          setLocalBaseUrl(src.defaultBaseUrl);
                        }
                        markDirty();
                      }}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left text-[0.6875rem] transition-all",
                        isActive
                          ? "bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/30"
                          : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{src.name}</span>
                        {isActive && <Check size="0.625rem" />}
                      </div>
                      <span className="text-[0.5625rem] opacity-70">{src.description}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                Pick the backend type once, then point Base URL to any host or port. Provider-specific features like
                ComfyUI workflow JSON and checkpoint fetching use this selection, not the default localhost URL.
              </p>
              {selectedImageService === "runpod_comfyui" && (
                <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[0.625rem] text-amber-300/80">
                  <strong>RunPod configuration:</strong> Your endpoint ID goes in the <strong>Endpoint ID</strong> field
                  below. The API key is your RunPod API token. The workflow JSON is <strong>required</strong> — the
                  endpoint executes the workflow you supply. Use <code>%prompt%</code> placeholders in the
                  CLIPTextEncode node.
                </div>
              )}
            </FieldGroup>
          )}

          {localProvider === "video_generation" && (
            <FieldGroup
              label="Video Service"
              icon={<Film size="0.875rem" className="text-sky-400" />}
              help="Pick the video backend. Game Mode uses this service to produce MP4 scene videos."
            >
              <div className="grid grid-cols-2 gap-1.5">
                {VIDEO_GENERATION_SOURCES.map((src) => {
                  const isActive = selectedVideoProvider === src.id;
                  return (
                    <button
                      key={src.id}
                      onClick={() => {
                        const previousSource = VIDEO_GENERATION_SOURCES.find(
                          (candidate) => candidate.id === selectedVideoProvider,
                        );
                        const shouldSeedBaseUrl = !localBaseUrl || localBaseUrl === previousSource?.defaultBaseUrl;
                        const previousDefaultModel = defaultVideoModelForService(selectedVideoDefaultsService);
                        const nextDefaultModel = defaultVideoModelForService(src.id);
                        const shouldSeedModel = !localModel || localModel === previousDefaultModel;
                        const nextDefaultsService = videoProviderServiceForModel(
                          src.id,
                          nextDefaultModel,
                          src.defaultBaseUrl,
                        );
                        setLocalVideoGenerationSource(src.id);
                        setLocalVideoService(nextDefaultsService);
                        setLocalVideoDefaults(createDefaultVideoGenerationProfile(nextDefaultsService));
                        if (shouldSeedBaseUrl) {
                          setLocalBaseUrl(src.defaultBaseUrl);
                        }
                        if (shouldSeedModel) {
                          setLocalModel(nextDefaultModel);
                        }
                        markDirty();
                      }}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left text-[0.6875rem] transition-all",
                        isActive
                          ? "bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/30"
                          : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{src.name}</span>
                        {isActive && <Check size="0.625rem" />}
                      </div>
                      <span className="text-[0.5625rem] opacity-70">{src.description}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                Scene videos are generated from the current game illustration plus the editable scene video prompt
                template.
              </p>
            </FieldGroup>
          )}

          {/* ── Model Selection ── */}
          <FieldGroup
            label="Model"
            icon={<Server size="0.875rem" className="text-sky-400" />}
            help="The specific AI model to use. You can pick from the list or type a custom model ID directly."
          >
            {/* Standard model dropdown + manual input (used for all providers including image_generation) */}
            <div ref={modelDropdownRef} className={cn("relative", showModelDropdown && "z-50")}>
              <div
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className={cn(
                  "relative flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--secondary)] px-3 py-2.5 ring-1 ring-[var(--border)] transition-all hover:ring-[var(--ring)]",
                  showModelDropdown && "z-50 ring-sky-400/50",
                )}
              >
                <Search size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
                {showModelDropdown ? (
                  <input
                    ref={modelSearchInputRef}
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
                    placeholder="Search models…"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={cn("flex-1 text-sm", !localModel && "text-[var(--muted-foreground)]")}>
                    {localModel
                      ? selectedModelInfo
                        ? `${selectedModelInfo.name} (${selectedModelInfo.id})`
                        : localModel
                      : emptyModelLabel}
                  </span>
                )}
                <ChevronDown
                  size="0.875rem"
                  className={cn(
                    "shrink-0 text-[var(--muted-foreground)] transition-transform",
                    showModelDropdown && "rotate-180",
                  )}
                />
              </div>

              {showModelDropdown && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
                  {/* Fetch from API button */}
                  <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)] p-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFetchModels();
                      }}
                      disabled={fetchModels.isPending}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-400 transition-all hover:bg-sky-400/20 active:scale-[0.98] disabled:opacity-50"
                    >
                      {fetchModels.isPending ? (
                        <Loader2 size="0.75rem" className="animate-spin" />
                      ) : (
                        <Globe size="0.75rem" />
                      )}
                      {fetchModels.isPending ? "Fetching…" : modelFetchButtonLabel}
                    </button>
                    {fetchError && <p className="mt-1.5 text-[0.625rem] text-[var(--destructive)]">{fetchError}</p>}
                    {remoteModels.length > 0 && !fetchError && (
                      <p className="mt-1 text-[0.625rem] text-emerald-400">
                        {remoteModels.length} model{remoteModels.length !== 1 ? "s" : ""} available from{" "}
                        {modelFetchSourceLabel}
                      </p>
                    )}
                  </div>

                  {localProvider === "custom" ? (
                    <div className="p-3">
                      <p className="mb-2 text-[0.625rem] text-[var(--muted-foreground)]">
                        Custom endpoints: type the model ID or fetch from API above.
                      </p>
                      <input
                        value={localModel}
                        onChange={(e) => handleManualModelChange(e.target.value)}
                        className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
                        placeholder="model-name-or-path"
                      />
                      {/* Show fetched models for custom provider */}
                      {remoteModels.length > 0 && (
                        <div className="mt-2 max-h-48 overflow-y-auto">
                          {remoteModels
                            .filter((m) => {
                              const q = (modelSearch || localModel).trim().toLowerCase();
                              if (!q) return true;
                              return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
                            })
                            .map((m) => (
                              <button
                                key={m.id}
                                onClick={() => selectModel({ ...m, isRemote: true })}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]",
                                  localModel === m.id && "bg-sky-400/5",
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{m.name}</span>
                                    {localModel === m.id && <Check size="0.75rem" className="text-sky-400" />}
                                  </div>
                                  <span className="text-[0.625rem] text-[var(--muted-foreground)]">{m.id}</span>
                                </div>
                                <span className="shrink-0 rounded-md bg-sky-400/10 px-1.5 py-0.5 text-[0.5625rem] font-medium text-sky-400">
                                  {modelFetchSourceLabel}
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setShowModelDropdown(false);
                          setModelSearch("");
                        }}
                        className="mt-2 w-full rounded-lg bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-400 hover:bg-sky-400/20"
                      >
                        Done
                      </button>
                    </div>
                  ) : filteredModels.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[var(--muted-foreground)]">
                      No models found. Try a different search or type the model ID below.
                      <input
                        value={localModel}
                        onChange={(e) => handleManualModelChange(e.target.value)}
                        className="mt-2 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
                        placeholder="Custom model ID…"
                      />
                    </div>
                  ) : (
                    filteredModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => selectModel(m)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]",
                          localModel === m.id && "bg-sky-400/5",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{m.name}</span>
                            {m.isRemote && (
                              <span className="rounded-md bg-sky-400/10 px-1.5 py-0.5 text-[0.5625rem] font-medium text-sky-400">
                                {modelFetchSourceLabel}
                              </span>
                            )}
                            {localModel === m.id && <Check size="0.75rem" className="text-sky-400" />}
                          </div>
                          <span className="text-[0.625rem] text-[var(--muted-foreground)]">{m.id}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          {m.context > 0 && (
                            <div className="text-[0.625rem] font-medium text-sky-400">{formatContext(m.context)}</div>
                          )}
                          {m.maxOutput > 0 && (
                            <div className="text-[0.5625rem] text-[var(--muted-foreground)]">
                              {formatContext(m.maxOutput)} out
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Manual model ID input below dropdown */}
            {localProvider !== "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={localModel}
                  onChange={(e) => {
                    handleManualModelChange(e.target.value);
                  }}
                  className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-[var(--ring)]"
                  placeholder={
                    isGrokSubscriptionProvider
                      ? "Optional: type a Grok CLI model ID, or leave blank for CLI default"
                      : "Or type model ID directly…"
                  }
                />
              </div>
            )}

            {/* Context display */}
            {selectedModelInfo && (
              <div className="mt-2 flex items-center gap-4 rounded-lg bg-sky-400/5 px-3 py-2 text-[0.6875rem]">
                <span className="text-[var(--muted-foreground)]">
                  Context: <strong className="text-sky-400">{formatContext(selectedModelInfo.context)}</strong>
                </span>
                <span className="text-[var(--muted-foreground)]">
                  Max Output: <strong className="text-sky-400">{formatContext(selectedModelInfo.maxOutput)}</strong>
                </span>
              </div>
            )}
          </FieldGroup>

          {/* ── RunPod Endpoint ID ── */}
          {localProvider === "image_generation" && selectedImageService === "runpod_comfyui" && (
            <FieldGroup
              label="RunPod Endpoint ID"
              icon={<Server size="0.875rem" className="text-sky-400" />}
              help="Your RunPod serverless endpoint ID (e.g. 'abc123def456'). This is the unique identifier for your endpoint on RunPod."
            >
              <input
                type="text"
                value={localImageEndpointId}
                onChange={(e) => {
                  setLocalImageEndpointId(e.target.value);
                  markDirty();
                }}
                placeholder="abc123def456"
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm outline-none ring-1 ring-[var(--border)] transition-shadow placeholder:text-[var(--muted-foreground)]/50 focus:ring-sky-400/50"
              />
            </FieldGroup>
          )}

          {/* ── ComfyUI Workflow ── */}
          {localProvider === "image_generation" &&
            (selectedImageService === "comfyui" || selectedImageService === "runpod_comfyui") && (
              <FieldGroup
                label={`ComfyUI Workflow (${selectedImageService === "runpod_comfyui" ? "Required" : "Optional"})`}
                icon={<Zap size="0.875rem" className="text-sky-400" />}
                help={
                  selectedImageService === "runpod_comfyui"
                    ? "Paste your ComfyUI workflow JSON (API format). RunPod needs the full workflow to execute; the endpoint sends this workflow to your serverless endpoint. Use placeholders like %prompt%, %seed%, %width%, %height%, %reference_image%, and %reference_image_01% through %reference_image_04% to let Marinara inject generation parameters."
                    : "Paste a custom ComfyUI workflow JSON (API format). Use placeholders like %prompt%, %negative_prompt%, %width%, %height%, %seed%, %model%, %steps%, %cfg%, %sampler%, %scheduler%, and %denoise%. For reference images, use %reference_image% / %reference_image_01% through %reference_image_04% to inject base64 strings, or %reference_image_name% / %reference_image_name_01% through %reference_image_name_04% to upload images to ComfyUI's input directory and inject filenames for LoadImage nodes. Leave empty to use the built-in default txt2img workflow."
                }
              >
                <textarea
                  ref={comfyWorkflowTextareaRef}
                  value={localComfyuiWorkflow}
                  onChange={(e) => {
                    setLocalComfyuiWorkflow(e.target.value);
                    markDirty();
                  }}
                  placeholder='Paste workflow JSON here (exported from ComfyUI via "Save (API Format)")…'
                  className={cn(
                    "w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-mono outline-none ring-1 transition-shadow placeholder:text-[var(--muted-foreground)]/50 min-h-[120px] max-h-[300px] resize-y",
                    comfyWorkflowValidation?.parseError
                      ? "ring-red-400/60 focus:ring-red-400"
                      : "ring-[var(--border)] focus:ring-sky-400/50",
                  )}
                />
                {comfyWorkflowValidation?.parseError && (
                  <p className="mt-1 flex items-start gap-1 text-[0.625rem] text-red-400">
                    <AlertCircle size="0.625rem" className="mt-px shrink-0" />
                    {comfyWorkflowValidation.charPos !== null ? (
                      <button
                        onClick={handleJumpToJsonError}
                        className="underline decoration-dotted cursor-pointer text-left hover:text-red-300"
                      >
                        {comfyWorkflowValidation.label}
                      </button>
                    ) : (
                      comfyWorkflowValidation.label
                    )}
                  </p>
                )}
                {comfyWorkflowValidation &&
                  !comfyWorkflowValidation.parseError &&
                  comfyWorkflowValidation.missing.length > 0 && (
                    <p className="mt-1 flex items-start gap-1 text-[0.625rem] text-amber-400">
                      <AlertCircle size="0.625rem" className="mt-px shrink-0" />
                      <span>
                        {comfyWorkflowValidation.missing.some((m) => m.critical) && (
                          <>
                            <strong>%prompt%</strong> placeholder not found — prompts won&apos;t be injected.{" "}
                          </>
                        )}
                        {comfyWorkflowValidation.missing.some((m) => !m.critical) && (
                          <>
                            Unused:{" "}
                            {comfyWorkflowValidation.missing
                              .filter((m) => !m.critical)
                              .map((m) => m.label)
                              .join(", ")}
                            .
                          </>
                        )}
                      </span>
                    </p>
                  )}
                <p className="text-[0.55rem] text-[var(--muted-foreground)] mt-1">
                  Export your workflow from ComfyUI using <strong>Save (API Format)</strong> in the menu. Placeholders
                  like <code>%prompt%</code>, <code>%steps%</code>, <code>%sampler%</code>, and reference-image
                  placeholders will be replaced at generation time.
                </p>
              </FieldGroup>
            )}

          {localProvider === "image_generation" && selectedImageDefaultsService && localImageDefaults && (
            <ImageGenerationDefaultsPanel
              service={selectedImageDefaultsService}
              model={localModel}
              source={selectedImageService}
              value={localImageDefaults}
              styleProfiles={imageStyleProfiles}
              expanded={imageDefaultsExpanded}
              onExpandedChange={setImageDefaultsExpanded}
              onChange={(next) => {
                setLocalImageDefaults(sanitizeImageGenerationProfile(next, selectedImageDefaultsService));
                markDirty();
              }}
              onReset={() => {
                setLocalImageDefaults(createDefaultImageGenerationProfile(selectedImageDefaultsService));
                markDirty();
              }}
            />
          )}

          {localProvider === "video_generation" && localVideoDefaults && (
            <VideoGenerationDefaultsPanel
              value={localVideoDefaults}
              expanded={videoDefaultsExpanded}
              onExpandedChange={setVideoDefaultsExpanded}
              onChange={(next) => {
                setLocalVideoDefaults(sanitizeVideoGenerationProfile(next));
                markDirty();
              }}
              onReset={() => {
                setLocalVideoDefaults(createDefaultVideoGenerationProfile(selectedVideoDefaultsService));
                markDirty();
              }}
            />
          )}

          {/* ── Max Context ── */}
          {!isMediaGenerationProvider && (
            <FieldGroup
              label="Max Context Window"
              icon={<Zap size="0.875rem" className="text-sky-400" />}
              help="The maximum number of tokens this model can process at once (your messages + its reply). This is auto-set when you pick a model from the list."
            >
              <div className="flex items-center gap-3">
                <DraftNumberInput
                  value={localMaxContext}
                  min={1}
                  selectOnFocus
                  onCommit={(nextValue) => {
                    setLocalMaxContext(nextValue);
                    markDirty();
                  }}
                  className="w-40 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <span className="text-xs text-[var(--muted-foreground)]">{formatContext(localMaxContext)} tokens</span>
              </div>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                {isGrokSubscriptionProvider
                  ? "Grok CLI starts at a safer 32k window because very large roleplay prompts can make the local CLI hit its own turn limit. Larger saved values are kept in settings, but requests are capped conservatively."
                  : "This is auto-set when selecting a model from the list. Override manually if needed."}
              </p>
            </FieldGroup>
          )}

          {/* ── Max Output Tokens Override ── */}
          {!isMediaGenerationProvider && !isLocalAuthProvider && (
            <FieldGroup
              label="Max Output Tokens Override"
              icon={<Zap size="0.875rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />}
              help="Hard cap on max_tokens for the API response (limiting output size). Use this for providers that enforce a lower limit than what the engine calculates (e.g. DeepSeek caps at 8192). Leave empty to let the engine decide."
            >
              <div className="flex items-center gap-3">
                <DraftNumberInput
                  value={localMaxTokensOverride ?? 0}
                  min={0}
                  selectOnFocus
                  onCommit={(nextValue) => {
                    setLocalMaxTokensOverride(nextValue > 0 ? nextValue : null);
                    markDirty();
                  }}
                  className="w-40 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <span className="text-xs text-[var(--muted-foreground)]">
                  {localMaxTokensOverride ? `${localMaxTokensOverride.toLocaleString()} tokens max` : "No override"}
                </span>
              </div>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                Set to 0 or leave empty to disable. When set, no request to this connection will exceed this token limit
                — including batched agent calls.
              </p>
            </FieldGroup>
          )}

          {/* ── Agent Parallel Jobs ── */}
          {!isMediaGenerationProvider && (
            <FieldGroup
              label="Max Parallel Agent Jobs"
              icon={
                <SlidersHorizontal size="0.875rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />
              }
              help="How many agent LLM requests Marinara may run at once for this connection. Higher values can speed up agent-heavy chats on providers that tolerate parallel calls."
            >
              <div className="flex items-center gap-3">
                <DraftNumberInput
                  value={localMaxParallelJobs}
                  min={1}
                  max={MAX_PARALLEL_JOBS}
                  selectOnFocus
                  onCommit={(nextValue) => {
                    setLocalMaxParallelJobs(normalizeMaxParallelJobs(nextValue));
                    markDirty();
                  }}
                  className="w-24 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <span className="text-xs text-[var(--muted-foreground)]">
                  {localMaxParallelJobs === 1 ? "One agent job at a time" : `${localMaxParallelJobs} agent jobs`}
                </span>
              </div>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                Agent batches for the same connection can be split across this many parallel jobs. Set to 1 for the
                safest provider behavior.
              </p>
            </FieldGroup>
          )}

          {canTreatAsLocalEndpoint && (
            <FieldGroup
              label="Local / Custom Endpoint"
              icon={<Server size="0.875rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />}
              help="Use this for self-hosted or proxied OpenAI-compatible endpoints, especially custom domains that point at a LAN model server. Professor Mari will use a JSON tool protocol fallback for workspace tools instead of relying only on native tool calls."
            >
              <SettingsSwitch
                label="Treat as local/custom endpoint"
                checked={localTreatAsLocalEndpoint}
                onChange={(checked) => {
                  setLocalTreatAsLocalEndpoint(checked);
                  markDirty();
                }}
              />
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                Enable this if Professor Mari stops after tool use or your endpoint advertises OpenAI compatibility but
                does not reliably support tool calls.
              </p>
            </FieldGroup>
          )}

          {/* ── Prompt Preset Override ── */}
          {!isMediaGenerationProvider && (
            <FieldGroup
              label="Prompt Preset Override"
              icon={<FileText size="0.875rem" className="mari-chrome-accent-icon mari-accent-animated" />}
              help="Optional. When roleplay or visual novel chats use this connection, Marinara assembles this prompt preset instead of the chat's selected prompt preset. Conversation and game mode keep their built-in prompt flows."
            >
              <select
                value={localPromptPresetId}
                onChange={(e) => {
                  setLocalPromptPresetId(e.target.value);
                  markDirty();
                }}
                className="mari-preset-native-select w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                <option value="">Use chat&apos;s prompt preset</option>
                {(allPresets ?? []).map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                Use this for models that need a different prompt structure. If this preset has variables, Marinara uses
                the preset&apos;s saved defaults unless the chat already uses the same preset.
              </p>
            </FieldGroup>
          )}

          {/* ── Default Chat Parameters ── */}
          {!isMediaGenerationProvider && (
            <FieldGroup
              label="Default Chat Parameters"
              icon={<Zap size="0.875rem" className="mari-chrome-accent-icon mari-accent-animated" />}
              help="Default generation settings for chats that use this connection. Individual chats can still override these in Chat Settings."
            >
              <SettingsSwitch
                label="Use custom defaults for this connection"
                checked={localDefaultParametersEnabled}
                onChange={(checked) => {
                  setLocalDefaultParametersEnabled(checked);
                  markDirty();
                }}
              />

              {localDefaultParametersEnabled ? (
                <div className="rounded-xl bg-[var(--secondary)]/40 p-3 ring-1 ring-[var(--border)]">
                  <GenerationParametersFields
                    value={localDefaultParameters}
                    showOpenRouterServiceTier={localProvider === "openrouter"}
                    enabledParametersFallback={STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS}
                    onChange={(next) => {
                      setLocalDefaultParameters(next);
                      markDirty();
                    }}
                  />
                </div>
              ) : (
                <p className="rounded-xl bg-[var(--secondary)]/40 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  This connection is using the mode defaults from conversation, roleplay, and game setup.
                </p>
              )}
            </FieldGroup>
          )}

          {/* ── Prompt Caching (Anthropic + OpenRouter Claude) ── */}
          {(localProvider === "anthropic" || localProvider === "openrouter") && (
            <FieldGroup
              label="Prompt Caching"
              icon={<Zap size="0.875rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />}
              help={
                localProvider === "anthropic"
                  ? "Enables Anthropic prompt caching, which caches your system prompt and conversation history between requests. Reduces latency and costs for multi-turn conversations. Cache lasts 5 minutes and is refreshed on each use."
                  : "For OpenRouter Claude models, sends the cache_control flag needed for Anthropic prompt caching. Most non-Claude OpenRouter models cache automatically and do not need this toggle."
              }
            >
              <SettingsSwitch
                label="Enable prompt caching"
                checked={localEnableCaching}
                onChange={(checked) => {
                  setLocalEnableCaching(checked);
                  if (!checked) setLocalAnthropicExtendedCacheTtl(false);
                  markDirty();
                }}
              />
              <p className="text-[0.625rem] text-[var(--muted-foreground)] px-2">
                {localProvider === "anthropic"
                  ? "Caches the system prompt explicitly and uses automatic caching for conversation history. Read tokens cost 90% less than regular input tokens. Cache writes cost 25% more on first use."
                  : "On OpenRouter, this currently targets Claude models by adding top-level cache_control. Cache reads are much cheaper than normal prompt tokens, while the first cache write costs more."}
              </p>
              {localProvider === "anthropic" && localEnableCaching && (
                <div className="mt-2 space-y-2">
                  <SettingsSwitch
                    label="Extended token caching (1 hour)"
                    checked={localAnthropicExtendedCacheTtl}
                    onChange={(checked) => {
                      setLocalAnthropicExtendedCacheTtl(checked);
                      markDirty();
                    }}
                  />
                  <p className="px-2 text-[0.625rem] text-[var(--muted-foreground)]">
                    Keeps Anthropic cache entries alive for one hour instead of five minutes. First cache writes cost 2x
                    the base input token price, so leave this off unless longer reuse matters.
                  </p>
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-[var(--secondary)]/40 px-3 py-2 ring-1 ring-[var(--border)]">
                    <div className="min-w-0">
                      <span className="block text-sm font-medium">Cache depth</span>
                      <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                        Messages back from the newest turn.
                      </span>
                    </div>
                    <DraftNumberInput
                      value={localCachingAtDepth}
                      min={0}
                      max={MAX_CACHING_AT_DEPTH}
                      onCommit={(value) => {
                        setLocalCachingAtDepth(normalizeCachingAtDepth(value));
                        markDirty();
                      }}
                      className="h-8 w-16 rounded-lg bg-[var(--background)] px-2 text-right text-sm outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40"
                      selectOnFocus
                    />
                  </label>
                </div>
              )}
            </FieldGroup>
          )}

          {/* ── Default for Agents ── */}
          <FieldGroup
            label={
              isImageGenerationProvider
                ? "Default for Illustrator"
                : isVideoGenerationProvider
                  ? "Default for Videos"
                  : "Default for Agents"
            }
            icon={<Sparkles size="0.875rem" className="text-sky-400" />}
            help={
              isImageGenerationProvider
                ? "When enabled, the Illustrator agent will use this image generation connection by default whenever it does not have a specific Image Generation Connection assigned."
                : isVideoGenerationProvider
                  ? "When enabled, Marinara uses this video generation connection by default when a chat has no specific Video Generation Connection assigned."
                  : "When enabled, all agents that don't have a specific connection override will use this connection instead of the chat's active connection."
            }
          >
            <SettingsSwitch
              label={
                isImageGenerationProvider
                  ? "Use as default Illustrator agent connection"
                  : isVideoGenerationProvider
                    ? "Use as default video connection"
                    : "Use as default agent connection"
              }
              checked={localDefaultForAgents}
              onChange={(checked) => {
                setLocalDefaultForAgents(checked);
                markDirty();
              }}
              className="px-2 py-1"
            />
            {isImageGenerationProvider && (
              <p className="px-2 text-[0.625rem] text-[var(--muted-foreground)]">
                Only one image generation connection should be marked as the default for the Illustrator agent.
              </p>
            )}
            {isVideoGenerationProvider && (
              <p className="px-2 text-[0.625rem] text-[var(--muted-foreground)]">
                Only one video generation connection should be marked as the default video connection.
              </p>
            )}
            {isVideoGenerationProvider && selectedVideoDefaultsService === "seedance" && localVideoDefaults && (
              <div className="mx-2 mt-2 space-y-2 rounded-lg bg-[var(--secondary)]/35 p-2 ring-1 ring-[var(--border)]">
                <SettingsSwitch
                  label="Upload Seedance reference frames temporarily"
                  checked={localVideoDefaults.seedance.temporaryPublicReferenceUploadEnabled}
                  onChange={(checked) => {
                    setLocalVideoDefaults(
                      sanitizeVideoGenerationProfile({
                        ...localVideoDefaults,
                        service: "seedance",
                        seedance: {
                          ...localVideoDefaults.seedance,
                          temporaryPublicReferenceUploadEnabled: checked,
                        },
                      }),
                    );
                    markDirty();
                  }}
                  description="Uses temporary public links when Seedance needs first/last-frame references and cannot fetch local Marinara URLs."
                  className="p-1"
                />
                {localVideoDefaults.seedance.temporaryPublicReferenceUploadEnabled && (
                  <label className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--card)]/70 px-2 py-1.5 ring-1 ring-[var(--border)]">
                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      Temporary link lifetime
                    </span>
                    <select
                      value={localVideoDefaults.seedance.temporaryPublicReferenceUploadExpiry}
                      onChange={(event) => {
                        const expiry = event.target.value as VideoReferenceUploadExpiry;
                        setLocalVideoDefaults(
                          sanitizeVideoGenerationProfile({
                            ...localVideoDefaults,
                            service: "seedance",
                            seedance: {
                              ...localVideoDefaults.seedance,
                              temporaryPublicReferenceUploadExpiry: expiry,
                            },
                          }),
                        );
                        markDirty();
                      }}
                      className="h-8 rounded-md bg-[var(--background)] px-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
                    >
                      {VIDEO_REFERENCE_UPLOAD_EXPIRY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="px-1 text-[0.55rem] leading-relaxed text-[var(--muted-foreground)]">
                  Keep this off if you do not want local avatar or gallery reference frames uploaded outside this
                  Marinara install.
                </p>
              </div>
            )}
          </FieldGroup>

          {/* ── Claude (Subscription) — Fast Mode toggle ── */}
          {isClaudeSubscriptionProvider && (
            <FieldGroup
              label="Fast Mode"
              icon={<Zap size="0.875rem" className="text-amber-400" />}
              help="When enabled, asks the Claude Agent SDK to use its faster routing tier — quicker responses but the SDK may use a smaller model behind the scenes (Sonnet/Haiku) even if you've selected Opus. Currently a no-op on every modern Claude model: Opus 4.7 has no faster variant to route to, and Anthropic dropped support for downgrading on the rest. The toggle is here for the day Anthropic re-enables it. Leave off."
            >
              <SettingsSwitch
                label={<span className="font-medium text-[var(--foreground)]">Use Claude Code fast-mode routing</span>}
                description={
                  <>
                    <span className="mt-0.5 block text-[var(--muted-foreground)]">
                      <strong className="text-amber-400">99% of users should leave this off.</strong> Fast mode is
                      effectively a dead feature today — Claude/Anthropic removed support for downgrading current
                      models, and Opus 4.7 has no faster variant to route to. Turning it on does nothing useful for
                      roleplay quality and may add overhead. The toggle exists only so we don&apos;t have to ship a new
                      release if Anthropic re-enables it. Leave off until that happens.
                    </span>
                    <span className="mt-1.5 flex items-start gap-1 text-[var(--muted-foreground)]">
                      <AlertCircle size="0.625rem" className="mt-px shrink-0 text-amber-400" />
                      <span>
                        <strong className="text-amber-400">Doesn&apos;t work on Claude Opus 4.7 yet.</strong> There is
                        no faster Opus 4.7 variant for the SDK to route to, so this toggle is a no-op when Opus 4.7 is
                        the selected model.
                      </span>
                    </span>
                  </>
                }
                checked={localClaudeFastMode}
                onChange={async (next) => {
                  if (next) {
                    const confirmed = await showConfirmDialog({
                      title: "YOU DON'T WANT THIS SETTING ON!",
                      message:
                        "Fast mode is effectively a dead feature today — Claude/Anthropic removed support for downgrading current models, and Opus 4.7 has no faster variant for the SDK to route to. Turning this on does nothing useful for roleplay quality and may add overhead. The toggle exists only so we don't have to ship a new release if Anthropic re-enables it.\n\nAre you absolutely sure you want to enable it?",
                      confirmLabel: "Enable anyway",
                      cancelLabel: "Keep it off",
                      tone: "destructive",
                    });
                    if (!confirmed) return;
                  }
                  setLocalClaudeFastMode(next);
                  markDirty();
                }}
                labelPosition="start"
                className="items-start justify-between rounded-xl bg-[var(--secondary)] px-3 py-2.5 ring-1 ring-[var(--border)]"
                labelClassName="min-w-0 flex-1 text-[0.6875rem] leading-relaxed"
              />
            </FieldGroup>
          )}

          {/* ── Embedding Model (for lorebook vectorization) ── */}
          {!isMediaGenerationProvider && (
            <FieldGroup
              label="Semantic Search (Embeddings)"
              icon={<Server size="0.875rem" className="mari-chrome-accent-icon mari-accent-animated" />}
              help="Optional. Configure the embedding source used for lorebook semantic search and memory recall."
            >
              {supportsDirectEmbeddingConfig ? (
                <>
                  <input
                    value={localEmbeddingModel}
                    onChange={(e) => {
                      setLocalEmbeddingModel(e.target.value);
                      markDirty();
                    }}
                    className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm font-mono ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    placeholder="e.g. text-embedding-3-small"
                  />
                  <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                    Used for lorebook semantic search. Entries matching by meaning (not just keywords) will be included
                    in the prompt.
                  </p>

                  {/* Embedding Base URL Override */}
                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                      Embedding Endpoint URL
                    </label>
                    <input
                      value={localEmbeddingBaseUrl}
                      onChange={(e) => {
                        setLocalEmbeddingBaseUrl(e.target.value);
                        markDirty();
                      }}
                      className={cn(
                        "w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm font-mono ring-1 placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                        embeddingBaseUrlValidation.error ? "ring-[var(--destructive)]" : "ring-[var(--border)]",
                      )}
                      placeholder="e.g. http://localhost:5002/v1"
                    />
                    {embeddingBaseUrlValidation.error && (
                      <p className="mt-1 text-[0.625rem] text-[var(--destructive)]">
                        {embeddingBaseUrlValidation.error}
                      </p>
                    )}
                    {!embeddingBaseUrlValidation.error &&
                      embeddingBaseUrlValidation.value !== localEmbeddingBaseUrl.trim() && (
                        <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                          Will save as {embeddingBaseUrlValidation.value}
                        </p>
                      )}
                    <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                      Optional. A separate base URL for your embedding backend. Useful when running two instances of
                      llama.cpp on different ports — one for chat, one for embeddings. Leave empty to use the
                      connection&apos;s main URL.
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                  This provider does not expose embeddings through Marinara. Choose a dedicated embedding connection
                  below, such as OpenAI-compatible, Google, or the Local Model sidecar.
                </p>
              )}

              {/* Embedding Connection Override */}
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                  Embedding Connection
                </label>
                <select
                  value={localEmbeddingConnectionId}
                  onChange={(e) => {
                    setLocalEmbeddingConnectionId(e.target.value);
                    markDirty();
                  }}
                  className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  <option value="">Same as this connection</option>
                  {import.meta.env.VITE_MARINARA_LITE !== "true" && (
                    <option value={LOCAL_SIDECAR_CONNECTION_ID}>Local Model (sidecar)</option>
                  )}
                  {((allConnections ?? []) as Record<string, unknown>[])
                    .filter(
                      (c) =>
                        c.id !== connectionDetailId &&
                        c.provider !== "image_generation" &&
                        c.provider !== "video_generation",
                    )
                    .map((c) => (
                      <option key={c.id as string} value={c.id as string}>
                        {c.name as string}
                        {c.embeddingModel ? ` (${c.embeddingModel})` : ""}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                  {localEmbeddingConnectionId === LOCAL_SIDECAR_CONNECTION_ID
                    ? "Uses the built-in Local Model from the Connections panel. The sidecar starts on demand and uses the currently selected local model for embeddings."
                    : "Use a different connection's API key and base URL for embeddings. The embedding model name above will still be used unless the chosen connection has its own embedding model configured."}
                </p>
              </div>
            </FieldGroup>
          )}

          {/* ── Test Section ── */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
            <h3 className="text-sm font-semibold">Connection Tests</h3>
            <div className="flex gap-2">
              <button
                onClick={handleTestConnection}
                disabled={testConnection.isPending}
                className="flex items-center gap-1.5 rounded-xl bg-sky-400/10 px-4 py-2.5 text-xs font-medium text-sky-400 ring-1 ring-sky-400/20 transition-all hover:bg-sky-400/20 active:scale-[0.98] disabled:opacity-50"
              >
                {testConnection.isPending ? (
                  <Loader2 size="0.8125rem" className="animate-spin" />
                ) : (
                  <Wifi size="0.8125rem" />
                )}
                Test Connection
              </button>
              {!isMediaGenerationProvider && (
                <button
                  onClick={handleTestMessage}
                  disabled={testMessage.isPending || !canSendTestMessage}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-400/10 px-4 py-2.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-400/20 transition-all hover:bg-emerald-400/20 active:scale-[0.98] disabled:opacity-50"
                >
                  {testMessage.isPending ? (
                    <Loader2 size="0.8125rem" className="animate-spin" />
                  ) : (
                    <MessageSquare size="0.8125rem" />
                  )}
                  Send Test Message
                </button>
              )}
              {localProvider === "image_generation" && (
                <button
                  onClick={handleTestImage}
                  disabled={testImageGeneration.isPending}
                  className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
                  title={dirty ? "Save first to test image generation" : undefined}
                >
                  {testImageGeneration.isPending ? (
                    <Loader2 size="0.8125rem" className="animate-spin" />
                  ) : (
                    <ImageIcon size="0.8125rem" />
                  )}
                  Test Image
                </button>
              )}
              {localProvider === "video_generation" && (
                <button
                  onClick={handleTestVideo}
                  disabled={testVideoGeneration.isPending}
                  className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
                  title={dirty ? "Save first to test video generation" : undefined}
                >
                  {testVideoGeneration.isPending ? (
                    <Loader2 size="0.8125rem" className="animate-spin" />
                  ) : (
                    <Film size="0.8125rem" />
                  )}
                  Test Video
                </button>
              )}
              {isClaudeSubscriptionProvider && (
                <button
                  onClick={handleDiagnoseClaudeSubscription}
                  disabled={diagnoseClaudeSubscription.isPending || !localModel}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-400/10 px-4 py-2.5 text-xs font-medium text-amber-400 ring-1 ring-amber-400/20 transition-all hover:bg-amber-400/20 active:scale-[0.98] disabled:opacity-50"
                  title="Verify which model the SDK actually bills against (catches silent fast-mode downgrades)"
                >
                  {diagnoseClaudeSubscription.isPending ? (
                    <Loader2 size="0.8125rem" className="animate-spin" />
                  ) : (
                    <AlertCircle size="0.8125rem" />
                  )}
                  Diagnose Model Routing
                </button>
              )}
            </div>

            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              <strong>Test Connection</strong> verifies your API key against the provider catalog or health endpoint.
              {!isMediaGenerationProvider && (
                <>
                  {" "}
                  <strong>Send Test Message</strong> sends "hi" to the selected model endpoint and shows the response.
                </>
              )}
              {localProvider === "image_generation" && (
                <>
                  {" "}
                  <strong>Test Image</strong> generates a 512×512 test image (requires saving first).
                </>
              )}
              {localProvider === "video_generation" && (
                <>
                  {" "}
                  <strong>Test Video</strong> generates a short MP4 test clip (requires saving first).
                </>
              )}
              {isClaudeSubscriptionProvider && (
                <>
                  {" "}
                  <strong>Diagnose Model Routing</strong> sends a real prompt through the Claude Agent SDK and reports
                  which model it actually billed against. Catches silent fast-mode / cooldown downgrades where you ask
                  for Opus and quietly get Sonnet.
                </>
              )}
            </p>

            {/* Connection test result */}
            {testResult && (
              <TestResultCard label="Connection Test" success={testResult.success} latencyMs={testResult.latencyMs}>
                {testResult.message}
              </TestResultCard>
            )}

            {/* Message test result */}
            {msgResult && (
              <TestResultCard label="Test Message" success={msgResult.success} latencyMs={msgResult.latencyMs}>
                {msgResult.success ? (
                  <div className="mt-1.5 rounded-lg bg-[var(--secondary)] p-2.5 text-xs leading-relaxed">
                    {msgResult.response}
                  </div>
                ) : (
                  <span className="text-[var(--destructive)]">{msgResult.error || "No response received"}</span>
                )}
              </TestResultCard>
            )}

            {/* Image test result */}
            {imgTestResult && (
              <TestResultCard label="Test Image" success={imgTestResult.success} latencyMs={imgTestResult.latencyMs}>
                {imgTestResult.success && imgTestResult.base64 && imgTestResult.mimeType ? (
                  <img
                    src={`data:${imgTestResult.mimeType};base64,${imgTestResult.base64}`}
                    title={imgTestResult.prompt}
                    alt={imgTestResult.prompt}
                    className="mt-2 max-w-full rounded-lg"
                    style={{ maxHeight: 300 }}
                  />
                ) : (
                  <span className="text-[var(--destructive)]">{imgTestResult.error || "No image returned"}</span>
                )}
              </TestResultCard>
            )}

            {vidTestResult && (
              <TestResultCard label="Test Video" success={vidTestResult.success} latencyMs={vidTestResult.latencyMs}>
                {vidTestResult.success && vidTestResult.base64 && vidTestResult.mimeType ? (
                  <video
                    src={`data:${vidTestResult.mimeType};base64,${vidTestResult.base64}`}
                    title={vidTestResult.prompt}
                    controls
                    muted
                    playsInline
                    className="mt-2 aspect-video max-h-[300px] w-full max-w-xl rounded-lg bg-black object-contain"
                  />
                ) : (
                  <span className="text-[var(--destructive)]">{vidTestResult.error || "No video returned"}</span>
                )}
              </TestResultCard>
            )}

            {/* Claude (Subscription) diagnosis result */}
            {claudeDiagResult && (
              <TestResultCard
                label="Model Routing Diagnosis"
                success={claudeDiagResult.success && !claudeDiagResult.billedDifferent}
                latencyMs={claudeDiagResult.latencyMs}
              >
                <div className="mt-1.5 space-y-2">
                  <div className="grid grid-cols-[max-content,1fr] gap-x-3 gap-y-1 text-[0.6875rem]">
                    <span className="text-[var(--muted-foreground)]">Requested model:</span>
                    <span className="font-mono">{claudeDiagResult.requestedModel}</span>
                    <span className="text-[var(--muted-foreground)]">SDK billed against:</span>
                    <span
                      className={cn(
                        "font-mono",
                        claudeDiagResult.billedDifferent && "font-semibold text-[var(--destructive)]",
                      )}
                    >
                      {(() => {
                        const detail = claudeDiagResult.modelUsageDetail;
                        if (detail.length === 0) {
                          return claudeDiagResult.modelsBilled.length
                            ? claudeDiagResult.modelsBilled.join(", ")
                            : "(none reported)";
                        }
                        const primary = detail.filter((u) => u.model === claudeDiagResult.requestedModel);
                        const secondary = detail.filter((u) => u.model !== claudeDiagResult.requestedModel);
                        return (
                          <span className="flex flex-col gap-1.5">
                            {primary.length > 0 && (
                              <span className="flex flex-col gap-0.5">
                                <span className="text-[0.5625rem] font-sans uppercase tracking-wide text-emerald-400/80">
                                  Roleplay generation
                                </span>
                                {primary.map((u) => (
                                  <span key={u.model}>
                                    {u.model}{" "}
                                    <span className="text-[var(--muted-foreground)]">
                                      (in {u.inputTokens}, out {u.outputTokens})
                                    </span>
                                  </span>
                                ))}
                              </span>
                            )}
                            {secondary.length > 0 && (
                              <span className="flex flex-col gap-0.5">
                                <span className="text-[0.5625rem] font-sans uppercase tracking-wide text-[var(--muted-foreground)]">
                                  SDK session bookkeeping
                                </span>
                                {secondary.map((u) => (
                                  <span key={u.model} className="text-[var(--muted-foreground)]">
                                    {u.model} (in {u.inputTokens}, out {u.outputTokens})
                                  </span>
                                ))}
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </span>
                    <span className="text-[var(--muted-foreground)]">Fast-mode state:</span>
                    <span
                      className={cn(
                        "font-mono",
                        claudeDiagResult.fastModeState && claudeDiagResult.fastModeState !== "off"
                          ? "text-amber-400"
                          : undefined,
                      )}
                    >
                      {claudeDiagResult.fastModeState ?? "unknown"}
                    </span>
                  </div>
                  {claudeDiagResult.billedDifferent && (
                    <div className="rounded-lg bg-[var(--destructive)]/10 p-2.5 text-[0.6875rem] text-[var(--destructive)] ring-1 ring-[var(--destructive)]/30">
                      Silent downgrade detected — you asked for <strong>{claudeDiagResult.requestedModel}</strong> but
                      the SDK billed <strong>{claudeDiagResult.modelsBilled.join(", ")}</strong>. This is usually caused
                      by Claude Code being in <code>cooldown</code> after hitting Opus rate limits, or fast mode being
                      toggled on in your CLI settings. Run <code>claude /model</code> in your terminal to check.
                    </div>
                  )}
                  {claudeDiagResult.modelUsageDetail.some((u) => u.model !== claudeDiagResult.requestedModel) && (
                    <div className="rounded-lg bg-[var(--secondary)]/50 p-2.5 text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                      <strong className="text-[var(--foreground)]">Why is Haiku in the list?</strong> The Claude Agent
                      SDK runs a <code>UserPromptSubmit</code> hook on every call that uses its small/fast model (Haiku)
                      to auto-generate a session title and optional context for the main model. This is Claude Code
                      session bookkeeping — it&apos;s organic to the subscription path, can&apos;t be cleanly disabled,
                      and doesn&apos;t serve any of your roleplay output. Your actual response always comes from the
                      model labeled <em>Roleplay generation</em> above. The Haiku tagalong adds only a few output tokens
                      per turn and a tiny slice of quota.
                    </div>
                  )}
                  {claudeDiagResult.response && (
                    <div className="rounded-lg bg-[var(--secondary)] p-2.5 ring-1 ring-[var(--border)]">
                      <div className="text-[0.5625rem] font-sans uppercase tracking-wide text-[var(--muted-foreground)]">
                        Model Self Identifies As
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
                        {claudeDiagResult.response}
                      </div>
                    </div>
                  )}
                  {claudeDiagResult.errors.length > 0 && (
                    <div className="text-[0.6875rem] text-[var(--destructive)]">
                      {claudeDiagResult.errors.join("; ")}
                    </div>
                  )}
                </div>
              </TestResultCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Helpers
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
    <div className="mari-editor-panel space-y-2 p-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-semibold text-[var(--foreground)]">{label}</h3>
        {help && <HelpTooltip text={help} />}
      </div>
      {children}
    </div>
  );
}

function TestResultCard({
  label,
  success,
  latencyMs,
  children,
}: {
  label: string;
  success: boolean;
  latencyMs: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        success ? "border-emerald-400/20 bg-emerald-400/5" : "border-[var(--destructive)]/20 bg-[var(--destructive)]/5",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        {success ? (
          <Check size="0.8125rem" className="text-emerald-400" />
        ) : (
          <AlertCircle size="0.8125rem" className="text-[var(--destructive)]" />
        )}
        <span className={success ? "text-emerald-400" : "text-[var(--destructive)]"}>
          {label}: {success ? "Success" : "Failed"}
        </span>
        <span className="ml-auto text-[0.625rem] text-[var(--muted-foreground)]">{latencyMs}ms</span>
      </div>
      <div className="mt-1 whitespace-pre-wrap break-words text-[0.6875rem] text-[var(--foreground)]">{children}</div>
    </div>
  );
}

function ImageGenerationDefaultsPanel({
  service,
  model,
  source,
  value,
  styleProfiles,
  expanded,
  onExpandedChange,
  onChange,
  onReset,
}: {
  service: ImageDefaultsService;
  model: string;
  source?: string | null;
  value: ImageGenerationDefaultsProfile;
  styleProfiles: ImageStyleProfileSettings;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onChange: (next: ImageGenerationDefaultsProfile) => void;
  onReset: () => void;
}) {
  const updateSeed = (seed: number) => {
    onChange({ ...value, seed });
  };

  const updateStyleProfile = (styleProfileId: string) => {
    onChange({ ...value, styleProfileId: styleProfileId || null });
  };

  const automatic1111 = value.automatic1111 ?? createDefaultImageGenerationProfile("automatic1111").automatic1111!;
  const comfyui = value.comfyui ?? createDefaultImageGenerationProfile("comfyui").comfyui!;
  const novelai = value.novelai ?? createDefaultImageGenerationProfile("novelai").novelai!;
  const suggestedStyleProfileId = suggestImageStyleProfileIdForModel(model, source, service);
  const suggestedStyleProfile = suggestedStyleProfileId
    ? styleProfiles.profiles.find((profile) => profile.id === suggestedStyleProfileId)
    : null;

  const updateAutomatic1111 = (patch: Partial<typeof automatic1111>) => {
    onChange({
      ...value,
      service: "automatic1111",
      automatic1111: { ...automatic1111, ...patch },
    });
  };

  const updateComfyUi = (patch: Partial<typeof comfyui>) => {
    onChange({
      ...value,
      service: "comfyui",
      comfyui: { ...comfyui, ...patch },
    });
  };

  const updateNovelAi = (patch: Partial<typeof novelai>) => {
    onChange({
      ...value,
      service: "novelai",
      novelai: { ...novelai, ...patch },
    });
  };

  return (
    <FieldGroup
      label="Local Image Defaults"
      icon={<SlidersHorizontal size="0.875rem" className="text-sky-400" />}
      help="Connection-scoped defaults for local Stable Diffusion backends. These only apply when this image generation connection is selected for a generation."
    >
      <div className="rounded-xl bg-[var(--secondary)]/40 ring-1 ring-[var(--border)]">
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]"
        >
          <div className="min-w-0">
            <div className="text-xs font-medium text-[var(--foreground)]">
              {service === "comfyui"
                ? "ComfyUI generation setup"
                : service === "novelai"
                  ? "NovelAI generation setup"
                  : "AUTOMATIC1111 / Forge setup"}
            </div>
            <p className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
              Prompt prefixes, sampler, scheduler, steps, guidance, seed, clip skip, and denoise.
            </p>
          </div>
          <ChevronDown
            size="0.875rem"
            className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", expanded && "rotate-180")}
          />
        </button>

        {expanded && (
          <div className="space-y-4 border-t border-[var(--border)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                Seed -1 keeps generation random. Any non-negative seed is reused exactly for this connection.
              </p>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--card)] px-2.5 py-1.5 text-[0.625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <RotateCcw size="0.6875rem" />
                Reset
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <NumberSetting label="Seed" value={value.seed} min={-1} max={4_294_967_295} onCommit={updateSeed} />
              <label className="flex flex-col gap-1 rounded-lg bg-[var(--card)] px-3 py-2 ring-1 ring-[var(--border)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Style Profile</span>
                  {suggestedStyleProfile && suggestedStyleProfile.id !== value.styleProfileId && (
                    <button
                      type="button"
                      onClick={() => updateStyleProfile(suggestedStyleProfile.id)}
                      className="rounded-md bg-[var(--secondary)] px-1.5 py-0.5 text-[0.55rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      Use {suggestedStyleProfile.name}
                    </button>
                  )}
                </div>
                <select
                  value={value.styleProfileId ?? ""}
                  onChange={(event) => updateStyleProfile(event.target.value)}
                  className="rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-xs text-[var(--foreground)]"
                >
                  <option value="">Use global default</option>
                  {styleProfiles.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                {suggestedStyleProfile && (
                  <span className="text-[0.55rem] text-[var(--muted-foreground)]">
                    Suggested from model/source: {suggestedStyleProfile.name}
                  </span>
                )}
              </label>
              {service === "automatic1111" ? (
                <>
                  <NumberSetting
                    label="Steps"
                    value={automatic1111.steps}
                    min={1}
                    max={150}
                    onCommit={(steps) => updateAutomatic1111({ steps })}
                  />
                  <NumberSetting
                    label="CFG Scale"
                    value={automatic1111.cfgScale}
                    min={0}
                    max={30}
                    integer={false}
                    onCommit={(cfgScale) => updateAutomatic1111({ cfgScale })}
                  />
                  <NumberSetting
                    label="Clip Skip"
                    value={automatic1111.clipSkip ?? 0}
                    min={0}
                    max={12}
                    onCommit={(clipSkip) => updateAutomatic1111({ clipSkip: clipSkip > 0 ? clipSkip : null })}
                  />
                  <NumberSetting
                    label="Img2Img Denoise"
                    value={automatic1111.denoisingStrength}
                    min={0}
                    max={1}
                    integer={false}
                    onCommit={(denoisingStrength) => updateAutomatic1111({ denoisingStrength })}
                  />
                </>
              ) : service === "comfyui" ? (
                <>
                  <NumberSetting
                    label="Steps"
                    value={comfyui.steps}
                    min={1}
                    max={150}
                    onCommit={(steps) => updateComfyUi({ steps })}
                  />
                  <NumberSetting
                    label="CFG Scale"
                    value={comfyui.cfgScale}
                    min={0}
                    max={30}
                    integer={false}
                    onCommit={(cfgScale) => updateComfyUi({ cfgScale })}
                  />
                  <NumberSetting
                    label="Denoise"
                    value={comfyui.denoisingStrength}
                    min={0}
                    max={1}
                    integer={false}
                    onCommit={(denoisingStrength) => updateComfyUi({ denoisingStrength })}
                  />
                  <NumberSetting
                    label="Clip Skip"
                    value={comfyui.clipSkip ?? 0}
                    min={0}
                    max={12}
                    onCommit={(clipSkip) => updateComfyUi({ clipSkip: clipSkip > 0 ? clipSkip : null })}
                  />
                </>
              ) : (
                <>
                  <NumberSetting
                    label="Steps"
                    value={novelai.steps}
                    min={1}
                    max={150}
                    onCommit={(steps) => updateNovelAi({ steps })}
                  />
                  <NumberSetting
                    label="Prompt Guidance"
                    value={novelai.promptGuidance}
                    min={0}
                    max={30}
                    integer={false}
                    onCommit={(promptGuidance) => updateNovelAi({ promptGuidance })}
                  />
                  <NumberSetting
                    label="Guidance Rescale"
                    value={novelai.promptGuidanceRescale}
                    min={0}
                    max={1}
                    integer={false}
                    onCommit={(promptGuidanceRescale) => updateNovelAi({ promptGuidanceRescale })}
                  />
                  <NumberSetting
                    label="UC Preset"
                    value={novelai.undesiredContentPreset}
                    min={0}
                    max={4}
                    onCommit={(undesiredContentPreset) => updateNovelAi({ undesiredContentPreset })}
                  />
                </>
              )}
            </div>

            {service === "automatic1111" ? (
              <>
                <TextSetting
                  label="Prompt Prefix"
                  value={automatic1111.promptPrefix}
                  onChange={(promptPrefix) => updateAutomatic1111({ promptPrefix })}
                  placeholder="e.g. masterpiece, high quality"
                />
                <TextSetting
                  label="Negative Prefix"
                  value={automatic1111.negativePromptPrefix}
                  onChange={(negativePromptPrefix) => updateAutomatic1111({ negativePromptPrefix })}
                  placeholder="e.g. low quality, blurry"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <ChoiceSetting
                    label="Sampler"
                    value={automatic1111.sampler}
                    options={SD_WEBUI_SAMPLER_OPTIONS}
                    onChange={(sampler) => updateAutomatic1111({ sampler })}
                  />
                  <ChoiceSetting
                    label="Scheduler"
                    value={automatic1111.scheduler}
                    options={SD_WEBUI_SCHEDULER_OPTIONS}
                    onChange={(scheduler) => updateAutomatic1111({ scheduler })}
                  />
                </div>
                <SettingsCheckbox
                  label="Restore faces"
                  checked={automatic1111.restoreFaces}
                  onChange={(checked) => updateAutomatic1111({ restoreFaces: checked })}
                  className="bg-[var(--card)] px-3 py-2 ring-1 ring-[var(--border)]"
                  labelClassName="text-[var(--foreground)]"
                />
              </>
            ) : service === "comfyui" ? (
              <>
                <TextSetting
                  label="Prompt Prefix"
                  value={comfyui.promptPrefix}
                  onChange={(promptPrefix) => updateComfyUi({ promptPrefix })}
                  placeholder="e.g. masterpiece, high quality"
                />
                <TextSetting
                  label="Negative Prefix"
                  value={comfyui.negativePromptPrefix}
                  onChange={(negativePromptPrefix) => updateComfyUi({ negativePromptPrefix })}
                  placeholder="e.g. low quality, blurry"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <ChoiceSetting
                    label="Sampler"
                    value={comfyui.sampler}
                    options={COMFYUI_SAMPLER_OPTIONS}
                    onChange={(sampler) => updateComfyUi({ sampler })}
                  />
                  <ChoiceSetting
                    label="Scheduler"
                    value={comfyui.scheduler}
                    options={COMFYUI_SCHEDULER_OPTIONS}
                    onChange={(scheduler) => updateComfyUi({ scheduler })}
                  />
                </div>
                <SettingsCheckbox
                  label="Upload a 1x1 placeholder when no reference image is provided"
                  description="Custom workflows using %reference_image% or %reference_image_name% receive a tiny PNG instead of the raw placeholder text."
                  checked={comfyui.uploadPlaceholderOnMissingReference}
                  onChange={(checked) => updateComfyUi({ uploadPlaceholderOnMissingReference: checked })}
                  className="bg-[var(--card)] px-3 py-2 ring-1 ring-[var(--border)]"
                  labelClassName="text-[var(--foreground)]"
                />
                <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                  Custom ComfyUI workflows can use %steps%, %cfg%, %sampler%, %scheduler%, %denoise%, %clip_skip%,
                  %reference_image% / %reference_image_01%-%reference_image_04%, and %reference_image_name% /
                  %reference_image_name_01%-%reference_image_name_04% placeholders.
                </p>
              </>
            ) : (
              <>
                <TextSetting
                  label="Prompt Prefix"
                  value={novelai.promptPrefix}
                  onChange={(promptPrefix) => updateNovelAi({ promptPrefix })}
                  placeholder="e.g. masterpiece, best quality"
                />
                <TextSetting
                  label="Negative Prefix"
                  value={novelai.negativePromptPrefix}
                  onChange={(negativePromptPrefix) => updateNovelAi({ negativePromptPrefix })}
                  placeholder="e.g. low quality, blurry"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <ChoiceSetting
                    label="Sampler"
                    value={novelai.sampler}
                    options={NOVELAI_SAMPLER_OPTIONS}
                    onChange={(sampler) => updateNovelAi({ sampler })}
                  />
                  <ChoiceSetting
                    label="Noise Schedule"
                    value={novelai.noiseSchedule}
                    options={NOVELAI_NOISE_SCHEDULE_OPTIONS}
                    onChange={(noiseSchedule) => updateNovelAi({ noiseSchedule })}
                  />
                </div>
                <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                  These values are sent with native NovelAI requests and embedded in generated PNG metadata for
                  troubleshooting.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </FieldGroup>
  );
}

function TextSetting({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        placeholder={placeholder}
        className="mt-1 w-full resize-y rounded-lg bg-[var(--card)] px-3 py-2 text-xs ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:ring-sky-400/50"
      />
    </label>
  );
}

function VideoGenerationDefaultsPanel({
  value,
  expanded,
  onExpandedChange,
  onChange,
  onReset,
}: {
  value: VideoGenerationDefaultsProfile;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onChange: (next: VideoGenerationDefaultsProfile) => void;
  onReset: () => void;
}) {
  const service =
    value.service === "xai" ||
    value.service === "openrouter" ||
    value.service === "seedance" ||
    value.service === "google_veo"
      ? value.service
      : "gemini_omni";
  const summary =
    service === "xai"
      ? `${value.xai.durationSeconds}s, ${value.xai.aspectRatio}, ${value.xai.resolution}`
      : service === "google_veo"
        ? `${value.googleVeo.durationSeconds}s, ${value.googleVeo.aspectRatio}, ${value.googleVeo.resolution}`
        : service === "openrouter"
          ? `${value.openrouter.durationSeconds}s, ${value.openrouter.aspectRatio}, ${value.openrouter.resolution}`
          : service === "seedance"
            ? `${value.seedance.durationSeconds}s, ${value.seedance.aspectRatio}, ${value.seedance.resolution}`
            : `${value.geminiOmni.durationSeconds}s, ${value.geminiOmni.aspectRatio}`;
  const serviceLabel =
    service === "xai"
      ? "xAI Imagine"
      : service === "google_veo"
        ? "Google AI Studio Veo"
        : service === "openrouter"
          ? "OpenRouter Video"
          : service === "seedance"
            ? "Seedance 2.0"
            : "Google AI Studio Gemini Omni";

  const updateGeminiOmni = (patch: Partial<VideoGenerationDefaultsProfile["geminiOmni"]>) => {
    onChange({
      ...value,
      service: "gemini_omni",
      geminiOmni: { ...value.geminiOmni, ...patch },
    });
  };
  const updateXai = (patch: Partial<VideoGenerationDefaultsProfile["xai"]>) => {
    onChange({
      ...value,
      service: "xai",
      xai: { ...value.xai, ...patch },
    });
  };
  const updateGoogleVeo = (patch: Partial<VideoGenerationDefaultsProfile["googleVeo"]>) => {
    onChange({
      ...value,
      service: "google_veo",
      googleVeo: { ...value.googleVeo, ...patch },
    });
  };
  const updateOpenRouter = (patch: Partial<VideoGenerationDefaultsProfile["openrouter"]>) => {
    onChange({
      ...value,
      service: "openrouter",
      openrouter: { ...value.openrouter, ...patch },
    });
  };
  const updateSeedance = (patch: Partial<VideoGenerationDefaultsProfile["seedance"]>) => {
    onChange({
      ...value,
      service: "seedance",
      seedance: { ...value.seedance, ...patch },
    });
  };

  return (
    <FieldGroup
      label="Video Defaults"
      icon={<SlidersHorizontal size="0.875rem" className="text-sky-400" />}
      help={
        service === "xai"
          ? "Connection-scoped defaults for xAI scene video generation."
          : service === "google_veo"
            ? "Connection-scoped defaults for Google AI Studio Veo video generation."
            : service === "openrouter"
              ? "Connection-scoped defaults for OpenRouter asynchronous video generation."
              : service === "seedance"
                ? "Connection-scoped defaults for Seedance 2.0 asynchronous video generation."
                : "Connection-scoped defaults for scene video generation. Duration is rendered into the Omni prompt."
      }
    >
      <div className="rounded-xl bg-[var(--secondary)]/40 ring-1 ring-[var(--border)]">
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]"
        >
          <div className="min-w-0">
            <div className="text-xs font-medium text-[var(--foreground)]">{serviceLabel} setup</div>
            <div className="text-[0.625rem] text-[var(--muted-foreground)]">{summary}</div>
          </div>
          <ChevronDown
            size="0.875rem"
            className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", expanded && "rotate-180")}
          />
        </button>

        {expanded && (
          <div className="space-y-3 border-t border-[var(--border)] px-3 py-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--card)] px-2.5 py-1.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--foreground)]"
              >
                <RotateCcw size="0.6875rem" />
                Reset
              </button>
            </div>

            {service === "xai" || service === "google_veo" || service === "openrouter" || service === "seedance" ? (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  <NumberSetting
                    label="Duration Seconds"
                    value={
                      service === "xai"
                        ? value.xai.durationSeconds
                        : service === "google_veo"
                          ? value.googleVeo.durationSeconds
                          : service === "seedance"
                            ? value.seedance.durationSeconds
                            : value.openrouter.durationSeconds
                    }
                    min={service === "google_veo" || service === "seedance" ? 4 : 1}
                    max={service === "xai" || service === "seedance" ? 15 : service === "google_veo" ? 8 : 60}
                    onCommit={(durationSeconds) => {
                      if (service === "xai") updateXai({ durationSeconds });
                      else if (service === "google_veo") {
                        updateGoogleVeo({ durationSeconds: durationSeconds <= 5 ? 4 : durationSeconds <= 7 ? 6 : 8 });
                      } else if (service === "seedance") {
                        updateSeedance({ durationSeconds });
                      } else updateOpenRouter({ durationSeconds });
                    }}
                  />
                  <label className="block">
                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Aspect Ratio</span>
                    <select
                      value={
                        service === "xai"
                          ? value.xai.aspectRatio
                          : service === "google_veo"
                            ? value.googleVeo.aspectRatio
                            : service === "seedance"
                              ? value.seedance.aspectRatio
                              : value.openrouter.aspectRatio
                      }
                      onChange={(event) => {
                        const aspectRatio = event.target.value === "9:16" ? "9:16" : "16:9";
                        if (service === "xai") updateXai({ aspectRatio });
                        else if (service === "google_veo") updateGoogleVeo({ aspectRatio });
                        else if (service === "seedance") updateSeedance({ aspectRatio });
                        else updateOpenRouter({ aspectRatio });
                      }}
                      className="mt-1 w-full rounded-lg bg-[var(--card)] px-3 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
                    >
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Resolution</span>
                    <select
                      value={
                        service === "xai"
                          ? value.xai.resolution
                          : service === "google_veo"
                            ? value.googleVeo.resolution
                            : service === "seedance"
                              ? value.seedance.resolution
                              : value.openrouter.resolution
                      }
                      onChange={(event) => {
                        const resolution = event.target.value as VideoResolution;
                        if (service === "xai") updateXai({ resolution });
                        else if (service === "google_veo") updateGoogleVeo({ resolution });
                        else if (service === "seedance") updateSeedance({ resolution });
                        else updateOpenRouter({ resolution });
                      }}
                      className="mt-1 w-full rounded-lg bg-[var(--card)] px-3 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
                    >
                      {VIDEO_RESOLUTION_OPTIONS.filter(
                        (option) => service !== "google_veo" || option.value !== "480p",
                      ).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                  {service === "xai"
                    ? "These values are sent to the xAI Videos API. xAI accepts 1-15 seconds for generated videos."
                    : service === "google_veo"
                      ? "Veo accepts 4, 6, or 8 seconds. Character loop references use the avatar as the first and last frame and run at 8 seconds."
                      : service === "seedance"
                        ? "Seedance accepts 4-15 seconds. Reference-image jobs send matching first and last frames when the provider can fetch the reference URL."
                        : "These values are sent to OpenRouter's asynchronous Videos API. OpenRouter model support varies, so keep the model's own limits in mind."}
                </p>
              </>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <NumberSetting
                  label="Target Duration Seconds"
                  value={value.geminiOmni.durationSeconds}
                  min={1}
                  max={60}
                  onCommit={(durationSeconds) => updateGeminiOmni({ durationSeconds })}
                />
                <label className="block">
                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Aspect Ratio</span>
                  <select
                    value={value.geminiOmni.aspectRatio}
                    onChange={(event) =>
                      updateGeminiOmni({ aspectRatio: event.target.value === "9:16" ? "9:16" : "16:9" })
                    }
                    className="mt-1 w-full rounded-lg bg-[var(--card)] px-3 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
                  >
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </FieldGroup>
  );
}

function ChoiceSetting({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const listId = `image-default-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label className="block">
      <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">{label}</span>
      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg bg-[var(--card)] px-3 py-2 text-xs ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:ring-sky-400/50"
        placeholder="Backend default"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </label>
  );
}

function NumberSetting({
  label,
  value,
  min,
  max,
  integer = true,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  integer?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, integer ? Math.trunc(parsed) : parsed));
    setDraft(String(clamped));
    onCommit(clamped);
  };

  return (
    <label className="block">
      <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">{label}</span>
      <input
        value={draft}
        type="number"
        min={min}
        max={max}
        step={integer ? 1 : 0.05}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className="mt-1 w-full rounded-lg bg-[var(--card)] px-3 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
      />
    </label>
  );
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return String(tokens);
}

function getStoredImageGenerationDefaults(
  raw: unknown,
  service: ImageDefaultsService,
): ImageGenerationDefaultsProfile | null {
  const root = parseDefaultParametersRoot(raw);
  if (!root[IMAGE_DEFAULTS_STORAGE_KEY]) return null;
  return normalizeImageGenerationProfile(root[IMAGE_DEFAULTS_STORAGE_KEY], service).profile;
}

function buildImageDefaultParameters(
  raw: unknown,
  imageDefaults: ImageGenerationDefaultsProfile | null,
): Record<string, unknown> | null {
  const root = parseDefaultParametersRoot(raw);
  if (imageDefaults) {
    root[IMAGE_DEFAULTS_STORAGE_KEY] = imageDefaults;
  } else {
    delete root[IMAGE_DEFAULTS_STORAGE_KEY];
  }
  return Object.keys(root).length > 0 ? root : null;
}

function getStoredVideoGenerationDefaults(raw: unknown): VideoGenerationDefaultsProfile | null {
  const root = parseDefaultParametersRoot(raw);
  if (!root[VIDEO_DEFAULTS_STORAGE_KEY]) return null;
  return normalizeVideoGenerationProfile(root[VIDEO_DEFAULTS_STORAGE_KEY]).profile;
}

function buildVideoDefaultParameters(
  raw: unknown,
  videoDefaults: VideoGenerationDefaultsProfile | null,
): Record<string, unknown> | null {
  const root = parseDefaultParametersRoot(raw);
  if (videoDefaults) {
    root[VIDEO_DEFAULTS_STORAGE_KEY] = videoDefaults;
  } else {
    delete root[VIDEO_DEFAULTS_STORAGE_KEY];
  }
  return Object.keys(root).length > 0 ? root : null;
}

function parseDefaultParametersRoot(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? { ...(parsed as Record<string, unknown>) }
    : {};
}
