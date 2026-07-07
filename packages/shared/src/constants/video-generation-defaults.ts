import type {
  GeminiOmniVideoDefaults,
  GoogleVeoVideoDefaults,
  OpenRouterVideoDefaults,
  SeedanceVideoDefaults,
  VideoAspectRatio,
  VideoDefaultsService,
  VideoGenerationDefaultsProfile,
  VideoReferenceUploadExpiry,
  VideoResolution,
  XaiVideoDefaults,
} from "../types/video-generation-defaults.js";

export const VIDEO_DEFAULTS_STORAGE_KEY = "videoGeneration";
export const VIDEO_GENERATION_DEFAULTS_VERSION = 1 as const;

export const VIDEO_DEFAULTS_SERVICES: VideoDefaultsService[] = [
  "gemini_omni",
  "google_veo",
  "xai",
  "openrouter",
  "seedance",
];

export const DEFAULT_GEMINI_OMNI_VIDEO_DEFAULTS: GeminiOmniVideoDefaults = {
  durationSeconds: 10,
  aspectRatio: "16:9",
};

export const DEFAULT_XAI_VIDEO_DEFAULTS: XaiVideoDefaults = {
  durationSeconds: 10,
  aspectRatio: "16:9",
  resolution: "720p",
};

export const DEFAULT_GOOGLE_VEO_VIDEO_DEFAULTS: GoogleVeoVideoDefaults = {
  durationSeconds: 8,
  aspectRatio: "16:9",
  resolution: "720p",
};

export const DEFAULT_OPENROUTER_VIDEO_DEFAULTS: OpenRouterVideoDefaults = {
  durationSeconds: 10,
  aspectRatio: "16:9",
  resolution: "720p",
};

export const DEFAULT_SEEDANCE_VIDEO_DEFAULTS: SeedanceVideoDefaults = {
  durationSeconds: 5,
  aspectRatio: "16:9",
  resolution: "720p",
  temporaryPublicReferenceUploadEnabled: false,
  temporaryPublicReferenceUploadExpiry: "12h",
};

export function createDefaultVideoGenerationProfile(
  service: VideoDefaultsService = "gemini_omni",
): VideoGenerationDefaultsProfile {
  return {
    version: VIDEO_GENERATION_DEFAULTS_VERSION,
    service,
    geminiOmni: { ...DEFAULT_GEMINI_OMNI_VIDEO_DEFAULTS },
    googleVeo: { ...DEFAULT_GOOGLE_VEO_VIDEO_DEFAULTS },
    xai: { ...DEFAULT_XAI_VIDEO_DEFAULTS },
    openrouter: { ...DEFAULT_OPENROUTER_VIDEO_DEFAULTS },
    seedance: { ...DEFAULT_SEEDANCE_VIDEO_DEFAULTS },
  };
}

export function normalizeVideoGenerationProfile(rawProfile: unknown): {
  profile: VideoGenerationDefaultsProfile;
  changed: boolean;
} {
  const profile = createDefaultVideoGenerationProfile();
  const raw = isRecord(rawProfile) ? rawProfile : {};
  const rawService = readService(raw.service);
  profile.service = rawService;
  const rawOmni = isRecord(raw.geminiOmni) ? raw.geminiOmni : rawService === "gemini_omni" ? raw : {};
  profile.geminiOmni = {
    durationSeconds: readInteger(
      rawOmni.durationSeconds,
      DEFAULT_GEMINI_OMNI_VIDEO_DEFAULTS.durationSeconds,
      1,
      60,
    ),
    aspectRatio: readAspectRatio(rawOmni.aspectRatio, DEFAULT_GEMINI_OMNI_VIDEO_DEFAULTS.aspectRatio),
  };
  const rawGoogleVeo = isRecord(raw.googleVeo) ? raw.googleVeo : rawService === "google_veo" ? raw : {};
  profile.googleVeo = {
    durationSeconds: readVeoDuration(
      rawGoogleVeo.durationSeconds,
      DEFAULT_GOOGLE_VEO_VIDEO_DEFAULTS.durationSeconds,
    ),
    aspectRatio: readAspectRatio(rawGoogleVeo.aspectRatio, DEFAULT_GOOGLE_VEO_VIDEO_DEFAULTS.aspectRatio),
    resolution: readResolution(rawGoogleVeo.resolution, DEFAULT_GOOGLE_VEO_VIDEO_DEFAULTS.resolution),
  };
  const rawXai = isRecord(raw.xai) ? raw.xai : rawService === "xai" ? raw : {};
  profile.xai = {
    durationSeconds: readInteger(rawXai.durationSeconds, DEFAULT_XAI_VIDEO_DEFAULTS.durationSeconds, 1, 15),
    aspectRatio: readAspectRatio(rawXai.aspectRatio, DEFAULT_XAI_VIDEO_DEFAULTS.aspectRatio),
    resolution: readResolution(rawXai.resolution, DEFAULT_XAI_VIDEO_DEFAULTS.resolution),
  };
  const rawOpenRouter = isRecord(raw.openrouter) ? raw.openrouter : rawService === "openrouter" ? raw : {};
  profile.openrouter = {
    durationSeconds: readInteger(
      rawOpenRouter.durationSeconds,
      DEFAULT_OPENROUTER_VIDEO_DEFAULTS.durationSeconds,
      1,
      60,
    ),
    aspectRatio: readAspectRatio(rawOpenRouter.aspectRatio, DEFAULT_OPENROUTER_VIDEO_DEFAULTS.aspectRatio),
    resolution: readResolution(rawOpenRouter.resolution, DEFAULT_OPENROUTER_VIDEO_DEFAULTS.resolution),
  };
  const rawSeedance = isRecord(raw.seedance) ? raw.seedance : rawService === "seedance" ? raw : {};
  profile.seedance = {
    durationSeconds: readInteger(rawSeedance.durationSeconds, DEFAULT_SEEDANCE_VIDEO_DEFAULTS.durationSeconds, 4, 15),
    aspectRatio: readAspectRatio(rawSeedance.aspectRatio, DEFAULT_SEEDANCE_VIDEO_DEFAULTS.aspectRatio),
    resolution: readResolution(rawSeedance.resolution, DEFAULT_SEEDANCE_VIDEO_DEFAULTS.resolution),
    temporaryPublicReferenceUploadEnabled: readBoolean(
      rawSeedance.temporaryPublicReferenceUploadEnabled,
      DEFAULT_SEEDANCE_VIDEO_DEFAULTS.temporaryPublicReferenceUploadEnabled,
    ),
    temporaryPublicReferenceUploadExpiry: readReferenceUploadExpiry(
      rawSeedance.temporaryPublicReferenceUploadExpiry,
      DEFAULT_SEEDANCE_VIDEO_DEFAULTS.temporaryPublicReferenceUploadExpiry,
    ),
  };
  const changed = JSON.stringify(profile) !== JSON.stringify(rawProfile);
  return { profile, changed };
}

export function sanitizeVideoGenerationProfile(profile: VideoGenerationDefaultsProfile): VideoGenerationDefaultsProfile {
  return normalizeVideoGenerationProfile(profile).profile;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.trunc(Math.min(max, Math.max(min, numeric)));
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return fallback;
}

function readVeoDuration(value: unknown, fallback: number): 4 | 6 | 8 {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback <= 5 ? 4 : fallback <= 7 ? 6 : 8;
  if (numeric <= 5) return 4;
  if (numeric <= 7) return 6;
  return 8;
}

function readService(value: unknown): VideoDefaultsService {
  return value === "xai" ||
    value === "openrouter" ||
    value === "seedance" ||
    value === "google_veo" ||
    value === "gemini_omni"
    ? value
    : "gemini_omni";
}

function readAspectRatio(value: unknown, fallback: VideoAspectRatio): VideoAspectRatio {
  return value === "9:16" || value === "16:9" ? value : fallback;
}

function readResolution(value: unknown, fallback: VideoResolution): VideoResolution {
  return value === "480p" || value === "720p" || value === "1080p" ? value : fallback;
}

function readReferenceUploadExpiry(value: unknown, fallback: VideoReferenceUploadExpiry): VideoReferenceUploadExpiry {
  return value === "1h" || value === "12h" || value === "24h" || value === "72h" ? value : fallback;
}
