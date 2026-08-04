import { convoBehaviorInsertionStrategySchema } from "../schemas/character.schema.js";
import { normalizeStatIcon } from "../constants/stat-icons.js";
import type { ConvoBehaviorConfig, RPGStatPool, RPGStatsConfig } from "../types/character.js";
import type {
  PersonaStatBar,
  PersonaStatsConfig,
  TrackerCardColorConfig,
  TrackerCardColorMode,
  TrackerCardPortraitStageBackground,
} from "../types/persona.js";

type UnknownRecord = Record<string, unknown>;

/** Decode a serialized JSON value without turning malformed historical data into an exception. */
function decodeJsonValue(value: unknown): unknown {
  if (typeof value !== "string" || !value) return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function clampedInteger(value: unknown, max: number): number | undefined {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? Math.max(0, Math.min(max, Math.round(numeric))) : undefined;
}

function clampedPortraitZoom(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return undefined;
  return Math.round(Math.max(0.75, Math.min(2.35, numeric)) * 100) / 100;
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Retain only string entries from an untrusted serialized or decoded array. */
export function normalizePersonaStringArray(value: unknown): string[] {
  const decoded = decodeJsonValue(value);
  return Array.isArray(decoded) ? decoded.filter((item): item is string => typeof item === "string") : [];
}

/** Canonicalize serialized or decoded tracker configuration without UI presentation concerns. */
export function normalizeTrackerCardColorConfig(value: unknown): TrackerCardColorConfig & UnknownRecord {
  const config = decodeJsonValue(value);
  if (!isRecord(config)) return { mode: "chat" };
  const mode: TrackerCardColorMode =
    config.mode === "default" || config.mode === "chat" || config.mode === "custom" ? config.mode : "chat";
  const result: UnknownRecord = { ...config, mode };
  for (const key of ["displayEnabled", "accentEnabled", "surfaceEnabled"] as const) {
    if (typeof config[key] === "boolean") result[key] = config[key];
    else delete result[key];
  }
  for (const key of ["nameColor", "dialogueColor", "boxColor"] as const) {
    if (typeof config[key] === "string") result[key] = config[key];
    else delete result[key];
  }
  for (const key of [
    "nameColorOpacity",
    "dialogueColorOpacity",
    "boxColorOpacity",
    "tintIntensity",
    "materialBrightness",
    "glowIntensity",
    "contrastIntensity",
    "portraitFocusX",
  ] as const) {
    const normalized = clampedInteger(config[key], 100);
    if (normalized === undefined) delete result[key];
    else result[key] = normalized;
  }
  const portraitFocusY = clampedInteger(config.portraitFocusY, 140);
  if (portraitFocusY === undefined) delete result.portraitFocusY;
  else result.portraitFocusY = portraitFocusY;
  const portraitZoom = clampedPortraitZoom(config.portraitZoom);
  if (portraitZoom === undefined) delete result.portraitZoom;
  else result.portraitZoom = portraitZoom;
  const portraitStageBackground: TrackerCardPortraitStageBackground | undefined =
    config.portraitStageBackground === "ambient" ||
    config.portraitStageBackground === "spotlight" ||
    config.portraitStageBackground === "soft" ||
    config.portraitStageBackground === "plain"
      ? config.portraitStageBackground
      : undefined;
  if (portraitStageBackground === undefined) delete result.portraitStageBackground;
  else result.portraitStageBackground = portraitStageBackground;
  if (Array.isArray(config.statIcons)) {
    result.statIcons = config.statIcons.flatMap((assignment) => {
      if (
        !isRecord(assignment) ||
        typeof assignment.name !== "string" ||
        typeof assignment.occurrence !== "number" ||
        !Number.isInteger(assignment.occurrence) ||
        assignment.occurrence < 0
      )
        return [];
      const icon = assignment.icon === null ? null : normalizeStatIcon(assignment.icon);
      return assignment.icon !== null && !icon
        ? []
        : [{ ...assignment, name: assignment.name.trim(), occurrence: assignment.occurrence, icon }];
    });
  } else {
    delete result.statIcons;
  }
  return result as TrackerCardColorConfig & UnknownRecord;
}

function normalizeStatBar(value: unknown): (PersonaStatBar & UnknownRecord) | null {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    !Number.isFinite(value.value) ||
    !Number.isFinite(value.max) ||
    typeof value.color !== "string"
  )
    return null;
  return { ...value, name: value.name, value: value.value, max: value.max, color: value.color } as PersonaStatBar &
    UnknownRecord;
}

function normalizeRpgValueRange(value: number, max: number): { value: number; max: number } {
  const normalizedMax = Math.max(1, max);
  return { value: Math.max(0, Math.min(normalizedMax, value)), max: normalizedMax };
}

/** Tolerantly retain valid RPG subfields for stored-row projection. */
function normalizeRpgStats(value: unknown): (RPGStatsConfig & UnknownRecord) | undefined {
  if (
    !isRecord(value) ||
    typeof value.enabled !== "boolean" ||
    !Array.isArray(value.attributes) ||
    !isRecord(value.hp) ||
    !Number.isFinite(value.hp.value) ||
    !Number.isFinite(value.hp.max)
  )
    return undefined;
  const attributes = value.attributes.flatMap((attribute) =>
    isRecord(attribute) && typeof attribute.name === "string" && Number.isFinite(attribute.value)
      ? [{ ...attribute, name: attribute.name, value: attribute.value }]
      : [],
  );
  const pools = Array.isArray(value.pools)
    ? value.pools.flatMap((pool) => {
        const normalized = normalizeStatBar(pool);
        if (!normalized) return [];
        return [
          {
            ...normalized,
            ...normalizeRpgValueRange(normalized.value, normalized.max),
          } as RPGStatPool & UnknownRecord,
        ];
      })
    : undefined;
  const hp = normalizeRpgValueRange(value.hp.value as number, value.hp.max as number);
  const result: UnknownRecord = {
    ...value,
    enabled: value.enabled,
    attributes,
    hp: { ...value.hp, ...hp },
  };
  if (pools) result.pools = pools;
  else delete result.pools;
  return result as RPGStatsConfig & UnknownRecord;
}

/** Tolerantly retain valid Persona stat data for stored-row projection. */
export function normalizePersonaStats(value: unknown): (PersonaStatsConfig & UnknownRecord) | undefined {
  const config = decodeJsonValue(value);
  if (!isRecord(config) || typeof config.enabled !== "boolean" || !Array.isArray(config.bars)) return undefined;
  const bars = config.bars.flatMap((bar) => {
    const normalized = normalizeStatBar(bar);
    return normalized ? [normalized] : [];
  });
  const rpgStats = normalizeRpgStats(config.rpgStats);
  const result: UnknownRecord = { ...config, enabled: config.enabled, bars };
  if (rpgStats) result.rpgStats = rpgStats;
  else delete result.rpgStats;
  return result as PersonaStatsConfig & UnknownRecord;
}

/** Apply the established Conversation insertion fallback while preserving extensions. */
export function normalizeConvoBehavior(value: unknown): (ConvoBehaviorConfig & UnknownRecord) | undefined {
  const config = decodeJsonValue(value);
  if (!isRecord(config) || typeof config.instruction !== "string") return undefined;
  const parsedStrategy = config.insertionStrategy;
  const parsed = convoBehaviorInsertionStrategySchema.safeParse(parsedStrategy);
  const insertionStrategy = parsed.success ? parsed.data : "constant_after";
  return { ...config, instruction: config.instruction, insertionStrategy } as ConvoBehaviorConfig & UnknownRecord;
}
