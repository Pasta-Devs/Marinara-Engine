// ──────────────────────────────────────────────
// Full-Page Connection Editor
// Click a connection → opens this editor (like presets/characters)
// ──────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo, useRef, type ChangeEvent } from "react";
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
  Music,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";
import { prepareImageAttachment } from "../../lib/chat-attachment-images";
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
  ZAI_IMAGE_MODELS,
  VIDEO_GENERATION_SOURCES,
  inferImageSource,
  inferVideoSource,
  isLocalAuthProvider as isLocalAuthConnectionProvider,
  IMAGE_DEFAULTS_STORAGE_KEY,
  VIDEO_DEFAULTS_STORAGE_KEY,
  COMFYUI_SAMPLER_OPTIONS,
  COMFYUI_SCHEDULER_OPTIONS,
  COMFYUI_LORA_STRENGTH_MIN,
  COMFYUI_LORA_STRENGTH_MAX,
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
  MAX_IMAGE_PROMPT_INSTRUCTIONS_LENGTH,
  normalizeImagePromptInstructions,
  parseConnectionImageCaptioningDefaults,
  type APIProvider,
  type AudioGenerationSource,
  type ComfyUiLoraSetting,
  type ImageDefaultsService,
  type ImageGenerationDefaultsProfile,
  type ImageGenerationQuality,
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
  arli: { label: "Get your Arli AI API key", url: "https://www.arliai.com/account" },
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
  atlas: "google/veo3.1/text-to-video",
  seedance: "seedance-2-0",
  comfyui: "",
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
  if (value === "swarmui") return "comfyui";
  if (value === "nanogpt") return "openrouter";
  return value === "xai" ||
    value === "openrouter" ||
    value === "atlas" ||
    value === "seedance" ||
    value === "google_veo" ||
    value === "comfyui"
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
  if (value?.trim() === "swarmui") return "swarmui";
  if (value?.trim() === "nanogpt") return "nanogpt";
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
  if (value === "nanogpt") return "";
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

// Mirrors TTS_SOURCE_DEFAULTS in TTSConfigCard so a fresh audio connection
// seeds the same base URL / model / voice the legacy TTS settings used.
const AUDIO_SOURCE_OPTIONS: Array<{
  id: AudioGenerationSource;
  name: string;
  defaultBaseUrl: string;
  defaultModel: string;
  defaultVoice: string;
}> = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    defaultBaseUrl: "https://api.elevenlabs.io",
    defaultModel: "eleven_multilingual_v2",
    defaultVoice: "",
  },
  {
    id: "openai",
    name: "OpenAI-compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "tts-1",
    defaultVoice: "alloy",
  },
  {
    id: "pockettts",
    name: "PocketTTS",
    defaultBaseUrl: "http://localhost:8000",
    defaultModel: "pocket-tts",
    defaultVoice: "alba",
  },
  {
    id: "xai",
    name: "xAI Voice",
    defaultBaseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-tts",
    defaultVoice: "eve",
  },
];

function canProviderTreatAsLocalEndpoint(provider: APIProvider): boolean {
  return (
    provider !== "image_generation" &&
    provider !== "video_generation" &&
    provider !== "audio" &&
    !isLocalAuthConnectionProvider(provider)
  );
}

function providerSupportsDirectEmbeddingConfig(provider: APIProvider): boolean {
  return (
    provider !== "image_generation" &&
    provider !== "video_generation" &&
    provider !== "audio" &&
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
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
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
  const [localMaxRequestsPerMinute, setLocalMaxRequestsPerMinute] = useState<number | null>(null);
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
  const [localImagePromptInstructions, setLocalImagePromptInstructions] = useState("");
  const [localImageGenerationQuality, setLocalImageGenerationQuality] = useState<ImageGenerationQuality>("auto");
  const [localVideoGenerationSource, setLocalVideoGenerationSource] = useState("");
  const [localVideoService, setLocalVideoService] = useState<string | null>(null);
  const [localAudioSource, setLocalAudioSource] = useState("elevenlabs");
  const [localAudioVoice, setLocalAudioVoice] = useState("");
  const [localAudioSoundEffects, setLocalAudioSoundEffects] = useState(false);
  const [localAudioMusic, setLocalAudioMusic] = useState(false);
  const [localMaxTokensOverride, setLocalMaxTokensOverride] = useState<number | null>(null);
  const [localClaudeFastMode, setLocalClaudeFastMode] = useState(false);
  const [localTreatAsLocalEndpoint, setLocalTreatAsLocalEndpoint] = useState(false);
  const [localDefaultParametersEnabled, setLocalDefaultParametersEnabled] = useState(false);
  const [localDefaultParameters, setLocalDefaultParameters] =
    useState<EditableGenerationParameters>(CONNECTION_PARAMETER_DEFAULTS);
  const [localImageCaptioningEnabled, setLocalImageCaptioningEnabled] = useState(false);
  const [localImageCaptioningConnectionId, setLocalImageCaptioningConnectionId] = useState("");
  const [localImageDefaults, setLocalImageDefaults] = useState<ImageGenerationDefaultsProfile | null>(null);
  const localImageDefaultsRef = useRef<ImageGenerationDefaultsProfile | null>(null);
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
  const [remoteLoras, setRemoteLoras] = useState<RemoteConnectionModel[]>([]);
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
    setLocalMaxRequestsPerMinute(
      typeof c.maxRequestsPerMinute === "number" && c.maxRequestsPerMinute > 0 ? c.maxRequestsPerMinute : null,
    );
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
    setLocalImagePromptInstructions((c.imagePromptInstructions as string) ?? "");
    setLocalImageGenerationQuality(
      c.imageGenerationQuality === "low" || c.imageGenerationQuality === "medium" || c.imageGenerationQuality === "high"
        ? c.imageGenerationQuality
        : "auto",
    );
    setLocalVideoGenerationSource(videoProviderSource);
    setLocalVideoService(videoDefaultsService);
    setLocalAudioSource((c.audioSource as string) || "elevenlabs");
    setLocalAudioVoice((c.audioVoice as string) ?? "");
    setLocalAudioSoundEffects(c.audioSoundEffects === "true" || c.audioSoundEffects === true);
    setLocalAudioMusic(c.audioMusic === "true" || c.audioMusic === true);
    setLocalMaxTokensOverride(typeof c.maxTokensOverride === "number" ? (c.maxTokensOverride as number) : null);
    setLocalClaudeFastMode(c.claudeFastMode === "true" || c.claudeFastMode === true);
    setLocalTreatAsLocalEndpoint(c.treatAsLocalEndpoint === "true" || c.treatAsLocalEndpoint === true);
    const imageCaptioningDefaults = parseConnectionImageCaptioningDefaults(c.defaultParameters);
    setLocalDefaultParametersEnabled(
      !!parseEditableGenerationParameters(c.defaultParameters) || Object.keys(imageCaptioningDefaults).length > 0,
    );
    setLocalDefaultParameters(getEditableGenerationParameters(CONNECTION_PARAMETER_DEFAULTS, c.defaultParameters));
    setLocalImageCaptioningEnabled(imageCaptioningDefaults.imageCaptioningEnabled === true);
    setLocalImageCaptioningConnectionId(imageCaptioningDefaults.imageCaptioningConnectionId ?? "");
    const nextImageDefaults = defaultsService
      ? (storedImageDefaults ?? createDefaultImageGenerationProfile(defaultsService))
      : null;
    localImageDefaultsRef.current = nextImageDefaults;
    setLocalImageDefaults(nextImageDefaults);
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
    const isSwarmUiVideoWorkflow =
      (localVideoGenerationSource || localVideoService || inferVideoSource(localModel, localBaseUrl)) === "swarmui";
    const KNOWN_SUBS =
      localProvider === "video_generation"
        ? [
            { token: "%prompt%", label: "%prompt%", critical: true },
            { token: "%width%", label: "%width%", critical: false },
            { token: "%height%", label: "%height%", critical: false },
            { token: "%seed%", label: "%seed%", critical: false },
            { token: "%length%", label: "%length%", critical: false },
            { token: "%length_s%", label: "%length_s%", critical: false },
            { token: "%fps%", label: "%fps%", critical: false },
            { token: "%duration_seconds%", label: "%duration_seconds%", critical: false },
            {
              token: isSwarmUiVideoWorkflow ? "%reference_image%" : "%reference_image_name%",
              label: isSwarmUiVideoWorkflow ? "%reference_image%" : "%reference_image_name%",
              critical: false,
            },
          ]
        : [
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
  }, [localBaseUrl, localComfyuiWorkflow, localModel, localProvider, localVideoGenerationSource, localVideoService]);

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
  const supportsGptImageQuality =
    localProvider === "image_generation" &&
    selectedImageService === "openai" &&
    /^gpt-image-(?:1|1\.5|2)(?:$|-)/i.test(localModel.trim());
  const selectedVideoService =
    localProvider === "video_generation"
      ? localVideoGenerationSource || localVideoService || effectiveVideoGenerationSource
      : "";
  const selectedVideoProvider = videoSourceToProviderOption(selectedVideoService);
  const selectedVideoDefaultsService = videoSelectionToDefaultsService(selectedVideoService, localModel, localBaseUrl);
  const swarmUiWorkflowError =
    (selectedImageService === "swarmui" || selectedVideoProvider === "swarmui") &&
    /%reference_image_name(?:_0[1-4])?%/.test(localComfyuiWorkflow)
      ? localizeUi("ui.connections.connectioneditor.swarmuiDoesNotSupportReferenceImageName")
      : null;
  const usesComfyUiWorkflow =
    (localProvider === "image_generation" &&
      (selectedImageService === "comfyui" ||
        selectedImageService === "swarmui" ||
        selectedImageService === "runpod_comfyui")) ||
    (localProvider === "video_generation" &&
      (selectedVideoProvider === "comfyui" || selectedVideoProvider === "swarmui"));
  const apiKeyLink =
    localProvider === "image_generation" && selectedImageService === "arli"
      ? { label: t("connections.mediaSources.arli.apiKeyLink"), url: "https://www.arliai.com/docs/api?lang=en" }
      : localProvider === "image_generation" && selectedImageService === "venice"
        ? { label: "Get your Venice API key", url: "https://venice.ai/settings/api" }
        : localProvider === "image_generation" && selectedImageService === "zai"
          ? { label: t("connections.mediaSources.zai.apiKeyLink"), url: "https://z.ai/manage-apikey/apikey-list" }
          : (localProvider === "image_generation" && selectedImageService === "atlas") ||
              (localProvider === "video_generation" && selectedVideoDefaultsService === "atlas")
            ? {
                label: t("connections.mediaSources.atlas.apiKeyLink"),
                url: "https://www.atlascloud.ai/user/api-keys",
              }
            : localProvider === "video_generation" && selectedVideoDefaultsService === "xai"
              ? API_KEY_LINKS.xai
              : localProvider === "video_generation" && selectedVideoDefaultsService === "openrouter"
                ? selectedVideoProvider === "nanogpt"
                  ? API_KEY_LINKS.nanogpt
                  : API_KEY_LINKS.openrouter
                : localProvider === "video_generation" && selectedVideoDefaultsService === "seedance"
                  ? { label: "Open Seedance API docs", url: "https://seedance2.ai/api-docs" }
                  : localProvider === "video_generation" &&
                      (selectedVideoProvider === "comfyui" || selectedVideoProvider === "swarmui")
                    ? undefined
                    : API_KEY_LINKS[localProvider];

  useEffect(() => {
    if (localProvider !== "image_generation" || !selectedImageDefaultsService) {
      localImageDefaultsRef.current = null;
      setLocalImageDefaults(null);
      return;
    }
    setLocalImageDefaults((current) => {
      const next =
        current?.service === selectedImageDefaultsService
          ? sanitizeImageGenerationProfile(current, selectedImageDefaultsService)
          : createDefaultImageGenerationProfile(selectedImageDefaultsService);
      localImageDefaultsRef.current = next;
      return next;
    });
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
    if (localProvider === "video_generation" && selectedVideoProvider === "nanogpt") return [];
    return MODEL_LISTS[localProvider] ?? [];
  }, [localProvider, selectedVideoProvider]);

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
    setRemoteLoras([]);
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
    if (swarmUiWorkflowError) {
      setSaveError(swarmUiWorkflowError);
      throw new Error(swarmUiWorkflowError);
    }
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
    const isAudioProvider = localProvider === "audio";
    const isMediaProvider = isImageProvider || isVideoProvider || isAudioProvider;
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
      maxRequestsPerMinute: localMaxRequestsPerMinute,
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
      comfyuiWorkflow:
        isImageProvider ||
        (isVideoProvider && (selectedVideoProvider === "comfyui" || selectedVideoProvider === "swarmui"))
          ? localComfyuiWorkflow || null
          : null,
      imageService: isImageProvider ? localImageGenerationSource || localImageService || null : null,
      imageEndpointId:
        isImageProvider && selectedImageService === "runpod_comfyui" ? localImageEndpointId || null : null,
      imagePromptInstructions: isImageProvider ? normalizeImagePromptInstructions(localImagePromptInstructions) : null,
      imageGenerationQuality: isImageProvider ? localImageGenerationQuality : "auto",
      videoGenerationSource: isVideoProvider ? selectedVideoProvider || null : null,
      videoService: isVideoProvider
        ? selectedVideoProvider === "swarmui"
          ? "swarmui"
          : selectedVideoDefaultsService
        : null,
      maxTokensOverride: localMaxTokensOverride ?? null,
      claudeFastMode: localClaudeFastMode,
      treatAsLocalEndpoint: canTreatAsLocalEndpoint ? localTreatAsLocalEndpoint : false,
      audioSource: isAudioProvider ? localAudioSource || null : null,
      audioVoice: isAudioProvider ? localAudioVoice || null : null,
      // Only ElevenLabs can generate game sound effects / music today.
      audioSoundEffects: isAudioProvider && localAudioSource === "elevenlabs" ? localAudioSoundEffects : false,
      audioMusic: isAudioProvider && localAudioSource === "elevenlabs" ? localAudioMusic : false,
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
      // Persist media/default parameters first. The main connection save runs
      // last so its query refresh cannot race in an older defaults snapshot.
      if (!isMediaProvider) {
        await saveConnectionDefaults.mutateAsync({
          id: connectionDetailId,
          params: localDefaultParametersEnabled
            ? buildLanguageDefaultParameters(
                localDefaultParameters,
                localImageCaptioningEnabled,
                localImageCaptioningConnectionId,
              )
            : null,
        });
      } else if (isImageProvider) {
        const nextImageDefaults =
          selectedImageDefaultsService && localImageDefaultsRef.current
            ? sanitizeImageGenerationProfile(localImageDefaultsRef.current, selectedImageDefaultsService)
            : null;
        await saveConnectionDefaults.mutateAsync({
          id: connectionDetailId,
          params: buildImageDefaultParameters(
            (conn as Record<string, unknown> | null)?.defaultParameters,
            nextImageDefaults,
          ),
        });
      } else if (isVideoProvider) {
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
      await updateConnection.mutateAsync(payload as { id: string } & Record<string, unknown>);
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
    localMaxRequestsPerMinute,
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
    localImagePromptInstructions,
    localImageGenerationQuality,
    localMaxTokensOverride,
    localClaudeFastMode,
    localTreatAsLocalEndpoint,
    localDefaultParametersEnabled,
    localDefaultParameters,
    localImageCaptioningEnabled,
    localImageCaptioningConnectionId,
    localAudioSource,
    localAudioVoice,
    localAudioSoundEffects,
    localAudioMusic,
    selectedImageService,
    swarmUiWorkflowError,
    selectedImageDefaultsService,
    selectedVideoProvider,
    selectedVideoDefaultsService,
    localVideoDefaults,
    updateConnection,
    saveConnectionDefaults,
    conn,
  ]);

  const handleDelete = useCallback(async () => {
    if (!connectionDetailId) return;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.connections.connectioneditor.deleteConnection_bb12f0e"),
        message: localizeUi("dialog.delete.namedPermanent", {
          name: conn?.name || localizeUi("ui.connections.connectioneditor.connection"),
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }
    deleteConnection.mutate(connectionDetailId, { onSuccess: () => closeConnectionDetail() });
  }, [closeConnectionDetail, conn?.name, connectionDetailId, deleteConnection, localizeUi]);

  const handleExportConnection = useCallback(async () => {
    if (!conn) return;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.connections.connectioneditor.exportConnectionData"),
      message: CONNECTION_EXPORT_WARNING,
      confirmLabel: localizeUi("ui.characters.spritestab.export"),
      cancelLabel: "Close",
    });
    if (!confirmed) return;

    const currentConnection = conn as Record<string, unknown>;
    const isImageProvider = localProvider === "image_generation";
    const isVideoProvider = localProvider === "video_generation";
    const isAudioProvider = localProvider === "audio";
    const isMediaProvider = isImageProvider || isVideoProvider || isAudioProvider;
    const isLocalAuthProvider = isLocalAuthConnectionProvider(localProvider);
    const defaultParameters = isImageProvider
      ? buildImageDefaultParameters(
          currentConnection.defaultParameters,
          selectedImageDefaultsService && localImageDefaultsRef.current
            ? sanitizeImageGenerationProfile(localImageDefaultsRef.current, selectedImageDefaultsService)
            : null,
        )
      : isVideoProvider
        ? buildVideoDefaultParameters(
            currentConnection.defaultParameters,
            localVideoDefaults
              ? sanitizeVideoGenerationProfile({ ...localVideoDefaults, service: selectedVideoDefaultsService })
              : null,
          )
        : isAudioProvider
          ? null
          : localDefaultParametersEnabled
            ? buildLanguageDefaultParameters(
                localDefaultParameters,
                localImageCaptioningEnabled,
                localImageCaptioningConnectionId,
              )
            : null;
    const imageService = isImageProvider ? localImageGenerationSource || localImageService || null : null;
    const videoProvider = isVideoProvider ? selectedVideoProvider || null : null;
    const videoService = isVideoProvider
      ? videoProvider === "swarmui"
        ? "swarmui"
        : selectedVideoDefaultsService
      : null;
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
      maxRequestsPerMinute: localMaxRequestsPerMinute,
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
      audioSource: isAudioProvider ? localAudioSource || null : null,
      audioVoice: isAudioProvider ? localAudioVoice || null : null,
      audioSoundEffects: isAudioProvider && localAudioSource === "elevenlabs" ? localAudioSoundEffects : false,
      audioMusic: isAudioProvider && localAudioSource === "elevenlabs" ? localAudioMusic : false,
      imageEndpointId:
        isImageProvider && selectedImageService === "runpod_comfyui" ? localImageEndpointId || null : null,
      imagePromptInstructions: isImageProvider ? normalizeImagePromptInstructions(localImagePromptInstructions) : null,
      imageGenerationQuality: isImageProvider ? localImageGenerationQuality : "auto",
      comfyuiWorkflow:
        isImageProvider || (isVideoProvider && (videoProvider === "comfyui" || videoProvider === "swarmui"))
          ? localComfyuiWorkflow || null
          : null,
      claudeFastMode: localClaudeFastMode,
    };

    downloadJsonFile(
      createConnectionExportEnvelope([exportRow]),
      `${sanitizeExportFilenamePart(localName || String(currentConnection.name ?? ""), "connection")}.connection.json`,
    );
    toast.success(
      localizeUi("ui.connections.connectioneditor.exportedValue1", {
        value1: localName || localizeUi("ui.connections.connectioneditor.connection"),
      }),
    );
  }, [
    conn,
    localProvider,
    localName,
    localBaseUrl,
    localModel,
    localMaxContext,
    localMaxTokensOverride,
    localMaxParallelJobs,
    localMaxRequestsPerMinute,
    localTreatAsLocalEndpoint,
    localPromptPresetId,
    localDefaultParametersEnabled,
    localDefaultParameters,
    localImageCaptioningEnabled,
    localImageCaptioningConnectionId,
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
    localImagePromptInstructions,
    localImageGenerationQuality,
    localComfyuiWorkflow,
    localClaudeFastMode,
    selectedImageDefaultsService,
    selectedVideoDefaultsService,
    localVideoDefaults,
    localizeUi,
    localAudioSource,
    localAudioVoice,
    localAudioSoundEffects,
    localAudioMusic,
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
        const result = data as { models: RemoteConnectionModel[]; loras?: RemoteConnectionModel[] };
        setRemoteModels(result.models);
        setRemoteLoras(result.loras ?? []);
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
  const isAudioProvider = localProvider === "audio";
  const isMediaGenerationProvider = isImageGenerationProvider || isVideoGenerationProvider || isAudioProvider;
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
        <p className="mari-editor-empty px-4 py-3 text-sm">
          {localizeUi("ui.connections.connectioneditor.connectionNotFound")}
        </p>
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
          placeholder={localizeUi("ui.connections.connectioneditor.connectionName")}
        />
        <div className="mari-editor-actions flex shrink-0">
          {saveError && (
            <span className="mari-editor-status mr-2 text-red-400">
              <AlertCircle size="0.6875rem" />{" "}
              <span className="max-md:hidden">{localizeUi("ui.connections.connectioneditor.saveFailed")}</span>
            </span>
          )}
          {savedFlash && !dirty && (
            <span className="mari-editor-status mr-2 text-emerald-400">
              <Check size="0.6875rem" />{" "}
              <span className="max-md:hidden">{localizeUi("chat.settings.inlineEditor.saved")}</span>
            </span>
          )}
          {dirty && !saveError && (
            <span className="mari-editor-status mr-2 text-amber-400 max-md:hidden">
              {localizeUi("ui.connections.connectioneditor.unsaved")}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={updateConnection.isPending || saveConnectionDefaults.isPending || !!swarmUiWorkflowError}
            className="mari-editor-action mari-editor-action--primary inline-flex disabled:opacity-50"
          >
            <Save size="0.8125rem" /> <span className="max-md:hidden">{localizeUi("ui.noodle.noodlehome.save")}</span>
          </button>
          <button
            onClick={handleExportConnection}
            className="mari-editor-action inline-flex"
            title={localizeUi("ui.connections.connectioneditor.exportConnection")}
            aria-label={localizeUi("ui.connections.connectioneditor.exportConnection")}
          >
            <Upload size="0.9375rem" />
          </button>
          <button
            onClick={handleDelete}
            className="mari-editor-action inline-flex"
            title={localizeUi("ui.connections.connectioneditor.deleteConnection")}
            aria-label={localizeUi("ui.connections.connectioneditor.deleteConnection")}
          >
            <Trash2 size="0.9375rem" />
          </button>
        </div>
      </div>

      {/* Unsaved warning */}
      {showUnsavedWarning && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
          <span>{localizeUi("ui.connections.connectioneditor.youHaveUnsavedChanges")}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUnsavedWarning(false)}
              className="mari-editor-action mari-editor-action--compact inline-flex rounded-lg px-3 py-1"
            >
              {localizeUi("ui.connections.connectioneditor.keepEditing")}
            </button>
            <button
              onClick={() => closeConnectionDetail()}
              className="mari-editor-action mari-editor-action--accent mari-editor-action--compact inline-flex rounded-lg px-3 py-1"
            >
              {localizeUi("ui.connections.connectioneditor.discard")}
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
              className="mari-editor-action mari-editor-action--primary mari-editor-action--compact inline-flex rounded-lg px-3 py-1"
            >
              {localizeUi("ui.connections.connectioneditor.saveClose")}
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
            label={localizeUi("ui.connections.connectioneditor.connectionName_669ca65")}
            icon={<Tag size="0.875rem" className="text-sky-400" />}
            help={localizeUi("ui.connections.connectioneditor.aFriendlyNameToIdentifyThisConnectionUseSomething")}
          >
            <input
              value={localName}
              onChange={(e) => {
                setLocalName(e.target.value);
                markDirty();
              }}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder={localizeUi("ui.connections.connectioneditor.eGClaudeSonnetRp")}
            />
          </FieldGroup>

          {/* ── Provider ── */}
          <FieldGroup
            label={localizeUi("ui.connections.connectioneditor.provider")}
            icon={<Globe size="0.875rem" className="text-sky-400" />}
            help={localizeUi("ui.connections.connectioneditor.theAiServiceYouWantToConnectToEach")}
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
                    if (key === "audio") {
                      // The provider tile seeds ElevenLabs base URL/model, so
                      // the audio source must reset to match — otherwise a
                      // pockettts/openai/xai source survives the switch under
                      // ElevenLabs endpoints and saves a self-inconsistent row.
                      setLocalAudioSource("elevenlabs");
                      setLocalAudioVoice("");
                      setLocalAudioSoundEffects(false);
                      setLocalAudioMusic(false);
                    }
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
                  {localizeUi("ui.connections.connectioneditor.routesChatThroughYourLocal")}{" "}
                  <strong>{localizeUi("ui.connections.connectioneditor.claudeCode")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.installSoItBillsAgainstYourAnthropic")}{" "}
                  <strong>{localizeUi("ui.connections.connectioneditor.proMax")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.subscriptionInsteadOfAnApiKeyPrerequisitesOnThe")}
                </span>
              </p>
              <ol className="mt-1.5 ml-4 list-decimal space-y-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                <li>
                  {localizeUi("ui.connections.connectioneditor.installClaudeCode")}{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">{"npm i -g @anthropic-ai/claude-code"}</code>
                </li>
                <li>
                  {localizeUi("ui.connections.connectioneditor.signInOnce")}{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">{"claude login"}</code>
                </li>
                <li>{localizeUi("ui.connections.connectioneditor.apiKeyAndBaseUrlAreNotRequiredFor")}</li>
              </ol>
              <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.connections.connectioneditor.subscriptionAuthIsTheSameMechanismVisualStudioCode")}
              </p>
            </div>
          )}

          {/* ── OpenAI (ChatGPT) — prerequisites notice ── */}
          {isOpenAIChatGPTProvider && (
            <div className="rounded-xl bg-sky-400/5 px-3 py-2.5 ring-1 ring-sky-400/30">
              <p className="flex items-start gap-1.5 text-[0.6875rem] text-sky-300">
                <AlertCircle size="0.75rem" className="mt-px shrink-0" />
                <span>
                  {localizeUi("ui.connections.connectioneditor.routesChatThroughYourLocal")}{" "}
                  <strong>{localizeUi("ui.connections.connectioneditor.codexChatgpt")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.loginSoItUsesYourChatgptAccountInsteadOf")}
                </span>
              </p>
              <ol className="mt-1.5 ml-4 list-decimal space-y-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                <li>
                  {localizeUi("ui.connections.connectioneditor.installCodexCli")}{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">{"npm i -g @openai/codex"}</code>
                </li>
                <li>
                  {localizeUi("ui.connections.connectioneditor.signInOnce")}{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">{"codex login"}</code>
                </li>
                <li>{localizeUi("ui.connections.connectioneditor.apiKeyAndBaseUrlAreNotRequiredFor")}</li>
              </ol>
              <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.connections.connectioneditor.marinaraReadsTheLocalCodexAuthFileAndRefreshes")}
              </p>
            </div>
          )}

          {/* ── Grok CLI (Subscription) — prerequisites notice ── */}
          {isGrokSubscriptionProvider && (
            <div className="rounded-xl bg-sky-400/5 px-3 py-2.5 ring-1 ring-sky-400/30">
              <p className="flex items-start gap-1.5 text-[0.6875rem] text-sky-300">
                <AlertCircle size="0.75rem" className="mt-px shrink-0" />
                <span>
                  {localizeUi("ui.connections.connectioneditor.routesChatThroughYourLocal")}{" "}
                  <strong>{localizeUi("ui.connections.connectioneditor.grokCli")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.installSoItUsesYourSignedIn")}{" "}
                  <strong>{localizeUi("ui.connections.connectioneditor.supergrokXPremium")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.accountInsteadOfAnXaiApiKeyPrerequisitesOn")}
                </span>
              </p>
              <ol className="mt-1.5 ml-4 list-decimal space-y-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                <li>
                  {localizeUi("ui.connections.connectioneditor.installGrokCli")}{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">
                    {"curl -fsSL https://x.ai/cli/install.sh | bash"}
                  </code>
                </li>
                <li>
                  {localizeUi("ui.connections.connectioneditor.signInOnce")}{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">{"grok login"}</code>
                </li>
                <li>{localizeUi("ui.connections.connectioneditor.apiKeyAndBaseUrlAreNotRequiredFor")}</li>
              </ol>
              <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.connections.connectioneditor.marinaraRuns")}{" "}
                <code className="rounded bg-[var(--secondary)] px-1">{"grok"}</code>{" "}
                {localizeUi("ui.connections.connectioneditor.headlesslyWithGrokSideToolsMemoryWebSearchPlans")}{" "}
                <code className="rounded bg-[var(--secondary)] px-1">{"grok-composer-2.5-fast"}</code>
                {localizeUi("ui.connections.connectioneditor.leaveTheModelBlankToUseTheCliDefault")}
              </p>
            </div>
          )}

          {localProvider === "google_vertex" && (
            <div className="rounded-xl bg-sky-400/5 px-3 py-2.5 ring-1 ring-sky-400/30">
              <p className="flex items-start gap-1.5 text-[0.6875rem] text-sky-300">
                <AlertCircle size="0.75rem" className="mt-px shrink-0" />
                <span>{localizeUi("ui.connections.connectioneditor.usesVertexAiSGeminiEndpointSetBaseUrl")}</span>
              </p>
              <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.connections.connectioneditor.exampleBaseUrl")}{" "}
                <code className="rounded bg-[var(--secondary)] px-1">
                  {"https://us-central1-aiplatform.googleapis.com/v1/projects/my-project/locations/us-central1"}
                </code>
              </p>
            </div>
          )}

          {/* ── OpenRouter Provider Preference ── */}
          {localProvider === "openrouter" && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.preferredProvider")}
              icon={<Server size="0.875rem" className="text-sky-400" />}
              help={localizeUi(
                "ui.connections.connectioneditor.chooseWhichBackendProviderOpenrouterShouldRouteYourRequests",
              )}
            >
              <input
                value={localOpenrouterProvider}
                onChange={(e) => {
                  setLocalOpenrouterProvider(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                placeholder={localizeUi("ui.connections.connectioneditor.eGAnthropicGoogleAmazonBedrock")}
              />
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.connections.connectioneditor.forcesOpenrouterToRouteThroughASpecificProviderThe")}{" "}
                <a
                  href="https://openrouter.ai/models"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline"
                >
                  {localizeUi("ui.connections.connectioneditor.openrouterAiModels")}
                </a>
                {localizeUi("ui.connections.connectioneditor.leaveEmptyForAutomaticRouting")}
              </p>
            </FieldGroup>
          )}

          {!isLocalAuthProvider && (
            <>
              {/* ── API Key ── */}
              <FieldGroup
                label={localizeUi("ui.connections.connectioneditor.apiKey")}
                icon={<Key size="0.875rem" className="text-sky-400" />}
                help={localizeUi("ui.connections.connectioneditor.yourAuthenticationKeyFromTheAiProviderYouCan")}
              >
                <input
                  value={localApiKey}
                  onChange={(e) => {
                    setLocalApiKey(e.target.value);
                    markDirty();
                  }}
                  type="password"
                  className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  placeholder={localizeUi("ui.connections.connectioneditor.leaveEmptyToKeepExistingKey")}
                />
                <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.connections.connectioneditor.yourKeyIsEncryptedAtRestLeaveBlankWhen")}
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
                    {localizeUi("ui.connections.connectioneditor.forLocalModelsOllamaLmStudioKoboldcppEtcYou")}
                  </p>
                )}
              </FieldGroup>

              {/* ── Base URL ── */}
              <FieldGroup
                label={localizeUi("ui.connections.connectioneditor.baseUrl")}
                icon={<Globe size="0.875rem" className="text-sky-400" />}
                help={localizeUi("ui.connections.connectioneditor.theApiEndpointUrlUsuallyAutoFilledForKnown")}
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
                    {localizeUi("ui.connections.connectioneditor.default")} {providerDef.defaultBaseUrl}
                  </p>
                )}
                {baseUrlValidation.error && (
                  <p className="mt-1 text-[0.625rem] text-[var(--destructive)]">{baseUrlValidation.error}</p>
                )}
                {!baseUrlValidation.error && baseUrlValidation.value !== localBaseUrl.trim() && (
                  <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.connections.connectioneditor.willSaveAs")} {baseUrlValidation.value}
                  </p>
                )}
                {localProvider === "custom" && (
                  <p className="mt-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.connections.connectioneditor.localModelExamplesOllama")}{" "}
                    <code className="rounded bg-[var(--secondary)] px-1">{"http://localhost:11434/v1"}</code>{" "}
                    {localizeUi("ui.connections.connectioneditor.lmStudio")}{" "}
                    <code className="rounded bg-[var(--secondary)] px-1">{"http://localhost:1234/v1"}</code>{" "}
                    {localizeUi("ui.connections.connectioneditor.koboldcpp")}{" "}
                    <code className="rounded bg-[var(--secondary)] px-1">{"http://localhost:5001/v1"}</code>
                  </p>
                )}
                <p className="mt-1.5 flex items-start gap-1 text-[0.625rem] text-amber-400/80">
                  <AlertCircle size="0.625rem" className="mt-px shrink-0" />
                  <span>
                    {localizeUi("ui.connections.connectioneditor.onlyUseUrlsFromProvidersYouTrustAMalicious")}
                  </span>
                </p>
                {localProvider === "custom" && (
                  <p className="mt-1.5 flex items-start gap-1 text-[0.625rem] text-sky-400/80">
                    <AlertCircle size="0.625rem" className="mt-px shrink-0" />
                    <span>
                      <strong>{localizeUi("ui.connections.connectioneditor.windowsUsers")}</strong>{" "}
                      {localizeUi("ui.connections.connectioneditor.ifYourProxyOrLocalServerIsnTDetected")}{" "}
                      <em>
                        {localizeUi(
                          "ui.connections.connectioneditor.windowsSecurityFirewallNetworkProtectionAllowAnAppThrough",
                        )}
                      </em>{" "}
                      {localizeUi("ui.connections.connectioneditor.andAddNodeJsOrYourProxyApplication")}
                    </span>
                  </p>
                )}
              </FieldGroup>
            </>
          )}

          {/* ── Image Service (only for image_generation provider) ── */}
          {localProvider === "image_generation" && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.service")}
              icon={<Globe size="0.875rem" className="text-sky-400" />}
              help={localizeUi("ui.connections.connectioneditor.pickTheBackendTypeOnceThenPointBaseUrl")}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {IMAGE_GENERATION_SOURCES.map((src) => {
                  const isActive = selectedImageService === src.id;
                  const sourceName =
                    src.id === "atlas"
                      ? t("connections.mediaSources.atlas.name")
                      : src.id === "swarmui"
                        ? t("connections.mediaSources.swarmui.name")
                        : src.id === "zai"
                          ? t("connections.mediaSources.zai.name")
                          : src.id === "arli"
                            ? t("connections.mediaSources.arli.name")
                            : src.name;
                  const sourceDescription =
                    src.id === "atlas"
                      ? t("connections.mediaSources.atlas.imageDescription")
                      : src.id === "swarmui"
                        ? t("connections.mediaSources.swarmui.imageDescription")
                        : src.id === "zai"
                          ? t("connections.mediaSources.zai.imageDescription")
                          : src.id === "arli"
                            ? t("connections.mediaSources.arli.imageDescription")
                            : src.description;
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
                        if (src.id === "zai" && !ZAI_IMAGE_MODELS.some((model) => model.id === localModel.trim())) {
                          setLocalModel("glm-image");
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
                        <span className="font-medium">{sourceName}</span>
                        {isActive && <Check size="0.625rem" />}
                      </div>
                      <span className="text-[0.5625rem] opacity-70">{sourceDescription}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.connections.connectioneditor.pickTheBackendTypeOnceThenPointBaseUrl_cfb1337")}
              </p>
              {selectedImageService === "runpod_comfyui" && (
                <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[0.625rem] text-amber-300/80">
                  <strong>{localizeUi("ui.connections.connectioneditor.runpodConfiguration")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.yourEndpointIdGoesInThe")}{" "}
                  <strong>{localizeUi("ui.connections.connectioneditor.endpointId")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.fieldBelowTheApiKeyIsYourRunpodApi")}{" "}
                  <strong>{localizeUi("ui.connections.connectioneditor.required")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.theEndpointExecutesTheWorkflowYouSupplyUse")}{" "}
                  <code>{"%prompt%"}</code>{" "}
                  {localizeUi("ui.connections.connectioneditor.placeholdersInTheCliptextencodeNode")}
                </div>
              )}
              {selectedImageService === "swarmui" && (
                <p className="mt-2 text-[0.625rem] text-[var(--muted-foreground)]">
                  {t("connections.mediaSources.swarmui.authHelp")}
                </p>
              )}
            </FieldGroup>
          )}

          {localProvider === "video_generation" && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.videoService")}
              icon={<Film size="0.875rem" className="text-sky-400" />}
              help={localizeUi("ui.connections.connectioneditor.pickTheVideoBackendGameModeUsesThisService")}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {VIDEO_GENERATION_SOURCES.map((src) => {
                  const isActive = selectedVideoProvider === src.id;
                  const sourceName =
                    src.id === "atlas"
                      ? t("connections.mediaSources.atlas.name")
                      : src.id === "swarmui"
                        ? t("connections.mediaSources.swarmui.name")
                        : src.name;
                  const sourceDescription =
                    src.id === "atlas"
                      ? t("connections.mediaSources.atlas.videoDescription")
                      : src.id === "swarmui"
                        ? t("connections.mediaSources.swarmui.videoDescription")
                        : src.description;
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
                        <span className="font-medium">{sourceName}</span>
                        {isActive && <Check size="0.625rem" />}
                      </div>
                      <span className="text-[0.5625rem] opacity-70">{sourceDescription}</span>
                    </button>
                  );
                })}
              </div>
              {selectedVideoProvider === "swarmui" && (
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {t("connections.mediaSources.swarmui.authHelp")}
                </p>
              )}
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.connections.connectioneditor.sceneVideosAreGeneratedFromTheCurrentGameIllustration")}
              </p>
            </FieldGroup>
          )}

          {/* ── Audio Source (only for audio provider) ── */}
          {isAudioProvider && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.audioSource")}
              icon={<Music size="0.875rem" className="text-sky-400" />}
              help={localizeUi("ui.connections.connectioneditor.pickTheSpeechBackendBaseUrlModelAndVoice")}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {AUDIO_SOURCE_OPTIONS.map((src) => {
                  const isActive = localAudioSource === src.id;
                  return (
                    <button
                      key={src.id}
                      onClick={() => {
                        if (localAudioSource === src.id) return;
                        const previousSource = AUDIO_SOURCE_OPTIONS.find(
                          (candidate) => candidate.id === localAudioSource,
                        );
                        if (!localBaseUrl || localBaseUrl === previousSource?.defaultBaseUrl) {
                          setLocalBaseUrl(src.defaultBaseUrl);
                        }
                        if (!localModel || localModel === previousSource?.defaultModel) {
                          setLocalModel(src.defaultModel);
                        }
                        if (!localAudioVoice || localAudioVoice === previousSource?.defaultVoice) {
                          setLocalAudioVoice(src.defaultVoice);
                        }
                        setLocalAudioSource(src.id);
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
                      <span className="text-[0.625rem] opacity-80">
                        {src.id === "elevenlabs"
                          ? localizeUi("ui.connections.connectioneditor.speechSoundEffectsAndMusicGeneration")
                          : src.id === "openai"
                            ? localizeUi("ui.connections.connectioneditor.openaiOrAnyCompatibleAudioSpeechEndpoint")
                            : src.id === "pockettts"
                              ? localizeUi("ui.connections.connectioneditor.localPocketttsServerFreePrivateOffline")
                              : localizeUi("ui.connections.connectioneditor.xaiGrokVoiceSynthesis")}
                      </span>
                    </button>
                  );
                })}
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">
                  {localizeUi("ui.connections.connectioneditor.defaultVoice")}
                </span>
                <input
                  value={localAudioVoice}
                  onChange={(event) => {
                    setLocalAudioVoice(event.target.value);
                    markDirty();
                  }}
                  className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  placeholder={
                    AUDIO_SOURCE_OPTIONS.find((candidate) => candidate.id === localAudioSource)?.defaultVoice ||
                    localizeUi("ui.connections.connectioneditor.eGAVoiceIdFromYourProvider")
                  }
                />
                <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                  {localizeUi("ui.connections.connectioneditor.voiceIdOrNameUsedWhenNothingMoreSpecific")}
                </p>
              </label>
              {localAudioSource === "elevenlabs" ? (
                <div className="space-y-2">
                  <SettingsSwitch
                    label={localizeUi("ui.connections.connectioneditor.gameSoundEffects")}
                    description={localizeUi(
                      "ui.connections.connectioneditor.letGameModeGenerateSoundEffectsWithThisConnection",
                    )}
                    checked={localAudioSoundEffects}
                    onChange={(checked) => {
                      setLocalAudioSoundEffects(checked);
                      markDirty();
                    }}
                  />
                  <SettingsSwitch
                    label={localizeUi("ui.connections.connectioneditor.gameMusic")}
                    description={localizeUi(
                      "ui.connections.connectioneditor.letGameModeGenerateMusicWithThisConnection",
                    )}
                    checked={localAudioMusic}
                    onChange={(checked) => {
                      setLocalAudioMusic(checked);
                      markDirty();
                    }}
                  />
                </div>
              ) : (
                <p className="rounded-xl bg-[var(--secondary)]/40 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  {localizeUi(
                    "ui.connections.connectioneditor.soundEffectAndMusicGenerationCurrentlyRequiresTheElevenlabs",
                  )}
                </p>
              )}
            </FieldGroup>
          )}

          {/* ── Model Selection ── */}
          <FieldGroup
            label={localizeUi("ui.connections.connectioneditor.model")}
            icon={<Server size="0.875rem" className="text-sky-400" />}
            help={localizeUi("ui.connections.connectioneditor.theSpecificAiModelToUseYouCanPick")}
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
                    placeholder={localizeUi("ui.connections.connectioneditor.searchModels")}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={cn("flex-1 text-sm", !localModel && "text-[var(--muted-foreground)]")}>
                    {localModel
                      ? selectedModelInfo
                        ? localizeUi("ui.connections.connectioneditor.value1Value2", {
                            value1: selectedModelInfo.name,
                            value2: selectedModelInfo.id,
                          })
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
                      {fetchModels.isPending
                        ? localizeUi("ui.connections.connectioneditor.fetching")
                        : modelFetchButtonLabel}
                    </button>
                    {fetchError && (
                      <p className="mt-1.5 text-[0.625rem] text-[var(--marinara-editor-accent)]">{fetchError}</p>
                    )}
                    {remoteModels.length > 0 && !fetchError && (
                      <p className="mt-1 text-[0.625rem] text-emerald-400">
                        {remoteModels.length} {localizeUi("ui.connections.connectioneditor.model_1d06a0d")}
                        {remoteModels.length !== 1 ? localizeUi("ui.noodle.stageprofileview.s") : ""}{" "}
                        {localizeUi("ui.connections.connectioneditor.availableFrom")} {modelFetchSourceLabel}
                      </p>
                    )}
                  </div>

                  {localProvider === "custom" ? (
                    <div className="p-3">
                      <p className="mb-2 text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.connections.connectioneditor.customEndpointsTypeTheModelIdOrFetchFrom")}
                      </p>
                      <input
                        value={localModel}
                        onChange={(e) => handleManualModelChange(e.target.value)}
                        className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
                        placeholder={localizeUi("ui.connections.connectioneditor.modelNameOrPath")}
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
                        {localizeUi("lorebook.editor.batch.done")}
                      </button>
                    </div>
                  ) : filteredModels.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[var(--muted-foreground)]">
                      {localizeUi("ui.connections.connectioneditor.noModelsFoundTryADifferentSearchOrType")}
                      <input
                        value={localModel}
                        onChange={(e) => handleManualModelChange(e.target.value)}
                        className="mt-2 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
                        placeholder={localizeUi("ui.connections.connectioneditor.customModelId")}
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
                              {formatContext(m.maxOutput)} {localizeUi("ui.connections.connectioneditor.out")}
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
                      ? localizeUi("ui.connections.connectioneditor.optionalTypeAGrokCliModelIdOrLeave")
                      : localizeUi("ui.connections.connectioneditor.orTypeModelIdDirectly")
                  }
                />
              </div>
            )}

            {/* Context display */}
            {selectedModelInfo && (
              <div className="mt-2 flex items-center gap-4 rounded-lg bg-sky-400/5 px-3 py-2 text-[0.6875rem]">
                <span className="text-[var(--muted-foreground)]">
                  {localizeUi("ui.connections.connectioneditor.context")}{" "}
                  <strong className="text-sky-400">{formatContext(selectedModelInfo.context)}</strong>
                </span>
                <span className="text-[var(--muted-foreground)]">
                  {localizeUi("ui.connections.connectioneditor.maxOutput")}{" "}
                  <strong className="text-sky-400">{formatContext(selectedModelInfo.maxOutput)}</strong>
                </span>
              </div>
            )}
          </FieldGroup>

          {/* ── RunPod Endpoint ID ── */}
          {localProvider === "image_generation" && selectedImageService === "runpod_comfyui" && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.runpodEndpointId")}
              icon={<Server size="0.875rem" className="text-sky-400" />}
              help={localizeUi("ui.connections.connectioneditor.yourRunpodServerlessEndpointIdEGAbc123def456This")}
            >
              <input
                type="text"
                value={localImageEndpointId}
                onChange={(e) => {
                  setLocalImageEndpointId(e.target.value);
                  markDirty();
                }}
                placeholder={localizeUi("ui.connections.connectioneditor.abc123def456")}
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm outline-none ring-1 ring-[var(--border)] transition-shadow placeholder:text-[var(--muted-foreground)]/50 focus:ring-sky-400/50"
              />
            </FieldGroup>
          )}

          {/* ── ComfyUI Workflow ── */}
          {usesComfyUiWorkflow && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.comfyuiWorkflowValue1", {
                value1:
                  localProvider === "video_generation" || selectedImageService === "runpod_comfyui"
                    ? localizeUi("ui.agents.tooleditor.required")
                    : localizeUi("ui.connections.connectioneditor.optional"),
              })}
              icon={<Zap size="0.875rem" className="text-sky-400" />}
              help={
                localProvider === "video_generation"
                  ? selectedVideoProvider === "swarmui"
                    ? t("connections.mediaSources.swarmui.videoWorkflowHelp")
                    : localizeUi("ui.connections.connectioneditor.pasteAComfyuiVideoWorkflowInApiFormatUse")
                  : selectedImageService === "runpod_comfyui"
                    ? localizeUi("ui.connections.connectioneditor.pasteYourComfyuiWorkflowJsonApiFormatRunpodNeeds")
                    : selectedImageService === "swarmui"
                      ? localizeUi("ui.connections.connectioneditor.pasteAComfyuiWorkflowForSwarmui")
                      : localizeUi("ui.connections.connectioneditor.pasteACustomComfyuiWorkflowJsonApiFormatUse")
              }
            >
              <textarea
                ref={comfyWorkflowTextareaRef}
                value={localComfyuiWorkflow}
                onChange={(e) => {
                  setLocalComfyuiWorkflow(e.target.value);
                  markDirty();
                }}
                placeholder={localizeUi(
                  "ui.connections.connectioneditor.pasteWorkflowJsonHereExportedFromComfyuiViaSave",
                )}
                className={cn(
                  "w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-mono outline-none ring-1 transition-shadow placeholder:text-[var(--muted-foreground)]/50 min-h-[120px] max-h-[300px] resize-y",
                  comfyWorkflowValidation?.parseError || swarmUiWorkflowError
                    ? "ring-red-400/60 focus:ring-red-400"
                    : "ring-[var(--border)] focus:ring-sky-400/50",
                )}
              />
              {swarmUiWorkflowError && (
                <p className="mt-1 flex items-start gap-1 text-[0.625rem] text-red-400">
                  <AlertCircle size="0.625rem" className="mt-px shrink-0" />
                  {swarmUiWorkflowError}
                </p>
              )}
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
                          <strong>{localizeUi("ui.connections.connectioneditor.prompt")}</strong>{" "}
                          {localizeUi("ui.connections.connectioneditor.placeholderNotFoundPromptsWonTBeInjected")}{" "}
                        </>
                      )}
                      {comfyWorkflowValidation.missing.some((m) => !m.critical) && (
                        <>
                          {localizeUi("ui.connections.connectioneditor.unused")}{" "}
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
                {localizeUi("ui.connections.connectioneditor.exportYourWorkflowFromComfyuiUsing")}{" "}
                <strong>{localizeUi("ui.connections.connectioneditor.saveApiFormat")}</strong>{" "}
                {localizeUi("ui.connections.connectioneditor.inTheMenu")}{" "}
                {localProvider === "video_generation" ? (
                  <>
                    {localizeUi("ui.connections.connectioneditor.useAVideoOutputNodeSuchAs")}{" "}
                    <strong>{localizeUi("ui.connections.connectioneditor.savevideo")}</strong>
                    {localizeUi("ui.connections.connectioneditor.marinaraDownloadsTheMp4ReportedInTheWorkflowS")}{" "}
                    <code>{"gifs"}</code> {localizeUi("ui.noodle.noodlehome.or")} <code>{"images"}</code>{" "}
                    {localizeUi("ui.connections.connectioneditor.output")}
                  </>
                ) : (
                  <>
                    {localizeUi("ui.connections.connectioneditor.placeholdersLike")} <code>{"%prompt%"}</code>,{" "}
                    <code>{"%steps%"}</code>, <code>{"%sampler%"}</code>
                    {localizeUi(
                      "ui.connections.connectioneditor.andReferenceImagePlaceholdersWillBeReplacedAtGeneration",
                    )}
                  </>
                )}
              </p>
            </FieldGroup>
          )}

          {localProvider === "image_generation" && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.imagePromptingInstructions")}
              icon={<Sparkles size="0.875rem" className="text-sky-400" />}
              help={localizeUi("ui.connections.connectioneditor.imagePromptingInstructionsHelp")}
            >
              <textarea
                value={localImagePromptInstructions}
                maxLength={MAX_IMAGE_PROMPT_INSTRUCTIONS_LENGTH}
                onChange={(event) => {
                  setLocalImagePromptInstructions(event.target.value);
                  markDirty();
                }}
                placeholder={localizeUi("ui.connections.connectioneditor.imagePromptingInstructionsPlaceholder")}
                className="w-full min-h-[96px] resize-y rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm outline-none ring-1 ring-[var(--border)] transition-shadow placeholder:text-[var(--muted-foreground)]/50 focus:ring-sky-400/50"
              />
            </FieldGroup>
          )}

          {supportsGptImageQuality && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.gptImageQuality")}
              icon={<Sparkles size="0.875rem" className="text-sky-400" />}
              help={localizeUi("ui.connections.connectioneditor.gptImageQualityHelp")}
            >
              <select
                value={localImageGenerationQuality}
                onChange={(event) => {
                  setLocalImageGenerationQuality(event.target.value as ImageGenerationQuality);
                  markDirty();
                }}
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-sky-400/50"
              >
                <option value="auto">{localizeUi("ui.connections.connectioneditor.imageQualityAuto")}</option>
                <option value="low">{localizeUi("ui.connections.connectioneditor.imageQualityLow")}</option>
                <option value="medium">{localizeUi("ui.connections.connectioneditor.imageQualityMedium")}</option>
                <option value="high">{localizeUi("ui.connections.connectioneditor.imageQualityHigh")}</option>
              </select>
            </FieldGroup>
          )}

          {localProvider === "image_generation" && selectedImageDefaultsService && localImageDefaults && (
            <ImageGenerationDefaultsPanel
              service={selectedImageDefaultsService}
              model={localModel}
              source={selectedImageService}
              value={localImageDefaults}
              styleProfiles={imageStyleProfiles}
              remoteLoras={remoteLoras}
              expanded={imageDefaultsExpanded}
              onExpandedChange={setImageDefaultsExpanded}
              onChange={(next) => {
                const current = localImageDefaultsRef.current;
                if (!current) return;
                const resolved = typeof next === "function" ? next(current) : next;
                const sanitized = sanitizeImageGenerationProfile(resolved, selectedImageDefaultsService);
                localImageDefaultsRef.current = sanitized;
                setLocalImageDefaults(sanitized);
                markDirty();
              }}
              onReset={() => {
                const defaults = createDefaultImageGenerationProfile(selectedImageDefaultsService);
                localImageDefaultsRef.current = defaults;
                setLocalImageDefaults(defaults);
                markDirty();
              }}
            />
          )}

          {localProvider === "video_generation" && localVideoDefaults && (
            <VideoGenerationDefaultsPanel
              value={localVideoDefaults}
              source={selectedVideoProvider}
              remoteLoras={remoteLoras}
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
              label={localizeUi("ui.connections.connectioneditor.maxContextWindow")}
              icon={<Zap size="0.875rem" className="text-sky-400" />}
              help={localizeUi("ui.connections.connectioneditor.theMaximumNumberOfTokensThisModelCanProcess")}
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
                <span className="text-xs text-[var(--muted-foreground)]">
                  {formatContext(localMaxContext)} {localizeUi("ui.connections.connectioneditor.tokens")}
                </span>
              </div>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                {isGrokSubscriptionProvider
                  ? localizeUi("ui.connections.connectioneditor.grokCliStartsAtASafer32kWindowBecause")
                  : localizeUi("ui.connections.connectioneditor.thisIsAutoSetWhenSelectingAModelFrom")}
              </p>
            </FieldGroup>
          )}

          {/* ── Max Output Tokens Override ── */}
          {!isMediaGenerationProvider && !isLocalAuthProvider && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.maxOutputTokensOverride")}
              icon={<Zap size="0.875rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />}
              help={localizeUi("ui.connections.connectioneditor.hardCapOnMaxTokensForTheApiResponse")}
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
                  {localMaxTokensOverride
                    ? localizeUi("ui.connections.connectioneditor.value1TokensMax", {
                        value1: localMaxTokensOverride.toLocaleString(),
                      })
                    : localizeUi("ui.connections.connectioneditor.noOverride")}
                </span>
              </div>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.connections.connectioneditor.setTo0OrLeaveEmptyToDisableWhen")}
              </p>
            </FieldGroup>
          )}

          {/* ── Agent Parallel Jobs ── */}
          {!isMediaGenerationProvider && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.maxParallelAgentJobs")}
              icon={
                <SlidersHorizontal size="0.875rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />
              }
              help={localizeUi("ui.connections.connectioneditor.howManyAgentLlmRequestsMarinaraMayRunAt")}
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
                  {localMaxParallelJobs === 1
                    ? localizeUi("ui.connections.connectioneditor.oneAgentJobAtATime")
                    : localizeUi("ui.connections.connectioneditor.value1AgentJobs", { value1: localMaxParallelJobs })}
                </span>
              </div>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.connections.connectioneditor.agentBatchesForTheSameConnectionCanBeSplit")}
              </p>
            </FieldGroup>
          )}

          {/* ── Rate Limit (requests per minute) ── */}
          {!isMediaGenerationProvider && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.maxRequestsPerMinute")}
              icon={
                <SlidersHorizontal size="0.875rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />
              }
              help={localizeUi("ui.connections.connectioneditor.maxRequestsPerMinuteHelp")}
            >
              <div className="flex items-center gap-3">
                <DraftNumberInput
                  value={localMaxRequestsPerMinute ?? 0}
                  ariaLabel={localizeUi("ui.connections.connectioneditor.maxRequestsPerMinute")}
                  min={0}
                  max={600}
                  selectOnFocus
                  onCommit={(nextValue) => {
                    setLocalMaxRequestsPerMinute(nextValue > 0 ? Math.floor(nextValue) : null);
                    markDirty();
                  }}
                  className="w-24 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <span className="text-xs text-[var(--muted-foreground)]">
                  {localMaxRequestsPerMinute === null
                    ? localizeUi("ui.connections.connectioneditor.requestsPerMinuteUnlimited")
                    : localizeUi("ui.connections.connectioneditor.value1RequestsPerMinute", {
                        value1: localMaxRequestsPerMinute,
                      })}
                </span>
              </div>
            </FieldGroup>
          )}

          {canTreatAsLocalEndpoint && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.localCustomEndpoint")}
              icon={<Server size="0.875rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />}
              help={localizeUi("ui.connections.connectioneditor.useThisForSelfHostedOrProxiedOpenaiCompatible")}
            >
              <SettingsSwitch
                label={localizeUi("ui.connections.connectioneditor.treatAsLocalCustomEndpoint")}
                checked={localTreatAsLocalEndpoint}
                onChange={(checked) => {
                  setLocalTreatAsLocalEndpoint(checked);
                  markDirty();
                }}
              />
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.connections.connectioneditor.enableThisIfProfessorMariStopsAfterToolUse")}
              </p>
            </FieldGroup>
          )}

          {/* ── Prompt Preset Override ── */}
          {!isMediaGenerationProvider && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.promptPresetOverride")}
              icon={<FileText size="0.875rem" className="mari-chrome-accent-icon mari-accent-animated" />}
              help={localizeUi(
                "ui.connections.connectioneditor.optionalWhenRoleplayChatsUseThisConnectionMarinaraAssembles",
              )}
            >
              <select
                value={localPromptPresetId}
                onChange={(e) => {
                  setLocalPromptPresetId(e.target.value);
                  markDirty();
                }}
                className="mari-preset-native-select w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                <option value="">{localizeUi("ui.connections.connectioneditor.useChatSPromptPreset")}</option>
                {(allPresets ?? []).map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.connections.connectioneditor.useThisForModelsThatNeedADifferentPrompt")}
              </p>
            </FieldGroup>
          )}

          {/* ── Default Chat Parameters ── */}
          {!isMediaGenerationProvider && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.defaultChatParameters")}
              icon={<Zap size="0.875rem" className="mari-chrome-accent-icon mari-accent-animated" />}
              help={localizeUi(
                "ui.connections.connectioneditor.defaultGenerationSettingsForChatsThatUseThisConnection",
              )}
            >
              <SettingsSwitch
                label={localizeUi("ui.connections.connectioneditor.useCustomDefaultsForThisConnection")}
                checked={localDefaultParametersEnabled}
                onChange={(checked) => {
                  setLocalDefaultParametersEnabled(checked);
                  markDirty();
                }}
              />

              {localDefaultParametersEnabled ? (
                <div className="rounded-xl bg-[var(--secondary)]/40 p-3 ring-1 ring-[var(--border)]">
                  <p className="mb-3 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                    {localizeUi("settings.customGenerationParameters.availabilityHint")}
                  </p>
                  <GenerationParametersFields
                    value={localDefaultParameters}
                    showOpenRouterServiceTier={localProvider === "openrouter"}
                    enabledParametersFallback={STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS}
                    onChange={(next) => {
                      setLocalDefaultParameters(next);
                      markDirty();
                    }}
                  />
                  <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                    <SettingsSwitch
                      label={localizeUi("ui.connections.connectioneditor.imageCaptioning")}
                      description={localizeUi(
                        "ui.connections.connectioneditor.describeImageAttachmentsBeforeSendingThemToTextOnlyModels",
                      )}
                      checked={localImageCaptioningEnabled}
                      onChange={(checked) => {
                        setLocalImageCaptioningEnabled(checked);
                        markDirty();
                      }}
                    />
                    {localImageCaptioningEnabled && (
                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[var(--muted-foreground)]">
                          {localizeUi("ui.connections.connectioneditor.captioningConnection")}
                        </span>
                        <select
                          value={localImageCaptioningConnectionId}
                          onChange={(event) => {
                            setLocalImageCaptioningConnectionId(event.target.value);
                            markDirty();
                          }}
                          className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        >
                          <option value="">{localizeUi("ui.connections.connectioneditor.useThisConnection")}</option>
                          {((allConnections ?? []) as Record<string, unknown>[])
                            .filter(
                              (connection) =>
                                connection.id !== connectionDetailId &&
                                connection.provider !== "image_generation" &&
                                connection.provider !== "video_generation" &&
                                connection.provider !== "audio",
                            )
                            .map((connection) => (
                              <option key={connection.id as string} value={connection.id as string}>
                                {connection.name as string}
                                {connection.model
                                  ? localizeUi("ui.connections.connectioneditor.value1", {
                                      value1: connection.model,
                                    })
                                  : ""}
                              </option>
                            ))}
                        </select>
                        <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                          {localizeUi(
                            "ui.connections.connectioneditor.chooseADifferentVisionCapableConnectionWhenThisModelCannotSeeImages",
                          )}
                        </p>
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                <p className="rounded-xl bg-[var(--secondary)]/40 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  {localizeUi("ui.connections.connectioneditor.thisConnectionIsUsingTheModeDefaultsFromConversation")}
                </p>
              )}
            </FieldGroup>
          )}

          {/* ── Prompt Caching (Anthropic + compatible OpenRouter models) ── */}
          {(localProvider === "anthropic" || localProvider === "openrouter") && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.promptCaching")}
              icon={<Zap size="0.875rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />}
              help={
                localProvider === "anthropic"
                  ? localizeUi(
                      "ui.connections.connectioneditor.enablesAnthropicPromptCachingWhichCachesYourSystemPrompt",
                    )
                  : localizeUi(
                      "ui.connections.connectioneditor.enablesExplicitPromptCachingForCompatibleOpenrouterModels",
                    )
              }
            >
              <SettingsSwitch
                label={localizeUi("ui.connections.connectioneditor.enablePromptCaching")}
                checked={localEnableCaching}
                onChange={(checked) => {
                  setLocalEnableCaching(checked);
                  if (!checked) setLocalAnthropicExtendedCacheTtl(false);
                  markDirty();
                }}
              />
              <p className="text-[0.625rem] text-[var(--muted-foreground)] px-2">
                {localProvider === "anthropic"
                  ? localizeUi("ui.connections.connectioneditor.cachesTheSystemPromptExplicitlyAndUsesAutomaticCaching")
                  : localizeUi(
                      "ui.connections.connectioneditor.onOpenrouterAddsCacheControlForModelsThatSupportExplicitCaching",
                    )}
              </p>
              {localProvider === "anthropic" && localEnableCaching && (
                <div className="mt-2 space-y-2">
                  <SettingsSwitch
                    label={localizeUi("ui.connections.connectioneditor.extendedTokenCaching1Hour")}
                    checked={localAnthropicExtendedCacheTtl}
                    onChange={(checked) => {
                      setLocalAnthropicExtendedCacheTtl(checked);
                      markDirty();
                    }}
                  />
                  <p className="px-2 text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.connections.connectioneditor.keepsAnthropicCacheEntriesAliveForOneHourInstead")}
                  </p>
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-[var(--secondary)]/40 px-3 py-2 ring-1 ring-[var(--border)]">
                    <div className="min-w-0">
                      <span className="block text-sm font-medium">
                        {localizeUi("ui.connections.connectioneditor.cacheDepth")}
                      </span>
                      <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.connections.connectioneditor.messagesBackFromTheNewestTurn")}
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

          {isVideoGenerationProvider && selectedVideoDefaultsService === "seedance" && localVideoDefaults && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.seedanceReferences")}
              icon={<Sparkles size="0.875rem" className="text-sky-400" />}
              help={localizeUi(
                "ui.connections.connectioneditor.controlsTemporaryReferenceFrameUploadsForSeedanceVideoGenerations",
              )}
            >
              <div className="mx-2 mt-2 space-y-2 rounded-lg bg-[var(--secondary)]/35 p-2 ring-1 ring-[var(--border)]">
                <SettingsSwitch
                  label={localizeUi("ui.connections.connectioneditor.uploadSeedanceReferenceFramesTemporarily")}
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
                  description={localizeUi(
                    "ui.connections.connectioneditor.usesTemporaryPublicLinksWhenSeedanceNeedsFirstLast",
                  )}
                  className="p-1"
                />
                {localVideoDefaults.seedance.temporaryPublicReferenceUploadEnabled && (
                  <label className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--card)]/70 px-2 py-1.5 ring-1 ring-[var(--border)]">
                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.connections.connectioneditor.temporaryLinkLifetime")}
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
                  {localizeUi("ui.connections.connectioneditor.keepThisOffIfYouDoNotWantLocal")}
                </p>
              </div>
            </FieldGroup>
          )}

          {/* ── Claude (Subscription) — Fast Mode toggle ── */}
          {isClaudeSubscriptionProvider && (
            <FieldGroup
              label={localizeUi("ui.connections.connectioneditor.fastMode")}
              icon={<Zap size="0.875rem" className="text-amber-400" />}
              help={localizeUi("ui.connections.connectioneditor.whenEnabledAsksTheClaudeAgentSdkToUse")}
            >
              <SettingsSwitch
                label={
                  <span className="font-medium text-[var(--foreground)]">
                    {localizeUi("ui.connections.connectioneditor.useClaudeCodeFastModeRouting")}
                  </span>
                }
                description={
                  <>
                    <span className="mt-0.5 block text-[var(--muted-foreground)]">
                      <strong className="text-amber-400">
                        {localizeUi("ui.connections.connectioneditor.mostUsersShouldLeaveThisOff")}
                      </strong>{" "}
                      {localizeUi("ui.connections.connectioneditor.fastModeIsEffectivelyADeadFeatureTodayClaude")}
                    </span>
                    <span className="mt-1.5 flex items-start gap-1 text-[var(--muted-foreground)]">
                      <AlertCircle size="0.625rem" className="mt-px shrink-0 text-amber-400" />
                      <span>
                        <strong className="text-amber-400">
                          {localizeUi("ui.connections.connectioneditor.doesnTWorkOnClaudeOpus47Yet")}
                        </strong>{" "}
                        {localizeUi("ui.connections.connectioneditor.thereIsNoFasterOpus47VariantFor")}
                      </span>
                    </span>
                  </>
                }
                checked={localClaudeFastMode}
                onChange={async (next) => {
                  if (next) {
                    const confirmed = await showConfirmDialog({
                      title: localizeUi("ui.connections.connectioneditor.youDonTWantThisSettingOn"),
                      message: localizeUi(
                        "ui.connections.connectioneditor.fastModeIsEffectivelyADeadFeatureTodayClaude_41c07ae",
                      ),
                      confirmLabel: localizeUi("ui.connections.connectioneditor.enableAnyway"),
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
              label={localizeUi("ui.connections.connectioneditor.semanticSearchEmbeddings")}
              icon={<Server size="0.875rem" className="mari-chrome-accent-icon mari-accent-animated" />}
              help={localizeUi(
                "ui.connections.connectioneditor.optionalConfigureTheEmbeddingSourceUsedForLorebookSemantic",
              )}
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
                    placeholder={localizeUi("ui.connections.connectioneditor.eGTextEmbedding3Small")}
                  />
                  <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi(
                      "ui.connections.connectioneditor.usedForLorebookSemanticSearchEntriesMatchingByMeaning",
                    )}
                  </p>

                  {/* Embedding Base URL Override */}
                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                      {localizeUi("ui.connections.connectioneditor.embeddingEndpointUrl")}
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
                      placeholder={localizeUi("ui.connections.connectioneditor.eGHttpLocalhost5002V1")}
                    />
                    {embeddingBaseUrlValidation.error && (
                      <p className="mt-1 text-[0.625rem] text-[var(--destructive)]">
                        {embeddingBaseUrlValidation.error}
                      </p>
                    )}
                    {!embeddingBaseUrlValidation.error &&
                      embeddingBaseUrlValidation.value !== localEmbeddingBaseUrl.trim() && (
                        <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                          {localizeUi("ui.connections.connectioneditor.willSaveAs")} {embeddingBaseUrlValidation.value}
                        </p>
                      )}
                    <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.connections.connectioneditor.optionalASeparateBaseUrlForYourEmbeddingBackend")}
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi(
                    "ui.connections.connectioneditor.thisProviderDoesNotExposeEmbeddingsThroughMarinaraChoose",
                  )}
                </p>
              )}

              {/* Embedding Connection Override */}
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                  {localizeUi("ui.connections.connectioneditor.embeddingConnection")}
                </label>
                <select
                  value={localEmbeddingConnectionId}
                  onChange={(e) => {
                    setLocalEmbeddingConnectionId(e.target.value);
                    markDirty();
                  }}
                  className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  <option value="">{localizeUi("ui.connections.connectioneditor.sameAsThisConnection")}</option>
                  {import.meta.env.VITE_MARINARA_LITE !== "true" && (
                    <option value={LOCAL_SIDECAR_CONNECTION_ID}>
                      {localizeUi("ui.connections.connectioneditor.localModelSidecar")}
                    </option>
                  )}
                  {((allConnections ?? []) as Record<string, unknown>[])
                    .filter(
                      (c) =>
                        c.id !== connectionDetailId &&
                        c.provider !== "image_generation" &&
                        c.provider !== "video_generation" &&
                        c.provider !== "audio",
                    )
                    .map((c) => (
                      <option key={c.id as string} value={c.id as string}>
                        {c.name as string}
                        {c.embeddingModel
                          ? localizeUi("ui.connections.connectioneditor.value1", { value1: c.embeddingModel })
                          : ""}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                  {localEmbeddingConnectionId === LOCAL_SIDECAR_CONNECTION_ID
                    ? localizeUi("ui.connections.connectioneditor.usesTheBuiltInLocalModelFromTheConnections")
                    : localizeUi("ui.connections.connectioneditor.useADifferentConnectionSApiKeyAndBase")}
                </p>
              </div>
            </FieldGroup>
          )}

          {/* ── Test Section ── */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
            <h3 className="text-sm font-semibold">{localizeUi("ui.connections.connectioneditor.connectionTests")}</h3>
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
                {localizeUi("ui.connections.connectioneditor.testConnection")}
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
                  {localizeUi("ui.connections.connectioneditor.sendTestMessage")}
                </button>
              )}
              {localProvider === "image_generation" && (
                <button
                  onClick={handleTestImage}
                  disabled={testImageGeneration.isPending}
                  className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
                  title={
                    dirty ? localizeUi("ui.connections.connectioneditor.saveFirstToTestImageGeneration") : undefined
                  }
                >
                  {testImageGeneration.isPending ? (
                    <Loader2 size="0.8125rem" className="animate-spin" />
                  ) : (
                    <ImageIcon size="0.8125rem" />
                  )}
                  {localizeUi("ui.connections.connectioneditor.testImage")}
                </button>
              )}
              {localProvider === "video_generation" && (
                <button
                  onClick={handleTestVideo}
                  disabled={testVideoGeneration.isPending}
                  className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
                  title={
                    dirty ? localizeUi("ui.connections.connectioneditor.saveFirstToTestVideoGeneration") : undefined
                  }
                >
                  {testVideoGeneration.isPending ? (
                    <Loader2 size="0.8125rem" className="animate-spin" />
                  ) : (
                    <Film size="0.8125rem" />
                  )}
                  {localizeUi("ui.connections.connectioneditor.testVideo")}
                </button>
              )}
              {isClaudeSubscriptionProvider && (
                <button
                  onClick={handleDiagnoseClaudeSubscription}
                  disabled={diagnoseClaudeSubscription.isPending || !localModel}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-400/10 px-4 py-2.5 text-xs font-medium text-amber-400 ring-1 ring-amber-400/20 transition-all hover:bg-amber-400/20 active:scale-[0.98] disabled:opacity-50"
                  title={localizeUi(
                    "ui.connections.connectioneditor.verifyWhichModelTheSdkActuallyBillsAgainstCatches",
                  )}
                >
                  {diagnoseClaudeSubscription.isPending ? (
                    <Loader2 size="0.8125rem" className="animate-spin" />
                  ) : (
                    <AlertCircle size="0.8125rem" />
                  )}
                  {localizeUi("ui.connections.connectioneditor.diagnoseModelRouting")}
                </button>
              )}
            </div>

            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              <strong>{localizeUi("ui.connections.connectioneditor.testConnection")}</strong>{" "}
              {localizeUi("ui.connections.connectioneditor.verifiesYourApiKeyAgainstTheProviderCatalogOr")}
              {!isMediaGenerationProvider && (
                <>
                  {" "}
                  <strong>{localizeUi("ui.connections.connectioneditor.sendTestMessage")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.sendsHiToTheSelectedModelEndpointAndShows")}
                </>
              )}
              {localProvider === "image_generation" && (
                <>
                  {" "}
                  <strong>{localizeUi("ui.connections.connectioneditor.testImage")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.generatesA10241024TestImageRequiresSavingFirst")}
                </>
              )}
              {localProvider === "video_generation" && (
                <>
                  {" "}
                  <strong>{localizeUi("ui.connections.connectioneditor.testVideo")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.generatesAShortMp4TestClipRequiresSavingFirst")}
                </>
              )}
              {isClaudeSubscriptionProvider && (
                <>
                  {" "}
                  <strong>{localizeUi("ui.connections.connectioneditor.diagnoseModelRouting")}</strong>{" "}
                  {localizeUi("ui.connections.connectioneditor.sendsARealPromptThroughTheClaudeAgentSdk")}
                </>
              )}
            </p>

            {/* Connection test result */}
            {testResult && (
              <TestResultCard
                label={localizeUi("ui.connections.connectioneditor.connectionTest")}
                success={testResult.success}
                latencyMs={testResult.latencyMs}
              >
                {testResult.message}
              </TestResultCard>
            )}

            {/* Message test result */}
            {msgResult && (
              <TestResultCard
                label={localizeUi("ui.connections.connectioneditor.testMessage")}
                success={msgResult.success}
                latencyMs={msgResult.latencyMs}
              >
                {msgResult.success ? (
                  <div className="mt-1.5 rounded-lg bg-[var(--secondary)] p-2.5 text-xs leading-relaxed">
                    {msgResult.response}
                  </div>
                ) : (
                  <span className="text-[var(--marinara-editor-accent)]">
                    {msgResult.error || "No response received"}
                  </span>
                )}
              </TestResultCard>
            )}

            {/* Image test result */}
            {imgTestResult && (
              <TestResultCard
                label={localizeUi("ui.connections.connectioneditor.testImage")}
                success={imgTestResult.success}
                latencyMs={imgTestResult.latencyMs}
              >
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
              <TestResultCard
                label={localizeUi("ui.connections.connectioneditor.testVideo")}
                success={vidTestResult.success}
                latencyMs={vidTestResult.latencyMs}
              >
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
                label={localizeUi("ui.connections.connectioneditor.modelRoutingDiagnosis")}
                success={claudeDiagResult.success && !claudeDiagResult.billedDifferent}
                latencyMs={claudeDiagResult.latencyMs}
              >
                <div className="mt-1.5 space-y-2">
                  <div className="grid grid-cols-[max-content,1fr] gap-x-3 gap-y-1 text-[0.6875rem]">
                    <span className="text-[var(--muted-foreground)]">
                      {localizeUi("ui.connections.connectioneditor.requestedModel")}
                    </span>
                    <span className="font-mono">{claudeDiagResult.requestedModel}</span>
                    <span className="text-[var(--muted-foreground)]">
                      {localizeUi("ui.connections.connectioneditor.sdkBilledAgainst")}
                    </span>
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
                                  {localizeUi("ui.connections.connectioneditor.roleplayGeneration")}
                                </span>
                                {primary.map((u) => (
                                  <span key={u.model}>
                                    {u.model}{" "}
                                    <span className="text-[var(--muted-foreground)]">
                                      {localizeUi("ui.connections.connectioneditor.in")} {u.inputTokens}
                                      {localizeUi("ui.connections.connectioneditor.out_bd05dcc")} {u.outputTokens})
                                    </span>
                                  </span>
                                ))}
                              </span>
                            )}
                            {secondary.length > 0 && (
                              <span className="flex flex-col gap-0.5">
                                <span className="text-[0.5625rem] font-sans uppercase tracking-wide text-[var(--muted-foreground)]">
                                  {localizeUi("ui.connections.connectioneditor.sdkSessionBookkeeping")}
                                </span>
                                {secondary.map((u) => (
                                  <span key={u.model} className="text-[var(--muted-foreground)]">
                                    {u.model} {localizeUi("ui.connections.connectioneditor.in")} {u.inputTokens}
                                    {localizeUi("ui.connections.connectioneditor.out_bd05dcc")} {u.outputTokens})
                                  </span>
                                ))}
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </span>
                    <span className="text-[var(--muted-foreground)]">
                      {localizeUi("ui.connections.connectioneditor.fastModeState")}
                    </span>
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
                      {localizeUi("ui.connections.connectioneditor.silentDowngradeDetectedYouAskedFor")}{" "}
                      <strong>{claudeDiagResult.requestedModel}</strong>{" "}
                      {localizeUi("ui.connections.connectioneditor.butTheSdkBilled")}{" "}
                      <strong>{claudeDiagResult.modelsBilled.join(", ")}</strong>
                      {localizeUi("ui.connections.connectioneditor.thisIsUsuallyCausedByClaudeCodeBeingIn")}{" "}
                      <code>{"cooldown"}</code>{" "}
                      {localizeUi("ui.connections.connectioneditor.afterHittingOpusRateLimitsOrFastModeBeing")}{" "}
                      <code>{"claude /model"}</code>{" "}
                      {localizeUi("ui.connections.connectioneditor.inYourTerminalToCheck")}
                    </div>
                  )}
                  {claudeDiagResult.modelUsageDetail.some((u) => u.model !== claudeDiagResult.requestedModel) && (
                    <div className="rounded-lg bg-[var(--secondary)]/50 p-2.5 text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                      <strong className="text-[var(--foreground)]">
                        {localizeUi("ui.connections.connectioneditor.whyIsHaikuInTheList")}
                      </strong>{" "}
                      {localizeUi("ui.connections.connectioneditor.theClaudeAgentSdkRunsA")}{" "}
                      <code>{"UserPromptSubmit"}</code>{" "}
                      {localizeUi("ui.connections.connectioneditor.hookOnEveryCallThatUsesItsSmallFast")}{" "}
                      <em>{localizeUi("ui.connections.connectioneditor.roleplayGeneration")}</em>{" "}
                      {localizeUi("ui.connections.connectioneditor.aboveTheHaikuTagalongAddsOnlyAFewOutput")}
                    </div>
                  )}
                  {claudeDiagResult.response && (
                    <div className="rounded-lg bg-[var(--secondary)] p-2.5 ring-1 ring-[var(--border)]">
                      <div className="text-[0.5625rem] font-sans uppercase tracking-wide text-[var(--muted-foreground)]">
                        {localizeUi("ui.connections.connectioneditor.modelSelfIdentifiesAs")}
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
  const { t: localizeUi } = useUiTranslation();
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
          {label}:{" "}
          {success
            ? localizeUi("ui.connections.testresultcard.success")
            : localizeUi("ui.connections.testresultcard.failed")}
        </span>
        <span className="ml-auto text-[0.625rem] text-[var(--muted-foreground)]">
          {latencyMs}
          {localizeUi("ui.connections.testresultcard.ms")}
        </span>
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
  remoteLoras,
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
  remoteLoras: RemoteConnectionModel[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onChange: (
    next:
      | ImageGenerationDefaultsProfile
      | ((current: ImageGenerationDefaultsProfile) => ImageGenerationDefaultsProfile),
  ) => void;
  onReset: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const activeServiceRef = useRef(service);
  const novelAiStylePlateInputRef = useRef<HTMLInputElement>(null);
  activeServiceRef.current = service;
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

  const handleNovelAiStylePlateUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(localizeUi("ui.connections.imagegenerationdefaultspanel.chooseAnImageFileForTheNovelaiStylePlate"));
      input.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(localizeUi("ui.connections.imagegenerationdefaultspanel.theNovelaiStylePlateMustBe10MbOr"));
      input.value = "";
      return;
    }

    try {
      const prepared = await prepareImageAttachment(file, file.name);
      if (activeServiceRef.current !== "novelai") return;
      onChange((current) => {
        const currentNovelAi = current.novelai ?? createDefaultImageGenerationProfile("novelai").novelai!;
        return {
          ...current,
          service: "novelai",
          novelai: { ...currentNovelAi, styleReferenceImage: prepared.data },
        };
      });
    } catch (error) {
      console.error("[ConnectionEditor] Failed to prepare NovelAI style plate", error);
      toast.error(localizeUi("ui.connections.imagegenerationdefaultspanel.theNovelaiStylePlateCouldNotBeRead"));
    } finally {
      input.value = "";
    }
  };

  return (
    <FieldGroup
      label={localizeUi("ui.connections.imagegenerationdefaultspanel.localImageDefaults")}
      icon={<SlidersHorizontal size="0.875rem" className="text-sky-400" />}
      help={localizeUi(
        "ui.connections.imagegenerationdefaultspanel.connectionScopedDefaultsForLocalStableDiffusionBackendsThese",
      )}
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
                ? localizeUi("ui.connections.imagegenerationdefaultspanel.comfyuiGenerationSetup")
                : service === "novelai"
                  ? localizeUi("ui.connections.imagegenerationdefaultspanel.novelaiGenerationSetup")
                  : localizeUi("ui.connections.imagegenerationdefaultspanel.automatic1111ForgeSetup")}
            </div>
            <p className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi(
                "ui.connections.imagegenerationdefaultspanel.promptPrefixesSamplerSchedulerStepsGuidanceSeedClipSkip",
              )}
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
                {localizeUi("ui.connections.imagegenerationdefaultspanel.seed1KeepsGenerationRandomAnyNonNegativeSeed")}
              </p>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--card)] px-2.5 py-1.5 text-[0.625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <RotateCcw size="0.6875rem" />
                {localizeUi("ui.connections.imagegenerationdefaultspanel.reset")}
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <NumberSetting
                label={localizeUi("ui.connections.imagegenerationdefaultspanel.seed")}
                value={value.seed}
                min={-1}
                max={4_294_967_295}
                onCommit={updateSeed}
              />
              <label className="flex flex-col gap-1 rounded-lg bg-[var(--card)] px-3 py-2 ring-1 ring-[var(--border)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.connections.imagegenerationdefaultspanel.styleProfile")}
                  </span>
                  {suggestedStyleProfile && suggestedStyleProfile.id !== value.styleProfileId && (
                    <button
                      type="button"
                      onClick={() => updateStyleProfile(suggestedStyleProfile.id)}
                      className="rounded-md bg-[var(--secondary)] px-1.5 py-0.5 text-[0.55rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      {localizeUi("ui.connections.imagegenerationdefaultspanel.use")} {suggestedStyleProfile.name}
                    </button>
                  )}
                </div>
                <select
                  value={value.styleProfileId ?? ""}
                  onChange={(event) => updateStyleProfile(event.target.value)}
                  className="rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-xs text-[var(--foreground)]"
                >
                  <option value="">{localizeUi("ui.connections.imagegenerationdefaultspanel.useGlobalDefault")}</option>
                  {styleProfiles.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                {suggestedStyleProfile && (
                  <span className="text-[0.55rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.connections.imagegenerationdefaultspanel.suggestedFromModelSource")}{" "}
                    {suggestedStyleProfile.name}
                  </span>
                )}
              </label>
              {service === "automatic1111" ? (
                <>
                  <NumberSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.steps")}
                    value={automatic1111.steps}
                    min={1}
                    max={150}
                    onCommit={(steps) => updateAutomatic1111({ steps })}
                  />
                  <NumberSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.cfgScale")}
                    value={automatic1111.cfgScale}
                    min={0}
                    max={30}
                    integer={false}
                    onCommit={(cfgScale) => updateAutomatic1111({ cfgScale })}
                  />
                  <NumberSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.clipSkip")}
                    value={automatic1111.clipSkip ?? 0}
                    min={0}
                    max={12}
                    onCommit={(clipSkip) => updateAutomatic1111({ clipSkip: clipSkip > 0 ? clipSkip : null })}
                  />
                  <NumberSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.img2imgDenoise")}
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
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.steps")}
                    value={comfyui.steps}
                    min={1}
                    max={150}
                    onCommit={(steps) => updateComfyUi({ steps })}
                  />
                  <NumberSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.cfgScale")}
                    value={comfyui.cfgScale}
                    min={0}
                    max={30}
                    integer={false}
                    onCommit={(cfgScale) => updateComfyUi({ cfgScale })}
                  />
                  <NumberSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.denoise")}
                    value={comfyui.denoisingStrength}
                    min={0}
                    max={1}
                    integer={false}
                    onCommit={(denoisingStrength) => updateComfyUi({ denoisingStrength })}
                  />
                  <NumberSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.clipSkip")}
                    value={comfyui.clipSkip ?? 0}
                    min={0}
                    max={12}
                    onCommit={(clipSkip) => updateComfyUi({ clipSkip: clipSkip > 0 ? clipSkip : null })}
                  />
                </>
              ) : (
                <>
                  <NumberSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.steps")}
                    value={novelai.steps}
                    min={1}
                    max={150}
                    onCommit={(steps) => updateNovelAi({ steps })}
                  />
                  <NumberSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.promptGuidance")}
                    value={novelai.promptGuidance}
                    min={0}
                    max={30}
                    integer={false}
                    onCommit={(promptGuidance) => updateNovelAi({ promptGuidance })}
                  />
                  <NumberSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.guidanceRescale")}
                    value={novelai.promptGuidanceRescale}
                    min={0}
                    max={1}
                    integer={false}
                    onCommit={(promptGuidanceRescale) => updateNovelAi({ promptGuidanceRescale })}
                  />
                  <NumberSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.ucPreset")}
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
                  label={localizeUi("ui.connections.imagegenerationdefaultspanel.promptPrefix")}
                  value={automatic1111.promptPrefix}
                  onChange={(promptPrefix) => updateAutomatic1111({ promptPrefix })}
                  placeholder={localizeUi("ui.connections.imagegenerationdefaultspanel.eGMasterpieceHighQuality")}
                />
                <TextSetting
                  label={localizeUi("ui.connections.imagegenerationdefaultspanel.negativePrefix")}
                  value={automatic1111.negativePromptPrefix}
                  onChange={(negativePromptPrefix) => updateAutomatic1111({ negativePromptPrefix })}
                  placeholder={localizeUi("ui.connections.imagegenerationdefaultspanel.eGLowQualityBlurry")}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <ChoiceSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.sampler")}
                    value={automatic1111.sampler}
                    options={SD_WEBUI_SAMPLER_OPTIONS}
                    onChange={(sampler) => updateAutomatic1111({ sampler })}
                  />
                  <ChoiceSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.scheduler")}
                    value={automatic1111.scheduler}
                    options={SD_WEBUI_SCHEDULER_OPTIONS}
                    onChange={(scheduler) => updateAutomatic1111({ scheduler })}
                  />
                </div>
                <SettingsCheckbox
                  label={localizeUi("ui.connections.imagegenerationdefaultspanel.restoreFaces")}
                  checked={automatic1111.restoreFaces}
                  onChange={(checked) => updateAutomatic1111({ restoreFaces: checked })}
                  className="bg-[var(--card)] px-3 py-2 ring-1 ring-[var(--border)]"
                  labelClassName="text-[var(--foreground)]"
                />
              </>
            ) : service === "comfyui" ? (
              <>
                <TextSetting
                  label={localizeUi("ui.connections.imagegenerationdefaultspanel.promptPrefix")}
                  value={comfyui.promptPrefix}
                  onChange={(promptPrefix) => updateComfyUi({ promptPrefix })}
                  placeholder={localizeUi("ui.connections.imagegenerationdefaultspanel.eGMasterpieceHighQuality")}
                />
                <TextSetting
                  label={localizeUi("ui.connections.imagegenerationdefaultspanel.negativePrefix")}
                  value={comfyui.negativePromptPrefix}
                  onChange={(negativePromptPrefix) => updateComfyUi({ negativePromptPrefix })}
                  placeholder={localizeUi("ui.connections.imagegenerationdefaultspanel.eGLowQualityBlurry")}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <ChoiceSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.sampler")}
                    value={comfyui.sampler}
                    options={COMFYUI_SAMPLER_OPTIONS}
                    onChange={(sampler) => updateComfyUi({ sampler })}
                  />
                  <ChoiceSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.scheduler")}
                    value={comfyui.scheduler}
                    options={COMFYUI_SCHEDULER_OPTIONS}
                    onChange={(scheduler) => updateComfyUi({ scheduler })}
                  />
                </div>
                <SettingsCheckbox
                  label={localizeUi(
                    "ui.connections.imagegenerationdefaultspanel.uploadA1x1PlaceholderWhenNoReferenceImageIs",
                  )}
                  description={localizeUi(
                    "ui.connections.imagegenerationdefaultspanel.customWorkflowsUsingReferenceImageOrReferenceImageName",
                  )}
                  checked={comfyui.uploadPlaceholderOnMissingReference}
                  onChange={(checked) => updateComfyUi({ uploadPlaceholderOnMissingReference: checked })}
                  className="bg-[var(--card)] px-3 py-2 ring-1 ring-[var(--border)]"
                  labelClassName="text-[var(--foreground)]"
                />
                <ComfyUiLoraSettings
                  idPrefix="image-comfyui"
                  value={comfyui.loras}
                  availableLoras={remoteLoras}
                  onChange={(loras) => updateComfyUi({ loras })}
                />
                <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                  {localizeUi(
                    "ui.connections.imagegenerationdefaultspanel.customComfyuiWorkflowsCanUseStepsCfgSamplerScheduler",
                  )}
                </p>
              </>
            ) : (
              <>
                <TextSetting
                  label={localizeUi("ui.connections.imagegenerationdefaultspanel.promptPrefix")}
                  value={novelai.promptPrefix}
                  onChange={(promptPrefix) => updateNovelAi({ promptPrefix })}
                  placeholder={localizeUi("ui.connections.imagegenerationdefaultspanel.eGMasterpieceBestQuality")}
                />
                <TextSetting
                  label={localizeUi("ui.connections.imagegenerationdefaultspanel.negativePrefix")}
                  value={novelai.negativePromptPrefix}
                  onChange={(negativePromptPrefix) => updateNovelAi({ negativePromptPrefix })}
                  placeholder={localizeUi("ui.connections.imagegenerationdefaultspanel.eGLowQualityBlurry")}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <ChoiceSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.sampler")}
                    value={novelai.sampler}
                    options={NOVELAI_SAMPLER_OPTIONS}
                    onChange={(sampler) => updateNovelAi({ sampler })}
                  />
                  <ChoiceSetting
                    label={localizeUi("ui.connections.imagegenerationdefaultspanel.noiseSchedule")}
                    value={novelai.noiseSchedule}
                    options={NOVELAI_NOISE_SCHEDULE_OPTIONS}
                    onChange={(noiseSchedule) => updateNovelAi({ noiseSchedule })}
                  />
                </div>
                <SettingsCheckbox
                  label={localizeUi("ui.connections.imagegenerationdefaultspanel.chooseResolutionFromCharacterCount")}
                  description={localizeUi(
                    "ui.connections.imagegenerationdefaultspanel.usesPortraitForOneSubjectSquareForTwoAnd",
                  )}
                  checked={novelai.dynamicResolutionBySubjectCount}
                  onChange={(checked) => updateNovelAi({ dynamicResolutionBySubjectCount: checked })}
                  className="bg-[var(--card)] px-3 py-2 ring-1 ring-[var(--border)]"
                  labelClassName="text-[var(--foreground)]"
                />
                <div className="space-y-2 rounded-lg bg-[var(--card)] px-3 py-2 ring-1 ring-[var(--border)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[0.625rem] font-medium text-[var(--foreground)]">
                        {localizeUi("ui.connections.imagegenerationdefaultspanel.novelaiV45StylePlate")}
                      </p>
                      <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                        {localizeUi(
                          "ui.connections.imagegenerationdefaultspanel.aPersistentStyleOnlyReferenceAppliedFirstToEvery",
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => novelAiStylePlateInputRef.current?.click()}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.625rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
                      >
                        <Upload size="0.6875rem" />
                        {novelai.styleReferenceImage
                          ? localizeUi("settings.notifications.customSound.actions.replace")
                          : localizeUi("ui.connections.imagegenerationdefaultspanel.chooseImage")}
                      </button>
                      <input
                        ref={novelAiStylePlateInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        tabIndex={-1}
                        onChange={handleNovelAiStylePlateUpload}
                      />
                      {novelai.styleReferenceImage && (
                        <button
                          type="button"
                          onClick={() => updateNovelAi({ styleReferenceImage: null })}
                          className="rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                        >
                          {localizeUi("settings.notifications.customSound.actions.remove")}
                        </button>
                      )}
                    </div>
                  </div>
                  {novelai.styleReferenceImage && (
                    <img
                      src={novelai.styleReferenceImage}
                      alt={localizeUi("ui.connections.imagegenerationdefaultspanel.novelaiStylePlatePreview")}
                      className="h-24 w-full rounded-md object-cover ring-1 ring-[var(--border)]"
                    />
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <NumberSetting
                      label={localizeUi("ui.connections.imagegenerationdefaultspanel.styleStrength")}
                      value={novelai.styleReferenceStrength}
                      min={0}
                      max={1}
                      integer={false}
                      onCommit={(styleReferenceStrength) => updateNovelAi({ styleReferenceStrength })}
                    />
                    <NumberSetting
                      label={localizeUi("ui.connections.imagegenerationdefaultspanel.styleFidelity")}
                      value={novelai.styleReferenceFidelity}
                      min={0}
                      max={1}
                      integer={false}
                      onCommit={(styleReferenceFidelity) => updateNovelAi({ styleReferenceFidelity })}
                    />
                  </div>
                </div>
                <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                  {localizeUi(
                    "ui.connections.imagegenerationdefaultspanel.theseValuesAreSentWithNativeNovelaiRequestsAnd",
                  )}
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
  source,
  remoteLoras,
  expanded,
  onExpandedChange,
  onChange,
  onReset,
}: {
  value: VideoGenerationDefaultsProfile;
  source: string;
  remoteLoras: RemoteConnectionModel[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onChange: (next: VideoGenerationDefaultsProfile) => void;
  onReset: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const isNanoGpt = source === "nanogpt";
  const service =
    value.service === "xai" ||
    value.service === "openrouter" ||
    value.service === "atlas" ||
    value.service === "seedance" ||
    value.service === "comfyui" ||
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
          : service === "atlas"
            ? `${value.atlas.durationSeconds}s, ${value.atlas.aspectRatio}, ${value.atlas.resolution}`
            : service === "seedance"
              ? `${value.seedance.durationSeconds}s, ${value.seedance.aspectRatio}, ${value.seedance.resolution}`
              : service === "comfyui"
                ? `${value.comfyui.durationSeconds}s, ${value.comfyui.fps} FPS, ${value.comfyui.aspectRatio}, ${value.comfyui.resolution}`
                : `${value.geminiOmni.durationSeconds}s, ${value.geminiOmni.aspectRatio}`;
  const serviceLabel =
    service === "xai"
      ? "xAI Imagine"
      : service === "google_veo"
        ? "Google AI Studio Veo"
        : service === "openrouter"
          ? isNanoGpt
            ? "NanoGPT"
            : "OpenRouter Video"
          : service === "atlas"
            ? t("connections.mediaSources.atlas.name")
            : service === "seedance"
              ? "Seedance 2.0"
              : service === "comfyui"
                ? "ComfyUI"
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
  const updateAtlas = (patch: Partial<VideoGenerationDefaultsProfile["atlas"]>) => {
    onChange({
      ...value,
      service: "atlas",
      atlas: { ...value.atlas, ...patch },
    });
  };
  const updateSeedance = (patch: Partial<VideoGenerationDefaultsProfile["seedance"]>) => {
    onChange({
      ...value,
      service: "seedance",
      seedance: { ...value.seedance, ...patch },
    });
  };
  const updateComfyUi = (patch: Partial<VideoGenerationDefaultsProfile["comfyui"]>) => {
    onChange({
      ...value,
      service: "comfyui",
      comfyui: { ...value.comfyui, ...patch },
    });
  };

  return (
    <FieldGroup
      label={localizeUi("ui.connections.videogenerationdefaultspanel.videoDefaults")}
      icon={<SlidersHorizontal size="0.875rem" className="text-sky-400" />}
      help={
        service === "xai"
          ? localizeUi("ui.connections.videogenerationdefaultspanel.connectionScopedDefaultsForXaiSceneVideoGeneration")
          : service === "google_veo"
            ? localizeUi(
                "ui.connections.videogenerationdefaultspanel.connectionScopedDefaultsForGoogleAiStudioVeoVideo",
              )
            : service === "openrouter"
              ? isNanoGpt
                ? localizeUi(
                    "ui.connections.videogenerationdefaultspanel.connectionScopedDefaultsForNanogptAsynchronousVideoGeneration",
                  )
                : localizeUi(
                    "ui.connections.videogenerationdefaultspanel.connectionScopedDefaultsForOpenrouterAsynchronousVideoGeneration",
                  )
              : service === "atlas"
                ? t("connections.mediaSources.atlas.videoDefaultsHelp")
                : service === "seedance"
                  ? localizeUi(
                      "ui.connections.videogenerationdefaultspanel.connectionScopedDefaultsForSeedance20AsynchronousVideo",
                    )
                  : service === "comfyui"
                    ? localizeUi(
                        "ui.connections.videogenerationdefaultspanel.connectionScopedDimensionsAndDurationForLocalComfyuiVideo",
                      )
                    : localizeUi(
                        "ui.connections.videogenerationdefaultspanel.connectionScopedDefaultsForSceneVideoGenerationDurationIs",
                      )
      }
    >
      <div className="rounded-xl bg-[var(--secondary)]/40 ring-1 ring-[var(--border)]">
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]"
        >
          <div className="min-w-0">
            <div className="text-xs font-medium text-[var(--foreground)]">
              {service === "atlas"
                ? t("connections.mediaSources.atlas.videoSetupLabel")
                : localizeUi("ui.connections.videogenerationdefaultspanel.value1Setup", { value1: serviceLabel })}
            </div>
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
                {localizeUi("ui.connections.imagegenerationdefaultspanel.reset")}
              </button>
            </div>

            {service === "xai" ||
            service === "google_veo" ||
            service === "openrouter" ||
            service === "atlas" ||
            service === "seedance" ||
            service === "comfyui" ? (
              <>
                <div className={cn("grid gap-2", service === "comfyui" ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
                  <NumberSetting
                    label={localizeUi("ui.connections.videogenerationdefaultspanel.durationSeconds")}
                    value={
                      service === "xai"
                        ? value.xai.durationSeconds
                        : service === "google_veo"
                          ? value.googleVeo.durationSeconds
                          : service === "atlas"
                            ? value.atlas.durationSeconds
                            : service === "seedance"
                              ? value.seedance.durationSeconds
                              : service === "comfyui"
                                ? value.comfyui.durationSeconds
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
                      } else if (service === "atlas") {
                        updateAtlas({ durationSeconds });
                      } else if (service === "comfyui") {
                        updateComfyUi({ durationSeconds });
                      } else updateOpenRouter({ durationSeconds });
                    }}
                  />
                  {service === "comfyui" && (
                    <NumberSetting
                      label={localizeUi("ui.connections.videogenerationdefaultspanel.framesPerSecondFps")}
                      value={value.comfyui.fps}
                      min={1}
                      max={120}
                      onCommit={(fps) => updateComfyUi({ fps })}
                    />
                  )}
                  <label className="block">
                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.connections.videogenerationdefaultspanel.aspectRatio")}
                    </span>
                    <select
                      value={
                        service === "xai"
                          ? value.xai.aspectRatio
                          : service === "google_veo"
                            ? value.googleVeo.aspectRatio
                            : service === "atlas"
                              ? value.atlas.aspectRatio
                              : service === "seedance"
                                ? value.seedance.aspectRatio
                                : service === "comfyui"
                                  ? value.comfyui.aspectRatio
                                  : value.openrouter.aspectRatio
                      }
                      onChange={(event) => {
                        const aspectRatio = event.target.value === "9:16" ? "9:16" : "16:9";
                        if (service === "xai") updateXai({ aspectRatio });
                        else if (service === "google_veo") updateGoogleVeo({ aspectRatio });
                        else if (service === "atlas") updateAtlas({ aspectRatio });
                        else if (service === "seedance") updateSeedance({ aspectRatio });
                        else if (service === "comfyui") updateComfyUi({ aspectRatio });
                        else updateOpenRouter({ aspectRatio });
                      }}
                      className="mt-1 w-full rounded-lg bg-[var(--card)] px-3 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
                    >
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.connections.videogenerationdefaultspanel.resolution")}
                    </span>
                    <select
                      value={
                        service === "xai"
                          ? value.xai.resolution
                          : service === "google_veo"
                            ? value.googleVeo.resolution
                            : service === "atlas"
                              ? value.atlas.resolution
                              : service === "seedance"
                                ? value.seedance.resolution
                                : service === "comfyui"
                                  ? value.comfyui.resolution
                                  : value.openrouter.resolution
                      }
                      onChange={(event) => {
                        const resolution = event.target.value as VideoResolution;
                        if (service === "xai") updateXai({ resolution });
                        else if (service === "google_veo") updateGoogleVeo({ resolution });
                        else if (service === "atlas") updateAtlas({ resolution });
                        else if (service === "seedance") updateSeedance({ resolution });
                        else if (service === "comfyui") updateComfyUi({ resolution });
                        else updateOpenRouter({ resolution });
                      }}
                      className="mt-1 w-full rounded-lg bg-[var(--card)] px-3 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
                    >
                      {VIDEO_RESOLUTION_OPTIONS.filter(
                        (option) =>
                          (service !== "google_veo" || option.value !== "480p") &&
                          (service !== "comfyui" || option.value !== "1080p"),
                      ).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {service === "comfyui" && (
                  <ComfyUiLoraSettings
                    idPrefix="video-comfyui"
                    value={value.comfyui.loras}
                    availableLoras={remoteLoras}
                    onChange={(loras) => updateComfyUi({ loras })}
                  />
                )}
                <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                  {service === "xai"
                    ? localizeUi("ui.connections.videogenerationdefaultspanel.theseValuesAreSentToTheXaiVideosApi")
                    : service === "google_veo"
                      ? localizeUi("ui.connections.videogenerationdefaultspanel.veoAccepts46Or8SecondsCharacterLoop")
                      : service === "atlas"
                        ? t("connections.mediaSources.atlas.videoDefaultsNote")
                        : service === "seedance"
                          ? localizeUi(
                              "ui.connections.videogenerationdefaultspanel.seedanceAccepts415SecondsReferenceImageJobsSend",
                            )
                          : service === "comfyui"
                            ? localizeUi(
                                "ui.connections.videogenerationdefaultspanel.comfyuiReceivesDimensionsDurationFpsAndFrameCount",
                              )
                            : localizeUi(
                                isNanoGpt
                                  ? "ui.connections.videogenerationdefaultspanel.theseValuesAreSentToNanogptSAsynchronousVideoApi"
                                  : "ui.connections.videogenerationdefaultspanel.theseValuesAreSentToOpenrouterSAsynchronousVideos",
                              )}
                </p>
              </>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <NumberSetting
                  label={localizeUi("ui.connections.videogenerationdefaultspanel.targetDurationSeconds")}
                  value={value.geminiOmni.durationSeconds}
                  min={1}
                  max={60}
                  onCommit={(durationSeconds) => updateGeminiOmni({ durationSeconds })}
                />
                <label className="block">
                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.connections.videogenerationdefaultspanel.aspectRatio")}
                  </span>
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

function ComfyUiLoraSettings({
  idPrefix,
  value,
  availableLoras,
  onChange,
}: {
  idPrefix: string;
  value: ComfyUiLoraSetting[];
  availableLoras: RemoteConnectionModel[];
  onChange: (value: ComfyUiLoraSetting[]) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const datalistId = `${idPrefix}-lora-models`;
  const slots = Array.from({ length: 5 }, (_, index) => value[index] ?? { model: "", strength: 1 });
  const updateSlot = (index: number, patch: Partial<ComfyUiLoraSetting>) => {
    const next = slots.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot));
    while (next.length > 0 && !next[next.length - 1]!.model.trim()) next.pop();
    onChange(next);
  };

  return (
    <div className="space-y-2 rounded-lg bg-[var(--card)] px-3 py-2 ring-1 ring-[var(--border)]">
      <div>
        <p className="text-[0.625rem] font-medium text-[var(--foreground)]">
          {localizeUi("ui.connections.comfyuilorasettings.loras")}
        </p>
        <p className="text-[0.55rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.connections.comfyuilorasettings.chooseUpToFiveLoras")}
        </p>
      </div>
      <datalist id={datalistId}>
        {availableLoras.map((lora) => (
          <option key={lora.id} value={lora.id}>
            {lora.name}
          </option>
        ))}
      </datalist>
      {slots.map((slot, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <label className="block">
            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.connections.comfyuilorasettings.loraNumber", { value1: index + 1 })}
            </span>
            <input
              type="text"
              list={datalistId}
              value={slot.model}
              onChange={(event) => updateSlot(index, { model: event.target.value })}
              placeholder={localizeUi("ui.connections.comfyuilorasettings.selectOrEnterLora")}
              className="mt-1 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50"
            />
          </label>
          <NumberSetting
            label={localizeUi("ui.connections.comfyuilorasettings.strength")}
            value={slot.strength}
            min={COMFYUI_LORA_STRENGTH_MIN}
            max={COMFYUI_LORA_STRENGTH_MAX}
            integer={false}
            onCommit={(strength) => updateSlot(index, { strength })}
          />
        </div>
      ))}
      <p className="text-[0.55rem] text-[var(--muted-foreground)]">
        {localizeUi("ui.connections.comfyuilorasettings.workflowPlaceholders")}
      </p>
    </div>
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
  const { t: localizeUi } = useUiTranslation();
  const listId = `image-default-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label className="block">
      <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">{label}</span>
      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg bg-[var(--card)] px-3 py-2 text-xs ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:ring-sky-400/50"
        placeholder={localizeUi("ui.connections.choicesetting.backendDefault")}
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

function buildLanguageDefaultParameters(
  parameters: EditableGenerationParameters,
  imageCaptioningEnabled: boolean,
  imageCaptioningConnectionId: string,
): Record<string, unknown> {
  return {
    ...(parameters as unknown as Record<string, unknown>),
    imageCaptioningEnabled,
    imageCaptioningConnectionId: imageCaptioningConnectionId || null,
  };
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
