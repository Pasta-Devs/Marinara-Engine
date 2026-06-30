import { useRef, type ReactNode } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  DEFAULT_AGENT_PROMPT_TEMPLATE_ID,
  getDefaultBuiltInAgentSettings,
  normalizeAgentPromptTemplateSelectionMap,
  type AgentPromptTemplateOption,
  type HapticFeedbackSensitivity,
  type KnowledgeAgentSourceSettings,
  type Lorebook,
  type SpotifySourceType,
} from "@marinara-engine/shared";
import { useKnowledgeSources, useUploadKnowledgeSource } from "../../hooks/use-knowledge-sources";
import { api } from "../../lib/api-client";
import { showAlertDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import {
  DEFAULT_SPRITE_DISPLAY_MODES,
  SPRITE_DISPLAY_OPACITY_MAX,
  SPRITE_DISPLAY_OPACITY_MIN,
  SPRITE_DISPLAY_OPACITY_PERCENT_MAX,
  SPRITE_DISPLAY_OPACITY_PERCENT_MIN,
  SPRITE_DISPLAY_SCALE_MAX,
  SPRITE_DISPLAY_SCALE_MIN,
  SPRITE_DISPLAY_SCALE_PERCENT_MAX,
  SPRITE_DISPLAY_SCALE_PERCENT_MIN,
  hasSpriteDisplayMode,
  normalizeSpriteDisplayModes,
  type SpriteDisplayMode,
} from "./sprite-display-modes";

export type KnowledgeAgentType = "knowledge-retrieval" | "knowledge-router";
export type MusicProvider = "spotify" | "youtube" | "custom";

export type AgentAddSetupState = {
  directorMode: "natural" | "random";
  secretPlotEnabled: boolean;
  secretPlotRunInterval: number;
  proseGuardianBanned: string;
  proseGuardianAvoid: string;
  proseGuardianPrefer: string;
  holdForRewrite: boolean;
  lorebookKeeperTargetLorebookId: string;
  lorebookKeeperReadBehindMessages: number;
  knowledgeSources: Partial<Record<KnowledgeAgentType, KnowledgeAgentSourceSettings>>;
  promptTemplateId: string;
  includeCharacterAppearance: boolean;
  useAvatarReferences: boolean;
  spriteCharacterIds: string[];
  spriteDisplayModes: SpriteDisplayMode[];
  expressionAvatarsEnabled: boolean;
  spritePosition: "left" | "right";
  spriteScale: number;
  expressionSpriteScale: number;
  fullBodySpriteScale: number;
  spriteOpacity: number;
  expressionSpriteOpacity: number;
  fullBodySpriteOpacity: number;
  spotifySourceType: SpotifySourceType;
  spotifyPlaylistId: string;
  spotifyPlaylistName: string | null;
  spotifyArtist: string;
  musicProvider: MusicProvider;
  customMusicFolder: string;
  hapticFeedbackEnabled: boolean;
  hapticSensitivity: HapticFeedbackSensitivity;
  hapticIncidentalContact: boolean;
  hapticIntifaceUrl: string;
};

export type AgentAddSpriteSubject = {
  id: string;
  name: string;
  subtitle?: string | null;
  avatarPath?: string | null;
};

export const DEFAULT_PROSE_GUARDIAN_BANNED_WORDS = "ozone";
export const DEFAULT_PROSE_GUARDIAN_AVOID =
  "no repetition of any phrases or sentence structure from the last messages, if the last output started with dialogue line, this one needs to start with narration, no purple prose";

const HAPTIC_SENSITIVITY_OPTIONS: Array<{
  id: HapticFeedbackSensitivity;
  label: string;
  description: string;
}> = [
  { id: "subtle", label: "Subtle", description: "Lower intensity and shorter feedback." },
  { id: "standard", label: "Standard", description: "Balanced feedback for most scenes." },
  { id: "intense", label: "Intense", description: "Stronger feedback with a higher cap." },
];

const SPOTIFY_SOURCE_OPTIONS: Array<{ id: SpotifySourceType; label: string; description: string }> = [
  { id: "liked", label: "Liked Songs", description: "Pick from the user's saved tracks first." },
  { id: "playlist", label: "Playlist", description: "Keep choices inside one Spotify playlist." },
  { id: "artist", label: "Artist", description: "Search only around a named artist, like HOYO-MiX." },
  { id: "any", label: "Any Spotify", description: "Let the DJ use Spotify search when it fits." },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeSpotifySourceType(value: unknown): SpotifySourceType {
  return value === "playlist" || value === "artist" || value === "any" ? value : "liked";
}

function normalizeMusicProvider(value: unknown, fallback: MusicProvider): MusicProvider {
  return value === "spotify" || value === "youtube" || value === "custom" ? value : fallback;
}

function normalizeCustomMusicFolder(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().replace(/\\/g, "/") : "";
  const normalized = raw.replace(/^\/+/, "").replace(/\/+$/g, "");
  if (!normalized || normalized.includes("..")) return "music";
  return normalized.startsWith("music") ? normalized : `music/${normalized}`;
}

function normalizeHapticSensitivity(value: unknown): HapticFeedbackSensitivity {
  return value === "subtle" || value === "intense" ? value : "standard";
}

function normalizeNonNegativeInteger(value: unknown, fallback: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(numeric)));
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(numeric)));
}

function normalizeSpriteDisplayValue(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function clampSpriteDisplayPercent(value: number): number {
  return Math.max(SPRITE_DISPLAY_SCALE_PERCENT_MIN, Math.min(SPRITE_DISPLAY_SCALE_PERCENT_MAX, value));
}

function clampSpriteOpacityPercent(value: number): number {
  return Math.max(SPRITE_DISPLAY_OPACITY_PERCENT_MIN, Math.min(SPRITE_DISPLAY_OPACITY_PERCENT_MAX, value));
}

function readKnowledgeOverride(sources: unknown, agentType: KnowledgeAgentType): Record<string, unknown> | null {
  if (!isRecord(sources)) return null;
  const entry = sources[agentType];
  return isRecord(entry) ? entry : null;
}

function normalizeKnowledgeAgentSourceSettings(
  agentType: KnowledgeAgentType,
  baseSettings: Record<string, unknown>,
  metadataSources: unknown,
): KnowledgeAgentSourceSettings {
  const defaultSettings = getDefaultBuiltInAgentSettings(agentType);
  const override = readKnowledgeOverride(metadataSources, agentType);
  const useChatActiveLorebooks =
    typeof override?.useChatActiveLorebooks === "boolean"
      ? override.useChatActiveLorebooks
      : typeof baseSettings.useChatActiveLorebooks === "boolean"
        ? baseSettings.useChatActiveLorebooks
        : defaultSettings.useChatActiveLorebooks === true;
  const sourceLorebookIds =
    override && hasOwn(override, "sourceLorebookIds")
      ? normalizeStringArray(override.sourceLorebookIds)
      : normalizeStringArray(baseSettings.sourceLorebookIds);
  const sourceFileIds =
    agentType === "knowledge-retrieval"
      ? override && hasOwn(override, "sourceFileIds")
        ? normalizeStringArray(override.sourceFileIds)
        : normalizeStringArray(baseSettings.sourceFileIds)
      : [];

  return {
    useChatActiveLorebooks,
    sourceLorebookIds,
    ...(agentType === "knowledge-retrieval" ? { sourceFileIds } : {}),
  };
}

function readPromptTemplateId(metadata: Record<string, unknown>, agentId: string): string {
  const selections = normalizeAgentPromptTemplateSelectionMap(metadata.agentPromptTemplateIds);
  return selections[agentId] ?? DEFAULT_AGENT_PROMPT_TEMPLATE_ID;
}

export function buildInitialAgentAddSetupState({
  agentId,
  settings,
  metadata,
  musicPlayerSource,
  roleplaySpriteScale,
  allowSecretPlot = true,
}: {
  agentId: string;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  musicPlayerSource: MusicProvider;
  roleplaySpriteScale: number;
  allowSecretPlot?: boolean;
}): AgentAddSetupState {
  const proseBanned = readString(settings.banned, DEFAULT_PROSE_GUARDIAN_BANNED_WORDS);
  const proseAvoid = readString(settings.avoid, DEFAULT_PROSE_GUARDIAN_AVOID);
  const spotifySourceType = normalizeSpotifySourceType(metadata.spotifySourceType);
  const musicProvider = normalizeMusicProvider(settings.musicProvider ?? settings.musicPlayerSource, musicPlayerSource);
  const spriteScale = normalizeSpriteDisplayValue(
    metadata.spriteScale,
    roleplaySpriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  const spriteOpacity = normalizeSpriteDisplayValue(
    metadata.spriteOpacity,
    1,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );

  return {
    directorMode: settings.directorMode === "random" ? "random" : "natural",
    secretPlotEnabled:
      allowSecretPlot &&
      (typeof metadata.narrativeDirectorSecretPlotEnabled === "boolean"
        ? metadata.narrativeDirectorSecretPlotEnabled
        : settings.secretPlotEnabled === true),
    secretPlotRunInterval: normalizePositiveInteger(
      metadata.narrativeDirectorSecretPlotRunInterval ?? settings.secretPlotRunInterval,
      8,
      100,
    ),
    proseGuardianBanned: proseBanned,
    proseGuardianAvoid: proseAvoid,
    proseGuardianPrefer: readString(settings.prefer),
    holdForRewrite: settings.holdForRewrite !== false,
    lorebookKeeperTargetLorebookId: readString(metadata.lorebookKeeperTargetLorebookId),
    lorebookKeeperReadBehindMessages: normalizeNonNegativeInteger(metadata.lorebookKeeperReadBehindMessages, 0, 100),
    knowledgeSources: {
      "knowledge-retrieval": normalizeKnowledgeAgentSourceSettings(
        "knowledge-retrieval",
        agentId === "knowledge-retrieval" ? settings : {},
        metadata.knowledgeAgentSources,
      ),
      "knowledge-router": normalizeKnowledgeAgentSourceSettings(
        "knowledge-router",
        agentId === "knowledge-router" ? settings : {},
        metadata.knowledgeAgentSources,
      ),
    },
    promptTemplateId: readPromptTemplateId(metadata, agentId),
    includeCharacterAppearance:
      typeof metadata.illustratorIncludeCharacterAppearance === "boolean"
        ? metadata.illustratorIncludeCharacterAppearance
        : settings.includeCharacterAppearance === true,
    useAvatarReferences:
      typeof metadata.illustratorUseAvatarReferences === "boolean"
        ? metadata.illustratorUseAvatarReferences
        : settings.useAvatarReferences === true,
    spriteCharacterIds: normalizeStringArray(metadata.spriteCharacterIds).slice(0, 3),
    spriteDisplayModes: normalizeSpriteDisplayModes(metadata.spriteDisplayModes),
    expressionAvatarsEnabled: metadata.expressionAvatarsEnabled === true,
    spritePosition: metadata.spritePosition === "right" ? "right" : "left",
    spriteScale,
    expressionSpriteScale: normalizeSpriteDisplayValue(
      metadata.expressionSpriteScale,
      spriteScale,
      SPRITE_DISPLAY_SCALE_MIN,
      SPRITE_DISPLAY_SCALE_MAX,
    ),
    fullBodySpriteScale: normalizeSpriteDisplayValue(
      metadata.fullBodySpriteScale,
      spriteScale,
      SPRITE_DISPLAY_SCALE_MIN,
      SPRITE_DISPLAY_SCALE_MAX,
    ),
    spriteOpacity,
    expressionSpriteOpacity: normalizeSpriteDisplayValue(
      metadata.expressionSpriteOpacity,
      spriteOpacity,
      SPRITE_DISPLAY_OPACITY_MIN,
      SPRITE_DISPLAY_OPACITY_MAX,
    ),
    fullBodySpriteOpacity: normalizeSpriteDisplayValue(
      metadata.fullBodySpriteOpacity,
      spriteOpacity,
      SPRITE_DISPLAY_OPACITY_MIN,
      SPRITE_DISPLAY_OPACITY_MAX,
    ),
    spotifySourceType,
    spotifyPlaylistId: readString(metadata.spotifyPlaylistId),
    spotifyPlaylistName: readString(metadata.spotifyPlaylistName) || null,
    spotifyArtist: readString(metadata.spotifyArtist),
    musicProvider,
    customMusicFolder: normalizeCustomMusicFolder(settings.customMusicFolder ?? metadata.customMusicFolder),
    hapticFeedbackEnabled: metadata.enableHapticFeedback === true,
    hapticSensitivity: normalizeHapticSensitivity(metadata.hapticSensitivity),
    hapticIncidentalContact: metadata.hapticIncidentalContact === true,
    hapticIntifaceUrl: readString(metadata.hapticIntifaceUrl),
  };
}

export function applyAgentAddSetupToAgentSettings(
  agentId: string,
  setup: AgentAddSetupState,
  settings: Record<string, unknown>,
  options?: { allowSecretPlot?: boolean },
): Record<string, unknown> {
  const next = { ...settings };
  if (agentId === "director") {
    next.directorMode = setup.directorMode;
    next.secretPlotEnabled = options?.allowSecretPlot === false ? false : setup.secretPlotEnabled;
    next.secretPlotRunInterval = setup.secretPlotRunInterval;
    delete next.runInterval;
  }
  if (agentId === "prose-guardian") {
    next.banned = setup.proseGuardianBanned.trim();
    next.avoid = setup.proseGuardianAvoid.trim();
    next.prefer = setup.proseGuardianPrefer.trim();
    next.holdForRewrite = setup.holdForRewrite;
  }
  if (agentId === "continuity" || agentId === "html") {
    next.holdForRewrite = setup.holdForRewrite;
  }
  if (agentId === "knowledge-retrieval" || agentId === "knowledge-router") {
    next.useChatActiveLorebooks = setup.knowledgeSources[agentId]?.useChatActiveLorebooks !== false;
    next.sourceLorebookIds = setup.knowledgeSources[agentId]?.sourceLorebookIds ?? [];
    if (agentId === "knowledge-retrieval") {
      next.sourceFileIds = setup.knowledgeSources[agentId]?.sourceFileIds ?? [];
    } else {
      delete next.sourceFileIds;
    }
  }
  if (agentId === "spotify") {
    next.musicProvider = setup.musicProvider;
    next.customMusicFolder = normalizeCustomMusicFolder(setup.customMusicFolder);
    next.enabledTools =
      setup.musicProvider === "spotify" ? next.enabledTools : [];
  }
  if (agentId === "illustrator") {
    next.includeCharacterAppearance = setup.includeCharacterAppearance;
    next.useAvatarReferences = setup.useAvatarReferences;
  }
  return next;
}

export function buildAgentAddMetadataPatch(
  agentId: string,
  setup: AgentAddSetupState,
  metadata: Record<string, unknown>,
  options?: { allowSecretPlot?: boolean },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  const existingPromptSelections = normalizeAgentPromptTemplateSelectionMap(metadata.agentPromptTemplateIds);
  const nextPromptSelections = { ...existingPromptSelections };
  if (setup.promptTemplateId && setup.promptTemplateId !== DEFAULT_AGENT_PROMPT_TEMPLATE_ID) {
    nextPromptSelections[agentId] = setup.promptTemplateId;
  } else {
    delete nextPromptSelections[agentId];
  }
  if (
    existingPromptSelections[agentId] !== nextPromptSelections[agentId] ||
    Object.keys(existingPromptSelections).length !== Object.keys(nextPromptSelections).length
  ) {
    patch.agentPromptTemplateIds = nextPromptSelections;
  }

  if (agentId === "director") {
    patch.narrativeDirectorMode = setup.directorMode;
    patch.narrativeDirectorSecretPlotEnabled = options?.allowSecretPlot === false ? false : setup.secretPlotEnabled;
    patch.narrativeDirectorSecretPlotRunInterval = setup.secretPlotRunInterval;
  }
  if (agentId === "prose-guardian") {
    patch.proseGuardianBannedWords = setup.proseGuardianBanned.trim();
    patch.proseGuardianAvoidInstructions = setup.proseGuardianAvoid.trim();
    patch.proseGuardianStyleInstructions = setup.proseGuardianPrefer.trim();
    patch.proseGuardianHoldForRewrite = setup.holdForRewrite;
  }
  if (agentId === "continuity" || agentId === "html") patch.proseGuardianHoldForRewrite = setup.holdForRewrite;
  if (agentId === "knowledge-retrieval" || agentId === "knowledge-router") {
    const currentSources = isRecord(metadata.knowledgeAgentSources) ? metadata.knowledgeAgentSources : {};
    patch.knowledgeAgentSources = {
      ...currentSources,
      [agentId]: setup.knowledgeSources[agentId],
    };
  }
  if (agentId === "lorebook-keeper") {
    patch.lorebookKeeperTargetLorebookId = setup.lorebookKeeperTargetLorebookId || null;
    patch.lorebookKeeperReadBehindMessages = setup.lorebookKeeperReadBehindMessages;
  }
  if (agentId === "spotify") {
    patch.customMusicFolder = normalizeCustomMusicFolder(setup.customMusicFolder);
  }
  if (agentId === "expression") {
    patch.spriteDisplayModes = setup.spriteDisplayModes;
    patch.expressionAvatarsEnabled = setup.expressionAvatarsEnabled;
    patch.spriteCharacterIds = setup.spriteCharacterIds;
    patch.spritePosition = setup.spritePosition;
    patch.spriteScale = setup.expressionSpriteScale;
    patch.expressionSpriteScale = setup.expressionSpriteScale;
    patch.fullBodySpriteScale = setup.fullBodySpriteScale;
    patch.spriteOpacity = setup.expressionSpriteOpacity;
    patch.expressionSpriteOpacity = setup.expressionSpriteOpacity;
    patch.fullBodySpriteOpacity = setup.fullBodySpriteOpacity;
  }
  if (agentId === "spotify") {
    patch.spotifySourceType = setup.spotifySourceType;
    patch.spotifyPlaylistId = setup.spotifySourceType === "playlist" ? setup.spotifyPlaylistId || null : null;
    patch.spotifyPlaylistName = setup.spotifySourceType === "playlist" ? setup.spotifyPlaylistName || null : null;
    patch.spotifyArtist = setup.spotifySourceType === "artist" ? setup.spotifyArtist.trim() || null : null;
  }
  if (agentId === "illustrator") {
    patch.illustratorIncludeCharacterAppearance = setup.includeCharacterAppearance;
    patch.illustratorUseAvatarReferences = setup.useAvatarReferences;
  }
  if (agentId === "haptic") {
    patch.enableHapticFeedback = setup.hapticFeedbackEnabled;
    patch.hapticSensitivity = setup.hapticSensitivity;
    patch.hapticIncidentalContact = setup.hapticIncidentalContact;
    patch.hapticIntifaceUrl = setup.hapticIntifaceUrl.trim() || null;
  }

  return patch;
}

function SetupLabel({ children }: { children: ReactNode }) {
  return <span className="text-[0.625rem] font-medium text-[var(--foreground)]">{children}</span>;
}

function SetupTextarea({
  label,
  value,
  placeholder,
  rows,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <SetupLabel>{label}</SetupLabel>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows ?? 3}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[3.25rem] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/45 focus:border-[var(--primary)]/50 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function SetupToggle({
  label,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={enabled}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60",
        enabled
          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
          : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[0.6875rem] font-medium">{label}</span>
        <span className="mt-0.5 block text-[0.625rem] text-[var(--muted-foreground)]">{description}</span>
      </span>
      <span
        className={cn(
          "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
          enabled ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
        )}
      >
        <span
          className={cn(
            "block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            enabled && "translate-x-3.5",
          )}
        />
      </span>
    </button>
  );
}

function SetupSegmentedControl<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: Array<{ id: T; label: string; description?: string }>;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)]/75 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={cn(
            "rounded-md px-2.5 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60",
            value === option.id
              ? "bg-[var(--primary)]/12 text-[var(--foreground)] ring-1 ring-[var(--primary)]/35"
              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
          )}
        >
          <span className="block text-[0.6875rem] font-semibold">{option.label}</span>
          {option.description ? <span className="mt-0.5 block text-[0.625rem]">{option.description}</span> : null}
        </button>
      ))}
    </div>
  );
}

function PromptTemplateSelect({
  options,
  value,
  disabled,
  onChange,
}: {
  options: AgentPromptTemplateOption[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  if (options.length <= 1) return null;
  const activeOption = options.find((option) => option.id === value) ?? options[0];
  return (
    <div className="rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
      <label className="flex flex-col gap-1.5">
        <SetupLabel>Prompt Mode</SetupLabel>
        <select
          value={activeOption?.id ?? DEFAULT_AGENT_PROMPT_TEMPLATE_ID}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md bg-[var(--secondary)] px-2 py-1.5 text-[0.6875rem] text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      {activeOption?.description ? (
        <p className="mt-1.5 text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
          {activeOption.description}
        </p>
      ) : null}
    </div>
  );
}

function KnowledgeSourceFields({
  agentType,
  lorebooks,
  settings,
  disabled,
  onChange,
}: {
  agentType: KnowledgeAgentType;
  lorebooks: Lorebook[];
  settings: KnowledgeAgentSourceSettings;
  disabled?: boolean;
  onChange: (patch: Partial<KnowledgeAgentSourceSettings>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const knowledgeSourcesQuery = useKnowledgeSources();
  const uploadSource = useUploadKnowledgeSource();
  const sourceLorebookIds = settings.sourceLorebookIds ?? [];
  const sourceFileIds = settings.sourceFileIds ?? [];
  const isRetrieval = agentType === "knowledge-retrieval";

  return (
    <div className="space-y-2.5 rounded-lg bg-[var(--background)]/65 px-3 py-2.5 ring-1 ring-[var(--border)]">
      <SetupToggle
        label="Use chat-active lorebooks"
        description={
          sourceLorebookIds.length > 0
            ? "Fixed source lorebooks are selected below, so they override chat-active lorebooks."
            : "Use the lorebooks currently active for this chat when no fixed source is selected."
        }
        enabled={settings.useChatActiveLorebooks !== false}
        disabled={disabled}
        onToggle={() => onChange({ useChatActiveLorebooks: settings.useChatActiveLorebooks === false })}
      />

      <div className="space-y-1.5">
        <SetupLabel>Fixed Source Lorebooks</SetupLabel>
        {lorebooks.length > 0 ? (
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)]/75 p-2">
            {lorebooks.map((lorebook) => {
              const selected = sourceLorebookIds.includes(lorebook.id);
              return (
                <button
                  key={lorebook.id}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      sourceLorebookIds: selected
                        ? sourceLorebookIds.filter((id) => id !== lorebook.id)
                        : [...sourceLorebookIds, lorebook.id],
                    })
                  }
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? "bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] text-[var(--foreground)] ring-1 ring-transparent hover:bg-[var(--accent)]",
                  )}
                  aria-pressed={selected}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                      selected
                        ? "border-[var(--primary)]/60 bg-[var(--primary)]/20"
                        : "border-[var(--border)] bg-[var(--background)]",
                    )}
                  >
                    {selected && <Check size="0.625rem" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{lorebook.name}</span>
                    {lorebook.description ? (
                      <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                        {lorebook.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            No lorebooks available.
          </p>
        )}
      </div>

      {isRetrieval && (
        <div className="space-y-1.5">
          <SetupLabel>Uploaded Files</SetupLabel>
          {knowledgeSourcesQuery.data?.length ? (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)]/75 p-2">
              {knowledgeSourcesQuery.data.map((source) => {
                const selected = sourceFileIds.includes(source.id);
                return (
                  <button
                    key={source.id}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        sourceFileIds: selected
                          ? sourceFileIds.filter((id) => id !== source.id)
                          : [...sourceFileIds, source.id],
                      })
                    }
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60",
                      selected
                        ? "bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)] text-[var(--foreground)] ring-1 ring-transparent hover:bg-[var(--accent)]",
                    )}
                    aria-pressed={selected}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                        selected
                          ? "border-[var(--primary)]/60 bg-[var(--primary)]/20"
                          : "border-[var(--border)] bg-[var(--background)]",
                      )}
                    >
                      {selected && <Check size="0.625rem" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{source.originalName}</span>
                      <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                        {(source.size / 1024).toFixed(1)} KB
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              No uploaded knowledge files yet.
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.json,.xml,.html,.htm,.log,.yaml,.yml,.tsv,.pdf"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const uploaded = await uploadSource.mutateAsync(file);
                onChange({ sourceFileIds: Array.from(new Set([...sourceFileIds, uploaded.id])) });
              } catch (error) {
                await showAlertDialog({
                  title: "Couldn't Upload File",
                  message: error instanceof Error ? error.message : "The file could not be uploaded.",
                });
              } finally {
                event.target.value = "";
              }
            }}
          />
          <button
            type="button"
            disabled={disabled || uploadSource.isPending}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition-all",
              uploadSource.isPending
                ? "cursor-wait border-[var(--border)] text-[var(--muted-foreground)]/60"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            {uploadSource.isPending ? (
              <>
                <Loader2 size="0.8125rem" className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size="0.8125rem" />
                Upload file
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function SpriteDisplayModeToggle({
  modes,
  disabled,
  onToggle,
}: {
  modes: readonly SpriteDisplayMode[];
  disabled?: boolean;
  onToggle: (mode: SpriteDisplayMode) => void;
}) {
  const options: Array<{ id: SpriteDisplayMode; label: string }> = [
    { id: "expressions", label: "Expressions" },
    { id: "full-body", label: "Full-body" },
  ];

  return (
    <div className="space-y-1.5 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">Sprite Source</span>
        <span className="text-[0.5625rem] text-[var(--muted-foreground)]">choose one or both</span>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-md ring-1 ring-[var(--border)]">
        {options.map((option, index) => {
          const active = hasSpriteDisplayMode(modes, option.id);
          const isLastActive = active && modes.length === 1;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              disabled={disabled || isLastActive}
              className={cn(
                "min-w-0 px-2.5 py-1.5 text-[0.625rem] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                index > 0 && "border-l border-[var(--border)]",
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpriteRangeSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-[var(--secondary)]/50 px-2.5 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--foreground)]">{label}</span>
        <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] tabular-nums text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 w-full cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function ExpressionSetupFields({
  value,
  spriteSubjects,
  disabled,
  onChange,
}: {
  value: AgentAddSetupState;
  spriteSubjects: AgentAddSpriteSubject[];
  disabled?: boolean;
  onChange: (patch: Partial<AgentAddSetupState>) => void;
}) {
  const spriteQueries = useQueries({
    queries: spriteSubjects.map((subject) => ({
      queryKey: ["sprites", subject.id],
      queryFn: () => api.get<Array<{ expression: string; filename: string; url: string }>>(`/sprites/${subject.id}`),
      enabled: !!subject.id,
      staleTime: 5 * 60_000,
    })),
  });
  const subjectsWithSprites = spriteSubjects.filter((_, index) => {
    const sprites = spriteQueries[index]?.data;
    return Array.isArray(sprites) && sprites.length > 0;
  });
  const selectableSpriteIds = new Set(subjectsWithSprites.map((subject) => subject.id));
  const selectedSpriteIds = value.spriteCharacterIds.filter((id) => selectableSpriteIds.has(id));
  const loading =
    spriteSubjects.length > 0 && subjectsWithSprites.length === 0 && spriteQueries.some((query) => query.isLoading);

  const toggleSprite = (id: string) => {
    if (selectedSpriteIds.includes(id)) {
      onChange({ spriteCharacterIds: selectedSpriteIds.filter((current) => current !== id) });
      return;
    }
    if (selectedSpriteIds.length >= 3) return;
    onChange({ spriteCharacterIds: [...selectedSpriteIds, id] });
  };

  const toggleDisplayMode = (mode: SpriteDisplayMode) => {
    const current = value.spriteDisplayModes;
    const next = current.includes(mode) ? current.filter((entry) => entry !== mode) : [...current, mode];
    onChange({ spriteDisplayModes: next.length > 0 ? next : [...DEFAULT_SPRITE_DISPLAY_MODES] });
  };

  return (
    <div className="space-y-2.5 rounded-lg bg-[var(--background)]/65 px-3 py-2.5 ring-1 ring-[var(--border)]">
      <SpriteDisplayModeToggle modes={value.spriteDisplayModes} disabled={disabled} onToggle={toggleDisplayMode} />
      <SetupToggle
        label="Expression Avatars"
        description="Replace message avatars with the selected expression sprite."
        enabled={value.expressionAvatarsEnabled}
        disabled={disabled}
        onToggle={() => onChange({ expressionAvatarsEnabled: !value.expressionAvatarsEnabled })}
      />

      <div className="space-y-1.5">
        <SetupLabel>Sprite Owners</SetupLabel>
        {subjectsWithSprites.length > 0 ? (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)]/75 p-2">
            {subjectsWithSprites.map((subject) => {
              const active = selectedSpriteIds.includes(subject.id);
              const maxed = !active && selectedSpriteIds.length >= 3;
              return (
                <button
                  key={subject.id}
                  type="button"
                  disabled={disabled || maxed}
                  onClick={() => toggleSprite(subject.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50",
                    active
                      ? "bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] text-[var(--foreground)] ring-1 ring-transparent hover:bg-[var(--accent)]",
                  )}
                >
                  {subject.avatarPath ? (
                    <img
                      src={subject.avatarPath}
                      alt={subject.name}
                      loading="lazy"
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[0.625rem] font-bold">
                      {subject.name[0]}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{subject.name}</span>
                    {subject.subtitle ? (
                      <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                        {subject.subtitle}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {active ? "Enabled" : "Enable"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : loading ? (
          <p className="rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            Checking added characters for uploaded sprites...
          </p>
        ) : (
          <p className="rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            No added character or persona has uploaded sprites yet. You can still add Expression Engine and configure
            sprites later.
          </p>
        )}
      </div>

      <div className="rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[0.6875rem] text-[var(--muted-foreground)]">Sprite Layout</span>
          <div className="flex rounded-md ring-1 ring-[var(--border)]">
            {(["left", "right"] as const).map((side) => (
              <button
                key={side}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ spritePosition: side })}
                className={cn(
                  "px-2.5 py-1 text-[0.625rem] font-medium capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  side === "left" ? "rounded-l-md" : "rounded-r-md",
                  value.spritePosition === side
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                )}
              >
                {side}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SpriteRangeSlider
            label="Expression Size"
            value={Math.round(value.expressionSpriteScale * 100)}
            min={SPRITE_DISPLAY_SCALE_PERCENT_MIN}
            max={SPRITE_DISPLAY_SCALE_PERCENT_MAX}
            step={5}
            suffix="%"
            disabled={disabled}
            onChange={(percent) => {
              const clampedPercent = clampSpriteDisplayPercent(percent);
              onChange({ spriteScale: clampedPercent / 100, expressionSpriteScale: clampedPercent / 100 });
            }}
          />
          <SpriteRangeSlider
            label="Full-body Size"
            value={Math.round(value.fullBodySpriteScale * 100)}
            min={SPRITE_DISPLAY_SCALE_PERCENT_MIN}
            max={SPRITE_DISPLAY_SCALE_PERCENT_MAX}
            step={5}
            suffix="%"
            disabled={disabled}
            onChange={(percent) => onChange({ fullBodySpriteScale: clampSpriteDisplayPercent(percent) / 100 })}
          />
          <SpriteRangeSlider
            label="Expression Opacity"
            value={Math.round(value.expressionSpriteOpacity * 100)}
            min={SPRITE_DISPLAY_OPACITY_PERCENT_MIN}
            max={SPRITE_DISPLAY_OPACITY_PERCENT_MAX}
            step={5}
            suffix="%"
            disabled={disabled}
            onChange={(percent) => {
              const clampedPercent = clampSpriteOpacityPercent(percent);
              onChange({ spriteOpacity: clampedPercent / 100, expressionSpriteOpacity: clampedPercent / 100 });
            }}
          />
          <SpriteRangeSlider
            label="Full-body Opacity"
            value={Math.round(value.fullBodySpriteOpacity * 100)}
            min={SPRITE_DISPLAY_OPACITY_PERCENT_MIN}
            max={SPRITE_DISPLAY_OPACITY_PERCENT_MAX}
            step={5}
            suffix="%"
            disabled={disabled}
            onChange={(percent) => onChange({ fullBodySpriteOpacity: clampSpriteOpacityPercent(percent) / 100 })}
          />
        </div>
      </div>
    </div>
  );
}

function MusicDjSetupFields({
  value,
  disabled,
  onChange,
}: {
  value: AgentAddSetupState;
  disabled?: boolean;
  onChange: (patch: Partial<AgentAddSetupState>) => void;
}) {
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
    enabled: value.musicProvider === "spotify" && value.spotifySourceType === "playlist",
    staleTime: 60_000,
    retry: false,
  });

  return (
    <div className="space-y-2.5 rounded-lg bg-[var(--background)]/65 px-3 py-2.5 ring-1 ring-[var(--border)]">
      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
        Active player:{" "}
        {value.musicProvider === "spotify" ? "Spotify" : value.musicProvider === "youtube" ? "YouTube" : "Custom"}.
      </p>
      {value.musicProvider === "spotify" ? (
        <>
          <label className="flex flex-col gap-1">
            <SetupLabel>Spotify Source</SetupLabel>
            <select
              value={value.spotifySourceType}
              disabled={disabled}
              onChange={(event) => {
                const next = normalizeSpotifySourceType(event.target.value);
                onChange({
                  spotifySourceType: next,
                  spotifyPlaylistId: next === "playlist" ? value.spotifyPlaylistId : "",
                  spotifyPlaylistName: next === "playlist" ? value.spotifyPlaylistName : null,
                  spotifyArtist: next === "artist" ? value.spotifyArtist : "",
                });
              }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {SPOTIFY_SOURCE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
              {SPOTIFY_SOURCE_OPTIONS.find((option) => option.id === value.spotifySourceType)?.description ?? ""}
            </span>
          </label>

          {value.spotifySourceType === "playlist" && (
            <label className="flex flex-col gap-1">
              <SetupLabel>Playlist</SetupLabel>
              {spotifyPlaylistsQuery.data?.playlists.length ? (
                <select
                  value={value.spotifyPlaylistId}
                  disabled={disabled}
                  onChange={(event) => {
                    const playlist = spotifyPlaylistsQuery.data?.playlists.find(
                      (entry) => entry.id === event.target.value,
                    );
                    onChange({
                      spotifyPlaylistId: event.target.value || "",
                      spotifyPlaylistName: playlist?.name ?? null,
                    });
                  }}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Choose playlist...</option>
                  {spotifyPlaylistsQuery.data.playlists.map((playlist) => {
                    const suffix =
                      typeof playlist.trackCount === "number"
                        ? ` (${playlist.trackCount})`
                        : playlist.owned === false
                          ? " (followed, unavailable)"
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
                  value={value.spotifyPlaylistId}
                  disabled={disabled}
                  onChange={(event) => onChange({ spotifyPlaylistId: event.target.value, spotifyPlaylistName: null })}
                  placeholder={spotifyPlaylistsQuery.isFetching ? "Loading playlists..." : "Paste playlist ID"}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              )}
              {spotifyPlaylistsQuery.isError && (
                <span className="text-[0.5625rem] text-amber-400/90">
                  Connect Spotify in the Music DJ agent to load playlist names.
                </span>
              )}
            </label>
          )}

          {value.spotifySourceType === "artist" && (
            <label className="flex flex-col gap-1">
              <SetupLabel>Artist</SetupLabel>
              <input
                value={value.spotifyArtist}
                disabled={disabled}
                onChange={(event) => onChange({ spotifyArtist: event.target.value })}
                placeholder="HOYO-MiX"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          )}
        </>
      ) : value.musicProvider === "youtube" ? (
        <p className="rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
          YouTube mode uses the Music DJ agent's saved YouTube connection and embedded player.
        </p>
      ) : (
        <label className="flex flex-col gap-1 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
          <SetupLabel>Custom Music Folder</SetupLabel>
          <input
            value={value.customMusicFolder}
            disabled={disabled}
            onChange={(event) => onChange({ customMusicFolder: event.target.value })}
            onBlur={() => onChange({ customMusicFolder: normalizeCustomMusicFolder(value.customMusicFolder) })}
            placeholder="music"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
            Reads local audio from Game Assets, for example <code>music</code> or <code>music/combat</code>.
          </span>
        </label>
      )}
    </div>
  );
}

function HapticSetupFields({
  value,
  disabled,
  onChange,
}: {
  value: AgentAddSetupState;
  disabled?: boolean;
  onChange: (patch: Partial<AgentAddSetupState>) => void;
}) {
  return (
    <div className="space-y-2.5 rounded-lg bg-[var(--background)]/65 px-3 py-2.5 ring-1 ring-[var(--border)]">
      <SetupToggle
        label="Haptic Feedback"
        description={
          value.hapticFeedbackEnabled
            ? "Touch cues are enabled for this chat."
            : "Allow this agent to send touch cues during the chat."
        }
        enabled={value.hapticFeedbackEnabled}
        disabled={disabled}
        onToggle={() => onChange({ hapticFeedbackEnabled: !value.hapticFeedbackEnabled })}
      />
      {value.hapticFeedbackEnabled && (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <SetupLabel>Touch Sensitivity</SetupLabel>
              <span className="text-[0.5625rem] text-[var(--muted-foreground)]">Roleplay only</span>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--background)]/35 p-1">
              {HAPTIC_SENSITIVITY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ hapticSensitivity: option.id })}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-[0.625rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    value.hapticSensitivity === option.id
                      ? "bg-[var(--accent)] text-[var(--foreground)] ring-1 ring-[var(--border)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                  )}
                  title={option.description}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <SetupToggle
            label="Incidental Contact"
            description="Tiny taps for accidental brushes and bumps."
            enabled={value.hapticIncidentalContact}
            disabled={disabled}
            onToggle={() => onChange({ hapticIncidentalContact: !value.hapticIncidentalContact })}
          />
          <label className="flex flex-col gap-1">
            <SetupLabel>Intiface URL</SetupLabel>
            <input
              value={value.hapticIntifaceUrl}
              disabled={disabled}
              onChange={(event) => onChange({ hapticIntifaceUrl: event.target.value })}
              placeholder="ws://127.0.0.1:12345"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        </>
      )}
    </div>
  );
}

export function AgentAddSetupFields({
  agentId,
  value,
  disabled,
  lorebooks,
  promptOptions,
  spriteSubjects,
  allowSecretPlotControls = true,
  onChange,
}: {
  agentId: string;
  value: AgentAddSetupState;
  disabled?: boolean;
  lorebooks: Lorebook[];
  promptOptions: AgentPromptTemplateOption[];
  spriteSubjects?: AgentAddSpriteSubject[];
  allowSecretPlotControls?: boolean;
  onChange: (patch: Partial<AgentAddSetupState>) => void;
}) {
  const knowledgeAgentType = agentId === "knowledge-retrieval" || agentId === "knowledge-router" ? agentId : null;
  const knowledgeSettings = knowledgeAgentType ? value.knowledgeSources[knowledgeAgentType] : null;
  const hasSpecificSetup =
    promptOptions.length > 1 ||
    agentId === "director" ||
    agentId === "prose-guardian" ||
    agentId === "continuity" ||
    agentId === "html" ||
    agentId === "lorebook-keeper" ||
    knowledgeAgentType ||
    agentId === "illustrator" ||
    agentId === "expression" ||
    agentId === "spotify" ||
    agentId === "haptic";

  if (!hasSpecificSetup) return null;

  return (
    <div className="space-y-3">
      <PromptTemplateSelect
        options={promptOptions}
        value={value.promptTemplateId}
        disabled={disabled}
        onChange={(promptTemplateId) => onChange({ promptTemplateId })}
      />

      {agentId === "illustrator" && (
        <div className="space-y-2">
          <SetupToggle
            label="Attach Card Appearance"
            description="Append matched character appearance lines to image prompts, using only visible/generated names."
            enabled={value.includeCharacterAppearance}
            disabled={disabled}
            onToggle={() => onChange({ includeCharacterAppearance: !value.includeCharacterAppearance })}
          />
          <SetupToggle
            label="Send Avatar References"
            description="Send matching character and persona avatars or sprites as reference images when the provider supports them."
            enabled={value.useAvatarReferences}
            disabled={disabled}
            onToggle={() => onChange({ useAvatarReferences: !value.useAvatarReferences })}
          />
        </div>
      )}

      {agentId === "director" && (
        <div className="space-y-2">
          <SetupSegmentedControl
            value={value.directorMode}
            disabled={disabled}
            options={[
              { id: "natural", label: "Natural", description: "Advance existing story threads." },
              { id: "random", label: "Random Event", description: "Introduce a plausible surprise." },
            ]}
            onChange={(directorMode) => onChange({ directorMode })}
          />
          {allowSecretPlotControls && (
            <SetupToggle
              label="Secret Plot"
              description="Maintain a hidden long-term arc for roleplay prompts."
              enabled={value.secretPlotEnabled}
              disabled={disabled}
              onToggle={() => onChange({ secretPlotEnabled: !value.secretPlotEnabled })}
            />
          )}
          {allowSecretPlotControls && value.secretPlotEnabled && (
            <label className="flex flex-col gap-1 rounded-lg bg-[var(--background)]/65 px-3 py-2 ring-1 ring-[var(--border)]">
              <SetupLabel>Run Interval</SetupLabel>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={value.secretPlotRunInterval}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      secretPlotRunInterval: normalizePositiveInteger(
                        event.target.value,
                        value.secretPlotRunInterval,
                        100,
                      ),
                    })
                  }
                  className="w-24 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs tabular-nums text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">assistant messages</span>
              </div>
            </label>
          )}
        </div>
      )}

      {agentId === "prose-guardian" && (
        <div className="space-y-2.5 rounded-lg bg-[var(--background)]/65 px-3 py-2.5 ring-1 ring-[var(--border)]">
          <div className="grid gap-2 sm:grid-cols-2">
            <SetupTextarea
              label="Banned Words"
              value={value.proseGuardianBanned}
              placeholder={DEFAULT_PROSE_GUARDIAN_BANNED_WORDS}
              rows={2}
              disabled={disabled}
              onChange={(proseGuardianBanned) => onChange({ proseGuardianBanned })}
            />
            <SetupTextarea
              label="Prefer In Writing"
              value={value.proseGuardianPrefer}
              placeholder="Optional style notes, phrases, or authorial preferences."
              rows={2}
              disabled={disabled}
              onChange={(proseGuardianPrefer) => onChange({ proseGuardianPrefer })}
            />
          </div>
          <SetupTextarea
            label="Remove From Writing"
            value={value.proseGuardianAvoid}
            placeholder={DEFAULT_PROSE_GUARDIAN_AVOID}
            rows={3}
            disabled={disabled}
            onChange={(proseGuardianAvoid) => onChange({ proseGuardianAvoid })}
          />
        </div>
      )}

      {(agentId === "prose-guardian" || agentId === "continuity" || agentId === "html") && (
        <SetupToggle
          label="Hold Message Until Rewrite"
          description={
            value.holdForRewrite
              ? "Show the rewrite working indicator, then reveal the edited message."
              : "Stream the original message normally, then replace it if edits are needed."
          }
          enabled={value.holdForRewrite}
          disabled={disabled}
          onToggle={() => onChange({ holdForRewrite: !value.holdForRewrite })}
        />
      )}

      {agentId === "lorebook-keeper" && (
        <div className="grid gap-2 rounded-lg bg-[var(--background)]/65 px-3 py-2.5 ring-1 ring-[var(--border)] sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
            <SetupLabel>Target Lorebook</SetupLabel>
            <select
              value={value.lorebookKeeperTargetLorebookId}
              disabled={disabled}
              onChange={(event) => onChange({ lorebookKeeperTargetLorebookId: event.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Auto-select first writable lorebook</option>
              {lorebooks.map((lorebook) => (
                <option key={lorebook.id} value={lorebook.id}>
                  {lorebook.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
            <SetupLabel>Read Behind</SetupLabel>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={value.lorebookKeeperReadBehindMessages}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  lorebookKeeperReadBehindMessages: normalizeNonNegativeInteger(event.target.value, 0, 100),
                })
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        </div>
      )}

      {knowledgeAgentType && knowledgeSettings && (
        <KnowledgeSourceFields
          agentType={knowledgeAgentType}
          lorebooks={lorebooks}
          settings={knowledgeSettings}
          disabled={disabled}
          onChange={(patch) =>
            onChange({
              knowledgeSources: {
                ...value.knowledgeSources,
                [knowledgeAgentType]: {
                  ...knowledgeSettings,
                  ...patch,
                  ...(knowledgeAgentType === "knowledge-router" ? { sourceFileIds: [] } : {}),
                },
              },
            })
          }
        />
      )}

      {agentId === "expression" && (
        <ExpressionSetupFields
          value={value}
          spriteSubjects={spriteSubjects ?? []}
          disabled={disabled}
          onChange={onChange}
        />
      )}

      {agentId === "spotify" && <MusicDjSetupFields value={value} disabled={disabled} onChange={onChange} />}

      {agentId === "haptic" && <HapticSetupFields value={value} disabled={disabled} onChange={onChange} />}
    </div>
  );
}
