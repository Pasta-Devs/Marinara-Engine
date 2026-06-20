// ──────────────────────────────────────────────
// Service: Buttplug.io Device Manager
// ──────────────────────────────────────────────
import { logger } from "../../lib/logger.js";
// Singleton service that connects to an Intiface Central server
// and manages haptic device discovery, tracking, and command execution.
//
// Intiface Central runs locally and exposes a WebSocket at ws://localhost:12345.
// This service wraps the buttplug.io client library for use in the generation pipeline.

import {
  ButtplugClient,
  ButtplugNodeWebsocketClientConnector,
  ButtplugClientDevice,
  DeviceOutput,
  DeviceOutputValueConstructor,
  OutputType,
} from "buttplug";
import type {
  HapticDevice,
  HapticCapability,
  HapticDeviceCommand,
  HapticFeedbackPattern,
  HapticStatus,
} from "@marinara-engine/shared";
import { getIntifaceUrl } from "../../config/runtime-config.js";

const POSITION_WITH_DURATION_OUTPUT =
  (OutputType as unknown as Record<string, OutputType | undefined>).HwPositionWithDuration ??
  (OutputType as unknown as Record<string, OutputType | undefined>).PositionWithDuration ??
  null;

/** OutputType values we map to capabilities. */
const CAPABILITY_TYPES: Array<{ type: OutputType; cap: HapticCapability }> = [
  { type: OutputType.Vibrate, cap: "vibrate" },
  { type: OutputType.Rotate, cap: "rotate" },
  { type: OutputType.Oscillate, cap: "oscillate" },
  { type: OutputType.Constrict, cap: "constrict" },
  { type: OutputType.Inflate, cap: "inflate" },
  { type: OutputType.Position, cap: "position" },
];
if (POSITION_WITH_DURATION_OUTPUT) CAPABILITY_TYPES.push({ type: POSITION_WITH_DURATION_OUTPUT, cap: "position" });

/** Map our action strings to buttplug OutputType. */
const ACTION_TO_OUTPUT: Partial<Record<HapticDeviceCommand["action"], OutputType>> = {
  vibrate: OutputType.Vibrate,
  rotate: OutputType.Rotate,
  oscillate: OutputType.Oscillate,
  constrict: OutputType.Constrict,
  inflate: OutputType.Inflate,
};

const ACTION_FALLBACKS: Partial<Record<HapticDeviceCommand["action"], HapticDeviceCommand["action"][]>> = {
  oscillate: ["vibrate"],
  rotate: ["vibrate"],
  constrict: ["vibrate"],
  inflate: ["vibrate"],
  position: ["vibrate"],
};

function normalizeAction(action: unknown): HapticDeviceCommand["action"] | null {
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

function clampUnit(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
}

function durationSeconds(value: unknown): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

interface HapticPatternStep {
  delayMs: number;
  intensity: number;
  duration: number;
}

function normalizePattern(value: unknown): HapticFeedbackPattern | null {
  if (typeof value !== "string") return null;
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
  return null;
}

function buildPatternSteps(pattern: HapticFeedbackPattern, intensity: number, duration: number): HapticPatternStep[] {
  const total = Math.max(0.2, Math.min(8, duration || 1.5));
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

function deviceName(device: ButtplugClientDevice): string {
  return device.displayName || device.name || `Device ${device.index}`;
}

/** Helper: get all devices from the client Map as an array. */
function devicesArray(client: ButtplugClient): ButtplugClientDevice[] {
  return [...client.devices.values()];
}

function deviceToDTO(device: ButtplugClientDevice): HapticDevice {
  const capabilities: HapticCapability[] = [];
  for (const { type, cap } of CAPABILITY_TYPES) {
    if (device.hasOutput(type) && !capabilities.includes(cap)) {
      capabilities.push(cap);
    }
  }
  return {
    index: device.index,
    name: device.displayName || device.name,
    capabilities,
  };
}

class ButtplugService {
  private client: ButtplugClient;
  private serverUrl: string | null = null;
  private preferredServerUrl: string | null = null;
  private stopTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private patternTimerCounter = 0;

  constructor() {
    this.client = new ButtplugClient("Marinara Engine");

    // Track device events
    this.client.addListener("deviceadded", (device: ButtplugClientDevice) => {
      logger.info(`[haptic] Device connected: ${device.displayName || device.name} (index ${device.index})`);
    });
    this.client.addListener("deviceremoved", (device: ButtplugClientDevice) => {
      logger.info(`[haptic] Device disconnected: ${device.displayName || device.name} (index ${device.index})`);
    });
    this.client.addListener("serverdisconnect", () => {
      logger.info("[haptic] Disconnected from Intiface Central");
      this.serverUrl = null;
    });
  }

  get connected(): boolean {
    return this.client.connected;
  }

  get devices(): HapticDevice[] {
    if (!this.client.connected) return [];
    return devicesArray(this.client).map(deviceToDTO);
  }

  get scanning(): boolean {
    return this.client.isScanning;
  }

  /** Get current status. */
  status(): HapticStatus {
    return {
      connected: this.connected,
      serverUrl: this.serverUrl,
      defaultServerUrl: this.preferredServerUrl ?? getIntifaceUrl(),
      scanning: this.scanning,
      devices: this.devices,
    };
  }

  /** Connect to Intiface Central server. */
  async connect(url?: string): Promise<void> {
    if (this.client.connected) return;
    const requestedUrl = url?.trim() || null;
    const target = requestedUrl ?? this.preferredServerUrl ?? getIntifaceUrl();
    const connector = new ButtplugNodeWebsocketClientConnector(target);
    await this.client.connect(connector);
    this.serverUrl = target;
    if (requestedUrl) this.preferredServerUrl = requestedUrl;
    logger.info(`[haptic] Connected to Intiface Central at ${target}`);
  }

  /** Disconnect from Intiface Central. */
  async disconnect(): Promise<void> {
    if (!this.client.connected) return;
    this.clearAllTimers();
    await this.client.disconnect();
    this.serverUrl = null;
    logger.info("[haptic] Disconnected");
  }

  /** Start scanning for devices. */
  async startScanning(): Promise<void> {
    if (!this.client.connected) throw new Error("Not connected to Intiface Central");
    await this.client.startScanning();
  }

  /** Stop scanning for devices. */
  async stopScanning(): Promise<void> {
    if (!this.client.connected) return;
    await this.client.stopScanning();
  }

  /** Stop all devices. */
  async stopAll(): Promise<void> {
    if (!this.client.connected) return;
    this.clearAllTimers();
    await this.client.stopAllDevices();
  }

  /** Execute a haptic command. */
  async executeCommand(cmd: HapticDeviceCommand): Promise<void> {
    await this.executeCommandInternal(cmd, { clearExistingTimers: true });
  }

  private async executeCommandInternal(
    cmd: HapticDeviceCommand,
    options: { clearExistingTimers: boolean },
  ): Promise<void> {
    if (!this.client.connected) throw new Error("Not connected to Intiface Central");

    const targets = this.resolveTargets(cmd.deviceIndex);
    if (targets.length === 0) throw new Error(`No connected haptic devices matched target ${cmd.deviceIndex}`);

    const action = normalizeAction(cmd.action);
    if (!action) throw new Error(`Unknown action: ${String(cmd.action)}`);

    if (options.clearExistingTimers) this.clearTimersForTarget(cmd.deviceIndex);

    // Handle stop command
    if (action === "stop") {
      this.clearTimersForTarget(cmd.deviceIndex);
      for (const device of targets) {
        await device.stop();
      }
      return;
    }

    const pattern = normalizePattern(cmd.pattern);
    if (pattern && pattern !== "steady" && action !== "position") {
      await this.executePatternCommand(cmd, pattern);
      return;
    }

    const outputType = ACTION_TO_OUTPUT[action];
    const intensity = clampUnit(cmd.intensity, 0.5);
    const duration = durationSeconds(cmd.duration);
    let successfulTargets = 0;
    let firstFailure: unknown = null;
    const unsupportedDevices: string[] = [];

    for (const device of targets) {
      try {
        if (action === "position") {
          const durationMs = Math.max(1, duration || 1) * 1000;
          if (POSITION_WITH_DURATION_OUTPUT && device.hasOutput(POSITION_WITH_DURATION_OUTPUT)) {
            await device.runOutput(DeviceOutput.PositionWithDuration.percent(intensity, durationMs));
            successfulTargets++;
          } else if (device.hasOutput(OutputType.Position)) {
            await device.runOutput(DeviceOutput.Position.percent(intensity));
            successfulTargets++;
          } else if (device.hasOutput(OutputType.Vibrate)) {
            await device.runOutput(DeviceOutput.Vibrate.percent(intensity));
            successfulTargets++;
            logger.debug("[haptic] Device %s does not support position; used vibrate fallback", deviceName(device));
          } else {
            unsupportedDevices.push(deviceName(device));
          }
          continue;
        }

        let selectedOutputType = outputType;
        if (!selectedOutputType || !device.hasOutput(selectedOutputType)) {
          const fallbackAction = (ACTION_FALLBACKS[action] ?? []).find((candidate) => {
            const fallbackOutput = ACTION_TO_OUTPUT[candidate];
            return fallbackOutput ? device.hasOutput(fallbackOutput) : false;
          });
          selectedOutputType = fallbackAction ? ACTION_TO_OUTPUT[fallbackAction] : undefined;
          if (fallbackAction) {
            logger.debug(
              "[haptic] Device %s does not support %s; used %s fallback",
              deviceName(device),
              action,
              fallbackAction,
            );
          }
        }

        if (!selectedOutputType || !device.hasOutput(selectedOutputType)) {
          unsupportedDevices.push(deviceName(device));
          continue;
        }
        const outCmd = new DeviceOutputValueConstructor(selectedOutputType).percent(intensity);
        await device.runOutput(outCmd);
        successfulTargets++;
      } catch (err) {
        firstFailure ??= err;
        logger.warn(err, "[haptic] Command %s failed for %s (index %d)", action, deviceName(device), device.index);
      }
    }

    if (successfulTargets === 0 && firstFailure) {
      throw firstFailure instanceof Error ? firstFailure : new Error(String(firstFailure));
    }
    if (successfulTargets === 0) {
      const targetNames = unsupportedDevices.length > 0 ? unsupportedDevices.join(", ") : "selected devices";
      throw new Error(`No compatible haptic outputs for action "${action}" on ${targetNames}`);
    }

    // Schedule auto-stop if duration is specified and action isn't position
    if (duration > 0 && action !== "position" && successfulTargets > 0) {
      this.setStopTimer(cmd.deviceIndex, duration, targets);
    }
  }

  /** Execute multiple commands in sequence (e.g. from agent output). */
  async executeCommands(commands: HapticDeviceCommand[]): Promise<void> {
    for (const cmd of commands) {
      await this.executeCommand(cmd);
    }
  }

  private resolveTargets(deviceIndex: number | "all"): ButtplugClientDevice[] {
    const all = devicesArray(this.client);
    if (deviceIndex === "all") return all;
    const device = this.client.devices.get(deviceIndex);
    return device ? [device] : []; // return empty if index not found
  }

  private async executePatternCommand(cmd: HapticDeviceCommand, pattern: HapticFeedbackPattern): Promise<void> {
    const intensity = clampUnit(cmd.intensity, 0.5);
    const duration = durationSeconds(cmd.duration) || 1.5;
    const steps = buildPatternSteps(pattern, intensity, duration);
    const timerTarget = String(cmd.deviceIndex);

    for (const step of steps) {
      const stepCommand: HapticDeviceCommand = {
        ...cmd,
        intensity: step.intensity,
        duration: step.duration,
        pattern: "steady",
      };

      if (step.delayMs <= 0) {
        await this.executeCommandInternal(stepCommand, { clearExistingTimers: false });
        continue;
      }

      const timerKey = `pattern:${timerTarget}:${++this.patternTimerCounter}`;
      const timer = setTimeout(() => {
        this.stopTimers.delete(timerKey);
        void this.executeCommandInternal(stepCommand, { clearExistingTimers: false }).catch((err) => {
          logger.warn(err, "[haptic] Pattern step %s failed", pattern);
        });
      }, step.delayMs);
      this.stopTimers.set(timerKey, timer);
    }
  }

  private setStopTimer(deviceIndex: number | "all", duration: number, targets: ButtplugClientDevice[]): void {
    const timerKey = `stop:${String(deviceIndex)}`;
    const existing = this.stopTimers.get(timerKey);
    if (existing) clearTimeout(existing);

    this.stopTimers.set(
      timerKey,
      setTimeout(async () => {
        this.stopTimers.delete(timerKey);
        for (const device of targets) {
          try {
            await device.stop();
          } catch {
            // Device may have disconnected.
          }
        }
      }, duration * 1000),
    );
  }

  private clearTimersForTarget(deviceIndex: number | "all"): void {
    if (deviceIndex === "all") {
      this.clearAllTimers();
      return;
    }

    const target = String(deviceIndex);
    for (const [key, timer] of this.stopTimers.entries()) {
      if (
        key === `stop:${target}` ||
        key.startsWith(`pattern:${target}:`) ||
        key === "stop:all" ||
        key.startsWith("pattern:all:")
      ) {
        clearTimeout(timer);
        this.stopTimers.delete(key);
      }
    }
  }

  private clearAllTimers(): void {
    for (const timer of this.stopTimers.values()) clearTimeout(timer);
    this.stopTimers.clear();
  }
}

/** Singleton instance — shared across the server lifetime. */
export const hapticService = new ButtplugService();
