import {
  VIDEO_DEFAULTS_STORAGE_KEY,
  createDefaultVideoGenerationProfile,
  inferVideoSource,
  normalizeVideoGenerationProfile,
  type VideoAspectRatio,
  type VideoGenerationDefaultsProfile,
  type VideoResolution,
} from "@marinara-engine/shared";
import {
  resolveVideoReferencePublicUploadOptions,
  type VideoReferencePublicUploadOptions,
} from "./video-generation.js";
import { getSceneVideoPromptLimits, type SceneVideoPromptLimits } from "./prompt-context.js";

const DEFAULT_GEMINI_OMNI_MODEL = "gemini-omni-flash-preview";
const DEFAULT_GEMINI_OMNI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GOOGLE_VEO_MODEL = "veo-3.1-generate-preview";
const DEFAULT_GOOGLE_VEO_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_XAI_VIDEO_MODEL = "grok-imagine-video-1.5";
const DEFAULT_XAI_VIDEO_BASE_URL = "https://api.x.ai/v1";
const DEFAULT_OPENROUTER_VIDEO_MODEL = "google/veo-3.1";
const DEFAULT_OPENROUTER_VIDEO_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_SEEDANCE_VIDEO_MODEL = "seedance-2-0";
const DEFAULT_SEEDANCE_VIDEO_BASE_URL = "https://api.seedance2.ai";
const DEFAULT_COMFYUI_VIDEO_BASE_URL = "http://127.0.0.1:8188";

interface VideoRuntimeConnection {
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
  defaultParameters?: unknown;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  comfyuiWorkflow?: string | null;
}

interface ActiveVideoDefaults {
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  resolution?: VideoResolution;
}

export interface GameVideoRuntime {
  source: string;
  serviceHint: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  comfyWorkflow?: string;
  resolution?: VideoResolution;
  promptLimits: SceneVideoPromptLimits;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  publicReferenceUpload: VideoReferencePublicUploadOptions | null;
  activeDefaults: ActiveVideoDefaults;
  videoDefaults: VideoGenerationDefaultsProfile;
  hasStoredDefaults: boolean;
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

export function resolveGameVideoRuntime(connection: VideoRuntimeConnection): GameVideoRuntime {
  const defaultsRoot = parseDefaultParametersRoot(connection.defaultParameters);
  const hasStoredDefaults = Object.prototype.hasOwnProperty.call(defaultsRoot, VIDEO_DEFAULTS_STORAGE_KEY);
  const videoDefaults = hasStoredDefaults
    ? normalizeVideoGenerationProfile(defaultsRoot[VIDEO_DEFAULTS_STORAGE_KEY]).profile
    : createDefaultVideoGenerationProfile();
  const explicitSource = connection.videoGenerationSource || connection.videoService || "";
  const source =
    explicitSource ||
    (videoDefaults.service !== "gemini_omni"
      ? videoDefaults.service
      : inferVideoSource(connection.model || "", connection.baseUrl || ""));
  const rawServiceHint = connection.videoService || source;
  const serviceHint =
    rawServiceHint === "google_ai_studio"
      ? inferVideoSource(connection.model || "", connection.baseUrl || "")
      : rawServiceHint;
  const isXai = source === "xai" || serviceHint === "xai";
  const isGeminiOmni = source === "gemini_omni" || serviceHint === "gemini_omni";
  const isGoogleVeo = source === "google_veo" || serviceHint === "google_veo";
  const isOpenRouter = source === "openrouter" || serviceHint === "openrouter";
  const isSeedance = source === "seedance" || serviceHint === "seedance";
  const isComfyUi = source === "comfyui" || serviceHint === "comfyui";
  const activeDefaults = isXai
    ? videoDefaults.xai
    : isGoogleVeo
      ? videoDefaults.googleVeo
      : isOpenRouter
        ? videoDefaults.openrouter
        : isSeedance
          ? videoDefaults.seedance
          : isComfyUi
            ? videoDefaults.comfyui
            : videoDefaults.geminiOmni;
  const resolution = isXai
    ? videoDefaults.xai.resolution
    : isGoogleVeo
      ? videoDefaults.googleVeo.resolution
      : isOpenRouter
        ? videoDefaults.openrouter.resolution
        : isSeedance
          ? videoDefaults.seedance.resolution
          : isComfyUi
            ? videoDefaults.comfyui.resolution
            : undefined;

  return {
    source,
    serviceHint,
    baseUrl:
      connection.baseUrl ||
      (isXai
        ? DEFAULT_XAI_VIDEO_BASE_URL
        : isGoogleVeo
          ? DEFAULT_GOOGLE_VEO_BASE_URL
          : isOpenRouter
            ? DEFAULT_OPENROUTER_VIDEO_BASE_URL
            : isSeedance
              ? DEFAULT_SEEDANCE_VIDEO_BASE_URL
              : isComfyUi
                ? DEFAULT_COMFYUI_VIDEO_BASE_URL
                : DEFAULT_GEMINI_OMNI_BASE_URL),
    apiKey: connection.apiKey || "",
    model:
      connection.model ||
      (isXai
        ? DEFAULT_XAI_VIDEO_MODEL
        : isGoogleVeo
          ? DEFAULT_GOOGLE_VEO_MODEL
          : isOpenRouter
            ? DEFAULT_OPENROUTER_VIDEO_MODEL
            : isSeedance
              ? DEFAULT_SEEDANCE_VIDEO_MODEL
              : isComfyUi
                ? ""
                : DEFAULT_GEMINI_OMNI_MODEL),
    comfyWorkflow: connection.comfyuiWorkflow || undefined,
    resolution,
    promptLimits: getSceneVideoPromptLimits(isXai, isGeminiOmni),
    minDurationSeconds: isGoogleVeo || isSeedance ? 4 : 1,
    maxDurationSeconds: isXai || isSeedance ? 15 : isGoogleVeo ? 8 : 60,
    publicReferenceUpload: resolveVideoReferencePublicUploadOptions(isSeedance, videoDefaults.seedance),
    activeDefaults,
    videoDefaults,
    hasStoredDefaults,
  };
}
