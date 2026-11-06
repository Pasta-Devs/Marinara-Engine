import type { CombatAttackTraits } from "../features/combat-conditions.js";
import type { CombatAiHints, CombatController, CombatOrders, CombatTactics } from "../features/combat-ai.js";
// ──────────────────────────────────────────────
// Game Mode Types
// ──────────────────────────────────────────────
import type { GenerationParameters } from "./prompt.js";
import type {
  CombatItemEffect,
  CombatMechanic,
  CombatDialogueCue,
  CombatStyleNotes,
  RulesetEncounterBlueprint,
} from "./combat-encounter.js";
import type { SpotifySourceType } from "./spotify.js";
import type { SpatialMapDraftSize, SpatialMapGroundingMode } from "./spatial-context.js";
import type {
  TacticalBattlefieldBrief,
  TacticalBattlefieldSetup,
  TacticalMovementMode,
} from "../features/tactical-combat/types.js";

/** The four main states a game can be in during a session. */
export type GameActiveState = "exploration" | "dialogue" | "combat" | "travel_rest";

/** How the Game Master is controlled. */
export type GameGmMode = "standalone" | "character";

/**
 * The combat styles the engine ships with.
 * - `classic`: existing cinematic JRPG menu combat (GameCombatUI + combat.service).
 * - `tactical`: Fire Emblem / FFT style grid battle (tactical-combat feature engine).
 */
export const BUILT_IN_GAME_COMBAT_STYLES = ["classic", "tactical"] as const;
export type BuiltInGameCombatStyle = (typeof BUILT_IN_GAME_COMBAT_STYLES)[number];

/**
 * Combat presentation preference for Game Mode: a built-in style, or the id of a style a client
 * registered itself (the client's combat-style registry). An id the client does not know plays as
 * `classic`.
 */
export type GameCombatStyle = BuiltInGameCombatStyle | (string & {});

/** The shape of a combat style id, built-in or registered: what a game's setup and a ruleset's
 *  `combat.styles` (Capability API 1.379) may name. */
export const GAME_COMBAT_STYLE_ID_PATTERN = /^[a-z][a-z0-9_-]{0,47}$/;

/** Status of a game session. */
export type GameSessionStatus = "setup" | "active" | "concluded";

/**
 * Which Game Mode a game is played in, chosen when it is created and fixed for its lifetime.
 * - `classic`: the story-led Game Mode as it always was: narration, the scene map, menu or grid
 *   battles. No setting kit, no generated world, no overworld, towns or dungeon maps.
 * - `overworld`: the Overworld RPG: a setting kit and a generated world walked on an overworld, with
 *   its towns, sites and dungeon maps.
 */
export type GameStyle = "classic" | "overworld";

/** A game's style. A game made before the choice existed has none stored: it is Overworld when it
 *  has a world and Classic when it has none, so every older game plays exactly as it did. */
export function gameStyleFromMetadata(metadata: Record<string, unknown> | null | undefined): GameStyle {
  const stored = metadata?.gameStyle;
  if (stored === "classic" || stored === "overworld") return stored;
  return metadata?.gameWorld != null ? "overworld" : "classic";
}

/** Which system owns the campaign-scale map when a new game begins. */
export type GameWorldMapMode = "standard" | "hierarchical";

export const GAME_SPATIAL_MAP_DRAFT_PRESET_TARGETS: Readonly<Record<SpatialMapDraftSize, number>> = {
  small: 8,
  medium: 16,
  large: 28,
};

/** Keep the exact target authoritative while preserving the matching draft-size bucket. */
export function resolveGameSpatialMapDraftOptions(
  size: SpatialMapDraftSize | undefined,
  targetLocationCount: number | undefined,
): { size: SpatialMapDraftSize; targetLocationCount: number } {
  const target = targetLocationCount ?? GAME_SPATIAL_MAP_DRAFT_PRESET_TARGETS[size ?? "medium"];
  return {
    size: target <= 8 ? "small" : target <= 16 ? "medium" : "large",
    targetLocationCount: target,
  };
}

/** Spotify source constraints for Game Mode DJ selection. */
export type GameSpotifySourceType = SpotifySourceType;

// ── Maps ──

/** A cell in the overworld grid map. */
export interface GridCell {
  x: number;
  y: number;
  emoji: string;
  label: string;
  discovered: boolean;
  terrain: string;
  /** Optional longer description shown on hover/click */
  description?: string;
  /** Explicit hierarchical-location binding. Unbound cells remain tactical positions. */
  spatialLocationId?: string;
}

/** A node in a dungeon/interior node-graph map. */
export interface MapNode {
  id: string;
  emoji: string;
  label: string;
  /** Visual position (percentage 0–100) */
  x: number;
  /** Visual position (percentage 0–100) */
  y: number;
  discovered: boolean;
  description?: string;
  /** Explicit hierarchical-location binding. Unbound nodes remain tactical positions. */
  spatialLocationId?: string;
}

/** An edge connecting two nodes in a node-graph map. */
export interface MapEdge {
  from: string;
  to: string;
  label?: string;
}

/** A map of the current area — either a grid (overworld/city) or a node graph (dungeon/interior). */
export interface GameMap {
  /** Stable ID used when a game stores more than one map. Older saves may omit it. */
  id?: string;
  type: "grid" | "node";
  name: string;
  description: string;
  /** Hierarchical location represented by this local or tactical map. */
  spatialLocationId?: string;
  /** Grid dimensions (only for type: "grid") */
  width?: number;
  height?: number;
  cells?: GridCell[];
  /** Node graph data (only for type: "node") */
  nodes?: MapNode[];
  edges?: MapEdge[];
  /** Current party position — {x, y} for grids, node ID for node graphs */
  partyPosition: { x: number; y: number } | string;
}

// ── Party Arcs ──

/** A personal side-quest / character arc for a party member. */
export interface PartyArc {
  /** Party member's name (matches character card name) */
  name: string;
  /** Short description of their personal quest / arc */
  arc: string;
  /** Their personal goal that drives this arc */
  goal: string;
  /** Whether the arc has been completed */
  completed?: boolean;
  /** Optional short note describing how it resolved or what changed */
  resolution?: string;
}

// ── Character Cards (tabletop-style) ──

/** A character card generated at game setup with game-specific info + stats. */
export interface GameCharacterCard {
  name: string;
  shortDescription: string;
  class: string;
  abilities: string[];
  strengths: string[];
  weaknesses: string[];
  extra: Record<string, string>;
  /** RPG stats pulled from the character/persona card (if enabled) */
  rpgStats?: {
    attributes: Array<{ name: string; value: number }>;
    hp: { value: number; max: number };
    pools?: import("./character.js").RPGStatPool[];
  };
  /** This game's copy of the character's sheet for the pinned ruleset (`chat.metadata.gameRuleset`).
   *  Edited in the game, never written back to the library card or persona. */
  rulesetSheet?: import("../schemas/ruleset.schema.js").RulesetSheetEnvelope;
}

// ── NPCs ──

/** A tracked NPC in the game world. */
export interface GameNpc {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Origin of the description. "model", "library", "user" and "world" descriptions are canonical profile
   *  text; "world" is a person the game's world drew (worldgen W2), described by their sheet. */
  descriptionSource?: "model" | "library" | "narration" | "user" | "world";
  /** Optional presentation hint used for systems like NPC voice matching. */
  gender?: string | null;
  /** Optional pronoun hint used for systems like NPC voice matching. */
  pronouns?: string | null;
  location: string;
  /** Party reputation with this NPC: -100 (hostile) to 100 (devoted) */
  reputation: number;
  /** Notable interactions or knowledge */
  notes: string[];
  /** Optional avatar URL (generated or uploaded) */
  avatarUrl?: string | null;
  /** The world's id for this person, when the game's world drew them (worldgen W2). */
  worldId?: string;
  /** What they do, for a person the world drew. */
  role?: string;
}

// ── Sessions ──

/** Summary of a completed game session, carried forward to future sessions. */
export interface SessionSummary {
  sessionNumber: number;
  /** Narrative recap of what happened */
  summary: string;
  /** Exact in-world situation where the next session should resume */
  resumePoint: string;
  /** How party member relationships evolved */
  partyDynamics: string;
  /** Current state of the party after the session */
  partyState: string;
  /** Important plot points, twists, quests, and lore discovered */
  keyDiscoveries: string[];
  /** Important character moments (dates, bonding, betrayals, confessions, etc.) */
  characterMoments: string[];
  /** Small personal details, preferences, habits, and past fragments to recall later */
  littleDetails: string[];
  /** Serialized stats/inventory/quest snapshot */
  statsSnapshot: Record<string, unknown>;
  /** NPC reputation changes */
  npcUpdates: string[];
  /** Optional player steering note for the next session. */
  nextSessionRequest?: string | null;
  timestamp: string;
}

// ── Setup ──

/** User preferences for creating a new game. */
export interface GameSetupConfig {
  genre: string;
  setting: string;
  tone: string;
  difficulty: string;
  playerGoals: string;
  gmMode: GameGmMode;
  /** Content rating: sfw or nsfw */
  rating: "sfw" | "nsfw";
  /** Classic Game Mode or the Overworld RPG (see `GameStyle`), stored as `chat.metadata.gameStyle`.
   *  Absent in setups made before the choice: read as Overworld with a world, Classic without. */
  gameStyle?: GameStyle;
  /** The Game Master's intro message (Capability API 1.339), stored as `chat.metadata.gameIntro`: defined
   *  (the first message, exactly) or guided, or `{ mode: "none" }`. Absent is the Experience's own. An
   *  Experience's locked intro wins over it. */
  gameIntro?: import("../features/world/game-intro.js").GameIntroChoice;
  /** Combat presentation preference (classic menu battles vs tactical grid battles). Defaults to "classic". */
  combatStyle?: GameCombatStyle;
  /** Versioned server-owned combat with interruption windows; absent preserves legacy battles. */
  combatDirector?: boolean;
  gmBossControl?: boolean;
  /** With `gmBossControl`, the Game Master also plays every named opponent and every one with a
   *  genius's mind (combat AI P9). Absent is bosses only, as every game before it. */
  gmNamedControl?: boolean;
  /** A cruel opponent (a `cruel` temperament, combat AI T3) may strike those already down. Absent is
   *  never: off unless the game asks for it. */
  cruelOpponents?: boolean;
  /** The player plays every companion in a fight themselves. Absent, each companion fights on its
   *  own (the Engine plays it) until the player takes it (Alyssa 2026-10-26). */
  playerRunsCompanions?: boolean;
  /** Optional tactical battlefield preferences used for newly-created encounters. */
  tacticalBattlefield?: TacticalBattlefieldSetup;
  /** Who acts when in a new tactical fight (combat C6c): one unit at a time in a rolled order, or the
   *  party's phase then the enemies'. Absent means by side, as every game before it was. */
  tacticalTurnOrder?: "side" | "initiative";
  /** Optional user prompt used to create the initial hierarchical world map draft. */
  spatialMapInstructions?: string;
  /** Campaign-scale map authority selected during New Game. Older saves default to "standard". */
  gameWorldMapMode?: GameWorldMapMode;
  /** Size bucket selected for the initial World Maps AI draft. */
  spatialMapDraftSize?: SpatialMapDraftSize;
  /** Exact number of places requested for the initial World Maps AI draft. */
  spatialMapTargetLocationCount?: number;
  /** Sources the initial World Maps AI draft may use. */
  spatialMapGroundingMode?: SpatialMapGroundingMode;
  /** Character ID to use as GM (only when gmMode is "character") */
  gmCharacterId?: string | null;
  /** Party member IDs; library character IDs or `npc:<slug>` tracked-NPC IDs. */
  partyCharacterIds: string[];
  /** User's persona ID */
  personaId?: string | null;
  /** Connection to use for the scene wrap-up turn (backgrounds, music, widgets, etc.).
   *  When omitted, falls back to sidecar (if available) or skips the wrap-up. */
  sceneConnectionId?: string;
  /** Id of the installed package providing this game's EXPERIENCE — a self-contained game mode drawing its
   *  own surface over the shared narration. Chosen at creation and fixed for the game's lifetime, since an
   *  experience owns the whole run. Omitted = the built-in Game mode, unchanged. */
  gameExperienceId?: string;
  /** The Game Mode ruleset chosen for a NEW game. The server pins it as `chat.metadata.gameRuleset`
   *  from its own registry, so only `id` is trusted. Absent means Marinara's own rules. */
  ruleset?: import("../schemas/ruleset.schema.js").RulesetRef;
  /** The setting kit chosen or written for a NEW game (worldgen W0): the world's own words and the
   *  kinds of change it allows. The server stores it as `chat.metadata.gameWorldKit`. Absent means
   *  no kit: the Game Master works from genre, setting and tone alone, as before. */
  worldKit?: import("../schemas/world-kit.schema.js").WorldKit;
  /** The generated world for a NEW game (worldgen W1): its seed, generator version, grounding and
   *  brief, stored as `chat.metadata.gameWorld`. Needs `worldKit`; absent means no world. */
  world?: import("../features/world/game-world.js").GameWorldInput;
  /** A world another generator made, as it was made (W11): sent to create a game from it and in a setup
   *  file, never kept in a game's metadata. */
  worldSnapshot?: import("../features/world/snapshot.js").WorldSnapshot;
  /** The world's story script (worldgen W10), checked against the world and stored as
   *  `chat.metadata.gameStory`. Needs `world`. */
  story?: import("../features/world/story.js").StoryScript;
  /** Whatever the experience's own setup collected, stored verbatim and never interpreted by the host, so
   *  it can always recover the options the game was created with. */
  experienceConfig?: Record<string, unknown>;
  /** Enable installed agents and agent-driven Game Mode features for this game. */
  enableAgents?: boolean;
  /** Let the GM offer timed reaction prompts. Defaults to true. */
  enableQuickTimeEvents?: boolean;
  /** Enable automatic sprite generation for characters using image model */
  enableSpriteGeneration?: boolean;
  /** Ask the configured prompt model to rewrite Game Illustrator prompts before image generation. */
  gameImageDynamicPromptEnabled?: boolean;
  /** Connection ID for image generation (NPC portraits + location backgrounds) */
  imageConnectionId?: string;
  /** Connection ID for video generation (animated scene clips from generated illustrations). */
  videoConnectionId?: string;
  /** Connection ID for audio generation (speech, game sound effects, and music). */
  audioConnectionId?: string;
  /** Generate scene sound effects for this game (requires a capable audio connection). Defaults to true. */
  enableGameSoundEffects?: boolean;
  /** Generate scene music for this game (requires a capable audio connection). Defaults to true. */
  enableGameMusic?: boolean;
  /** Automatically create storyboard keyframe illustrations after completed GM turns. */
  gameStoryboardAutoIllustrationsEnabled?: boolean;
  /** Automatically create storyboard keyframe videos after completed GM turns. */
  gameStoryboardAutoGenerationEnabled?: boolean;
  /** Master switch for Game Mode storyboard controls and automatic generation. */
  gameStoryboardsEnabled?: boolean;
  /** Target number of storyboard keyframes to create per completed GM turn. */
  gameStoryboardKeyframeCount?: number;
  /** Selected built-in or chat-local GM prompt template. */
  gameGmPromptTemplateId?: string | null;
  /** Selected animation-ready storyboard director template. */
  gameStoryboardAnimationPromptTemplateId?: string | null;
  /** Selected provider-facing image prompt template for storyboard keyframes. */
  gameStoryboardImagePromptTemplateId?: string | null;
  /** Selected prompt template used only for storyboard keyframe videos. */
  gameStoryboardVideoPromptTemplateId?: string | null;
  /** Unified art style prompt applied to all generated images (auto-generated at setup, user-editable). */
  artStylePrompt?: string;
  /** Original setup-generated art style, retained so user edits can be restored. */
  generatedArtStylePrompt?: string;
  /** Whether the campaign art style is included in generated image prompts. Defaults to true. */
  useCampaignArtStyle?: boolean;
  /** Optional image style profile applied to generated images in this game. */
  imageStyleProfileId?: string | null;
  /** Lorebook IDs to activate for this game */
  activeLorebookIds?: string[];
  /** Entries explicitly selected for world generation, additive to ordinary lore. */
  activeLorebookEntryIds?: string[];
  /** Enable custom HUD widgets (model designs them at game start and updates during play) */
  enableCustomWidgets?: boolean;
  /** User-defined starting HUD widgets. When present, these replace model-designed setup widgets. */
  customHudWidgets?: HudWidget[];
  /** Enable Music DJ for this game and use Spotify music instead of local game music assets. */
  enableSpotifyDj?: boolean;
  /** Music source constraint for Music DJ. */
  spotifySourceType?: GameSpotifySourceType;
  /** Spotify playlist ID used when spotifySourceType is "playlist". */
  spotifyPlaylistId?: string | null;
  /** Human-readable playlist name cached for prompts/display. */
  spotifyPlaylistName?: string | null;
  /** Spotify artist name used when spotifySourceType is "artist". */
  spotifyArtist?: string | null;
  /** Enable Lorebook Keeper for this game. */
  enableLorebookKeeper?: boolean;
  /** Language for all narration and dialogue (e.g. "English", "Japanese", "Spanish") */
  language?: string;
  /** Translate displayed narration from the first completed game turn. */
  autoTranslate?: boolean;
  translationOutputTargetLang?: string;
  /** Optional generation parameter overrides applied from the moment the game is created. */
  generationParameters?: Partial<GenerationParameters>;
  /** Prompt preset whose Game prompt should drive the GM instruction block. */
  promptPresetId?: string | null;
  /** Game-mode GM instruction override. Empty/null uses the built-in default prompt. */
  gameSystemPrompt?: string | null;
  /** Additional game-mode generation instructions appended to the GM format reminder. */
  gameSpecialInstructions?: string | null;
}

/** Resolve the setup-time Illustrator prompt choice into the root chat-metadata value used at runtime. */
export function resolveGameImageDynamicPromptEnabled(
  config: Readonly<Pick<GameSetupConfig, "enableSpriteGeneration" | "gameImageDynamicPromptEnabled">>,
): boolean {
  return config.enableSpriteGeneration === true && config.gameImageDynamicPromptEnabled === true;
}

/** Retain the new prompt choice when an older/imported setup omits it; other undefined fields still clear as before. */
export function mergeGameSetupConfigPreservingDynamicPrompt(
  stored: Readonly<Partial<GameSetupConfig>>,
  submitted: Readonly<Partial<GameSetupConfig>>,
): Partial<GameSetupConfig> {
  const merged = { ...stored, ...submitted };
  if (submitted.gameImageDynamicPromptEnabled === undefined) {
    merged.gameImageDynamicPromptEnabled = stored.gameImageDynamicPromptEnabled;
  }
  return merged;
}

/** Safe, immutable connection details retained for sharing a game's original setup. */
export interface GameInitialSetupConnectionSnapshot {
  name: string;
  provider?: string | null;
  model?: string | null;
  service?: string | null;
}

/** Creation-time display names for local resources referenced by the setup. */
export interface GameInitialSetupLabels {
  experienceName?: string;
  /** Display name of the chosen ruleset, so a shared setup can name one the recipient lacks. */
  rulesetName?: string;
  experienceSeedKey?: string;
  characterNames?: Record<string, string>;
  lorebookNames?: Record<string, string>;
  promptPresetNames?: Record<string, string>;
  personaName?: string | null;
}

/** Immutable copy of the choices and effective parameters used when a game was first created. */
export interface GameInitialSetupSnapshot {
  config: GameSetupConfig;
  /** Effective values after connection defaults and setup overrides were merged. */
  effectiveGenerationParameters?: Partial<GenerationParameters> | null;
  /** Free-text preferences are sent separately during setup, so retain them beside the config. */
  preferences?: string | null;
  /** Safe display details only. API keys, URLs, and local connection IDs are never retained here. */
  connections?: {
    gm?: GameInitialSetupConnectionSnapshot | null;
    scene?: GameInitialSetupConnectionSnapshot | null;
    image?: GameInitialSetupConnectionSnapshot | null;
    video?: GameInitialSetupConnectionSnapshot | null;
    audio?: GameInitialSetupConnectionSnapshot | null;
  };
  labels?: GameInitialSetupLabels;
  createdAt: string;
}

// ── Dice ──

/** Result of a dice roll. */
export interface DiceRollResult {
  /** The notation used, e.g. "2d6+3" */
  notation: string;
  /** Individual die results */
  rolls: number[];
  /** Modifier applied */
  modifier: number;
  /** Final total */
  total: number;
  /** The places in `rolls` of the dice that counted, when the roll kept some (`4d6kh3`). Absent,
   *  every die counted. */
  kept?: number[];
  /** Optional difficulty class declared before the roll. */
  dc?: number;
  /** The server's verdict against `dc`. Absent when the roll had no DC. */
  success?: boolean;
  /** Who rolled, or who and why, as the roll was asked for: a `[dice:]` tag's `who=`, or a tool
   *  roll's reason. Absent on rolls that named nobody. */
  label?: string;
  /** A roll of a symbol-pool ruleset's dice by name (`2 ability 1 difficulty`). All four are present
   *  together: each die's label and the symbols on its face, beside the 1-based faces in `rolls`, and
   *  the net symbols after cancellation with their labels. `total` is then the net success symbol. */
  thrown?: string[];
  symbolFaces?: string[][];
  symbols?: Record<string, number>;
  symbolLabels?: Record<string, string>;
}

/** Result of a skill check resolution. */
export interface SkillCheckResult {
  skill: string;
  dc: number;
  rolls: number[];
  usedRoll: number;
  modifier: number;
  total: number;
  success: boolean;
  criticalSuccess: boolean;
  criticalFailure: boolean;
  rollMode: "advantage" | "disadvantage" | "normal";
  /** How the reported total was calculated from the dice. */
  resolution: "sum" | "successes";
  /**
   * Dice notation actually rolled (e.g. "1d20", "6d10"). Absent on results from
   * before this field existed, and on the built-in resolver's own output where
   * it is always "1d20" — readers should default to that. Non-d20 values only
   * arrive from a GM-declared [skill_check: dice="..."] tag, which is how
   * non-d20 systems (pool systems like V20) reach the dice card intact.
   */
  dice?: string;
  /**
   * The party member the check was rolled for, in a game with a pinned ruleset. Absent means the
   * player, and always absent under the Engine's own rules, which only ever check the player.
   */
  who?: string;
  /**
   * Per-die target a success pool counted with, so a card can mark the dice that counted. Set by
   * both pool paths: the legacy `resolution="successes"` tag, which knows the threshold it was
   * given, and a `dice-pool` ruleset, which knows the one its rules chose. Absent on every summed
   * check, where there is no such thing.
   */
  threshold?: number;
  /**
   * What a ruleset check actually applied of the tag's `with=` and `bonus=`: the ability's label
   * when the skill was rolled with another ability than its own, and the situational dice after the
   * ruleset's clamp. Absent when nothing was applied, so a record never claims an ask that the roll
   * ignored. Only a ruleset game sets them.
   */
  withAbility?: string;
  /** What the check was made for (1.752), as its tag's `for=` said. */
  purpose?: string;
  bonusDice?: number;
  /**
   * What the roller's wound track took off this check, when the ruleset names one with
   * `resolution.penaltyFrom` and the character is marked. Always negative, and absent when there
   * was no penalty, so a record never claims a wound nobody has. A summed check has it folded into
   * `modifier` as well, because it IS a modifier there; a pool check spent it on dice instead, so
   * this is the only place the pool's missing dice are said.
   */
  penalty?: number;
  /**
   * What this check actually paid out of a pool, when the Game Master wrote `spend=` and the
   * ruleset offers such a purchase. Absent when nothing was bought, and never what the tag asked
   * for: a spend the pool could not cover buys nothing and costs nothing, so a record only ever
   * says what really left the sheet.
   */
  spent?: { pool: string; amount: number };
  /**
   * Successes a purchase added that nobody rolled. They are inside `total` already; this is what
   * lets a card show which part of the result came out of the dice. Only a ruleset game sets it.
   */
  autoSuccesses?: number;
  /**
   * The catalog entry this check actually applied, by the label the ruleset gives it. Absent when
   * the Game Master named none, when the character does not have it, or when the pool could not
   * cover it, so a record never claims a charm that did nothing.
   */
  used?: string;
  /** How many dice a bought re-throw replaced. Absent when none were. */
  rerolled?: number;
  /**
   * The faces a pool check exploded and doubled from, set only when the check moved them off the
   * ruleset's own default (a Game Master's `explode=` or `double=`, or an entry that grants it).
   */
  explodeFrom?: number;
  doubleFrom?: number;
  /**
   * The roll did not botch outright, but something went wrong on the side of it: a pool ruleset whose
   * `botch.rule` is `halfOrMore` saw low faces on half its dice or more while a die still succeeded.
   * `success` is still the outcome; this is what happens beside it. Absent everywhere else.
   */
  complication?: boolean;
  /**
   * What the sheet itself added to or took off the check through `resolution.adjust`, beside any
   * wound penalty: dice on a pool, a flat number on a sum (where it is inside `modifier` too). Absent
   * when nothing applied.
   */
  adjust?: number;
  /** The standing re-throw the Game Master named with `reroll=` and the check applied, by its id. */
  reroll?: string;
  /**
   * What the character's conditions and worn or carried items added to or took off the check, their
   * dice rolled: dice on a pool, a flat number on a sum (where it is inside `modifier` too). Absent
   * when nothing did.
   */
  effects?: number;
  /**
   * The conditions and items that changed this check, by name: its number, how it was thrown, or that
   * it failed without a roll. Only a ruleset game sets it, and only what changed something.
   */
  from?: string[];
  /** The save failed without a roll, because something named in `from` makes it fail. */
  automatic?: boolean;
  /**
   * The label of the outcome band the check landed in, where the ruleset declares bands (Capability
   * API 1.135): "Barely", "Hard success", "Success with style". `success` and the criticals are the
   * band's own. Absent on a ruleset without bands.
   */
  outcome?: string;
  /**
   * What each face of the die is worth, lowest face first, where the ruleset's dice are not their own
   * numbers (1.136): Fate's `[-1, 0, 1]`. `rolls` are still the faces thrown, 1 to the die's sides.
   */
  faces?: number[];
  /** The face a single die showed, where the ruleset marks it as rolled unmodified (1.136). */
  unmodified?: number;
  /** Which way a pool's dice counted against `threshold`, where a stance made them count below or
   *  above it rather than at or above it (1.137). */
  compare?: "below" | "above";
  /** How many dice showed exactly the target, and what the ruleset calls that, where it names the
   *  face (1.137): Lasers & Feelings' LASER FEELINGS. */
  exact?: number;
  exactLabel?: string;
  /** How many of the highest dice were kept, on a keep-the-highest check (1.138). The total is
   *  theirs; `zeroDice` says the character had no dice and the lower of two was kept. */
  highest?: number;
  zeroDice?: boolean;
  /** How many of `rolls`, at the end, were dark dice, what the ruleset calls them, and whether one
   *  strictly beat every light die (1.138): Trophy Dark's Ruin. */
  dark?: number;
  darkLabel?: string;
  darkHighest?: boolean;
  /** Only light dice decided the outcome (1.149); absent means all dice. */
  darkOutcome?: "light";
  /** A roll read against the sheet's number (1.139): `at-most` succeeds at or under `dc`, which is
   *  then the target; `at-least` at or over it. `tens` is the bonus (+) or penalty (-) tens dice
   *  thrown, each candidate d100 one of `rolls`. */
  against?: "at-most" | "at-least";
  tens?: number;
  /** Independent setback dice and own upgrades actually applied (1.150). */
  setback?: number;
  upgradeOwn?: number;
  /** Narrative dice (1.141): net symbols, die ids beside their 1-based rolls, and the face symbols
   *  with the ruleset's labels, so a saved check needs no installed ruleset to display. */
  symbols?: Record<string, number>;
  thrown?: string[];
  symbolLabels?: Record<string, string>;
  symbolFaces?: string[][];
}

// ── The sighted dice pool (opt-in, last) ──

/** The seven sizes the engine pre-throws. Anything else is an overflow, not a pool miss. */
export type GameDicePoolSize = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

/**
 * One chat's dice pool as it stood for one turn.
 *
 * Stored per (chat, message, swipe) in `game_dice_pools` rather than in the game-state
 * snapshot or in chat metadata, for reasons that are load-bearing: the snapshot is only
 * written when a tracker agent runs, so with agents off no row exists at all; its writer
 * is a delete-then-insert from an explicit field list, so any column a caller does not
 * name is silently lost; and metadata is client-writable and not per-swipe, so a swipe
 * would spend dice and never give them back.
 */
export interface GameDicePool {
  /** On-disk revision. A row of another revision is refused, never half-read. */
  v: 1;
  /** Accepted turns this pool has lived through. Advisory; the aging clock is per size. */
  turn: number;
  /** Each size's queue, head first. Consumption is from the head, refill at the tail. */
  values: Record<GameDicePoolSize, number[]>;
  /** Accepted turns each size has gone unspent, which is what bounds the frozen head. */
  idle: Record<GameDicePoolSize, number>;
}

/** One value the engine actually spent, in the order it spent it. */
export interface GameDicePoolConsumption {
  size: GameDicePoolSize;
  /** Zero-based index into the size's queue. The slot NAME in a tag is one-based. */
  slot: number;
  /** The value spent. The engine's record, not the model's claim. */
  value: number;
  /** Which tag of the turn spent it, in reading order, so the ledger reads as a sequence. */
  tagIndex: number;
}

/**
 * What the model wrote in `pool=` or `rolls=` disagreeing with what the engine spent.
 *
 * Recorded and never obeyed. The slot name is a checksum, not an instruction: the engine
 * spends the next unconsumed value of that size in reading order whatever the tag says,
 * so a mismatch changes the log and the notice and changes no number at all.
 */
export interface GameDicePoolMismatch {
  /**
   * `slot`: a slot other than the one spent, which covers a skipped slot and a reordered
   * one alike. `value`: a number other than the one spent. `reuse`: a slot this turn had
   * already spent.
   *
   * There is deliberately no attribute-order kind. The design re-grades "declaration
   * before value" as a weak signal with no defensive worth — for a thinking model the DC
   * is chosen in reasoning tokens long before any attribute is emitted — and the engine's
   * own record writes `pool=` last, so a positional rule would flag the engine's own
   * shape on every turn. A signal that fires on the correct answer is noise.
   */
  kind: "slot" | "value" | "reuse";
  size: GameDicePoolSize;
  /** What the engine spent, zero-based. */
  slot: number;
  /** What the model claimed, verbatim and truncated, for the log line. */
  wrote?: string;
}

/** The head values the prompt shows, at the configured window. One entry per size. */
export type GameDicePoolView = Array<{ size: GameDicePoolSize; values: number[] }>;

/** A parsed `pool="d6:1|2|3"` value: the size, and its slots as zero-based indices. */
export interface GameDicePoolSlotName {
  size: GameDicePoolSize;
  slots: number[];
}

// ── Combat ──

/** A combatant (player or enemy) in the battle system. */
/** The ruleset terms (`creature`, `tier`, `proposed`) ride along for a fight the game's ruleset
 *  resolves; the numbers below stay the Engine's. */
export interface Combatant extends CombatAttackTraits, RulesetEncounterBlueprint {
  boss?: import("../features/combat-director.js").CombatBoss;
  spellSlots?: Record<string, number>;
  combatRound?: number;
  tactics?: CombatTactics;
  aiHints?: CombatAiHints;
  controller?: CombatController;
  /** Its player's standing orders, while the Engine plays it. */
  orders?: CombatOrders;
  skillCooldowns?: Record<string, number>;
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  mp?: number;
  maxMp?: number;
  attack: number;
  defense: number;
  speed: number;
  level: number;
  /** "player" or "enemy" */
  side: "player" | "enemy";
  /** Sprite/avatar URL or asset tag */
  sprite?: string;
  statusEffects?: CombatStatusEffect[];
  /** Available skills beyond basic attack */
  skills?: CombatSkill[];
  /** Element this combatant's attacks carry */
  element?: string;
  /** Current elemental aura applied to this combatant */
  elementAura?: { element: string; gauge: number; sourceId: string } | null;
  /** Tactical-combat class hint (fighter/knight/rogue/archer/mage/healer). Classic combat ignores this. */
  combatClass?: string;
  /** Tactical traversal rule. Classic combat ignores this; missing means walk. */
  movementMode?: TacticalMovementMode;
}

export interface CombatStatusEffect {
  name: string;
  modifier: number;
  stat: "attack" | "defense" | "speed" | "hp";
  turnsLeft: number;
}

export interface CombatSkill extends CombatAttackTraits {
  areaRadius?: number;
  friendlyFire?: boolean;
  targetScope?: "single" | "all-enemies";
  spell?: boolean;
  reaction?: "counterspell" | "guard";
  range?: number;
  slotLevel?: number;
  legendaryCost?: number;
  id: string;
  name: string;
  /** "attack" | "heal" | "buff" | "debuff" */
  type: "attack" | "heal" | "buff" | "debuff";
  mpCost: number;
  /** Multiplier against base stat */
  power: number;
  description?: string;
  cooldown?: number;
  element?: string;
  statusEffect?: string;
}

/** Lightweight element info for the client */
export interface ElementInfo {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

/** A single attack result in combat. */
export interface CombatAttackResult {
  /** What the log says instead of the usual line, as an item whose gate its user failed (#6909). */
  note?: string;
  attackerId: string;
  defenderId: string;
  attackRoll: number;
  defenseRoll: number;
  rawDamage: number;
  mitigated: number;
  finalDamage: number;
  isCritical: boolean;
  isMiss: boolean;
  remainingHp: number;
  isKo: boolean;
  /** True when the action restored HP instead of dealing damage. */
  isHeal?: boolean;
  /** Skill used, if any */
  skillName?: string;
  /** Element used in the attack */
  element?: string;
  /** Elemental reaction triggered */
  reaction?: {
    reaction: string;
    description: string;
    damageMultiplier: number;
    appliedEffects?: CombatStatusEffect[];
    consumedAura?: boolean;
  } | null;
}

/** Full round result from the server. */
export interface CombatRoundResult {
  round: number;
  initiative: Array<{ id: string; name: string; roll: number; speed: number; total: number }>;
  actions: CombatAttackResult[];
  statusTicks: Array<{ id: string; effect: string; expired: boolean }>;
  /** Elemental reactions that fired this round */
  reactions: Array<{ attackerId: string; defenderId: string; reaction: string; description: string }>;
}

/** Player-chosen action for their turn. */
export type CombatPlayerAction =
  | { type: "attack"; targetId: string }
  | { type: "skill"; skillId: string; targetId: string }
  | {
      type: "item";
      itemId: string;
      targetId?: string;
      itemEffect?: CombatItemEffect;
    }
  | { type: "defend" }
  | { type: "flee" };

/**
 * Snapshot of an in-progress combat encounter, persisted to chat metadata so a
 * page refresh during a fight restores the live party/enemy state instead of
 * dropping back into prose narration. Combatants carry the next Classic round,
 * profiles, controllers and cooldowns. Pending manual orders and cosmetic
 * animation are not persisted; restore presents the last accepted result.
 */
export interface GameCombatStateSnapshot {
  party: Combatant[];
  enemies: Combatant[];
  itemEffects: CombatItemEffect[];
  mechanics: CombatMechanic[];
  dialogueCues: CombatDialogueCue[];
  /** ID of the assistant message whose `[combat:]` tag opened this encounter. */
  startMessageId: string | null;
  /** Encounter tier for context-bound combat music (#5161). Optional so
   *  snapshots from older clients stay valid. */
  musicTier?: string | null;
  /** Combat UI style pinned for the active encounter so settings changes cannot remount a different engine. */
  combatStyle?: GameCombatStyle | null;
  /** Tactical scene data needed to resume exact generated/fallback battlefield setup after refresh. */
  sceneEnvironment?: string | null;
  sceneEnvironmentType?: string | null;
  formation?: string | null;
  battlefield?: TacticalBattlefieldBrief | null;
  battlefieldError?: string | null;
  styleNotes?: CombatStyleNotes | null;
}

/** Post-combat summary handed to the GM for narration. */
export interface CombatSummary {
  outcome: "victory" | "defeat" | "flee";
  rounds: number;
  party: Array<{
    name: string;
    hp: number;
    maxHp: number;
    ko: boolean;
    mp?: number;
    maxMp?: number;
    spellSlots?: Record<string, number>;
    statusEffects: string[];
  }>;
  enemies: Array<{
    name: string;
    defeated: boolean;
    hp: number;
    maxHp: number;
    /** Out of the fight alive, its heart gone: run off, or given up to the party. */
    left?: "fled" | "surrendered";
  }>;
  /** The party gave itself up to honourable opponents (combat AI T6), who take it alive. */
  yielded?: true;
  /** The fight broke off with both sides standing, after rounds in which nothing changed (K8). */
  stalled?: true;
  /** Resolved tactical terrain retained after the live combat snapshot is cleared. */
  battlefieldSummary?: string;
  /** What the win dropped into the party's bags, and how many of each nobody could carry. */
  loot?: Array<{ name: string; quantity?: number; left?: number }>;
  /** What a ruleset fight really ended on, in the ruleset's own numbers. Present only for a fight
   *  the ruleset resolved, and the recap is written from it instead of the shares above. */
  ruleset?: import("../features/ruleset-combat/types.js").RulesetEncounterSummary;
}

// ── Cinematic Direction ──

/** Visual effect types the GM can trigger via [direction: ...] commands. */
export type DirectionEffect =
  | "fade_from_black"
  | "fade_to_black"
  | "flash"
  | "screen_shake"
  | "blur"
  | "vignette"
  | "letterbox"
  | "color_grade"
  | "focus"
  | "pulse"
  | "slow_zoom"
  | "impact_zoom"
  | "tilt"
  | "desaturate"
  | "chromatic_aberration"
  | "film_grain"
  | "rain_streaks"
  | "spotlight";

/** A single cinematic direction command parsed from GM output. */
export interface DirectionCommand {
  effect: DirectionEffect;
  /** Duration in seconds. Default 1. */
  duration?: number;
  /** Intensity 0-1. Default 0.5. */
  intensity?: number;
  /** Target layer: "background" | "content" | "all". Default "all". */
  target?: "background" | "content" | "all";
  /** Arbitrary params: color for flash, preset for color_grade, etc. */
  params?: Record<string, string>;
}

// ── HUD Widgets ──

/** Available widget types the model can use for custom HUD elements. */
export type HudWidgetType =
  "progress_bar" | "gauge" | "relationship_meter" | "counter" | "stat_block" | "list" | "inventory_grid" | "timer";

/** Milestone marker on a progress/relationship bar. */
export interface WidgetMilestone {
  at: number;
  label: string;
}

/** A model-defined HUD widget. */
export interface HudWidget {
  id: string;
  type: HudWidgetType;
  label: string;
  icon?: string;
  position: "hud_left" | "hud_right";
  accent?: string;
  config: HudWidgetConfig;
}

/** Type-specific widget config. */
export interface HudWidgetConfig {
  // progress_bar / gauge / relationship_meter
  /** Initial value used when the widget is created for a new session. */
  startingValue?: number;
  /** Current value shown at runtime. */
  value?: number;
  max?: number;
  milestones?: WidgetMilestone[];
  dangerBelow?: number;

  // counter
  count?: number;

  // stat_block
  stats?: Array<{ name: string; value: number | string }>;

  // list
  items?: string[];

  // inventory_grid
  slots?: number;
  categories?: string[];
  contents?: Array<{ name: string; slot?: string; quantity?: number }>;

  // timer
  seconds?: number;
  running?: boolean;

  // GM-defined value hints for the scene model (e.g. "alpha | omega | beta" for a class stat)
  valueHints?: Record<string, string>;
}

/** A widget update command parsed from [widget: ...] tags. */
export interface WidgetUpdate {
  widgetId: string;
  /** Partial config / value changes to merge. */
  changes: Omit<Partial<HudWidgetConfig>, "value"> & {
    value?: number | string;
    add?: string;
    remove?: string;
    statName?: string;
  };
}

// ── Game Blueprint ──

/** Visual theme preferences designed by the GM during setup. */
export interface BlueprintVisualTheme {
  palette: string;
  uiStyle: string;
  moodDefault: string;
}

export interface CampaignPressureClock {
  name: string;
  steps: number;
  current: number;
  failure: string;
}

export interface CampaignFaction {
  name: string;
  goal: string;
  method?: string;
  secret?: string;
}

/** Optional compact GM-only structure for campaigns that need stronger pacing. */
export interface GameCampaignPlan {
  openingSituation?: string;
  pressureClocks?: CampaignPressureClock[];
  factions?: CampaignFaction[];
  questSeeds?: string[];
  encounterPrinciples?: string[];
}

/** The GM-designed blueprint created during game setup. */
export interface GameBlueprint {
  hudWidgets: HudWidget[];
  introSequence: DirectionCommand[];
  visualTheme: BlueprintVisualTheme;
  campaignPlan?: GameCampaignPlan;
}

// ── Party Dialogue ──

/** The type of dialogue a party member can produce. */
export type PartyDialogueType = "main" | "side" | "extra" | "action" | "thought" | "whisper";

/** A single line of party dialogue parsed from the party generation response. */
export interface PartyDialogueLine {
  /** Character name who is speaking/acting. */
  character: string;
  /** The type of dialogue delivery. */
  type: PartyDialogueType;
  /** The dialogue/action text content. */
  content: string;
  /** Target character name (only for "whisper" type). */
  target?: string;
  /** Expression/mood for the character's sprite (e.g. "smirk", "angry", "happy"). */
  expression?: string;
}

// ── Checkpoints ──

export type CheckpointTrigger =
  | "manual"
  | "session_start"
  | "session_end"
  | "combat_start"
  | "combat_end"
  | "location_change"
  | "auto_interval"
  | "state_editor_save";

export interface GameCheckpoint {
  id: string;
  chatId: string;
  snapshotId: string;
  messageId: string;
  label: string;
  triggerType: CheckpointTrigger;
  location: string | null;
  gameState: string | null;
  weather: string | null;
  timeOfDay: string | null;
  turnNumber: number | null;
  createdAt: string;
}

export type GameSceneVideoAspectRatio = "16:9" | "9:16";

export interface GeneratedSceneVideo {
  id: string;
  chatId: string;
  filePath: string;
  url: string;
  sourceIllustrationTag: string | null;
  sourceIllustrationPath: string | null;
  prompt: string;
  provider: string;
  model: string;
  durationSeconds: number;
  aspectRatio: GameSceneVideoAspectRatio;
  createdAt: string;
}

export type GameStoryboardStatus =
  "planning" | "rendering_images" | "rendering_videos" | "complete" | "partial" | "failed";

export type GameStoryboardKeyframeStatus =
  "planned" | "rendering_image" | "image_complete" | "rendering_video" | "complete" | "failed";

export type StoryboardAnimationSuitability = "suitable" | "simplify" | "subtle" | "regenerate";

export interface GameStoryboardMediaRef {
  id: string;
  url: string;
  prompt: string;
  provider: string;
  model: string;
  createdAt: string;
}

export interface GameTurnStoryboardKeyframe {
  id: string;
  storyboardId: string;
  index: number;
  title: string;
  sectionStartIndex: number | null;
  sectionEndIndex: number | null;
  anchorQuote: string;
  anchorKind: "narration" | "dialogue" | "readable" | "system" | "user" | "assistant" | "";
  narrationBeat: string;
  mangaPanelPrompt: string;
  imagePrompt: string;
  videoPrompt: string;
  animationSuitability: StoryboardAnimationSuitability | "";
  characters: string[];
  continuityNotes: string;
  cameraMotion: string;
  transitionHint: string;
  durationSeconds: number;
  aspectRatio: GameSceneVideoAspectRatio;
  chatImageId: string | null;
  sceneVideoId: string | null;
  image: GameStoryboardMediaRef | null;
  video: GeneratedSceneVideo | null;
  status: GameStoryboardKeyframeStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameTurnStoryboard {
  id: string;
  chatId: string;
  messageId: string;
  swipeIndex: number;
  snapshotId: string | null;
  sessionNumber: number | null;
  turnNumber: number | null;
  title: string;
  sourceNarration: string;
  sourceNarrationHash: string;
  status: GameStoryboardStatus;
  provider: string;
  model: string;
  directorPrompt: string;
  error: string | null;
  keyframes: GameTurnStoryboardKeyframe[];
  createdAt: string;
  updatedAt: string;
}
