// ──────────────────────────────────────────────
// Game: Setup Wizard (initial game setup modal)
// ──────────────────────────────────────────────
import { useState, useMemo, useCallback, useEffect, useRef, type ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  Wand2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Search,
  Plus,
  X,
  Sparkles,
  User,
  Plug,
  Image,
  Film,
  PanelsTopLeft,
  BookOpen,
  Music2,
  Volume2,
  VolumeX,
  Feather,
  Map as MapIcon,
  RotateCcw,
  FolderOpen,
  FileUp,
  CheckCircle2,
} from "lucide-react";
import {
  ANIME_GAME_PROMPT_TEMPLATE_ID,
  ANIME_GAME_SYSTEM_PROMPT,
  COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE_ID,
  DEFAULT_GAME_SYSTEM_PROMPT,
  STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE_ID,
  GAME_STORYBOARD_COMIC_ANIMATION_PROMPT_TEMPLATE_ID,
  GAME_STORYBOARD_KEYFRAME_COUNT_DEFAULT,
  GAME_STORYBOARD_KEYFRAME_COUNT_MAX,
  GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
  type CharacterGroup,
  type GameInitialSetupLabels,
  type GameSetupConfig,
  type GameGmMode,
  type GenerationParameters,
  type SpatialMapGroundingMode,
  type SpatialMapDraftSize,
  type GameCombatStyle,
} from "@marinara-engine/shared";
import { getCharacterTitle } from "../../lib/character-display";
import { api } from "../../lib/api-client";
import { cn, getAvatarCropStyle, parseAvatarCropJson, type AvatarCropValue } from "../../lib/utils";
import {
  GenerationParametersFields,
  getEditableGenerationParameters,
  parseEditableGenerationParameters,
  ROLEPLAY_PARAMETER_DEFAULTS,
  type EditableGenerationParameters,
} from "../ui/GenerationParametersEditor";
import {
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_SUBTITLE,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";
import {
  createDefaultGameHudWidget,
  GameWidgetFileControls,
  GameWidgetSetupEditor,
  normalizeGameHudWidgets,
} from "./GameWidgetSetupEditor";
import { useConnections } from "../../hooks/use-connections";
import { useDefaultPreset, usePresets } from "../../hooks/use-presets";
import { useCharacterGroups, usePersonas } from "../../hooks/use-characters";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { useCapabilityAgentRegistry } from "../../hooks/use-capability-packages";
import { useGameAssetStore } from "../../stores/game-asset.store";
import { useUIStore } from "../../stores/ui.store";
import { parseGameSetupShareFileJson, resolveGameSetupImport } from "../../lib/game-setup-share";

interface GameSetupWizardProps {
  onComplete: (
    config: GameSetupConfig,
    preferences: string,
    connections: { gmConnectionId?: string; shareLabels?: GameInitialSetupLabels },
    gameName?: string,
    mapDraft?: {
      size: SpatialMapDraftSize;
      groundingMode: SpatialMapGroundingMode;
      sourceLorebookIds: string[];
      instructions?: string;
    },
  ) => void;
  onCancel: () => void;
  isLoading: boolean;
  isDraftingMap: boolean;
  characters: Array<{
    id: string;
    name: string;
    comment?: string | null;
    avatarUrl?: string | null;
    avatarCrop?: AvatarCropValue | null;
  }>;
}

interface PersonaDisplayInfo {
  name: string;
  comment?: string | null;
}

interface WizardConnection {
  id: string;
  name: string;
  model?: string;
  provider?: string;
  defaultParameters?: string | null;
  isDefault?: boolean | string;
}

function CharacterAvatar({
  character,
  className = "h-6 w-6 rounded-full",
}: {
  character: {
    name: string;
    avatarUrl?: string | null;
    avatarCrop?: AvatarCropValue | null;
  };
  className?: string;
}) {
  if (!character.avatarUrl) {
    return (
      <div className={cn("flex items-center justify-center bg-[var(--accent)] text-[0.5625rem] font-bold", className)}>
        {character.name[0]}
      </div>
    );
  }
  return (
    <span className={cn("relative block shrink-0 overflow-hidden", className)}>
      <img
        src={character.avatarUrl}
        alt={character.name}
        loading="lazy"
        className="h-full w-full object-cover"
        style={getAvatarCropStyle(character.avatarCrop)}
      />
    </span>
  );
}

function getPersonaTitle(persona: PersonaDisplayInfo): string | null {
  const title = persona.comment?.trim();
  return title ? title : null;
}

const GENRES = ["Fantasy", "Sci-Fi", "Horror", "Modern", "Post-Apocalyptic", "Cyberpunk", "Steampunk", "Historical"];
const TONES = ["Heroic", "Dark", "Comedic", "Gritty", "Whimsical", "Serious", "Campy"];
const DIFFICULTIES = ["Casual", "Normal", "Hard", "Brutal"];
const LEARNED_OPTION_PREVIEW_LIMIT = 8;
const GAME_SETUP_IMPORT_MAX_BYTES = 1_000_000;

const SETTING_SUGGESTIONS = [
  "Surprise me!",
  "A war-torn kingdom with ancient ruins",
  "A neon-lit city of hackers and megacorps",
  "A cursed forest hiding a forgotten god",
];

const GOAL_SUGGESTIONS = [
  "Surprise me!",
  "Find the lost artifact",
  "Survive and uncover the truth",
  "Become the ruler of the land",
];

const PREFERENCE_SUGGESTIONS = [
  "Include romance subplot",
  "Focus on exploration",
  "Make NPCs memorable",
  "Keep it short",
];

const SPATIAL_MAP_DRAFT_SIZE_OPTIONS: Array<{
  value: SpatialMapDraftSize;
  label: string;
  detail: string;
}> = [
  { value: "small", label: "Small", detail: "About 8 places" },
  { value: "medium", label: "Medium", detail: "About 16 places" },
  { value: "large", label: "Large", detail: "About 28 places" },
];

const GAME_SETUP_FIELD_LABEL = "mb-1.5 block text-xs font-medium text-[var(--foreground)]";
const GAME_SETUP_INPUT_CLASS =
  "w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40";
const GAME_SETUP_GHOST_BUTTON_CLASS =
  "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]";
const GAME_SETUP_PRIMARY_BUTTON_CLASS =
  "flex items-center gap-1 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const GAME_SETUP_WIZARD_PANEL_CLASS = cn(
  NEUTRAL_PANEL_SHELL,
  "pointer-events-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden sm:max-h-[min(90dvh,44rem)]",
);

const GAME_SETUP_STEPS = [
  {
    key: "connection",
    title: "Connection",
    body: "Name the game and choose which AI connection should run the Game Master.",
  },
  {
    key: "world",
    title: "World",
    body: "Pick genre, tone, difficulty, rating, and the starting language.",
  },
  {
    key: "party",
    title: "Party",
    body: "Choose your player persona, Game Master style, and party members.",
  },
  {
    key: "goals",
    title: "Goals",
    body: "Tell the GM what you want from the adventure and which mood to prioritize.",
  },
  {
    key: "lorebooks",
    title: "Lorebooks",
    body: "Attach optional lorebooks to seed the world with durable context.",
  },
  {
    key: "features",
    title: "Features",
    body: "Choose installed agent features, audio behavior, and HUD options for the session.",
  },
  {
    key: "gm",
    title: "GM",
    body: "Review advanced GM instructions before starting the world.",
  },
] as const;

type GameSpotifySourceType = "liked" | "playlist" | "artist" | "any";

function parseCharacterFolderIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

const GAME_SPOTIFY_SOURCE_OPTIONS: Array<{ id: GameSpotifySourceType; label: string; description: string }> = [
  { id: "liked", label: "Liked Songs", description: "Pick from saved tracks first." },
  { id: "playlist", label: "Playlist", description: "Keep choices inside one Spotify playlist." },
  { id: "artist", label: "Artist", description: "Search only around a named artist, like HOYO-MiX." },
  { id: "any", label: "Any Spotify", description: "Let the DJ use Spotify search when it fits." },
];

function normalizeGameSpotifySourceType(value: unknown): GameSpotifySourceType {
  return value === "playlist" || value === "artist" || value === "any" ? value : "liked";
}

type LearnedOptionGroup = "genres" | "tones" | "settings" | "goals" | "preferences";

function getPreferredConnectionId(connections: WizardConnection[]): string | null {
  return (
    connections.find((connection) => connection.isDefault === true || connection.isDefault === "true")?.id ??
    connections[0]?.id ??
    null
  );
}

function optionKey(value: string) {
  return value.trim().toLowerCase();
}

function filterLearnedOptions(options: string[] | undefined, excluded: string[]) {
  const excludedKeys = new Set(excluded.map(optionKey));
  const seen = new Set<string>();
  return (options ?? []).filter((option) => {
    const trimmed = option.trim();
    const key = optionKey(trimmed);
    if (!trimmed || excludedKeys.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterCustomLearnedValues(values: string[], builtIns: string[]) {
  const excluded = new Set([...builtIns, "Surprise me, go wild!"].map(optionKey));
  return values.map((value) => value.trim()).filter((value) => value && !excluded.has(optionKey(value)));
}

function LearnedOptionChips({
  options,
  expanded,
  onToggleExpanded,
  onSelect,
  onForget,
  selected,
}: {
  options: string[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onSelect: (value: string) => void;
  onForget?: (value: string) => void;
  selected?: (value: string) => boolean;
}) {
  if (options.length === 0) return null;

  const visible = expanded ? options : options.slice(0, LEARNED_OPTION_PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, options.length - visible.length);

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {visible.map((option) => {
        const isSelected = selected?.(option) ?? false;
        return (
          <span
            key={option}
            className={cn(
              "group/learned inline-flex items-center rounded-full text-[0.625rem] transition-colors",
              isSelected
                ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/35"
                : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]",
            )}
          >
            <button type="button" onClick={() => onSelect(option)} className="px-2 py-0.5">
              {option}
            </button>
            {onForget && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onForget(option);
                }}
                aria-label={`Forget ${option}`}
                title="Forget this option"
                className="ml-0.5 mr-1 inline-flex rounded-full p-0.5 opacity-40 transition-opacity hover:bg-[var(--destructive)]/20 hover:text-[var(--destructive)] hover:opacity-100 focus-visible:opacity-100 group-hover/learned:opacity-100"
              >
                <X size={9} />
              </button>
            )}
          </span>
        );
      })}
      {(hiddenCount > 0 || expanded) && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
        >
          {expanded ? "Show less" : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}

type GameLanguageOption = {
  label: string;
  value: string;
  aliases?: string[];
};

const GAME_LANGUAGE_OPTIONS: readonly GameLanguageOption[] = [
  { label: "English", value: "English" },
  { label: "日本語", value: "Japanese" },
  { label: "한국어", value: "Korean" },
  { label: "中文", value: "Chinese" },
  { label: "Español", value: "Spanish", aliases: ["Espanol"] },
  { label: "Français", value: "French", aliases: ["Francais"] },
  { label: "Deutsch", value: "German" },
  { label: "Polski", value: "Polish" },
  { label: "Português", value: "Portuguese", aliases: ["Portugues"] },
  { label: "Русский", value: "Russian" },
];

const GAME_LANGUAGE_LOOKUP = new Map(
  GAME_LANGUAGE_OPTIONS.flatMap((option) => {
    const entries: Array<[string, string]> = [
      [option.label.toLowerCase(), option.value],
      [option.value.toLowerCase(), option.value],
    ];
    for (const alias of option.aliases ?? []) {
      entries.push([alias.toLowerCase(), option.value]);
    }
    return entries;
  }),
);

function normalizeGameLanguage(language: string): string {
  const trimmed = language.trim();
  if (!trimmed) return "";
  return GAME_LANGUAGE_LOOKUP.get(trimmed.toLowerCase()) ?? trimmed;
}

export function GameSetupWizard({
  onComplete,
  onCancel,
  isLoading,
  isDraftingMap,
  characters,
}: GameSetupWizardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);
  const [gameName, setGameName] = useState("");
  const [genres, setGenres] = useState<string[]>(["Fantasy"]);
  const [customGenre, setCustomGenre] = useState("");
  const [setting, setSetting] = useState("");
  const [tones, setTones] = useState<string[]>(["Heroic"]);
  const [customTone, setCustomTone] = useState("");
  const [difficulty, setDifficulty] = useState("Normal");
  const [combatStyle, setCombatStyle] = useState<GameCombatStyle>("classic");
  const [gmMode, setGmMode] = useState<GameGmMode>("standalone");
  const [gmCharacterId, setGmCharacterId] = useState<string | null>(null);
  const [partyCharacterIds, setPartyCharacterIds] = useState<string[]>([]);
  const [playerGoals, setPlayerGoals] = useState(
    () => useUIStore.getState().rememberedGameSetupText?.playerGoals ?? "",
  );
  const [preferences, setPreferences] = useState(
    () => useUIStore.getState().rememberedGameSetupText?.preferences ?? "",
  );
  const [gmSearch, setGmSearch] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [partyFolderId, setPartyFolderId] = useState("");
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [gmConnectionId, setGmConnectionId] = useState<string | null>(null);
  const [customizeParameters, setCustomizeParameters] = useState(false);
  const [generationParameters, setGenerationParameters] =
    useState<EditableGenerationParameters>(ROLEPLAY_PARAMETER_DEFAULTS);
  const [personaSearch, setPersonaSearch] = useState("");
  const [rating, setRating] = useState<"sfw" | "nsfw">("sfw");
  const [useLocalScene, setUseLocalScene] = useState(true);
  const [enableSpriteGeneration, setEnableSpriteGeneration] = useState(false);
  const [enableSpotifyDj, setEnableSpotifyDj] = useState(false);
  const [gameSpotifySourceType, setGameSpotifySourceType] = useState<GameSpotifySourceType>("liked");
  const [gameSpotifyPlaylistId, setGameSpotifyPlaylistId] = useState("");
  const [gameSpotifyPlaylistName, setGameSpotifyPlaylistName] = useState("");
  const [gameSpotifyArtist, setGameSpotifyArtist] = useState("");
  const [enableLorebookKeeper, setEnableLorebookKeeper] = useState(false);
  const [imageConnectionId, setImageConnectionId] = useState<string | null>(null);
  const [videoConnectionId, setVideoConnectionId] = useState<string | null>(null);
  const [enableStoryboardIllustrations, setEnableStoryboardIllustrations] = useState(true);
  const [enableStoryboardAnimations, setEnableStoryboardAnimations] = useState(false);
  const [storyboardKeyframeCount, setStoryboardKeyframeCount] = useState(
    GAME_STORYBOARD_KEYFRAME_COUNT_DEFAULT,
  );
  const [sceneConnectionId, setSceneConnectionId] = useState<string | null>(null);
  const [activeLorebookIds, setActiveLorebookIds] = useState<string[]>([]);
  const [lbSearch, setLbSearch] = useState("");
  const [enableCustomWidgets, setEnableCustomWidgets] = useState(true);
  const [manualWidgetSetupEnabled, setManualWidgetSetupEnabled] = useState(false);
  const [customHudWidgets, setCustomHudWidgets] = useState(() =>
    normalizeGameHudWidgets([createDefaultGameHudWidget("progress_bar", [])]),
  );
  const [gameSpecialInstructions, setGameSpecialInstructions] = useState("");
  const [promptPresetId, setPromptPresetId] = useState<string | null>(null);
  const [promptPresetTouched, setPromptPresetTouched] = useState(false);
  const [customGamePromptEnabled, setCustomGamePromptEnabled] = useState(false);
  const [gameSystemPromptDraft, setGameSystemPromptDraft] = useState(DEFAULT_GAME_SYSTEM_PROMPT);
  const [gameSystemPromptEdited, setGameSystemPromptEdited] = useState(false);
  const [gamePresentation, setGamePresentation] = useState<"standard" | "anime">("standard");
  const [language, setLanguage] = useState("English");
  const [startMuted, setStartMuted] = useState(false);
  const [draftSpatialMap, setDraftSpatialMap] = useState(false);
  const [spatialMapDraftSize, setSpatialMapDraftSize] = useState<SpatialMapDraftSize>("medium");
  const [spatialMapGroundingMode, setSpatialMapGroundingMode] = useState<SpatialMapGroundingMode>("setup");
  const [spatialMapInstructions, setSpatialMapInstructions] = useState("");
  const [expandedLearnedOptions, setExpandedLearnedOptions] = useState<Record<LearnedOptionGroup, boolean>>({
    genres: false,
    tones: false,
    settings: false,
    goals: false,
    preferences: false,
  });
  const [importedSetupNotice, setImportedSetupNotice] = useState<string | null>(null);
  const setupImportInputRef = useRef<HTMLInputElement>(null);
  const pendingImportedGenerationParametersRef = useRef<Partial<EditableGenerationParameters> | null>(null);
  const importedGenerationParametersRef = useRef<Partial<GenerationParameters> | null>(null);
  const importedArtStyleSettingsRef = useRef<
    Pick<
      GameSetupConfig,
      "artStylePrompt" | "generatedArtStylePrompt" | "useCampaignArtStyle" | "imageStyleProfileId"
    > | null
  >(null);

  const sidecarStatus = useSidecarStore((s) => s.status);
  const sidecarConfig = useSidecarStore((s) => s.config);
  const learnedGameSetupOptions = useUIStore((s) => s.learnedGameSetupOptions);
  const rememberGameSetupOptions = useUIStore((s) => s.rememberGameSetupOptions);
  const forgetGameSetupOption = useUIStore((s) => s.forgetGameSetupOption);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const openAgentCatalog = useUIStore((s) => s.openAgentCatalog);
  const sidecarAvailable = !!sidecarConfig.modelPath && sidecarStatus !== "not_downloaded";

  // Fetch sidecar status on mount so the dropdown is populated without visiting Connections first
  useEffect(() => {
    useSidecarStore.getState().fetchStatus();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setGenerationElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const updateElapsed = () => setGenerationElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(interval);
  }, [isLoading]);

  // Once status loads, sync the local toggle with the persisted config
  useEffect(() => {
    if (sidecarAvailable) {
      setUseLocalScene(sidecarConfig.useForGameScene);
    }
  }, [sidecarAvailable, sidecarConfig.useForGameScene]);

  // "local" = sidecar, a connection id = API connection, null = skip
  const sceneModelValue = useLocalScene && sidecarAvailable ? "local" : sceneConnectionId;

  const { data: connectionsList, isLoading: connectionsLoading } = useConnections();
  const { data: promptPresetsList, isLoading: promptPresetsLoading } = usePresets();
  const { data: defaultPreset } = useDefaultPreset();
  const { data: personasList, isLoading: personasLoading } = usePersonas();
  const { data: characterGroupsList } = useCharacterGroups();
  const { data: lorebooksList, isLoading: lorebooksLoading } = useLorebooks();
  const { data: installedAgentManifests = [], isLoading: installedAgentsLoading } = useCapabilityAgentRegistry();
  const installedAgentIds = useMemo(
    () => new Set(installedAgentManifests.map((agent) => agent.id)),
    [installedAgentManifests],
  );
  const hasInstalledAgents = installedAgentIds.size > 0;
  const hierarchicalMapsInstalled = installedAgentIds.has("hierarchical-maps");
  const musicDjInstalled = installedAgentIds.has("spotify");
  const lorebookKeeperInstalled = installedAgentIds.has("lorebook-keeper");
  const illustratorInstalled = installedAgentIds.has("illustrator");
  const spotifyPlaylistsQuery = useQuery({
    queryKey: ["spotify", "playlists", 50],
    queryFn: () =>
      api.get<{
        playlists: Array<{
          id: string;
          name: string;
          uri: string;
          trackCount: number | null;
          owned: boolean | null;
        }>;
      }>("/spotify/playlists?limit=50"),
    enabled: musicDjInstalled && enableSpotifyDj && gameSpotifySourceType === "playlist",
    staleTime: 60_000,
    retry: false,
  });

  const connections = useMemo(
    () =>
      (connectionsList as WizardConnection[]) ?? [],
    [connectionsList],
  );
  const selectedGmConnection = useMemo(
    () => connections.find((connection) => connection.id === gmConnectionId) ?? null,
    [connections, gmConnectionId],
  );
  const gmParameterDefaults = useMemo(
    () => getEditableGenerationParameters(ROLEPLAY_PARAMETER_DEFAULTS, selectedGmConnection?.defaultParameters),
    [selectedGmConnection?.defaultParameters],
  );
  const imageConnections = useMemo(() => connections.filter((c) => c.provider === "image_generation"), [connections]);
  const videoConnections = useMemo(() => connections.filter((c) => c.provider === "video_generation"), [connections]);
  const preferredImageConnectionId = useMemo(() => getPreferredConnectionId(imageConnections), [imageConnections]);
  const preferredVideoConnectionId = useMemo(() => getPreferredConnectionId(videoConnections), [videoConnections]);
  const promptPresets = useMemo(
    () =>
      (promptPresetsList as Array<{
        id: string;
        name: string;
        gamePrompt?: string;
        isDefault?: boolean | string;
      }>) ?? [],
    [promptPresetsList],
  );
  const selectedPromptPreset = useMemo(
    () => promptPresets.find((preset) => preset.id === promptPresetId) ?? null,
    [promptPresetId, promptPresets],
  );
  const selectedPromptPresetName = useMemo(
    () => selectedPromptPreset?.name ?? null,
    [selectedPromptPreset],
  );
  const effectiveGameSystemPrompt = useMemo(
    () =>
      gamePresentation === "anime"
        ? ANIME_GAME_SYSTEM_PROMPT
        : selectedPromptPreset?.gamePrompt?.trim() || DEFAULT_GAME_SYSTEM_PROMPT,
    [gamePresentation, selectedPromptPreset?.gamePrompt],
  );
  const personas = useMemo(
    () =>
      (personasList as Array<{
        id: string;
        name: string;
        avatarPath?: string | null;
        avatarCrop?: string | null;
        comment?: string;
      }>) ?? [],
    [personasList],
  );
  const characterFolders = useMemo(
    () =>
      ((characterGroupsList ?? []) as CharacterGroup[]).map((group) => ({
        ...group,
        characterIds: parseCharacterFolderIds(group.characterIds),
      })),
    [characterGroupsList],
  );
  const validCharacterIds = useMemo(() => new Set(characters.map((character) => character.id)), [characters]);

  const lorebooks = useMemo(
    () => (lorebooksList as Array<{ id: string; name: string; enabled?: boolean }>) ?? [],
    [lorebooksList],
  );
  const setupImportResourcesReady =
    !connectionsLoading && !promptPresetsLoading && !personasLoading && !lorebooksLoading;

  const availableLorebooks = useMemo(
    () =>
      lorebooks
        .filter((lb) => !activeLorebookIds.includes(lb.id))
        .filter((lb) => lb.name.toLowerCase().includes(lbSearch.toLowerCase())),
    [lorebooks, activeLorebookIds, lbSearch],
  );

  const toggleLorebook = useCallback((lbId: string) => {
    setActiveLorebookIds((prev) => (prev.includes(lbId) ? prev.filter((id) => id !== lbId) : [...prev, lbId]));
  }, []);

  useEffect(() => {
    if (activeLorebookIds.length > 0 || spatialMapGroundingMode === "setup") return;
    setSpatialMapGroundingMode("setup");
  }, [activeLorebookIds.length, spatialMapGroundingMode]);

  const filteredPersonas = useMemo(
    () =>
      personas.filter((p) => {
        const query = personaSearch.toLowerCase();
        const title = getPersonaTitle(p)?.toLowerCase() ?? "";
        return p.name.toLowerCase().includes(query) || title.includes(query);
      }),
    [personas, personaSearch],
  );

  const steps = GAME_SETUP_STEPS;
  const currentStep = steps[step] ?? steps[0]!;
  const learnedGenres = useMemo(
    () => filterLearnedOptions(learnedGameSetupOptions?.genres, [...GENRES, ...genres]),
    [genres, learnedGameSetupOptions?.genres],
  );
  const learnedTones = useMemo(
    () => filterLearnedOptions(learnedGameSetupOptions?.tones, [...TONES, ...tones]),
    [learnedGameSetupOptions?.tones, tones],
  );
  const learnedSettings = useMemo(
    () => filterLearnedOptions(learnedGameSetupOptions?.settings, [...SETTING_SUGGESTIONS, setting]),
    [learnedGameSetupOptions?.settings, setting],
  );
  const learnedGoals = useMemo(
    () => filterLearnedOptions(learnedGameSetupOptions?.goals, [...GOAL_SUGGESTIONS, playerGoals]),
    [learnedGameSetupOptions?.goals, playerGoals],
  );
  const learnedPreferences = useMemo(
    () => filterLearnedOptions(learnedGameSetupOptions?.preferences, [...PREFERENCE_SUGGESTIONS, preferences]),
    [learnedGameSetupOptions?.preferences, preferences],
  );

  const toggleLearnedOptions = (group: LearnedOptionGroup) => {
    setExpandedLearnedOptions((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const toggleGenre = (g: string) => {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const addCustomGenre = () => {
    const trimmed = customGenre.trim();
    if (trimmed && !genres.includes(trimmed)) {
      setGenres((prev) => [...prev, trimmed]);
    }
    setCustomGenre("");
  };

  const toggleTone = (t: string) => {
    setTones((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const addCustomTone = () => {
    const trimmed = customTone.trim();
    if (trimmed && !tones.includes(trimmed)) {
      setTones((prev) => [...prev, trimmed]);
    }
    setCustomTone("");
  };

  const togglePartyMember = (id: string) => {
    setPartyCharacterIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const addPartyMembersFromFolder = useCallback(
    (folderId: string) => {
      const folder = characterFolders.find((entry) => entry.id === folderId);
      if (!folder) return;
      const folderCharacterIds = folder.characterIds.filter((id) => validCharacterIds.has(id) && id !== gmCharacterId);
      setPartyCharacterIds((prev) => {
        const next = [...prev];
        for (const id of folderCharacterIds) {
          if (!next.includes(id)) next.push(id);
        }
        return next;
      });
      setPartyFolderId("");
    },
    [characterFolders, gmCharacterId, validCharacterIds],
  );

  const filteredGmCharacters = useMemo(
    () =>
      characters.filter((c) => {
        const query = gmSearch.toLowerCase();
        const title = getCharacterTitle(c)?.toLowerCase() ?? "";
        return c.name.toLowerCase().includes(query) || title.includes(query);
      }),
    [characters, gmSearch],
  );

  const filteredPartyCharacters = useMemo(
    () =>
      characters.filter((c) => {
        if (c.id === gmCharacterId) return false;
        const query = partySearch.toLowerCase();
        const title = getCharacterTitle(c)?.toLowerCase() ?? "";
        return c.name.toLowerCase().includes(query) || title.includes(query);
      }),
    [characters, gmCharacterId, partySearch],
  );

  const applySuggestion = useCallback((setter: (v: string) => void, value: string) => {
    if (value === "Surprise me!") {
      setter("Surprise me, go wild!");
    } else {
      setter(value);
    }
  }, []);

  useEffect(() => {
    const importedParameters = pendingImportedGenerationParametersRef.current;
    if (importedParameters) {
      if (!gmConnectionId) return;
      pendingImportedGenerationParametersRef.current = null;
      setGenerationParameters(getEditableGenerationParameters(gmParameterDefaults, importedParameters));
      return;
    }
    setGenerationParameters(gmParameterDefaults);
  }, [gmConnectionId, gmParameterDefaults]);

  useEffect(() => {
    if (enableSpriteGeneration && !imageConnectionId && preferredImageConnectionId) {
      setImageConnectionId(preferredImageConnectionId);
    }
  }, [enableSpriteGeneration, imageConnectionId, preferredImageConnectionId]);

  useEffect(() => {
    if (enableStoryboardAnimations && !videoConnectionId && preferredVideoConnectionId) {
      setVideoConnectionId(preferredVideoConnectionId);
    }
  }, [enableStoryboardAnimations, preferredVideoConnectionId, videoConnectionId]);

  useEffect(() => {
    if (!promptPresetTouched && !promptPresetId && defaultPreset?.id) {
      setPromptPresetId(defaultPreset.id);
    }
  }, [defaultPreset?.id, promptPresetId, promptPresetTouched]);

  useEffect(() => {
    if (!gameSystemPromptEdited) {
      setGameSystemPromptDraft(effectiveGameSystemPrompt);
    }
  }, [effectiveGameSystemPrompt, gameSystemPromptEdited]);

  useEffect(() => {
    if (installedAgentsLoading) return;
    if (!hierarchicalMapsInstalled) setDraftSpatialMap(false);
    if (!musicDjInstalled) setEnableSpotifyDj(false);
    if (!lorebookKeeperInstalled) setEnableLorebookKeeper(false);
    if (!illustratorInstalled) {
      setEnableSpriteGeneration(false);
      setEnableStoryboardIllustrations(false);
      setEnableStoryboardAnimations(false);
    }
  }, [
    hierarchicalMapsInstalled,
    illustratorInstalled,
    installedAgentsLoading,
    lorebookKeeperInstalled,
    musicDjInstalled,
  ]);

  const handlePromptPresetChange = useCallback((presetId: string | null) => {
    setPromptPresetTouched(true);
    setPromptPresetId(presetId);
  }, []);

  const canStart = !!gmConnectionId;
  const normalizedLanguage = normalizeGameLanguage(language);
  const illustratorEnabled = illustratorInstalled && enableSpriteGeneration;
  const musicDjEnabled = musicDjInstalled && enableSpotifyDj;
  const lorebookKeeperEnabled = lorebookKeeperInstalled && enableLorebookKeeper;
  const storyboardIllustrationsEnabled = illustratorEnabled && enableStoryboardIllustrations;
  const storyboardAnimationsEnabled = storyboardIllustrationsEnabled && enableStoryboardAnimations && !!videoConnectionId;

  const openDownloadAgents = useCallback(() => {
    onCancel();
    openRightPanel("agents");
    openAgentCatalog();
  }, [onCancel, openAgentCatalog, openRightPanel]);

  const toggleVisualGeneration = () => {
    const nextEnabled = !enableSpriteGeneration;
    setEnableSpriteGeneration(nextEnabled);
    if (nextEnabled && !imageConnectionId && preferredImageConnectionId) {
      setImageConnectionId(preferredImageConnectionId);
    }
    if (nextEnabled) {
      setEnableStoryboardIllustrations(true);
    }
    if (!nextEnabled) {
      setEnableStoryboardIllustrations(false);
      setEnableStoryboardAnimations(false);
    }
  };

  const toggleStoryboardIllustrations = () => {
    const nextEnabled = !enableStoryboardIllustrations;
    setEnableSpriteGeneration(true);
    setEnableStoryboardIllustrations(nextEnabled);
    if (nextEnabled && !imageConnectionId && preferredImageConnectionId) {
      setImageConnectionId(preferredImageConnectionId);
    }
    if (!nextEnabled) {
      setEnableStoryboardAnimations(false);
    }
  };

  const toggleStoryboardAnimations = () => {
    const nextEnabled = !enableStoryboardAnimations;
    setEnableSpriteGeneration(true);
    setEnableStoryboardIllustrations(true);
    setEnableStoryboardAnimations(nextEnabled);
    if (nextEnabled) {
      if (!imageConnectionId && preferredImageConnectionId) {
        setImageConnectionId(preferredImageConnectionId);
      }
      if (!videoConnectionId && preferredVideoConnectionId) {
        setVideoConnectionId(preferredVideoConnectionId);
      }
    }
  };

  const handleImportSetupFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || isLoading) return;

    try {
      if (!setupImportResourcesReady) {
        throw new Error("Setup resources are still loading. Try the import again in a moment.");
      }
      if (file.size > GAME_SETUP_IMPORT_MAX_BYTES) {
        throw new Error("This setup file is too large. Choose a Game Mode setup file smaller than 1 MB.");
      }

      const shareFile = parseGameSetupShareFileJson(await file.text());
      const imported = resolveGameSetupImport(shareFile, {
        characters,
        connections,
        lorebooks,
        personas,
        promptPresets,
      });
      const config = imported.config;
      const importedGenres = config.genre
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const importedTones = config.tone
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const importedPresentation =
        config.gameGmPromptTemplateId === ANIME_GAME_PROMPT_TEMPLATE_ID ? "anime" : "standard";
      const importedPromptPreset = promptPresets.find((preset) => preset.id === config.promptPresetId) ?? null;
      const importedCustomPrompt = config.gameSystemPrompt?.trim() ?? "";
      const importedBasePrompt =
        importedPresentation === "anime"
          ? ANIME_GAME_SYSTEM_PROMPT
          : importedPromptPreset?.gamePrompt?.trim() || DEFAULT_GAME_SYSTEM_PROMPT;
      const importedWidgets = normalizeGameHudWidgets(config.customHudWidgets ?? []);
      const importedGenerationParameters = imported.effectiveGenerationParameters ?? config.generationParameters ?? null;
      const importedParameterOverrides = parseEditableGenerationParameters(importedGenerationParameters);
      const hasImportedGenerationParameters =
        importedGenerationParameters !== null && Object.keys(importedGenerationParameters).length > 0;
      const importedGmConnection = connections.find((connection) => connection.id === imported.gmConnectionId) ?? null;
      const importedGmDefaults = getEditableGenerationParameters(
        ROLEPLAY_PARAMETER_DEFAULTS,
        importedGmConnection?.defaultParameters,
      );

      setStep(0);
      setGameName(imported.gameName);
      setGenres(importedGenres.length > 0 ? importedGenres : ["Fantasy"]);
      setCustomGenre("");
      setSetting(config.setting);
      setTones(importedTones.length > 0 ? importedTones : ["Heroic"]);
      setCustomTone("");
      setDifficulty(config.difficulty);
      setCombatStyle(config.combatStyle === "tactical" ? "tactical" : "classic");
      setRating(config.rating);
      setLanguage(config.language?.trim() || "English");
      setGmMode(config.gmMode);
      setGmCharacterId(config.gmCharacterId ?? null);
      setPartyCharacterIds(config.partyCharacterIds);
      setPersonaId(config.personaId ?? null);
      setPlayerGoals(config.playerGoals);
      setPreferences(imported.preferences);
      setGmSearch("");
      setPartySearch("");
      setPartyFolderId("");
      setPersonaSearch("");
      setGmConnectionId(imported.gmConnectionId);
      setCustomizeParameters(hasImportedGenerationParameters);
      setGenerationParameters(getEditableGenerationParameters(importedGmDefaults, importedParameterOverrides));
      importedGenerationParametersRef.current = importedGenerationParameters;
      pendingImportedGenerationParametersRef.current =
        importedParameterOverrides &&
        (imported.gmConnectionId === null || imported.gmConnectionId !== gmConnectionId)
          ? importedParameterOverrides
          : null;
      importedArtStyleSettingsRef.current = {
        artStylePrompt: config.artStylePrompt,
        generatedArtStylePrompt: config.generatedArtStylePrompt,
        useCampaignArtStyle: config.useCampaignArtStyle,
        imageStyleProfileId: config.imageStyleProfileId,
      };
      setUseLocalScene(
        sidecarAvailable &&
          !config.sceneConnectionId &&
          shareFile.setup.connections?.scene?.provider === "local",
      );
      setSceneConnectionId(config.sceneConnectionId ?? null);

      const visualGenerationEnabled =
        config.enableSpriteGeneration === true ||
        config.gameStoryboardAutoIllustrationsEnabled === true ||
        config.gameStoryboardAutoGenerationEnabled === true;
      setEnableSpriteGeneration(visualGenerationEnabled);
      setImageConnectionId(config.imageConnectionId ?? null);
      setVideoConnectionId(config.videoConnectionId ?? null);
      setEnableStoryboardIllustrations(
        config.gameStoryboardAutoIllustrationsEnabled === true ||
          config.gameStoryboardAutoGenerationEnabled === true,
      );
      setEnableStoryboardAnimations(config.gameStoryboardAutoGenerationEnabled === true);
      setStoryboardKeyframeCount(
        Math.min(
          GAME_STORYBOARD_KEYFRAME_COUNT_MAX,
          Math.max(
            GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
            Number.isFinite(config.gameStoryboardKeyframeCount)
              ? Math.round(config.gameStoryboardKeyframeCount!)
              : GAME_STORYBOARD_KEYFRAME_COUNT_DEFAULT,
          ),
        ),
      );
      setGamePresentation(importedPresentation);
      setActiveLorebookIds(config.activeLorebookIds ?? []);
      setLbSearch("");
      setEnableCustomWidgets(config.enableCustomWidgets !== false);
      setManualWidgetSetupEnabled(importedWidgets.length > 0);
      setCustomHudWidgets(
        importedWidgets.length > 0
          ? importedWidgets
          : normalizeGameHudWidgets([createDefaultGameHudWidget("progress_bar", [])]),
      );
      setEnableSpotifyDj(config.enableSpotifyDj === true);
      setGameSpotifySourceType(normalizeGameSpotifySourceType(config.spotifySourceType));
      setGameSpotifyPlaylistId(config.spotifyPlaylistId?.trim() || "");
      setGameSpotifyPlaylistName(config.spotifyPlaylistName?.trim() || "");
      setGameSpotifyArtist(config.spotifyArtist?.trim() || "");
      setEnableLorebookKeeper(config.enableLorebookKeeper === true);
      setPromptPresetTouched(true);
      setPromptPresetId(config.promptPresetId ?? null);
      setCustomGamePromptEnabled(Boolean(importedCustomPrompt));
      setGameSystemPromptDraft(importedCustomPrompt || importedBasePrompt);
      setGameSystemPromptEdited(Boolean(importedCustomPrompt));
      setGameSpecialInstructions(config.gameSpecialInstructions?.trim() || "");
      setDraftSpatialMap(false);
      setSpatialMapDraftSize("medium");
      setSpatialMapGroundingMode("setup");

      const warningCount = imported.warnings.length;
      setImportedSetupNotice(
        warningCount > 0
          ? `${file.name} loaded. ${warningCount} local ${warningCount === 1 ? "selection needs" : "selections need"} review.`
          : `${file.name} loaded. Review the steps, then start the new game.`,
      );
      toast.success("Game Mode setup imported.");
      if (warningCount > 0) {
        toast.warning("Some local selections could not be restored.", {
          description: imported.warnings.join(" "),
        });
      }
    } catch (error) {
      setImportedSetupNotice(null);
      toast.error(error instanceof Error ? error.message : "Could not import this Game Mode setup file.");
    }
  };

  const handleComplete = () => {
    if (isLoading || !canStart) return;
    const trimmedGameSystemPrompt = gameSystemPromptDraft.trim();
    const customGameSystemPrompt =
      customGamePromptEnabled &&
      trimmedGameSystemPrompt &&
      trimmedGameSystemPrompt !== effectiveGameSystemPrompt.trim()
        ? trimmedGameSystemPrompt
        : null;
    const trimmedGameSpecialInstructions = gameSpecialInstructions.trim();
    if (startMuted) {
      useGameAssetStore.getState().setAudioMuted(true);
    }
    // Sync the wizard's local-scene toggle to the global sidecar config
    if (sidecarAvailable) {
      useSidecarStore.getState().updateConfig({ useForGameScene: sceneModelValue === "local" });
    }
    rememberGameSetupOptions(
      {
        genres: filterCustomLearnedValues(genres, GENRES),
        tones: filterCustomLearnedValues(tones, TONES),
        settings: filterCustomLearnedValues(setting ? [setting] : [], SETTING_SUGGESTIONS),
        goals: filterCustomLearnedValues(playerGoals ? [playerGoals] : [], GOAL_SUGGESTIONS),
        preferences: filterCustomLearnedValues(preferences ? [preferences] : [], PREFERENCE_SUGGESTIONS),
      },
      {
        playerGoals,
        preferences,
      },
    );
    onComplete(
      {
        genre: genres.join(", ") || "Fantasy",
        setting: setting || `A ${(genres[0] ?? "fantasy").toLowerCase()} world`,
        tone: tones.join(", ") || "Heroic",
        difficulty,
        combatStyle,
        rating,
        gmMode,
        gmCharacterId: gmMode === "character" && gmCharacterId ? gmCharacterId : undefined,
        partyCharacterIds,
        playerGoals: playerGoals || "Have an adventure",
        personaId: personaId ?? undefined,
        sceneConnectionId: sceneModelValue && sceneModelValue !== "local" ? sceneModelValue : undefined,
        enableSpriteGeneration: illustratorEnabled || undefined,
        imageConnectionId: illustratorEnabled && imageConnectionId ? imageConnectionId : undefined,
        videoConnectionId: illustratorEnabled && videoConnectionId ? videoConnectionId : undefined,
        ...(importedArtStyleSettingsRef.current ?? {}),
        gameStoryboardAutoIllustrationsEnabled: illustratorEnabled
          ? enableStoryboardIllustrations
          : undefined,
        gameStoryboardAutoGenerationEnabled: storyboardAnimationsEnabled || undefined,
        gameStoryboardKeyframeCount: illustratorEnabled ? storyboardKeyframeCount : undefined,
        gameGmPromptTemplateId: gamePresentation === "anime" ? ANIME_GAME_PROMPT_TEMPLATE_ID : null,
        gameStoryboardAnimationPromptTemplateId:
          gamePresentation === "anime" ? GAME_STORYBOARD_COMIC_ANIMATION_PROMPT_TEMPLATE_ID : null,
        gameStoryboardImagePromptTemplateId:
          gamePresentation === "anime" ? STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE_ID : null,
        gameStoryboardVideoPromptTemplateId:
          gamePresentation === "anime" ? COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE_ID : null,
        activeLorebookIds: activeLorebookIds.length > 0 ? activeLorebookIds : undefined,
        enableCustomWidgets,
        customHudWidgets:
          enableCustomWidgets && manualWidgetSetupEnabled ? normalizeGameHudWidgets(customHudWidgets) : undefined,
        enableSpotifyDj: musicDjEnabled || undefined,
        spotifySourceType: musicDjEnabled ? gameSpotifySourceType : undefined,
        spotifyPlaylistId:
          musicDjEnabled && gameSpotifySourceType === "playlist"
            ? gameSpotifyPlaylistId.trim() || undefined
            : undefined,
        spotifyPlaylistName:
          musicDjEnabled && gameSpotifySourceType === "playlist"
            ? gameSpotifyPlaylistName.trim() || undefined
            : undefined,
        spotifyArtist:
          musicDjEnabled && gameSpotifySourceType === "artist" ? gameSpotifyArtist.trim() || undefined : undefined,
        enableLorebookKeeper: lorebookKeeperEnabled || undefined,
        language: normalizedLanguage || undefined,
        generationParameters: customizeParameters
          ? { ...(importedGenerationParametersRef.current ?? {}), ...generationParameters }
          : undefined,
        promptPresetId,
        gameSystemPrompt: customGameSystemPrompt,
        gameSpecialInstructions: trimmedGameSpecialInstructions || null,
      },
      preferences,
      {
        gmConnectionId: gmConnectionId ?? undefined,
        shareLabels: {
          characterNames: Object.fromEntries(
            characters
              .filter((character) =>
                [...partyCharacterIds, ...(gmCharacterId ? [gmCharacterId] : [])].includes(character.id),
              )
              .map((character) => [character.id, character.name]),
          ),
          lorebookNames: Object.fromEntries(
            lorebooks
              .filter((lorebook) => activeLorebookIds.includes(lorebook.id))
              .map((lorebook) => [lorebook.id, lorebook.name]),
          ),
          promptPresetNames: selectedPromptPreset
            ? { [selectedPromptPreset.id]: selectedPromptPreset.name }
            : undefined,
          personaName: personas.find((persona) => persona.id === personaId)?.name ?? null,
        },
      },
      gameName.trim() || undefined,
      hierarchicalMapsInstalled && draftSpatialMap
        ? {
            size: spatialMapDraftSize,
            groundingMode: spatialMapGroundingMode,
            sourceLorebookIds: spatialMapGroundingMode === "setup" ? [] : activeLorebookIds,
            instructions: spatialMapInstructions.trim() || undefined,
          }
        : undefined,
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/45 backdrop-blur-[2px]"
        onClick={isLoading ? undefined : onCancel}
      />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-3 pointer-events-none max-md:pt-[max(0.75rem,env(safe-area-inset-top))] max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.key}
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-setup-wizard-title"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={GAME_SETUP_WIZARD_PANEL_CLASS}
          >
            <div className={cn(NEUTRAL_PANEL_HEADER, "flex shrink-0 items-center justify-between")}>
              <h3 id="game-setup-wizard-title" className={NEUTRAL_PANEL_TITLE}>
                New Game
              </h3>
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-wait disabled:opacity-40"
                aria-label="Close setup"
              >
                <X size="0.875rem" />
              </button>
            </div>

            <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4")}>
              <h4 className="text-sm font-semibold text-[var(--foreground)]">{currentStep.title}</h4>
              <p className={cn(NEUTRAL_PANEL_SUBTITLE, "mb-4")}>{currentStep.body}</p>
              <div className="space-y-4">
        {step === 0 && (
          <>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-3">
              <input
                ref={setupImportInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(event) => void handleImportSetupFile(event)}
                className="sr-only"
                aria-label="Import Game Mode setup file"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <FileUp size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--foreground)]">Reuse a game setup</p>
                    <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                      Import a setup downloaded from another campaign. You can review every step before starting.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setupImportInputRef.current?.click()}
                  disabled={isLoading || !setupImportResourcesReady}
                  className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:cursor-wait disabled:opacity-50"
                >
                  <FileUp size={13} />
                  {setupImportResourcesReady ? "Import setup" : "Loading…"}
                </button>
              </div>
              {importedSetupNotice && (
                <p
                  className="mt-3 flex items-start gap-2 border-t border-[var(--border)] pt-3 text-[0.6875rem] leading-relaxed text-[var(--foreground)]"
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  <span>{importedSetupNotice}</span>
                </p>
              )}
            </div>

            <div>
              <label className={GAME_SETUP_FIELD_LABEL}>Game Name</label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="Name your adventure..."
                className={GAME_SETUP_INPUT_CLASS}
              />
            </div>

            <div>
              <label className={GAME_SETUP_FIELD_LABEL}>
                <Plug size={12} className="mr-1 inline" />
                Connection
              </label>
              <select
                value={gmConnectionId ?? ""}
                onChange={(e) => setGmConnectionId(e.target.value || null)}
                className={GAME_SETUP_INPUT_CLASS}
              >
                <option value="">Select a connection...</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.model ? ` - ${c.model}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-2 rounded-lg border border-[var(--primary)]/35 bg-[var(--primary)]/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-[var(--primary)]">
                Use a strong model for the initial world generation. You can change it later in Chat Settings.
              </p>
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                <button
                  onClick={() => setCustomizeParameters((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <span className="block text-xs font-medium text-[var(--foreground)]">Customize Parameters</span>
                    <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                      Leave this off to use the selected connection&apos;s saved defaults for the game.
                    </span>
                  </div>
                  <div
                    className={cn(
                      "h-5 w-9 rounded-full p-0.5 transition-colors",
                      customizeParameters ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white transition-transform",
                        customizeParameters && "translate-x-3.5",
                      )}
                    />
                  </div>
                </button>
                {customizeParameters && (
                  <div className="mt-3 border-t border-[var(--border)] pt-3">
                    <GenerationParametersFields
                      value={generationParameters}
                      showOpenRouterServiceTier={selectedGmConnection?.provider === "openrouter"}
                      onChange={setGenerationParameters}
                    />
                  </div>
                )}
              </div>
              {connections.length === 0 && (
                <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                  No connections configured. Add one in Settings - Connections.
                </p>
              )}
            </div>

            <div>
              <label className={GAME_SETUP_FIELD_LABEL}>
                Scene Effects Connection
                <span className="ml-1 text-[0.575rem] text-[var(--muted-foreground)]">(optional)</span>
              </label>
              <select
                value={sceneModelValue ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "local") {
                    setUseLocalScene(true);
                    setSceneConnectionId(null);
                  } else {
                    setUseLocalScene(false);
                    setSceneConnectionId(v || null);
                  }
                }}
                className={GAME_SETUP_INPUT_CLASS}
              >
                <option value="">Skip - use inline tags from GM</option>
                {sidecarAvailable && <option value="local">Local Model (Gemma)</option>}
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.model ? ` - ${c.model}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[0.575rem] text-[var(--muted-foreground)]">
                Handles backgrounds, music, weather, and cinematic effects after each GM turn.
              </p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            {/* Genre — multi-select */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                Genre ({genres.length} selected)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs transition-colors",
                      genres.includes(g)
                        ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {g}
                  </button>
                ))}
                {/* Custom genres */}
                {genres
                  .filter((g) => !GENRES.includes(g))
                  .map((g) => (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className="flex items-center gap-1 rounded-full bg-[var(--primary)]/20 px-3 py-1 text-xs text-[var(--primary)] ring-1 ring-[var(--primary)]/40 transition-colors"
                    >
                      {g}
                      <X size={10} />
                    </button>
                  ))}
              </div>
              <LearnedOptionChips
                options={learnedGenres}
                expanded={expandedLearnedOptions.genres}
                onToggleExpanded={() => toggleLearnedOptions("genres")}
                onSelect={toggleGenre}
                onForget={(value) => forgetGameSetupOption("genres", value)}
                selected={(value) => genres.includes(value)}
              />
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="text"
                  value={customGenre}
                  onChange={(e) => setCustomGenre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomGenre()}
                  placeholder="Add custom genre…"
                  className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
                />
                <button
                  onClick={addCustomGenre}
                  disabled={!customGenre.trim()}
                  className="rounded-lg bg-[var(--secondary)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--primary)] disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Setting */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">Setting</label>
              <input
                type="text"
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
                placeholder="Describe your world…"
                className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {SETTING_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => applySuggestion(setSetting, s)}
                    className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
                  >
                    {s === "Surprise me!" && <Sparkles size={9} />}
                    {s}
                  </button>
                ))}
              </div>
              <LearnedOptionChips
                options={learnedSettings}
                expanded={expandedLearnedOptions.settings}
                onToggleExpanded={() => toggleLearnedOptions("settings")}
                onSelect={setSetting}
                onForget={(value) => forgetGameSetupOption("settings", value)}
              />
            </div>

            {/* Tone — multi-select */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                Tone ({tones.length} selected)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTone(t)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs transition-colors",
                      tones.includes(t)
                        ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {t}
                  </button>
                ))}
                {/* Custom tones */}
                {tones
                  .filter((t) => !TONES.includes(t))
                  .map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTone(t)}
                      className="flex items-center gap-1 rounded-full bg-[var(--primary)]/20 px-3 py-1 text-xs text-[var(--primary)] ring-1 ring-[var(--primary)]/40 transition-colors"
                    >
                      {t}
                      <X size={10} />
                    </button>
                  ))}
              </div>
              <LearnedOptionChips
                options={learnedTones}
                expanded={expandedLearnedOptions.tones}
                onToggleExpanded={() => toggleLearnedOptions("tones")}
                onSelect={toggleTone}
                onForget={(value) => forgetGameSetupOption("tones", value)}
                selected={(value) => tones.includes(value)}
              />
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="text"
                  value={customTone}
                  onChange={(e) => setCustomTone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomTone()}
                  placeholder="Add custom tone…"
                  className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
                />
                <button
                  onClick={addCustomTone}
                  disabled={!customTone.trim()}
                  className="rounded-lg bg-[var(--secondary)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--primary)] disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Difficulty — single-select */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">Difficulty</label>
              <div className="flex gap-1.5">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs transition-colors",
                      difficulty === d
                        ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Combat Preference — single-select */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">Combat Preference</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCombatStyle("classic")}
                  className={cn(
                    "flex-1 rounded-lg p-3 text-left text-xs transition-colors ring-1",
                    combatStyle === "classic"
                      ? "bg-[var(--primary)]/10 ring-[var(--primary)]/40"
                      : "bg-[var(--secondary)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                  )}
                >
                  <div className="font-medium text-[var(--foreground)]">Classic</div>
                  <div className="mt-1 text-[var(--muted-foreground)]">Cinematic menu battles (current style)</div>
                </button>
                <button
                  onClick={() => setCombatStyle("tactical")}
                  className={cn(
                    "flex-1 rounded-lg p-3 text-left text-xs transition-colors ring-1",
                    combatStyle === "tactical"
                      ? "bg-[var(--primary)]/10 ring-[var(--primary)]/40"
                      : "bg-[var(--secondary)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                  )}
                >
                  <div className="font-medium text-[var(--foreground)]">Tactical</div>
                  <div className="mt-1 text-[var(--muted-foreground)]">
                    Fire Emblem-style grid battles: movement, terrain, forecasts
                  </div>
                </button>
              </div>
            </div>

            {/* Content Rating */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">Content Rating</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setRating("sfw")}
                  aria-pressed={rating === "sfw"}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs transition-colors",
                    rating === "sfw"
                      ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                      : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                >
                  SFW
                </button>
                <button
                  type="button"
                  onClick={() => setRating("nsfw")}
                  aria-pressed={rating === "nsfw"}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs transition-colors",
                    rating === "nsfw"
                      ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                      : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                >
                  NSFW
                </button>
              </div>
              <p className="mt-1 text-[0.575rem] text-[var(--muted-foreground)]">
                {rating === "nsfw"
                  ? "Anything goes. Violence, dark themes, and explicit content are unrestricted."
                  : "Dark themes and profanity allowed, but explicit scenes cut to black."}
              </p>
            </div>

            {/* Language */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">Language</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="English"
                className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {GAME_LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setLanguage(option.label)}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.625rem] transition-colors",
                      normalizedLanguage === option.value
                        ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[0.575rem] text-[var(--muted-foreground)]">
                All narration and dialogue will be written in this language.
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* GM Mode */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">Game Master Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setGmMode("standalone")}
                  className={cn(
                    "flex-1 rounded-lg p-3 text-left text-xs transition-colors ring-1",
                    gmMode === "standalone"
                      ? "bg-[var(--primary)]/10 ring-[var(--primary)]/40"
                      : "bg-[var(--secondary)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                  )}
                >
                  <div className="font-medium text-[var(--foreground)]">Standalone GM</div>
                  <div className="mt-1 text-[var(--muted-foreground)]">A snarky narrator running the show</div>
                </button>
                <button
                  onClick={() => setGmMode("character")}
                  className={cn(
                    "flex-1 rounded-lg p-3 text-left text-xs transition-colors ring-1",
                    gmMode === "character"
                      ? "bg-[var(--primary)]/10 ring-[var(--primary)]/40"
                      : "bg-[var(--secondary)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                  )}
                >
                  <div className="font-medium text-[var(--foreground)]">Character GM</div>
                  <div className="mt-1 text-[var(--muted-foreground)]">Use an existing character as GM</div>
                </button>
              </div>
            </div>

            {/* GM Character selector */}
            {gmMode === "character" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">GM Character</label>
                {/* Selected GM */}
                {gmCharacterId &&
                  (() => {
                    const c = characters.find((ch) => ch.id === gmCharacterId);
                    if (!c) return null;
                    return (
                      <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                        <CharacterAvatar character={c} />
                        <span className="flex-1 truncate text-xs">{c.name}</span>
                        <button
                          onClick={() => setGmCharacterId(null)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                          title="Remove"
                        >
                          <X size="0.6875rem" />
                        </button>
                      </div>
                    );
                  })()}
                {/* Search + list */}
                <div className="rounded-lg ring-1 ring-[var(--border)] bg-[var(--card)] overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
                    <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
                    <input
                      value={gmSearch}
                      onChange={(e) => setGmSearch(e.target.value)}
                      placeholder="Search characters…"
                      className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {filteredGmCharacters.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setGmCharacterId(c.id === gmCharacterId ? null : c.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                          c.id === gmCharacterId && "bg-[var(--primary)]/5",
                        )}
                      >
                        <CharacterAvatar character={c} />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs">{c.name}</span>
                          {getCharacterTitle(c) && (
                            <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                              {getCharacterTitle(c)}
                            </span>
                          )}
                        </div>
                        {c.id === gmCharacterId && (
                          <span className="text-[0.625rem] text-[var(--primary)]">Selected</span>
                        )}
                      </button>
                    ))}
                    {filteredGmCharacters.length === 0 && (
                      <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                        {characters.length === 0 ? "No characters found." : "No matches."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Party Members */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                Party Members ({partyCharacterIds.length} selected)
              </label>
              {/* Selected party members */}
              {partyCharacterIds.length > 0 && (
                <div className="mb-2 flex flex-col gap-1">
                  {partyCharacterIds.map((cid) => {
                    const c = characters.find((ch) => ch.id === cid);
                    if (!c) return null;
                    return (
                      <div
                        key={cid}
                        className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
                      >
                        <CharacterAvatar character={c} />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs">{c.name}</span>
                          {getCharacterTitle(c) && (
                            <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                              {getCharacterTitle(c)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => togglePartyMember(cid)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                          title="Remove"
                        >
                          <X size="0.6875rem" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Search + list */}
              <div className="rounded-lg ring-1 ring-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
                  <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
                  <input
                    value={partySearch}
                    onChange={(e) => setPartySearch(e.target.value)}
                    placeholder="Search characters…"
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
                  />
                </div>
                {characterFolders.length > 0 && (
                  <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
                    <FolderOpen size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                    <select
                      value={partyFolderId}
                      onChange={(event) => setPartyFolderId(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] outline-none"
                      aria-label="Add party members from folder"
                    >
                      <option value="">Add from Folder</option>
                      {characterFolders.map((folder) => {
                        const newCount = folder.characterIds.filter(
                          (id) => validCharacterIds.has(id) && id !== gmCharacterId && !partyCharacterIds.includes(id),
                        ).length;
                        return (
                          <option key={folder.id} value={folder.id}>
                            {folder.name} ({newCount > 0 ? `${newCount} new` : "all added"})
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={() => addPartyMembersFromFolder(partyFolderId)}
                      disabled={!partyFolderId}
                      className="rounded-lg bg-[var(--primary)]/15 px-2.5 py-1 text-[0.625rem] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
                <div className="max-h-36 overflow-y-auto">
                  {filteredPartyCharacters.map((c) => {
                    const isSelected = partyCharacterIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => togglePartyMember(c.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                          isSelected && "bg-[var(--primary)]/5",
                        )}
                      >
                        <CharacterAvatar character={c} />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs">{c.name}</span>
                          {getCharacterTitle(c) && (
                            <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                              {getCharacterTitle(c)}
                            </span>
                          )}
                        </div>
                        {isSelected ? (
                          <span className="text-[0.625rem] text-[var(--primary)]">Added</span>
                        ) : (
                          <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
                        )}
                      </button>
                    );
                  })}
                  {filteredPartyCharacters.length === 0 && (
                    <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                      {characters.length === 0 ? "No characters found. Create characters first." : "No matches."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Persona */}
            <div>
              <label className={GAME_SETUP_FIELD_LABEL}>
                <User size={12} className="mr-1 inline" />
                Player&apos;s Persona
              </label>
              {personaId &&
                (() => {
                  const p = personas.find((x) => x.id === personaId);
                  if (!p) return null;
                  const title = getPersonaTitle(p);
                  return (
                    <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                      <CharacterAvatar
                        character={{
                          name: p.name,
                          avatarUrl: p.avatarPath ?? null,
                          avatarCrop: parseAvatarCropJson(p.avatarCrop),
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs">{p.name}</span>
                        {title && (
                          <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">{title}</span>
                        )}
                      </div>
                      <button
                        onClick={() => setPersonaId(null)}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                        title="Remove"
                      >
                        <X size="0.6875rem" />
                      </button>
                    </div>
                  );
                })()}
              <div className="overflow-hidden rounded-lg bg-[var(--card)] ring-1 ring-[var(--border)]">
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
                  <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
                  <input
                    value={personaSearch}
                    onChange={(e) => setPersonaSearch(e.target.value)}
                    placeholder="Search personas or titles..."
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
                  />
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {filteredPersonas.map((p) => {
                    const title = getPersonaTitle(p);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPersonaId(p.id === personaId ? null : p.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                          p.id === personaId && "bg-[var(--primary)]/5",
                        )}
                      >
                        <CharacterAvatar
                          character={{
                            name: p.name,
                            avatarUrl: p.avatarPath ?? null,
                            avatarCrop: parseAvatarCropJson(p.avatarCrop),
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs">{p.name}</span>
                          {title && (
                            <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                              {title}
                            </span>
                          )}
                        </div>
                        {p.id === personaId && <span className="text-[0.625rem] text-[var(--primary)]">Selected</span>}
                      </button>
                    );
                  })}
                  {filteredPersonas.length === 0 && (
                    <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                      {personas.length === 0 ? "No personas found. Create one in the Personas panel." : "No matches."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            {/* Game Features */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">Game Features</label>
              <div className="space-y-2">
                {installedAgentsLoading ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-4 py-4 text-xs text-[var(--muted-foreground)]">
                    <Loader2 size={13} className="animate-spin" />
                    Loading installed agents…
                  </div>
                ) : (
                  !hasInstalledAgents && (
                    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--secondary)]/35 px-4 py-4 text-center">
                      <p className="text-xs font-medium text-[var(--foreground)]">No agents downloaded yet.</p>
                      <p className="mx-auto mt-1 max-w-sm text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                        Download agents to add maps, Illustrator, Music DJ, Lorebook Keeper, and other optional game
                        features.
                      </p>
                      <button
                        type="button"
                        onClick={openDownloadAgents}
                        className={cn(GAME_SETUP_PRIMARY_BUTTON_CLASS, "mx-auto mt-3 gap-2")}
                      >
                        <Sparkles size={13} />
                        Download Agents
                      </button>
                    </div>
                  )
                )}

                {musicDjInstalled && (
                  <div>
                  <button
                    type="button"
                    onClick={() => setEnableSpotifyDj((prev) => !prev)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                      enableSpotifyDj
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] ring-1 ring-transparent hover:ring-[var(--border)]",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <Music2
                        size={14}
                        className={enableSpotifyDj ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
                      />
                      <div className="min-w-0">
                        <span className="block text-xs font-medium text-[var(--foreground)]">Music DJ</span>
                        <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                          Use the Music DJ for this game instead of local music assets
                        </span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                        enableSpotifyDj ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white transition-transform",
                          enableSpotifyDj && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>

                  {enableSpotifyDj && (
                    <div className="mt-2 space-y-2 rounded-lg bg-[var(--background)]/55 p-3 ring-1 ring-[var(--border)]">
                      <label className="flex flex-col gap-1">
                        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Music source</span>
                        <select
                          value={gameSpotifySourceType}
                          onChange={(event) => {
                            const next = normalizeGameSpotifySourceType(event.target.value);
                            setGameSpotifySourceType(next);
                            if (next !== "playlist") {
                              setGameSpotifyPlaylistId("");
                              setGameSpotifyPlaylistName("");
                            }
                            if (next !== "artist") {
                              setGameSpotifyArtist("");
                            }
                          }}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
                        >
                          {GAME_SPOTIFY_SOURCE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                          {GAME_SPOTIFY_SOURCE_OPTIONS.find((option) => option.id === gameSpotifySourceType)
                            ?.description ?? ""}
                        </span>
                      </label>

                      {gameSpotifySourceType === "playlist" && (
                        <label className="flex flex-col gap-1">
                          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Playlist</span>
                          {spotifyPlaylistsQuery.data?.playlists.length ? (
                            <select
                              value={gameSpotifyPlaylistId}
                              onChange={(event) => {
                                const playlist = spotifyPlaylistsQuery.data?.playlists.find(
                                  (entry) => entry.id === event.target.value,
                                );
                                setGameSpotifyPlaylistId(event.target.value);
                                setGameSpotifyPlaylistName(playlist?.name ?? "");
                              }}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
                            >
                              <option value="">Choose playlist...</option>
                              {spotifyPlaylistsQuery.data.playlists.map((playlist) => {
                                const suffix =
                                  typeof playlist.trackCount === "number"
                                    ? ` (${playlist.trackCount})`
                                    : playlist.owned === false
                                      ? " (followed — unavailable)"
                                      : "";
                                return (
                                  <option key={playlist.id} value={playlist.id}>
                                    {playlist.name}
                                    {suffix}
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            <input
                              value={gameSpotifyPlaylistId}
                              onChange={(event) => {
                                setGameSpotifyPlaylistId(event.target.value);
                                setGameSpotifyPlaylistName("");
                              }}
                              placeholder={
                                spotifyPlaylistsQuery.isFetching ? "Loading playlists..." : "Paste playlist ID"
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                            />
                          )}
                          {spotifyPlaylistsQuery.isError && (
                            <span className="text-[0.5625rem] text-amber-400/90">
                              Connect Spotify in the Music DJ agent to load playlist names.
                            </span>
                          )}
                        </label>
                      )}

                      {gameSpotifySourceType === "artist" && (
                        <label className="flex flex-col gap-1">
                          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Artist</span>
                          <input
                            value={gameSpotifyArtist}
                            onChange={(event) => setGameSpotifyArtist(event.target.value)}
                            placeholder="HOYO-MiX"
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                          />
                        </label>
                      )}
                    </div>
                  )}
                  </div>
                )}

                {lorebookKeeperInstalled && (
                  <button
                    type="button"
                    onClick={() => setEnableLorebookKeeper((prev) => !prev)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                      enableLorebookKeeper
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] ring-1 ring-transparent hover:ring-[var(--border)]",
                    )}
                  >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <BookOpen
                      size={14}
                      className={enableLorebookKeeper ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
                    />
                    <div className="min-w-0">
                      <span className="block text-xs font-medium text-[var(--foreground)]">Lorebook Keeper</span>
                      <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                        Keep a game lorebook updated as the adventure develops
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                      enableLorebookKeeper ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white transition-transform",
                        enableLorebookKeeper && "translate-x-3.5",
                      )}
                    />
                  </div>
                  </button>
                )}

                {illustratorInstalled && (
                  <div>
                  <button
                    type="button"
                    onClick={toggleVisualGeneration}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all",
                      enableSpriteGeneration
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] ring-1 ring-transparent hover:ring-[var(--border)]",
                    )}
                  >
                    <Image
                      size={14}
                      className={enableSpriteGeneration ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
                    />
                    <div className="flex-1">
                      <span className="block text-xs font-medium text-[var(--foreground)]">Illustrator</span>
                      <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                        Generate NPC portraits, location backgrounds, scene images, and optional storyboards
                      </span>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-9 rounded-full p-0.5 transition-colors",
                        enableSpriteGeneration ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white transition-transform",
                          enableSpriteGeneration && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>

                  {/* Image Connection Picker — shown when sprite gen is enabled */}
                  {enableSpriteGeneration && (
                    <div className="mt-2">
                      <label className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                        Image Generation Connection
                      </label>
                      <select
                        value={imageConnectionId ?? ""}
                        onChange={(e) => setImageConnectionId(e.target.value || null)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
                      >
                        <option value="">Select image connection…</option>
                        {imageConnections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.model ? ` — ${c.model}` : ""}
                          </option>
                        ))}
                      </select>
                      {imageConnections.length === 0 && (
                        <p className="mt-1 text-[0.55rem] text-amber-700 dark:text-amber-400/80">
                          No image generation connections found. Add one in Settings → Connections.
                        </p>
                      )}
                      <p className="mt-1 text-[0.55rem] text-[var(--muted-foreground)]">
                        Powers automatic portraits, backgrounds, scene illustrations, and storyboard keyframes.
                      </p>
                      <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                        <div className="flex items-start gap-2">
                          <PanelsTopLeft size={12} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                          <div className="min-w-0">
                            <p className="text-[0.625rem] font-medium text-[var(--foreground)]">Storyboards</p>
                            <p className="text-[0.55rem] leading-relaxed text-[var(--muted-foreground)]">
                              Attach keyframes to GM narration so the floating viewer changes with the current story
                              section.
                            </p>
                            <p className="mt-1 text-[0.55rem] leading-relaxed text-[var(--muted-foreground)]">
                              Recommended: use a strong state-of-the-art image model for storyboard images, or
                              something equivalent to Google Nano Banana 2 Lite.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={toggleStoryboardIllustrations}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-all",
                            enableStoryboardIllustrations
                              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                              : "bg-[var(--background)]/70 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">
                              Automatic Storyboard Illustrations
                            </span>
                            <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                              Low-cost manga keyframe images after completed GM turns
                            </span>
                          </span>
                          <span
                            className={cn(
                              "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                              enableStoryboardIllustrations
                                ? "bg-[var(--primary)]"
                                : "bg-[var(--muted-foreground)]/50",
                            )}
                          >
                            <span
                              className={cn(
                                "block h-4 w-4 rounded-full bg-white transition-transform",
                                enableStoryboardIllustrations && "translate-x-3.5",
                              )}
                            />
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={toggleStoryboardAnimations}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-all",
                            enableStoryboardAnimations
                              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                              : "bg-[var(--background)]/70 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">
                              Automatic Storyboard Animations
                            </span>
                            <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                              Adds video clips to every storyboard keyframe
                            </span>
                          </span>
                          <span
                            className={cn(
                              "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                              enableStoryboardAnimations ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                            )}
                          >
                            <span
                              className={cn(
                                "block h-4 w-4 rounded-full bg-white transition-transform",
                                enableStoryboardAnimations && "translate-x-3.5",
                              )}
                            />
                          </span>
                        </button>
                        {enableStoryboardIllustrations && (
                          <label className="block rounded-lg bg-[var(--background)]/70 px-3 py-2 ring-1 ring-[var(--border)]">
                            <span className="flex items-center justify-between gap-3">
                              <span>
                                <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">
                                  Keyframes per Turn
                                </span>
                                <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                                  Target storyboard shots. Short turns may produce fewer.
                                </span>
                              </span>
                              <span className="min-w-7 rounded-md bg-[var(--secondary)] px-2 py-1 text-center text-xs font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)]">
                                {storyboardKeyframeCount}
                              </span>
                            </span>
                            <input
                              type="range"
                              min={GAME_STORYBOARD_KEYFRAME_COUNT_MIN}
                              max={GAME_STORYBOARD_KEYFRAME_COUNT_MAX}
                              step={1}
                              value={storyboardKeyframeCount}
                              onChange={(event) => setStoryboardKeyframeCount(Number(event.target.value))}
                              className="mt-2 w-full accent-[var(--primary)]"
                              aria-label="Keyframes per Turn"
                            />
                          </label>
                        )}
                        <p className="text-[0.55rem] leading-relaxed text-[var(--muted-foreground)]">
                          Illustrations use the image connection. Animations also need the video connection below and
                          cost much more per turn.
                        </p>
                        {enableStoryboardAnimations && !videoConnectionId && (
                          <p className="text-[0.55rem] leading-relaxed text-amber-700 dark:text-amber-400/80">
                            Choose a Video Generation connection below to save automatic storyboard animations.
                          </p>
                        )}
                      </div>
                      <div className="mt-3 border-t border-[var(--border)] pt-3">
                        <label className="mb-1 flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                          <Film size={11} />
                          Video Generation Connection
                        </label>
                        <select
                          value={videoConnectionId ?? ""}
                          onChange={(e) => setVideoConnectionId(e.target.value || null)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
                        >
                          <option value="">No scene video connection</option>
                          {videoConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                              {c.model ? ` - ${c.model}` : ""}
                            </option>
                          ))}
                        </select>
                        {videoConnections.length === 0 && (
                          <p className="mt-1 text-[0.55rem] text-amber-700 dark:text-amber-400/80">
                            No video generation connections found. Add one in Settings -&gt; Connections.
                          </p>
                        )}
                        <p className="mt-1 text-[0.55rem] text-[var(--muted-foreground)]">
                          Used for manual scene videos and storyboard animations.
                        </p>
                      </div>
                    </div>
                  )}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Widgets Toggle */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <button
                onClick={() => {
                  const nextEnabled = !enableCustomWidgets;
                  setEnableCustomWidgets(nextEnabled);
                  if (!nextEnabled) setManualWidgetSetupEnabled(false);
                }}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <Sparkles
                    size={14}
                    className={enableCustomWidgets ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
                  />
                  <div>
                    <p className="text-xs font-medium text-[var(--foreground)]">Custom HUD Widgets</p>
                    <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                      Model designs custom widgets (health bars, inventories, etc.) for the game HUD
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    "flex h-5 w-8 items-center rounded-full px-0.5 transition-colors",
                    enableCustomWidgets ? "bg-[var(--primary)]" : "bg-[var(--secondary)]",
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full bg-white transition-transform",
                      enableCustomWidgets && "translate-x-3.5",
                    )}
                  />
                </div>
              </button>
              {enableCustomWidgets && (
                <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
                  <GameWidgetFileControls
                    widgets={customHudWidgets}
                    onImport={(widgets) => {
                      setCustomHudWidgets(normalizeGameHudWidgets(widgets));
                      setManualWidgetSetupEnabled(true);
                    }}
                    exportFilename="game-setup-widgets"
                    importSuccessMessage={(count) =>
                      `Imported ${count === 1 ? "1 widget" : `${count} widgets`} for this game setup.`
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setManualWidgetSetupEnabled((enabled) => !enabled)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-all",
                      manualWidgetSetupEnabled
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                    )}
                  >
                    <div>
                      <p className="text-xs font-medium text-[var(--foreground)]">Build Widget Setup</p>
                      <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                        Choose the starting HUD widgets yourself.
                      </p>
                    </div>
                    <div
                      className={cn(
                        "flex h-5 w-8 items-center rounded-full px-0.5 transition-colors",
                        manualWidgetSetupEnabled ? "bg-[var(--primary)]" : "bg-[var(--secondary)]",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white transition-transform",
                          manualWidgetSetupEnabled && "translate-x-3.5",
                        )}
                      />
                    </div>
                  </button>

                  {manualWidgetSetupEnabled && (
                    <GameWidgetSetupEditor widgets={customHudWidgets} onChange={setCustomHudWidgets} />
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            {/* Player Goals */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">Player Goals</label>
              <textarea
                value={playerGoals}
                onChange={(e) => setPlayerGoals(e.target.value)}
                placeholder="What do you want to achieve?"
                rows={3}
                className="w-full resize-none rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {GOAL_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => applySuggestion(setPlayerGoals, s)}
                    className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
                  >
                    {s === "Surprise me!" && <Sparkles size={9} />}
                    {s}
                  </button>
                ))}
              </div>
              <LearnedOptionChips
                options={learnedGoals}
                expanded={expandedLearnedOptions.goals}
                onToggleExpanded={() => toggleLearnedOptions("goals")}
                onSelect={setPlayerGoals}
                onForget={(value) => forgetGameSetupOption("goals", value)}
              />
            </div>

            {/* Preferences */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                Additional Preferences
              </label>
              <textarea
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder="Any extra details for the GM?"
                rows={3}
                className="w-full resize-none rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {PREFERENCE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPreferences((prev) => (prev ? `${prev}, ${s.toLowerCase()}` : s))}
                    className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <LearnedOptionChips
                options={learnedPreferences}
                expanded={expandedLearnedOptions.preferences}
                onToggleExpanded={() => toggleLearnedOptions("preferences")}
                onSelect={setPreferences}
                onForget={(value) => forgetGameSetupOption("preferences", value)}
              />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            {/* Lorebooks */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                <BookOpen size={12} className="mr-1 inline" />
                Lorebooks
              </label>
              <p className="mb-2 text-[0.55rem] text-[var(--muted-foreground)]">
                Attach lorebooks to inject world lore, character info, and other context into game generations.
              </p>

              {/* Active lorebooks */}
              {activeLorebookIds.length > 0 && (
                <div className="mb-2 flex flex-col gap-1">
                  {activeLorebookIds.map((lbId) => {
                    const lb = lorebooks.find((l) => l.id === lbId);
                    if (!lb) return null;
                    return (
                      <div
                        key={lb.id}
                        className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-1.5 ring-1 ring-[var(--primary)]/30"
                      >
                        <BookOpen size={12} className="text-[var(--primary)]" />
                        <span className="flex-1 truncate text-xs">{lb.name}</span>
                        <button
                          onClick={() => toggleLorebook(lb.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                          title="Remove"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Search + add */}
              <div className="overflow-hidden rounded-lg ring-1 ring-[var(--border)] bg-[var(--card)]">
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5">
                  <Search size={12} className="text-[var(--muted-foreground)]" />
                  <input
                    value={lbSearch}
                    onChange={(e) => setLbSearch(e.target.value)}
                    placeholder="Search lorebooks…"
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
                  />
                </div>
                <div className="max-h-28 overflow-y-auto">
                  {availableLorebooks.map((lb) => (
                    <button
                      key={lb.id}
                      onClick={() => toggleLorebook(lb.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-all hover:bg-[var(--accent)]"
                    >
                      <BookOpen size={12} className="text-[var(--muted-foreground)]" />
                      <span className="flex-1 truncate text-xs">{lb.name}</span>
                      <Plus size={12} className="text-[var(--muted-foreground)]" />
                    </button>
                  ))}
                  {availableLorebooks.length === 0 && (
                    <p className="px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
                      {lorebooks.filter((lb) => !activeLorebookIds.includes(lb.id)).length === 0
                        ? "All lorebooks already added."
                        : "No matches."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {hierarchicalMapsInstalled && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                  <MapIcon size={12} className="mr-1 inline" />
                  Hierarchical world map
                </label>
                <button
                type="button"
                aria-pressed={draftSpatialMap}
                onClick={() => setDraftSpatialMap((enabled) => !enabled)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                  draftSpatialMap
                    ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--secondary)] ring-1 ring-transparent hover:ring-[var(--border)]",
                )}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <MapIcon
                    size={14}
                    className={draftSpatialMap ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-[var(--foreground)]">Draft with AI</span>
                    <span className="block text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
                      After setup, AI builds nested regions and places for you to review.
                    </span>
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                    draftSpatialMap ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                  )}
                >
                  <span
                    className={cn(
                      "block h-4 w-4 rounded-full bg-white transition-transform",
                      draftSpatialMap && "translate-x-3.5",
                    )}
                  />
                </span>
                </button>

                {draftSpatialMap && (
                  <div className="mt-2 space-y-3 rounded-lg bg-[var(--background)]/55 p-3 ring-1 ring-[var(--border)]">
                    <div>
                      <label
                        htmlFor="game-setup-spatial-map-instructions"
                        className="text-[0.625rem] font-medium text-[var(--foreground)]"
                      >
                        What should this world include?
                      </label>
                      <textarea
                        id="game-setup-spatial-map-instructions"
                        value={spatialMapInstructions}
                        onChange={(event) => setSpatialMapInstructions(event.target.value)}
                        maxLength={4_000}
                        rows={3}
                        placeholder="A misty coastal city with a harbor, market, haunted inn, lighthouse, and sewers beneath the old district."
                        className="mt-2 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
                      />
                      <p className="mt-1 text-[0.5625rem] leading-relaxed text-[var(--muted-foreground)]">
                        Optional. If left blank, Marinara builds from the existing game setup.
                      </p>
                    </div>

                  <fieldset>
                    <legend className="text-[0.625rem] font-medium text-[var(--foreground)]">Map size</legend>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {SPATIAL_MAP_DRAFT_SIZE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={spatialMapDraftSize === option.value}
                          onClick={() => setSpatialMapDraftSize(option.value)}
                          className={cn(
                            "min-h-12 rounded-lg px-2 py-2 text-left transition-colors",
                            spatialMapDraftSize === option.value
                              ? "bg-[var(--primary)]/12 text-[var(--foreground)] ring-1 ring-[var(--primary)]/35"
                              : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]",
                          )}
                        >
                          <span className="block text-[0.6875rem] font-semibold">{option.label}</span>
                          <span className="mt-0.5 block text-[0.55rem] leading-tight">{option.detail}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="text-[0.625rem] font-medium text-[var(--foreground)]">Build from</legend>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {([
                        { value: "setup", label: "Game setup" },
                        { value: "lore_strict", label: "Strict lore" },
                        { value: "lore_expand", label: "Lore + AI" },
                      ] as const).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={spatialMapGroundingMode === option.value}
                          disabled={option.value !== "setup" && activeLorebookIds.length === 0}
                          onClick={() => setSpatialMapGroundingMode(option.value)}
                          className={cn(
                            "min-h-11 rounded-lg px-2 py-2 text-left text-[0.625rem] font-semibold ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                            spatialMapGroundingMode === option.value
                              ? "bg-[var(--primary)]/12 text-[var(--foreground)] ring-[var(--primary)]/35"
                              : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)]",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[0.5625rem] leading-relaxed text-[var(--muted-foreground)]">
                      {spatialMapGroundingMode === "setup"
                        ? "Uses the generated game world and party."
                        : spatialMapGroundingMode === "lore_strict"
                          ? `Only creates places supported by the ${activeLorebookIds.length} selected lorebook${activeLorebookIds.length === 1 ? "" : "s"}.`
                          : `Uses the ${activeLorebookIds.length} selected lorebook${activeLorebookIds.length === 1 ? "" : "s"} as canon and may add fitting places.`}
                    </p>
                  </fieldset>

                  <p className="text-[0.5625rem] leading-relaxed text-[var(--muted-foreground)]">
                    The draft stays disabled until you review, apply, enable, and save it in the map editor.
                  </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {step === 5 && (
          <>
            {/* Start Muted */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <button
                onClick={() => setStartMuted(!startMuted)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2">
                  {startMuted ? (
                    <VolumeX size={14} className="text-[var(--muted-foreground)]" />
                  ) : (
                    <Volume2 size={14} className="text-[var(--primary)]" />
                  )}
                  <div>
                    <p className="text-xs font-medium text-[var(--foreground)]">Start Muted</p>
                    <p className="text-[0.55rem] text-[var(--muted-foreground)]">Begin the game with all audio muted</p>
                  </div>
                </div>
                <div
                  className={cn(
                    "flex h-5 w-8 items-center rounded-full px-0.5 transition-colors",
                    startMuted ? "bg-[var(--primary)]" : "bg-[var(--secondary)]",
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full bg-white transition-transform",
                      startMuted && "translate-x-3.5",
                    )}
                  />
                </div>
              </button>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                <Sparkles size={12} />
                Game Presentation
              </label>
              <select
                value={gamePresentation}
                onChange={(event) => setGamePresentation(event.target.value === "anime" ? "anime" : "standard")}
                className={GAME_SETUP_INPUT_CLASS}
              >
                <option value="standard">Standard</option>
                <option value="anime">Storyboard Optimized</option>
              </select>
              <p className="mt-1 text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
                {gamePresentation === "anime"
                  ? "Coordinates the game narration, storyboard planning, image formatting, and video formatting without enabling media generation or changing your connections."
                  : "Uses the standard flexible Game Mode narration and media prompts."}
              </p>
              {gamePresentation === "anime" && (
                <dl className="mt-2 grid gap-1.5 rounded-lg bg-[var(--secondary)]/55 p-2 ring-1 ring-[var(--border)] sm:grid-cols-2">
                  {[
                    ["Game Prompt", "Storyboard Game Prompt"],
                    ["Animation Planner", "Comic Page Animation"],
                    ["Storyboard Illustration Prompt", "Storyboard Illustration"],
                    ["Storyboard Video Prompt", "Comic Page Video"],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-md bg-[var(--background)]/65 px-2 py-1.5">
                      <dt className="text-[0.525rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        {label}
                      </dt>
                      <dd className="truncate text-[0.625rem] font-semibold text-[var(--foreground)]">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                <Feather size={12} />
                Base Prompt Preset
              </label>
              <select
                value={promptPresetId ?? ""}
                onChange={(event) => handlePromptPresetChange(event.target.value || null)}
                className={GAME_SETUP_INPUT_CLASS}
              >
                <option value="">None</option>
                {promptPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
                {gamePresentation === "anime"
                  ? "The Storyboard Game Prompt replaces the selected preset's Game prompt. Other preset settings remain available."
                  : "Uses the Game mode prompt from the selected preset unless the custom GM prompt below is enabled."}
              </p>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                <Feather size={12} />
                Extra Instructions
              </label>
              <textarea
                value={gameSpecialInstructions}
                onChange={(event) => setGameSpecialInstructions(event.target.value)}
                placeholder="Write in the style of Terry Pratchett."
                rows={4}
                maxLength={2000}
                className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-all placeholder:text-[var(--muted-foreground)]/50 focus:ring-[var(--primary)]/40"
              />
              <div className="mt-1 flex justify-end text-[0.5625rem] text-[var(--muted-foreground)]">
                {gameSpecialInstructions.length}/2000
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <button
                type="button"
                onClick={() => setCustomGamePromptEnabled((enabled) => !enabled)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Feather
                    size={14}
                    className={customGamePromptEnabled ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--foreground)]">GM Prompt</p>
                    <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                      {customGamePromptEnabled
                        ? gameSystemPromptEdited
                          ? "Custom prompt will override the selected prompt"
                          : "Previewing the selected prompt; edit it to override"
                        : gamePresentation === "anime"
                          ? "Using Storyboard Game Prompt"
                          : selectedPromptPresetName
                          ? `Using ${selectedPromptPresetName}`
                          : "Using default game prompt"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                    {customGamePromptEnabled
                      ? gameSystemPromptEdited
                        ? "Custom"
                        : "Preview"
                      : gamePresentation === "anime"
                        ? "Storyboard"
                        : selectedPromptPresetName
                          ? "Preset"
                          : "Default"}
                  </span>
                  <div
                    className={cn(
                      "flex h-5 w-8 items-center rounded-full px-0.5 transition-colors",
                      customGamePromptEnabled ? "bg-[var(--primary)]" : "bg-[var(--secondary)]",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-white transition-transform",
                        customGamePromptEnabled && "translate-x-3.5",
                      )}
                    />
                  </div>
                </div>
              </button>

              {customGamePromptEnabled && (
                <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                  <textarea
                    value={gameSystemPromptDraft}
                    onChange={(event) => {
                      setGameSystemPromptDraft(event.target.value);
                      setGameSystemPromptEdited(true);
                    }}
                    rows={10}
                    maxLength={16000}
                    className="max-h-72 min-h-48 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-all placeholder:text-[var(--muted-foreground)]/50 focus:ring-[var(--primary)]/40"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
                      Leaving this unchanged keeps the selected presentation or preset.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setGameSystemPromptDraft(effectiveGameSystemPrompt);
                        setGameSystemPromptEdited(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      <RotateCcw size={11} />
                      Reset to selected
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
              </div>
            </div>

            <div className="shrink-0 border-t border-[var(--border)]/70 px-5 py-3">
              {isLoading && (
                <div className="mb-3">
                  <div className="flex items-center justify-between gap-3 text-[0.6875rem]">
                    <span className="font-medium text-[var(--foreground)]" role="status" aria-live="polite">
                      {isDraftingMap
                        ? "The world is ready. Now drafting its map for your review."
                        : "Hold on tight, the game is being generated right now!"}
                    </span>
                    <span aria-hidden="true" className="shrink-0 tabular-nums text-[var(--muted-foreground)]">
                      {generationElapsedSeconds}s
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]/60"
                    role="progressbar"
                    aria-label={isDraftingMap ? "Drafting hierarchical world map" : "Generating game world"}
                  >
                    <motion.div
                      className="h-full w-2/5 rounded-full bg-[var(--primary)]"
                      animate={prefersReducedMotion ? { x: 0 } : { x: ["-110%", "260%"] }}
                      transition={
                        prefersReducedMotion
                          ? undefined
                          : { duration: 1.35, ease: [0.16, 1, 0.3, 1], repeat: Infinity }
                      }
                    />
                  </div>
                </div>
              )}
              <div className="mb-3 flex items-center justify-center gap-1.5">
                {steps.map((item, i) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-label={`Go to ${item.title}`}
                    aria-current={i === step ? "step" : undefined}
                    disabled={isLoading || i >= step}
                    onClick={() => {
                      if (i < step) setStep(i);
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300 disabled:cursor-default",
                      i === step
                        ? "w-5 bg-[var(--primary)]"
                        : i < step
                          ? "w-3 bg-[var(--primary)]/45 hover:bg-[var(--primary)]/70"
                          : "w-1.5 bg-[var(--muted-foreground)]/25",
                    )}
                  />
                ))}
              </div>

              {step === steps.length - 1 && !canStart && (
                <p className="mb-3 text-center text-[0.6875rem] text-[var(--destructive)]">
                  Select a connection on the first step before starting.
                </p>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={step === 0 ? onCancel : () => setStep(step - 1)}
                  disabled={isLoading}
                  className={cn(GAME_SETUP_GHOST_BUTTON_CLASS, "disabled:cursor-wait disabled:opacity-40")}
                >
                  <ArrowLeft size={14} />
                  {step === 0 ? "Cancel" : "Back"}
                </button>

                {step < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    disabled={isLoading}
                    className={GAME_SETUP_PRIMARY_BUTTON_CLASS}
                  >
                    Next
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={isLoading || !canStart}
                    className={GAME_SETUP_PRIMARY_BUTTON_CLASS}
                    title={!canStart ? "Select a connection on the first step" : undefined}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {isDraftingMap ? "Drafting Map…" : "Generating World…"}
                      </>
                    ) : (
                      <>
                        <Wand2 size={14} />
                        Start Game
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
