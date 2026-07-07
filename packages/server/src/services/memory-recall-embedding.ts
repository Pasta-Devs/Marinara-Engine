import { LOCAL_SIDECAR_CONNECTION_ID, PROVIDERS, localAuthProviderBaseUrl } from "@marinara-engine/shared";
import type { DB } from "../db/connection.js";
import { logger } from "../lib/logger.js";
import { isLocalEmbedderAvailable } from "./local-embedder.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "./llm/local-sidecar.js";
import { createLLMProvider } from "./llm/provider-registry.js";
import type { MemoryRecallEmbeddingSource } from "./memory-recall.js";
import { sidecarModelService } from "./sidecar/sidecar-model.service.js";
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
    embeddingConnectionId: nonEmptyString(chatMeta.embeddingConnectionId) ?? nonEmptyString(active?.embeddingConnectionId) ?? "",
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

export async function resolveMemoryRecallEmbeddingSource(
  db: DB,
  options: {
    chatMetadata?: unknown;
    connectionId?: string | null;
    activeConnection?: EmbeddingConnectionLike | null;
    activeBaseUrl?: string | null;
  },
): Promise<MemoryRecallEmbeddingSource | null> {
  const connections = createConnectionsStorage(db);
  let activeConnection =
    options.activeConnection ?? (options.connectionId ? await connections.getWithKey(options.connectionId) : null);
  if (!activeConnection && !options.connectionId) {
    const defaultConnection = await connections.getDefault();
    activeConnection = defaultConnection ? await connections.getWithKey(defaultConnection.id) : null;
  }
  if (!activeConnection) return null;

  const chatMeta = parseMetadata(options.chatMetadata);
  const embeddingConnId =
    nonEmptyString(chatMeta.embeddingConnectionId) ?? nonEmptyString(activeConnection.embeddingConnectionId);

  if (embeddingConnId === LOCAL_SIDECAR_CONNECTION_ID) {
    if (!isLocalSidecarEmbeddingSupported()) {
      logger.warn(
        "[memory-recall] Local sidecar was selected for embeddings, but sidecar embeddings require an enabled llama.cpp local model",
      );
      return null;
    }

    const provider = getLocalSidecarProvider();
    const label = "Local Model sidecar";
    return {
      label,
      async embed(texts: string[], signal?: AbortSignal) {
        try {
          return await provider.embed(texts, LOCAL_SIDECAR_MODEL, signal);
        } catch (err) {
          logger.warn(err, "[memory-recall] Configured embedding source %s failed", label);
          return null;
        }
      },
    };
  }

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
  );
  const label = `${embeddingConnection.name || embeddingConnection.provider} (${embeddingModel})`;

  return {
    label,
    async embed(texts: string[], signal?: AbortSignal) {
      try {
        return await provider.embed(texts, embeddingModel, signal);
      } catch (err) {
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
