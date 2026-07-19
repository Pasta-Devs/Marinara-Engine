import type { DB } from "../../db/connection.js";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import {
  suppressesReferencePromptLine,
  resolveIllustratorCharacterReferences,
} from "../image/illustrator-references.js";
import { compileImagePrompt } from "../image/image-prompt-compiler.js";
import { persistGeneratedImageToEntityGalleries } from "../image/generated-image-entity-gallery.js";
import { resolveConnectionImageDefaults } from "../image/image-generation-defaults.js";
import { generateImage, saveImageToDisk } from "../image/image-generation.js";
import { loadImageGenerationUserSettings } from "../image/image-generation-settings.js";
import { resolveConversationSelfieSystemPrompt } from "../conversation/selfie-prompt.js";
import type { CharacterCommand, SelfieCommand } from "../conversation/character-commands.js";
import { createGalleryStorage } from "../storage/gallery.storage.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createPersonaGalleryStorage } from "../storage/persona-gallery.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import {
  resolveIllustratorPromptRuntime,
  type IllustratorPromptConnection,
  type IllustratorPromptConnectionsStore,
} from "./illustrator-prompt-runtime.js";
import { resolveImageConnectionFallback } from "./media-connection-fallback.js";
import { resolveBaseUrl } from "./connection-base-url.js";

type CharactersStore = {
  getById(id: string): Promise<{ data: unknown } | null>;
  list(): Promise<Array<{ id: string; data: unknown; avatarPath?: string | null }>>;
};

type ChatsStore = {
  appendSwipeAttachment(messageId: string, swipeIndex: number, attachment: Record<string, unknown>): Promise<unknown>;
  appendMessageAttachment(messageId: string, attachment: Record<string, unknown>): Promise<unknown>;
  getMessage(id: string): Promise<{ activeSwipeIndex?: number | null } | null>;
};

type ConnectionsStore = IllustratorPromptConnectionsStore & {
  getFallbackForImageGeneration(): Promise<Record<string, any> | null>;
};

type PromptCharacter = {
  id: string;
  name: string;
  avatarPath?: string | null;
  appearance?: string | null;
};

type PersonaReference = {
  id: string | null;
  name: string;
  avatarPath?: string | null;
  appearance?: string | null;
} | null;

export async function handleConversationSelfieCommand(args: {
  command: CharacterCommand;
  characterId: string | null;
  chatId: string;
  messageId?: string | null;
  swipeIndex?: number | null;
  chatMeta: Record<string, unknown>;
  charInfo: PromptCharacter[];
  persona: PersonaReference;
  promptConnection: IllustratorPromptConnection;
  promptConnectionId: string;
  debugMode?: boolean;
  serviceTier: "flex" | "priority" | null;
  db: DB;
  chars: CharactersStore;
  chats: ChatsStore;
  connections: ConnectionsStore;
  sendEvent: (payload: Record<string, unknown>) => void;
}): Promise<boolean> {
  if (args.command.type !== "selfie") return false;
  const command = args.command as SelfieCommand;

  const imgConnId = typeof args.chatMeta.imageGenConnectionId === "string" ? args.chatMeta.imageGenConnectionId : "";
  if (!imgConnId) {
    logger.warn("[commands] Selfie requested but no imageGenConnectionId set on chat metadata");
    args.sendEvent({
      type: "selfie_error",
      data: {
        characterId: args.characterId,
        error: "No image generation connection configured for this chat. Set one in Chat Settings.",
      },
    });
    return true;
  }

  const charRow = args.characterId ? await args.chars.getById(args.characterId) : null;
  const charData = parseRecord(charRow?.data);
  const charName = typeof charData?.name === "string" && charData.name.trim() ? charData.name : "character";
  args.sendEvent({ type: "typing", characters: [charName] });

  try {
    await generateSelfie({ ...args, command, imgConnId, charData, charName });
  } catch (err) {
    logger.error(err, "[commands] Selfie generation failed");
    args.sendEvent({
      type: "selfie_error",
      data: {
        characterId: args.characterId,
        error: err instanceof Error ? err.message : "Image generation failed",
      },
    });
  }

  return true;
}

async function generateSelfie(
  args: Parameters<typeof handleConversationSelfieCommand>[0] & {
    command: SelfieCommand;
    imgConnId: string;
    charData: Record<string, unknown> | null;
    charName: string;
  },
): Promise<void> {
  const imgConnFull = await args.connections.getWithKey(args.imgConnId);
  if (!imgConnFull) throw new Error("Cannot decrypt image generation connection");

  const extensions = parseRecord(args.charData?.extensions);
  const appearance =
    (typeof extensions?.appearance === "string" && extensions.appearance) ||
    (typeof args.charData?.description === "string" ? args.charData.description : "");

  const selfieTags = Array.isArray(args.chatMeta.selfieTags) ? (args.chatMeta.selfieTags as string[]) : [];
  const selfiePositivePrompt =
    typeof args.chatMeta.selfiePositivePrompt === "string"
      ? args.chatMeta.selfiePositivePrompt.trim()
      : selfieTags.join(", ").trim();
  const selfieNegativePrompt =
    typeof args.chatMeta.selfieNegativePrompt === "string" ? args.chatMeta.selfieNegativePrompt.trim() : "";
  const selfiePromptTemplate = typeof args.chatMeta.selfiePrompt === "string" ? args.chatMeta.selfiePrompt.trim() : "";

  const reportFallback = (notice: {
    category: "main" | "agents" | "illustrator" | "video";
    connectionId: string;
    connectionName: string;
    model: string;
  }) => args.sendEvent({ type: "fallback_used", data: notice });
  const promptRuntime = await resolveIllustratorPromptRuntime({
    chatMetadata: args.chatMeta,
    defaultConnection: args.promptConnection,
    defaultConnectionId: args.promptConnectionId,
    connections: args.connections,
    resolveBaseUrl,
    onFallback: reportFallback,
  });
  const selfieSystemPrompt = await resolveConversationSelfieSystemPrompt({
    promptOverridesStorage: createPromptOverridesStorage(args.db),
    chatPromptTemplate: selfiePromptTemplate,
    appearance,
    charName: args.charName,
  });
  const userPrompt = args.command.context
    ? `Context for the selfie: ${args.command.context}`
    : `Generate a casual selfie of ${args.charName} based on the current conversation context.`;
  const debugOverrideEnabled = args.debugMode === true || isDebugAgentsEnabled();
  if (debugOverrideEnabled || logger.isLevelEnabled("debug")) {
    logDebugOverride(
      debugOverrideEnabled,
      "[debug/commands/selfie] prompt-builder system:\n%s",
      selfieSystemPrompt,
    );
    logDebugOverride(debugOverrideEnabled, "[debug/commands/selfie] prompt-builder user:\n%s", userPrompt);
  }
  const promptResult = await promptRuntime.provider.chatComplete(
    [
      {
        role: "system",
        content: selfieSystemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    {
      model: promptRuntime.model,
      ...(promptRuntime.suppressModelParameters
        ? {}
        : { temperature: 0.7, maxTokens: 8196, serviceTier: args.serviceTier }),
      suppressModelParameters: promptRuntime.suppressModelParameters,
      enableCaching: promptRuntime.enableCaching,
      anthropicExtendedCacheTtl: promptRuntime.anthropicExtendedCacheTtl,
    },
  );

  const imagePrompt = (promptResult.content ?? "").trim();
  if (!imagePrompt) return;

  const imageFallback = await resolveImageConnectionFallback(args.connections, imgConnFull.id);
  const suppressReferencePromptLine = suppressesReferencePromptLine(
    {
      model: imgConnFull.model,
      baseUrl: imgConnFull.baseUrl,
      imageService: imgConnFull.imageService,
      imageGenerationSource: imgConnFull.imageGenerationSource,
    },
    imageFallback,
  );
  let finalSelfiePrompt = selfiePositivePrompt ? `${imagePrompt}, ${selfiePositivePrompt}` : imagePrompt;
  let selfieReferenceImages: string[] | undefined;
  const selfieUseAvatarReferences = args.chatMeta.selfieUseAvatarReferences === true;
  const selfieIncludeCharacterAppearance = args.chatMeta.selfieIncludeCharacterAppearance === true;
  if (selfieUseAvatarReferences || selfieIncludeCharacterAppearance) {
    const referenceResolution = await resolveIllustratorCharacterReferences({
      charactersStore: args.chars,
      chatCharacters: args.charInfo.map((character) => ({
        id: character.id,
        name: character.name,
        avatarPath: character.avatarPath,
        appearance: character.appearance,
      })),
      persona: args.persona,
      requestedNames: [args.charName],
      promptText: [args.charName, args.command.context ?? "", imagePrompt].join("\n"),
      fallbackToChatCharacters: false,
      maxReferences: 1,
    });
    if (selfieIncludeCharacterAppearance && referenceResolution.appearanceBlock) {
      finalSelfiePrompt += `\n\n${referenceResolution.appearanceBlock}`;
      logger.debug("[selfie] Added character appearance notes for: %s", referenceResolution.appearanceNames.join(", "));
    }
    if (selfieUseAvatarReferences && referenceResolution.referenceImages.length > 0) {
      selfieReferenceImages = referenceResolution.referenceImages;
      if (referenceResolution.referenceLine && !suppressReferencePromptLine) {
        finalSelfiePrompt += `\n\n${referenceResolution.referenceLine}`;
      }
      logger.debug("[selfie] Sending character reference for: %s", referenceResolution.referenceNames.join(", "));
    }
  }

  const galleryStore = createGalleryStorage(args.db);
  const imgModel = imgConnFull.model || "";
  const imgBaseUrl = imgConnFull.baseUrl || "https://image.pollinations.ai";
  const imgApiKey = imgConnFull.apiKey || "";
  const imgSource = imgConnFull.imageGenerationSource || imgModel;
  const imageDefaults = resolveConnectionImageDefaults(imgConnFull);
  const imageSettings = await loadImageGenerationUserSettings(args.db);
  const configuredStyleProfileId =
    readNestedString(args.chatMeta.gameSetupConfig, "imageStyleProfileId") ??
    (typeof args.chatMeta.imageStyleProfileId === "string" ? args.chatMeta.imageStyleProfileId : null);
  const styleProfileId =
    typeof configuredStyleProfileId === "string" && configuredStyleProfileId.trim()
      ? configuredStyleProfileId.trim()
      : imageSettings.styleProfiles.defaultProfileId;

  const selfieRes = typeof args.chatMeta.selfieResolution === "string" ? args.chatMeta.selfieResolution : "";
  const [selfieW, selfieH] = selfieRes.split("x").map(Number) as [number, number];
  const serviceHint = imgConnFull.imageService || "";
  const compiledSelfiePrompt = compileImagePrompt({
    kind: "selfie",
    prompt: finalSelfiePrompt,
    negativePrompt: selfieNegativePrompt || undefined,
    styleProfiles: imageSettings.styleProfiles,
    styleProfileId,
    imageDefaults,
  });
  const imageResult = await generateImage(imgModel, imgBaseUrl, imgApiKey, serviceHint || imgSource, {
    prompt: compiledSelfiePrompt.prompt,
    negativePrompt: compiledSelfiePrompt.negativePrompt || undefined,
    model: imgModel,
    width: selfieW || imageSettings.selfie.width,
    height: selfieH || imageSettings.selfie.height,
    imageEndpointId: imgConnFull.imageEndpointId || undefined,
    comfyWorkflow: imgConnFull.comfyuiWorkflow || undefined,
    imageDefaults,
    referenceImages: selfieReferenceImages,
    fallback: imageFallback,
    onFallback: reportFallback,
  });

  const filePath = saveImageToDisk(args.chatId, imageResult.base64, imageResult.ext);
  const effectiveImageProvider =
    imageResult.effectiveConnection?.provider ?? imgConnFull.provider ?? "image_generation";
  const effectiveImageModel = imageResult.effectiveConnection?.model || imgModel || "unknown";
  const galleryEntry = await galleryStore.create({
    chatId: args.chatId,
    filePath,
    prompt: compiledSelfiePrompt.prompt,
    provider: effectiveImageProvider,
    model: effectiveImageModel,
    width: selfieW || imageSettings.selfie.width,
    height: selfieH || imageSettings.selfie.height,
  });
  await persistGeneratedImageToEntityGalleries({
    sourceFilePath: filePath,
    characterIds: args.characterId ? [args.characterId] : [],
    characterGallery: createCharacterGalleryStorage(args.db),
    personaGallery: createPersonaGalleryStorage(args.db),
    prompt: compiledSelfiePrompt.prompt,
    provider: effectiveImageProvider,
    model: effectiveImageModel,
    width: selfieW || imageSettings.selfie.width,
    height: selfieH || imageSettings.selfie.height,
  });

  const filename = filePath.split("/").pop()!;
  const imageUrl = `/api/gallery/file/${args.chatId}/${encodeURIComponent(filename)}`;
  if (args.messageId) {
    const generationSwipeIndex = Number.isInteger(args.swipeIndex) ? args.swipeIndex! : 0;
    const attachment = {
      type: "image",
      url: imageUrl,
      filename: `selfie_${args.charName.toLowerCase().replace(/\s+/g, "_")}.${imageResult.ext}`,
      prompt: compiledSelfiePrompt.prompt,
      galleryId: galleryEntry?.id,
    };
    await args.chats.appendSwipeAttachment(args.messageId, generationSwipeIndex, attachment);

    const currentMsgRow = await args.chats.getMessage(args.messageId);
    if (currentMsgRow && (currentMsgRow.activeSwipeIndex ?? 0) === generationSwipeIndex) {
      await args.chats.appendMessageAttachment(args.messageId, attachment);
    }
  }

  args.sendEvent({
    type: "selfie",
    data: {
      characterId: args.characterId,
      characterName: args.charName,
      messageId: args.messageId,
      imageUrl,
      prompt: compiledSelfiePrompt.prompt,
      galleryId: galleryEntry?.id,
    },
  });
  logger.debug("[commands] Selfie generated for %s", args.charName);
}

function readNestedString(value: unknown, key: string): string | null {
  const record = parseRecord(value);
  const nested = record?.[key];
  return typeof nested === "string" ? nested : null;
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
