import type {
  ImagePromptDedupeStrength,
  ImagePromptKind,
  ImageStyleProfile,
  ImageStyleProfileRules,
  ImageStyleProfileSettings,
} from "../types/image-style-profile.js";

export const IMAGE_STYLE_PROFILES_STORAGE_KEY = "imageStyleProfiles";
export const DEFAULT_IMAGE_STYLE_PROFILE_ID = "auto";
const MAX_IMAGE_STYLE_PROFILES = 100;

const DEFAULT_RULES: ImageStyleProfileRules = {
  dedupeStrength: "normal",
  preferTagsOverNarrative: false,
  preserveUserPhrases: true,
};

const TAGGED_RULES: ImageStyleProfileRules = {
  dedupeStrength: "normal",
  preferTagsOverNarrative: true,
  preserveUserPhrases: true,
};

export const DEFAULT_IMAGE_STYLE_PROFILES: ImageStyleProfile[] = [
  {
    id: "auto",
    name: "Auto",
    baseStyle: "auto",
    promptMode: "hybrid",
    styleText: "Infer a consistent visual style from the character, game, scene, and selected image model.",
    positiveTags: "",
    negativeTags: "text, watermark, logo, signature, low quality, blurry",
    subjectTags: {},
    rules: DEFAULT_RULES,
    builtIn: true,
  },
  {
    id: "anime",
    name: "Anime",
    baseStyle: "anime",
    promptMode: "tagged",
    styleText:
      "Anime illustration with clean character design, expressive faces, crisp linework, and polished lighting.",
    positiveTags: "anime style, illustration, best quality, detailed eyes, clean lineart",
    negativeTags: "photorealistic, 3d render, lowres, bad anatomy, bad hands, text, watermark, logo, signature",
    subjectTags: {
      portrait: "solo, portrait, upper body, looking at viewer",
      avatar: "solo, portrait, upper body, centered composition",
      selfie: "solo, selfie, close-up, looking at viewer",
      background: "scenery, environment, no humans",
      illustration: "visual novel CG, cinematic composition, full-frame single scene",
      sprite: "solo, full body, transparent background, visual novel sprite",
    },
    rules: TAGGED_RULES,
    builtIn: true,
  },
  {
    id: "danbooru",
    name: "Danbooru / Illustrious",
    baseStyle: "danbooru",
    promptMode: "danbooru",
    styleText: "Danbooru-tagged anime generation for SDXL, Illustrious, Pony, NovelAI, and similar checkpoints.",
    positiveTags: "masterpiece, best quality, absurdres, anime screencap, detailed eyes",
    negativeTags:
      "worst quality, low quality, lowres, bad anatomy, bad hands, extra digits, fewer digits, text, watermark, logo, signature",
    subjectTags: {
      portrait: "1girl, solo, portrait, upper body, looking at viewer",
      avatar: "solo, portrait, upper body, centered composition",
      selfie: "solo, selfie, close-up, looking at viewer",
      background: "scenery, environment, landscape, no humans",
      illustration: "visual novel CG, cinematic composition, dramatic lighting",
      sprite: "solo, full body, standing, transparent background",
    },
    rules: TAGGED_RULES,
    builtIn: true,
  },
  {
    id: "realistic",
    name: "Realistic SDXL",
    baseStyle: "realistic",
    promptMode: "natural",
    styleText:
      "Realistic SDXL-style image with natural lighting, believable materials, lens-aware composition, and sharp detail.",
    positiveTags: "high quality, realistic, detailed, natural lighting",
    negativeTags: "anime, cartoon, illustration, low quality, blurry, plastic skin, text, watermark, logo, signature",
    subjectTags: {
      portrait: "single subject, portrait, shoulders-up composition",
      avatar: "single subject, centered portrait, readable face",
      selfie: "single subject, casual selfie, natural expression",
      background: "wide environmental shot, no people",
      illustration: "cinematic scene, coherent composition",
      sprite: "single subject, full-body character reference",
    },
    rules: { ...DEFAULT_RULES, preferTagsOverNarrative: false },
    builtIn: true,
  },
  {
    id: "photorealistic",
    name: "Photorealistic",
    baseStyle: "photorealistic",
    promptMode: "natural",
    styleText:
      "Photorealistic SDXL image with believable skin, optics, materials, camera framing, and natural scene lighting.",
    positiveTags: "photorealistic, high quality, sharp focus, natural lighting, detailed textures",
    negativeTags:
      "anime, cartoon, illustration, painting, plastic skin, uncanny face, low quality, blurry, text, watermark, logo, signature",
    subjectTags: {
      portrait: "single subject, realistic portrait, shoulders-up composition",
      avatar: "single subject, centered face-and-shoulders portrait",
      selfie: "single subject, realistic casual selfie, natural expression",
      background: "real location environment, wide shot, no people",
      illustration: "photoreal cinematic still, coherent scene, clear focal point",
      sprite: "single subject, full-body reference photo, plain background",
    },
    rules: { ...DEFAULT_RULES, preferTagsOverNarrative: false },
    builtIn: true,
  },
  {
    id: "cinematic",
    name: "Cinematic",
    baseStyle: "cinematic",
    promptMode: "hybrid",
    styleText:
      "Cinematic key art with controlled lighting, strong composition, atmospheric depth, and emotionally clear staging.",
    positiveTags: "cinematic lighting, dramatic composition, atmospheric, high detail",
    negativeTags: "flat lighting, cluttered composition, text, watermark, logo, signature, low quality",
    subjectTags: {
      portrait: "single subject, portrait, expressive face",
      avatar: "single subject, centered portrait",
      selfie: "single subject, close-up, expressive face",
      background: "wide shot, environmental storytelling, no text",
      illustration: "cinematic composition, clear focal point, dramatic lighting",
      sprite: "single subject, readable silhouette",
    },
    rules: DEFAULT_RULES,
    builtIn: true,
  },
  {
    id: "digital-painting",
    name: "Digital Painting",
    baseStyle: "digital_painting",
    promptMode: "hybrid",
    styleText: "Digital painting with refined brushwork, designed lighting, strong silhouettes, and polished detail.",
    positiveTags: "digital painting, concept art, refined brushwork, high detail, designed lighting",
    negativeTags: "photograph, raw photo, muddy details, flat lighting, text, watermark, logo, signature, low quality",
    subjectTags: {
      portrait: "single subject, character portrait, expressive face",
      avatar: "single subject, centered character portrait",
      selfie: "single subject, close-up, painterly expression",
      background: "painted environment, atmospheric scene, no humans",
      illustration: "key art composition, clear focal point, dramatic lighting",
      sprite: "single subject, full-body character concept art",
    },
    rules: DEFAULT_RULES,
    builtIn: true,
  },
  {
    id: "painterly",
    name: "Painterly Fantasy",
    baseStyle: "painterly",
    promptMode: "hybrid",
    styleText: "Painterly fantasy illustration with soft brushwork, rich atmosphere, and storybook color harmony.",
    positiveTags: "painterly, fantasy illustration, soft brushwork, rich atmosphere, high detail",
    negativeTags: "photorealistic, flat colors, muddy details, text, watermark, logo, signature, low quality",
    subjectTags: {
      portrait: "single subject, portrait, painterly character art",
      avatar: "single subject, centered portrait, painterly avatar",
      selfie: "single subject, intimate close-up, painterly lighting",
      background: "fantasy scenery, environment, no humans",
      illustration: "storybook composition, dramatic lighting, clear focal point",
      sprite: "single subject, full-body character art",
    },
    rules: DEFAULT_RULES,
    builtIn: true,
  },
  {
    id: "z-image-turbo",
    name: "Z-Image Turbo Narrative",
    baseStyle: "z_image_turbo",
    promptMode: "natural",
    styleText:
      "Z-Image Turbo prompt that keeps compact narrative expression, coherent subjects, clear composition, and natural visual intent.",
    positiveTags: "",
    negativeTags: "text, watermark, logo, signature, low quality, blurry, malformed hands, distorted face",
    subjectTags: {
      portrait: "A centered portrait with readable expression and clear face-and-shoulders composition.",
      avatar: "A clean avatar portrait with a clear silhouette and readable face.",
      selfie: "A natural close-up selfie with a coherent face, expression, lighting, and background.",
      background: "A coherent environmental image with clear location details and no text.",
      illustration: "A single coherent scene illustration with clear subjects, staging, mood, and lighting.",
      sprite: "A full-body character image with a readable silhouette and clean separation from the background.",
    },
    rules: { ...DEFAULT_RULES, preferTagsOverNarrative: false, preserveUserPhrases: true },
    builtIn: true,
  },
];

export function createDefaultImageStyleProfileSettings(): ImageStyleProfileSettings {
  return {
    defaultProfileId: DEFAULT_IMAGE_STYLE_PROFILE_ID,
    profiles: DEFAULT_IMAGE_STYLE_PROFILES.map((profile) => cloneProfile(profile)),
  };
}

export function normalizeImageStyleProfileSettings(raw: unknown): ImageStyleProfileSettings {
  const defaults = createDefaultImageStyleProfileSettings();
  if (!isRecord(raw)) return defaults;

  const rawProfiles = Array.isArray(raw.profiles) ? raw.profiles.slice(0, MAX_IMAGE_STYLE_PROFILES) : [];
  const customProfiles = rawProfiles
    .map((profile) => normalizeImageStyleProfile(profile))
    .filter((profile): profile is ImageStyleProfile => !!profile);

  const byId = new Map<string, ImageStyleProfile>();
  for (const profile of defaults.profiles) byId.set(profile.id, profile);
  for (const profile of customProfiles) byId.set(profile.id, profile);

  const profiles = Array.from(byId.values());
  const rawDefaultId = typeof raw.defaultProfileId === "string" ? raw.defaultProfileId : defaults.defaultProfileId;
  const defaultProfileId = profiles.some((profile) => profile.id === rawDefaultId)
    ? rawDefaultId
    : defaults.defaultProfileId;

  return { defaultProfileId, profiles };
}

export function normalizeImageStyleProfile(raw: unknown): ImageStyleProfile | null {
  if (!isRecord(raw)) return null;
  const id = slugId(readString(raw.id, ""));
  if (!id) return null;

  const fallback = DEFAULT_IMAGE_STYLE_PROFILES.find((profile) => profile.id === id);
  const subjectTags = isRecord(raw.subjectTags) ? raw.subjectTags : {};

  return {
    id,
    name: readString(raw.name, fallback?.name ?? titleFromId(id)).slice(0, 80),
    baseStyle: readEnum(
      raw.baseStyle,
      [
        "auto",
        "anime",
        "danbooru",
        "realistic",
        "photorealistic",
        "cinematic",
        "digital_painting",
        "painterly",
        "z_image_turbo",
        "custom",
      ],
      fallback?.baseStyle ?? "custom",
    ),
    promptMode: readEnum(raw.promptMode, ["natural", "tagged", "danbooru", "hybrid"], fallback?.promptMode ?? "hybrid"),
    styleText: readString(raw.styleText, fallback?.styleText ?? "").slice(0, 2000),
    positiveTags: readString(raw.positiveTags, fallback?.positiveTags ?? "").slice(0, 4000),
    negativeTags: readString(raw.negativeTags, fallback?.negativeTags ?? "").slice(0, 4000),
    subjectTags: normalizeSubjectTags(subjectTags, fallback?.subjectTags),
    rules: normalizeRules(raw.rules, fallback?.rules ?? DEFAULT_RULES),
    builtIn: !!fallback,
  };
}

export function suggestImageStyleProfileIdForModel(
  model: string | null | undefined,
  source?: string | null,
  service?: string | null,
): string | null {
  const haystack = [model, source, service].filter(Boolean).join(" ").toLowerCase();
  if (!haystack.trim()) return null;

  if (/(?:z[-_\s]?image|zit|z[-_\s]?image[-_\s]?turbo)/.test(haystack)) return "z-image-turbo";
  if (/(?:illustrious|pony|noobai|novelai|nai|danbooru|e621|animagine|kohaku)/.test(haystack)) return "danbooru";
  if (/(?:realvis|juggernaut|epicrealism|realistic|photoreal|photo|albedo|cyberrealistic)/.test(haystack)) {
    return "photorealistic";
  }
  if (/(?:dreamshaper|cinematic|film|movie|still)/.test(haystack)) return "cinematic";
  if (/(?:digital[-_\s]?painting|concept[-_\s]?art|paint|illustration)/.test(haystack)) return "digital-painting";
  if (/(?:anime|anything|counterfeit|meinahentai|meinamix|abyssorangemix|waifu|manga)/.test(haystack)) return "anime";
  if (/(?:sdxl|stable[-_\s]?diffusion[-_\s]?xl|xl)/.test(haystack)) return "realistic";
  return null;
}

export function findImageStyleProfile(
  settings: ImageStyleProfileSettings,
  profileId: string | null | undefined,
): ImageStyleProfile {
  const id = profileId?.trim() || settings.defaultProfileId || DEFAULT_IMAGE_STYLE_PROFILE_ID;
  return (
    settings.profiles.find((profile) => profile.id === id) ??
    settings.profiles.find((profile) => profile.id === settings.defaultProfileId) ??
    settings.profiles.find((profile) => profile.id === DEFAULT_IMAGE_STYLE_PROFILE_ID) ??
    DEFAULT_IMAGE_STYLE_PROFILES[0]!
  );
}

function normalizeSubjectTags(
  raw: Record<string, unknown>,
  fallback: Partial<Record<ImagePromptKind, string>> = {},
): Partial<Record<ImagePromptKind, string>> {
  const result: Partial<Record<ImagePromptKind, string>> = {};
  for (const kind of ["portrait", "selfie", "background", "illustration", "sprite", "avatar"] as const) {
    result[kind] = readString(raw[kind], fallback[kind] ?? "").slice(0, 1000);
  }
  return result;
}

function normalizeRules(raw: unknown, fallback: ImageStyleProfileRules): ImageStyleProfileRules {
  const record = isRecord(raw) ? raw : {};
  return {
    dedupeStrength: readEnum(
      record.dedupeStrength,
      ["light", "normal", "strict"] satisfies ImagePromptDedupeStrength[],
      fallback.dedupeStrength,
    ),
    preferTagsOverNarrative: readBoolean(record.preferTagsOverNarrative, fallback.preferTagsOverNarrative),
    preserveUserPhrases: readBoolean(record.preserveUserPhrases, fallback.preserveUserPhrases),
  };
}

function cloneProfile(profile: ImageStyleProfile): ImageStyleProfile {
  return {
    ...profile,
    subjectTags: { ...profile.subjectTags },
    rules: { ...profile.rules },
  };
}

function titleFromId(id: string): string {
  return id
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readEnum<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && (values as readonly string[]).includes(value) ? (value as T) : fallback;
}
