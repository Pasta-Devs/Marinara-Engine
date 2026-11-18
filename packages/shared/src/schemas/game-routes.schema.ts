import { z } from "zod";
import { GAME_COMBAT_STYLE_ID_PATTERN } from "../types/game.js";
import { TACTICAL_BATTLEFIELD_SIZES, TERRAIN_DATA } from "../features/tactical-combat/types.js";
import { SYMBOL_DICE_NOTATION_MAX_LENGTH } from "../features/rulesets/symbol-dice-notation.js";
import { WORLD_GROUNDINGS, gameWorldSchema } from "../features/world/game-world.js";
import { worldBriefSchema } from "./world-brief.schema.js";
import { worldKitSchema } from "./world-kit.schema.js";
import { normalizeGameDifficulty, combatWeatherSchema } from "../features/combat-conditions.js";
import { gameIntroChoiceSchema } from "../features/world/game-intro.js";
import { GAME_RATING_GUIDELINES_MAX_CHARS } from "../constants/game-rating-guidelines.js";
import {
  GAME_STORY_STYLES,
  GAME_VIOLENCE_LEVELS,
  GAME_CONTENT_BOUNDARIES_MAX_CHARS,
} from "../constants/game-story-style.js";
import { rulesetRefSchema, RULESET_REF_MAX_OPTIONS } from "./ruleset.schema.js";
import { storyScriptSchema } from "../features/world/story.js";
import {
  GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
  GAME_STORYBOARD_KEYFRAME_COUNT_MAX,
  GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN,
  GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX,
} from "../constants/game-storyboard-prompts.js";
import { partialInput } from "../utils/zod-input.js";
import { generationParametersSchema } from "./prompt.schema.js";
import { MARINARA_ARCHETYPES, type MarinaraArchetype } from "../features/marinara-classes.js";
import { combatTacticsSchema, combatAiHintsSchema } from "../features/combat-ai.js";
import { combatInterruptFields } from "../features/combat-director.js";
import { worldElementSetSchema } from "../features/world/elements.js";
import { sceneAnalysisRequestSchema } from "./scene-analysis.schema.js";

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

export const MAX_TACTICAL_BATTLEFIELD_SEED = 0xffff_ffff;

export const tacticalBattlefieldSeedSchema = z
  .number()
  .int("Battlefield seed must be a whole number.")
  .min(0, "Battlefield seed must be at least 0.")
  .max(MAX_TACTICAL_BATTLEFIELD_SEED, `Battlefield seed must be at most ${MAX_TACTICAL_BATTLEFIELD_SEED}.`);

export const tacticalBattlefieldSetupSchema = z
  .object({
    seed: tacticalBattlefieldSeedSchema.optional(),
    size: z.enum(TACTICAL_BATTLEFIELD_SIZES).optional(),
    instructions: z.string().trim().max(4000).optional(),
  })
  .strict();

// Known terrain keys, derived at runtime from the shared engine's own data
// so this list can never drift from what `terrainInfoAt` actually handles.
const KNOWN_TERRAIN_TYPES = new Set(Object.keys(TERRAIN_DATA));

export function generatedStringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      generatedStringValue(record.name) ??
      generatedStringValue(record.label) ??
      generatedStringValue(record.id) ??
      generatedStringValue(record.type)
    );
  }
  return undefined;
}

/** Shape and length ceiling for a game-surface Experience's package id (#5102). The setup schema
 *  and the experience-state route's resolver must validate a stamp identically — a looser rule here
 *  would mint ids the route then rejects with 409, a tighter one would strand already-stored stamps. */
export const GAME_EXPERIENCE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const GAME_EXPERIENCE_ID_MAX_CHARS = 80;

/** Cap for the opaque `experienceConfig`, so it can't grow into a payload every later write of the
 *  setup config has to carry. Generous next to what a setup wizard actually collects. */
export const MAX_EXPERIENCE_CONFIG_CHARS = 262_144;

export const MAX_GAME_HUD_WIDGETS = 4;

export const GAME_REPUTATION_ACTION_MAX_LENGTH = 500;

/** Ceiling for a game-surface Experience's per-anchor world-state blob (#5102), counted in
 *  UTF-16 code units of the serialized JSON. Generous for a serialized tile-world save. */
export const MAX_EXPERIENCE_STATE_CHARS = 262_144;

export const gameRouteGeneratedRequiredStringSchema = z.preprocess(
  (value) => generatedStringValue(value) ?? value,
  z.string(),
);

export const gameRouteGeneratedOptionalStringSchema = z.preprocess(
  (value) => generatedStringValue(value),
  z.string().optional(),
);

export const gameRouteSetupConfigSchema = z.object({
  genre: z.string().min(1).max(200),
  setting: z.string().min(1),
  tone: z.string().min(1).max(200),
  difficulty: z.string().min(1).max(100).transform(normalizeGameDifficulty),
  gameStyle: z.enum(["classic", "overworld"]).optional(),
  /** The Game Master's intro message (1.339). */
  gameIntro: gameIntroChoiceSchema.optional(),
  combatStyle: gameRouteGameCombatStyleIdSchema.optional(),
  combatDirector: z.boolean().optional(),
  gmBossControl: z.boolean().optional(),
  gmNamedControl: z.boolean().optional(),
  cruelOpponents: z.boolean().optional(),
  marinaraClasses: z.boolean().optional(),
  permadeath: z.boolean().optional(),
  playerRunsCompanions: z.boolean().optional(),
  tacticalBattlefield: tacticalBattlefieldSetupSchema.optional(),
  tacticalTurnOrder: z.enum(["side", "initiative"]).optional(),
  spatialMapInstructions: z.string().max(4000).optional(),
  gameWorldMapMode: z.enum(["standard", "hierarchical"]).optional(),
  spatialMapDraftSize: z.enum(["small", "medium", "large"]).optional(),
  spatialMapTargetLocationCount: z.number().int().min(1).max(40).optional(),
  spatialMapGroundingMode: z.enum(["setup", "lore_strict", "lore_expand"]).optional(),
  playerGoals: z.string().max(2000).default(""),
  gmMode: z.enum(["standalone", "character"]),
  rating: z.enum(["sfw", "nsfw"]).default("sfw"),
  ratingGuidelines: z.string().max(GAME_RATING_GUIDELINES_MAX_CHARS).nullable().optional(),
  storyStyle: z.enum(GAME_STORY_STYLES).optional(),
  violence: z.enum(GAME_VIOLENCE_LEVELS).optional(),
  contentBoundaries: z.string().max(GAME_CONTENT_BOUNDARIES_MAX_CHARS).nullable().optional(),
  gmCharacterId: z.string().nullable().optional(),
  partyCharacterIds: z.array(z.string()),
  personaId: z.string().nullable().optional(),
  /** Installed package that provides this game's experience. Same shape the manifest allows for an id,
   *  since this is matched against one to mount the surface. */
  gameExperienceId: z.string().regex(GAME_EXPERIENCE_ID_PATTERN).max(GAME_EXPERIENCE_ID_MAX_CHARS).optional(),
  // Only the id and the layer choices in `options` are trusted; the rest of the pin is rebuilt
  // from the server's own registry at creation. The record is bounded here rather than on the pin
  // schema, which also reads games that already exist and must stay readable.
  ruleset: rulesetRefSchema
    .refine((ref) => Object.keys(ref.options).length <= RULESET_REF_MAX_OPTIONS, {
      message: `A ruleset choice carries at most ${RULESET_REF_MAX_OPTIONS} options`,
    })
    .optional(),
  worldKit: worldKitSchema.optional(),
  world: gameWorldSchema.optional(),
  /** The world as it was made (W11), for a world another generator made: checked whole when read, kept
   *  as the game's snapshot, and never stored in the game's metadata. */
  worldSnapshot: z.unknown().optional(),
  /** The world's story script (worldgen W10): read here, checked against the world once it is read. */
  story: storyScriptSchema.optional(),
  /** Opaque config owned by that experience — persisted verbatim, never read by the host. */
  experienceConfig: z
    .record(z.string().max(120), z.unknown())
    .refine((value) => JSON.stringify(value).length <= MAX_EXPERIENCE_CONFIG_CHARS, {
      message: `experienceConfig must serialize to at most ${MAX_EXPERIENCE_CONFIG_CHARS} characters`,
    })
    .optional(),
  sceneConnectionId: z.string().optional(),
  enableAgents: z.boolean().optional(),
  enableQuickTimeEvents: z.boolean().optional(),
  enableSpriteGeneration: z.boolean().optional(),
  gameImageDynamicPromptEnabled: z.boolean().optional(),
  imageConnectionId: z.string().optional(),
  videoConnectionId: z.string().optional(),
  audioConnectionId: z.string().optional(),
  enableGameSoundEffects: z.boolean().optional(),
  enableGameMusic: z.boolean().optional(),
  gameStoryboardAutoIllustrationsEnabled: z.boolean().optional(),
  gameStoryboardAutoGenerationEnabled: z.boolean().optional(),
  gameStoryboardsEnabled: z.boolean().optional(),
  gameStoryboardKeyframeCount: z
    .number()
    .int()
    .min(GAME_STORYBOARD_KEYFRAME_COUNT_MIN)
    .max(GAME_STORYBOARD_KEYFRAME_COUNT_MAX)
    .optional(),
  gameGmPromptTemplateId: z.string().max(200).nullable().optional(),
  gameStoryboardAnimationPromptTemplateId: z.string().max(200).nullable().optional(),
  gameStoryboardImagePromptTemplateId: z.string().max(200).nullable().optional(),
  gameStoryboardVideoPromptTemplateId: z.string().max(200).nullable().optional(),
  artStylePrompt: z.string().max(500).optional(),
  generatedArtStylePrompt: z.string().max(500).optional(),
  useCampaignArtStyle: z.boolean().optional(),
  imageStyleProfileId: z.string().nullable().optional(),
  activeLorebookIds: z.array(z.string()).optional(),
  activeLorebookEntryIds: z.array(z.string().min(1)).max(100).optional(),
  enableCustomWidgets: z.boolean().optional(),
  customHudWidgets: z.array(gameRouteHudWidgetSchema).max(MAX_GAME_HUD_WIDGETS).optional(),
  enableSpotifyDj: z.boolean().optional(),
  spotifySourceType: z.enum(["liked", "playlist", "artist", "any"]).optional(),
  spotifyPlaylistId: z.string().nullable().optional(),
  spotifyPlaylistName: z.string().nullable().optional(),
  spotifyArtist: z.string().nullable().optional(),
  enableLorebookKeeper: z.boolean().optional(),
  language: z.string().min(1).max(100).optional(),
  autoTranslate: z.boolean().optional(),
  translationOutputTargetLang: z.string().trim().min(1).max(100).optional(),
  generationParameters: partialInput(generationParametersSchema).optional(),
  promptPresetId: z.string().nullable().optional(),
  gameSystemPrompt: z.string().max(50_000).nullable().optional(),
  gameSpecialInstructions: z.string().max(2000).nullable().optional(),
});

export const gameRouteCreateGameSchema = z.object({
  name: z.string().min(1).max(200),
  setupConfig: gameRouteSetupConfigSchema,
  preferences: z.string().max(5000).default(""),
  shareLabels: z
    .object({
      experienceName: z.string().max(120).optional(),
      rulesetName: z.string().max(120).optional(),
      experienceSeedKey: z.string().max(120).optional(),
      characterNames: z.record(z.string(), z.string().max(500)).optional(),
      lorebookNames: z.record(z.string(), z.string().max(500)).optional(),
      promptPresetNames: z.record(z.string(), z.string().max(500)).optional(),
      personaName: z.string().max(500).nullable().optional(),
    })
    .optional(),
  connectionId: z.string().optional(),
  promptPresetId: z.string().optional(),
  chatId: z.string().optional(),
});

export const gameRouteHudWidgetListSchema = z.array(gameRouteHudWidgetSchema).max(MAX_GAME_HUD_WIDGETS);

export const gameRouteMarinaraJoinBodySchema = z.object({
  chatId: z.string().min(1),
  name: z.string().min(1).max(200),
  level: z.number().int().min(1).max(30).optional(),
  growths: z.string().max(400).optional(),
  stats: z.string().max(400).optional(),
  sister: z.string().max(40).optional(),
});

export const gameRouteMarinaraUpgradeLegacyPreviewQuerySchema = z.object({ chatId: z.string().min(1) });

export const gameRouteMarinaraUpgradeLegacyBodySchema = z.object({
  chatId: z.string().min(1),
  connectionId: z.string().optional(),
  members: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        primary: z.enum(MARINARA_ARCHETYPES as unknown as [MarinaraArchetype, ...MarinaraArchetype[]]).optional(),
      }),
    )
    .max(24)
    .default([]),
  /** The Legacy gear stacks whose MRPG piece the player took; absent takes every one offered. */
  gear: z.array(z.string().min(1).max(200)).max(500).optional(),
});

// Resolve a d20 skill check using player stats.
export const gameRouteSkillCheckSchema = z
  .object({
    chatId: z.string().min(1),
    skill: z.string().min(1).max(100),
    /** Optional only beside `difficulty`, which a ruleset game reads off its own ladder instead. */
    dc: z.number().int().min(1).max(40).optional(),
    advantage: z.boolean().optional(),
    disadvantage: z.boolean().optional(),
    preRolledD20: z.number().int().min(1).max(20).optional(),
    /** The party member to roll for in a game with a pinned ruleset; ignored without one. */
    who: z.string().trim().min(1).max(100).optional(),
    /** `with=`, `threshold=`, `bonus=`, `difficulty=`, `explode=`, `double=` and `reroll=` off the tag, so this
     *  fallback asks the ruleset the same question generation would have. Each is ignored where the
     *  ruleset does not take it. */
    withAbility: z.string().trim().min(1).max(100).optional(),
    /** `for=` (1.752): what the check is made for, "climb" or "swim". */
    purpose: z.string().trim().min(1).max(40).optional(),
    threshold: z.number().int().min(1).max(1000).optional(),
    bonusDice: z.number().int().min(-20).max(20).optional(),
    difficulty: z.string().trim().min(1).max(80).optional(),
    explode: z.number().int().min(2).max(1000).optional(),
    double: z.number().int().min(2).max(1000).optional(),
    reroll: z.string().trim().min(1).max(40).optional(),
    /** `plot=` (1.822): throw the plot die with the check. Ignored where the ruleset does not take it. */
    plot: z.boolean().optional(),
    /** `shift=` (1.823): bands to move the outcome. */
    shift: z.number().int().min(-3).max(3).optional(),
    /** `hunger=` (1.824): special dice among the pool. */
    hunger: z.number().int().min(0).max(100).optional(),
    /** `gear=` (1.826): gear dice added to a grouped pool. */
    gear: z.number().int().min(0).max(100).optional(),
    messageId: z.string().min(1).optional(),
  })
  .refine((input) => input.dc !== undefined || input.difficulty !== undefined, {
    message: "A check needs a dc or a difficulty",
  });

// Apply a morale event and return updated state.
export const gameRouteMoraleSchema = z.object({
  chatId: z.string().min(1),
  event: z.string().min(1).max(50),
});

export const gameRouteCombatRoundBodySchema = z.object({
  chatId: z.string().min(1),
  combatants: z.array(
    z.object({
      id: gameRouteGeneratedRequiredStringSchema,
      name: gameRouteGeneratedRequiredStringSchema,
      hp: z.number(),
      maxHp: z.number(),
      spellSlots: z.record(z.string().regex(/^[1-9]$/), z.number().int().min(0).max(100)).optional(),
      mp: z.number().optional(),
      maxMp: z.number().optional(),
      attack: z.number(),
      defense: z.number(),
      speed: z.number(),
      level: z.number(),
      side: z.enum(["player", "enemy"]).optional(),
      tactics: combatTacticsSchema.optional(),
      controller: z.enum(["manual", "ai"]).optional(),
      skillCooldowns: z.record(z.string(), z.number().int().min(0).max(10000)).optional(),
      skills: z
        .array(
          z.object({
            id: gameRouteGeneratedRequiredStringSchema,
            name: gameRouteGeneratedRequiredStringSchema,
            type: z.enum(["attack", "heal", "buff", "debuff"]),
            ...combatInterruptFields,
            mpCost: z.number().min(0),
            power: z.number(),
            description: gameRouteGeneratedOptionalStringSchema,
            cooldown: z.number().optional(),
            element: gameRouteGeneratedOptionalStringSchema,
            statusEffect: gameRouteGeneratedOptionalStringSchema,
          }),
        )
        .optional(),
      statusEffects: z
        .array(
          z.object({
            name: gameRouteGeneratedRequiredStringSchema,
            modifier: z.number(),
            stat: z.enum(["attack", "defense", "speed", "hp"]),
            turnsLeft: z.number(),
          }),
        )
        .optional(),
      element: gameRouteGeneratedOptionalStringSchema,
      elementAura: z
        .object({
          element: gameRouteGeneratedRequiredStringSchema,
          gauge: z.number(),
          sourceId: gameRouteGeneratedRequiredStringSchema,
        })
        .nullable()
        .optional(),
    }),
  ),
  round: z.number().int().min(1),
  playerAction: z
    .object({
      type: z.enum(["attack", "skill", "defend", "item", "flee"]),
      targetId: z.string().optional(),
      skillId: z.string().optional(),
      itemId: z.string().optional(),
      itemEffect: z
        .object({
          name: gameRouteGeneratedRequiredStringSchema,
          target: z.enum(["self", "ally", "enemy", "any"]).catch("any"),
          type: z.enum(["heal", "damage", "buff", "debuff", "status", "utility"]).catch("utility"),
          description: gameRouteGeneratedRequiredStringSchema,
          power: z.number().optional(),
          element: gameRouteGeneratedOptionalStringSchema,
          status: z
            .object({
              name: gameRouteGeneratedRequiredStringSchema,
              emoji: gameRouteGeneratedRequiredStringSchema,
              duration: z.number(),
              modifier: z.number().optional(),
              stat: z.enum(["attack", "defense", "speed", "hp"]).optional().catch(undefined),
            })
            .optional(),
          consumes: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  mechanics: z
    .array(
      z.object({
        name: gameRouteGeneratedRequiredStringSchema,
        description: gameRouteGeneratedRequiredStringSchema,
        ownerName: gameRouteGeneratedOptionalStringSchema,
        // A word the Engine has none of ("charge") goes off as an attack does (laptop playtest 2026-10-25).
        trigger: z.enum(["round_interval", "hp_threshold", "on_hit", "on_attack", "passive"]).catch("on_attack"),
        interval: z.number().optional(),
        hpThreshold: z.number().optional(),
        counterplay: gameRouteGeneratedOptionalStringSchema,
        effectType: z
          .enum(["damage_all", "damage_one", "buff_self", "debuff_party", "status_party", "status_enemy"])
          .optional()
          .catch(undefined),
        power: z.number().optional(),
        element: gameRouteGeneratedOptionalStringSchema,
        status: z
          .object({
            name: gameRouteGeneratedRequiredStringSchema,
            emoji: gameRouteGeneratedRequiredStringSchema,
            duration: z.number(),
            modifier: z.number().optional(),
            stat: z.enum(["attack", "defense", "speed", "hp"]).optional().catch(undefined),
          })
          .optional(),
      }),
    )
    .optional(),
});

export const gameRouteCombatRoundPartySchema = gameRouteCombatRoundBodySchema.extend({
  partyActions: z
    .record(
      z
        .string()
        .min(1)
        .max(256)
        .refine((id) => !["__proto__", "constructor", "prototype"].includes(id)),
      gameRouteCombatRoundBodySchema.shape.playerAction.unwrap(),
    )
    .refine((value) => Object.keys(value).length <= 20)
    .optional(),
  controlledId: z.string().min(1).optional(),
});

// A combatant blob from the client. The engine reads a fixed set of numeric
// fields; everything else (mp/skills/statusEffects/element/sprite/side) passes
// through untouched so hydration stays lossless.
export const gameRouteTacticalSkillSchema = z
  .object({
    projectile: z.boolean().optional(),
    requiresSight: z.boolean().optional(),
    id: z.string(),
    name: z.string().min(1),
    type: z.enum(["attack", "heal", "buff", "debuff"]),
    mpCost: z.number().min(0),
    power: z.number().min(0),
    cooldown: z.number().min(0).optional(),
  })
  .passthrough();

export const gameRouteTacticalCombatantSchema = z
  .object({
    projectile: z.boolean().optional(),
    requiresSight: z.boolean().optional(),
    id: z.string().min(1),
    name: z.string().min(1),
    hp: z.number(),
    maxHp: z.number(),
    attack: z.number(),
    defense: z.number(),
    speed: z.number(),
    level: z.number(),
    skills: z.array(gameRouteTacticalSkillSchema).max(128).optional(),
    tactics: combatTacticsSchema.optional(),
    aiHints: combatAiHintsSchema.optional(),
    controller: z.enum(["manual", "ai"]).optional(),
    movementMode: z.enum(["walk", "fly", "teleport"]).optional(),
  })
  .passthrough();

export const gameRouteTacticalStateUnitSchema = z
  .object({
    projectile: z.boolean().optional(),
    requiresSight: z.boolean().optional(),
    skills: z.array(gameRouteTacticalSkillSchema).max(128).optional(),
    tactics: combatTacticsSchema.optional(),
    aiHints: combatAiHintsSchema.optional(),
    controller: z.enum(["manual", "ai"]).optional(),
    movementMode: z.enum(["walk", "fly", "teleport"]).optional(),
  })
  .passthrough();

// The persisted TacticalCombatState blob. Validated defensively at the
// envelope level only — the shared engine owns the full invariants and never
// throws on unexpected shapes. Dimensions/array sizes are bounded and the
// grid is cross-checked against its declared width/height so a malformed
// round-tripped state fails fast with a 400 instead of crashing the engine
// (see `terrainInfoAt` in shared/tactical-combat/math.ts, which indexes
// TERRAIN_DATA unconditionally).
export const gameRouteTacticalStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    weather: combatWeatherSchema.optional(),
    // The setting's elements (worldgen W6c): a state the client sends back is checked before it is read.
    elements: worldElementSetSchema.optional(),
    grid: z
      .object({
        width: z.number().int().min(1).max(64),
        height: z.number().int().min(1).max(64),
        tiles: z.array(z.array(z.string())),
      })
      .passthrough()
      .superRefine((grid, ctx) => {
        if (grid.tiles.length !== grid.height) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tiles"],
            message: "grid.tiles does not match declared dimensions",
          });
          return;
        }
        for (let y = 0; y < grid.tiles.length; y++) {
          const row = grid.tiles[y];
          if (!row || row.length !== grid.width) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["tiles", y],
              message: "grid.tiles does not match declared dimensions",
            });
            continue;
          }
          for (let x = 0; x < row.length; x++) {
            const cell = row[x];
            if (cell === undefined || !KNOWN_TERRAIN_TYPES.has(cell)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["tiles", y, x],
                message: "unknown terrain type",
              });
            }
          }
        }
      }),
    units: z.array(gameRouteTacticalStateUnitSchema).max(40),
    phase: z.enum(["player", "enemy"]),
    round: z.number().int().min(1).max(10000),
    seed: tacticalBattlefieldSeedSchema,
    actionCounter: z.number().int().min(0).max(1_000_000),
    log: z.array(z.record(z.string(), z.unknown())).max(2000),
    difficulty: z.string(),
    outcome: z.enum(["victory", "defeat", "fled"]).optional(),
    // The order a fight by initiative takes turns in (combat C6c): ids, at most one a unit.
    initiative: z
      .object({ order: z.array(z.string().min(1).max(200)).max(40) })
      .strict()
      .optional(),
  })
  .passthrough();

// A player action. The `type` gate is enforced here; legality (unit exists,
// in range, tile reachable, MP/cooldown) is validated by the engine, which
// returns `{ ok: false, error }` for illegal input.
export const gameRouteTacticalActionSchema = z
  .object({
    type: z.enum(["move", "attack", "skill", "item", "defend", "wait", "endTurn", "flee", "control"]),
    controller: z.enum(["manual", "ai"]).optional(),
  })
  .passthrough();

export const gameRouteCombatTacticalStartBodySchema = z.object({
  chatId: z.string().min(1),
  // Caps mirror /action's units .max(40) so a battle /start accepts can
  // never produce a state /action rejects.
  party: z.array(gameRouteTacticalCombatantSchema).min(1).max(20),
  enemies: z.array(gameRouteTacticalCombatantSchema).min(1).max(20),
  seed: tacticalBattlefieldSeedSchema.optional(),
  weather: combatWeatherSchema.nullable().optional(),
  // Scene-derived battlefield theming (Round 2). Unknown strings normalize
  // in the engine (environment → default, formation → "line").
  environment: z.string().optional(),
  formation: z.string().optional(),
  battlefield: z.unknown().optional(),
});

export const gameRouteCombatTacticalActionBodySchema = z.object({
  chatId: z.string().min(1),
  state: gameRouteTacticalStateSchema,
  action: gameRouteTacticalActionSchema,
});

// An action's span, or (the overworld's real time, worldgen W8) a number of minutes.
export const gameRouteTimeAdvanceBodySchema = z.union([
  z.object({ chatId: z.string().min(1), action: z.string().min(1).max(50) }),
  z.object({
    chatId: z.string().min(1),
    minutes: z
      .number()
      .int()
      .min(1)
      .max(24 * 60),
  }),
]);

export const gameRouteWeatherUpdateBodySchema = z.object({
  chatId: z.string().min(1),
  action: z.string().min(1).max(50),
  location: z.string().max(500).default(""),
  season: z.enum(["spring", "summer", "autumn", "winter"]).default("summer"),
  type: z.string().max(100).optional(),
});

export const gameRouteEncounterRollBodySchema = z.object({
  chatId: z.string().min(1),
  action: z.string().min(1).max(50),
  location: z.string().max(500).default(""),
});

export const gameRouteReputationUpdateBodySchema = z.object({
  chatId: z.string().min(1),
  actions: z.array(
    z.object({
      npcId: z.string(),
      action: z.string().min(1).max(GAME_REPUTATION_ACTION_MAX_LENGTH),
      modifier: z.number().optional(),
    }),
  ),
});

export const gameRouteJournalEntryBodySchema = z.object({
  chatId: z.string().min(1),
  type: z.enum(["location", "npc", "combat", "quest", "item", "event", "note"]),
  data: z.record(z.string(), z.unknown()),
});

export const gameRouteTownInteriorQuerySchema = z.object({ building: z.string().min(1).max(16) });

export const gameRouteTownVisitBodySchema = z.object({ to: z.string().min(1).max(16) });

export const gameRouteMapWalkBodySchema = z.object({
  map: z.string().min(1).max(80),
  x: z.number().int().min(0).max(63),
  y: z.number().int().min(0).max(47),
});

export const gameRouteMapLeaveBodySchema = z.object({ map: z.string().min(1).max(80) });

export const gameRouteMapEnterBodySchema = z
  .object({ at: z.string().min(1).max(16).optional(), place: z.string().min(1).max(16).optional() })
  .refine((value) => Boolean(value.at) !== Boolean(value.place), "A building in town or a site, one of them");

export const gameRouteWorldTownQuerySchema = z.object({ settlement: z.string().min(1).max(16) });

export const gameRouteWorldInteriorQuerySchema = z.object({
  settlement: z.string().min(1).max(16),
  building: z.string().min(1).max(16),
});

export const gameRouteWorldKitsReadBodySchema = z.object({ text: z.string().min(1) });

export const gameRouteWorldPeopleQuerySchema = z.object({ place: z.string().min(1).max(16) });

export const gameRouteWorldBodySchema = z.object({
  worldKit: worldKitSchema,
  world: gameWorldSchema,
  worldSnapshot: z.unknown().optional(),
  story: z.unknown().optional(),
});

export const gameRouteOverworldWalkBodySchema = z.object({ to: z.string().min(1).max(16) });

export const gameRouteEntryIndexSchema = z.coerce.number().int().nonnegative();

export const gameRouteJournalEntriesBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  content: z.string().max(20_000),
});

export const gameRouteEntryIndex2Schema = z.coerce.number().int().nonnegative();

export const gameRouteNotesBodySchema = z.object({ notes: z.string().max(10000) });

export const gameRouteExperienceStateBodySchema = z.object({
  state: z.unknown().optional(),
  schemaVersion: z.number().int().min(1).max(1_000_000).default(1),
  // Experience saves are player-confirmed world state, not mid-turn
  // provisional snapshots, so they default to committed (regen fallback
  // eligible) unlike turn-game rows.
  committed: z.boolean().default(true),
});

// Accepts an export payload back. Each row is rewritten at its ORIGINAL anchor via
// storage.create, whose delete-then-insert dedupe means a re-import over a live
// campaign replaces same-anchor rows — a player wanting a clean slate calls the
// DELETE above first. Import is additive UP TO THE ANCHOR CAP: imported rows are
// stamped newer than everything already stored, so when the merged total exceeds
// EXPERIENCE_STATE_KEEP_ANCHORS the prune evicts the OLDEST-stamped rows — which is
// the pre-existing campaign, not the import. On a chat already at the cap, importing
// a full backup replaces the live campaign's per-turn history entirely (its
// checkpoints survive; they carry state by value). The response's `pruned` count
// reports exactly how many pre-existing rows the merge evicted.
//
// An anchor whose message does not exist in THIS chat (an export replayed into a
// different chat, or one whose anchor message was deleted) is still imported, but under
// a synthetic "imported:<originalId>" anchor rather than the caller's id. That rewrite is
// load-bearing, not cosmetic: the messages→game_engine_state cascade matches on messageId
// ALONE and is never scoped by chatId, so storing a foreign chat's message ids verbatim
// would let the SOURCE chat's message deletions silently destroy the imported campaign
// here. A prefixed id can never equal a real messages.id, so no cascade can reach it, and
// the row still serves through the GET's fallback path (latest committed / latest of any)
// — which is exactly what makes an imported campaign playable again. Rows whose anchors DO
// resolve here keep them, so a same-chat export→import round trip is unaffected and stays
// idempotent. See IMPORTED_GAME_ENGINE_ANCHOR_PREFIX for the validate() exemption that
// stops these by-design dangling refs from reading as integrity errors.
//
// Rate limiting: export/import share a dedicated 20/min class (ROUTE_RULES key
// "game-experience-save-transfer") rather than the 600/min default — see rate-limit.ts.
export const gameRouteExperienceStateImportSchema = z.object({
  rows: z.array(
    z.object({
      /** "" is the live anchor the PUT uses before the first assistant message exists. */
      messageId: z.string().max(200),
      swipeIndex: z.number().int().min(0).max(1_000_000),
      state: z.unknown().optional(),
      schemaVersion: z.number().int().min(1).max(1_000_000).default(1),
      committed: z.boolean().default(true),
      /** Accepted so an export round-trips without stripping fields, but never stored —
       *  see the stamping note in the handler. */
      createdAt: z.string().max(64).optional(),
      /** The export's discriminator for a row whose stored bytes were unreadable (the same
       *  shape the single-row GET emits). Its `state` is null only because the disk bytes
       *  would not parse; the restorable copy is `rawState`. */
      stateUnparseable: z.boolean().optional(),
      /** The stored value verbatim, as a string, capped at the PUT's own ceiling. */
      rawState: z.string().max(MAX_EXPERIENCE_STATE_CHARS).optional(),
      /** True when the capture hit the cap — such a row is missing bytes and cannot be
       *  restored faithfully, so the import skips it. */
      rawStateTruncated: z.boolean().optional(),
    }),
  ),
});

// Exact player lore selections are bounded by the model context, not automatic lorebook budgets.
export const gameRouteExperienceGenerationSchema = z.object({
  /** The package's guidance: what to produce, the schema description, vocabularies. */
  instructions: z.string().min(1).max(16_000),
  /** The request payload (e.g. the player's preferences), appended as the user turn. */
  userContent: z.string().max(8_000).default(""),
  /** Optional JSON schema forwarded as provider-native structured output where
   *  supported (OpenAI-compatible, Google). Advisory elsewhere: Anthropic and
   *  the local sidecar ignore it, so the tolerant parser is the real contract. */
  schema: z
    .record(z.string(), z.unknown())
    .optional()
    .refine(
      (value) => {
        if (value === undefined) return true;
        // stringify can throw on pathological nesting depth; that is a
        // validation failure (→ 400), not a server error.
        try {
          return JSON.stringify(value).length <= 8_000;
        } catch {
          return false;
        }
      },
      { message: "schema must serialize to at most 8000 characters" },
    ),
  schemaName: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,64}$/)
    .default("experience_generation"),
  /** OpenAI strict structured outputs reject most hand-written schemas
   *  (additionalProperties, required-completeness rules), so strict is
   *  opt-in for packages that author their schema to that dialect. */
  strictSchema: z.boolean().default(false),
  debugMode: z.boolean().default(false),
  connectionId: z.string().optional(),
  /** Optional tightening of the stored max-output-token parameter; never a raise. */
  maxTokens: z.number().int().min(256).max(8_192).optional(),
  /** Lorebook ENTRIES the player picked for this generation — never whole books.
   *  Omitted or empty is the default and changes nothing: no lookup runs, the
   *  outbound messages are the ones this route has always sent, and the reply
   *  carries no lorebook key. Non-empty ALWAYS comes back with that key, even
   *  when nothing survived the gates — see the protocol note at the return site.
   *  The complete selection is checked against model context before generation. */
  lorebookEntryIds: z.array(z.string()).optional(),
});

export const gameRouteWidgetsBodySchema = z.object({
  widgets: z.array(gameRouteHudWidgetSchema).max(MAX_GAME_HUD_WIDGETS),
  expected: z.unknown().optional(),
});

// Generates the party's response to the latest GM narration.
// Uses the explicit override, else the chat/GM connection (there is no character-connection tier).
// Returns parsed PartyDialogueLine[] and the raw response text.
export const gameRoutePartyTurnSchema = z.object({
  chatId: z.string().min(1),
  /** The GM narration the party is reacting to. */
  narration: z.string().min(1).max(50000),
  /** Optional player action text that preceded the GM narration. */
  playerAction: z.string().max(5000).optional(),
  /** Override connection (falls back to the chat/GM connection). */
  connectionId: z.string().optional(),
  debugMode: z.boolean().optional().default(false),
});

export const gameRouteSpotifySceneTrackSelectionSchema = z.object({
  uri: z.string().min(1).max(300),
  name: z.string().max(300).nullable().optional(),
  artist: z.string().max(300).nullable().optional(),
  album: z.string().max(300).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});

// Builds a mechanical shortlist from the configured Spotify source. Scene analysis
// then chooses one track from this bounded list, so the model never sees a giant playlist.
export const gameRouteSpotifyCandidatesSchema = z.object({
  chatId: z.string().min(1),
  narration: z.string().max(50000).optional().default(""),
  playerAction: z.string().max(5000).optional(),
  context: z.record(z.string(), z.unknown()).prefault({}),
  limit: z.number().min(1).max(50).optional().default(50),
});

// Plays the track picked by scene analysis in the global Spotify widget.
export const gameRouteSpotifyPlaySchema = z.object({
  chatId: z.string().min(1),
  track: gameRouteSpotifySceneTrackSelectionSchema,
  deviceId: z.string().min(1).nullable().optional(),
  mobileDeviceOnly: z.boolean().optional(),
});

// Scene wrap-up using a regular LLM connection (fallback when sidecar isn't available).
// Uses the same prompt as the sidecar scene analyzer but via API.
export const gameRouteSceneWrapSchema = sceneAnalysisRequestSchema.extend({
  chatId: z.string().min(1),
  streaming: z.boolean().optional().default(true),
  /** Override connection (falls back to scene connection → GM connection). */
  connectionId: z.string().optional(),
});

// Fire-and-forget asset generation for the sidecar path.
// The client calls this after receiving a scene result with unresolvable tags.
export const gameRouteImageSizeSchema = z.object({
  width: z.number().int().min(64).max(4096),
  height: z.number().int().min(64).max(4096),
});

export const gameRouteImageSizesSchema = z
  .object({
    background: gameRouteImageSizeSchema.optional(),
    portrait: gameRouteImageSizeSchema.optional(),
    selfie: gameRouteImageSizeSchema.optional(),
  })
  .optional();

export const gameRouteImagePromptOverrideSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(200),
      prompt: z.string().min(1).max(7000),
      negativePrompt: z.string().max(7000).optional(),
    }),
  )
  .max(32)
  .optional();

export const gameRouteGenerateAssetsSchema = z.object({
  chatId: z.string().min(1),
  /** Background tag that didn't resolve (the scene model suggested it). */
  backgroundTag: z.string().max(500).optional(),
  /** Optional prompt text for the background when the tag is only a cache/asset key. */
  backgroundDescription: z.string().min(1).max(5000).optional(),
  /** Force user-requested background generation instead of reusing an existing slug. */
  forceBackground: z.boolean().optional(),
  /** NPCs needing portraits: [{ name, description }] */
  npcsNeedingAvatars: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(5000),
        gender: z.string().max(80).nullable().optional(),
        pronouns: z.string().max(80).nullable().optional(),
      }),
    )
    .max(10)
    .optional(),
  forceNpcAvatarNames: z.array(z.string().min(1).max(200)).max(10).optional(),
  illustration: z
    .object({
      segment: z.number().int().min(0).max(500).optional(),
      prompt: z.string().min(40).max(5000),
      title: z.string().max(160).optional(),
      characters: z.array(z.string().min(1).max(200)).max(6).optional(),
      reason: z.string().max(300).optional(),
      slug: z.string().max(80).optional(),
    })
    .optional(),
  /** Full completed turn narration/dialogue used to summarize the image prompt before illustration generation. */
  illustrationNarration: z.string().max(50000).optional(),
  imageSizes: gameRouteImageSizesSchema,
  promptOverrides: gameRouteImagePromptOverrideSchema,
  useAvatarReferences: z.boolean().optional(),
  includeCharacterAppearance: z.boolean().optional(),
  forceIllustration: z.boolean().optional(),
  queueImageGenerationRequests: z.boolean().default(true),
  debugMode: z.boolean().optional().default(false),
});

export const gameRouteGenerateSceneVideoSchema = z.object({
  chatId: z.string().min(1),
  illustrationTag: z.string().max(500).optional(),
  galleryImageId: z.string().max(200).optional(),
  durationSeconds: z.number().int().min(1).max(60).optional(),
  aspectRatio: z.enum(["16:9", "9:16"]).optional(),
  promptOverride: z.string().trim().min(1).max(20_000).optional(),
  previewOnly: z.boolean().optional().default(false),
  queueMediaGenerationRequests: z.boolean().optional().default(true),
  debugMode: z.boolean().optional().default(false),
});

export const gameRouteListStoryboardsQuerySchema = z.object({
  messageId: z.string().min(1).optional(),
  swipeIndex: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(250),
});

export const gameRouteGenerateStoryboardSchema = z.object({
  chatId: z.string().min(1),
  messageId: z.string().min(1),
  swipeIndex: z.number().int().min(0).optional().default(0),
  sections: z
    .array(
      z.object({
        index: z.number().int().min(0).max(1000),
        kind: z.enum(["narration", "dialogue", "readable", "system", "user", "assistant"]),
        speaker: z.string().max(200).optional().nullable(),
        content: z.string().min(1).max(6000),
      }),
    )
    .max(GAME_STORYBOARD_KEYFRAME_COUNT_MAX)
    .optional(),
  keyframeCount: z
    .number()
    .int()
    .min(GAME_STORYBOARD_KEYFRAME_COUNT_MIN)
    .max(GAME_STORYBOARD_KEYFRAME_COUNT_MAX)
    .optional(),
  durationSeconds: z
    .number()
    .int()
    .min(GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN)
    .max(GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX)
    .optional(),
  aspectRatio: z.enum(["16:9", "9:16"]).optional().default("16:9"),
  generateVideos: z.boolean().optional(),
  automatic: z.boolean().optional().default(false),
  previewOnly: z.boolean().optional().default(false),
  plannedStoryboard: z.unknown().optional(),
  promptOverrides: gameRouteImagePromptOverrideSchema,
  debugMode: z.boolean().optional().default(false),
});

// Create a checkpoint (manual or auto-triggered).
export const gameRouteCheckpointCreateSchema = z.object({
  chatId: z.string().min(1),
  label: z.string().min(1).max(200),
  triggerType: z.enum([
    "manual",
    "session_start",
    "session_end",
    "combat_start",
    "combat_end",
    "location_change",
    "auto_interval",
    "state_editor_save",
  ]),
});

// Restore game state from a checkpoint.
// Creates a system message marking the restore point and copies the
// checkpoint's snapshot data as the new "latest" game state.
export const gameRouteCheckpointLoadSchema = z.object({
  chatId: z.string().min(1),
  checkpointId: z.string().min(1),
});
