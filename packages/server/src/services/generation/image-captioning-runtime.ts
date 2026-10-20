import { createHash } from "node:crypto";
import { allowsDefaultChatModel } from "../llm/local-context-limit.js";
import {
  DEFAULT_IMAGE_CAPTIONING_PROMPT,
  LOCAL_SIDECAR_CONNECTION_ID,
  modelReadsImages,
  parseConnectionImageCaptioningDefaults,
} from "@marinara-engine/shared";

import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { applyProviderMaxTokensOverride } from "./generation-parameters.js";
import { BaseLLMProvider, type ChatMessage, type ChatOptions, type LLMUsage } from "../llm/base-provider.js";
import { isImageInputUnsupported } from "../llm/lorebook-image-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import type { ConnectionAdmissionMode } from "./connection-admission.js";
import {
  appendReadableAttachmentsToContent,
  escapeXmlAttribute,
  extractFileAttachmentInputs,
  extractImageAttachmentDataUrls,
  getAttachmentFilename,
  isSentSelfieAttachment,
  parseExtra,
  type PromptAttachment,
} from "./prompt-attachments.js";
import { resolveBaseUrl } from "./connection-base-url.js";

export type ImageCaptionConnection = {
  id: string;
  name?: string | null;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string | null;
  maxContext?: number | null;
  openrouterProvider?: string | null;
  maxTokensOverride?: number | null;
  claudeFastMode?: string | null;
  treatAsLocalEndpoint?: string | null;
  enableCaching?: string | null;
  anthropicExtendedCacheTtl?: string | null;
  cachingAtDepth?: number | null;
  defaultParameters?: unknown;
  /** Whether this chat Model reads images ("reads" / "text"); null lets its catalog decide. */
  imageInput?: string | null;
  accountId?: string | null;
  savedModels?: unknown;
};

export type ImageCaptioningRuntime = {
  enabled: boolean;
  connectionId: string | null;
  connection: ImageCaptionConnection | null;
  provider: BaseLLMProvider | null;
  /** The chat's own captioning prompt. Blank means the built-in default. */
  prompt?: string | null;
  /** Why captioning is on but can't run. Turns with images then fail instead of sending the raw image. */
  unavailableReason?: string;
};

export type PromptAttachmentResolution = {
  content: string;
  images: string[];
  files: Array<{ type: string; data: string; filename: string }>;
  updatedAttachments: PromptAttachment[] | null;
};

export function redactImageCaptionMessagesForLog(messages: readonly ChatMessage[]) {
  return messages.map((message) => ({
    ...message,
    ...(message.images
      ? {
          images: message.images.map((image) => {
            const separator = image.indexOf(",");
            return {
              mediaType:
                image.startsWith("data:") && separator > 5 ? image.slice(5, separator).split(";")[0] : "unknown",
              encodedCharacters: image.length,
            };
          }),
        }
      : {}),
  }));
}

export const DISABLED_IMAGE_CAPTIONING: ImageCaptioningRuntime = {
  enabled: false,
  connectionId: null,
  connection: null,
  provider: null,
};

function unavailableImageCaptioning(reason: string): ImageCaptioningRuntime {
  return { ...DISABLED_IMAGE_CAPTIONING, enabled: true, unavailableReason: reason };
}

const IMAGE_CAPTION_MAX_TOKENS = 700;
const IMAGE_CAPTION_MAX_CHARS = 4_000;
const IMAGE_CAPTION_MAX_GENERATIONS = 8;
const IMAGE_CAPTION_CONCURRENCY = 2;

type ImageCaptioningArgs = {
  chatMeta: Record<string, unknown>;
  fallbackConnectionId: string | null;
  connections: {
    listRandomPool(): Promise<Array<{ id?: string | null }>>;
    getWithKey(connectionId: string): Promise<ImageCaptionConnection | null>;
    getFallbackForAgents(): Promise<ImageCaptionConnection | null>;
    /** The saved model list of a Model's Connection; its input modalities say whether the Model reads images. */
    readCatalog?(row: {
      accountId?: string | null;
      provider: string;
      savedModels?: unknown;
    }): Promise<{ models: Array<{ id: string; inputModalities?: string[] }> } | null>;
  };
  /** The engine-wide Image reading default: it reads images for chat Models that cannot. */
  visionConnectionId?: string | null;
  /** Admission mode of the work this captioning run feeds. */
  admissionMode?: ConnectionAdmissionMode;
};

/** Whether the chat's Model reads images: its own setting, then its catalog. null = unknown (images are sent). */
async function chatModelReadsImages(
  args: ImageCaptioningArgs,
  activeConnection: ImageCaptionConnection | null,
): Promise<boolean | null> {
  if (args.fallbackConnectionId === LOCAL_SIDECAR_CONNECTION_ID) return false;
  if (!activeConnection) return null;
  if (activeConnection.imageInput === "reads" || activeConnection.imageInput === "text") {
    return modelReadsImages(activeConnection);
  }
  const catalog = await args.connections.readCatalog?.(activeConnection);
  return modelReadsImages(
    activeConnection,
    catalog?.models.find((model) => model.id === activeConnection.model),
  );
}

/**
 * Captioning for a turn. The chat's switch wins, then the Model's own "Image captioning" default. Without either
 * it is Automatic: it captions only when the chat's Model cannot read images and an Image reading default is set.
 * The captioning Model is the chat's choice, then the Model's, then the Image reading default, then the chat's own
 * Model. The on-device model cannot read images, so it is never picked.
 */
export async function resolveImageCaptioningRuntime(args: ImageCaptioningArgs): Promise<ImageCaptioningRuntime> {
  const { chatMeta, connections } = args;
  // An explicit "on" in the chat counts even if loading a connection below throws, so that error is shown.
  let captioningEnabled = chatMeta.imageCaptioningEnabled === true;
  try {
    const hasChatEnabledOverride = typeof chatMeta.imageCaptioningEnabled === "boolean";
    const hasChatConnectionOverride = Object.prototype.hasOwnProperty.call(chatMeta, "imageCaptioningConnectionId");
    const activeConnection =
      args.fallbackConnectionId &&
      args.fallbackConnectionId !== "random" &&
      args.fallbackConnectionId !== LOCAL_SIDECAR_CONNECTION_ID
        ? await connections.getWithKey(args.fallbackConnectionId)
        : null;
    const connectionDefaults = parseConnectionImageCaptioningDefaults(activeConnection?.defaultParameters);
    const visionConnectionId = usableCaptionId(args.visionConnectionId);
    captioningEnabled = hasChatEnabledOverride
      ? chatMeta.imageCaptioningEnabled === true
      : connectionDefaults.imageCaptioningEnabled === true ||
        (!!visionConnectionId && (await chatModelReadsImages(args, activeConnection)) === false);
    if (!captioningEnabled) return DISABLED_IMAGE_CAPTIONING;

    const inheritedConnectionId =
      typeof connectionDefaults.imageCaptioningConnectionId === "string"
        ? connectionDefaults.imageCaptioningConnectionId
        : null;
    const configuredConnectionId = hasChatConnectionOverride
      ? typeof chatMeta.imageCaptioningConnectionId === "string" && chatMeta.imageCaptioningConnectionId.trim()
        ? chatMeta.imageCaptioningConnectionId.trim()
        : null
      : inheritedConnectionId;
    const captionConnectionId =
      usableCaptionId(configuredConnectionId) ?? visionConnectionId ?? usableCaptionId(args.fallbackConnectionId);
    if (!captionConnectionId) {
      return unavailableImageCaptioning(
        args.fallbackConnectionId === LOCAL_SIDECAR_CONNECTION_ID
          ? "the local model cannot read images; choose an Image reading model"
          : "no captioning connection is selected",
      );
    }
    return await captioningWith(captionConnectionId, args, activeConnection);
  } catch (error) {
    logger.warn(error, "[image-captioning] Failed to resolve captioning connection");
    return captioningEnabled
      ? unavailableImageCaptioning(error instanceof Error ? error.message : String(error))
      : DISABLED_IMAGE_CAPTIONING;
  }
}

/** Captioning with the Image reading default, for a provider that refused the images it was sent. */
export async function resolveVisionCaptioningRuntime(args: ImageCaptioningArgs): Promise<ImageCaptioningRuntime> {
  const visionConnectionId = usableCaptionId(args.visionConnectionId);
  if (!visionConnectionId) return DISABLED_IMAGE_CAPTIONING;
  try {
    return await captioningWith(visionConnectionId, args, null);
  } catch (error) {
    logger.warn(error, "[image-captioning] Failed to resolve the Image reading model");
    return unavailableImageCaptioning(error instanceof Error ? error.message : String(error));
  }
}

const usableCaptionId = (id: string | null | undefined) => (id && id !== LOCAL_SIDECAR_CONNECTION_ID ? id : null);

async function captioningWith(
  connectionId: string,
  args: ImageCaptioningArgs,
  activeConnection: ImageCaptionConnection | null,
): Promise<ImageCaptioningRuntime> {
  const { chatMeta, connections } = args;
  let captionConnectionId = connectionId;
  if (captionConnectionId === "random") {
    const pool = await connections.listRandomPool();
    if (!pool.length) {
      logger.warn("[image-captioning] Random captioning connection requested but random pool is empty");
      return unavailableImageCaptioning("the random connection pool is empty");
    }
    const randomCaptionConnectionId = pool[Math.floor(Math.random() * pool.length)]?.id;
    if (!randomCaptionConnectionId) {
      logger.warn("[image-captioning] Random captioning connection resolved without an id");
      return unavailableImageCaptioning("the random connection pool is empty");
    }
    captionConnectionId = randomCaptionConnectionId;
  }

  const captionConnection =
    activeConnection?.id === captionConnectionId ? activeConnection : await connections.getWithKey(captionConnectionId);
  if (!captionConnection || (!captionConnection.model && !allowsDefaultChatModel(captionConnection))) {
    logger.warn("[image-captioning] Captioning connection %s was not found", captionConnectionId);
    return unavailableImageCaptioning(
      captionConnection ? "the captioning connection has no model" : "the captioning connection was not found",
    );
  }

  const captionBaseUrl = resolveBaseUrl(captionConnection);
  if (!captionBaseUrl) {
    logger.warn("[image-captioning] Captioning connection %s has no base URL", captionConnectionId);
    return unavailableImageCaptioning("the captioning connection has no base URL");
  }
  const fallbackConnection = await connections.getFallbackForAgents();
  const captionProvider = withConnectionFallbackProvider({
    primary: createLLMProvider(
      captionConnection.provider,
      captionBaseUrl,
      captionConnection.apiKey,
      captionConnection.maxContext,
      captionConnection.openrouterProvider,
      captionConnection.maxTokensOverride,
      captionConnection.claudeFastMode === "true",
      captionConnection.treatAsLocalEndpoint === "true",
      captionConnection.defaultParameters,
    ),
    primaryConnectionId: captionConnectionId,
    fallbackConnection,
    fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
    category: "agents",
    // On the caller's own connection, captioning is a step inside the caller's attempt, not a
    // separate one. Booking it as foreground during a background run stamps the connection
    // foreground-active and the caller's real generation is then refused for the whole idle
    // window — the run blocks itself. That attempt is already admitted, so the step is not
    // accounted twice. A captioning connection the caller did not admit gets no such exemption
    // and stays under background admission.
    admissionMode:
      args.admissionMode?.kind === "background" && captionConnectionId === args.fallbackConnectionId
        ? { kind: "none" }
        : args.admissionMode,
  });

  return {
    enabled: true,
    connectionId: captionConnectionId,
    connection: captionConnection,
    provider: captionProvider,
    prompt: typeof chatMeta.imageCaptioningPrompt === "string" ? chatMeta.imageCaptioningPrompt : null,
  };
}

export function normalizePromptAttachments(extra: unknown): PromptAttachment[] | undefined {
  const rawAttachments = parseExtra(extra).attachments;
  if (!Array.isArray(rawAttachments)) return undefined;
  const attachments = rawAttachments.filter(
    (attachment): attachment is PromptAttachment =>
      !!attachment && typeof attachment === "object" && !Array.isArray(attachment),
  );
  return attachments.length ? attachments : undefined;
}

function normalizeImageCaptionText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (!text) return null;
  return text.length > IMAGE_CAPTION_MAX_CHARS ? `${text.slice(0, IMAGE_CAPTION_MAX_CHARS).trim()}...` : text;
}

function effectiveCaptionPrompt(imageCaptioning: ImageCaptioningRuntime): string {
  return imageCaptioning.prompt?.trim() || DEFAULT_IMAGE_CAPTIONING_PROMPT;
}

function captionPromptKey(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

function readCachedImageCaption(attachment: PromptAttachment, imageCaptioning: ImageCaptioningRuntime): string | null {
  const caption = normalizeImageCaptionText(attachment.imageCaption);
  if (!caption || !imageCaptioning.connection) return null;
  if (attachment.imageCaptionConnectionId !== imageCaptioning.connectionId) return null;
  if (attachment.imageCaptionModel !== imageCaptioning.connection.model) return null;
  if (attachment.imageCaptionProvider !== imageCaptioning.connection.provider) return null;
  // A changed prompt makes a new caption. Captions from before prompts were editable used the default.
  const prompt = effectiveCaptionPrompt(imageCaptioning);
  const cachedKey = attachment.imageCaptionPromptKey ?? captionPromptKey(DEFAULT_IMAGE_CAPTIONING_PROMPT);
  if (cachedKey !== captionPromptKey(prompt)) return null;
  return caption;
}

function formatImageCaptionBlock(attachment: PromptAttachment, caption: string): string {
  const name = getAttachmentFilename(attachment);
  const type = typeof attachment.type === "string" && attachment.type.trim() ? attachment.type.trim() : "image";
  return [
    `<attached_image name="${escapeXmlAttribute(name)}" type="${escapeXmlAttribute(type)}">`,
    caption,
    `</attached_image>`,
  ].join("\n");
}

function appendImageCaptionBlocksToContent(content: string, blocks: string[]): string {
  if (blocks.length === 0) return content;
  return `${content}${content.trim() ? "\n\n" : ""}${blocks.join("\n\n")}`;
}

export async function generateImageCaptionForDataUrl(
  filename: string,
  imageDataUrl: string,
  imageCaptioning: ImageCaptioningRuntime,
  signal: AbortSignal,
  debugMode = false,
): Promise<string | null> {
  if (!imageCaptioning.provider || !imageCaptioning.connection) return null;
  const messages = [
    { role: "system" as const, content: effectiveCaptionPrompt(imageCaptioning) },
    {
      role: "user" as const,
      content: `Describe this image attachment named "${filename}" for use inside a chat prompt. Return only the description.`,
      images: [imageDataUrl],
    },
  ];
  const messagesForLog = redactImageCaptionMessagesForLog(messages);
  logDebugOverride(
    debugMode || isDebugAgentsEnabled(),
    "[debug/image-captioning] Final provider messages:\n%s",
    JSON.stringify(messagesForLog, null, 2),
  );
  // Failures stop the turn: sending the raw image instead would quietly ignore the user's captioning setting.
  const result = await imageCaptioning.provider
    .chatComplete(messages, {
      model: imageCaptioning.connection.model,
      temperature: 0.2,
      maxTokens: applyProviderMaxTokensOverride(imageCaptioning.provider, IMAGE_CAPTION_MAX_TOKENS),
      enableCaching: imageCaptioning.connection.enableCaching === "true",
      anthropicExtendedCacheTtl: imageCaptioning.connection.anthropicExtendedCacheTtl === "true",
      cachingAtDepth: imageCaptioning.connection.cachingAtDepth ?? 5,
      stream: false,
      signal,
    })
    .catch((error: unknown) => {
      if (signal.aborted) throw error;
      throw new Error(`Image captioning failed for "${filename}"`, { cause: error });
    });
  const caption = normalizeImageCaptionText(result.content);
  if (!caption) throw new Error(`Image captioning failed for "${filename}": the captioning model sent back no text`);
  return caption;
}

export async function generateImageCaptionsForDataUrls<T extends { filename: string; imageDataUrl: string }>(
  inputs: T[],
  imageCaptioning: ImageCaptioningRuntime,
  signal: AbortSignal,
  debugMode = false,
): Promise<Array<{ input: T; caption: string | null }>> {
  const results = new Array<{ input: T; caption: string | null }>(inputs.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(IMAGE_CAPTION_CONCURRENCY, inputs.length) }, async () => {
    while (nextIndex < inputs.length) {
      signal.throwIfAborted();
      const index = nextIndex++;
      const input = inputs[index]!;
      results[index] = {
        input,
        caption: await generateImageCaptionForDataUrl(
          input.filename,
          input.imageDataUrl,
          imageCaptioning,
          signal,
          debugMode,
        ),
      };
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Caption the selfies a character sent, so their history note describes the image rather than the
 * prompt that asked for it. Captions are cached on the attachment like uploads. Unlike uploads, a
 * missing file or failed caption does not stop the turn: the note falls back to the image prompt.
 * Returns the updated attachments when a new caption was made.
 */
export async function captionSentSelfies(args: {
  attachments: PromptAttachment[] | undefined;
  imageCaptioning: ImageCaptioningRuntime;
  readImageDataUrl: (attachment: PromptAttachment) => Promise<string | null>;
  signal: AbortSignal;
  debugMode?: boolean;
}): Promise<PromptAttachment[] | null> {
  const { attachments, imageCaptioning } = args;
  const connection = imageCaptioning.connection;
  if (!attachments?.length || !imageCaptioning.enabled || !imageCaptioning.provider || !connection) return null;
  let updatedAttachments: PromptAttachment[] | null = null;
  for (const [index, attachment] of attachments.entries()) {
    if (!isSentSelfieAttachment(attachment) || readCachedImageCaption(attachment, imageCaptioning)) continue;
    try {
      const imageDataUrl = await args.readImageDataUrl(attachment);
      if (!imageDataUrl) continue;
      const filename = getAttachmentFilename(attachment);
      const caption = await generateImageCaptionForDataUrl(
        filename,
        imageDataUrl,
        imageCaptioning,
        args.signal,
        args.debugMode,
      );
      if (!caption) continue;
      updatedAttachments ??= attachments.map((item) => ({ ...item }));
      updatedAttachments[index] = {
        ...attachment,
        imageCaption: caption,
        imageCaptionConnectionId: imageCaptioning.connectionId,
        imageCaptionModel: connection.model,
        imageCaptionProvider: connection.provider,
        imageCaptionPromptKey: captionPromptKey(effectiveCaptionPrompt(imageCaptioning)),
        imageCaptionedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (args.signal.aborted) throw error;
      logger.warn(error, "[image-captioning] Selfie caption failed; using its image prompt instead");
    }
  }
  return updatedAttachments;
}

export async function resolvePromptAttachmentInputs(args: {
  content: string;
  attachments: PromptAttachment[] | undefined;
  imageCaptioning: ImageCaptioningRuntime;
  signal: AbortSignal;
  debugMode?: boolean;
}): Promise<PromptAttachmentResolution> {
  const { attachments, imageCaptioning, signal } = args;
  const files = extractFileAttachmentInputs(attachments);
  let content = appendReadableAttachmentsToContent(args.content, attachments);

  if (!imageCaptioning.enabled) {
    return {
      content,
      images: extractImageAttachmentDataUrls(attachments),
      files,
      updatedAttachments: null,
    };
  }
  if (!imageCaptioning.provider || !imageCaptioning.connection) {
    if (extractImageAttachmentDataUrls(attachments).length) {
      throw new Error(`Image captioning failed: ${imageCaptioning.unavailableReason ?? "no captioning connection"}`);
    }
    return { content, images: [], files, updatedAttachments: null };
  }

  const captionBlocks: string[] = [];
  const fallbackImages: string[] = [];
  let updatedAttachments: PromptAttachment[] | null = null;
  const sourceAttachments = attachments ?? [];
  const captionConnection = imageCaptioning.connection;
  const resolvedImages: Array<{
    index: number;
    attachment: PromptAttachment;
    imageDataUrl: string;
    caption: string | null;
    updatedAttachment: PromptAttachment | null;
  } | null> = sourceAttachments.map((attachment, index) => {
    const imageDataUrl = extractImageAttachmentDataUrls([attachment])[0];
    if (!imageDataUrl) return null;
    return {
      index,
      attachment,
      imageDataUrl,
      caption: readCachedImageCaption(attachment, imageCaptioning),
      updatedAttachment: null,
    };
  });
  const captionsToGenerate = resolvedImages
    .filter((result): result is NonNullable<typeof result> => result !== null && result.caption === null)
    .slice(0, IMAGE_CAPTION_MAX_GENERATIONS);
  const generatedCaptions = await generateImageCaptionsForDataUrls(
    captionsToGenerate.map((result) => ({
      filename: getAttachmentFilename(result.attachment),
      imageDataUrl: result.imageDataUrl,
      result,
    })),
    imageCaptioning,
    signal,
    args.debugMode,
  );
  for (const { input, caption } of generatedCaptions) {
    input.result.caption = caption;
    if (caption) {
      input.result.updatedAttachment = {
        ...input.result.attachment,
        imageCaption: caption,
        imageCaptionConnectionId: imageCaptioning.connectionId,
        imageCaptionModel: captionConnection.model,
        imageCaptionProvider: captionConnection.provider,
        imageCaptionPromptKey: captionPromptKey(effectiveCaptionPrompt(imageCaptioning)),
        imageCaptionedAt: new Date().toISOString(),
      };
    }
  }

  for (const result of resolvedImages) {
    if (!result) continue;
    const { index, attachment, imageDataUrl, caption, updatedAttachment } = result;
    if (updatedAttachment) {
      updatedAttachments ??= sourceAttachments.map((item) => ({ ...item }));
      updatedAttachments[index] = updatedAttachment;
    }
    if (caption) {
      captionBlocks.push(
        formatImageCaptionBlock(updatedAttachment ?? updatedAttachments?.[index] ?? attachment, caption),
      );
    } else {
      fallbackImages.push(imageDataUrl);
    }
  }

  content = appendImageCaptionBlocksToContent(content, captionBlocks);
  return {
    content,
    images: fallbackImages,
    files,
    updatedAttachments,
  };
}

/**
 * A chat provider that refuses images before any output gets them as captions from the Image reading default,
 * once per request. After one refusal the later requests (a tool loop) send captions straight away; each image is
 * described once. Without an Image reading default the provider's error stands.
 */
export function withImageCaptionFallback(
  provider: BaseLLMProvider,
  resolveCaptioning: () => Promise<ImageCaptioningRuntime>,
  debugMode = false,
): BaseLLMProvider {
  let captioning: Promise<ImageCaptioningRuntime> | null = null;
  let imagesRejected = false;
  const captions = new Map<string, string>();
  const withCaptions = async (messages: ChatMessage[], signal: AbortSignal | undefined) => {
    captioning ??= resolveCaptioning();
    const runtime = await captioning;
    if (!runtime.provider) return null;
    const missing = [...new Set(messages.flatMap((message) => message.images ?? []))].filter(
      (url) => !captions.has(url),
    );
    const made = await generateImageCaptionsForDataUrls(
      missing.map((imageDataUrl, index) => ({ filename: `image-${captions.size + index + 1}`, imageDataUrl })),
      runtime,
      signal ?? new AbortController().signal,
      debugMode,
    );
    for (const { input, caption } of made) {
      captions.set(
        input.imageDataUrl,
        formatImageCaptionBlock({ filename: input.filename, type: "image" }, caption ?? ""),
      );
    }
    return messages.map((message) => {
      if (!message.images?.length) return message;
      const { images, ...rest } = message;
      return {
        ...rest,
        content: appendImageCaptionBlocksToContent(
          rest.content,
          images.map((url) => captions.get(url)!),
        ),
      };
    });
  };
  const hasImages = (messages: ChatMessage[]) => messages.some((message) => message.images?.length);
  const retryMessages = async (error: unknown, started: boolean, messages: ChatMessage[], options: ChatOptions) => {
    if (started || options.signal?.aborted || !hasImages(messages) || !isImageInputUnsupported(error)) return null;
    const captioned = await withCaptions(messages, options.signal);
    if (captioned) {
      imagesRejected = true;
      logger.info("[image-captioning] The chat model refused images; described them with the Image reading model");
    }
    return captioned;
  };
  const firstMessages = async (messages: ChatMessage[], options: ChatOptions) =>
    imagesRejected && hasImages(messages) ? ((await withCaptions(messages, options.signal)) ?? messages) : messages;

  class ImageCaptionFallbackProvider extends BaseLLMProvider {
    constructor() {
      super("", "", provider.maxContextValue ?? undefined, null, provider.maxTokensOverrideValue);
    }

    async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
      const first = await firstMessages(messages, options);
      let started = false;
      try {
        const stream = provider.chat(first, options);
        try {
          while (true) {
            const chunk = await stream.next();
            if (chunk.done) return chunk.value;
            started = true;
            yield chunk.value;
          }
        } finally {
          await stream.return(undefined).catch((error: unknown) => {
            logger.warn(error, "[image-captioning] Failed to close the generation stream");
          });
        }
      } catch (error) {
        const retry = await retryMessages(error, started, first, options);
        if (!retry) throw error;
        return yield* provider.chat(retry, options);
      }
    }

    override async chatComplete(messages: ChatMessage[], options: ChatOptions) {
      const first = await firstMessages(messages, options);
      let started = false;
      try {
        return await provider.chatComplete(first, {
          ...options,
          ...(options.onToken
            ? {
                onToken: (token: string) => {
                  started = true;
                  return options.onToken!(token);
                },
              }
            : {}),
        });
      } catch (error) {
        const retry = await retryMessages(error, started, first, options);
        if (!retry) throw error;
        return provider.chatComplete(retry, options);
      }
    }

    override embed(texts: string[], model: string, signal?: AbortSignal) {
      return provider.embed(texts, model, signal);
    }
  }
  return new ImageCaptionFallbackProvider();
}
