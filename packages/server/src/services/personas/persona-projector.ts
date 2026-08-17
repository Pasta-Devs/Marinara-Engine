import {
  normalizeConvoBehavior,
  normalizeAvatarCrop,
  normalizePersonaStats,
  normalizePersonaStringArray,
  normalizeTrackerCardColorConfig,
  type Persona,
  type PersonaCreateInput,
  type PersonaUpdateInput,
} from "@marinara-engine/shared";
import type { PersonaStorageRow, PersonaStorageWriteFields } from "../storage/characters.storage.js";

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
    versioningEnabled: row.versioningEnabled !== "false",
    creatorNotes: stringValue(row.creatorNotes),
    phoneticName: stringValue(row.phoneticName) || undefined,
    description: stringValue(row.description),
    personality: stringValue(row.personality),
    scenario: stringValue(row.scenario),
    backstory: stringValue(row.backstory),
    appearance: stringValue(row.appearance),
    avatarPath: typeof row.avatarPath === "string" ? row.avatarPath : null,
    characterSheetImageId: typeof row.characterSheetImageId === "string" ? row.characterSheetImageId : null,
    useCharacterSheetAsReference: row.useCharacterSheetAsReference === "true",
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

function encodeStructured(value: unknown): string {
  return JSON.stringify(value) ?? "";
}

type EncodedPersonaUpdate = Partial<PersonaStorageWriteFields> & { avatarPath?: PersonaStorageRow["avatarPath"] };

/** Convert a decoded Persona PATCH payload into file-table storage fields. */
export function encodePersonaUpdate(input: PersonaUpdateInput): EncodedPersonaUpdate {
  const encoded: EncodedPersonaUpdate = {};
  const scalarFields = [
    "name",
    "comment",
    "creator",
    "personaVersion",
    "creatorNotes",
    "phoneticName",
    "description",
    "personality",
    "scenario",
    "backstory",
    "appearance",
    "nameColor",
    "dialogueColor",
    "boxColor",
    "convoDisplayName",
    "aboutMe",
  ] as const;
  for (const field of scalarFields) {
    if (Object.hasOwn(input, field)) encoded[field] = input[field]!;
  }
  if (Object.hasOwn(input, "versioningEnabled")) encoded.versioningEnabled = String(input.versioningEnabled);
  if (Object.hasOwn(input, "avatarPath")) encoded.avatarPath = input.avatarPath;
  if (Object.hasOwn(input, "avatarCrop"))
    encoded.avatarCrop = input.avatarCrop === null ? "" : encodeStructured(input.avatarCrop);
  if (Object.hasOwn(input, "trackerCardColors")) {
    encoded.trackerCardColors = encodeStructured(normalizeTrackerCardColorConfig(input.trackerCardColors));
  }
  if (Object.hasOwn(input, "personaStats"))
    encoded.personaStats = input.personaStats === null ? "" : encodeStructured(input.personaStats);
  if (Object.hasOwn(input, "tags")) encoded.tags = encodeStructured(input.tags);
  if (Object.hasOwn(input, "savedStatusOptions"))
    encoded.savedStatusOptions = encodeStructured(input.savedStatusOptions);
  if (Object.hasOwn(input, "convoBehavior"))
    encoded.convoBehavior = input.convoBehavior === null ? "" : encodeStructured(input.convoBehavior);
  return encoded;
}

/** Convert a decoded Persona create payload into the unchanged storage call shape. */
export function encodePersonaCreate(input: PersonaCreateInput): {
  name: string;
  description: string;
  extra: Partial<Omit<PersonaStorageWriteFields, "name" | "description">>;
} {
  const { createdAt: _createdAt, updatedAt: _updatedAt, name, description = "", ...writable } = input;
  return { name, description, extra: encodePersonaUpdate(writable) };
}
