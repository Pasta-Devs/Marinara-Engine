import type { CapabilityIntegrationHost, CapabilityIntegrationProvider } from "@marinara-engine/shared";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { getLocalSidecarProvider } from "../llm/local-sidecar.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import {
  generateImage,
  saveImageToDisk,
  removeSavedImageFromDisk,
  stageImageToDisk,
  sweepStagedImages,
  resolveNovelAiRequestSize,
} from "../image/image-generation.js";
import {
  generateVideo,
  saveVideoToDisk,
  removeSavedVideoFromDisk,
  resolveVideoRequestDuration,
  resolveVideoReferencePublicUploadOptions,
} from "../video/video-generation.js";

/** Bind each package to the live host services, including their queues, security checks and logging. */
export function createCapabilityIntegrationHost(permissions: readonly string[]): CapabilityIntegrationHost {
  const granted = new Set(permissions);
  const guarded =
    <Args extends unknown[], Result>(permission: "network" | "storage", operation: (...args: Args) => Result) =>
    (...args: Args): Result => {
      if (!granted.has(permission)) throw new Error(`Package integrations require ${permission} permission.`);
      return operation(...args);
    };
  const providers = new WeakMap<CapabilityIntegrationProvider, BaseLLMProvider>();
  const expose = (provider: BaseLLMProvider): CapabilityIntegrationProvider => {
    const facade = Object.freeze({
      get maxContextValue() {
        return provider.maxContextValue;
      },
      get maxTokensOverrideValue() {
        return provider.maxTokensOverrideValue;
      },
      chat: provider.chat.bind(provider),
      chatComplete: provider.chatComplete.bind(provider),
      embed: provider.embed.bind(provider),
    });
    providers.set(facade, provider);
    return facade;
  };
  return Object.freeze({
    llm: Object.freeze({
      createProvider: guarded("network", (...args: Parameters<typeof createLLMProvider>) =>
        expose(createLLMProvider(...args)),
      ),
      localSidecar: guarded("network", () => expose(getLocalSidecarProvider())),
      withFallback(options: Parameters<CapabilityIntegrationHost["llm"]["withFallback"]>[0]) {
        const primary = providers.get(options.primary);
        if (!primary) throw new Error("Fallback requires a provider created by this package's host integrations.");
        return expose(withConnectionFallbackProvider({ ...options, primary }));
      },
    }),
    images: Object.freeze({
      generate: guarded(
        "network",
        (
          ...[source, baseUrl, apiKey, serviceHint, request]: Parameters<
            CapabilityIntegrationHost["images"]["generate"]
          >
        ) =>
          generateImage(source, baseUrl, apiKey, serviceHint, {
            ...request,
            allowLocalUrls: undefined,
            privateImageResultOrigin: undefined,
          }),
      ),
      save: guarded("storage", saveImageToDisk),
      remove: guarded("storage", removeSavedImageFromDisk),
      stage: guarded("storage", stageImageToDisk),
      sweepStaged: guarded("storage", sweepStagedImages),
      resolveNovelAiRequestSize,
    }),
    videos: Object.freeze({
      generate: guarded("network", generateVideo),
      save: guarded("storage", saveVideoToDisk),
      remove: guarded("storage", removeSavedVideoFromDisk),
      resolveDuration: resolveVideoRequestDuration,
      resolveReferenceUpload: resolveVideoReferencePublicUploadOptions,
    }),
  });
}
