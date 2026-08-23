import type { SpriteCharacterVisualSettings, SpriteSide } from "@marinara-engine/shared";
import { normalizeSpritePlacements, type SpritePlacementMap } from "./sprite-placement";
import {
  SPRITE_DISPLAY_OPACITY_MAX,
  SPRITE_DISPLAY_OPACITY_MIN,
  SPRITE_DISPLAY_SCALE_MAX,
  SPRITE_DISPLAY_SCALE_MIN,
} from "./sprite-display-modes";

const STORAGE_KEY = "marinara.localSpriteVisualSettings.v1";
const MAX_CHAT_SETTINGS = 250;

export type LocalSpriteVisualSettings = {
  spritePosition?: SpriteSide;
  spritePlacements?: SpritePlacementMap;
  expressionSpriteScale?: number;
  fullBodySpriteScale?: number;
  expressionSpriteOpacity?: number;
  fullBodySpriteOpacity?: number;
  expressionAvatarsEnabled?: boolean;
  characterOverrides?: Record<string, SpriteCharacterVisualSettings>;
};

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function clampFiniteNumber(value: unknown, min: number, max: number): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeSpriteCharacterVisualSettings(raw: unknown): SpriteCharacterVisualSettings {
  if (!raw || typeof raw !== "object") return {};

  const record = raw as Record<string, unknown>;
  const next: SpriteCharacterVisualSettings = {};

  if (record.spritePosition === "left" || record.spritePosition === "right") {
    next.spritePosition = record.spritePosition;
  }

  const expressionSpriteScale = clampFiniteNumber(
    record.expressionSpriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  if (expressionSpriteScale !== undefined) next.expressionSpriteScale = expressionSpriteScale;

  const fullBodySpriteScale = clampFiniteNumber(
    record.fullBodySpriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  if (fullBodySpriteScale !== undefined) next.fullBodySpriteScale = fullBodySpriteScale;

  const expressionSpriteOpacity = clampFiniteNumber(
    record.expressionSpriteOpacity,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  if (expressionSpriteOpacity !== undefined) next.expressionSpriteOpacity = expressionSpriteOpacity;

  const fullBodySpriteOpacity = clampFiniteNumber(
    record.fullBodySpriteOpacity,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  if (fullBodySpriteOpacity !== undefined) next.fullBodySpriteOpacity = fullBodySpriteOpacity;

  return next;
}

export function normalizeSpriteCharacterVisualSettingsMap(raw: unknown): Record<string, SpriteCharacterVisualSettings> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .map(([characterId, value]) => {
        const normalizedId = characterId.trim();
        if (!normalizedId) return null;
        const settings = normalizeSpriteCharacterVisualSettings(value);
        if (Object.keys(settings).length === 0) return null;
        return [normalizedId, settings] as const;
      })
      .filter((entry): entry is readonly [string, SpriteCharacterVisualSettings] => entry !== null),
  );
}

function normalizeLocalSpriteVisualSettings(raw: unknown): LocalSpriteVisualSettings {
  if (!raw || typeof raw !== "object") return {};

  const record = raw as Record<string, unknown>;
  const next: LocalSpriteVisualSettings = {};

  if (record.spritePosition === "left" || record.spritePosition === "right") {
    next.spritePosition = record.spritePosition;
  }

  if ("spritePlacements" in record) {
    next.spritePlacements = normalizeSpritePlacements(record.spritePlacements);
  }

  const expressionSpriteScale = clampFiniteNumber(
    record.expressionSpriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  if (expressionSpriteScale !== undefined) next.expressionSpriteScale = expressionSpriteScale;

  const fullBodySpriteScale = clampFiniteNumber(
    record.fullBodySpriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  if (fullBodySpriteScale !== undefined) next.fullBodySpriteScale = fullBodySpriteScale;

  const expressionSpriteOpacity = clampFiniteNumber(
    record.expressionSpriteOpacity,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  if (expressionSpriteOpacity !== undefined) next.expressionSpriteOpacity = expressionSpriteOpacity;

  const fullBodySpriteOpacity = clampFiniteNumber(
    record.fullBodySpriteOpacity,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  if (fullBodySpriteOpacity !== undefined) next.fullBodySpriteOpacity = fullBodySpriteOpacity;

  if (typeof record.expressionAvatarsEnabled === "boolean") {
    next.expressionAvatarsEnabled = record.expressionAvatarsEnabled;
  }

  if (Object.prototype.hasOwnProperty.call(record, "characterOverrides")) {
    next.characterOverrides = normalizeSpriteCharacterVisualSettingsMap(record.characterOverrides);
  }

  return next;
}

function readAllLocalSpriteVisualSettings(): Record<string, LocalSpriteVisualSettings> {
  if (!canUseLocalStorage()) return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([chatId, value]) => {
          if (!chatId.trim()) return null;
          return [chatId, normalizeLocalSpriteVisualSettings(value)] as const;
        })
        .filter((entry): entry is readonly [string, LocalSpriteVisualSettings] => entry !== null),
    );
  } catch {
    return {};
  }
}

function writeAllLocalSpriteVisualSettings(settings: Record<string, LocalSpriteVisualSettings>): void {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Local sprite layout is a preference cache; storage failures should never block chat.
  }
}

export function loadLocalSpriteVisualSettings(chatId: string | null | undefined): LocalSpriteVisualSettings {
  if (!chatId) return {};
  return readAllLocalSpriteVisualSettings()[chatId] ?? {};
}

export function copyLocalSpriteVisualSettings(sourceChatId: string, targetChatId: string): void {
  const source = loadLocalSpriteVisualSettings(sourceChatId);
  if (Object.keys(source).length === 0) return;
  saveLocalSpriteVisualSettings(targetChatId, source);
}

export function saveLocalSpriteVisualSettings(
  chatId: string,
  patch: Partial<LocalSpriteVisualSettings>,
  previous?: LocalSpriteVisualSettings,
): LocalSpriteVisualSettings {
  const allSettings = readAllLocalSpriteVisualSettings();
  const current = previous ?? allSettings[chatId] ?? {};
  const next = normalizeLocalSpriteVisualSettings({ ...current, ...patch });

  const nextAllSettings = { ...allSettings };
  delete nextAllSettings[chatId];
  nextAllSettings[chatId] = next;
  const entries = Object.entries(nextAllSettings);
  const trimmedEntries = entries.slice(Math.max(0, entries.length - MAX_CHAT_SETTINGS));
  writeAllLocalSpriteVisualSettings(Object.fromEntries(trimmedEntries));

  return next;
}
