import { logger } from "../lib/logger.js";
import {
  completePersonaRow,
  personaRowChanges,
  storedPersonaFromRow,
  type PersonaStorageRow,
} from "../services/personas/persona-card-storage.js";

type Row = Record<string, unknown>;

/**
 * Flat `personas` columns before storage format 11, keyed by row key with the on-disk db name a
 * row may carry instead. Format 11 moves every authored column into one CharacterData card in
 * `data`, like `characters`, so a persona and a character share one card shape.
 */
const LEGACY_PERSONA_COLUMNS: Record<keyof PersonaStorageRow, string> = {
  id: "id",
  name: "name",
  comment: "comment",
  creator: "creator",
  personaVersion: "persona_version",
  versioningEnabled: "versioning_enabled",
  creatorNotes: "creator_notes",
  phoneticName: "phonetic_name",
  cardFieldAlternatives: "card_field_alternatives",
  summary: "summary",
  mes_example: "mes_example",
  description: "description",
  personality: "personality",
  scenario: "scenario",
  backstory: "backstory",
  appearance: "appearance",
  imageAppearanceEnabled: "image_appearance_enabled",
  imageAppearance: "image_appearance",
  avatarPath: "avatar_path",
  characterSheetImageId: "character_sheet_image_id",
  useCharacterSheetAsReference: "use_character_sheet_as_reference",
  avatarCrop: "avatar_crop",
  isActive: "is_active",
  nameColor: "name_color",
  dialogueColor: "dialogue_color",
  boxColor: "box_color",
  trackerCardColors: "tracker_card_colors",
  personaStats: "persona_stats",
  tags: "tags",
  savedStatusOptions: "saved_status_options",
  convoDisplayName: "convo_display_name",
  aboutMe: "about_me",
  convoBehavior: "convo_behavior",
  embedding: "embedding",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const NULLABLE_COLUMNS = new Set<string>(["avatarPath", "characterSheetImageId", "embedding"]);

/** Record columns kept outside the card; enough to rebuild a usable row if the full fold fails. */
const RECORD_AND_TEXT_COLUMNS = new Set<string>([
  "id",
  "name",
  "comment",
  "avatarPath",
  "isActive",
  "embedding",
  "createdAt",
  "updatedAt",
  "creator",
  "creatorNotes",
  "description",
  "personality",
  "scenario",
  "backstory",
  "appearance",
  "summary",
  "mes_example",
]);

/** True for a convertible persona row still in the flat pre-format-11 shape (an id-less row cannot be converted). */
export function personaRowNeedsCardMigration(row: Row): boolean {
  return typeof row.data !== "string" && typeof row.id === "string" && row.id.length > 0;
}

function readLegacyColumns(row: Row): Row {
  const flat: Row = {};
  for (const [key, dbName] of Object.entries(LEGACY_PERSONA_COLUMNS)) {
    const value = row[key] !== undefined ? row[key] : row[dbName];
    if (value === undefined) continue;
    if (value === null) {
      // A null in a required text column means "unset": let the schema default fill it.
      if (NULLABLE_COLUMNS.has(key)) flat[key] = null;
      continue;
    }
    // Hand-edited rows can carry a parsed JSON value where the column stores text.
    flat[key] = typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  return flat;
}

/**
 * Fold a flat pre-format-11 persona row into the stored shape (record columns + `data` card).
 * Must run before rows are normalized against the schema: the loader drops columns the schema
 * no longer lists, so an unconverted row would lose every authored field.
 *
 * Idempotent: rows that already carry `data` are returned untouched. The conversion is semantic
 * (the card is built from the decoded persona), so a column holding a value the decoder
 * normalizes can change; those column names are logged per row, and the shard files are copied
 * byte-for-byte to `*.pre-v11` by the store before the first rewrite.
 */
export function migrateLegacyPersonaRow(row: Row): Row {
  if (!personaRowNeedsCardMigration(row)) return row;
  const flat = readLegacyColumns(row);
  if (typeof flat.id !== "string" || !flat.id) return row;
  const timestamp = new Date().toISOString();
  const createdAt = typeof flat.createdAt === "string" ? flat.createdAt : String(flat.updatedAt ?? timestamp);
  const updatedAt = typeof flat.updatedAt === "string" ? flat.updatedAt : createdAt;
  const complete = completePersonaRow({ ...flat, id: flat.id, createdAt, updatedAt } as PersonaStorageRow);
  try {
    const changedColumns = personaRowChanges(complete);
    if (changedColumns.length > 0) {
      logger.info(
        { personaId: complete.id, changedColumns },
        "[file-storage] Moved persona %s into its card; normalized columns: %s",
        complete.id,
        changedColumns.join(", "),
      );
    }
    return { ...storedPersonaFromRow(complete) };
  } catch (err) {
    // Keep the persona usable with its plain text fields rather than lose it; the original row
    // stays in the *.pre-v11 copy.
    const minimal = Object.fromEntries(Object.entries(complete).filter(([key]) => RECORD_AND_TEXT_COLUMNS.has(key)));
    logger.error(
      err,
      "[file-storage] Could not fold persona %s into its card; kept its text fields only. The original row is in the .pre-v11 copy.",
      complete.id,
    );
    return { ...storedPersonaFromRow(completePersonaRow(minimal as PersonaStorageRow)) };
  }
}
