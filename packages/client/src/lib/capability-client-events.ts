export const CAPABILITY_CLIENT_EVENT = "marinara-capability-server-event";

export interface CapabilityClientEventDetail {
  packageId: string;
  type: string;
  chatId: string;
  data: unknown;
}

export function dispatchCapabilityClientEvent(detail: CapabilityClientEventDetail) {
  window.dispatchEvent(new CustomEvent<CapabilityClientEventDetail>(CAPABILITY_CLIENT_EVENT, { detail }));
}

/** The game-owning Experience package for a chat, from its parsed metadata.
 *  null for classic games — and for hierarchical-maps itself, which every
 *  spatial dispatch site already addresses explicitly. */
export function resolveGameExperiencePackageId(metadata: Record<string, unknown> | null | undefined): string | null {
  const id = metadata?.gameExperienceId;
  return typeof id === "string" && id.length > 0 && id !== "hierarchical-maps" ? id : null;
}

/** Spatial transition events go to World Maps AND the game-owning Experience
 *  package (capability API 1.12). Both react to the same payload; the
 *  addressing model is that every listener filters by its own packageId, so a
 *  second addressed dispatch — never a broadcast — is how a second audience
 *  is reached. */
export function dispatchSpatialCapabilityEvent(
  experiencePackageId: string | null,
  detail: Omit<CapabilityClientEventDetail, "packageId">,
) {
  dispatchCapabilityClientEvent({ packageId: "hierarchical-maps", ...detail });
  if (experiencePackageId) dispatchCapabilityClientEvent({ packageId: experiencePackageId, ...detail });
}
