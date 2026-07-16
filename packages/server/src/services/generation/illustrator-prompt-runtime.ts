import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { withConnectionFallbackProvider, type FallbackConnection } from "../llm/connection-fallback-provider.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "../llm/local-sidecar.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import type { GenerationFallbackNotifier } from "./fallback-notification.js";
import { resolveModelAccessPolicy } from "./model-access-policy.js";

export type IllustratorPromptConnection = FallbackConnection & {
  defaultParameters?: string | Record<string, unknown> | null;
  enableCaching?: string | boolean | null;
  anthropicExtendedCacheTtl?: string | boolean | null;
  imageGenerationSource?: string | null;
  imageService?: string | null;
  imageEndpointId?: string | null;
  comfyuiWorkflow?: string | null;
};

export type IllustratorPromptConnectionsStore = {
  getWithKey(id: string): Promise<IllustratorPromptConnection | null>;
  getFallbackForAgents(): Promise<FallbackConnection | null>;
};

export type IllustratorPromptRuntime = {
  provider: BaseLLMProvider;
  model: string;
  connectionId: string;
  suppressModelParameters: boolean;
  enableCaching: boolean;
  anthropicExtendedCacheTtl: boolean;
};

function readConnectionId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isEnabled(value: unknown): boolean {
  return value === true || value === "true";
}

/**
 * Resolve the text-generation runtime that writes Illustrator prompts.
 * A per-chat Prompt Model selection takes precedence over the chat's main
 * connection for every caller, including Conversation selfie generation.
 */
export async function resolveIllustratorPromptRuntime(args: {
  chatMetadata: Record<string, unknown>;
  defaultConnection: IllustratorPromptConnection | null;
  defaultConnectionId: string | null;
  connections: IllustratorPromptConnectionsStore;
  resolveBaseUrl(connection: Pick<IllustratorPromptConnection, "baseUrl" | "provider">): string;
  onFallback?: GenerationFallbackNotifier;
}): Promise<IllustratorPromptRuntime> {
  const overrideConnectionId = readConnectionId(args.chatMetadata.illustratorPromptConnectionId);
  const defaultConnectionId = readConnectionId(args.defaultConnectionId);
  const connectionId = overrideConnectionId ?? defaultConnectionId;
  if (!connectionId) {
    throw new Error("No text connection is configured for selfie prompt generation.");
  }

  const fallbackConnection = await args.connections.getFallbackForAgents();
  const wrapWithFallback = (provider: BaseLLMProvider) =>
    withConnectionFallbackProvider({
      primary: provider,
      primaryConnectionId: connectionId,
      fallbackConnection,
      fallbackBaseUrl: fallbackConnection ? args.resolveBaseUrl(fallbackConnection) : "",
      category: "agents",
      onFallback: args.onFallback,
    });

  if (connectionId === LOCAL_SIDECAR_CONNECTION_ID) {
    return {
      provider: wrapWithFallback(getLocalSidecarProvider()),
      model: LOCAL_SIDECAR_MODEL,
      connectionId,
      suppressModelParameters: false,
      enableCaching: false,
      anthropicExtendedCacheTtl: false,
    };
  }

  const connection =
    args.defaultConnection?.id === connectionId
      ? args.defaultConnection
      : await args.connections.getWithKey(connectionId);
  if (!connection) {
    throw new Error(
      overrideConnectionId
        ? "The selected selfie Prompt Model connection could not be found."
        : "The conversation connection could not be found.",
    );
  }
  if (connection.provider === "image_generation" || connection.provider === "video_generation") {
    throw new Error("The selected selfie Prompt Model must be a text-generation connection.");
  }

  const model = connection.model.trim();
  if (!model) throw new Error("The selected selfie Prompt Model has no model configured.");
  const baseUrl = args.resolveBaseUrl(connection);
  if (!baseUrl) throw new Error("The selected selfie Prompt Model has no usable Base URL.");

  const modelAccessPolicy = resolveModelAccessPolicy({
    provider: connection.provider,
    model,
    maxContext: connection.maxContext,
  });
  return {
    provider: wrapWithFallback(
      createLLMProvider(
        connection.provider,
        baseUrl,
        connection.apiKey,
        connection.maxContext,
        connection.openrouterProvider,
        connection.maxTokensOverride,
        isEnabled(connection.claudeFastMode),
        isEnabled(connection.treatAsLocalEndpoint),
        connection.defaultParameters,
      ),
    ),
    model,
    connectionId,
    suppressModelParameters: modelAccessPolicy.suppressModelParameters,
    enableCaching: isEnabled(connection.enableCaching),
    anthropicExtendedCacheTtl: isEnabled(connection.anthropicExtendedCacheTtl),
  };
}
