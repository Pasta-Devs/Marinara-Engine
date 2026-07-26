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
  loras: ComfyUiLoraSetting[];
}

export interface NovelAiDefaults {
  promptPrefix: string;
  negativePromptPrefix: string;
  sampler: string;
  noiseSchedule: string;
  steps: number;
  promptGuidance: number;
  promptGuidanceRescale: number;
  undesiredContentPreset: number;
  dynamicResolutionBySubjectCount: boolean;
  /** Persistent V4.5 style-only director reference stored with this connection. */
  styleReferenceImage: string | null;
  styleReferenceStrength: number;
  styleReferenceFidelity: number;
}

export interface ImageGenerationDefaultsProfile {
  version: 1;
  service: ImageDefaultsService;
  seed: number;
  /** Optional connection-scoped image style profile override. */
  styleProfileId?: string | null;
  automatic1111?: Automatic1111Defaults;
  comfyui?: ComfyUiDefaults;
  novelai?: NovelAiDefaults;
}
