import {
  normalizeImagePromptInstructions,
  PROVIDERS,
  type APIProvider,
  type ImageGenerationQuality,
} from "@marinara-engine/shared";
import type { CreateConnectionPayload } from "../hooks/use-connections";

export type ConnectionTransferRow = {
  name?: unknown;
  provider?: unknown;
  baseUrl?: unknown;
  model?: unknown;
  maxContext?: unknown;
  maxTokensOverride?: unknown;
  maxParallelJobs?: unknown;
  maxRequestsPerMinute?: unknown;
  promptPresetId?: unknown;
  defaultParameters?: unknown;
  enableCaching?: unknown;
  anthropicExtendedCacheTtl?: unknown;
  cachingAtDepth?: unknown;
  isDefault?: unknown;
  fallbackForMain?: unknown;
  useForRandom?: unknown;
  defaultForAgents?: unknown;
  fallbackForAgents?: unknown;
  embeddingModel?: unknown;
  embeddingBaseUrl?: unknown;
  embeddingConnectionId?: unknown;
  openrouterProvider?: unknown;
  imageGenerationSource?: unknown;
  imageService?: unknown;
  videoGenerationSource?: unknown;
  videoService?: unknown;
  audioSource?: unknown;
  audioVoice?: unknown;
  audioSoundEffects?: unknown;
  audioMusic?: unknown;
  service?: unknown;
  imageEndpointId?: unknown;
  imagePromptInstructions?: unknown;
  imageGenerationQuality?: unknown;
  comfyuiWorkflow?: unknown;
  treatAsLocalEndpoint?: unknown;
  claudeFastMode?: unknown;
};

export type SafeConnectionExport = {
  name: string;
  provider: APIProvider;
  baseUrl: string;
  model: string;
  maxContext: number;
  maxTokensOverride: number | null;
  maxParallelJobs: number;
  maxRequestsPerMinute: number | null;
  promptPresetId: string | null;
  defaultParameters: Record<string, unknown> | null;
  enableCaching: boolean;
  anthropicExtendedCacheTtl: boolean;
  cachingAtDepth: number;
  isDefault: boolean;
  fallbackForMain: boolean;
  useForRandom: boolean;
  defaultForAgents: boolean;
  fallbackForAgents: boolean;
  embeddingModel: string;
  embeddingBaseUrl: string;
  embeddingConnectionId: string | null;
  openrouterProvider: string | null;
  imageGenerationSource: string | null;
  imageService: string | null;
  videoGenerationSource: string | null;
  videoService: string | null;
  audioSource: string | null;
  audioVoice: string | null;
  audioSoundEffects: boolean;
  audioMusic: boolean;
  imageEndpointId: string | null;
  imagePromptInstructions: string | null;
  imageGenerationQuality: ImageGenerationQuality;
  comfyuiWorkflow: string | null;
  treatAsLocalEndpoint: boolean;
  claudeFastMode: boolean;
};

export type ConnectionImportPayload = {
  connection: CreateConnectionPayload;
  defaultParameters: Record<string, unknown> | null;
  hasDefaultParameters: boolean;
};

export const CONNECTION_EXPORT_WARNING =
  "This will export your connection data, WITHOUT your provided API Key. Remember to never share those with others!";
const MAX_PARALLEL_JOBS = 16;

export function createConnectionExportEnvelope(connections: ConnectionTransferRow[]) {
  return {
    kind: "marinara.connections",
    version: 1,
    exportedAt: new Date().toISOString(),
    notice: "API keys are intentionally not included.",
    connections: connections.map(serializeConnectionForExport),
  };
}

export function getConnectionImportEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];

  if (Array.isArray(value.connections)) return value.connections;
  if (Array.isArray(value.items)) return value.items;
  if (isRecord(value.connection)) return [value.connection];
  return [value];
}

export function normalizeImportedConnectionEntry(value: unknown): ConnectionImportPayload | null {
  if (!isRecord(value)) return null;

  const provider = asProvider(value.provider);
  const name = asString(value.name).trim();
  if (!provider || !name) return null;

  const defaultParameters = parseDefaultParameters(value.defaultParameters);
  const imageService = asNullableString(value.imageService ?? value.service);
  const videoService = provider === "video_generation" ? asNullableString(value.videoService ?? value.service) : null;

  return {
    connection: {
      name,
      provider,
      apiKey: "",
      baseUrl: asString(value.baseUrl),
      model: asString(value.model),
      maxContext: asPositiveInteger(value.maxContext, 128000),
      isDefault: false,
      fallbackForMain: false,
      useForRandom: false,
      defaultForAgents: false,
      fallbackForAgents: false,
      enableCaching: asBoolean(value.enableCaching),
      anthropicExtendedCacheTtl: asBoolean(value.anthropicExtendedCacheTtl),
      cachingAtDepth: asNonNegativeInteger(value.cachingAtDepth, 5),
      embeddingModel: asString(value.embeddingModel),
      embeddingBaseUrl: asString(value.embeddingBaseUrl),
      embeddingConnectionId: null,
      openrouterProvider: asNullableString(value.openrouterProvider),
      imageGenerationSource: asNullableString(value.imageGenerationSource),
      comfyuiWorkflow: asNullableString(value.comfyuiWorkflow),
      imageService,
      imageEndpointId: asNullableString(value.imageEndpointId),
      imagePromptInstructions: normalizeImagePromptInstructions(value.imagePromptInstructions),
      imageGenerationQuality: asImageGenerationQuality(value.imageGenerationQuality),
      videoGenerationSource: provider === "video_generation" ? asNullableString(value.videoGenerationSource) : null,
      videoService,
      audioSource: provider === "audio" ? asAudioGenerationSource(value.audioSource ?? value.service) : null,
      audioVoice: provider === "audio" ? asNullableString(value.audioVoice) : null,
      audioSoundEffects: provider === "audio" && asBoolean(value.audioSoundEffects),
      audioMusic: provider === "audio" && asBoolean(value.audioMusic),
      promptPresetId: null,
      maxTokensOverride: asNullablePositiveInteger(value.maxTokensOverride),
      maxParallelJobs: asBoundedPositiveInteger(value.maxParallelJobs, 1, MAX_PARALLEL_JOBS),
      maxRequestsPerMinute: asNullableBoundedPositiveInteger(value.maxRequestsPerMinute, 600),
      treatAsLocalEndpoint: asBoolean(value.treatAsLocalEndpoint),
      claudeFastMode: asBoolean(value.claudeFastMode),
    },
    defaultParameters,
    hasDefaultParameters: Object.prototype.hasOwnProperty.call(value, "defaultParameters"),
  };
}

function serializeConnectionForExport(connection: ConnectionTransferRow): SafeConnectionExport {
  const provider = asProvider(connection.provider) ?? "custom";
  const isVideoProvider = provider === "video_generation";
  const isAudioProvider = provider === "audio";
  return {
    name: asString(connection.name) || "Unnamed Connection",
    provider,
    baseUrl: asString(connection.baseUrl),
    model: asString(connection.model),
    maxContext: asPositiveInteger(connection.maxContext, 128000),
    maxTokensOverride: asNullablePositiveInteger(connection.maxTokensOverride),
    maxParallelJobs: asPositiveInteger(connection.maxParallelJobs, 1),
    maxRequestsPerMinute: asNullablePositiveInteger(connection.maxRequestsPerMinute),
    promptPresetId: asNullableString(connection.promptPresetId),
    defaultParameters: parseDefaultParameters(connection.defaultParameters),
    enableCaching: asBoolean(connection.enableCaching),
    anthropicExtendedCacheTtl: asBoolean(connection.anthropicExtendedCacheTtl),
    cachingAtDepth: asNonNegativeInteger(connection.cachingAtDepth, 5),
    isDefault: asBoolean(connection.isDefault),
    fallbackForMain: asBoolean(connection.fallbackForMain),
    useForRandom: asBoolean(connection.useForRandom),
    defaultForAgents: asBoolean(connection.defaultForAgents),
    fallbackForAgents: asBoolean(connection.fallbackForAgents),
    embeddingModel: asString(connection.embeddingModel),
    embeddingBaseUrl: asString(connection.embeddingBaseUrl),
    embeddingConnectionId: asNullableString(connection.embeddingConnectionId),
    openrouterProvider: asNullableString(connection.openrouterProvider),
    imageGenerationSource: asNullableString(connection.imageGenerationSource),
    imageService: asNullableString(connection.imageService ?? connection.service),
    videoGenerationSource: isVideoProvider ? asNullableString(connection.videoGenerationSource) : null,
    videoService: isVideoProvider ? asNullableString(connection.videoService ?? connection.service) : null,
    audioSource: isAudioProvider ? asNullableString(connection.audioSource ?? connection.service) : null,
    audioVoice: isAudioProvider ? asNullableString(connection.audioVoice) : null,
    audioSoundEffects: isAudioProvider && asBoolean(connection.audioSoundEffects),
    audioMusic: isAudioProvider && asBoolean(connection.audioMusic),
    imageEndpointId: asNullableString(connection.imageEndpointId),
    imagePromptInstructions: normalizeImagePromptInstructions(connection.imagePromptInstructions),
    imageGenerationQuality: asImageGenerationQuality(connection.imageGenerationQuality),
    comfyuiWorkflow: asNullableString(connection.comfyuiWorkflow),
    treatAsLocalEndpoint: asBoolean(connection.treatAsLocalEndpoint),
    claudeFastMode: asBoolean(connection.claudeFastMode),
  };
}

function asImageGenerationQuality(value: unknown): ImageGenerationQuality {
  return value === "low" || value === "medium" || value === "high" ? value : "auto";
}

/** Unknown sources degrade to null (resolved as ElevenLabs) instead of failing the whole connection import. */
function asAudioGenerationSource(value: unknown): string | null {
  const text = asNullableString(value);
  return text === "openai" || text === "elevenlabs" || text === "pockettts" || text === "xai" ? text : null;
}

function parseDefaultParameters(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return parseDefaultParameters(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }

  const scrubbed = scrubTopLevelSecrets(value);
  return isRecord(scrubbed) ? scrubbed : null;
}

function scrubTopLevelSecrets(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSecretFieldName(key)) continue;
    next[key] = entry;
  }
  return next;
}

function isSecretFieldName(key: string) {
  const normalized = key.toLowerCase().replace(/[\s_-]/g, "");
  return [
    "apikey",
    "apikeyencrypted",
    "authorization",
    "authheader",
    "password",
    "secret",
    "accesstoken",
    "refreshtoken",
    "bearertoken",
  ].includes(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asProvider(value: unknown): APIProvider | null {
  if (typeof value !== "string") return null;
  return value in PROVIDERS ? (value as APIProvider) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  const text = asString(value).trim();
  return text || null;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function asPositiveInteger(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(1, Math.round(numberValue));
}

function asBoundedPositiveInteger(value: unknown, fallback: number, max: number) {
  return Math.min(max, asPositiveInteger(value, fallback));
}

function asNonNegativeInteger(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.round(numberValue));
}

function asNullablePositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numberValue)) return null;
  return Math.max(1, Math.round(numberValue));
}

function asNullableBoundedPositiveInteger(value: unknown, max: number) {
  const parsed = asNullablePositiveInteger(value);
  return parsed === null ? null : Math.min(max, parsed);
}
