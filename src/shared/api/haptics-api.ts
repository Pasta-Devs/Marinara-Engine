import type { HapticDeviceCommand, HapticStatus } from "../../engine/contracts/types/haptic";
import { invokeTauri } from "./tauri-client";

export const hapticsApi = {
  status: <T = HapticStatus>() => invokeTauri<T>("haptic_status"),
  connect: <T = HapticStatus>(url?: string) => invokeTauri<T>("haptic_connect", { body: url ? { url } : null }),
  disconnect: () => invokeTauri<HapticStatus>("haptic_disconnect"),
  startScan: <T = unknown>() => invokeTauri<T>("haptic_start_scan"),
  stopScan: <T = unknown>() => invokeTauri<T>("haptic_stop_scan"),
  command: <T = unknown>(command: HapticDeviceCommand | Record<string, unknown>) =>
    invokeTauri<T>("haptic_command", { command }),
  stopAll: <T = unknown>() => invokeTauri<T>("haptic_stop_all"),
};
