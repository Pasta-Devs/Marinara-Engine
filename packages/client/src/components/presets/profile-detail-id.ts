// The ui store's `profileDetailId` holds a saved profile's id, or `new:<mode>`
// for one that isn't saved yet. Kept apart from ProfileEditor so the Presets
// panel can build the value without pulling the lazily-loaded editor in.
import type { ChatMode } from "@marinara-engine/shared";

export const NEW_PROFILE_PREFIX = "new:";

/** The store value for a profile that isn't saved yet. */
export function newProfileDetailId(mode: ChatMode) {
  return `${NEW_PROFILE_PREFIX}${mode}`;
}

/** The mode of an unsaved profile's store value, or null for a saved id or a bad value. */
export function readNewProfileMode(id: string): ChatMode | null {
  if (!id.startsWith(NEW_PROFILE_PREFIX)) return null;
  const mode = id.slice(NEW_PROFILE_PREFIX.length);
  return mode === "conversation" || mode === "roleplay" ? mode : null;
}
