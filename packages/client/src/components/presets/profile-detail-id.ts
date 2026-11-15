// Settings profile modes, and the ui store's `profileDetailId`: a saved
// profile's id, or `new:<mode>` for one that isn't saved yet. Kept apart from
// ProfileEditor so the Presets panel can use them without pulling the
// lazily-loaded editor in.
import type { ChatMode } from "@marinara-engine/shared";

/** The chat modes that have settings profiles (the server seeds a Default for each); Game chats have none. */
export const PROFILE_MODES = ["conversation", "roleplay"] as const satisfies readonly ChatMode[];
export type ProfileMode = (typeof PROFILE_MODES)[number];

export const isProfileMode = (mode: unknown): mode is ProfileMode => PROFILE_MODES.includes(mode as ProfileMode);

export const NEW_PROFILE_PREFIX = "new:";

/** The store value for a profile that isn't saved yet. */
export function newProfileDetailId(mode: ChatMode) {
  return `${NEW_PROFILE_PREFIX}${mode}`;
}

/** The mode of an unsaved profile's store value, or null for a saved id or a bad value. */
export function readNewProfileMode(id: string): ProfileMode | null {
  if (!id.startsWith(NEW_PROFILE_PREFIX)) return null;
  const mode = id.slice(NEW_PROFILE_PREFIX.length);
  return isProfileMode(mode) ? mode : null;
}
