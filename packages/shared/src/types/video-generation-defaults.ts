export type VideoDefaultsService = "gemini_omni" | "google_veo" | "xai" | "openrouter" | "seedance";

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
  seedance: SeedanceVideoDefaults;
}
