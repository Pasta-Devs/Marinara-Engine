// ──────────────────────────────────────────────
// Game data edits (#7743): the chat-metadata keys a player may hand-edit in the
// State Editor, and the request that saves them (PATCH /api/game/:chatId/data).
// ──────────────────────────────────────────────
import { z } from "zod";

/**
 * The game keys a hand edit may write. An allow-list, so a key new Game Mode work adds stays
 * read-only until someone decides how to check it. Inventory, world, story, party sheet and HUD
 * widgets have their own routes; setup, prompt and media settings stay in Chat Settings.
 */
export const GAME_DATA_EDITABLE_KEYS = [
  "gameCharacterCards",
  "gameNpcs",
  "gameJournal",
  "gamePlayerNotes",
  "gameWorldOverview",
  "gameStoryArc",
  "gamePlotTwists",
  "gamePartyArcs",
  "gamePreviousSessionSummaries",
] as const;

export type GameDataEditableKey = (typeof GAME_DATA_EDITABLE_KEYS)[number];

export function isGameDataEditableKey(key: string): key is GameDataEditableKey {
  return (GAME_DATA_EDITABLE_KEYS as readonly string[]).includes(key);
}

export const gameDataEditRequestSchema = z
  .object({
    edits: z
      .array(
        z
          .object({
            key: z.enum(GAME_DATA_EDITABLE_KEYS),
            /** The value the editor opened with (null when the key was absent). The save is
             *  refused when the key has changed since. */
            expected: z.unknown(),
            value: z.unknown(),
          })
          .strict(),
      )
      .min(1)
      .max(GAME_DATA_EDITABLE_KEYS.length),
  })
  .strict();

export type GameDataEditRequest = z.infer<typeof gameDataEditRequestSchema>;

/**
 * Why one key's edit was refused, as a code the client words in the user's language.
 * - `stale`: the key changed since the editor opened it.
 * - `shape`: not the kind of value the game stores there (`path` says where).
 * - `tooLong`: text past `max` characters, or a list past `max` entries (`path` says where).
 * - `tooLarge`: the whole value past the size a hand edit may save.
 * - `rename`: a name changed. Names link cards, NPCs, the party, live sheets and bags.
 * - `partyChanged`: a character card or arc added or removed, or an NPC who joined the party removed
 *   (the party is not edited here).
 * - `duplicateId`: two NPCs share an id.
 * - `idChanged`: an NPC kept its name but not its id.
 * - `sheet`: a ruleset sheet the game's ruleset can't read.
 * - `sheetRemoved`: a card's ruleset sheet removed (the character would start over from a blank one).
 * - `noRuleset`: a changed ruleset sheet in a game whose ruleset can't be loaded to check it.
 * - `sessionsChanged`: a session summary added, removed, or changed outside its text.
 * - `emptySummary`: a session summary left without its recap.
 */
export type GameDataEditIssue = {
  key: GameDataEditableKey;
  reason:
    | "stale"
    | "shape"
    | "tooLong"
    | "tooLarge"
    | "rename"
    | "partyChanged"
    | "duplicateId"
    | "idChanged"
    | "sheet"
    | "sheetRemoved"
    | "noRuleset"
    | "sessionsChanged"
    | "emptySummary";
  /** Where in the value, e.g. `2.name` (list positions count from 0). */
  path?: string;
  /** Whose card, NPC or arc it is about. */
  name?: string;
  max?: number;
};

/** The body of a refused save: 409 when any key is stale, 400 otherwise. */
export interface GameDataEditRefusal {
  error: string;
  issues: GameDataEditIssue[];
}
