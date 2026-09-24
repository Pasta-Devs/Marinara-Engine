import type { ComfyUiLoraSetting } from "./image-generation-defaults.js";

export type VideoDefaultsService =
  "gemini_omni" | "google_veo" | "xai" | "openrouter" | "atlas" | "seedance" | "comfyui";

export type VideoAspectRatio = "16:9" | "9:16";
export type VideoResolution = "480p" | "720p" | "1080p";
export type VideoReferenceUploadExpiry = "1h" | "12h" | "24h" | "72h";

export interface GeminiOmniVideoDefaults {
  /** Prompt-level duration guidance. Gemini Omni REST video_config does not currently expose duration_seconds. */
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
}

export interface XaiVideoDefaults {
  /** xAI accepts duration 1-15 seconds for video generation. */
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
}

export interface GoogleVeoVideoDefaults {
  /** Veo accepts 4, 6, or 8 seconds; image interpolation uses 8 seconds. */
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
}

export interface OpenRouterVideoDefaults {
  /** OpenRouter video generation is asynchronous and accepts duration guidance per model/provider. */
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
}

/** A value for one model-specific Atlas Cloud input, as declared by that model's published schema. */
export type AtlasCloudModelOptionValue = string | number | boolean | unknown[] | Record<string, unknown>;
export type AtlasCloudModelOptions = Record<string, AtlasCloudModelOptionValue>;

/** One model-specific input the connection editor can offer, with the provider's own default. */
export interface AtlasCloudModelOptionField {
  name: string;
  type: "string" | "number" | "integer" | "boolean" | "json";
  enum: Array<string | number> | null;
  minimum: number | null;
  maximum: number | null;
  default: unknown;
  description: string | null;
  required: boolean;
}

/** What the common duration, resolution, and aspect controls can be set to for this model. */
export interface AtlasCloudModelLimits {
  durations: number[] | null;
  minDurationSeconds: number | null;
  maxDurationSeconds: number | null;
  resolutions: string[] | null;
  sizes: string[] | null;
  aspectRatios: string[] | null;
  acceptsReferenceImage: boolean;
  requiresReferenceImage: boolean;
}

/** Response of `GET /connections/atlas-cloud/video-model-schema`. `available` is false when the model publishes no schema. */
export interface AtlasCloudVideoModelSchemaResponse {
  model: string;
  available: boolean;
  fields: AtlasCloudModelOptionField[];
  limits: AtlasCloudModelLimits | null;
}

export interface AtlasCloudVideoDefaults {
  /** Atlas Cloud model schemas vary; these are the common scene-video controls. */
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  /** Model-specific inputs the user changed, keyed by Atlas Cloud model ID. Unset inputs keep the provider default. */
  modelOptions: Record<string, AtlasCloudModelOptions>;
}

export interface ComfyUiVideoDefaults {
  /** ComfyUI workflows receive this duration through %length_s% and as a frame count through %length%. */
  durationSeconds: number;
  /** Frame rate exposed as %fps% and used to derive the legacy %length% frame count. */
  fps: number;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  loras: ComfyUiLoraSetting[];
}

export interface SeedanceVideoDefaults {
  /** Seedance 2.0 accepts 4-15 seconds for video generations. */
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  /** Upload local first/last-frame references to temporary public URLs when Seedance cannot fetch them directly. */
  temporaryPublicReferenceUploadEnabled: boolean;
  temporaryPublicReferenceUploadExpiry: VideoReferenceUploadExpiry;
}

export interface VideoGenerationDefaultsProfile {
  version: 1;
  service: VideoDefaultsService;
  geminiOmni: GeminiOmniVideoDefaults;
  googleVeo: GoogleVeoVideoDefaults;
  xai: XaiVideoDefaults;
  openrouter: OpenRouterVideoDefaults;
  atlas: AtlasCloudVideoDefaults;
  seedance: SeedanceVideoDefaults;
  comfyui: ComfyUiVideoDefaults;
}
