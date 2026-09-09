export const ROLEPLAY_COMMAND_KEYS = [
  "illustrate",
  "document",
  "sound",
  "music",
  "notes",
  "memory",
  "roll",
  "combat",
  "dm",
] as const;

export type RoleplayCommandKey = (typeof ROLEPLAY_COMMAND_KEYS)[number];
export type RoleplayCommandToggles = Partial<Record<RoleplayCommandKey, boolean>>;
export type RoleplayCommandAudience = "all" | "narrator";

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

export type RoleplayCommand =
  | RoleplayPrivateCommand
  | { type: "illustrate"; subject: string; characters?: string[] }
  | { type: "document"; documentType: string; title: string; content: string }
  | { type: "sound"; description: string }
  | { type: "music"; mood: string }
  | { type: "roll"; notation: string; reason: string; character?: string; attribute?: string }
  | { type: "combat" }
  | { type: "dm"; character: string; message: string };

export interface RoleplayCommandActivity {
  command: RoleplayCommand;
  /** Original model output, kept separate from the user's editable context. */
  raw: string;
  deleted?: boolean;
  error?: string;
  result?: string;
}

/** Read current records, or reconstruct editable context from older message extras. */
export function getRoleplayCommandActivity(extra: Record<string, unknown>): RoleplayCommandActivity[] {
  if (Array.isArray(extra.roleplayCommandActivity)) {
    return extra.roleplayCommandActivity.filter(
      (item): item is RoleplayCommandActivity =>
        item &&
        typeof item.raw === "string" &&
        item.command &&
        [...ROLEPLAY_COMMAND_KEYS, "dismiss_notes", "dismiss_memory"].includes(item.command.type),
    );
  }
  const activity: RoleplayCommandActivity[] = [];
  if (Array.isArray(extra.roleplayPrivateCommands)) {
    for (const command of extra.roleplayPrivateCommands) {
      if (command && ["notes", "dismiss_notes", "memory", "dismiss_memory"].includes(command.type))
        activity.push({ command, raw: JSON.stringify(command) });
    }
  }
  if (Array.isArray(extra.roleplayDocuments)) {
    for (const document of extra.roleplayDocuments) {
      if (document && typeof document.title === "string" && typeof document.content === "string") {
        const command = {
          type: "document" as const,
          documentType: document.type,
          title: document.title,
          content: document.content,
        };
        activity.push({ command, raw: JSON.stringify(command) });
      }
    }
  }
  return activity;
}

export function getRoleplayPrivateCommands(extra: Record<string, unknown>): RoleplayPrivateCommand[] {
  return getRoleplayCommandActivity(extra).flatMap(({ command, deleted, error }): RoleplayPrivateCommand[] => {
    if (error) return [];
    if (command.type === "notes") return [deleted ? { type: "dismiss_notes" } : command];
    if (command.type === "memory") return [deleted ? { type: "dismiss_memory", id: command.id } : command];
    return command.type === "dismiss_notes" || command.type === "dismiss_memory" ? [command] : [];
  });
}

export function getRoleplayDocuments(extra: Record<string, unknown>): RoleplayDocument[] {
  return getRoleplayCommandActivity(extra).flatMap(({ command, deleted, error }) =>
    !deleted &&
    !error &&
    command.type === "document" &&
    typeof command.title === "string" &&
    typeof command.content === "string"
      ? [{ type: command.documentType, title: command.title, content: command.content }]
      : [],
  );
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

/** A narrator-only command needs an unambiguous, current participant as its caller. */
export function isRoleplayCommandAllowed(
  metadata: Record<string, unknown>,
  key: RoleplayCommandKey,
  characterId: string | null | undefined,
): boolean {
  if (!isRoleplayCommandEnabled(metadata, key)) return false;
  if (
    (key === "roll" && metadata.roleplayRollAudience === "narrator") ||
    (key === "combat" && metadata.roleplayCombatAudience === "narrator") ||
    (key === "document" && metadata.roleplayDocumentAudience === "narrator")
  ) {
    if (!characterId || characterId !== metadata.roleplayCommandNarratorId) return false;
  }
  if (key === "music" && metadata.enableAgents !== true) return false;
  if (key === "illustrate" || key === "combat" || key === "music") {
    return (
      Array.isArray(metadata.activeAgentIds) &&
      metadata.activeAgentIds.includes(key === "illustrate" ? "illustrator" : key === "music" ? "spotify" : "combat")
    );
  }
  return true;
}
