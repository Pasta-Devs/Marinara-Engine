import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import type { createConnectionsStorage } from "../storage/connections.storage.js";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "../llm/local-sidecar.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";

type ConnectionsStorage = ReturnType<typeof createConnectionsStorage>;
type ConnectionWithKey = NonNullable<Awaited<ReturnType<ConnectionsStorage["getWithKey"]>>>;
type SummaryConnectionSource = "summary" | "agent-default" | "chat";

type SummaryConnectionCandidate = {
  id: string;
  source: SummaryConnectionSource;
};

export type ResolvedChatSummaryConnection =
  | {
      ok: true;
      provider: BaseLLMProvider;
      model: string;
      connectionId: string;
      source: SummaryConnectionSource;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
      warnings: string[];
    };

function normalizeId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pushUniqueCandidate(candidates: SummaryConnectionCandidate[], candidate: SummaryConnectionCandidate | null) {
  if (!candidate) return;
  if (candidates.some((entry) => entry.id === candidate.id)) return;
  candidates.push(candidate);
}

async function resolveRandomConnection(
  connections: ConnectionsStorage,
  warnings: string[],
): Promise<ConnectionWithKey | null> {
  const pool = await connections.listRandomPool();
  if (!pool.length) {
    warnings.push("No connections in random pool");
    return null;
  }
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

async function loadSummaryConnection(
  candidate: SummaryConnectionCandidate,
  connections: ConnectionsStorage,
  warnings: string[],
): Promise<ConnectionWithKey | null> {
  if (candidate.id === "random") return resolveRandomConnection(connections, warnings);
  const conn = await connections.getWithKey(candidate.id);
  if (!conn) warnings.push(`Connection ${candidate.id} was not found`);
  return conn;
}

export async function resolveChatSummaryConnection(args: {
  chatConnectionId?: string | null;
  chatMetadata: Record<string, unknown>;
  connections: ConnectionsStorage;
  resolveBaseUrl: (connection: Pick<ConnectionWithKey, "baseUrl" | "provider">) => string;
}): Promise<ResolvedChatSummaryConnection> {
  const warnings: string[] = [];
  const candidates: SummaryConnectionCandidate[] = [];
  const summaryConnectionId = normalizeId(args.chatMetadata.summaryConnectionId);
  const defaultAgentConnection = await args.connections.getDefaultForAgents();
  const fallbackAgentConnection = await args.connections.getFallbackForAgents();
  const wrapWithFallback = (provider: BaseLLMProvider, primaryConnectionId: string) =>
    withConnectionFallbackProvider({
      primary: provider,
      primaryConnectionId,
      fallbackConnection: fallbackAgentConnection,
      fallbackBaseUrl: fallbackAgentConnection ? args.resolveBaseUrl(fallbackAgentConnection) : "",
      category: "agents",
    });

  pushUniqueCandidate(candidates, summaryConnectionId ? { id: summaryConnectionId, source: "summary" } : null);
  pushUniqueCandidate(
    candidates,
    defaultAgentConnection?.id ? { id: defaultAgentConnection.id, source: "agent-default" } : null,
  );
  pushUniqueCandidate(candidates, args.chatConnectionId ? { id: args.chatConnectionId, source: "chat" } : null);

  if (candidates.length === 0) {
    return { ok: false, error: "No API connection configured for chat summary", warnings };
  }

  for (const candidate of candidates) {
    if (candidate.id === LOCAL_SIDECAR_CONNECTION_ID) {
      return {
        ok: true,
        provider: wrapWithFallback(getLocalSidecarProvider(), LOCAL_SIDECAR_CONNECTION_ID),
        model: LOCAL_SIDECAR_MODEL,
        connectionId: LOCAL_SIDECAR_CONNECTION_ID,
        source: candidate.source,
        warnings,
      };
    }

    const conn = await loadSummaryConnection(candidate, args.connections, warnings);
    if (!conn) continue;
    if (conn.provider === "image_generation") {
      warnings.push(`Connection ${conn.id} is an image-generation connection`);
      continue;
    }
    if (conn.provider === "video_generation") {
      warnings.push(`Connection ${conn.id} is a video-generation connection`);
      continue;
    }

    const baseUrl = args.resolveBaseUrl(conn);
    if (!baseUrl) {
      warnings.push(`Connection ${conn.id} has no base URL`);
      continue;
    }

    return {
      ok: true,
      provider: wrapWithFallback(
        createLLMProvider(
          conn.provider,
          baseUrl,
          conn.apiKey,
          conn.maxContext,
          conn.openrouterProvider,
          conn.maxTokensOverride,
          conn.claudeFastMode === "true",
          conn.treatAsLocalEndpoint === "true",
          conn.defaultParameters,
        ),
        conn.id,
      ),
      model: conn.model,
      connectionId: conn.id,
      source: candidate.source,
      warnings,
    };
  }

  return {
    ok: false,
    error: "No usable text generation connection configured for chat summary",
    warnings,
  };
}
