import type { LlmGateway } from "../../../capabilities/llm";
import type { StorageGateway } from "../../../capabilities/storage";
import type { DirectionCommand } from "../../../contracts/types/game";
import type { SceneAnalysis, SceneSegmentEffect } from "../../../contracts/types/scene";
import { parseGameJsonish } from "../../../shared/parsing-jsonish";
import {
  boolish,
  isRecord,
  parseRecord,
  readNonNegativeInteger,
  readString,
  stringArray,
  type JsonRecord,
} from "../../../generation/runtime-records";
import {
  buildSceneAnalyzerSystemPrompt,
  buildSceneAnalyzerUserPrompt,
  type SceneAnalyzerContext,
} from "./scene-analyzer";
import { postProcessSceneResult, type PostProcessContext } from "./scene-postprocess";

export interface GameSceneAnalysisCapabilities {
  storage: StorageGateway;
  llm: LlmGateway;
}

export interface GameSceneAnalysisRequest {
  chatId?: string;
  connectionId?: string | null;
  narration: string;
  context?: JsonRecord;
}

function defaultGameSceneAnalysis(): SceneAnalysis {
  return {
    background: null,
    music: null,
    ambient: null,
    weather: null,
    timeOfDay: null,
    musicGenre: null,
    musicIntensity: null,
    locationKind: null,
    spotifyTrack: null,
    reputationChanges: [],
    segmentEffects: [],
    directions: [],
    illustration: null,
    generatedIllustration: null,
    generatedNpcAvatars: [],
  } as SceneAnalysis;
}

function sanitizeDirection(value: unknown): DirectionCommand | null {
  if (!isRecord(value)) return null;
  const effect = readString(value.effect).trim();
  if (!effect) return null;
  const direction: DirectionCommand = { effect: effect as DirectionCommand["effect"] };
  if (typeof value.duration === "number" && Number.isFinite(value.duration)) direction.duration = value.duration;
  if (typeof value.intensity === "number" && Number.isFinite(value.intensity)) direction.intensity = value.intensity;
  const target = readString(value.target).trim();
  if (target) direction.target = target as DirectionCommand["target"];
  if (isRecord(value.params)) {
    const params = Object.fromEntries(
      Object.entries(value.params).filter(([, paramValue]) => typeof paramValue === "string" && paramValue.trim()),
    );
    if (Object.keys(params).length > 0) direction.params = params as Record<string, string>;
  }
  return direction;
}

function sanitizeDirections(value: unknown): DirectionCommand[] {
  if (!Array.isArray(value)) return [];
  return value.map(sanitizeDirection).filter((direction): direction is DirectionCommand => direction !== null);
}

function sanitizeSegmentEffects(value: unknown): SceneSegmentEffect[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): SceneSegmentEffect | null => {
      if (!isRecord(item)) return null;
      const segment = readNonNegativeInteger(item.segment, -1);
      if (segment < 0) return null;
      const effect: SceneSegmentEffect = { segment };
      const background = readNullableString(item.background);
      if (background) effect.background = background;
      const music = readNullableString(item.music);
      if (music) effect.music = music;
      const ambient = readNullableString(item.ambient);
      if (ambient) effect.ambient = ambient;
      const sfx = stringArray(item.sfx);
      if (sfx.length > 0) effect.sfx = sfx;
      const directions = sanitizeDirections(item.directions);
      if (directions.length > 0) effect.directions = directions;
      return effect;
    })
    .filter((effect): effect is SceneSegmentEffect => effect !== null);
}

function sanitizeGameSceneAnalysis(parsed: JsonRecord): SceneAnalysis {
  return {
    ...defaultGameSceneAnalysis(),
    background: readNullableString(parsed.background),
    music: readNullableString(parsed.music),
    ambient: readNullableString(parsed.ambient),
    weather: readNullableString(parsed.weather),
    timeOfDay: readNullableString(parsed.timeOfDay),
    musicGenre: readNullableString(parsed.musicGenre) as SceneAnalysis["musicGenre"],
    musicIntensity: readNullableString(parsed.musicIntensity) as SceneAnalysis["musicIntensity"],
    locationKind: readNullableString(parsed.locationKind) as SceneAnalysis["locationKind"],
    spotifyTrack:
      typeof parsed.spotifyTrack === "string" || isRecord(parsed.spotifyTrack)
        ? (parsed.spotifyTrack as unknown as SceneAnalysis["spotifyTrack"])
        : null,
    reputationChanges: readRecordArray<SceneAnalysis["reputationChanges"][number]>(parsed.reputationChanges),
    segmentEffects: sanitizeSegmentEffects(parsed.segmentEffects),
    directions: sanitizeDirections(parsed.directions),
    illustration: isRecord(parsed.illustration)
      ? (parsed.illustration as unknown as SceneAnalysis["illustration"])
      : null,
  } as SceneAnalysis;
}

function parseObject(raw: string): JsonRecord | null {
  try {
    const parsed = parseGameJsonish(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function malformedJsonFallback(sceneContext: SceneAnalyzerContext): SceneAnalysis {
  const fallback = defaultGameSceneAnalysis();
  const track = sceneContext.useSpotifyMusic ? sceneContext.availableSpotifyTracks?.[0] : null;
  const uri = readString(track?.uri).trim();
  if (uri) {
    fallback.spotifyTrack = {
      uri,
      name: readNullableString(track?.name),
      artist: readNullableString(track?.artist),
      album: readNullableString(track?.album),
    };
  }
  return fallback;
}

function readNullableString(value: unknown): string | null {
  const text = readString(value).trim();
  return text || null;
}

function readRecordArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter(isRecord) as T[]) : [];
}

function normalizeSpotifyTrackCandidates(value: unknown): NonNullable<SceneAnalyzerContext["availableSpotifyTracks"]> {
  return readRecordArray<NonNullable<SceneAnalyzerContext["availableSpotifyTracks"]>[number]>(value)
    .map((track): NonNullable<SceneAnalyzerContext["availableSpotifyTracks"]>[number] | null => {
      const uri = readString(track.uri).trim();
      if (!uri) return null;
      const candidate: NonNullable<SceneAnalyzerContext["availableSpotifyTracks"]>[number] = {
        uri,
        name: readString(track.name).trim(),
        artist: readString(track.artist).trim(),
      };
      const album = readNullableString(track.album);
      if (album) candidate.album = album;
      return candidate;
    })
    .filter((track): track is NonNullable<SceneAnalyzerContext["availableSpotifyTracks"]>[number] => track !== null);
}

function readGameActiveState(value: unknown): SceneAnalyzerContext["currentState"] {
  const state = readString(value).trim();
  if (state === "dialogue" || state === "combat" || state === "travel_rest") return state;
  return "exploration";
}

function normalizeSceneAnalyzerContext(value: unknown): SceneAnalyzerContext {
  const context = parseRecord(value);
  const turnNumber = readNonNegativeInteger(context.turnNumber, 0);

  return {
    currentState: readGameActiveState(context.currentState),
    ...(turnNumber > 0 ? { turnNumber } : {}),
    availableBackgrounds: stringArray(context.availableBackgrounds),
    availableSfx: stringArray(context.availableSfx),
    activeWidgets: readRecordArray<SceneAnalyzerContext["activeWidgets"][number]>(context.activeWidgets),
    trackedNpcs: readRecordArray<SceneAnalyzerContext["trackedNpcs"][number]>(context.trackedNpcs),
    characterNames: stringArray(context.characterNames),
    currentBackground: readNullableString(context.currentBackground),
    currentMusic: readNullableString(context.currentMusic),
    recentMusic: stringArray(context.recentMusic),
    useSpotifyMusic: boolish(context.useSpotifyMusic, false),
    availableSpotifyTracks: normalizeSpotifyTrackCandidates(context.availableSpotifyTracks),
    currentSpotifyTrack: readNullableString(context.currentSpotifyTrack),
    recentSpotifyTracks: stringArray(context.recentSpotifyTracks),
    currentAmbient: readNullableString(context.currentAmbient),
    currentWeather: readNullableString(context.currentWeather),
    currentTimeOfDay: readNullableString(context.currentTimeOfDay),
    canGenerateIllustrations: boolish(context.canGenerateIllustrations, false),
    canGenerateBackgrounds: boolish(context.canGenerateBackgrounds, false),
    artStylePrompt: readNullableString(context.artStylePrompt),
    imagePromptInstructions: readNullableString(context.imagePromptInstructions),
  };
}

function scenePostProcessContext(context: SceneAnalyzerContext): PostProcessContext {
  return {
    availableBackgrounds: context.availableBackgrounds,
    availableSfx: context.availableSfx,
    useSpotifyMusic: context.useSpotifyMusic,
    availableSpotifyTracks: context.availableSpotifyTracks,
    validWidgetIds: new Set(context.activeWidgets.map((widget) => readString(widget.id)).filter(Boolean)),
    characterNames: context.characterNames,
    canGenerateBackgrounds: context.canGenerateBackgrounds,
  };
}

async function resolveGameSceneConnectionId(
  storage: StorageGateway,
  chat: JsonRecord | null,
  override?: string | null,
): Promise<string | null> {
  const explicit = readString(override).trim();
  if (explicit) return explicit;

  const meta = parseRecord(chat?.metadata);
  const setup = parseRecord(meta.gameSetupConfig);
  const fromMetadata = readString(meta.gameSceneConnectionId).trim() || readString(setup.sceneConnectionId).trim();
  if (fromMetadata) return fromMetadata;

  const fromChat = readString(chat?.connectionId).trim();
  if (fromChat) return fromChat;

  const connections = await storage.list<JsonRecord>("connections");
  return readString(connections.find((connection) => readString(connection.provider))?.id).trim() || null;
}

export async function analyzeGameScene(
  capabilities: GameSceneAnalysisCapabilities,
  input: GameSceneAnalysisRequest,
): Promise<SceneAnalysis> {
  const chat = input.chatId ? await capabilities.storage.get<JsonRecord>("chats", input.chatId) : null;
  const connectionId = await resolveGameSceneConnectionId(capabilities.storage, chat, input.connectionId ?? null);
  const sceneContext = normalizeSceneAnalyzerContext(input.context);

  const raw = await capabilities.llm.complete({
    connectionId,
    messages: [
      { role: "system", content: buildSceneAnalyzerSystemPrompt(sceneContext) },
      { role: "user", content: buildSceneAnalyzerUserPrompt(input.narration, undefined, sceneContext) },
    ],
    parameters: { maxTokens: 1200, temperature: 0.2 },
  });
  const parsed = parseObject(raw);
  const analysis = parsed ? sanitizeGameSceneAnalysis(parsed) : malformedJsonFallback(sceneContext);
  return postProcessSceneResult(analysis, scenePostProcessContext(sceneContext));
}
