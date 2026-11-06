import { existsSync } from "node:fs";
import type {
  CapabilityChatGalleryImageInput,
  CapabilityEntityGalleryImageInput,
  CapabilityIntegrationHost,
  CapabilityGalleryImageAnimationInput,
  CapabilityIntegrationProvider,
  CapabilitySpeechTranscribeOptions,
  ConnectionAdmissionMode,
  HapticDeviceCommand,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { getLocalSidecarProvider } from "../llm/local-sidecar.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import {
  isConnectionAdmissionFailure,
  tryBackgroundConnection,
  withConnectionAdmission,
  withConnectionAdmissionProvider,
} from "../generation/connection-admission.js";
import { hapticService } from "../haptic/buttplug-service.js";
import { resolveSpotifyCredentials, spotifyHasScope } from "../spotify/spotify.service.js";
import {
  ConversationSpotifyCommandError,
  playConversationSpotifyCommand,
} from "../spotify/conversation-spotify-command.service.js";
import { sidecarSpeechService } from "../sidecar/sidecar-speech.service.js";
import { createAgentsStorage } from "../storage/agents.storage.js";
import { createGalleryStorage } from "../storage/gallery.storage.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createPersonaGalleryStorage } from "../storage/persona-gallery.storage.js";
import { persistGeneratedImageToEntityGalleries } from "../image/generated-image-entity-gallery.js";
import { resolveStoredGalleryFile } from "../image/gallery-file-lifecycle.js";
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
import { transcribeWithSavedSpeechToTextServer } from "../speech-to-text.service.js";
import { animateCapabilityGalleryImage } from "./capability-gallery-animation.service.js";

/** Bind each package to the live host services, including their queues, security checks and logging. */
export function createCapabilityIntegrationHost(
  permissions: readonly string[],
  db?: DB | null,
): CapabilityIntegrationHost {
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
  const requireDb = (): DB => {
    if (!db) throw new Error("Package integrations need the Engine database.");
    return db;
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
      addToChatGallery: guarded("storage", async (input: CapabilityChatGalleryImageInput) => {
        // Only a file images.save wrote inside the gallery folder becomes a gallery row.
        const file = resolveStoredGalleryFile(input.filePath);
        if (!file || !existsSync(file.absolutePath)) throw new Error("Gallery images must be saved with images.save.");
        const row = await createGalleryStorage(requireDb()).create({
          chatId: input.chatId,
          filePath: input.filePath,
          prompt: input.prompt,
          provider: input.provider,
          model: input.model,
          width: input.width,
          height: input.height,
        });
        if (!row) throw new Error("The chat gallery image was not saved.");
        return { id: row.id };
      }),
      persistToEntityGalleries: guarded("storage", async (input: CapabilityEntityGalleryImageInput) => {
        const database = requireDb();
        // Named fields only: the host function's test-only gallery folder override stays out of package reach.
        return persistGeneratedImageToEntityGalleries({
          enabled: input.enabled,
          sourceFilePath: input.sourceFilePath,
          sourceChatImageId: input.sourceChatImageId,
          characterIds: input.characterIds,
          personaIds: input.personaIds,
          characterGallery: createCharacterGalleryStorage(database),
          personaGallery: createPersonaGalleryStorage(database),
          prompt: input.prompt,
          provider: input.provider,
          model: input.model,
          width: input.width,
          height: input.height,
          signal: input.signal,
        });
      }),
    }),
    videos: Object.freeze({
      animateGalleryImage: guarded(
        "network",
        guarded("storage", (input: CapabilityGalleryImageAnimationInput) =>
          animateCapabilityGalleryImage(requireDb(), input),
        ),
      ),
      generate: guarded("network", generateVideo),
      save: guarded("storage", saveVideoToDisk),
      remove: guarded("storage", removeSavedVideoFromDisk),
      resolveDuration: resolveVideoRequestDuration,
      resolveReferenceUpload: resolveVideoReferencePublicUploadOptions,
    }),
    speech: Object.freeze({
      transcribe: guarded("network", async (audio: Uint8Array, options?: CapabilitySpeechTranscribeOptions) =>
        db ? transcribeWithSavedSpeechToTextServer(db, audio, options) : null,
      ),
      transcribeLocal: guarded("network", (wav: Uint8Array) =>
        sidecarSpeechService.transcribeWav(Buffer.from(wav.buffer, wav.byteOffset, wav.byteLength)),
      ),
    }),
    // Books slots only; every provider it wraps was created under `network`.
    admission: Object.freeze({
      withProvider(provider: CapabilityIntegrationProvider, connectionId: string, mode?: ConnectionAdmissionMode) {
        const inner = providers.get(provider);
        if (!inner) throw new Error("Admission requires a provider created by this package's host integrations.");
        return expose(withConnectionAdmissionProvider(inner, connectionId, mode));
      },
      run: <T>(connectionId: string, mode: ConnectionAdmissionMode, operation: () => Promise<T>) =>
        withConnectionAdmission(connectionId, mode, operation),
      tryBackground: (connectionId: string, at?: Date) => tryBackgroundConnection(connectionId, at ?? new Date()),
      isFailure: isConnectionAdmissionFailure,
    }),
    haptics: Object.freeze({
      status: guarded("network", () => hapticService.status()),
      connect: guarded("network", (url?: string) => hapticService.connect(url)),
      executeCommand: guarded("network", (command: HapticDeviceCommand) => hapticService.executeCommand(command)),
    }),
    spotify: Object.freeze({
      commandsAvailable: guarded("network", async () => {
        if (!db) return false;
        try {
          const credentials = await resolveSpotifyCredentials(createAgentsStorage(db), { refreshSkewMs: 60_000 });
          return "accessToken" in credentials && spotifyHasScope(credentials.scopes, "user-modify-playback-state");
        } catch (error) {
          logger.debug(error, "[spotify/package] Failed to check Spotify command availability");
          return false;
        }
      }),
      playSong: guarded("network", async (input: { title: string; artist: string }) => {
        if (!db) throw new ConversationSpotifyCommandError(503, "Spotify is not available.", "spotify_unavailable");
        return playConversationSpotifyCommand({
          storage: createAgentsStorage(db),
          title: input.title,
          artist: input.artist,
        });
      }),
    }),
  });
}
