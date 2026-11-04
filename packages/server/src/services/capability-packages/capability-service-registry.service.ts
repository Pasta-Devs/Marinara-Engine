import type { CapabilityServiceCaller } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { currentRoomGeneration } from "../multiplayer/generation-policy.js";
type Cleanup = () => void;

export interface CapabilityServiceRegistrationOptions {
  /** Capability API 1.388: only the Engine reads it; packages get null from `services.get`. */
  hostOnly?: boolean;
  /**
   * Capability API 1.816: what one consumer package sees. Called once per consumer for the life of the registration,
   * with the identity the Engine assigned to that consumer. The Engine's own reads still get the raw service.
   */
  forCaller?: (caller: CapabilityServiceCaller) => unknown;
}

interface Registration {
  service: unknown;
  ownerId: string | null;
  hostOnly: boolean;
  forCaller?: (caller: CapabilityServiceCaller) => unknown;
  perCaller: Map<string, unknown>;
}

const registrations = new Map<string, Registration>();

/**
 * Registers a package-owned service behind a stable Engine integration point.
 * The registry deliberately knows nothing about individual optional features.
 * `ownerId` is the registering package (null for the Engine's own registrations and tests).
 */
export function registerCapabilityService<T>(
  key: string,
  service: T,
  options?: CapabilityServiceRegistrationOptions,
  ownerId: string | null = null,
): Cleanup {
  if (registrations.has(key)) throw new Error(`Capability service ${key} is already registered`);
  if (options?.forCaller !== undefined && typeof options.forCaller !== "function") {
    throw new Error(`Capability service ${key}: forCaller must be a function`);
  }
  const registration: Registration = {
    service,
    ownerId,
    hostOnly: options?.hostOnly === true,
    forCaller: options?.forCaller,
    perCaller: new Map(),
  };
  registrations.set(key, registration);
  return () => {
    if (registrations.get(key) !== registration) return;
    registrations.delete(key);
  };
}

/** A service registered with `hostOnly`: only the Engine reads it, packages get null from `services.get`. */
export function isHostOnlyCapabilityService(key: string): boolean {
  return registrations.get(key)?.hostOnly === true;
}

/** The package that registered a key, or null when the key is absent or the Engine registered it. */
export function capabilityServiceOwner(key: string): string | null {
  return registrations.get(key)?.ownerId ?? null;
}

/** The Engine's own read: always the raw service. */
export function getCapabilityService<T>(key: string): T | null {
  if (currentRoomGeneration()) return null;
  return (registrations.get(key)?.service as T | undefined) ?? null;
}

/**
 * A package's read. Host-only filtering is the caller's job (capability-module-runtime); this resolves `forCaller`
 * once per consumer and memoizes it for the life of the registration. A `forCaller` that throws is logged and that
 * read gets null, the same as an absent service, so a provider bug never breaks the consumer.
 */
export function getCapabilityServiceForCaller<T>(key: string, caller: CapabilityServiceCaller): T | null {
  if (currentRoomGeneration()) return null;
  const registration = registrations.get(key);
  if (!registration) return null;
  if (!registration.forCaller) return (registration.service as T | undefined) ?? null;
  if (registration.perCaller.has(caller.packageId)) {
    return (registration.perCaller.get(caller.packageId) as T | undefined) ?? null;
  }
  try {
    const resolved = registration.forCaller(caller) ?? null;
    registration.perCaller.set(caller.packageId, resolved);
    return resolved as T | null;
  } catch (error) {
    // Not memoized: the next read tries again.
    logger.warn(error, "Capability service %s could not resolve for package %s", key, caller.packageId);
    return null;
  }
}

export function listCapabilityServiceKeys(prefix: string): string[] {
  return [...registrations.keys()].filter((key) => key.startsWith(prefix)).sort();
}

export function resetCapabilityServices(): void {
  registrations.clear();
}
