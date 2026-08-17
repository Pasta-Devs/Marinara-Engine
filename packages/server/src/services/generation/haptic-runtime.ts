import {
  normalizeHapticAction,
  normalizeHapticPattern,
  type HapticCapability,
  type HapticDeviceCommand,
  type HapticFeedbackPattern,
  type HapticFeedbackSensitivity,
} from "@marinara-engine/shared";

export interface HapticRuntimeSettings {
  sensitivity: HapticFeedbackSensitivity;
  incidentalContact: boolean;
}

const HAPTIC_SENSITIVITY_GUIDANCE: Record<HapticFeedbackSensitivity, string> = {
  subtle: "favor gentler output for ordinary contact, but the full 0.0-1.0 range remains available",
  standard: "match intensity proportionally to the scene using the full 0.0-1.0 range",
  intense: "use stronger output more readily, including 1.0 when the scene clearly calls for full strength",
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
  return {
    sensitivity,
    incidentalContact: meta.hapticIncidentalContact === true,
  };
}

export function formatHapticSettingsForPrompt(settings: HapticRuntimeSettings): string {
  return [
    `sensitivity: ${settings.sensitivity}`,
    `incidentalContact: ${settings.incidentalContact ? "enabled" : "disabled"}`,
    `intensityRange: 0.0-1.0 (the selected sensitivity is guidance, not a hard cap)`,
    HAPTIC_SENSITIVITY_GUIDANCE[settings.sensitivity],
    settings.incidentalContact
      ? "brief accidental brushes may use very small tap/impact feedback"
      : "ignore incidental/accidental brushes unless the contact is deliberate or forceful",
  ].join("\n");
}

export function normalizeHapticAgentAction(action: unknown): HapticDeviceCommand["action"] | null {
  return normalizeHapticAction(action);
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
  _settings?: HapticRuntimeSettings,
): HapticDeviceCommand | null {
  const action = normalizeHapticAgentAction(command.action);
  if (!action) return null;
  const rawIntensity = normalizeHapticAgentNumber(command.intensity);
  const rawDuration = normalizeHapticAgentNumber(command.duration);
  const intensity = action === "stop" ? undefined : clampNumber(rawIntensity ?? 0.5, 0, 1);
  const duration = action === "stop" ? undefined : clampNumber(rawDuration ?? 1.5, 0.15, 30);
  const pattern = action === "stop" ? undefined : normalizeHapticPattern(command.pattern);

  return {
    deviceIndex: normalizeHapticAgentDeviceIndex(command.deviceIndex),
    action,
    intensity,
    duration,
    ...(pattern ? { pattern } : {}),
  };
}

const HAPTIC_DEVICE_TYPE_LABELS: Record<HapticCapability, string> = {
  vibrate: "vibrating",
  rotate: "rotating",
  oscillate: "oscillating",
  constrict: "constricting or squeezing",
  inflate: "inflatable or air-pump",
  position: "linear stroker, thruster, or pump",
  temperature: "temperature-controlled",
  spray: "spray or dispensing",
  led: "lighting",
};

export function describeHapticDeviceType(capabilities: readonly HapticCapability[]): string {
  const labels = [...new Set(capabilities.map((capability) => HAPTIC_DEVICE_TYPE_LABELS[capability]))];
  if (labels.length === 0) return "connected haptic device";
  if (labels.length === 1) return `${labels[0]} device`;
  return `multi-function device (${labels.join(", ")})`;
}

export interface HapticPatternStep {
  delayMs: number;
  intensity: number;
  duration: number;
}

function buildPositionPatternSteps(
  pattern: HapticFeedbackPattern,
  intensity: number,
  duration: number,
): HapticPatternStep[] {
  const total = Math.max(0.2, duration || 1.5);
  const target = Math.max(0.01, Math.min(1, intensity));
  const steps = (positions: number[]) => {
    const interval = total / positions.length;
    return positions.map((position, index) => ({
      delayMs: Math.round(interval * 1000 * index),
      intensity: Math.max(0, Math.min(1, target * position)),
      duration: Math.max(0.1, interval * 0.9),
    }));
  };

  switch (pattern) {
    case "tap":
      return steps([1, 0]);
    case "impact":
      return steps([1, 0.15]);
    case "pulse":
      return steps([1, 0, 1, 0]);
    case "wave":
      return steps([0.15, 0.55, 1, 0.55, 0.15]);
    case "ramp":
      return steps([0.25, 0.5, 0.75, 1]);
    case "steady":
    default:
      return [{ delayMs: 0, intensity: target, duration: total }];
  }
}

export function buildHapticPatternSteps(
  action: HapticDeviceCommand["action"],
  pattern: HapticFeedbackPattern,
  intensity: number,
  duration: number,
): HapticPatternStep[] {
  if (action === "position") return buildPositionPatternSteps(pattern, intensity, duration);

  const total = Math.max(0.2, duration || 1.5);
  const base = Math.max(0.01, Math.min(1, intensity));
  const scaled = (multiplier: number) => Math.max(0.01, Math.min(1, base * multiplier));

  switch (pattern) {
    case "tap":
      return [{ delayMs: 0, intensity: scaled(1), duration: Math.min(0.35, total) }];
    case "impact":
      return [
        { delayMs: 0, intensity: scaled(1.2), duration: Math.min(0.22, total) },
        { delayMs: Math.min(280, total * 500), intensity: scaled(0.35), duration: Math.min(0.3, total) },
      ];
    case "pulse": {
      const count = Math.max(2, Math.min(4, Math.round(total / 0.75)));
      const interval = (total * 1000) / count;
      return Array.from({ length: count }, (_, index) => ({
        delayMs: Math.round(interval * index),
        intensity: scaled(index % 2 === 0 ? 1 : 0.75),
        duration: Math.min(0.32, (interval / 1000) * 0.55),
      }));
    }
    case "wave": {
      const multipliers = [0.4, 0.75, 0.55, 1];
      const interval = (total * 1000) / multipliers.length;
      return multipliers.map((multiplier, index) => ({
        delayMs: Math.round(interval * index),
        intensity: scaled(multiplier),
        duration: Math.min(0.9, (interval / 1000) * 0.8),
      }));
    }
    case "ramp": {
      const multipliers = [0.35, 0.65, 1];
      const interval = (total * 1000) / multipliers.length;
      return multipliers.map((multiplier, index) => ({
        delayMs: Math.round(interval * index),
        intensity: scaled(multiplier),
        duration: Math.min(1.1, (interval / 1000) * 0.85),
      }));
    }
    case "steady":
    default:
      return [{ delayMs: 0, intensity: base, duration: total }];
  }
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
