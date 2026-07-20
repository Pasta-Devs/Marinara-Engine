export type ImageStyleBase =
  | "auto"
  | "anime"
  | "danbooru"
  | "realistic"
  | "photorealistic"
  | "cinematic"
  | "digital_painting"
  | "painterly"
  | "z_image_turbo"
  | "custom";

export type ImagePromptMode = "natural" | "tagged" | "danbooru" | "hybrid";

export type ImagePromptDedupeStrength = "light" | "normal" | "strict";

export type ImagePromptKind = "portrait" | "selfie" | "background" | "illustration" | "sprite" | "avatar";

export interface ImageStyleProfileRules {
  dedupeStrength: ImagePromptDedupeStrength;
  /** @deprecated Compatibility-only no-op. Accepted through 2.x; remove in the next major version. */
  preferTagsOverNarrative: boolean;
  /** @deprecated Compatibility-only no-op. Accepted through 2.x; remove in the next major version. */
  preserveUserPhrases: boolean;
}

export interface ImageStyleProfile {
  id: string;
  name: string;
  baseStyle: ImageStyleBase;
  promptMode: ImagePromptMode;
  styleText: string;
  positiveTags: string;
  negativeTags: string;
  subjectTags: Partial<Record<ImagePromptKind, string>>;
  rules: ImageStyleProfileRules;
  builtIn?: boolean;
}

export interface ImageStyleProfileSettings {
  defaultProfileId: string;
  profiles: ImageStyleProfile[];
}
