import {
  PROVIDERS,
  localAuthProviderBaseUrl,
  type CapabilityLanguageModelCompletionOptions,
  type CapabilityLanguageModelHost,
  type CapabilityLanguageModelMessage,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";

export function createCapabilityLanguageModelHost(db: DB): CapabilityLanguageModelHost {
  const connections = createConnectionsStorage(db);
  return {
    async resolve(requestedConnectionId) {
      let connectionId = requestedConnectionId ?? undefined;
      if (connectionId === "random") {
        const pool = await connections.listRandomPool();
        if (pool.length === 0) throw new Error("No language model connection is available in the random pool.");
        connectionId = pool[Math.floor(Math.random() * pool.length)]!.id;
      }
      if (!connectionId) connectionId = (await connections.getDefault())?.id;
      if (!connectionId) throw new Error("Choose a language model connection before generating content.");

      const connection = await connections.getWithKey(connectionId);
      if (!connection) throw new Error("The selected language model connection no longer exists.");

      let baseUrl = connection.baseUrl;
      if (!baseUrl) baseUrl = PROVIDERS[connection.provider as keyof typeof PROVIDERS]?.defaultBaseUrl ?? "";
      if (!baseUrl) baseUrl = localAuthProviderBaseUrl(connection.provider) ?? "";
      if (!baseUrl) throw new Error("The selected connection has no base URL.");

      const provider = createLLMProvider(
        connection.provider,
        baseUrl,
        connection.apiKey,
        connection.maxContext,
        connection.openrouterProvider,
        connection.maxTokensOverride,
        connection.claudeFastMode === "true",
        connection.treatAsLocalEndpoint === "true",
      );
      return Object.freeze({
        connectionId: connection.id,
        model: connection.model,
        async chatComplete(
          messages: CapabilityLanguageModelMessage[],
          options: CapabilityLanguageModelCompletionOptions = {},
        ) {
          const result = await provider.chatComplete(messages, {
            model: connection.model,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            debugMode: options.debugMode,
          });
          return { content: result.content, finishReason: result.finishReason };
        },
      });
    },
  };
}
