import { PROVIDERS, type APIProvider } from "@marinara-engine/shared";
import type { CreateConnectionPayload } from "../hooks/use-connections";

export type ConnectionTransferRow = {
  name?: unknown;
  provider?: unknown;
  baseUrl?: unknown;
  model?: unknown;
  maxContext?: unknown;
  maxTokensOverride?: unknown;
  maxParallelJobs?: unknown;
  promptPresetId?: unknown;
  defaultParameters?: unknown;
  enableCaching?: unknown;
  cachingAtDepth?: unknown;
  isDefault?: unknown;
  useForRandom?: unknown;
  defaultForAgents?: unknown;
  embeddingModel?: unknown;
  embeddingBaseUrl?: unknown;
  embeddingConnectionId?: unknown;
  openrouterProvider?: unknown;
  imageGenerationSource?: unknown;
  imageService?: unknown;
  service?: unknown;
  imageEndpointId?: unknown;
  comfyuiWorkflow?: unknown;
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
  promptPresetId: string | null;
  defaultParameters: Record<string, unknown> | null;
  enableCaching: boolean;
  cachingAtDepth: number;
  isDefault: boolean;
  useForRandom: boolean;
  defaultForAgents: boolean;
  embeddingModel: string;
  embeddingBaseUrl: string;
  embeddingConnectionId: string | null;
  openrouterProvider: string | null;
  imageGenerationSource: string | null;
  imageService: string | null;
  imageEndpointId: string | null;
  comfyuiWorkflow: string | null;
  claudeFastMode: boolean;
};

export type ConnectionImportPayload = {
  connection: CreateConnectionPayload;
  defaultParameters: Record<string, unknown> | null;
  hasDefaultParameters: boolean;
};

export const CONNECTION_EXPORT_WARNING =
  "This will export your connection data, WITHOUT your provided API Key. Remember to never share those with others!";

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

  return {
    connection: {
      name,
      provider,
      apiKey: "",
      baseUrl: asString(value.baseUrl),
      model: asString(value.model),
      maxContext: asPositiveInteger(value.maxContext, 128000),
      isDefault: asBoolean(value.isDefault),
      useForRandom: asBoolean(value.useForRandom),
      defaultForAgents: asBoolean(value.defaultForAgents),
      enableCaching: asBoolean(value.enableCaching),
      cachingAtDepth: asNonNegativeInteger(value.cachingAtDepth, 5),
      embeddingModel: asString(value.embeddingModel),
      embeddingBaseUrl: asString(value.embeddingBaseUrl),
      embeddingConnectionId: asNullableString(value.embeddingConnectionId),
      openrouterProvider: asNullableString(value.openrouterProvider),
      imageGenerationSource: asNullableString(value.imageGenerationSource),
      comfyuiWorkflow: asNullableString(value.comfyuiWorkflow),
      imageService,
      imageEndpointId: asNullableString(value.imageEndpointId),
      promptPresetId: asNullableString(value.promptPresetId),
      maxTokensOverride: asNullablePositiveInteger(value.maxTokensOverride),
      maxParallelJobs: asPositiveInteger(value.maxParallelJobs, 1),
      claudeFastMode: asBoolean(value.claudeFastMode),
    },
    defaultParameters,
    hasDefaultParameters: Object.prototype.hasOwnProperty.call(value, "defaultParameters"),
  };
}

function serializeConnectionForExport(connection: ConnectionTransferRow): SafeConnectionExport {
  const provider = asProvider(connection.provider) ?? "custom";
  return {
    name: asString(connection.name) || "Unnamed Connection",
    provider,
    baseUrl: asString(connection.baseUrl),
    model: asString(connection.model),
    maxContext: asPositiveInteger(connection.maxContext, 128000),
    maxTokensOverride: asNullablePositiveInteger(connection.maxTokensOverride),
    maxParallelJobs: asPositiveInteger(connection.maxParallelJobs, 1),
    promptPresetId: asNullableString(connection.promptPresetId),
    defaultParameters: parseDefaultParameters(connection.defaultParameters),
    enableCaching: asBoolean(connection.enableCaching),
    cachingAtDepth: asNonNegativeInteger(connection.cachingAtDepth, 5),
    isDefault: asBoolean(connection.isDefault),
    useForRandom: asBoolean(connection.useForRandom),
    defaultForAgents: asBoolean(connection.defaultForAgents),
    embeddingModel: asString(connection.embeddingModel),
    embeddingBaseUrl: asString(connection.embeddingBaseUrl),
    embeddingConnectionId: asNullableString(connection.embeddingConnectionId),
    openrouterProvider: asNullableString(connection.openrouterProvider),
    imageGenerationSource: asNullableString(connection.imageGenerationSource),
    imageService: asNullableString(connection.imageService ?? connection.service),
    imageEndpointId: asNullableString(connection.imageEndpointId),
    comfyuiWorkflow: asNullableString(connection.comfyuiWorkflow),
    claudeFastMode: asBoolean(connection.claudeFastMode),
  };
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

  const scrubbed = scrubSecrets(value);
  return isRecord(scrubbed) ? scrubbed : null;
}

function scrubSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (!isRecord(value)) return value;

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSecretFieldName(key)) continue;
    next[key] = scrubSecrets(entry);
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
