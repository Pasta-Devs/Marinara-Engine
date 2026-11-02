import { cardFromPersona, personaFromCard, type CharacterData } from "@marinara-engine/shared";
import type { personas } from "../../db/schema/index.js";
import { encodePersonaUpdate, projectPersona } from "./persona-projector.js";

/** On-disk persona row: record metadata plus the authored card as CharacterData JSON in `data`. */
export type StoredPersonaRow = typeof personas.$inferSelect;

/**
 * Flat serialized persona view every storage reader gets. JSON-backed fields and
 * booleans stay serialized text; decode with `projectPersona()` for API output.
 */
export type PersonaStorageRow = {
  id: string;
  name: string;
  comment: string;
  creator: string;
  personaVersion: string;
  versioningEnabled: string;
  creatorNotes: string;
  phoneticName: string;
  cardFieldAlternatives: string;
  summary: string;
  mes_example: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  imageAppearanceEnabled: string;
  imageAppearance: string;
  avatarPath: string | null;
  characterSheetImageId: string | null;
  useCharacterSheetAsReference: string;
  avatarCrop: string;
  isActive: string;
  nameColor: string;
  dialogueColor: string;
  boxColor: string;
  trackerCardColors: string;
  personaStats: string;
  tags: string;
  savedStatusOptions: string;
  convoDisplayName: string;
  aboutMe: string;
  convoBehavior: string;
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

/** Fill every flat column a partial persona row leaves out with its schema default. */
export function completePersonaRow(
  row: Partial<PersonaStorageRow> & Pick<PersonaStorageRow, "id" | "createdAt" | "updatedAt">,
): PersonaStorageRow {
  const defined = Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
  return {
    ...PERSONA_COLUMN_DEFAULTS,
    comment: "",
    avatarPath: null,
    isActive: "false",
    embedding: null,
    ...defined,
  } as PersonaStorageRow;
}

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

function parseStoredCard(data: string): CharacterData {
  try {
    const parsed: unknown = JSON.parse(data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const card = parsed as CharacterData;
      const extensions = card.extensions && typeof card.extensions === "object" ? card.extensions : {};
      return { ...card, extensions } as CharacterData;
    }
  } catch {
    // An unreadable card reads as an empty one, so one bad row cannot fail a whole list.
  }
  return { name: "", extensions: {} } as unknown as CharacterData;
}

/** Rebuild every flat persona column from record metadata and the serialized CharacterData card. */
export function personaRowFromStored(stored: StoredPersonaRow): PersonaStorageRow {
  // A row without `data` is a pre-format-11 flat row the migration has not converted (a raw
  // import, a hand edit). Read it through the same normalization instead of failing.
  if (typeof stored.data !== "string") {
    return personaRowFromStored(storedPersonaFromRow(stored as unknown as PersonaStorageRow));
  }
  const persona = personaFromCard(parseStoredCard(stored.data));
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
