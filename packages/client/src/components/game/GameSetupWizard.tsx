// ──────────────────────────────────────────────
// Game: Setup Wizard (initial game setup modal)
// ──────────────────────────────────────────────
import {
  lazy,
  Suspense,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type ReactNode,
} from "react";
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
  Music,
  BookOpen,
  Music2,
  Volume2,
  VolumeX,
  Feather,
  Map as MapIcon,
  RotateCcw,
  FolderOpen,
  FileUp,
  Download,
  CheckCircle2,
  ChevronDown,
  Timer,
} from "lucide-react";
import {
  ANIME_GAME_PROMPT_TEMPLATE_ID,
  ANIME_GAME_SYSTEM_PROMPT,
  DEFAULT_GAME_SYSTEM_PROMPT,
  type CharacterGroup,
  type GameInitialSetupLabels,
  type GameSetupConfig,
  type GameGmMode,
  type GameSpotifySourceType,
  normalizeSpotifySourceType,
  resolveGameSpatialMapDraftOptions,
  type GenerationParameters,
  type SpatialMapGroundingMode,
  type SpatialMapDraftSize,
  type GameCombatStyle,
  type Persona,
  type AvatarCrop,
} from "@marinara-engine/shared";
import { getCharacterTitle } from "../../lib/character-display";
import { api } from "../../lib/api-client";
import { cn, getAvatarCropStyle } from "../../lib/utils";
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
import {
  buildGameSetupShareFile,
  parseGameSetupShareFileJson,
  resolveGameSetupImport,
} from "../../lib/game-setup-share";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";
import {
  filterAudioGenerationConnections,
  filterLanguageGenerationConnections,
  isConnectionFlagTrue,
} from "../../lib/connection-filters";
import { useTranslation as useUiTranslation } from "react-i18next";
import { CapabilityElement } from "../capabilities/CapabilityElement";

const GameAssetsBrowserView = lazy(() =>
  import("../game-assets/GameAssetsBrowserView").then((module) => ({ default: module.GameAssetsBrowserView })),
);

interface CapabilitySetupSelection {
  kind: "template" | "shared-world";
  id: string;
  label: string;
  payload: unknown;
}

function normalizeCapabilitySetupSelectionKind(
  candidate: Record<string, unknown> | null,
): CapabilitySetupSelection["kind"] | null {
  if (candidate?.kind === "shared-world") return "shared-world";
  if (candidate?.kind === undefined || candidate.kind === "template") return "template";
  return null;
}

interface GameSetupWizardProps {
  /** Optional block rendered with the other pre-start choices, used to offer installed game experiences. */
  experiencesSlot?: ReactNode;
  onComplete: (
    config: GameSetupConfig,
    preferences: string,
    connections: { gmConnectionId?: string; shareLabels?: GameInitialSetupLabels },
    gameName?: string,
    mapPlan?:
      | { mode: "manual" }
      | { mode: "template"; selection: CapabilitySetupSelection }
      | { mode: "shared-world"; selection: CapabilitySetupSelection }
      | {
          mode: "ai";
          size: SpatialMapDraftSize;
          targetLocationCount: number;
          groundingMode: SpatialMapGroundingMode;
          sourceLorebookIds: string[];
          instructions?: string;
        },
  ) => void;
  onCancel: () => void;
  isLoading: boolean;
  isDraftingMap: boolean;
  isLinkingSharedWorld: boolean;
  characters: Array<{
    id: string;
    name: string;
    comment?: string | null;
    avatarUrl?: string | null;
    avatarCrop?: AvatarCrop | null;
  }>;
  initialPartyCharacterIds?: string[];
}

interface WizardConnection {
  id: string;
  name: string;
  model?: string;
  provider?: string;
  imageService?: string | null;
  videoService?: string | null;
  audioSource?: string | null;
  audioSoundEffects?: boolean | string;
  audioMusic?: boolean | string;
  defaultParameters?: string | null;
  isDefault?: boolean | string;
  defaultForAgents?: boolean | string;
  fallbackForAgents?: boolean | string;
  profileImportReviewRequired?: boolean | string;
}

function CharacterAvatar({
  character,
  className = "h-6 w-6 rounded-full",
}: {
  character: {
    name: string;
    avatarUrl?: string | null;
    avatarCrop?: AvatarCrop | null;
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

function getPersonaTitle(persona: Persona): string | null {
  const title = persona.comment.trim();
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
  targetLocationCount: number;
  label: string;
  detail: string;
}> = [
  { value: "small", targetLocationCount: 8, label: "Small", detail: "About 8 places" },
  { value: "medium", targetLocationCount: 16, label: "Medium", detail: "About 16 places" },
  { value: "large", targetLocationCount: 28, label: "Large", detail: "About 28 places" },
];
const SPATIAL_CUSTOM_TARGET_LOCATION_LIMIT = 40;

function normalizeSpatialMapTargetLocationCount(value: string): number | null {
  const parsed = Number(value);
  if (!value.trim() || !Number.isInteger(parsed) || !Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(SPATIAL_CUSTOM_TARGET_LOCATION_LIMIT, parsed));
}

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
  const { t: localizeUi } = useUiTranslation();
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
                aria-label={localizeUi("ui.game.learnedoptionchips.forgetValue1", { value1: option })}
                title={localizeUi("ui.game.learnedoptionchips.forgetThisOption")}
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
          aria-expanded={expanded}
          className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
        >
          {expanded
            ? localizeUi("ui.game.learnedoptionchips.showLess")
            : localizeUi("ui.game.learnedoptionchips.value1More", { value1: hiddenCount })}
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
  experiencesSlot,
  onComplete,
  onCancel,
  isLoading,
  isDraftingMap,
  isLinkingSharedWorld,
  characters,
  initialPartyCharacterIds = [],
}: GameSetupWizardProps) {
  const { t: localizeUi } = useUiTranslation();
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
  const [partyCharacterIds, setPartyCharacterIds] = useState<string[]>(() =>
    Array.from(new Set(initialPartyCharacterIds.filter((id) => characters.some((character) => character.id === id)))),
  );
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
  const [gameImageDynamicPromptEnabled, setGameImageDynamicPromptEnabled] = useState(false);
  const [enableAgents, setEnableAgents] = useState(false);
  const [enableQuickTimeEvents, setEnableQuickTimeEvents] = useState(true);
  const [enableSpotifyDj, setEnableSpotifyDj] = useState(false);
  const [gameSpotifySourceType, setGameSpotifySourceType] = useState<GameSpotifySourceType>("liked");
  const [gameSpotifyPlaylistId, setGameSpotifyPlaylistId] = useState("");
  const [gameSpotifyPlaylistName, setGameSpotifyPlaylistName] = useState("");
  const [gameSpotifyArtist, setGameSpotifyArtist] = useState("");
  const [enableLorebookKeeper, setEnableLorebookKeeper] = useState(false);
  const [imageConnectionId, setImageConnectionId] = useState<string | null>(null);
  const [videoConnectionId, setVideoConnectionId] = useState<string | null>(null);
  const [audioConnectionId, setAudioConnectionId] = useState<string | null>(null);
  const [enableGameSoundEffects, setEnableGameSoundEffects] = useState(true);
  const [enableGameMusic, setEnableGameMusic] = useState(true);
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
  const [gamePresentation, setGamePresentation] = useState<"standard" | "anime">("standard");
  const [customGamePromptEnabled, setCustomGamePromptEnabled] = useState(false);
  const [gameSystemPromptDraft, setGameSystemPromptDraft] = useState(DEFAULT_GAME_SYSTEM_PROMPT);
  const [gameSystemPromptEdited, setGameSystemPromptEdited] = useState(false);
  const [language, setLanguage] = useState("English");
  const [startMuted, setStartMuted] = useState(false);
  const [adjustGameAssetsOpen, setAdjustGameAssetsOpen] = useState(false);
  const [draftSpatialMap, setDraftSpatialMap] = useState(false);
  const [manualSpatialMap, setManualSpatialMap] = useState(false);
  const [templateSpatialMap, setTemplateSpatialMap] = useState(false);
  const [spatialTemplatePickerOpen, setSpatialTemplatePickerOpen] = useState(false);
  const [spatialTemplateSelection, setSpatialTemplateSelection] = useState<CapabilitySetupSelection | null>(null);
  const [spatialMapDraftSize, setSpatialMapDraftSize] = useState<SpatialMapDraftSize>("medium");
  const [spatialMapTargetLocationCount, setSpatialMapTargetLocationCount] = useState(16);
  const [spatialMapTargetLocationCountInput, setSpatialMapTargetLocationCountInput] = useState("16");
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
  const importedArtStyleSettingsRef = useRef<Pick<
    GameSetupConfig,
    "artStylePrompt" | "generatedArtStylePrompt" | "useCampaignArtStyle" | "imageStyleProfileId"
  > | null>(null);

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

  const connections = useMemo(() => (connectionsList as WizardConnection[]) ?? [], [connectionsList]);
  // GM and scene-helper pickers offer language connections only; media
  // connections have their own dedicated pickers further into the wizard.
  const languageConnections = useMemo(() => filterLanguageGenerationConnections(connections), [connections]);
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
  // Quarantined (review-required) imports are refused by the server's
  // resolution, so they must not be offered or previewed here either.
  const audioConnections = useMemo(() => filterAudioGenerationConnections(connections), [connections]);
  const preferredImageConnectionId = useMemo(() => getPreferredConnectionId(imageConnections), [imageConnections]);
  // "Use default" previews the runtime resolution (category default, else its
  // fallback), extended by a first-connection convenience step. When the
  // preview relied on that extra step, buildSetupConfig PINS the previewed
  // row's id into the game so runtime resolution agrees with what this screen
  // showed — the server and GameSurface never pick "first audio row" on
  // their own.
  const audioCategoryDefaultId = useMemo(
    () =>
      audioConnections.find((connection) => isConnectionFlagTrue(connection.defaultForAgents))?.id ??
      audioConnections.find((connection) => isConnectionFlagTrue(connection.fallbackForAgents))?.id ??
      null,
    [audioConnections],
  );
  const preferredAudioConnectionId = audioCategoryDefaultId ?? audioConnections[0]?.id ?? null;
  const resolvedAudioConnection = useMemo(
    () =>
      audioConnections.find((connection) => connection.id === (audioConnectionId ?? preferredAudioConnectionId)) ??
      null,
    [audioConnections, audioConnectionId, preferredAudioConnectionId],
  );
  const audioConnectionSupportsSfx =
    resolvedAudioConnection != null &&
    (resolvedAudioConnection.audioSource ?? "elevenlabs") === "elevenlabs" &&
    isConnectionFlagTrue(resolvedAudioConnection.audioSoundEffects);
  const audioConnectionSupportsMusic =
    resolvedAudioConnection != null &&
    (resolvedAudioConnection.audioSource ?? "elevenlabs") === "elevenlabs" &&
    isConnectionFlagTrue(resolvedAudioConnection.audioMusic);
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
  const selectedPromptPresetName = useMemo(() => selectedPromptPreset?.name ?? null, [selectedPromptPreset]);
  const effectiveGameSystemPrompt = useMemo(
    () =>
      gamePresentation === "anime"
        ? ANIME_GAME_SYSTEM_PROMPT
        : selectedPromptPreset?.gamePrompt?.trim() || DEFAULT_GAME_SYSTEM_PROMPT,
    [gamePresentation, selectedPromptPreset?.gamePrompt],
  );
  const personas = useMemo(() => personasList ?? [], [personasList]);
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
    if (!hierarchicalMapsInstalled) {
      setDraftSpatialMap(false);
      setManualSpatialMap(false);
      setTemplateSpatialMap(false);
      setSpatialTemplateSelection(null);
      setSpatialTemplatePickerOpen(false);
    }
    if (!musicDjInstalled) setEnableSpotifyDj(false);
    if (!lorebookKeeperInstalled) setEnableLorebookKeeper(false);
    if (!illustratorInstalled) {
      setEnableSpriteGeneration(false);
    }
  }, [
    hierarchicalMapsInstalled,
    illustratorInstalled,
    installedAgentsLoading,
    lorebookKeeperInstalled,
    musicDjInstalled,
  ]);

  const handleSpatialTemplateSelected = useCallback(
    (selection: unknown) => {
      const candidate =
        selection && typeof selection === "object" && !Array.isArray(selection)
          ? (selection as Record<string, unknown>)
          : null;
      const kind = normalizeCapabilitySetupSelectionKind(candidate);
      if (
        !candidate ||
        !kind ||
        typeof candidate.id !== "string" ||
        !candidate.id.trim() ||
        typeof candidate.label !== "string" ||
        !candidate.label.trim() ||
        !("payload" in candidate)
      ) {
        toast.error(localizeUi("ui.game.gamesetupwizard.theSelectedSavedMapCouldNotBeRead"));
        return;
      }
      setSpatialTemplateSelection({
        kind,
        id: candidate.id,
        label: candidate.label,
        payload: candidate.payload,
      });
      setTemplateSpatialMap(true);
      setDraftSpatialMap(false);
      setManualSpatialMap(false);
      setSpatialTemplatePickerOpen(false);
    },
    [localizeUi],
  );

  const handlePromptPresetChange = useCallback((presetId: string | null) => {
    setPromptPresetTouched(true);
    setPromptPresetId(presetId);
  }, []);

  const spatialMapTargetLocationCountValid =
    normalizeSpatialMapTargetLocationCount(spatialMapTargetLocationCountInput) !== null;
  const canStart =
    !!gmConnectionId &&
    (!enableAgents || !hierarchicalMapsInstalled || !draftSpatialMap || spatialMapTargetLocationCountValid);
  const canStartMessage = !gmConnectionId
    ? localizeUi("ui.game.gamesetupwizard.selectAConnectionOnTheFirstStepBeforeStarting")
    : !spatialMapTargetLocationCountValid && enableAgents && hierarchicalMapsInstalled && draftSpatialMap
      ? localizeUi("ui.game.gamesetupwizard.chooseAnyWholeNumberFrom1ToValue1Places", {
          value1: SPATIAL_CUSTOM_TARGET_LOCATION_LIMIT,
        })
      : null;
  const normalizedLanguage = normalizeGameLanguage(language);
  const illustratorEnabled = enableAgents && illustratorInstalled && enableSpriteGeneration;
  const musicDjEnabled = enableAgents && musicDjInstalled && enableSpotifyDj;
  const lorebookKeeperEnabled = enableAgents && lorebookKeeperInstalled && enableLorebookKeeper;

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
      const importedStoryboardGamePrompt = config.gameGmPromptTemplateId === ANIME_GAME_PROMPT_TEMPLATE_ID;
      const importedPromptPreset = promptPresets.find((preset) => preset.id === config.promptPresetId) ?? null;
      const importedCustomPrompt = config.gameSystemPrompt?.trim() ?? "";
      const importedBasePrompt = importedStoryboardGamePrompt
        ? ANIME_GAME_SYSTEM_PROMPT
        : importedPromptPreset?.gamePrompt?.trim() || DEFAULT_GAME_SYSTEM_PROMPT;
      const importedWidgets = normalizeGameHudWidgets(config.customHudWidgets ?? []);
      const importedGenerationParameters =
        imported.effectiveGenerationParameters ?? config.generationParameters ?? null;
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
        importedParameterOverrides && (imported.gmConnectionId === null || imported.gmConnectionId !== gmConnectionId)
          ? importedParameterOverrides
          : null;
      importedArtStyleSettingsRef.current = {
        artStylePrompt: config.artStylePrompt,
        generatedArtStylePrompt: config.generatedArtStylePrompt,
        useCampaignArtStyle: config.useCampaignArtStyle,
        imageStyleProfileId: config.imageStyleProfileId,
      };
      setUseLocalScene(
        sidecarAvailable && !config.sceneConnectionId && shareFile.setup.connections?.scene?.provider === "local",
      );
      setSceneConnectionId(config.sceneConnectionId ?? null);

      const visualGenerationEnabled =
        config.enableSpriteGeneration === true ||
        config.gameStoryboardAutoIllustrationsEnabled === true ||
        config.gameStoryboardAutoGenerationEnabled === true;
      setEnableAgents(
        config.enableAgents === true ||
          visualGenerationEnabled ||
          config.enableSpotifyDj === true ||
          config.enableLorebookKeeper === true ||
          config.gameWorldMapMode === "hierarchical" ||
          Boolean(config.spatialMapInstructions?.trim()),
      );
      setEnableQuickTimeEvents(config.enableQuickTimeEvents !== false);
      setEnableSpriteGeneration(visualGenerationEnabled);
      setGameImageDynamicPromptEnabled(config.gameImageDynamicPromptEnabled === true);
      setImageConnectionId(config.imageConnectionId ?? null);
      setVideoConnectionId(config.videoConnectionId ?? null);
      setAudioConnectionId(config.audioConnectionId ?? null);
      setEnableGameSoundEffects(config.enableGameSoundEffects !== false);
      setEnableGameMusic(config.enableGameMusic !== false);
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
      setGameSpotifySourceType(normalizeSpotifySourceType(config.spotifySourceType));
      setGameSpotifyPlaylistId(config.spotifyPlaylistId?.trim() || "");
      setGameSpotifyPlaylistName(config.spotifyPlaylistName?.trim() || "");
      setGameSpotifyArtist(config.spotifyArtist?.trim() || "");
      setEnableLorebookKeeper(config.enableLorebookKeeper === true);
      setPromptPresetTouched(true);
      setPromptPresetId(config.promptPresetId ?? null);
      setGamePresentation(importedStoryboardGamePrompt ? "anime" : "standard");
      setCustomGamePromptEnabled(Boolean(importedCustomPrompt));
      setGameSystemPromptDraft(importedCustomPrompt || importedBasePrompt);
      setGameSystemPromptEdited(Boolean(importedCustomPrompt));
      setGameSpecialInstructions(config.gameSpecialInstructions?.trim() || "");
      const importedSpatialMapInstructions = config.spatialMapInstructions?.trim() || "";
      const importedSpatialMapDraftOptions = resolveGameSpatialMapDraftOptions(
        config.spatialMapDraftSize,
        config.spatialMapTargetLocationCount,
      );
      setDraftSpatialMap(
        hierarchicalMapsInstalled &&
          (config.gameWorldMapMode === "hierarchical" || Boolean(importedSpatialMapInstructions)),
      );
      setManualSpatialMap(false);
      setTemplateSpatialMap(false);
      setSpatialTemplateSelection(null);
      setSpatialTemplatePickerOpen(false);
      setSpatialMapDraftSize(importedSpatialMapDraftOptions.size);
      setSpatialMapTargetLocationCount(importedSpatialMapDraftOptions.targetLocationCount);
      setSpatialMapTargetLocationCountInput(String(importedSpatialMapDraftOptions.targetLocationCount));
      setSpatialMapGroundingMode(config.spatialMapGroundingMode ?? "setup");
      setSpatialMapInstructions(importedSpatialMapInstructions);

      const warningCount = imported.warnings.length;
      setImportedSetupNotice(
        warningCount > 0
          ? `${file.name} loaded. ${warningCount} local ${warningCount === 1 ? "selection needs" : "selections need"} review.`
          : `${file.name} loaded. Review the steps, then start the new game.`,
      );
      toast.success(localizeUi("ui.game.gamesetupwizard.gameModeSetupImported"));
      if (warningCount > 0) {
        toast.warning(localizeUi("ui.game.gamesetupwizard.someLocalSelectionsCouldNotBeRestored"), {
          description: imported.warnings.join(" "),
        });
      }
    } catch (error) {
      setImportedSetupNotice(null);
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi("ui.game.gamesetupwizard.couldNotImportThisGameModeSetupFile"),
      );
    }
  };

  const buildSetupConfig = (): GameSetupConfig => {
    const trimmedGameSystemPrompt = gameSystemPromptDraft.trim();
    const customGameSystemPrompt =
      customGamePromptEnabled && trimmedGameSystemPrompt && trimmedGameSystemPrompt !== effectiveGameSystemPrompt.trim()
        ? trimmedGameSystemPrompt
        : null;
    const trimmedGameSpecialInstructions = gameSpecialInstructions.trim();

    return {
      genre: genres.join(", ") || "Fantasy",
      setting: setting || `A ${(genres[0] ?? "fantasy").toLowerCase()} world`,
      tone: tones.join(", ") || "Heroic",
      difficulty,
      combatStyle,
      spatialMapInstructions:
        enableAgents && hierarchicalMapsInstalled && draftSpatialMap
          ? spatialMapInstructions.trim() || undefined
          : undefined,
      gameWorldMapMode:
        enableAgents && hierarchicalMapsInstalled && (draftSpatialMap || manualSpatialMap || templateSpatialMap)
          ? "hierarchical"
          : "standard",
      spatialMapDraftSize:
        enableAgents && hierarchicalMapsInstalled && draftSpatialMap ? spatialMapDraftSize : undefined,
      spatialMapTargetLocationCount:
        enableAgents && hierarchicalMapsInstalled && draftSpatialMap ? spatialMapTargetLocationCount : undefined,
      spatialMapGroundingMode:
        enableAgents && hierarchicalMapsInstalled && draftSpatialMap ? spatialMapGroundingMode : undefined,
      rating,
      gmMode,
      gmCharacterId: gmMode === "character" && gmCharacterId ? gmCharacterId : undefined,
      partyCharacterIds,
      playerGoals: playerGoals || "Have an adventure",
      personaId: personaId ?? undefined,
      sceneConnectionId: sceneModelValue && sceneModelValue !== "local" ? sceneModelValue : undefined,
      enableAgents: enableAgents || undefined,
      enableQuickTimeEvents: enableQuickTimeEvents ? undefined : false,
      enableSpriteGeneration: illustratorEnabled,
      gameImageDynamicPromptEnabled: illustratorEnabled && gameImageDynamicPromptEnabled,
      imageConnectionId: illustratorEnabled && imageConnectionId ? imageConnectionId : undefined,
      videoConnectionId: illustratorEnabled && videoConnectionId ? videoConnectionId : undefined,
      // With no category default/fallback set, "Use default" previewed the
      // first audio row — pin it so runtime resolution matches this screen.
      audioConnectionId:
        audioConnectionId ||
        (!audioCategoryDefaultId && resolvedAudioConnection ? resolvedAudioConnection.id : undefined),
      // Persist the DISPLAYED toggle state: a toggle grayed out by a
      // non-capable connection reads OFF, so OFF is what the game records.
      enableGameSoundEffects: enableGameSoundEffects && audioConnectionSupportsSfx ? undefined : false,
      enableGameMusic: enableGameMusic && audioConnectionSupportsMusic ? undefined : false,
      ...(importedArtStyleSettingsRef.current ?? {}),
      activeLorebookIds: activeLorebookIds.length > 0 ? activeLorebookIds : undefined,
      enableCustomWidgets,
      customHudWidgets:
        enableCustomWidgets && manualWidgetSetupEnabled ? normalizeGameHudWidgets(customHudWidgets) : undefined,
      enableSpotifyDj: musicDjEnabled || undefined,
      spotifySourceType: musicDjEnabled ? gameSpotifySourceType : undefined,
      spotifyPlaylistId:
        musicDjEnabled && gameSpotifySourceType === "playlist" ? gameSpotifyPlaylistId.trim() || undefined : undefined,
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
      gameGmPromptTemplateId: gamePresentation === "anime" ? ANIME_GAME_PROMPT_TEMPLATE_ID : null,
      gameSystemPrompt: customGameSystemPrompt,
      gameSpecialInstructions: trimmedGameSpecialInstructions || null,
    };
  };

  const buildSetupShareLabels = (): GameInitialSetupLabels => ({
    characterNames: Object.fromEntries(
      characters
        .filter((character) => [...partyCharacterIds, ...(gmCharacterId ? [gmCharacterId] : [])].includes(character.id))
        .map((character) => [character.id, character.name]),
    ),
    lorebookNames: Object.fromEntries(
      lorebooks
        .filter((lorebook) => activeLorebookIds.includes(lorebook.id))
        .map((lorebook) => [lorebook.id, lorebook.name]),
    ),
    promptPresetNames: selectedPromptPreset ? { [selectedPromptPreset.id]: selectedPromptPreset.name } : undefined,
    personaName: personas.find((persona) => persona.id === personaId)?.name ?? null,
  });

  const snapshotConnection = (id: string | null | undefined, service: "image" | "video" | "audio" | null = null) => {
    if (!id) return null;
    const connection = connections.find((candidate) => candidate.id === id);
    if (!connection) return null;
    return {
      name: connection.name,
      provider: connection.provider ?? null,
      model: connection.model ?? null,
      service:
        service === "image"
          ? connection.imageService
          : service === "video"
            ? connection.videoService
            : service === "audio"
              ? (connection.audioSource ?? null)
              : null,
    };
  };

  const handleExportSetup = () => {
    const config = buildSetupConfig();
    const exportName = gameName.trim() || "game";
    downloadJsonFile(
      buildGameSetupShareFile({
        gameName: exportName,
        config,
        effectiveGenerationParameters: config.generationParameters,
        preferences,
        fallbackGmConnectionId: gmConnectionId,
        labels: buildSetupShareLabels(),
        connections: {
          gm: snapshotConnection(gmConnectionId),
          scene:
            sceneModelValue === "local"
              ? { name: "Local scene helper", provider: "local" }
              : snapshotConnection(sceneModelValue),
          image: snapshotConnection(config.imageConnectionId, "image"),
          video: snapshotConnection(config.videoConnectionId, "video"),
          audio: snapshotConnection(config.audioConnectionId, "audio"),
        },
      }),
      `${sanitizeExportFilenamePart(exportName, "game")}.marinara-game-setup.json`,
    );
    toast.success(localizeUi("ui.game.gamesetupsummary.reusableGameModeSetupDownloaded"));
  };

  const handleComplete = () => {
    if (isLoading || !canStart) return;
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
      buildSetupConfig(),
      preferences,
      {
        gmConnectionId: gmConnectionId ?? undefined,
        shareLabels: buildSetupShareLabels(),
      },
      gameName.trim() || undefined,
      enableAgents && hierarchicalMapsInstalled && draftSpatialMap
        ? {
            mode: "ai" as const,
            size: spatialMapDraftSize,
            targetLocationCount: spatialMapTargetLocationCount,
            groundingMode: spatialMapGroundingMode,
            sourceLorebookIds: spatialMapGroundingMode === "setup" ? [] : activeLorebookIds,
            instructions: spatialMapInstructions.trim() || undefined,
          }
        : enableAgents && hierarchicalMapsInstalled && manualSpatialMap
          ? { mode: "manual" as const }
          : enableAgents && hierarchicalMapsInstalled && templateSpatialMap
            ? spatialTemplateSelection
              ? spatialTemplateSelection.kind === "shared-world"
                ? { mode: "shared-world" as const, selection: spatialTemplateSelection }
                : { mode: "template" as const, selection: spatialTemplateSelection }
              : undefined
            : undefined,
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/45 backdrop-blur-[2px]"
        onClick={isLoading ? undefined : onCancel}
      />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-3 pointer-events-none max-md:pt-[max(0.75rem,env(safe-area-inset-top))] max-md:pb-[max(0.75rem,var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))] sm:p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.key}
            data-component="GameSetupWizard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-setup-wizard-title"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(GAME_SETUP_WIZARD_PANEL_CLASS, adjustGameAssetsOpen && "max-w-5xl")}
          >
            <div className={cn(NEUTRAL_PANEL_HEADER, "flex shrink-0 items-center justify-between")}>
              <h3 id="game-setup-wizard-title" className={NEUTRAL_PANEL_TITLE}>
                {localizeUi("navigation.chatSidebar.new.game")}
              </h3>
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-wait disabled:opacity-40"
                aria-label={localizeUi("ui.game.gamesetupwizard.closeSetup")}
              >
                <X size="0.875rem" />
              </button>
            </div>

            <div
              className={cn(NEUTRAL_PANEL_SCROLL_AREA, "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4")}
            >
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
                        aria-label={localizeUi("ui.game.gamesetupwizard.importGameModeSetupFile")}
                      />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-start gap-2.5">
                          <FileUp size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[var(--foreground)]">
                              {localizeUi("ui.game.gamesetupwizard.reuseAGameSetup")}
                            </p>
                            <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                              {localizeUi("ui.game.gamesetupwizard.importASetupDownloadedFromAnotherCampaignYouCan")}
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
                          {setupImportResourcesReady
                            ? localizeUi("ui.game.gamesetupwizard.importSetup")
                            : localizeUi("ui.panels.ttsconfigcard.loading")}
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

                    {/* Absent when nothing provides an experience, leaving this step exactly as it was. */}
                    {experiencesSlot}

                    <div>
                      <label className={GAME_SETUP_FIELD_LABEL}>{localizeUi("ui.game.gamesetupwizard.gameName")}</label>
                      <input
                        type="text"
                        value={gameName}
                        onChange={(e) => setGameName(e.target.value)}
                        placeholder={localizeUi("ui.game.gamesetupwizard.nameYourAdventure")}
                        className={GAME_SETUP_INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className={GAME_SETUP_FIELD_LABEL}>
                        <Plug size={12} className="mr-1 inline" />
                        {localizeUi("ui.game.gamesetupwizard.connection")}
                      </label>
                      <select
                        value={gmConnectionId ?? ""}
                        onChange={(e) => setGmConnectionId(e.target.value || null)}
                        className={GAME_SETUP_INPUT_CLASS}
                      >
                        <option value="">{localizeUi("ui.game.gamesetupwizard.selectAConnection")}</option>
                        {languageConnections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.model ? localizeUi("ui.game.gamesetupwizard.value1", { value1: c.model }) : ""}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 rounded-lg border border-[var(--primary)]/35 bg-[var(--primary)]/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-[var(--primary)]">
                        {localizeUi("ui.game.gamesetupwizard.useAStrongModelForTheInitialWorldGeneration")}
                      </p>
                      <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                        <button
                          onClick={() => setCustomizeParameters((prev) => !prev)}
                          className="flex w-full items-center justify-between gap-3 text-left"
                        >
                          <div>
                            <span className="block text-xs font-medium text-[var(--foreground)]">
                              {localizeUi("ui.game.gamesetupwizard.customizeParameters")}
                            </span>
                            <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                              {localizeUi("ui.game.gamesetupwizard.leaveThisOffToUseTheSelectedConnectionS")}
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
                      {languageConnections.length === 0 && (
                        <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                          {localizeUi("ui.game.gamesetupwizard.noConnectionsConfiguredAddOneInSettingsConnections")}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className={GAME_SETUP_FIELD_LABEL}>
                        {localizeUi("ui.game.gamesetupwizard.sceneEffectsConnection")}
                        <span className="ml-1 text-[0.575rem] text-[var(--muted-foreground)]">
                          {localizeUi("ui.game.gamesetupwizard.optional")}
                        </span>
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
                        <option value="">{localizeUi("ui.game.gamesetupwizard.skipUseInlineTagsFromGm")}</option>
                        {sidecarAvailable && (
                          <option value="local">{localizeUi("ui.game.gamesetupwizard.localModelGemma")}</option>
                        )}
                        {languageConnections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.model ? localizeUi("ui.game.gamesetupwizard.value1", { value1: c.model }) : ""}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[0.575rem] text-[var(--muted-foreground)]">
                        {localizeUi(
                          "ui.game.gamesetupwizard.handlesBackgroundsMusicWeatherAndCinematicEffectsAfterEach",
                        )}
                      </p>
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    {/* Genre — multi-select */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                        {localizeUi("ui.game.gamesetupwizard.genre")}
                        {genres.length} {localizeUi("ui.game.gamesetupwizard.selected")}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {GENRES.map((g) => (
                          <button
                            key={g}
                            onClick={() => toggleGenre(g)}
                            aria-pressed={genres.includes(g)}
                            className={cn(
                              "rounded-md px-3 py-1 text-xs transition-colors",
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
                              aria-pressed={genres.includes(g)}
                              className="flex items-center gap-1 rounded-md bg-[var(--primary)]/20 px-3 py-1 text-xs text-[var(--primary)] ring-1 ring-[var(--primary)]/40 transition-colors"
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
                          placeholder={localizeUi("ui.game.gamesetupwizard.addCustomGenre")}
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
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                        {localizeUi("ui.game.gamesetupwizard.setting")}
                      </label>
                      <input
                        type="text"
                        value={setting}
                        onChange={(e) => setSetting(e.target.value)}
                        placeholder={localizeUi("ui.game.gamesetupwizard.describeYourWorld")}
                        className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
                      />
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {SETTING_SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => applySuggestion(setSetting, s)}
                            className="flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
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
                        {localizeUi("ui.game.gamesetupwizard.tone")}
                        {tones.length} {localizeUi("ui.game.gamesetupwizard.selected")}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {TONES.map((t) => (
                          <button
                            key={t}
                            onClick={() => toggleTone(t)}
                            aria-pressed={tones.includes(t)}
                            className={cn(
                              "rounded-md px-3 py-1 text-xs transition-colors",
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
                              aria-pressed={tones.includes(t)}
                              className="flex items-center gap-1 rounded-md bg-[var(--primary)]/20 px-3 py-1 text-xs text-[var(--primary)] ring-1 ring-[var(--primary)]/40 transition-colors"
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
                          placeholder={localizeUi("ui.game.gamesetupwizard.addCustomTone")}
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
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                        {localizeUi("ui.game.gamesetupwizard.difficulty")}
                      </label>
                      <div className="flex gap-1.5">
                        {DIFFICULTIES.map((d) => (
                          <button
                            key={d}
                            onClick={() => setDifficulty(d)}
                            aria-pressed={difficulty === d}
                            className={cn(
                              "rounded-md px-3 py-1 text-xs transition-colors",
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
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                        {localizeUi("ui.game.gamesetupwizard.combatPreference")}
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCombatStyle("classic")}
                          aria-pressed={combatStyle === "classic"}
                          className={cn(
                            "flex-1 rounded-lg p-3 text-left text-xs transition-colors ring-1",
                            combatStyle === "classic"
                              ? "bg-[var(--primary)]/10 ring-[var(--primary)]/40"
                              : "bg-[var(--secondary)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                          )}
                        >
                          <div className="font-medium text-[var(--foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.classic")}
                          </div>
                          <div className="mt-1 text-[var(--muted-foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.cinematicMenuBattlesCurrentStyle")}
                          </div>
                        </button>
                        <button
                          onClick={() => setCombatStyle("tactical")}
                          aria-pressed={combatStyle === "tactical"}
                          className={cn(
                            "flex-1 rounded-lg p-3 text-left text-xs transition-colors ring-1",
                            combatStyle === "tactical"
                              ? "bg-[var(--primary)]/10 ring-[var(--primary)]/40"
                              : "bg-[var(--secondary)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                          )}
                        >
                          <div className="font-medium text-[var(--foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.tactical")}
                          </div>
                          <div className="mt-1 text-[var(--muted-foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.fireEmblemStyleGridBattlesMovementTerrainForecasts")}
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Content Rating */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                        {localizeUi("ui.game.gamesetupwizard.contentRating")}
                      </label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRating("sfw")}
                          aria-pressed={rating === "sfw"}
                          className={cn(
                            "rounded-md px-3 py-1 text-xs transition-colors",
                            rating === "sfw"
                              ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                              : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                          )}
                        >
                          {localizeUi("ui.game.gamesetupwizard.sfw")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRating("nsfw")}
                          aria-pressed={rating === "nsfw"}
                          className={cn(
                            "rounded-md px-3 py-1 text-xs transition-colors",
                            rating === "nsfw"
                              ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                              : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                          )}
                        >
                          {localizeUi("ui.game.gamesetupwizard.nsfw")}
                        </button>
                      </div>
                      <p className="mt-1 text-[0.575rem] text-[var(--muted-foreground)]">
                        {rating === "nsfw"
                          ? localizeUi("ui.game.gamesetupwizard.anythingGoesViolenceDarkThemesAndExplicitContentAre")
                          : localizeUi("ui.game.gamesetupwizard.darkThemesAndProfanityAllowedButExplicitScenesCut")}
                      </p>
                    </div>

                    {/* Language */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                        {localizeUi("settings.application.language.label")}
                      </label>
                      <input
                        type="text"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        placeholder={localizeUi("ui.game.gamesetupwizard.english")}
                        className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
                      />
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {GAME_LANGUAGE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setLanguage(option.label)}
                            aria-pressed={normalizedLanguage === option.value}
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[0.625rem] transition-colors",
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
                        {localizeUi("ui.game.gamesetupwizard.allNarrationAndDialogueWillBeWrittenInThis")}
                      </p>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    {/* GM Mode */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                        {localizeUi("ui.game.gamesetupwizard.gameMasterMode")}
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setGmMode("standalone")}
                          aria-pressed={gmMode === "standalone"}
                          className={cn(
                            "flex-1 rounded-lg p-3 text-left text-xs transition-colors ring-1",
                            gmMode === "standalone"
                              ? "bg-[var(--primary)]/10 ring-[var(--primary)]/40"
                              : "bg-[var(--secondary)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                          )}
                        >
                          <div className="font-medium text-[var(--foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.standaloneGm")}
                          </div>
                          <div className="mt-1 text-[var(--muted-foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.aSnarkyNarratorRunningTheShow")}
                          </div>
                        </button>
                        <button
                          onClick={() => setGmMode("character")}
                          aria-pressed={gmMode === "character"}
                          className={cn(
                            "flex-1 rounded-lg p-3 text-left text-xs transition-colors ring-1",
                            gmMode === "character"
                              ? "bg-[var(--primary)]/10 ring-[var(--primary)]/40"
                              : "bg-[var(--secondary)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                          )}
                        >
                          <div className="font-medium text-[var(--foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.characterGm")}
                          </div>
                          <div className="mt-1 text-[var(--muted-foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.useAnExistingCharacterAsGm")}
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* GM Character selector */}
                    {gmMode === "character" && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                          {localizeUi("ui.game.gamesetupwizard.gmCharacter")}
                        </label>
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
                                  title={localizeUi("settings.notifications.customSound.actions.remove")}
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
                              placeholder={localizeUi("ui.game.gamesetupwizard.searchCharacters")}
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
                                  <span className="text-[0.625rem] text-[var(--primary)]">
                                    {localizeUi("ui.game.gamesetupwizard.selected_9a976fc")}
                                  </span>
                                )}
                              </button>
                            ))}
                            {filteredGmCharacters.length === 0 && (
                              <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                                {characters.length === 0
                                  ? localizeUi("ui.agents.regexscripteditor.noCharactersFound")
                                  : localizeUi("ui.lorebooks.linkedresourcepicker.noMatches")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Party Members */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                        {localizeUi("ui.game.gamesetupwizard.partyMembers")}
                        {partyCharacterIds.length} {localizeUi("ui.game.gamesetupwizard.selected")}
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
                                  title={localizeUi("settings.notifications.customSound.actions.remove")}
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
                            placeholder={localizeUi("ui.game.gamesetupwizard.searchCharacters")}
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
                              aria-label={localizeUi("ui.game.gamesetupwizard.addPartyMembersFromFolder")}
                            >
                              <option value="">{localizeUi("ui.noodle.noodlehome.addFromFolder")}</option>
                              {characterFolders.map((folder) => {
                                const newCount = folder.characterIds.filter(
                                  (id) =>
                                    validCharacterIds.has(id) &&
                                    id !== gmCharacterId &&
                                    !partyCharacterIds.includes(id),
                                ).length;
                                return (
                                  <option key={folder.id} value={folder.id}>
                                    {folder.name} (
                                    {newCount > 0
                                      ? localizeUi("ui.game.gamesetupwizard.value1New", { value1: newCount })
                                      : localizeUi("ui.game.gamesetupwizard.allAdded")}
                                    )
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
                              {localizeUi("ui.characters.metadatatab.add")}
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
                                  <span className="text-[0.625rem] text-[var(--primary)]">
                                    {localizeUi("ui.game.gamesetupwizard.added")}
                                  </span>
                                ) : (
                                  <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
                                )}
                              </button>
                            );
                          })}
                          {filteredPartyCharacters.length === 0 && (
                            <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                              {characters.length === 0
                                ? localizeUi("ui.game.gamesetupwizard.noCharactersFoundCreateCharactersFirst")
                                : localizeUi("ui.lorebooks.linkedresourcepicker.noMatches")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Persona */}
                    <div>
                      <label className={GAME_SETUP_FIELD_LABEL}>
                        <User size={12} className="mr-1 inline" />
                        {localizeUi("ui.game.gamesetupwizard.playerSPersona")}
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
                                  avatarCrop: p.avatarCrop,
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
                              <button
                                onClick={() => setPersonaId(null)}
                                className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                                title={localizeUi("settings.notifications.customSound.actions.remove")}
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
                            placeholder={localizeUi("ui.game.gamesetupwizard.searchPersonasOrTitles")}
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
                                    avatarCrop: p.avatarCrop,
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
                                {p.id === personaId && (
                                  <span className="text-[0.625rem] text-[var(--primary)]">
                                    {localizeUi("ui.game.gamesetupwizard.selected_9a976fc")}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {filteredPersonas.length === 0 && (
                            <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                              {personas.length === 0
                                ? localizeUi("ui.game.gamesetupwizard.noPersonasFoundCreateOneInThePersonasPanel")
                                : localizeUi("ui.lorebooks.linkedresourcepicker.noMatches")}
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
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                        {localizeUi("ui.game.gamesetupwizard.gameFeatures")}
                      </label>
                      <div className="space-y-2">
                        <button
                          type="button"
                          aria-pressed={enableQuickTimeEvents}
                          onClick={() => setEnableQuickTimeEvents((enabled) => !enabled)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                            enableQuickTimeEvents
                              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                              : "bg-[var(--secondary)] ring-1 ring-transparent hover:ring-[var(--border)]",
                          )}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2.5">
                            <Timer
                              size={14}
                              className={
                                enableQuickTimeEvents ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                              }
                            />
                            <span className="min-w-0">
                              <span className="block text-xs font-medium text-[var(--foreground)]">
                                {localizeUi("ui.game.gamesetupwizard.quickTimeEvents")}
                              </span>
                              <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                                {localizeUi("ui.game.gamesetupwizard.quickTimeEventsDescription")}
                              </span>
                            </span>
                          </span>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                              enableQuickTimeEvents ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                            )}
                          >
                            <span
                              className={cn(
                                "block h-4 w-4 rounded-full bg-white transition-transform",
                                enableQuickTimeEvents && "translate-x-3.5",
                              )}
                            />
                          </span>
                        </button>

                        {installedAgentsLoading ? (
                          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-4 py-4 text-xs text-[var(--muted-foreground)]">
                            <Loader2 size={13} className="animate-spin" />
                            {localizeUi("ui.game.gamesetupwizard.loadingInstalledAgents")}
                          </div>
                        ) : (
                          !hasInstalledAgents && (
                            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--secondary)]/35 px-4 py-4 text-center">
                              <p className="text-xs font-medium text-[var(--foreground)]">
                                {localizeUi("ui.game.gamesetupwizard.noAgentsDownloadedYet")}
                              </p>
                              <p className="mx-auto mt-1 max-w-sm text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                                {localizeUi(
                                  "ui.game.gamesetupwizard.downloadAgentsToAddMapsIllustratorMusicDjLorebook",
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={openDownloadAgents}
                                className={cn(GAME_SETUP_PRIMARY_BUTTON_CLASS, "mx-auto mt-3 gap-2")}
                              >
                                <Sparkles size={13} />
                                {localizeUi("ui.agents.agentcatalogview.downloadAgents")}
                              </button>
                            </div>
                          )
                        )}

                        {!installedAgentsLoading && hasInstalledAgents && (
                          <button
                            type="button"
                            onClick={() => setEnableAgents((enabled) => !enabled)}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                              enableAgents
                                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                                : "bg-[var(--secondary)] ring-1 ring-transparent hover:ring-[var(--border)]",
                            )}
                          >
                            <span className="flex min-w-0 flex-1 items-center gap-2.5">
                              <Sparkles
                                size={14}
                                className={enableAgents ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
                              />
                              <span className="min-w-0">
                                <span className="block text-xs font-medium text-[var(--foreground)]">
                                  {localizeUi("ui.chat.chatsettingsdrawer.enableAgents")}
                                </span>
                                <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                                  {localizeUi("ui.game.gamesetupwizard.enableAgentsDescription")}
                                </span>
                              </span>
                            </span>
                            <span
                              aria-hidden="true"
                              className={cn(
                                "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                                enableAgents ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                              )}
                            >
                              <span
                                className={cn(
                                  "block h-4 w-4 rounded-full bg-white transition-transform",
                                  enableAgents && "translate-x-3.5",
                                )}
                              />
                            </span>
                          </button>
                        )}

                        {enableAgents && musicDjInstalled && (
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
                                  className={
                                    enableSpotifyDj ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                                  }
                                />
                                <div className="min-w-0">
                                  <span className="block text-xs font-medium text-[var(--foreground)]">
                                    {localizeUi("ui.game.gamesetupwizard.musicDj")}
                                  </span>
                                  <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                                    {localizeUi("ui.game.gamesetupwizard.useTheMusicDjForThisGameInsteadOf")}
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
                                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                    {localizeUi("ui.game.gamesetupwizard.musicSource")}
                                  </span>
                                  <select
                                    value={gameSpotifySourceType}
                                    onChange={(event) => {
                                      const next = normalizeSpotifySourceType(event.target.value);
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
                                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                      {localizeUi("ui.game.gamesetupwizard.playlist")}
                                    </span>
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
                                        <option value="">{localizeUi("ui.game.gamesetupwizard.choosePlaylist")}</option>
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
                                          spotifyPlaylistsQuery.isFetching
                                            ? localizeUi("ui.game.gamesetupwizard.loadingPlaylists")
                                            : localizeUi("ui.game.gamesetupwizard.pastePlaylistId")
                                        }
                                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                                      />
                                    )}
                                    {spotifyPlaylistsQuery.isError && (
                                      <span className="text-[0.5625rem] text-[var(--primary)]">
                                        {localizeUi("ui.game.gamesetupwizard.connectSpotifyInTheMusicDjAgentToLoad")}
                                      </span>
                                    )}
                                  </label>
                                )}

                                {gameSpotifySourceType === "artist" && (
                                  <label className="flex flex-col gap-1">
                                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                      {localizeUi("ui.game.gamesetupwizard.artist")}
                                    </span>
                                    <input
                                      value={gameSpotifyArtist}
                                      onChange={(event) => setGameSpotifyArtist(event.target.value)}
                                      placeholder={localizeUi("ui.game.gamesetupwizard.hoyoMix")}
                                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
                                    />
                                  </label>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {enableAgents && lorebookKeeperInstalled && (
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
                                className={
                                  enableLorebookKeeper ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                                }
                              />
                              <div className="min-w-0">
                                <span className="block text-xs font-medium text-[var(--foreground)]">
                                  {localizeUi("ui.game.gamesetupwizard.lorebookKeeper")}
                                </span>
                                <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                                  {localizeUi("ui.game.gamesetupwizard.keepAGameLorebookUpdatedAsTheAdventureDevelops")}
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

                        {enableAgents && illustratorInstalled && (
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
                                className={
                                  enableSpriteGeneration ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                                }
                              />
                              <div className="flex-1">
                                <span className="block text-xs font-medium text-[var(--foreground)]">
                                  {localizeUi("ui.game.gamesetupwizard.illustrator")}
                                </span>
                                <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                                  {localizeUi(
                                    "ui.game.gamesetupwizard.generateNpcPortraitsLocationBackgroundsSceneImagesAndOptional",
                                  )}
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
                                  {localizeUi("ui.agents.agenteditor.imageGenerationConnection")}
                                </label>
                                <select
                                  value={imageConnectionId ?? ""}
                                  onChange={(e) => setImageConnectionId(e.target.value || null)}
                                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
                                >
                                  <option value="">
                                    {localizeUi("ui.game.gamesetupwizard.selectImageConnection")}
                                  </option>
                                  {imageConnections.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                      {c.model
                                        ? localizeUi("ui.game.gamesetupwizard.value1_4cb807e", { value1: c.model })
                                        : ""}
                                    </option>
                                  ))}
                                </select>
                                {imageConnections.length === 0 && (
                                  <p className="mt-1 text-[0.55rem] text-amber-700 dark:text-amber-400/80">
                                    {localizeUi(
                                      "ui.game.gamesetupwizard.noImageGenerationConnectionsFoundAddOneInSettings",
                                    )}
                                  </p>
                                )}
                                <p className="mt-1 text-[0.55rem] text-[var(--muted-foreground)]">
                                  {localizeUi(
                                    "ui.game.gamesetupwizard.powersAutomaticPortraitsBackgroundsAndSceneIllustrations",
                                  )}
                                </p>
                                <button
                                  type="button"
                                  aria-pressed={gameImageDynamicPromptEnabled}
                                  onClick={() => setGameImageDynamicPromptEnabled((enabled) => !enabled)}
                                  className="mt-3 flex w-full items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-left"
                                >
                                  <span className="min-w-0">
                                    <span className="block text-[0.625rem] font-medium text-[var(--foreground)]">
                                      {localizeUi(
                                        "ui.chat.chatsettingsdrawer.dynamicLlmPromptGenerationForGmModeAssets",
                                      )}
                                    </span>
                                    <span className="mt-0.5 block text-[0.55rem] leading-snug text-[var(--muted-foreground)]">
                                      {localizeUi(
                                        "ui.chat.chatsettingsdrawer.askThePromptModelToRewriteGameNpcPortrait",
                                      )}
                                    </span>
                                  </span>
                                  <span
                                    className={cn(
                                      "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                                      gameImageDynamicPromptEnabled
                                        ? "bg-[var(--primary)]"
                                        : "bg-[var(--muted-foreground)]/50",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "block h-4 w-4 rounded-full bg-white transition-transform",
                                        gameImageDynamicPromptEnabled && "translate-x-3.5",
                                      )}
                                    />
                                  </span>
                                </button>
                                <div className="mt-3 border-t border-[var(--border)] pt-3">
                                  <label className="mb-1 flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                    <Film size={11} />
                                    {localizeUi("ui.game.gamesetupwizard.videoGenerationConnection")}
                                  </label>
                                  <select
                                    value={videoConnectionId ?? ""}
                                    onChange={(e) => setVideoConnectionId(e.target.value || null)}
                                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
                                  >
                                    <option value="">
                                      {localizeUi("ui.game.gamesetupwizard.noSceneVideoConnection")}
                                    </option>
                                    {videoConnections.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                        {c.model
                                          ? localizeUi("ui.game.gamesetupwizard.value1", { value1: c.model })
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                  {videoConnections.length === 0 && (
                                    <p className="mt-1 text-[0.55rem] text-amber-700 dark:text-amber-400/80">
                                      {localizeUi(
                                        "ui.game.gamesetupwizard.noVideoGenerationConnectionsFoundAddOneInSettings",
                                      )}
                                    </p>
                                  )}
                                  <p className="mt-1 text-[0.55rem] text-[var(--muted-foreground)]">
                                    {localizeUi("ui.game.gamesetupwizard.usedForManualSceneVideos")}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Game Audio */}
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                      <div className="flex items-center gap-2.5">
                        <Music size={14} className="text-[var(--muted-foreground)]" />
                        <div className="flex-1">
                          <span className="block text-xs font-medium text-[var(--foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.gameAudio")}
                          </span>
                          <span className="block text-[0.575rem] text-[var(--muted-foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.generateSoundEffectsAndMusicForScenesUsingAn")}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                          {localizeUi("ui.game.gamesetupwizard.audioConnection")}
                        </label>
                        <select
                          value={audioConnectionId ?? ""}
                          onChange={(e) => setAudioConnectionId(e.target.value || null)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)]"
                        >
                          <option value="">{localizeUi("ui.game.gamesetupwizard.useTheDefaultAudioConnection")}</option>
                          {audioConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                              {c.model ? localizeUi("ui.game.gamesetupwizard.value1", { value1: c.model }) : ""}
                            </option>
                          ))}
                        </select>
                        {audioConnections.length === 0 && (
                          <p className="mt-1 text-[0.55rem] text-amber-700 dark:text-amber-400/80">
                            {localizeUi("ui.game.gamesetupwizard.noAudioConnectionsFoundAddOneInSettings")}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-pressed={enableGameSoundEffects && audioConnectionSupportsSfx}
                        disabled={!audioConnectionSupportsSfx}
                        onClick={() => setEnableGameSoundEffects((enabled) => !enabled)}
                        className={cn(
                          "mt-3 flex w-full items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-left",
                          !audioConnectionSupportsSfx && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block text-[0.625rem] font-medium text-[var(--foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.soundEffects")}
                          </span>
                          <span className="mt-0.5 block text-[0.55rem] leading-snug text-[var(--muted-foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.generateShortSceneSoundEffectsAfterGmTurns")}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                            enableGameSoundEffects && audioConnectionSupportsSfx
                              ? "bg-[var(--primary)]"
                              : "bg-[var(--muted-foreground)]/50",
                          )}
                        >
                          <span
                            className={cn(
                              "block h-4 w-4 rounded-full bg-white transition-transform",
                              enableGameSoundEffects && audioConnectionSupportsSfx && "translate-x-3.5",
                            )}
                          />
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={enableGameMusic && audioConnectionSupportsMusic}
                        disabled={!audioConnectionSupportsMusic}
                        onClick={() => setEnableGameMusic((enabled) => !enabled)}
                        className={cn(
                          "mt-2 flex w-full items-center justify-between gap-3 text-left",
                          !audioConnectionSupportsMusic && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block text-[0.625rem] font-medium text-[var(--foreground)]">
                            {localizeUi("game.toolbar.volume.music")}
                          </span>
                          <span className="mt-0.5 block text-[0.55rem] leading-snug text-[var(--muted-foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.generateBackgroundMusicForScenes")}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                            enableGameMusic && audioConnectionSupportsMusic
                              ? "bg-[var(--primary)]"
                              : "bg-[var(--muted-foreground)]/50",
                          )}
                        >
                          <span
                            className={cn(
                              "block h-4 w-4 rounded-full bg-white transition-transform",
                              enableGameMusic && audioConnectionSupportsMusic && "translate-x-3.5",
                            )}
                          />
                        </span>
                      </button>
                      {resolvedAudioConnection != null &&
                        (!audioConnectionSupportsSfx || !audioConnectionSupportsMusic) && (
                          <p className="mt-2 text-[0.55rem] text-amber-700 dark:text-amber-400/80">
                            {localizeUi(
                              "ui.game.gamesetupwizard.soundEffectAndMusicGenerationRequiresAnElevenlabsAudio",
                            )}
                          </p>
                        )}
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
                            <p className="text-xs font-medium text-[var(--foreground)]">
                              {localizeUi("ui.game.gamesetupwizard.customHudWidgets")}
                            </p>
                            <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                              {localizeUi(
                                "ui.game.gamesetupwizard.modelDesignsCustomWidgetsHealthBarsInventoriesEtcFor",
                              )}
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
                              <p className="text-xs font-medium text-[var(--foreground)]">
                                {localizeUi("ui.game.gamesetupwizard.buildWidgetSetup")}
                              </p>
                              <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                                {localizeUi("ui.game.gamesetupwizard.chooseTheStartingHudWidgetsYourself")}
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
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                        {localizeUi("ui.game.gamesetupwizard.playerGoals")}
                      </label>
                      <textarea
                        value={playerGoals}
                        onChange={(e) => setPlayerGoals(e.target.value)}
                        placeholder={localizeUi("ui.game.gamesetupwizard.whatDoYouWantToAchieve")}
                        rows={3}
                        className="w-full resize-none rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
                      />
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {GOAL_SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => applySuggestion(setPlayerGoals, s)}
                            className="flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
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
                        {localizeUi("ui.game.gamesetupwizard.additionalPreferencesOptional")}
                      </label>
                      <textarea
                        value={preferences}
                        onChange={(e) => setPreferences(e.target.value)}
                        placeholder={localizeUi("ui.game.gamesetupwizard.anyExtraDetailsForTheGm")}
                        rows={3}
                        className="w-full resize-none rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
                      />
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {PREFERENCE_SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => setPreferences((prev) => (prev ? `${prev}, ${s.toLowerCase()}` : s))}
                            className="rounded-md bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
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
                        {localizeUi("navigation.topbar.lorebooks")}
                      </label>
                      <p className="mb-2 text-[0.55rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.game.gamesetupwizard.attachLorebooksToInjectWorldLoreCharacterInfoAnd")}
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
                                  title={localizeUi("settings.notifications.customSound.actions.remove")}
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
                            placeholder={localizeUi("ui.game.gamesetupwizard.searchLorebooks")}
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
                                ? localizeUi("ui.game.gamesetupwizard.allLorebooksAlreadyAdded")
                                : localizeUi("ui.lorebooks.linkedresourcepicker.noMatches")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {step === 5 && enableAgents && hierarchicalMapsInstalled && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                      <MapIcon size={12} className="mr-1 inline" />
                      {localizeUi("ui.game.gamesetupwizard.hierarchicalWorldMap")}
                    </label>
                    <button
                      type="button"
                      aria-pressed={draftSpatialMap}
                      onClick={() => {
                        setDraftSpatialMap((enabled) => !enabled);
                        setManualSpatialMap(false);
                        setTemplateSpatialMap(false);
                        setSpatialTemplateSelection(null);
                      }}
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
                          <span className="block text-xs font-medium text-[var(--foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.draftWithAi")}
                          </span>
                          <span className="block text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.afterSetupAiBuildsNestedRegionsAndPlacesFor")}
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

                    <button
                      type="button"
                      aria-pressed={manualSpatialMap}
                      onClick={() => {
                        setManualSpatialMap((enabled) => !enabled);
                        setDraftSpatialMap(false);
                        setTemplateSpatialMap(false);
                        setSpatialTemplateSelection(null);
                      }}
                      className={cn(
                        "mt-2 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                        manualSpatialMap
                          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                          : "bg-[var(--secondary)] ring-1 ring-transparent hover:ring-[var(--border)]",
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Plus
                          size={14}
                          className={manualSpatialMap ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-[var(--foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.createManually")}
                          </span>
                          <span className="block text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
                            {localizeUi(
                              "ui.game.gamesetupwizard.openTheBlankMapDesignerAfterSetupWithoutGeneratingAMap",
                            )}
                          </span>
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                          manualSpatialMap ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                        )}
                      >
                        <span
                          className={cn(
                            "block h-4 w-4 rounded-full bg-white transition-transform",
                            manualSpatialMap && "translate-x-3.5",
                          )}
                        />
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={templateSpatialMap}
                      onClick={() => {
                        setSpatialTemplatePickerOpen(true);
                      }}
                      className={cn(
                        "mt-2 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                        templateSpatialMap
                          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                          : "bg-[var(--secondary)] ring-1 ring-transparent hover:ring-[var(--border)]",
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2.5">
                        <FolderOpen
                          size={14}
                          className={templateSpatialMap ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-[var(--foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.useATemplateOrSharedWorld")}
                          </span>
                          <span className="block text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
                            {spatialTemplateSelection
                              ? localizeUi(
                                  spatialTemplateSelection.kind === "shared-world"
                                    ? "ui.game.gamesetupwizard.selectedSharedWorldValue1"
                                    : "ui.game.gamesetupwizard.selectedMapTemplateValue1",
                                  { value1: spatialTemplateSelection.label },
                                )
                              : localizeUi("ui.game.gamesetupwizard.chooseASavedMapTemplateOrSharedWorld")}
                          </span>
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                          templateSpatialMap ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
                        )}
                      >
                        <span
                          className={cn(
                            "block h-4 w-4 rounded-full bg-white transition-transform",
                            templateSpatialMap && "translate-x-3.5",
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
                            {localizeUi("ui.game.gamesetupwizard.whatShouldThisWorldInclude")}
                          </label>
                          <textarea
                            id="game-setup-spatial-map-instructions"
                            value={spatialMapInstructions}
                            onChange={(event) => setSpatialMapInstructions(event.target.value)}
                            maxLength={4_000}
                            rows={3}
                            placeholder={localizeUi(
                              "ui.game.gamesetupwizard.aMistyCoastalCityWithAHarborMarketHaunted",
                            )}
                            className="mt-2 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
                          />
                          <p className="mt-1 text-[0.5625rem] leading-relaxed text-[var(--muted-foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.optionalIfLeftBlankMarinaraBuildsFromTheExisting")}
                          </p>
                        </div>

                        <fieldset>
                          <legend className="text-[0.625rem] font-medium text-[var(--foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.mapSize")}
                          </legend>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {SPATIAL_MAP_DRAFT_SIZE_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                aria-pressed={spatialMapTargetLocationCount === option.targetLocationCount}
                                onClick={() => {
                                  setSpatialMapDraftSize(option.value);
                                  setSpatialMapTargetLocationCount(option.targetLocationCount);
                                  setSpatialMapTargetLocationCountInput(String(option.targetLocationCount));
                                }}
                                className={cn(
                                  "min-h-12 rounded-lg px-2 py-2 text-left transition-colors",
                                  spatialMapTargetLocationCount === option.targetLocationCount
                                    ? "bg-[var(--primary)]/12 text-[var(--foreground)] ring-1 ring-[var(--primary)]/35"
                                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]",
                                )}
                              >
                                <span className="block text-[0.6875rem] font-semibold">{option.label}</span>
                                <span className="mt-0.5 block text-[0.55rem] leading-tight">{option.detail}</span>
                              </button>
                            ))}
                          </div>
                          <label
                            className="mt-3 block text-[0.625rem] font-medium text-[var(--foreground)]"
                            htmlFor="game-setup-spatial-map-target-count"
                          >
                            {localizeUi("ui.game.gamesetupwizard.customPlaceTarget")}
                            <input
                              id="game-setup-spatial-map-target-count"
                              type="number"
                              min={1}
                              max={SPATIAL_CUSTOM_TARGET_LOCATION_LIMIT}
                              step={1}
                              value={spatialMapTargetLocationCountInput}
                              aria-invalid={!spatialMapTargetLocationCountValid}
                              aria-describedby="game-setup-spatial-map-target-count-help"
                              onChange={(event) => {
                                const raw = event.target.value;
                                setSpatialMapTargetLocationCountInput(raw);
                                const normalized = normalizeSpatialMapTargetLocationCount(raw);
                                if (normalized !== null) {
                                  setSpatialMapTargetLocationCount(normalized);
                                  setSpatialMapDraftSize(resolveGameSpatialMapDraftOptions(undefined, normalized).size);
                                }
                              }}
                              onBlur={() => {
                                const normalized = normalizeSpatialMapTargetLocationCount(
                                  spatialMapTargetLocationCountInput,
                                );
                                if (normalized !== null) {
                                  setSpatialMapTargetLocationCount(normalized);
                                  setSpatialMapTargetLocationCountInput(String(normalized));
                                  setSpatialMapDraftSize(resolveGameSpatialMapDraftOptions(undefined, normalized).size);
                                }
                              }}
                              className={cn(
                                "mt-1 min-h-11 w-full rounded-lg bg-[var(--secondary)] px-3 text-xs text-[var(--foreground)] outline-none ring-1 transition-all",
                                spatialMapTargetLocationCountValid
                                  ? "ring-[var(--border)] focus:ring-[var(--primary)]/40"
                                  : "ring-[var(--destructive)] focus:ring-[var(--destructive)]",
                              )}
                            />
                            <span
                              id="game-setup-spatial-map-target-count-help"
                              className={cn(
                                "mt-1 block text-[0.5625rem] leading-relaxed",
                                spatialMapTargetLocationCountValid
                                  ? "text-[var(--muted-foreground)]"
                                  : "text-[var(--destructive)]",
                              )}
                            >
                              {localizeUi("ui.game.gamesetupwizard.chooseAnyWholeNumberFrom1ToValue1Places", {
                                value1: SPATIAL_CUSTOM_TARGET_LOCATION_LIMIT,
                              })}
                            </span>
                          </label>
                        </fieldset>

                        <fieldset>
                          <legend className="text-[0.625rem] font-medium text-[var(--foreground)]">
                            {localizeUi("ui.game.gamesetupwizard.buildFrom")}
                          </legend>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {(
                              [
                                { value: "setup", label: "Game setup" },
                                { value: "lore_strict", label: "Strict lore" },
                                { value: "lore_expand", label: "Lore + AI" },
                              ] as const
                            ).map((option) => (
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
                              ? localizeUi("ui.game.gamesetupwizard.usesTheGeneratedGameWorldAndParty")
                              : spatialMapGroundingMode === "lore_strict"
                                ? localizeUi(
                                    "ui.game.gamesetupwizard.onlyCreatesPlacesSupportedByTheValue1SelectedLorebook",
                                    {
                                      value1: activeLorebookIds.length,
                                      value2:
                                        activeLorebookIds.length === 1
                                          ? ""
                                          : localizeUi("ui.noodle.stageprofileview.s"),
                                    },
                                  )
                                : localizeUi("ui.game.gamesetupwizard.usesTheValue1SelectedLorebookValue2AsCanonAnd", {
                                    value1: activeLorebookIds.length,
                                    value2:
                                      activeLorebookIds.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
                                  })}
                          </p>
                        </fieldset>

                        <p className="text-[0.5625rem] leading-relaxed text-[var(--muted-foreground)]">
                          {localizeUi("ui.game.gamesetupwizard.theDraftStaysDisabledUntilYouReviewApplyEnable")}
                        </p>
                      </div>
                    )}
                  </div>
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
                            <p className="text-xs font-medium text-[var(--foreground)]">
                              {localizeUi("ui.game.gamesetupwizard.startMuted")}
                            </p>
                            <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                              {localizeUi("ui.game.gamesetupwizard.beginTheGameWithAllAudioMuted")}
                            </p>
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

                    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                      <button
                        type="button"
                        onClick={() => setAdjustGameAssetsOpen((open) => !open)}
                        aria-expanded={adjustGameAssetsOpen}
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <FolderOpen size={14} className="shrink-0 text-[var(--primary)]" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--foreground)]">
                              {localizeUi("ui.game.gamesetupwizard.adjustGameAssetsForThisGame")}
                            </p>
                            <p className="text-[0.55rem] leading-relaxed text-[var(--muted-foreground)]">
                              {localizeUi("ui.game.gamesetupwizard.chooseWhichAssetFoldersThisGameMayUseAll")}
                            </p>
                          </div>
                        </div>
                        <ChevronDown
                          size={14}
                          className={cn(
                            "shrink-0 text-[var(--muted-foreground)] transition-transform",
                            adjustGameAssetsOpen && "rotate-180",
                          )}
                        />
                      </button>
                      {adjustGameAssetsOpen && (
                        <div className="mt-3 h-[min(60dvh,30rem)] min-h-80 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
                          <Suspense
                            fallback={
                              <div className="flex h-full items-center justify-center gap-2 text-xs text-[var(--muted-foreground)]">
                                <Loader2 size={14} className="animate-spin" />
                                {localizeUi("ui.game.gamesetupwizard.loadingAssets")}
                              </div>
                            }
                          >
                            <GameAssetsBrowserView
                              embedded
                              selectFoldersByDefault
                              onClose={() => setAdjustGameAssetsOpen(false)}
                            />
                          </Suspense>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {step === 6 && (
                  <>
                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                        <Sparkles size={12} />
                        {localizeUi("settings.sections.gamePresentation.title")}
                      </label>
                      <select
                        value={gamePresentation}
                        onChange={(event) => setGamePresentation(event.target.value === "anime" ? "anime" : "standard")}
                        className={GAME_SETUP_INPUT_CLASS}
                      >
                        <option value="standard">{localizeUi("ui.game.gamesetupwizard.standard")}</option>
                        <option value="anime">{localizeUi("ui.game.gamesetupwizard.storyboardOptimized")}</option>
                      </select>
                      <p className="mt-1 text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
                        {gamePresentation === "anime"
                          ? localizeUi("ui.game.gamesetupwizard.storyboardOptimizedNarrationDescription")
                          : localizeUi("ui.game.gamesetupwizard.usesTheStandardFlexibleGameModeNarrationAndMedia")}
                      </p>
                    </div>
                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                        <Feather size={12} />
                        {localizeUi("ui.game.gamesetupwizard.basePromptPreset")}
                      </label>
                      <select
                        value={promptPresetId ?? ""}
                        onChange={(event) => handlePromptPresetChange(event.target.value || null)}
                        className={GAME_SETUP_INPUT_CLASS}
                      >
                        <option value="">{localizeUi("ui.game.gamesurfacecomponent.none")}</option>
                        {promptPresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
                        {gamePresentation === "anime"
                          ? localizeUi("ui.game.gamesetupwizard.theStoryboardGamePromptReplacesTheSelectedPresetS")
                          : localizeUi("ui.game.gamesetupwizard.usesTheGameModePromptFromTheSelectedPreset")}
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                        <Feather size={12} />
                        {localizeUi("ui.game.gamesetupwizard.extraInstructions")}
                      </label>
                      <textarea
                        value={gameSpecialInstructions}
                        onChange={(event) => setGameSpecialInstructions(event.target.value)}
                        placeholder={localizeUi("ui.game.gamesetupwizard.writeInTheStyleOfTerryPratchett")}
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
                            className={
                              customGamePromptEnabled ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                            }
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--foreground)]">
                              {localizeUi("ui.game.gamesetupwizard.gmPrompt")}
                            </p>
                            <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                              {customGamePromptEnabled
                                ? gameSystemPromptEdited
                                  ? localizeUi("ui.game.gamesetupwizard.customPromptWillOverrideTheSelectedPrompt")
                                  : localizeUi("ui.game.gamesetupwizard.previewingTheSelectedPromptEditItToOverride")
                                : gamePresentation === "anime"
                                  ? localizeUi("ui.game.gamesetupwizard.usingStoryboardGamePrompt")
                                  : selectedPromptPresetName
                                    ? localizeUi("ui.game.gamesetupwizard.usingValue1", {
                                        value1: selectedPromptPresetName,
                                      })
                                    : localizeUi("ui.game.gamesetupwizard.usingDefaultGamePrompt")}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                            {customGamePromptEnabled
                              ? gameSystemPromptEdited
                                ? localizeUi("settings.notifications.customSound.status.custom")
                                : localizeUi("settings.notifications.customSound.actions.preview")
                              : gamePresentation === "anime"
                                ? localizeUi("ui.game.gamesurfacecomponent.storyboard")
                                : selectedPromptPresetName
                                  ? localizeUi("chat.toolbar.preset")
                                  : localizeUi("ui.noodle.noodlehome.default")}
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
                              {localizeUi(
                                "ui.game.gamesetupwizard.leavingThisUnchangedKeepsTheSelectedPresentationOrPreset",
                              )}
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
                              {localizeUi("ui.game.gamesetupwizard.resetToSelected")}
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
                        ? localizeUi("ui.game.gamesetupwizard.theWorldIsReadyNowDraftingItsMapFor")
                        : isLinkingSharedWorld
                          ? localizeUi("ui.game.gamesetupwizard.theGameIsReadyNowLinkingItsSharedWorld")
                          : localizeUi("ui.game.gamesetupwizard.holdOnTightTheGameIsBeingGeneratedRight")}
                    </span>
                    <span aria-hidden="true" className="shrink-0 tabular-nums text-[var(--muted-foreground)]">
                      {generationElapsedSeconds}
                      {localizeUi("ui.noodle.stageprofileview.s")}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]/60"
                    role="progressbar"
                    aria-label={
                      isDraftingMap
                        ? localizeUi("ui.game.gamesetupwizard.draftingHierarchicalWorldMap")
                        : isLinkingSharedWorld
                          ? localizeUi("ui.game.gamesetupwizard.linkingSharedWorld")
                          : localizeUi("ui.game.gamesetupwizard.generatingGameWorld")
                    }
                  >
                    <motion.div
                      className="h-full w-2/5 rounded-full bg-[var(--primary)]"
                      animate={prefersReducedMotion ? { x: 0 } : { x: ["-110%", "260%"] }}
                      transition={
                        prefersReducedMotion ? undefined : { duration: 1.35, ease: [0.16, 1, 0.3, 1], repeat: Infinity }
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
                    aria-label={localizeUi("ui.game.gamesetupwizard.goToValue1", { value1: item.title })}
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

              {step === steps.length - 1 && canStartMessage && (
                <p className="mb-3 text-center text-[0.6875rem] text-[var(--destructive)]">{canStartMessage}</p>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={step === 0 ? onCancel : () => setStep(step - 1)}
                  disabled={isLoading}
                  className={cn(GAME_SETUP_GHOST_BUTTON_CLASS, "disabled:cursor-wait disabled:opacity-40")}
                >
                  <ArrowLeft size={14} />
                  {step === 0 ? localizeUi("chat.delete.dialog.cancel") : localizeUi("ui.noodle.noodlerframe.back")}
                </button>

                {step < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    disabled={isLoading}
                    className={GAME_SETUP_PRIMARY_BUTTON_CLASS}
                  >
                    {localizeUi("onboarding.actions.next")}
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleExportSetup}
                      disabled={isLoading}
                      className={cn(GAME_SETUP_GHOST_BUTTON_CLASS, "disabled:cursor-wait disabled:opacity-40")}
                    >
                      <Download size={14} />
                      {localizeUi("ui.game.gamesetupsummary.downloadSetup")}
                    </button>
                    <button
                      type="button"
                      onClick={handleComplete}
                      disabled={isLoading || !canStart}
                      className={GAME_SETUP_PRIMARY_BUTTON_CLASS}
                      title={canStartMessage ?? undefined}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          {isDraftingMap
                            ? localizeUi("ui.game.gamesetupwizard.draftingMap")
                            : isLinkingSharedWorld
                              ? localizeUi("ui.game.gamesetupwizard.linkingWorld")
                              : localizeUi("ui.game.gamesetupwizard.generatingWorld")}
                        </>
                      ) : (
                        <>
                          <Wand2 size={14} />
                          {localizeUi("ui.game.gamesurfacecomponent.startGame")}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      {spatialTemplatePickerOpen && (
        <CapabilityElement
          packageId="hierarchical-maps"
          view="setup"
          capabilityProps={{
            supportedSelectionKinds: ["template", "shared-world"],
            onSelect: handleSpatialTemplateSelected,
            onClose: () => setSpatialTemplatePickerOpen(false),
          }}
        />
      )}
    </>
  );
}
