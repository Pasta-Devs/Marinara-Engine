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
import { normalizeHapticAction, normalizeHapticPattern } from "@marinara-engine/shared";
import { getIntifaceUrl } from "../../config/runtime-config.js";
import { buildHapticPatternSteps, describeHapticDeviceType } from "../generation/haptic-runtime.js";

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
  { type: OutputType.Temperature, cap: "temperature" },
  { type: OutputType.Spray, cap: "spray" },
  { type: OutputType.Led, cap: "led" },
];
if (POSITION_WITH_DURATION_OUTPUT) CAPABILITY_TYPES.push({ type: POSITION_WITH_DURATION_OUTPUT, cap: "position" });

/** Map our action strings to buttplug OutputType. */
const ACTION_TO_OUTPUT: Partial<Record<HapticDeviceCommand["action"], OutputType>> = {
  vibrate: OutputType.Vibrate,
  rotate: OutputType.Rotate,
  oscillate: OutputType.Oscillate,
  constrict: OutputType.Constrict,
  inflate: OutputType.Inflate,
  temperature: OutputType.Temperature,
  spray: OutputType.Spray,
  led: OutputType.Led,
};

function clampUnit(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
}

function durationSeconds(value: unknown): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
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
    type: describeHapticDeviceType(capabilities),
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

    const action = normalizeHapticAction(cmd.action);
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

    const pattern = normalizeHapticPattern(cmd.pattern);
    if (pattern && pattern !== "steady") {
      await this.executePatternCommand({ ...cmd, action }, pattern);
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
          } else {
            unsupportedDevices.push(deviceName(device));
          }
          continue;
        }

        const selectedOutputType = outputType;

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
    const steps = buildHapticPatternSteps(cmd.action, pattern, intensity, duration);
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
