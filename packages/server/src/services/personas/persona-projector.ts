import {
  normalizeConvoBehavior,
  normalizeAvatarCrop,
  normalizePersonaStats,
  normalizePersonaStringArray,
  normalizeTrackerCardColorConfig,
  type Persona,
} from "@marinara-engine/shared";
import type { PersonaStorageRow } from "../storage/characters.storage.js";

/** Convert one serialized file-table row into the public runtime Persona contract. */
export function projectPersona(row: PersonaStorageRow): Persona {
  const stringValue = (value: unknown) => (typeof value === "string" ? value : "");
  const personaVersion = stringValue(row.personaVersion).trim();
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    comment: stringValue(row.comment),
    creator: stringValue(row.creator),
    personaVersion: personaVersion || "1.0",
    creatorNotes: stringValue(row.creatorNotes),
    phoneticName: stringValue(row.phoneticName) || undefined,
    description: stringValue(row.description),
    personality: stringValue(row.personality),
    scenario: stringValue(row.scenario),
    backstory: stringValue(row.backstory),
    appearance: stringValue(row.appearance),
    avatarPath: typeof row.avatarPath === "string" ? row.avatarPath : null,
    avatarCrop: normalizeAvatarCrop(row.avatarCrop),
    isActive: row.isActive === "true",
    nameColor: stringValue(row.nameColor),
    dialogueColor: stringValue(row.dialogueColor),
    boxColor: stringValue(row.boxColor),
    trackerCardColors: normalizeTrackerCardColorConfig(row.trackerCardColors),
    personaStats: normalizePersonaStats(row.personaStats),
    tags: normalizePersonaStringArray(row.tags),
    savedStatusOptions: normalizePersonaStringArray(row.savedStatusOptions),
    convoDisplayName: stringValue(row.convoDisplayName) || undefined,
    aboutMe: stringValue(row.aboutMe) || undefined,
    convoBehavior: normalizeConvoBehavior(row.convoBehavior),
    createdAt: stringValue(row.createdAt),
    updatedAt: stringValue(row.updatedAt),
  };
}
