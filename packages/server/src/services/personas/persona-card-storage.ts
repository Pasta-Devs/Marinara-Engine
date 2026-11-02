import { cardFromPersona, personaFromCard, type CharacterData } from "@marinara-engine/shared";
import type { PersonaStorageRow } from "../storage/characters.storage.js";
import { encodePersonaUpdate, projectPersona } from "./persona-projector.js";

/** Serialized persona row whose authored fields live in one JSON CharacterData column. */
export type StoredPersonaRow = {
  id: string;
  data: string;
  comment: string;
  avatarPath: string | null;
  isActive: string;
  embedding: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Schema defaults for the flat persona columns that are not record metadata. */
const PERSONA_COLUMN_DEFAULTS = {
  // Required column with no schema default; every encoded card supplies a name.
  name: "",
  creator: "",
  personaVersion: "1.0",
  versioningEnabled: "true",
  creatorNotes: "",
  phoneticName: "",
  summary: "",
  mes_example: "",
  description: "",
  personality: "",
  scenario: "",
  backstory: "",
  appearance: "",
  imageAppearanceEnabled: "false",
  imageAppearance: "",
  characterSheetImageId: null,
  useCharacterSheetAsReference: "false",
  avatarCrop: "",
  nameColor: "",
  dialogueColor: "",
  boxColor: "",
  trackerCardColors: '{"mode":"chat"}',
  personaStats: "",
  tags: "[]",
  savedStatusOptions: "[]",
  convoDisplayName: "",
  aboutMe: "",
  convoBehavior: "",
  cardFieldAlternatives: "[]",
} satisfies Omit<
  PersonaStorageRow,
  "id" | "comment" | "avatarPath" | "isActive" | "embedding" | "createdAt" | "updatedAt"
>;

/** Fold a flat persona row into record metadata plus one serialized CharacterData card. */
export function storedPersonaFromRow(row: PersonaStorageRow): StoredPersonaRow {
  const {
    id: _id,
    comment: _comment,
    avatarPath: _avatarPath,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    isActive: _isActive,
    ...authored
  } = projectPersona(row);
  return {
    id: row.id,
    data: JSON.stringify(cardFromPersona(authored)),
    comment: row.comment,
    avatarPath: row.avatarPath,
    isActive: row.isActive,
    embedding: row.embedding,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Rebuild every flat persona column from record metadata and the serialized CharacterData card. */
export function personaRowFromStored(stored: StoredPersonaRow): PersonaStorageRow {
  const persona = personaFromCard(JSON.parse(stored.data) as CharacterData);
  const encoded = encodePersonaUpdate(persona);
  return {
    id: stored.id,
    comment: stored.comment,
    avatarPath: stored.avatarPath,
    isActive: stored.isActive,
    embedding: stored.embedding,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    name: encoded.name ?? PERSONA_COLUMN_DEFAULTS.name,
    creator: encoded.creator ?? PERSONA_COLUMN_DEFAULTS.creator,
    personaVersion: encoded.personaVersion ?? PERSONA_COLUMN_DEFAULTS.personaVersion,
    versioningEnabled: encoded.versioningEnabled ?? PERSONA_COLUMN_DEFAULTS.versioningEnabled,
    creatorNotes: encoded.creatorNotes ?? PERSONA_COLUMN_DEFAULTS.creatorNotes,
    phoneticName: encoded.phoneticName ?? PERSONA_COLUMN_DEFAULTS.phoneticName,
    cardFieldAlternatives: encoded.cardFieldAlternatives ?? PERSONA_COLUMN_DEFAULTS.cardFieldAlternatives,
    summary: encoded.summary ?? PERSONA_COLUMN_DEFAULTS.summary,
    mes_example: encoded.mes_example ?? PERSONA_COLUMN_DEFAULTS.mes_example,
    description: encoded.description ?? PERSONA_COLUMN_DEFAULTS.description,
    personality: encoded.personality ?? PERSONA_COLUMN_DEFAULTS.personality,
    scenario: encoded.scenario ?? PERSONA_COLUMN_DEFAULTS.scenario,
    backstory: encoded.backstory ?? PERSONA_COLUMN_DEFAULTS.backstory,
    appearance: encoded.appearance ?? PERSONA_COLUMN_DEFAULTS.appearance,
    imageAppearanceEnabled: encoded.imageAppearanceEnabled ?? PERSONA_COLUMN_DEFAULTS.imageAppearanceEnabled,
    imageAppearance: encoded.imageAppearance ?? PERSONA_COLUMN_DEFAULTS.imageAppearance,
    // The update encoder leaves these two out (the gallery route writes them), so they come from the card here.
    characterSheetImageId: persona.characterSheetImageId ?? PERSONA_COLUMN_DEFAULTS.characterSheetImageId,
    useCharacterSheetAsReference: persona.useCharacterSheetAsReference ? "true" : "false",
    avatarCrop: encoded.avatarCrop ?? PERSONA_COLUMN_DEFAULTS.avatarCrop,
    nameColor: encoded.nameColor ?? PERSONA_COLUMN_DEFAULTS.nameColor,
    dialogueColor: encoded.dialogueColor ?? PERSONA_COLUMN_DEFAULTS.dialogueColor,
    boxColor: encoded.boxColor ?? PERSONA_COLUMN_DEFAULTS.boxColor,
    trackerCardColors: encoded.trackerCardColors ?? PERSONA_COLUMN_DEFAULTS.trackerCardColors,
    personaStats: encoded.personaStats ?? PERSONA_COLUMN_DEFAULTS.personaStats,
    tags: encoded.tags ?? PERSONA_COLUMN_DEFAULTS.tags,
    savedStatusOptions: encoded.savedStatusOptions ?? PERSONA_COLUMN_DEFAULTS.savedStatusOptions,
    convoDisplayName: encoded.convoDisplayName ?? PERSONA_COLUMN_DEFAULTS.convoDisplayName,
    aboutMe: encoded.aboutMe ?? PERSONA_COLUMN_DEFAULTS.aboutMe,
    convoBehavior: encoded.convoBehavior ?? PERSONA_COLUMN_DEFAULTS.convoBehavior,
  };
}

/** List the flat columns that change after a row is folded into a stored row and rebuilt. */
export function personaRowChanges(row: PersonaStorageRow): string[] {
  const rebuilt = personaRowFromStored(storedPersonaFromRow(row));
  return Object.keys(row)
    .filter((column) => {
      const key = column as keyof PersonaStorageRow;
      return rebuilt[key] !== row[key];
    })
    .sort();
}
