import {
  LOCAL_SIDECAR_CONNECTION_ID,
  PROVIDERS,
  localAuthProviderBaseUrl,
  type CapabilityLanguageModelCompletionOptions,
  type CapabilityLanguageModelHost,
  type CapabilityLanguageModelMessage,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { fitMessagesToContext, type BaseLLMProvider, type ChatMessage, type ChatOptions } from "../llm/base-provider.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "../llm/local-sidecar.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { unwrapConnectionAdmissionProvider } from "../generation/connection-admission.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";

export function createCapabilityLanguageModelHost(db: DB): CapabilityLanguageModelHost {
  const connections = createConnectionsStorage(db);
  const requireModel = (model: string | null | undefined) => {
    const resolved = model?.trim();
    if (!resolved) throw new Error("The selected language model connection has no model.");
    return resolved;
  };
  const resolvedModel = (provider: BaseLLMProvider, connectionId: string, model: string) =>
    Object.freeze({
      name: unwrapConnectionAdmissionProvider(provider).constructor.name,
      connectionId,
      model,
      maxContext: provider.maxContextValue,
      maxOutputTokens: provider.maxTokensOverrideValue,
      async chatComplete(
        messages: CapabilityLanguageModelMessage[],
        options: CapabilityLanguageModelCompletionOptions = {},
      ) {
        const result = await provider.chatComplete(messages as ChatMessage[], {
          model,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          debugMode: options.debugMode,
          reasoningEffort: options.reasoningEffort,
          verbosity: options.verbosity,
          signal: options.signal,
          responseFormat: options.responseFormat ? { ...options.responseFormat } : undefined,
        });
        return { content: result.content, finishReason: result.finishReason, usage: result.usage };
      },
      fitContext(messages: CapabilityLanguageModelMessage[], options = {}) {
        return fitMessagesToContext(
          messages as ChatMessage[],
          options as ChatOptions,
          provider.maxContextValue ?? undefined,
        );
      },
    });
  const resolveRandomConnectionId = async () => {
    const pool = await connections.listRandomPool();
    if (pool.length === 0) throw new Error("No language model connection is available in the random pool.");
    return pool[Math.floor(Math.random() * pool.length)]!.id;
  };
  const fromConnection = async (connectionId: string, model?: string) => {
    if (connectionId === LOCAL_SIDECAR_CONNECTION_ID) {
      return resolvedModel(getLocalSidecarProvider(), connectionId, requireModel(model ?? LOCAL_SIDECAR_MODEL));
    }
    const connection = await connections.getWithKey(connectionId);
    if (!connection) return null;

    let baseUrl = connection.baseUrl;
    if (!baseUrl) baseUrl = PROVIDERS[connection.provider as keyof typeof PROVIDERS]?.defaultBaseUrl ?? "";
    if (!baseUrl) baseUrl = localAuthProviderBaseUrl(connection.provider) ?? "";
    if (!baseUrl) throw new Error("The selected connection has no base URL.");

    return resolvedModel(
      createLLMProvider(
        connection.provider,
        baseUrl,
        connection.apiKey,
        connection.maxContext,
        connection.openrouterProvider,
        connection.maxTokensOverride,
        connection.claudeFastMode === "true",
        connection.treatAsLocalEndpoint === "true",
        undefined,
        connection.id,
      ),
      connection.id,
      requireModel(model ?? connection.model),
    );
  };
  const defaultConnection = async (model?: string, preferAgentDefault = false) => {
    const connection = preferAgentDefault
      ? (await connections.getDefaultForAgents()) ?? (await connections.getDefault())
      : await connections.getDefault();
    if (!connection) throw new Error("Choose a language model connection before generating content.");
    const resolved = await fromConnection(connection.id, model);
    if (!resolved) throw new Error("The selected language model connection no longer exists.");
    return resolved;
  };
  return {
    async resolve(requestedConnectionId) {
      let connectionId = requestedConnectionId ?? undefined;
      if (connectionId === "random") connectionId = await resolveRandomConnectionId();
      if (!connectionId) return defaultConnection();
      const resolved = await fromConnection(connectionId);
      if (!resolved) throw new Error("The selected language model connection no longer exists.");
      return resolved;
    },
    async resolveForRequest(request) {
      let connectionId = request.connectionId ?? (await connections.getDefaultForAgents())?.id ?? request.chatConnectionId;
      if (connectionId === "random") connectionId = await resolveRandomConnectionId();
      if (connectionId) {
        const resolved = await fromConnection(connectionId, request.model);
        if (resolved) return resolved;
        if (request.connectionId) throw new Error(`Language model connection not found: ${request.connectionId}`);
        if (request.chatConnectionId === connectionId) {
          throw new Error(`Chat language model connection not found: ${request.chatConnectionId}`);
        }
      }
      return defaultConnection(request.model, true);
    },
  };
}
