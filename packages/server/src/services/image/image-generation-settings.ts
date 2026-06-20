import type { DB } from "../../db/connection.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import {
  IMAGE_STYLE_PROFILES_STORAGE_KEY,
  normalizeImageStyleProfileSettings,
  type ImageStyleProfileSettings,
} from "@marinara-engine/shared";

export interface ImageGenerationSize {
  width: number;
  height: number;
}

export interface ImageGenerationUserSettings {
  background: ImageGenerationSize;
  illustration: ImageGenerationSize;
  portrait: ImageGenerationSize;
  selfie: ImageGenerationSize;
  styleProfiles: ImageStyleProfileSettings;
}

const IMAGE_DIMENSION_MIN = 64;
const IMAGE_DIMENSION_MAX = 4096;

const DEFAULT_IMAGE_GENERATION_SETTINGS: ImageGenerationUserSettings = {
  background: { width: 1280, height: 720 },
  illustration: { width: 896, height: 1280 },
  portrait: { width: 1024, height: 1024 },
  selfie: { width: 896, height: 1152 },
  styleProfiles: normalizeImageStyleProfileSettings(null),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function clampImageDimension(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(IMAGE_DIMENSION_MIN, Math.min(IMAGE_DIMENSION_MAX, Math.round(numeric)));
}

function readSize(raw: Record<string, unknown>, widthKey: string, heightKey: string, fallback: ImageGenerationSize) {
  return {
    width: clampImageDimension(raw[widthKey], fallback.width),
    height: clampImageDimension(raw[heightKey], fallback.height),
  };
}

export function parseImageGenerationUserSettings(raw: string | null): ImageGenerationUserSettings {
  if (!raw) return DEFAULT_IMAGE_GENERATION_SETTINGS;

  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULT_IMAGE_GENERATION_SETTINGS;

    return {
      background: readSize(
        parsed,
        "imageBackgroundWidth",
        "imageBackgroundHeight",
        DEFAULT_IMAGE_GENERATION_SETTINGS.background,
      ),
      illustration: readSize(
        parsed,
        "imageIllustrationWidth",
        "imageIllustrationHeight",
        DEFAULT_IMAGE_GENERATION_SETTINGS.illustration,
      ),
      portrait: readSize(
        parsed,
        "imagePortraitWidth",
        "imagePortraitHeight",
        DEFAULT_IMAGE_GENERATION_SETTINGS.portrait,
      ),
      selfie: readSize(parsed, "imageSelfieWidth", "imageSelfieHeight", DEFAULT_IMAGE_GENERATION_SETTINGS.selfie),
      styleProfiles: normalizeImageStyleProfileSettings(parsed[IMAGE_STYLE_PROFILES_STORAGE_KEY]),
    };
  } catch {
    return DEFAULT_IMAGE_GENERATION_SETTINGS;
  }
}

export async function loadImageGenerationUserSettings(db: DB): Promise<ImageGenerationUserSettings> {
  const raw = await createAppSettingsStorage(db).get("ui");
  return parseImageGenerationUserSettings(raw);
}
