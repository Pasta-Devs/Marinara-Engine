import {
  ANIME_GAME_PROMPT_TEMPLATE_ID,
  COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE_ID,
  GAME_STORYBOARD_COMIC_ANIMATION_PROMPT_TEMPLATE_ID,
  STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE_ID,
  generationParametersSchema,
  type GameInitialSetupConnectionSnapshot,
  type GameInitialSetupLabels,
  type GameInitialSetupSnapshot,
  type GameSetupConfig,
  type GenerationParameters,
} from "@marinara-engine/shared";

export const GAME_SETUP_SHARE_FORMAT = "marinara-game-setup";
export const GAME_SETUP_SHARE_VERSION = 1;

export interface GameSetupShareLabels {
  characterNames?: Readonly<Record<string, string>>;
  connectionNames?: Readonly<Record<string, string>>;
  lorebookNames?: Readonly<Record<string, string>>;
  promptPresetNames?: Readonly<Record<string, string>>;
  personaName?: string | null;
}

export interface GameSetupShareSource {
  gameName: string;
  config: GameSetupConfig;
  effectiveGenerationParameters?: Partial<GenerationParameters> | null;
  preferences?: string | null;
  connections?: {
    gm?: GameInitialSetupConnectionSnapshot | null;
    scene?: GameInitialSetupConnectionSnapshot | null;
    image?: GameInitialSetupConnectionSnapshot | null;
    video?: GameInitialSetupConnectionSnapshot | null;
  };
  fallbackGmConnectionId?: string | null;
  labels?: GameSetupShareLabels;
  createdAt?: string | null;
}

export interface GameSetupShareFile {
  format: typeof GAME_SETUP_SHARE_FORMAT;
  version: typeof GAME_SETUP_SHARE_VERSION;
  exportedAt: string;
  gameName: string;
  gmConnectionId?: string | null;
  setup: GameInitialSetupSnapshot;
}

export interface GameSetupImportConnection {
  id: string;
  name: string;
  provider?: string | null;
  model?: string | null;
  imageService?: string | null;
  videoService?: string | null;
}

export interface GameSetupImportContext {
  characters: ReadonlyArray<{ id: string; name: string }>;
  connections: ReadonlyArray<GameSetupImportConnection>;
  lorebooks: ReadonlyArray<{ id: string; name: string }>;
  personas: ReadonlyArray<{ id: string; name: string }>;
  promptPresets: ReadonlyArray<{ id: string; name: string }>;
}

export interface ResolvedGameSetupImport {
  gameName: string;
  config: GameSetupConfig;
  preferences: string;
  effectiveGenerationParameters: Partial<GenerationParameters> | null;
  gmConnectionId: string | null;
  warnings: string[];
}

export interface GameSetupSummaryRow {
  label: string;
  value: string;
}

export interface GameSetupSummarySection {
  title: string;
  rows: GameSetupSummaryRow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const importedGenerationParametersSchema = generationParametersSchema.partial().strict();

function parseGenerationParameters(value: unknown): Partial<GenerationParameters> | undefined {
  if (value === undefined) return undefined;
  const parsed = importedGenerationParametersSchema.safeParse(value);
  if (!parsed.success) throw new Error("This file has invalid generation parameters.");
  return parsed.data;
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  label: string,
  maxLength = 50_000,
): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`This file is missing a valid ${label}.`);
  }
  if (value.length > maxLength) {
    throw new Error(`This file's ${label} is too long.`);
  }
  return value;
}

function optionalStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0,
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function parseShareLabels(value: unknown): GameInitialSetupLabels | undefined {
  if (!isRecord(value)) return undefined;
  const labels: GameInitialSetupLabels = {
    characterNames: optionalStringRecord(value.characterNames),
    lorebookNames: optionalStringRecord(value.lorebookNames),
    promptPresetNames: optionalStringRecord(value.promptPresetNames),
    personaName: typeof value.personaName === "string" ? value.personaName : null,
  };
  return Object.values(labels).some((entry) => entry != null) ? labels : undefined;
}

function parseConnectionSnapshot(value: unknown): GameInitialSetupConnectionSnapshot | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) return null;
  return {
    name: value.name.trim(),
    provider: typeof value.provider === "string" ? value.provider : null,
    model: typeof value.model === "string" ? value.model : null,
    service: typeof value.service === "string" ? value.service : null,
  };
}

function parseShareConnections(value: unknown): GameInitialSetupSnapshot["connections"] {
  if (!isRecord(value)) return undefined;
  return {
    gm: parseConnectionSnapshot(value.gm),
    scene: parseConnectionSnapshot(value.scene),
    image: parseConnectionSnapshot(value.image),
    video: parseConnectionSnapshot(value.video),
  };
}

function parseShareConfig(value: unknown): GameSetupConfig {
  if (!isRecord(value)) throw new Error("This file does not contain Game Mode setup settings.");

  const gmMode = value.gmMode;
  if (gmMode !== "standalone" && gmMode !== "character") {
    throw new Error("This file has an invalid Game Master mode.");
  }
  const rating = value.rating;
  if (rating !== "sfw" && rating !== "nsfw") {
    throw new Error("This file has an invalid content rating.");
  }
  if (!Array.isArray(value.partyCharacterIds) || value.partyCharacterIds.some((id) => typeof id !== "string")) {
    throw new Error("This file has an invalid starting party.");
  }
  if (typeof value.playerGoals !== "string" || value.playerGoals.length > 2_000) {
    throw new Error("This file has invalid player goals.");
  }

  const optionalStrings: Record<string, number> = {
    gmCharacterId: 1_000,
    personaId: 1_000,
    sceneConnectionId: 1_000,
    imageConnectionId: 1_000,
    videoConnectionId: 1_000,
    gameGmPromptTemplateId: 200,
    gameStoryboardAnimationPromptTemplateId: 200,
    gameStoryboardImagePromptTemplateId: 200,
    gameStoryboardVideoPromptTemplateId: 200,
    artStylePrompt: 500,
    generatedArtStylePrompt: 500,
    imageStyleProfileId: 1_000,
    spotifyPlaylistId: 1_000,
    spotifyPlaylistName: 1_000,
    spotifyArtist: 1_000,
    language: 100,
    promptPresetId: 1_000,
    gameSystemPrompt: 50_000,
    gameSpecialInstructions: 2_000,
  };
  for (const [key, maxLength] of Object.entries(optionalStrings)) {
    const entry = value[key];
    if (entry != null && (typeof entry !== "string" || entry.length > maxLength)) {
      throw new Error(`This file has an invalid ${titleCaseToken(key)} value.`);
    }
  }

  const optionalBooleans = [
    "enableSpriteGeneration",
    "gameStoryboardAutoIllustrationsEnabled",
    "gameStoryboardAutoGenerationEnabled",
    "useCampaignArtStyle",
    "enableCustomWidgets",
    "enableSpotifyDj",
    "enableLorebookKeeper",
  ];
  for (const key of optionalBooleans) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      throw new Error(`This file has an invalid ${titleCaseToken(key)} value.`);
    }
  }

  if (value.combatStyle !== undefined && value.combatStyle !== "classic" && value.combatStyle !== "tactical") {
    throw new Error("This file has an invalid combat style.");
  }
  if (
    value.spotifySourceType !== undefined &&
    value.spotifySourceType !== "liked" &&
    value.spotifySourceType !== "playlist" &&
    value.spotifySourceType !== "artist" &&
    value.spotifySourceType !== "any"
  ) {
    throw new Error("This file has an invalid Spotify source type.");
  }
  if (
    value.gameStoryboardKeyframeCount !== undefined &&
    (typeof value.gameStoryboardKeyframeCount !== "number" || !Number.isFinite(value.gameStoryboardKeyframeCount))
  ) {
    throw new Error("This file has an invalid storyboard keyframe count.");
  }
  if (
    value.activeLorebookIds !== undefined &&
    (!Array.isArray(value.activeLorebookIds) || value.activeLorebookIds.some((id) => typeof id !== "string"))
  ) {
    throw new Error("This file has invalid active lorebooks.");
  }
  if (value.customHudWidgets !== undefined && !Array.isArray(value.customHudWidgets)) {
    throw new Error("This file has invalid HUD widgets.");
  }
  const generationParameters = parseGenerationParameters(value.generationParameters);

  return {
    ...(value as unknown as GameSetupConfig),
    genre: requireString(value, "genre", "genre", 200),
    setting: requireString(value, "setting", "setting"),
    tone: requireString(value, "tone", "tone", 200),
    difficulty: requireString(value, "difficulty", "difficulty", 100),
    playerGoals: value.playerGoals,
    gmMode,
    rating,
    partyCharacterIds: [...value.partyCharacterIds],
    generationParameters,
  };
}

export function buildGameSetupShareFile(
  source: GameSetupShareSource,
  exportedAt = new Date().toISOString(),
): GameSetupShareFile {
  const labels: GameInitialSetupLabels | undefined = source.labels
    ? {
        characterNames: source.labels.characterNames ? { ...source.labels.characterNames } : undefined,
        lorebookNames: source.labels.lorebookNames ? { ...source.labels.lorebookNames } : undefined,
        promptPresetNames: source.labels.promptPresetNames ? { ...source.labels.promptPresetNames } : undefined,
        personaName: source.labels.personaName ?? null,
      }
    : undefined;

  return {
    format: GAME_SETUP_SHARE_FORMAT,
    version: GAME_SETUP_SHARE_VERSION,
    exportedAt,
    gameName: source.gameName,
    gmConnectionId: source.fallbackGmConnectionId ?? null,
    setup: {
      config: source.config,
      effectiveGenerationParameters: source.effectiveGenerationParameters ?? source.config.generationParameters ?? null,
      preferences: source.preferences?.trim() || null,
      connections: source.connections
        ? {
            gm: source.connections.gm ?? null,
            scene: source.connections.scene ?? null,
            image: source.connections.image ?? null,
            video: source.connections.video ?? null,
          }
        : undefined,
      labels,
      createdAt: source.createdAt?.trim() || exportedAt,
    },
  };
}

export function parseGameSetupShareFileJson(text: string): GameSetupShareFile {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Choose a reusable Game Mode setup JSON file, not the readable text summary.");
  }
  if (!isRecord(value) || value.format !== GAME_SETUP_SHARE_FORMAT) {
    throw new Error("This is not a Marinara Game Mode setup file.");
  }
  if (value.version !== GAME_SETUP_SHARE_VERSION) {
    throw new Error(`This Game Mode setup file uses unsupported version ${String(value.version ?? "unknown")}.`);
  }
  if (!isRecord(value.setup)) throw new Error("This file does not contain a saved setup snapshot.");

  const setup = value.setup;
  if (setup.preferences != null && typeof setup.preferences !== "string") {
    throw new Error("This file has invalid additional preferences.");
  }
  if (typeof setup.preferences === "string" && setup.preferences.length > 5_000) {
    throw new Error("This file's additional preferences are too long.");
  }
  const effectiveGenerationParameters =
    setup.effectiveGenerationParameters == null
      ? null
      : (parseGenerationParameters(setup.effectiveGenerationParameters) ?? null);

  return {
    format: GAME_SETUP_SHARE_FORMAT,
    version: GAME_SETUP_SHARE_VERSION,
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : new Date(0).toISOString(),
    gameName: requireString(value, "gameName", "game name", 200),
    gmConnectionId: typeof value.gmConnectionId === "string" ? value.gmConnectionId : null,
    setup: {
      config: parseShareConfig(setup.config),
      effectiveGenerationParameters,
      preferences: typeof setup.preferences === "string" ? setup.preferences : null,
      connections: parseShareConnections(setup.connections),
      labels: parseShareLabels(setup.labels),
      createdAt: typeof setup.createdAt === "string" ? setup.createdAt : new Date(0).toISOString(),
    },
  };
}

function normalizeLookupValue(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function resolveNamedResourceId(
  sourceId: string | null | undefined,
  sourceName: string | null | undefined,
  resources: ReadonlyArray<{ id: string; name: string }>,
): string | null {
  if (sourceId && resources.some((resource) => resource.id === sourceId)) return sourceId;
  const normalizedName = normalizeLookupValue(sourceName);
  if (!normalizedName) return null;
  const matches = resources.filter((resource) => normalizeLookupValue(resource.name) === normalizedName);
  return matches.length === 1 ? matches[0]!.id : null;
}

function resolveConnectionId(
  sourceId: string | null | undefined,
  snapshot: GameInitialSetupConnectionSnapshot | null | undefined,
  connections: ReadonlyArray<GameSetupImportConnection>,
): string | null {
  if (sourceId && connections.some((connection) => connection.id === sourceId)) return sourceId;
  if (!snapshot) return null;

  const name = normalizeLookupValue(snapshot.name);
  const provider = normalizeLookupValue(snapshot.provider);
  const model = normalizeLookupValue(snapshot.model);
  const service = normalizeLookupValue(snapshot.service);
  const candidates = connections.filter((connection) => normalizeLookupValue(connection.name) === name);
  if (candidates.length === 0) return null;
  const pool = candidates;

  const scored = pool
    .map((connection) => {
      let score = candidates.includes(connection) ? 8 : 0;
      if (provider && normalizeLookupValue(connection.provider) === provider) score += 4;
      if (model && normalizeLookupValue(connection.model) === model) score += 3;
      if (
        service &&
        [connection.imageService, connection.videoService].some(
          (candidate) => normalizeLookupValue(candidate) === service,
        )
      ) {
        score += 2;
      }
      return { connection, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 || (scored[1] && scored[0]!.score === scored[1].score && candidates.length !== 1)) {
    return null;
  }
  return scored[0]!.connection.id;
}

function describeSavedResource(sourceName: string | null | undefined, fallback: string): string {
  return sourceName?.trim() ? `“${sourceName.trim()}”` : fallback;
}

export function resolveGameSetupImport(
  file: GameSetupShareFile,
  context: GameSetupImportContext,
): ResolvedGameSetupImport {
  const { config: sourceConfig, labels, connections: snapshots } = file.setup;
  const warnings: string[] = [];

  const gmCharacterName = sourceConfig.gmCharacterId ? labels?.characterNames?.[sourceConfig.gmCharacterId] : null;
  const gmCharacterId = resolveNamedResourceId(sourceConfig.gmCharacterId, gmCharacterName, context.characters);
  let gmMode = sourceConfig.gmMode;
  if (gmMode === "character" && !gmCharacterId) {
    warnings.push(
      `${describeSavedResource(gmCharacterName, "The saved GM character")} is unavailable; using a standalone narrator.`,
    );
    gmMode = "standalone";
  }

  const partyCharacterIds = sourceConfig.partyCharacterIds.flatMap((sourceId) => {
    const sourceName = labels?.characterNames?.[sourceId];
    const resolvedId = resolveNamedResourceId(sourceId, sourceName, context.characters);
    if (resolvedId) return [resolvedId];
    warnings.push(`${describeSavedResource(sourceName, "A saved party member")} is unavailable and was skipped.`);
    return [];
  });

  const personaId = resolveNamedResourceId(sourceConfig.personaId, labels?.personaName, context.personas);
  if (sourceConfig.personaId && !personaId) {
    warnings.push(`${describeSavedResource(labels?.personaName, "The saved player persona")} is unavailable.`);
  }

  const activeLorebookIds = (sourceConfig.activeLorebookIds ?? []).flatMap((sourceId) => {
    const sourceName = labels?.lorebookNames?.[sourceId];
    const resolvedId = resolveNamedResourceId(sourceId, sourceName, context.lorebooks);
    if (resolvedId) return [resolvedId];
    warnings.push(`${describeSavedResource(sourceName, "A saved lorebook")} is unavailable and was skipped.`);
    return [];
  });

  const promptPresetName = sourceConfig.promptPresetId
    ? labels?.promptPresetNames?.[sourceConfig.promptPresetId]
    : null;
  const promptPresetId = resolveNamedResourceId(sourceConfig.promptPresetId, promptPresetName, context.promptPresets);
  if (sourceConfig.promptPresetId && !promptPresetId) {
    warnings.push(`${describeSavedResource(promptPresetName, "The saved prompt preset")} is unavailable.`);
  }

  const gmConnectionId = resolveConnectionId(file.gmConnectionId, snapshots?.gm, context.connections);
  if ((file.gmConnectionId || snapshots?.gm) && !gmConnectionId) {
    warnings.push(
      `${describeSavedResource(snapshots?.gm?.name, "The saved GM connection")} is unavailable; select one before starting.`,
    );
  }
  const sceneConnectionId = resolveConnectionId(sourceConfig.sceneConnectionId, snapshots?.scene, context.connections);
  const imageConnectionId = resolveConnectionId(sourceConfig.imageConnectionId, snapshots?.image, context.connections);
  const videoConnectionId = resolveConnectionId(sourceConfig.videoConnectionId, snapshots?.video, context.connections);
  if ((sourceConfig.sceneConnectionId || snapshots?.scene) && !sceneConnectionId) {
    warnings.push(`${describeSavedResource(snapshots?.scene?.name, "The saved scene connection")} is unavailable.`);
  }
  if ((sourceConfig.imageConnectionId || snapshots?.image) && !imageConnectionId) {
    warnings.push(`${describeSavedResource(snapshots?.image?.name, "The saved image connection")} is unavailable.`);
  }
  if ((sourceConfig.videoConnectionId || snapshots?.video) && !videoConnectionId) {
    warnings.push(`${describeSavedResource(snapshots?.video?.name, "The saved video connection")} is unavailable.`);
  }

  return {
    gameName: file.gameName,
    config: {
      ...sourceConfig,
      gmMode,
      gmCharacterId,
      partyCharacterIds: [...new Set(partyCharacterIds)],
      personaId,
      sceneConnectionId: sceneConnectionId ?? undefined,
      imageConnectionId: imageConnectionId ?? undefined,
      videoConnectionId: videoConnectionId ?? undefined,
      activeLorebookIds: [...new Set(activeLorebookIds)],
      promptPresetId,
    },
    preferences: file.setup.preferences ?? "",
    effectiveGenerationParameters: file.setup.effectiveGenerationParameters ?? null,
    gmConnectionId,
    warnings: [...new Set(warnings)],
  };
}

function titleCaseToken(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (value == null) return "None";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "string") return value.trim() || "None";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "None";
  if (Array.isArray(value)) return value.map(formatValue).join(", ") || "None";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatNamedSelection(
  id: string | null | undefined,
  labels: Readonly<Record<string, string>> | undefined,
  fallback: string,
): string {
  if (!id) return fallback;
  return labels?.[id]?.trim() || "Selected locally (name unavailable)";
}

function formatConnectionSnapshot(snapshot: GameInitialSetupConnectionSnapshot | null | undefined): string | null {
  if (!snapshot?.name?.trim()) return null;
  const identifiers = [snapshot.model, snapshot.service]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  const provider = snapshot.provider?.trim() ? titleCaseToken(snapshot.provider.trim()) : null;
  return [snapshot.name.trim(), ...new Set(identifiers), provider].filter(Boolean).join(" · ");
}

function formatConnection(
  snapshot: GameInitialSetupConnectionSnapshot | null | undefined,
  fallbackId: string | null | undefined,
  labels: Readonly<Record<string, string>> | undefined,
  fallback: string,
): string {
  return formatConnectionSnapshot(snapshot) ?? formatNamedSelection(fallbackId, labels, fallback);
}

function formatMusicSource(config: GameSetupConfig): string {
  if (!config.enableSpotifyDj) return "Off";
  if (config.spotifySourceType === "playlist") {
    return config.spotifyPlaylistName?.trim() || "Selected Spotify playlist";
  }
  if (config.spotifySourceType === "artist") return config.spotifyArtist?.trim() || "Selected Spotify artist";
  if (config.spotifySourceType === "any") return "Any Spotify music";
  return "Liked Spotify songs";
}

function formatWidgets(config: GameSetupConfig): string {
  const widgets = config.customHudWidgets ?? [];
  if (widgets.length > 0) {
    return widgets
      .map((widget) =>
        [
          `${widget.label} (${titleCaseToken(widget.type)})`,
          formatValue({
            position: widget.position,
            icon: widget.icon,
            accent: widget.accent,
            config: widget.config,
          }),
        ].join("\n"),
      )
      .join("\n\n");
  }
  return config.enableCustomWidgets === false ? "Off" : "Designed automatically during setup";
}

function formatPresentation(config: GameSetupConfig): string {
  const selectedIds = [
    config.gameGmPromptTemplateId,
    config.gameStoryboardAnimationPromptTemplateId,
    config.gameStoryboardImagePromptTemplateId,
    config.gameStoryboardVideoPromptTemplateId,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (selectedIds.length === 0) return "Standard";
  if (
    config.gameGmPromptTemplateId === ANIME_GAME_PROMPT_TEMPLATE_ID &&
    config.gameStoryboardAnimationPromptTemplateId === GAME_STORYBOARD_COMIC_ANIMATION_PROMPT_TEMPLATE_ID &&
    (!config.gameStoryboardImagePromptTemplateId ||
      config.gameStoryboardImagePromptTemplateId === STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE_ID) &&
    config.gameStoryboardVideoPromptTemplateId === COMIC_PAGE_GAME_VIDEO_PROMPT_TEMPLATE_ID
  ) {
    return "Storyboard Optimized";
  }
  return `Custom (${selectedIds.map(titleCaseToken).join(" + ")})`;
}

function generationParameterRows(parameters: Partial<GenerationParameters> | null | undefined): GameSetupSummaryRow[] {
  const entries = Object.entries(parameters ?? {}).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return [{ label: "Generation parameters", value: "Connection defaults (not captured)" }];
  return entries.map(([key, value]) => ({ label: titleCaseToken(key), value: formatValue(value) }));
}

export function buildGameSetupSummarySections(source: GameSetupShareSource): GameSetupSummarySection[] {
  const { config, preferences, labels, connections } = source;
  const party = config.partyCharacterIds.length
    ? config.partyCharacterIds
        .map((id) => labels?.characterNames?.[id]?.trim())
        .filter((name): name is string => !!name)
        .join(", ") || `${config.partyCharacterIds.length} locally selected characters`
    : "No starting party members";
  const gmCharacter =
    config.gmMode === "character"
      ? formatNamedSelection(config.gmCharacterId, labels?.characterNames, "Selected character")
      : "Standalone narrator";
  const lorebooks = config.activeLorebookIds?.length
    ? config.activeLorebookIds
        .map((id) => labels?.lorebookNames?.[id]?.trim())
        .filter((name): name is string => !!name)
        .join(", ") || `${config.activeLorebookIds.length} locally selected lorebooks`
    : "None";

  return [
    {
      title: "Adventure",
      rows: [
        { label: "Genre", value: config.genre },
        { label: "Setting", value: config.setting },
        { label: "Tone", value: config.tone },
        { label: "Difficulty", value: titleCaseToken(config.difficulty) },
        { label: "Combat style", value: titleCaseToken(config.combatStyle ?? "classic") },
        { label: "Content rating", value: config.rating.toUpperCase() },
        { label: "Language", value: config.language?.trim() || "Default" },
        { label: "Player goals", value: config.playerGoals.trim() || "None" },
        { label: "Additional preferences", value: preferences?.trim() || "None" },
      ],
    },
    {
      title: "Cast",
      rows: [
        { label: "Game master", value: gmCharacter },
        { label: "Player persona", value: labels?.personaName?.trim() || "None" },
        { label: "Starting party", value: party },
      ],
    },
    {
      title: "Models and prompts",
      rows: [
        {
          label: "GM / party connection",
          value: formatConnection(connections?.gm, source.fallbackGmConnectionId, labels?.connectionNames, "Default"),
        },
        {
          label: "Scene effects connection",
          value: formatConnection(
            connections?.scene,
            config.sceneConnectionId,
            labels?.connectionNames,
            "Skip / local fallback",
          ),
        },
        {
          label: "Prompt preset",
          value: formatNamedSelection(config.promptPresetId, labels?.promptPresetNames, "Default"),
        },
        { label: "Presentation", value: formatPresentation(config) },
        { label: "Custom GM prompt", value: config.gameSystemPrompt?.trim() || "Built-in default" },
        { label: "Special instructions", value: config.gameSpecialInstructions?.trim() || "None" },
      ],
    },
    {
      title: "Generation parameters",
      rows: generationParameterRows(source.effectiveGenerationParameters ?? config.generationParameters),
    },
    {
      title: "Visuals and storyboards",
      rows: [
        { label: "Visual generation", value: config.enableSpriteGeneration ? "On" : "Off" },
        {
          label: "Image connection",
          value: formatConnection(connections?.image, config.imageConnectionId, labels?.connectionNames, "None"),
        },
        {
          label: "Image style profile",
          value: config.imageStyleProfileId ? "Selected locally (name unavailable)" : "Default",
        },
        { label: "Art style prompt", value: config.artStylePrompt?.trim() || "Generated during setup" },
        {
          label: "Automatic storyboard illustrations",
          value: config.gameStoryboardAutoIllustrationsEnabled ? "On" : "Off",
        },
        { label: "Automatic storyboard animations", value: config.gameStoryboardAutoGenerationEnabled ? "On" : "Off" },
        { label: "Keyframes per turn", value: formatValue(config.gameStoryboardKeyframeCount ?? 3) },
        {
          label: "Video connection",
          value: formatConnection(connections?.video, config.videoConnectionId, labels?.connectionNames, "None"),
        },
        {
          label: "Storyboard director",
          value: config.gameStoryboardAnimationPromptTemplateId
            ? titleCaseToken(config.gameStoryboardAnimationPromptTemplateId)
            : "Built-in default",
        },
        {
          label: "Storyboard video prompt",
          value: config.gameStoryboardVideoPromptTemplateId
            ? titleCaseToken(config.gameStoryboardVideoPromptTemplateId)
            : "Built-in default",
        },
      ],
    },
    {
      title: "World tools",
      rows: [
        { label: "Active lorebooks", value: lorebooks },
        { label: "HUD widgets", value: formatWidgets(config) },
        { label: "Music DJ", value: formatMusicSource(config) },
        { label: "Lorebook Keeper", value: config.enableLorebookKeeper ? "On" : "Off" },
      ],
    },
  ];
}

export function formatGameSetupShareText(source: GameSetupShareSource): string {
  const sections = buildGameSetupSummarySections(source);
  return [
    `${source.gameName} - Marinara Game Mode Setup`,
    "Recreate this from Game > New Game. Local characters, personas, lorebooks, and connections are named but not included.",
    "",
    ...sections.flatMap((section) => [section.title, ...section.rows.map((row) => `${row.label}: ${row.value}`), ""]),
  ]
    .join("\n")
    .trim();
}
