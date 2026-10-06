// ──────────────────────────────────────────────
// Capability scene-origin registry — gives the `scenes` permission its mechanism.
//
// A scene usually branches from a Conversation. A package may register one provider so its own threads
// (a direct-message thread, for example) can be a scene origin too: the provider supplies the planning
// context, holds the lock while the scene runs and receives the outcome. Contract: `SceneOriginProvider`.
// ──────────────────────────────────────────────
import type {
  SceneOriginEnd,
  SceneOriginProvider,
  ScenePackageData,
  ScenePackageOrigin,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { withDeadline } from "./capability-prompt-context.service.js";

/**
 * How long a scene route waits for a package's provider. A provider that never answers must not hang
 * the route: a late claim is treated as refused (the scene chat is removed, so the package's own
 * reconciliation finds no scene behind it), a late release is logged and dropped.
 */
export const SCENE_ORIGIN_TIMEOUT_MS = 8000;

const providersByPackage = new Map<string, SceneOriginProvider>();

/** Register (or replace) a package's scene-origin provider. Returns a releaser for deactivation. */
export function registerCapabilitySceneOrigin(packageId: string, provider: SceneOriginProvider): () => void {
  if (
    !provider ||
    typeof provider.getContext !== "function" ||
    (provider.claim !== undefined && typeof provider.claim !== "function") ||
    (provider.release !== undefined && typeof provider.release !== "function")
  ) {
    throw new Error("Capability scene-origin provider is invalid");
  }
  providersByPackage.set(packageId, provider);
  return () => {
    if (providersByPackage.get(packageId) === provider) providersByPackage.delete(packageId);
  };
}

/** The active provider for a package, or null when the package is not installed, enabled and registered. */
export function getCapabilitySceneOrigin(packageId: string): SceneOriginProvider | null {
  return providersByPackage.get(packageId) ?? null;
}

/** Accept `{ packageId, originId }` from a request body or chat metadata; anything else is no origin. */
export function parseScenePackageOrigin(value: unknown): ScenePackageOrigin | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { packageId, originId } = value as Record<string, unknown>;
  if (typeof packageId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packageId) || packageId.length > 80)
    return null;
  if (typeof originId !== "string" || !originId.trim() || originId.length > 200) return null;
  return { packageId, originId };
}

/** A package's per-scene settings: a plain JSON object of at most 4,000 characters, or null. */
export function parseScenePackageData(value: unknown): ScenePackageData | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return "invalid";
  try {
    const json = JSON.stringify(value);
    return json.length <= 4000 ? (JSON.parse(json) as ScenePackageData) : "invalid";
  } catch {
    return "invalid";
  }
}

/** The settings a scene chat stored, from its metadata. */
export function parseStoredScenePackageData(meta: Record<string, unknown>): ScenePackageData | null {
  const data = parseScenePackageData(meta.scenePackageData);
  return data === "invalid" ? null : data;
}

/**
 * Tell a package origin how its scene ended. The scene's own state is already settled, so a provider
 * that is gone or fails is logged and skipped: the package reconciles when it next reads its lock.
 */
export async function releaseScenePackageOrigin(origin: ScenePackageOrigin, end: SceneOriginEnd): Promise<void> {
  const provider = getCapabilitySceneOrigin(origin.packageId);
  // A package that only starts scenes asked for no outcome.
  if (provider && !provider.release) return;
  if (!provider) {
    logger.warn({ ...origin, sceneChatId: end.sceneChatId }, "[scene] Package origin is not active; release skipped");
    return;
  }
  try {
    await withDeadline(provider.release!(origin.originId, end), "Scene origin release", SCENE_ORIGIN_TIMEOUT_MS);
  } catch (error) {
    logger.warn({ err: error, ...origin, sceneChatId: end.sceneChatId }, "[scene] Package origin release failed");
  }
}
