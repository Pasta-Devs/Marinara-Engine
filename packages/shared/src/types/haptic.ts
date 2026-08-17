// ──────────────────────────────────────────────
// Types: Haptic Feedback (Buttplug.io)
// ──────────────────────────────────────────────

/** Capability of a connected haptic device. */
export type HapticCapability =
  | "vibrate"
  | "rotate"
  | "oscillate"
  | "constrict"
  | "inflate"
  | "position"
  | "temperature"
  | "spray"
  | "led";

export type HapticDeviceAction = HapticCapability | "stop";

/** Chat-level intensity scaling for automatic haptic feedback. */
export type HapticFeedbackSensitivity = "subtle" | "standard" | "intense";

/** Optional pattern hint for automatic haptic commands. */
export type HapticFeedbackPattern = "steady" | "tap" | "pulse" | "wave" | "ramp" | "impact";

/** A connected haptic device (client-facing representation). */
export interface HapticDevice {
  /** Buttplug device index */
  index: number;
  /** Display name (e.g. "Lovense Lush") */
  name: string;
  /** Capability-derived device type supplied to haptic agents. */
  type?: string;
  /** Supported output types */
  capabilities: HapticCapability[];
}

/** Status of the Buttplug connection. */
export interface HapticStatus {
  connected: boolean;
  serverUrl: string | null;
  /** Server-side default URL used when the client does not provide one. */
  defaultServerUrl?: string;
  scanning: boolean;
  devices: HapticDevice[];
}

/** A haptic command to send to a device. */
export interface HapticDeviceCommand {
  /** Device index (0 = first device, "all" = broadcast to all) */
  deviceIndex: number | "all";
  /** Action type */
  action: HapticDeviceAction;
  /** Intensity / speed (0.0-1.0) — not used for "stop" */
  intensity?: number;
  /** Duration in seconds — 0 or omitted means indefinite until next command */
  duration?: number;
  /** Optional pattern hint expanded by the server for automatic feedback. */
  pattern?: HapticFeedbackPattern;
}

/** Normalize model- and user-authored action names to protocol-backed actions. */
export function normalizeHapticAction(value: unknown): HapticDeviceAction | null {
  if (typeof value !== "string") return null;
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (
    key === "positionwithduration" ||
    key === "hwpositionwithduration" ||
    key === "linear" ||
    key === "stroke" ||
    key === "stroker" ||
    key === "thrust" ||
    key === "thrusting" ||
    key === "pump" ||
    key === "pumping"
  )
    return "position";
  if (key === "vibrate" || key === "vibration" || key === "vibrating") return "vibrate";
  if (key === "rotate" || key === "rotation" || key === "spin" || key === "spinning") return "rotate";
  if (key === "oscillate" || key === "oscillation" || key === "oscillating") return "oscillate";
  if (key === "constrict" || key === "constriction" || key === "squeeze" || key === "squeezing") return "constrict";
  if (key === "inflate" || key === "inflation" || key === "airpump") return "inflate";
  if (key === "position") return "position";
  if (key === "temperature" || key === "temp" || key === "heat" || key === "heating") return "temperature";
  if (key === "spray" || key === "dispense" || key === "dispensing") return "spray";
  if (key === "led" || key === "light" || key === "lighting") return "led";
  if (key === "stop") return "stop";
  return null;
}

/** Normalize optional named patterns used by automatic and inline commands. */
export function normalizeHapticPattern(value: unknown): HapticFeedbackPattern | undefined {
  if (typeof value !== "string") return undefined;
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (key === "steady") return "steady";
  if (key === "tap" || key === "tapping") return "tap";
  if (key === "pulse" || key === "pulsing") return "pulse";
  if (key === "wave" || key === "waves") return "wave";
  if (key === "ramp" || key === "ramping") return "ramp";
  if (key === "impact") return "impact";
  return undefined;
}
