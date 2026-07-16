import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";

import { logger } from "../../lib/logger.js";
import { applyProviderMaxTokensOverride } from "../../services/generation/generation-parameters.js";
import { getLocalSidecarProvider } from "../../services/llm/local-sidecar.js";
import type { BaseLLMProvider } from "../../services/llm/base-provider.js";
import { createLLMProvider } from "../../services/llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../../services/llm/connection-fallback-provider.js";
import {
  appendReadableAttachmentsToContent,
  createLocalSidecarGenerationConnection,
  escapeXmlAttribute,
  extractFileAttachmentInputs,
  extractImageAttachmentDataUrls,
  getAttachmentFilename,
  parseExtra,
  resolveBaseUrl,
  type PromptAttachment,
} from "./generate-route-utils.js";

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
};

export type ImageCaptioningRuntime = {
  enabled: boolean;
  connectionId: string | null;
  connection: ImageCaptionConnection | null;
  provider: BaseLLMProvider | null;
};

export type PromptAttachmentResolution = {
  content: string;
  images: string[];
  files: Array<{ type: string; data: string; filename: string }>;
  updatedAttachments: PromptAttachment[] | null;
};

export const DISABLED_IMAGE_CAPTIONING: ImageCaptioningRuntime = {
  enabled: false,
  connectionId: null,
  connection: null,
  provider: null,
};

const IMAGE_CAPTION_MAX_TOKENS = 700;
const IMAGE_CAPTION_MAX_CHARS = 4_000;

export async function resolveImageCaptioningRuntime(args: {
  chatMeta: Record<string, unknown>;
  fallbackConnectionId: string | null;
  connections: {
    listRandomPool(): Promise<Array<{ id?: string | null }>>;
    getWithKey(connectionId: string): Promise<ImageCaptionConnection | null>;
    getFallbackForAgents(): Promise<ImageCaptionConnection | null>;
  };
}): Promise<ImageCaptioningRuntime> {
  const { chatMeta, connections } = args;
  if (chatMeta.imageCaptioningEnabled !== true) return DISABLED_IMAGE_CAPTIONING;
  try {
    const configuredConnectionId =
      typeof chatMeta.imageCaptioningConnectionId === "string" && chatMeta.imageCaptioningConnectionId.trim()
        ? chatMeta.imageCaptioningConnectionId.trim()
        : null;
    const fallbackCaptionConnectionId = configuredConnectionId ?? args.fallbackConnectionId;
    if (!fallbackCaptionConnectionId) return DISABLED_IMAGE_CAPTIONING;
    let captionConnectionId = fallbackCaptionConnectionId;
    if (captionConnectionId === "random") {
      const pool = await connections.listRandomPool();
      if (!pool.length) {
        logger.warn("[image-captioning] Random captioning connection requested but random pool is empty");
        return DISABLED_IMAGE_CAPTIONING;
      }
      const randomCaptionConnectionId = pool[Math.floor(Math.random() * pool.length)]?.id;
      if (!randomCaptionConnectionId) {
        logger.warn("[image-captioning] Random captioning connection resolved without an id");
        return DISABLED_IMAGE_CAPTIONING;
      }
      captionConnectionId = randomCaptionConnectionId;
    }

    const captionConnection =
      captionConnectionId === LOCAL_SIDECAR_CONNECTION_ID
        ? createLocalSidecarGenerationConnection()
        : await connections.getWithKey(captionConnectionId);
    if (!captionConnection?.model) {
      logger.warn("[image-captioning] Captioning connection %s was not found", captionConnectionId);
      return DISABLED_IMAGE_CAPTIONING;
    }

    let captionProvider: BaseLLMProvider;
    if (captionConnectionId === LOCAL_SIDECAR_CONNECTION_ID) {
      captionProvider = getLocalSidecarProvider();
    } else {
      const captionBaseUrl = resolveBaseUrl(captionConnection);
      if (!captionBaseUrl) {
        logger.warn("[image-captioning] Captioning connection %s has no base URL", captionConnectionId);
        return DISABLED_IMAGE_CAPTIONING;
      }
      captionProvider = createLLMProvider(
        captionConnection.provider,
        captionBaseUrl,
        captionConnection.apiKey,
        captionConnection.maxContext,
        captionConnection.openrouterProvider,
        captionConnection.maxTokensOverride,
        captionConnection.claudeFastMode === "true",
        captionConnection.treatAsLocalEndpoint === "true",
        captionConnection.defaultParameters,
      );
    }

    const fallbackConnection = await connections.getFallbackForAgents();
    captionProvider = withConnectionFallbackProvider({
      primary: captionProvider,
      primaryConnectionId: captionConnectionId,
      fallbackConnection,
      fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
      category: "agents",
    });

    return {
      enabled: true,
      connectionId: captionConnectionId,
      connection: captionConnection,
      provider: captionProvider,
    };
  } catch (error) {
    logger.warn(error, "[image-captioning] Failed to resolve captioning connection; sending images normally");
    return DISABLED_IMAGE_CAPTIONING;
  }
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

function readCachedImageCaption(attachment: PromptAttachment, imageCaptioning: ImageCaptioningRuntime): string | null {
  const caption = normalizeImageCaptionText(attachment.imageCaption);
  if (!caption || !imageCaptioning.connection) return null;
  if (attachment.imageCaptionConnectionId !== imageCaptioning.connectionId) return null;
  if (attachment.imageCaptionModel !== imageCaptioning.connection.model) return null;
  if (attachment.imageCaptionProvider !== imageCaptioning.connection.provider) return null;
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
): Promise<string | null> {
  if (!imageCaptioning.provider || !imageCaptioning.connection) return null;
  try {
    const result = await imageCaptioning.provider.chatComplete(
      [
        {
          role: "system",
          content:
            "You describe image attachments for a downstream chat model that may not support vision. " +
            "Write a faithful, concise description of the visible content, including readable text, subjects, setting, style, and any details important for conversation continuity. " +
            "Do not answer the chat and do not add speculation beyond what is visible.",
        },
        {
          role: "user",
          content: `Describe this image attachment named "${filename}" for use inside a chat prompt. Return only the description.`,
          images: [imageDataUrl],
        },
      ],
      {
        model: imageCaptioning.connection.model,
        temperature: 0.2,
        maxTokens: applyProviderMaxTokensOverride(imageCaptioning.provider, IMAGE_CAPTION_MAX_TOKENS),
        enableCaching: imageCaptioning.connection.enableCaching === "true",
        anthropicExtendedCacheTtl: imageCaptioning.connection.anthropicExtendedCacheTtl === "true",
        cachingAtDepth: imageCaptioning.connection.cachingAtDepth ?? 5,
        stream: false,
        signal,
      },
    );
    return normalizeImageCaptionText(result.content);
  } catch (error) {
    if (signal.aborted) throw error;
    logger.warn(error, "[image-captioning] Failed to caption image attachment %s", filename);
    return null;
  }
}

export async function resolvePromptAttachmentInputs(args: {
  content: string;
  attachments: PromptAttachment[] | undefined;
  imageCaptioning: ImageCaptioningRuntime;
  signal: AbortSignal;
}): Promise<PromptAttachmentResolution> {
  const { attachments, imageCaptioning, signal } = args;
  const files = extractFileAttachmentInputs(attachments);
  let content = appendReadableAttachmentsToContent(args.content, attachments);

  if (!imageCaptioning.enabled || !imageCaptioning.provider || !imageCaptioning.connection) {
    return {
      content,
      images: extractImageAttachmentDataUrls(attachments),
      files,
      updatedAttachments: null,
    };
  }

  const captionBlocks: string[] = [];
  const fallbackImages: string[] = [];
  let updatedAttachments: PromptAttachment[] | null = null;
  const sourceAttachments = attachments ?? [];
  const captionConnection = imageCaptioning.connection;
  const resolvedImages = await Promise.all(
    sourceAttachments.map(async (attachment, index) => {
      const imageDataUrl = extractImageAttachmentDataUrls([attachment])[0];
      if (!imageDataUrl) return null;

      let caption = readCachedImageCaption(attachment, imageCaptioning);
      let updatedAttachment: PromptAttachment | null = null;
      if (!caption) {
        caption = await generateImageCaptionForDataUrl(
          getAttachmentFilename(attachment),
          imageDataUrl,
          imageCaptioning,
          signal,
        );
        if (caption) {
          updatedAttachment = {
            ...attachment,
            imageCaption: caption,
            imageCaptionConnectionId: imageCaptioning.connectionId,
            imageCaptionModel: captionConnection.model,
            imageCaptionProvider: captionConnection.provider,
            imageCaptionedAt: new Date().toISOString(),
          };
        }
      }

      return { index, attachment, imageDataUrl, caption, updatedAttachment };
    }),
  );

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
