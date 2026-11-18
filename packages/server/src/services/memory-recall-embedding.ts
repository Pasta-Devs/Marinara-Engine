import {
  BUILTIN_EMBEDDING_CONNECTION_ID,
  DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY,
  generationParametersSchema,
  LOCAL_SIDECAR_CONNECTION_ID,
  PROVIDERS,
  localAuthProviderBaseUrl,
} from "@marinara-engine/shared";
import { decryptCustomHeaders } from "../utils/stored-secrets.js";
import { createHash } from "node:crypto";
import type { DB } from "../db/connection.js";
import { logger } from "../lib/logger.js";
import { isLocalEmbedderAvailable } from "./local-embedder.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "./llm/local-sidecar.js";
import { createLLMProvider } from "./llm/provider-registry.js";
import type { MemoryRecallEmbeddingInputType, MemoryRecallEmbeddingSource } from "./memory-recall.js";
import { builtinEmbeddingService } from "./sidecar/builtin-embedding.service.js";
import { sidecarModelService } from "./sidecar/sidecar-model.service.js";
import { createAppSettingsStorage } from "./storage/app-settings.storage.js";
import { createConnectionsStorage } from "./storage/connections.storage.js";

type ConnectionStorage = ReturnType<typeof createConnectionsStorage>;
type ConnectionWithKey = NonNullable<Awaited<ReturnType<ConnectionStorage["getWithKey"]>>>;
type EmbeddingConnectionLike = Omit<
  Pick<
    ConnectionWithKey,
    | "id"
    | "name"
    | "provider"
    | "baseUrl"
    | "apiKey"
    | "maxContext"
    | "openrouterProvider"
    | "maxTokensOverride"
    | "claudeFastMode"
    | "treatAsLocalEndpoint"
    | "defaultParameters"
    | "embeddingConnectionId"
    | "embeddingBaseUrl"
    | "embeddingModel"
  >,
  "provider"
> & { provider: string };
const VECTOR_VERDICT_TTL_MS = 60_000;

let cachedVectorizerVerdict: { key: string; available: boolean; at: number } | null = null;

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function resolveBaseUrl(connection: { baseUrl: string | null; provider: string }): string {
  if (connection.baseUrl) return connection.baseUrl.replace(/\/+$/, "");
  const localAuthBaseUrl = localAuthProviderBaseUrl(connection.provider);
  if (localAuthBaseUrl) return localAuthBaseUrl;
  const providerDef = PROVIDERS[connection.provider as keyof typeof PROVIDERS];
  return providerDef?.defaultBaseUrl ?? "";
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function canonicalCustomHeaders(defaultParameters: unknown): string {
  let parsed = defaultParameters;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return "{}";
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "{}";
  const rawHeaders = (parsed as Record<string, unknown>).customHeaders;
  // Compare the real values: each save of an encrypted value differs even when the header did not change.
  const result = generationParametersSchema.shape.customHeaders.safeParse(
    rawHeaders && typeof rawHeaders === "object" && !Array.isArray(rawHeaders)
      ? decryptCustomHeaders(rawHeaders as Record<string, string>)
      : rawHeaders,
  );
  if (!result.success) return "{}";
  return JSON.stringify(
    Object.fromEntries(Object.entries(result.data ?? {}).sort(([left], [right]) => left.localeCompare(right))),
  );
}

export interface MemoryRecallEmbeddingInputProfile {
  id: string;
  queryPrefix: string;
  documentPrefix: string;
}

const DEFAULT_EMBEDDING_INPUT_PROFILE: MemoryRecallEmbeddingInputProfile = {
  id: "plain-v1",
  queryPrefix: "",
  documentPrefix: "",
};

/**
 * Apply the asymmetric input prefixes required by common retrieval models.
 * Unknown models remain untouched because adding an unsupported instruction
 * can be more damaging than omitting one.
 */
export function resolveMemoryRecallEmbeddingInputProfile(model: string): MemoryRecallEmbeddingInputProfile {
  const normalized = model.toLowerCase();
  if (normalized.includes("snowflake-arctic-embed") && normalized.includes("v2")) {
    return { id: "snowflake-arctic-v2", queryPrefix: "query: ", documentPrefix: "" };
  }
  if (/(^|[/_.-])e5([/_.-]|$)/u.test(normalized)) {
    return { id: "e5", queryPrefix: "query: ", documentPrefix: "passage: " };
  }
  if (normalized.includes("qwen3-embedding")) {
    // Qwen3-Embedding wants a one-line task instruction on queries only; documents go in as they are.
    return {
      id: "qwen3-embedding",
      queryPrefix:
        "Instruct: Given the latest messages of a roleplay chat, retrieve the memories and lore that are relevant to them\nQuery:",
      documentPrefix: "",
    };
  }
  if (normalized.includes("embeddinggemma")) {
    return {
      id: "embeddinggemma",
      queryPrefix: "task: search result | query: ",
      documentPrefix: "title: none | text: ",
    };
  }
  if (normalized.includes("nomic-embed-text")) {
    return { id: "nomic-embed-text", queryPrefix: "search_query: ", documentPrefix: "search_document: " };
  }
  return DEFAULT_EMBEDDING_INPUT_PROFILE;
}

export function formatMemoryRecallEmbeddingTexts(
  texts: string[],
  model: string,
  inputType: MemoryRecallEmbeddingInputType,
): string[] {
  const profile = resolveMemoryRecallEmbeddingInputProfile(model);
  const prefix = inputType === "query" ? profile.queryPrefix : profile.documentPrefix;
  return prefix ? texts.map((text) => `${prefix}${text}`) : texts;
}

export function createMemoryRecallEmbeddingSpaceId(
  kind: string,
  model: string,
  ...parts: Array<string | null | undefined>
): string {
  const profile = resolveMemoryRecallEmbeddingInputProfile(model);
  const digest = createHash("sha256")
    .update(JSON.stringify([...parts, model, profile.id].map((part) => part?.trim() ?? "")))
    .digest("hex");
  return `${kind}:${digest}`;
}

function buildVectorizerCacheKey(options: {
  chatMetadata?: unknown;
  connectionId?: string | null;
  activeConnection?: EmbeddingConnectionLike | null;
  activeBaseUrl?: string | null;
}): string {
  const chatMeta = parseMetadata(options.chatMetadata);
  const active = options.activeConnection ?? null;
  return JSON.stringify({
    connectionId: options.connectionId ?? active?.id ?? "default",
    activeBaseUrl: options.activeBaseUrl ?? "",
    provider: active?.provider ?? "",
    embeddingConnectionId:
      nonEmptyString(chatMeta.embeddingConnectionId) ?? nonEmptyString(active?.embeddingConnectionId) ?? "",
    embeddingBaseUrl: nonEmptyString(active?.embeddingBaseUrl) ?? "",
    embeddingModel: nonEmptyString(active?.embeddingModel) ?? "",
  });
}

export function resetMemoryRecallVectorizerCache(): void {
  cachedVectorizerVerdict = null;
}

function isLocalSidecarEmbeddingSupported(): boolean {
  return (
    sidecarModelService.getResolvedBackend() === "llama_cpp" &&
    sidecarModelService.isEnabled() &&
    sidecarModelService.getConfiguredModelRef() !== null
  );
}

function createLocalSidecarEmbeddingSource(throwErrors = false): MemoryRecallEmbeddingSource | null {
  if (!isLocalSidecarEmbeddingSupported()) {
    logger.warn(
      "[memory-recall] Local sidecar was selected for embeddings, but sidecar embeddings require an enabled llama.cpp local model",
    );
    return null;
  }

  const provider = getLocalSidecarProvider();
  const label = "Local Model sidecar";
  const configuredModelRef = sidecarModelService.getConfiguredModelRef() ?? LOCAL_SIDECAR_MODEL;
  return {
    spaceId: createMemoryRecallEmbeddingSpaceId(
      "sidecar",
      configuredModelRef,
      sidecarModelService.getResolvedBackend(),
    ),
    label,
    model: configuredModelRef,
    async embed(texts: string[], signal?: AbortSignal, inputType: MemoryRecallEmbeddingInputType = "document") {
      try {
        return await provider.embed(
          formatMemoryRecallEmbeddingTexts(texts, configuredModelRef, inputType),
          LOCAL_SIDECAR_MODEL,
          signal,
        );
      } catch (err) {
        if (throwErrors) throw err;
        logger.warn(err, "[memory-recall] Configured embedding source %s failed", label);
        return null;
      }
    },
  };
}

/** The built-in embedding model (its own llama-server); null until a model is downloaded. */
function createBuiltinEmbeddingSource(throwErrors = false): MemoryRecallEmbeddingSource | null {
  const model = builtinEmbeddingService.getActiveModel();
  if (!model) {
    logger.warn("[memory-recall] The built-in embedding model was selected, but no model is downloaded");
    return null;
  }
  const label = `Built-in embedding model (${model.label})`;
  return {
    spaceId: createMemoryRecallEmbeddingSpaceId("builtin-embedding", model.label, model.repo, model.file),
    label,
    model: model.label,
    async embed(texts: string[], signal?: AbortSignal, inputType: MemoryRecallEmbeddingInputType = "document") {
      try {
        return await builtinEmbeddingService.embed(
          formatMemoryRecallEmbeddingTexts(texts, model.label, inputType),
          signal,
          model.id,
        );
      } catch (err) {
        if (throwErrors) throw err;
        logger.warn(err, "[memory-recall] Configured embedding source %s failed", label);
        return null;
      }
    },
  };
}

/** The source behind a pseudo-connection id (built-in model or built-in embedding model); undefined for real ids. */
export function resolvePseudoEmbeddingSource(
  id: string | null | undefined,
  throwErrors = false,
): MemoryRecallEmbeddingSource | null | undefined {
  if (id === LOCAL_SIDECAR_CONNECTION_ID) return createLocalSidecarEmbeddingSource(throwErrors);
  if (id === BUILTIN_EMBEDDING_CONNECTION_ID) return createBuiltinEmbeddingSource(throwErrors);
  return undefined;
}

/** Ids that name an embedding source without a stored connection row. */
export function isPseudoEmbeddingConnectionId(id: string | null | undefined): boolean {
  return id === LOCAL_SIDECAR_CONNECTION_ID || id === BUILTIN_EMBEDDING_CONNECTION_ID;
}

type EmbeddingSourceOptions = {
  chatMetadata?: unknown;
  connectionId?: string | null;
  activeConnection?: EmbeddingConnectionLike | null;
  activeBaseUrl?: string | null;
};

export async function readDefaultEmbeddingConnectionId(db: DB): Promise<string | null> {
  return nonEmptyString(await createAppSettingsStorage(db).get(DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY));
}

/** The app-wide default (Connection defaults > Embeddings), resolved like an ordinary connection. */
async function resolveDefaultEmbeddingSource(db: DB): Promise<MemoryRecallEmbeddingSource | null> {
  const defaultId = await readDefaultEmbeddingConnectionId(db);
  if (!defaultId) return null;
  if (isPseudoEmbeddingConnectionId(defaultId)) return resolvePseudoEmbeddingSource(defaultId) ?? null;
  return resolveEmbeddingSource(db, { connectionId: defaultId }, false);
}

/** No usable chat connection: a chat's own embedding override still comes before the app-wide default. */
async function resolveFallbackEmbeddingSource(
  db: DB,
  chatMetadata: unknown,
): Promise<MemoryRecallEmbeddingSource | null> {
  const chatOverride = nonEmptyString(parseMetadata(chatMetadata).embeddingConnectionId);
  if (isPseudoEmbeddingConnectionId(chatOverride)) return resolvePseudoEmbeddingSource(chatOverride) ?? null;
  if (chatOverride) {
    const source = await resolveEmbeddingSource(db, { connectionId: chatOverride }, false);
    if (source) return source;
  }
  return resolveDefaultEmbeddingSource(db);
}

export async function resolveMemoryRecallEmbeddingSource(
  db: DB,
  options: EmbeddingSourceOptions,
): Promise<MemoryRecallEmbeddingSource | null> {
  return resolveEmbeddingSource(db, options, true);
}

/**
 * Connections > Test embedding: the source one connection's own settings resolve to, exactly as semantic search
 * resolves them (Embedding Connection, Embedding endpoint URL, model), without the app-wide default filling in,
 * and with the provider error thrown so the test can show it. Capability `embeddingsFor` (API 1.818) resolves the same
 * source with `throwErrors` false, so a failed call resolves null like other package embeddings.
 */
export async function resolveConnectionTestEmbeddingSource(
  db: DB,
  connection: EmbeddingConnectionLike,
  throwErrors = true,
): Promise<MemoryRecallEmbeddingSource | null> {
  return resolveEmbeddingSource(db, { activeConnection: connection }, false, throwErrors);
}

async function resolveEmbeddingSource(
  db: DB,
  options: EmbeddingSourceOptions,
  useDefault: boolean,
  throwErrors = false,
): Promise<MemoryRecallEmbeddingSource | null> {
  // The built-in embedding model is an embedding source, never a chat connection, so its id resolves straight to it.
  if (options.connectionId === BUILTIN_EMBEDDING_CONNECTION_ID) return createBuiltinEmbeddingSource(throwErrors);
  const connections = createConnectionsStorage(db);
  if (options.connectionId === "random") {
    // A random chat stores a sentinel rather than a persisted connection id.
    // Use one stable, embedding-capable member of its pool so rebuilding and
    // later recall queries stay in the same vector space.
    const pool = (await connections.listRandomPool()).sort((left, right) => left.id.localeCompare(right.id));
    for (const connection of pool) {
      const source = await resolveEmbeddingSource(
        db,
        {
          chatMetadata: options.chatMetadata,
          connectionId: connection.id,
          activeConnection: connection,
          activeBaseUrl: resolveBaseUrl(connection),
        },
        false,
      );
      if (source) return source;
    }
    // Only when no pool member has embeddings of its own, so one member cannot shadow another.
    return useDefault ? resolveFallbackEmbeddingSource(db, options.chatMetadata) : null;
  }

  let activeConnection =
    options.activeConnection ?? (options.connectionId ? await connections.getWithKey(options.connectionId) : null);
  if (!activeConnection && !options.connectionId) {
    const defaultConnection = await connections.getDefault();
    activeConnection = defaultConnection ? await connections.getWithKey(defaultConnection.id) : null;
  }
  if (!activeConnection) return useDefault ? resolveFallbackEmbeddingSource(db, options.chatMetadata) : null;

  const chatMeta = parseMetadata(options.chatMetadata);
  const embeddingConnId =
    nonEmptyString(chatMeta.embeddingConnectionId) ?? nonEmptyString(activeConnection.embeddingConnectionId);
  // Embedding settings on the chat or connection win; the app-wide default only fills the gap.
  if (useDefault && !embeddingConnId && !nonEmptyString(activeConnection.embeddingModel)) {
    return resolveDefaultEmbeddingSource(db);
  }

  if (isPseudoEmbeddingConnectionId(embeddingConnId))
    return resolvePseudoEmbeddingSource(embeddingConnId, throwErrors) ?? null;

  let embeddingConnection = activeConnection;
  let embeddingBaseUrl = options.activeBaseUrl ?? null;

  if (embeddingConnId) {
    const configuredConnection = await connections.getWithKey(embeddingConnId);
    if (configuredConnection) {
      embeddingConnection = configuredConnection;
      embeddingBaseUrl = resolveBaseUrl(configuredConnection);
    }
  }

  embeddingBaseUrl =
    nonEmptyString(embeddingConnection.embeddingBaseUrl) ?? embeddingBaseUrl ?? resolveBaseUrl(embeddingConnection);
  // Dedicated embedding connections may provide credentials/base URL while the
  // active chat connection remains the source of the selected embedding model.
  const embeddingModel =
    nonEmptyString(embeddingConnection.embeddingModel) ?? nonEmptyString(activeConnection.embeddingModel);

  if (!embeddingModel || !embeddingBaseUrl) return null;

  const provider = createLLMProvider(
    embeddingConnection.provider,
    embeddingBaseUrl,
    embeddingConnection.apiKey,
    embeddingConnection.maxContext,
    embeddingConnection.openrouterProvider,
    embeddingConnection.maxTokensOverride,
    embeddingConnection.claudeFastMode === "true",
    embeddingConnection.treatAsLocalEndpoint === "true",
    embeddingConnection.defaultParameters,
    embeddingConnection.id,
  );
  const label = `${embeddingConnection.name || embeddingConnection.provider} (${embeddingModel})`;

  return {
    spaceId: createMemoryRecallEmbeddingSpaceId(
      "remote",
      embeddingModel,
      embeddingConnection.provider,
      embeddingBaseUrl,
    ),
    cacheIdentity: createMemoryRecallEmbeddingSpaceId(
      "remote-cache",
      embeddingModel,
      embeddingConnection.provider,
      embeddingBaseUrl,
      embeddingConnection.id,
      embeddingConnection.apiKey,
      canonicalCustomHeaders(embeddingConnection.defaultParameters),
    ),
    label,
    model: embeddingModel,
    endpoint: embeddingBaseUrl,
    async embed(texts: string[], signal?: AbortSignal, inputType: MemoryRecallEmbeddingInputType = "document") {
      try {
        return await provider.embed(
          formatMemoryRecallEmbeddingTexts(texts, embeddingModel, inputType),
          embeddingModel,
          signal,
        );
      } catch (err) {
        if (throwErrors) throw err;
        logger.warn(err, "[memory-recall] Configured embedding source %s failed", label);
        return null;
      }
    },
  };
}

export async function isMemoryRecallVectorizerAvailable(
  db: DB,
  options: {
    chatMetadata?: unknown;
    connectionId?: string | null;
    activeConnection?: EmbeddingConnectionLike | null;
    activeBaseUrl?: string | null;
  },
): Promise<boolean> {
  const key = buildVectorizerCacheKey(options);
  const now = Date.now();
  if (cachedVectorizerVerdict?.key === key && now - cachedVectorizerVerdict.at < VECTOR_VERDICT_TTL_MS) {
    return cachedVectorizerVerdict.available;
  }
  const available = (await resolveMemoryRecallEmbeddingSource(db, options)) !== null || isLocalEmbedderAvailable();
  cachedVectorizerVerdict = { key, available, at: now };
  return available;
}
