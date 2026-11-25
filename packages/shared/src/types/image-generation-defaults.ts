export type ImageDefaultsService = "automatic1111" | "comfyui" | "novelai";

export interface Automatic1111Defaults {
  promptPrefix: string;
  negativePromptPrefix: string;
  sampler: string;
  scheduler: string;
  steps: number;
  cfgScale: number;
  clipSkip: number | null;
  restoreFaces: boolean;
  denoisingStrength: number;
}

export interface ComfyUiLoraSetting {
  model: string;
  strength: number;
}

export interface ComfyUiDefaults {
  promptPrefix: string;
  negativePromptPrefix: string;
  sampler: string;
  scheduler: string;
  steps: number;
  cfgScale: number;
  denoisingStrength: number;
  clipSkip: number | null;
  uploadPlaceholderOnMissingReference: boolean;
  /** SwarmUI: also keep generated images in the backend's output folder. */
  saveToBackend?: boolean;
  loras: ComfyUiLoraSetting[];
}

export interface NovelAiDefaults {
  promptPrefix: string;
  negativePromptPrefix: string;
  sampler: string;
  noiseSchedule: string;
  /** Null: NovelAI's own default for the request's model (novelAiRecommendedSettings). */
  steps: number | null;
  /** Null: NovelAI's own default for the request's model (novelAiRecommendedSettings). */
  promptGuidance: number | null;
  promptGuidanceRescale: number;
  undesiredContentPreset: number;
  dynamicResolutionBySubjectCount: boolean;
  /** Start background pictures with NovelAI's "background dataset" tag (V4.5 and V5). Off by default: the dataset
   *  leans photographic, which can clash with an anime-style chat. */
  backgroundDataset: boolean;
  /** Persistent V4.5 style-only director reference stored with this connection. */
  styleReferenceImage: string | null;
  styleReferenceStrength: number;
  styleReferenceFidelity: number;
  /**
   * 2: steps and prompt guidance are read as saved. A profile saved before it has the old built-in 28 steps and
   * guidance 6 the editor wrote by itself, which read as automatic once (normalizeNovelAiDefaults).
   */
  settingsVersion: 2;
}

export interface ImageGenerationDefaultsProfile {
  version: 1;
  service: ImageDefaultsService | "api";
  seed: number;
  /** Extra top-level fields for API image-generation requests. */
  customParameters?: Record<string, unknown>;
  /**
   * Non-secret extra HTTP headers for local-backend requests (ComfyUI, SwarmUI, AUTOMATIC1111).
   * Authentication stays host-managed: use the connection's API key field for that.
   */
  customHeaders?: Record<string, string>;
  /** Optional connection-scoped image style profile override. */
  styleProfileId?: string | null;
  automatic1111?: Automatic1111Defaults;
  comfyui?: ComfyUiDefaults;
  novelai?: NovelAiDefaults;
}
