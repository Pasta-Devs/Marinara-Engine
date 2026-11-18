import { z } from "zod";
import { GAME_COMBAT_STYLE_ID_PATTERN } from "../types/game.js";
import { SYMBOL_DICE_NOTATION_MAX_LENGTH } from "../features/rulesets/symbol-dice-notation.js";
import { WORLD_GROUNDINGS } from "../features/world/game-world.js";
import { worldBriefSchema } from "./world-brief.schema.js";
import { worldKitSchema } from "./world-kit.schema.js";

const trimmedWidgetString = (max: number) => z.string().trim().min(1).max(max);

export const gameRouteHudWidgetSchema = z.object({
  id: trimmedWidgetString(80),
  type: z.enum([
    "progress_bar",
    "gauge",
    "relationship_meter",
    "counter",
    "stat_block",
    "list",
    "inventory_grid",
    "timer",
  ]),
  label: trimmedWidgetString(120),
  icon: z.string().trim().max(16).optional(),
  position: z.enum(["hud_left", "hud_right"]),
  accent: z.string().trim().max(32).optional(),
  config: z.record(z.string(), z.unknown()).prefault({}),
});

/**
 * A combat style: a built-in one or the id of a style a client registered (issue #8109). The server
 * cannot know a client's registrations, so it checks the shape only; a client plays an id it does not
 * know as classic, and so does the server's own prompting.
 */
export const gameRouteGameCombatStyleIdSchema = z.string().regex(GAME_COMBAT_STYLE_ID_PATTERN);

export const gameRouteSetupSchema = z.object({
  chatId: z.string().min(1),
  connectionId: z.string().optional(),
  promptPresetId: z.string().nullable().optional(),
  preferences: z.string().max(5000).default(""),
  streaming: z.boolean().optional().default(true),
  debugMode: z.boolean().optional().default(false),
});

export const gameRouteGameStartSchema = z.object({
  chatId: z.string().min(1),
  connectionId: z.string().optional(),
});

export const gameRouteStartSessionSchema = z.object({
  gameId: z.string().min(1),
  sourceChatId: z.string().min(1).optional(),
  connectionId: z.string().optional(),
});

export const gameRouteConcludeSessionSchema = z.object({
  chatId: z.string().min(1),
  connectionId: z.string().optional(),
  nextSessionRequest: z.string().max(5000).optional().default(""),
  streaming: z.boolean().optional().default(true),
});

export const gameRouteRegenerateSessionConclusionSchema = gameRouteConcludeSessionSchema.extend({
  sessionNumber: z.number().int().min(1),
});

export const gameRouteUpdateCampaignProgressionSchema = gameRouteConcludeSessionSchema.extend({
  sessionNumber: z.number().int().min(1),
});

export const gameRouteRegenerateSessionLorebookSchema = z.object({
  chatId: z.string().min(1),
  connectionId: z.string().optional(),
  sessionNumber: z.number().int().min(1).optional(),
  streaming: z.boolean().optional().default(true),
});

export const gameRouteJsonRepairApplySchema = z.object({
  chatId: z.string().min(1),
  rawJson: z.string().min(1),
  connectionId: z.string().optional(),
  sessionNumber: z.number().int().min(1).optional(),
  nextSessionRequest: z.string().max(5000).optional().default(""),
});

export const gameRouteRecruitPartyMemberSchema = z.object({
  chatId: z.string().min(1),
  characterName: z.string().min(1).max(200),
  /** The player's pick when several characters share the name: a library card id, or null for the game's own. */
  characterId: z.string().min(1).max(500).nullable().optional(),
  connectionId: z.string().optional(),
  /** A copy of this party member joins instead (5e's Simulacrum): their card and sheet, under the new name;
   *  or, naming none, a copy of a creature of the ruleset's bestiaries, fighting as that creature. */
  copyOf: z.string().min(1).max(200).optional(),
  /** A condition of the pinned ruleset the copy holds from the start: Simulacrum's halved health. */
  condition: z.string().min(1).max(80).optional(),
  /** MRPG games (owner 2026-11-06): the level the Game Master has this late joiner come in at, and their
   *  growths and stats off the norm as it wrote them ("strength+30, speed+20"). */
  mrpg: z
    .object({
      level: z.number().int().min(1).max(30).optional(),
      growths: z.string().max(400).optional(),
      stats: z.string().max(400).optional(),
    })
    .optional(),
});

export const gameRouteRegenerateCharacterSheetSchema = z.object({
  chatId: z.string().min(1),
  characterId: z.string().min(1).max(500),
  characterName: z.string().min(1).max(200),
  connectionId: z.string().optional(),
  debugMode: z.boolean().optional().default(false),
});

export const gameRouteRemovePartyMemberSchema = z.object({
  chatId: z.string().min(1),
  characterName: z.string().min(1).max(200),
});

export const gameRouteDiceRollSchema = z.object({
  /** The game it is rolled for; a sheet editor outside any game (a rolled list column) has none. */
  chatId: z.string().min(1).optional(),
  /** NdM or a keep/drop pool; in a game whose ruleset throws symbol dice, also those dice by name. */
  notation: z.string().trim().min(1).max(SYMBOL_DICE_NOTATION_MAX_LENGTH),
  context: z.string().max(500).optional(),
});

export const gameRouteStateTransitionSchema = z.object({
  chatId: z.string().min(1),
  newState: z.enum(["exploration", "dialogue", "combat", "travel_rest"]),
});

export const gameRouteWorldKitWriteSchema = z.object({
  connectionId: z.string().min(1).optional(),
  genre: z.string().min(1).max(200),
  // As long as a game's own setting may be (`gameSetupConfigSchema`), so a setting the game accepts
  // is never refused here.
  setting: z.string().min(1),
  tone: z.string().min(1).max(200),
  /** The kit the player has chosen so far, written over to fit their setting. */
  start: worldKitSchema.optional(),
  language: z.string().max(100).optional(),
  /** The generation settings the game's setup chose (its reasoning effort among them), over the connection's
   *  own (cheap-GM playtest 2026-10-26: a world written at the connection's maximum effort, not the Medium
   *  the wizard was set to, stalled the game). */
  generationParameters: z.unknown().optional(),
  debugMode: z.boolean().optional(),
});

export const gameRouteWorldBriefWriteSchema = z.object({
  connectionId: z.string().min(1).optional(),
  kit: worldKitSchema,
  genre: z.string().min(1).max(200),
  setting: z.string().min(1),
  tone: z.string().min(1).max(200),
  playerGoals: z.string().max(2000).optional(),
  language: z.string().max(100).optional(),
  /** Places read from the player's lore (`/game/world-canon`), kept exactly. */
  canon: worldBriefSchema.shape.places.optional(),
  /** Dated events read from the player's lore, kept exactly. */
  canonEvents: worldBriefSchema.shape.events.optional(),
  grounding: z.enum(WORLD_GROUNDINGS).default("expand"),
  generationParameters: z.unknown().optional(),
  debugMode: z.boolean().optional(),
});

export const gameRouteWorldCanonReadSchema = z.object({
  connectionId: z.string().min(1),
  kit: worldKitSchema,
  lorebookIds: z.array(z.string().min(1)).min(1).max(20),
  entryIds: z.array(z.string().min(1)).max(1000).optional(),
  generationParameters: z.unknown().optional(),
  debugMode: z.boolean().optional(),
});

export const gameRouteMapGenerateSchema = z.object({
  chatId: z.string().min(1),
  locationType: z.string().min(1).max(200),
  context: z.string().max(50000).default(""),
  connectionId: z.string().optional(),
});

export const gameRouteMapMoveSchema = z.object({
  chatId: z.string().min(1),
  position: z.union([z.object({ x: z.number().int(), y: z.number().int() }), z.string().min(1).max(200)]),
  mapId: z.string().min(1).max(200).optional().nullable(),
});

export const gameRouteMapBindingSchema = z.discriminatedUnion("target", [
  z.object({
    target: z.literal("map"),
    chatId: z.string().min(1),
    mapId: z.string().min(1).max(200),
    spatialLocationId: z.string().min(1).nullable(),
  }),
  z.object({
    target: z.literal("cell"),
    chatId: z.string().min(1),
    mapId: z.string().min(1).max(200),
    x: z.number().int(),
    y: z.number().int(),
    spatialLocationId: z.string().min(1).nullable(),
  }),
  z.object({
    target: z.literal("node"),
    chatId: z.string().min(1),
    mapId: z.string().min(1).max(200),
    nodeId: z.string().min(1).max(200),
    spatialLocationId: z.string().min(1).nullable(),
  }),
]);
