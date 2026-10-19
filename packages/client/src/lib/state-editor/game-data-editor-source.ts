// ──────────────────────────────────────────────
// Game data as a State Editor source: a Game Mode chat's own metadata
// (party cards, NPCs, journal, story, maps, …) grouped into sections.
// A section is editable when every key in it is on the shared allow-list; its
// edits save through the validating PATCH /api/game/:chatId/data (#7743), never
// the generic metadata PATCH.
// ──────────────────────────────────────────────
import { isGameDataEditableKey, normalizeGameInventoryStacks, type GameDataEditRequest } from "@marinara-engine/shared";
import { stateValuesEqual } from "./state-editor-json";
import type { StateEditorChange, StateEditorSection } from "./state-editor.types";

/** The game's own routes a section saves through instead of PATCH /api/game/:chatId/data. */
export type GameDataSectionRoute = "inventory" | "world" | "story" | "partySheet" | "widgets";

interface GameDataSectionDef {
  id: string;
  /** Metadata keys shown in this section. One key shows its value as is; several show as an object by key. */
  keys: readonly string[];
  /** Saved through this route, which checks it its own way, rather than through the data route. */
  route?: GameDataSectionRoute;
}

/** The named sections, in the order the editor lists them. Keys no section names fall into "settings" or "other". */
export const GAME_DATA_SECTIONS: readonly GameDataSectionDef[] = [
  { id: "partyCards", keys: ["gameCharacterCards"] },
  { id: "partySheet", keys: ["gamePartySheet"], route: "partySheet" },
  { id: "npcs", keys: ["gameNpcs"] },
  { id: "journal", keys: ["gameJournal"] },
  { id: "playerNotes", keys: ["gamePlayerNotes"] },
  { id: "inventory", keys: ["gameInventory"], route: "inventory" },
  { id: "story", keys: ["gameWorldOverview", "gameStoryArc", "gamePlotTwists", "gamePartyArcs"] },
  { id: "sessionSummaries", keys: ["gamePreviousSessionSummaries"] },
  { id: "world", keys: ["gameWorld"] },
  /** The hand-edits layer over the world (its `edits`), saved through PUT /world/edits. The world itself is never written. */
  { id: "worldEdits", keys: ["gameWorld"], route: "world" },
  { id: "storyScript", keys: ["gameStory"], route: "story" },
  { id: "widgets", keys: ["gameWidgetState"], route: "widgets" },
  { id: "timeWeather", keys: ["gameTime", "gameWeather", "gameMorale"] },
  {
    id: "maps",
    keys: [
      "gameMap",
      "gameMaps",
      "activeGameMapId",
      "lastMapPosition",
      "gameInitialMapFallback",
      "gameDungeonMap",
      "gameDungeonWalk",
      "gameWorldWalk",
      "gameTownSpot",
      "gameTownVisit",
    ],
  },
  { id: "combat", keys: ["gameCombatState", "gameTacticalCombatSnapshot"] },
  { id: "items", keys: ["gameInventedItems", "gameLootedFights", "gameStartingGearTaken", "gameInventoryTurn"] },
  {
    id: "session",
    keys: [
      "gameSessionNumber",
      "gameSessionStatus",
      "gameIntroPresented",
      "gameCurrentSessionStartedAt",
      "gameActiveState",
    ],
  },
  { id: "setup", keys: ["gameSetupConfig"] },
  {
    id: "identity",
    keys: [
      "gameId",
      "gameRuleset",
      "gameRulesetAdvancementBase",
      "gamePartySheetRevision",
      "gameExperienceId",
      "gameStyle",
      "gameIntro",
      "gameWorldKit",
      "gameMapPack",
      "gameInitialSetup",
      "gameBlueprint",
      "gamePartyCharacterIds",
      "gameGmMode",
      "gameGmCharacterId",
      "gamePartyChatId",
      "gameDialogueChatId",
      "gameCombatChatId",
      "metadataWriteOrdinals",
    ],
  },
];

/** The two catch-all sections, listed after the named ones. */
export const GAME_DATA_SETTINGS_SECTION_ID = "settings";
export const GAME_DATA_OTHER_SECTION_ID = "other";

/** Prompt, media, music, dice and agent preferences (edited in the chat settings drawer). */
const SETTINGS_KEY =
  /Prompt|Instructions|Image|Video|Storyboard|Spotify|Music|Lorebook|Dice|Connection|Sequential|CombatStyle/;

const NAMED_KEYS = new Set(GAME_DATA_SECTIONS.flatMap((section) => section.keys));

/** A named section with a route of its own, or whose every key a hand edit may write. The catch-alls never are. */
function isEditableSection(def: GameDataSectionDef): boolean {
  return def.route !== undefined || def.keys.every(isGameDataEditableKey);
}

/** The route a section saves through, when it isn't the data route. */
export function gameDataSectionRoute(sectionId: string): GameDataSectionRoute | undefined {
  return GAME_DATA_SECTIONS.find((def) => def.id === sectionId)?.route;
}

/** The world's hand-edits layer, null when it has none, or undefined for a game with no world. */
export function readGameWorldEdits(metadata: Record<string, unknown>): unknown {
  const world = metadata.gameWorld;
  if (!world || typeof world !== "object" || Array.isArray(world)) return undefined;
  return (world as { edits?: unknown }).edits ?? null;
}

/** What a section with a route of its own shows, read from metadata (to tell whether it changed since). */
export function readGameDataRouteSection(metadata: Record<string, unknown>, sectionId: string): unknown {
  if (sectionId === "worldEdits") return readGameWorldEdits(metadata) ?? null;
  const key = GAME_DATA_SECTIONS.find((def) => def.id === sectionId)?.keys[0];
  return key ? (shownValue(key, metadata[key]) ?? null) : null;
}

/** What a section shows of a key: the inventory as the game reads it (every stack with its id). */
function shownValue(key: string, value: unknown): unknown {
  return key === "gameInventory" ? normalizeGameInventoryStacks(value) : value;
}

/** A metadata key that belongs to Game Mode: every `game*` key, plus the named ones without that prefix. */
function isGameKey(key: string): boolean {
  return /^game[A-Z]/.test(key) || NAMED_KEYS.has(key);
}

/** The chat's metadata as an object, whether it arrived parsed or as its stored JSON string. */
export function readGameMetadata(metadata: unknown): Record<string, unknown> {
  let parsed = metadata;
  if (typeof metadata === "string") {
    try {
      parsed = JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

function pick(metadata: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (metadata[key] !== undefined) picked[key] = shownValue(key, metadata[key]);
  }
  return picked;
}

/**
 * The game's metadata as editor sections. A section none of whose keys the game has is left out;
 * every `game*` key no named section lists still shows, under Settings or Other.
 */
export function buildGameDataEditorSections(
  metadata: Record<string, unknown>,
  localize: (sectionId: string, part: "label" | "description") => string,
): StateEditorSection[] {
  // A catch-all always shows by key, so a lone key there keeps its name.
  const section = (
    id: string,
    keys: readonly string[],
    { byKey = keys.length > 1, editable = false } = {},
  ): StateEditorSection | null => {
    const picked = pick(metadata, keys);
    if (Object.keys(picked).length === 0) return null;
    return {
      id,
      label: localize(id, "label"),
      description: localize(id, "description"),
      value: byKey ? picked : picked[keys[0]!],
      readOnly: !editable,
    };
  };

  const worldEdits = readGameWorldEdits(metadata);
  const worldEditsSection = (): StateEditorSection | null =>
    worldEdits === undefined
      ? null
      : {
          id: "worldEdits",
          label: localize("worldEdits", "label"),
          description: localize("worldEdits", "description"),
          value: worldEdits,
        };

  const rest = Object.keys(metadata)
    .filter((key) => isGameKey(key) && !NAMED_KEYS.has(key))
    .sort();
  const settingsKeys = rest.filter((key) => SETTINGS_KEY.test(key));
  const otherKeys = rest.filter((key) => !SETTINGS_KEY.test(key));

  return [
    ...GAME_DATA_SECTIONS.map((def) =>
      def.id === "worldEdits" ? worldEditsSection() : section(def.id, def.keys, { editable: isEditableSection(def) }),
    ),
    section(GAME_DATA_SETTINGS_SECTION_ID, settingsKeys, { byKey: true }),
    section(GAME_DATA_OTHER_SECTION_ID, otherKeys, { byKey: true }),
  ].filter((item): item is StateEditorSection => item !== null);
}

export type GameDataEditorIssue = { kind: "notObject" } | { kind: "unknownKey"; key: string } | { kind: "readOnly" };

/**
 * The per-key edits for the changed sections, each with the value the editor opened (null when the
 * key was absent), so the server can refuse a key that changed since. A several-key section sends
 * only the keys whose value changed; a key removed from it is sent as null.
 */
export function buildGameDataEditorEdits(
  opened: Record<string, unknown>,
  changes: StateEditorChange[],
): { edits: GameDataEditRequest["edits"] } | { sectionId: string; issue: GameDataEditorIssue } {
  const edits: GameDataEditRequest["edits"] = [];
  for (const change of changes) {
    const def = GAME_DATA_SECTIONS.find((item) => item.id === change.sectionId);
    if (!def || !isEditableSection(def)) return { sectionId: change.sectionId, issue: { kind: "readOnly" } };
    // Saved through its own route by the caller.
    if (def.route) continue;
    const keys = def.keys.filter(isGameDataEditableKey);
    let values: Record<string, unknown>;
    if (keys.length === 1) {
      values = { [keys[0]!]: change.value };
    } else {
      if (!change.value || typeof change.value !== "object" || Array.isArray(change.value)) {
        return { sectionId: change.sectionId, issue: { kind: "notObject" } };
      }
      values = change.value as Record<string, unknown>;
      const unknown = Object.keys(values).find((key) => !(keys as readonly string[]).includes(key));
      if (unknown !== undefined) return { sectionId: change.sectionId, issue: { kind: "unknownKey", key: unknown } };
    }
    for (const key of keys) {
      const before = opened[key] ?? null;
      const after = values[key] ?? null;
      if (!stateValuesEqual(before, after)) edits.push({ key, expected: before, value: after });
    }
  }
  return { edits };
}
