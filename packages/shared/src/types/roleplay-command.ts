export const ROLEPLAY_COMMAND_KEYS = [
  "illustrate",
  "document",
  "sound",
  "music",
  "notes",
  "memory",
  "roll",
  "dm",
] as const;

export type RoleplayCommandKey = (typeof ROLEPLAY_COMMAND_KEYS)[number];
export type RoleplayCommandToggles = Partial<Record<RoleplayCommandKey, boolean>>;

export type RoleplayPrivateCommand =
  | { type: "notes"; content: string }
  | { type: "dismiss_notes" }
  | { type: "memory"; id: string; content: string }
  | { type: "dismiss_memory"; id: string };

export interface RoleplayDocument {
  type: string;
  title: string;
  content: string;
}

export function roleplayCommandsEnabled(metadata: Record<string, unknown>): boolean {
  // Preserve an existing explicit DM opt-in. New chats have no enabled commands.
  return (
    metadata.roleplayCommandsEnabled === true ||
    (metadata.roleplayCommandsEnabled === undefined && metadata.roleplayDmCommandsEnabled === true)
  );
}

export function isRoleplayCommandEnabled(metadata: Record<string, unknown>, key: RoleplayCommandKey): boolean {
  if (!roleplayCommandsEnabled(metadata)) return false;
  const toggles = metadata.roleplayCommandToggles;
  if (toggles && typeof toggles === "object" && !Array.isArray(toggles)) {
    const value = (toggles as Record<string, unknown>)[key];
    if (typeof value === "boolean") return value;
  }
  return key === "dm" && metadata.roleplayDmCommandsEnabled === true;
}
