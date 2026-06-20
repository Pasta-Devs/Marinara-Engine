import type { HapticDeviceCommand, HapticFeedbackPattern, HapticFeedbackSensitivity } from "@marinara-engine/shared";

export interface HapticRuntimeSettings {
  sensitivity: HapticFeedbackSensitivity;
  incidentalContact: boolean;
  intensityMultiplier: number;
  maxIntensity: number;
  maxDurationSeconds: number;
}

const HAPTIC_SENSITIVITY_SETTINGS: Record<
  HapticFeedbackSensitivity,
  Pick<HapticRuntimeSettings, "intensityMultiplier" | "maxIntensity" | "maxDurationSeconds">
> = {
  subtle: { intensityMultiplier: 0.65, maxIntensity: 0.55, maxDurationSeconds: 4 },
  standard: { intensityMultiplier: 1, maxIntensity: 0.8, maxDurationSeconds: 6 },
  intense: { intensityMultiplier: 1.2, maxIntensity: 0.9, maxDurationSeconds: 8 },
};

export const MAX_AGENT_HAPTIC_COMMANDS = 5;

export function getChatHapticIntifaceUrl(meta: Record<string, unknown>): string | undefined {
  const url = meta.hapticIntifaceUrl;
  if (typeof url !== "string") return undefined;
  return url.trim() || undefined;
}

export function normalizeHapticSensitivity(value: unknown): HapticFeedbackSensitivity {
  return value === "subtle" || value === "intense" ? value : "standard";
}

export function getChatHapticSettings(meta: Record<string, unknown>): HapticRuntimeSettings {
  const sensitivity = normalizeHapticSensitivity(meta.hapticSensitivity);
  const preset = HAPTIC_SENSITIVITY_SETTINGS[sensitivity];
  return {
    sensitivity,
    incidentalContact: meta.hapticIncidentalContact === true,
    ...preset,
  };
}

export function formatHapticSettingsForPrompt(settings: HapticRuntimeSettings): string {
  return [
    `sensitivity: ${settings.sensitivity}`,
    `incidentalContact: ${settings.incidentalContact ? "enabled" : "disabled"}`,
    `maxIntensity: ${settings.maxIntensity}`,
    `maxDurationSeconds: ${settings.maxDurationSeconds}`,
    settings.incidentalContact
      ? "brief accidental brushes may use very small tap/impact feedback"
      : "ignore incidental/accidental brushes unless the contact is deliberate or forceful",
  ].join("\n");
}

export function normalizeHapticAgentAction(action: unknown): HapticDeviceCommand["action"] | null {
  if (typeof action !== "string") return null;
  const key = action
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (key === "positionwithduration" || key === "hwpositionwithduration" || key === "linear") return "position";
  if (key === "vibrate") return "vibrate";
  if (key === "rotate") return "rotate";
  if (key === "oscillate") return "oscillate";
  if (key === "constrict") return "constrict";
  if (key === "inflate") return "inflate";
  if (key === "position") return "position";
  if (key === "stop") return "stop";
  return null;
}

function normalizeHapticAgentPattern(value: unknown): HapticFeedbackPattern | undefined {
  if (typeof value !== "string") return undefined;
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (key === "steady") return "steady";
  if (key === "tap") return "tap";
  if (key === "pulse") return "pulse";
  if (key === "wave") return "wave";
  if (key === "ramp") return "ramp";
  if (key === "impact") return "impact";
  return undefined;
}

function normalizeHapticAgentNumber(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : undefined;
}

function clampNumber(value: number | undefined, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, value));
}

function normalizeHapticAgentDeviceIndex(value: unknown): HapticDeviceCommand["deviceIndex"] {
  if (value === "all" || value === undefined || value === null) return "all";
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : "all";
}

export function normalizeHapticAgentCommand(
  command: Record<string, unknown>,
  settings?: HapticRuntimeSettings,
): HapticDeviceCommand | null {
  const action = normalizeHapticAgentAction(command.action);
  if (!action) return null;
  const rawIntensity = normalizeHapticAgentNumber(command.intensity);
  const rawDuration = normalizeHapticAgentNumber(command.duration);
  const maxIntensity = settings?.maxIntensity ?? 1;
  const intensityMultiplier = settings?.intensityMultiplier ?? 1;
  const maxDurationSeconds = settings?.maxDurationSeconds ?? 30;
  const intensity =
    action === "stop" ? undefined : clampNumber((rawIntensity ?? 0.5) * intensityMultiplier, 0, maxIntensity);
  const duration = action === "stop" ? undefined : clampNumber(rawDuration ?? 1.5, 0.15, maxDurationSeconds);
  const pattern = action === "stop" || action === "position" ? undefined : normalizeHapticAgentPattern(command.pattern);

  return {
    deviceIndex: normalizeHapticAgentDeviceIndex(command.deviceIndex),
    action,
    intensity,
    duration,
    ...(pattern ? { pattern } : {}),
  };
}

export function normalizeHapticAgentCommands(data: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(data.commands)) {
    return data.commands.filter(
      (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object",
    );
  }

  if (normalizeHapticAgentAction(data.action)) {
    return [data];
  }

  return [];
}
