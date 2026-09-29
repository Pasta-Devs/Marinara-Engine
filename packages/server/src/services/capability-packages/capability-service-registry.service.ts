import { currentRoomGeneration } from "../multiplayer/generation-policy.js";
type Cleanup = () => void;

const services = new Map<string, unknown>();

/**
 * Registers a package-owned service behind a stable Engine integration point.
 * The registry deliberately knows nothing about individual optional features.
 */
export function registerCapabilityService<T>(key: string, service: T): Cleanup {
  if (services.has(key)) throw new Error(`Capability service ${key} is already registered`);
  services.set(key, service);
  return () => {
    if (services.get(key) === service) services.delete(key);
  };
}

export function getCapabilityService<T>(key: string): T | null {
  if (currentRoomGeneration()) return null;
  return (services.get(key) as T | undefined) ?? null;
}

export function listCapabilityServiceKeys(prefix: string): string[] {
  return [...services.keys()].filter((key) => key.startsWith(prefix)).sort();
}

export function resetCapabilityServices(): void {
  services.clear();
}
