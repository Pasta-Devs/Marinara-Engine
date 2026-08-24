// ──────────────────────────────────────────────
// Game Mode Types
// ──────────────────────────────────────────────
import type { GenerationParameters } from "./prompt.js";
import type { CombatItemEffect, CombatMechanic, CombatDialogueCue } from "./combat-encounter.js";
import type { SpotifySourceType } from "./spotify.js";
import type { SpatialMapDraftSize, SpatialMapGroundingMode } from "./spatial-context.js";

/** The four main states a game can be in during a session. */
export type GameActiveState = "exploration" | "dialogue" | "combat" | "travel_rest";

/** How the Game Master is controlled. */
export type GameGmMode = "standalone" | "character";

/**
 * Combat presentation preference for Game Mode.
 * - `classic`: existing cinematic JRPG menu combat (GameCombatUI + combat.service).
 * - `tactical`: Fire Emblem / FFT style grid battle (tactical-combat feature engine).
 */
export type GameCombatStyle = "classic" | "tactical";

/** Status of a game session. */
export type GameSessionStatus = "setup" | "active" | "concluded";

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
}

// ── NPCs ──

/** A tracked NPC in the game world. */
export interface GameNpc {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Origin of the description. "model", "library", and "user" descriptions are canonical profile text. */
  descriptionSource?: "model" | "library" | "narration" | "user";
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
  /** Combat presentation preference (classic menu battles vs tactical grid battles). Defaults to "classic". */
  combatStyle?: GameCombatStyle;
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
}

// ── Combat ──

/** A combatant (player or enemy) in the battle system. */
export interface Combatant {
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
}

export interface CombatStatusEffect {
  name: string;
  modifier: number;
  stat: "attack" | "defense" | "speed" | "hp";
  turnsLeft: number;
}

export interface CombatSkill {
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
 * dropping back into prose narration. Internal GameCombatUI state (round
 * number, action queue, animation phase) is intentionally NOT persisted —
 * those resume from the start of the round on restore.
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
    statusEffects: string[];
  }>;
  enemies: Array<{
    name: string;
    defeated: boolean;
    hp: number;
    maxHp: number;
  }>;
  loot?: Array<{ name: string; quantity?: number }>;
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
  | "progress_bar"
  | "gauge"
  | "relationship_meter"
  | "counter"
  | "stat_block"
  | "list"
  | "inventory_grid"
  | "timer";

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
  | "auto_interval";

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
  | "planning"
  | "rendering_images"
  | "rendering_videos"
  | "complete"
  | "partial"
  | "failed";

export type GameStoryboardKeyframeStatus =
  | "planned"
  | "rendering_image"
  | "image_complete"
  | "rendering_video"
  | "complete"
  | "failed";

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
