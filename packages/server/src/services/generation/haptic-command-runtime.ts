import { logger } from "../../lib/logger.js";
import type { CharacterCommand, HapticCommand } from "../conversation/character-commands.js";

export async function handleHapticCommand(args: {
  command: CharacterCommand;
  sendEvent: (data: Record<string, unknown>) => void;
}): Promise<boolean> {
  if (args.command.type !== "haptic") return false;
  const command = args.command as HapticCommand;

  try {
    const { hapticService } = await import("../haptic/buttplug-service.js");
    if (hapticService.connected && hapticService.devices.length > 0) {
      await hapticService.executeCommand({
        deviceIndex: "all",
        action: command.action,
        intensity: command.intensity,
        duration: command.duration,
      });
      args.sendEvent({ action: command.action, intensity: command.intensity, duration: command.duration });
      logger.info(
        "[commands] Haptic: %s intensity=%s duration=%s",
        command.action,
        command.intensity ?? "default",
        command.duration ?? "indefinite",
      );
    } else if (!hapticService.connected) {
      logger.warn("[commands] Haptic command [%s] skipped - Intiface Central not connected", command.action);
    } else {
      logger.warn("[commands] Haptic command [%s] skipped - no devices found", command.action);
    }
  } catch (err) {
    logger.error(err, "[commands] Haptic command failed");
  }

  return true;
}
