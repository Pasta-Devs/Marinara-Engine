// #9387: the roleplay image lightbox for pictures in Professor Mari's replies. Her generated images are preview
// assets (a manifest entry, no chat gallery row), so this reads the saved request from the Mari image routes and
// hands ChatImageLightbox a regenerator built on them. Any other picture in her reply opens full size with download.
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ChatImageGenerationRecord } from "@marinara-engine/shared";
import { api } from "../../../lib/api-client";
import { MessageImageOpenContext } from "../../../lib/remote-image-placeholder";
import { chatKeys } from "../../../hooks/use-chats";
import type { ChatImage } from "../../../hooks/use-gallery";
import { ChatImageLightbox } from "../ChatImageLightbox";
import type { ImageRegenerator } from "../ImageRegeneratePanel";
import type { ImagePromptDraft } from "../../../hooks/use-regenerate-chat-image";

/** The manifest record the server keeps for one of her images (`MariImageAsset` in mari-images.service.ts). */
export interface MariImageAsset {
  id: string;
  filePath: string;
  url: string;
  operation: "generate" | "edit";
  prompt: string;
  negativePrompt: string;
  styleMode?: "none" | "profile";
  styleProfileName?: string | null;
  width: number | null;
  height: number | null;
  connectionId: string;
  provider: string;
  /** The image service that drew it (novelai, comfyui...); `provider` is the connection type. */
  source?: string;
  model: string;
  createdAt: string;
}

/** One of her replies a regenerate rewrote: its new content and the extra keys the server changed. */
export interface MariReplacedMessage {
  id: string;
  content: string;
  extra: Record<string, unknown>;
}

interface MariImageRecord {
  asset: MariImageAsset;
  regenerable: boolean;
}

const MARI_IMAGE_PATH = /^\/api\/gallery\/file\/mari-images\/mari-([^/.]+)\.[A-Za-z0-9]+$/;

/** The preview asset id a picture URL names, or null for any other picture. */
export function mariImageAssetId(src: string): string | null {
  try {
    const match = MARI_IMAGE_PATH.exec(new URL(src, "http://mari.local").pathname);
    return match ? decodeURIComponent(match[1]!) : null;
  } catch {
    // An unparsable url or a malformed escape: a plain picture.
    return null;
  }
}

/** The record as the lightbox's `ChatImage`, with a generation record so it never looks for a gallery row. */
export function mariAssetToChatImage(asset: MariImageAsset): ChatImage {
  const generation: ChatImageGenerationRecord = {
    version: 1,
    prompt: asset.prompt,
    connectionId: asset.connectionId || null,
    negativePrompt: asset.negativePrompt ?? "",
    characterPrompts: [],
    references: { characterIds: [], personaId: null, personaSource: null, locationImageId: null },
  };
  return {
    id: asset.id,
    chatId: "mari-images",
    filePath: asset.filePath,
    prompt: asset.prompt,
    provider: asset.source || asset.provider,
    model: asset.model,
    width: asset.width,
    height: asset.height,
    generation: JSON.stringify(generation),
    createdAt: asset.createdAt,
    url: asset.url,
  };
}

function plainImage(src: string): ChatImage {
  return {
    id: src,
    chatId: "",
    filePath: "",
    prompt: "",
    provider: "",
    model: "",
    width: null,
    height: null,
    createdAt: "",
    url: src,
  };
}

const assetPath = (assetId: string) => `/gallery/mari-images/assets/${encodeURIComponent(assetId)}`;

function MariImageLightbox({
  src,
  alt,
  chatId,
  messageId,
  onImageReplaced,
  onClose,
}: {
  src: string;
  alt: string;
  chatId: string;
  messageId: string;
  onImageReplaced?: (message: MariReplacedMessage) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const assetId = mariImageAssetId(src);
  // A pruned or unknown asset (the manifest keeps the newest 200) opens without the prompt panel.
  const record = useQuery({
    queryKey: ["mari-image-asset", assetId],
    queryFn: () => api.get<MariImageRecord>(assetPath(assetId!)),
    enabled: !!assetId,
    retry: false,
    staleTime: 60_000,
  });
  const [regenerated, setRegenerated] = useState(false);

  const regenerator = useMemo<ImageRegenerator>(
    () => ({
      defaultConnectionLabel: t("ui.chat.mariimagelightbox.sameConnection"),
      // Her pictures have no chat gallery: the old one stays in her image list.
      regeneratedMessage: t("ui.chat.mariimagelightbox.regenerated"),
      regenerate: async ({ imageId, prompt, negativePrompt, connectionId, messageId: replyId, debugMode }) => {
        const result = await api.post<MariImageRecord & { replacedMessages: MariReplacedMessage[] }>(
          `${assetPath(imageId)}/regenerate`,
          { prompt, negativePrompt, connectionId, debugMode, chatId, ...(replyId ? { messageId: replyId } : {}) },
        );
        qc.setQueryData(["mari-image-asset", result.asset.id], {
          asset: result.asset,
          regenerable: result.regenerable,
        });
        if (result.replacedMessages.length > 0) {
          // Her window keeps its transcript in its own state; the chat query serves any other view of it.
          for (const message of result.replacedMessages) onImageReplaced?.(message);
          void qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        }
        // The new prompt was sent as written, so no style profile shaped it.
        setRegenerated(true);
        return mariAssetToChatImage(result.asset);
      },
      revise: ({ imageId, ...draft }) =>
        api.post<ImagePromptDraft>(`${assetPath(imageId)}/regenerate/prompt`, { ...draft, chatId }),
    }),
    [chatId, onImageReplaced, qc, t],
  );

  if (assetId && record.isPending) return null;
  const loaded = record.data;
  const profile = !regenerated && loaded?.asset.styleMode === "profile" ? loaded.asset.styleProfileName : null;
  return (
    <ChatImageLightbox
      key={loaded?.asset.id ?? src}
      image={loaded ? mariAssetToChatImage(loaded.asset) : plainImage(src)}
      alt={alt}
      pinEnabled={false}
      overMari
      regenerate={loaded?.regenerable ? { messageId } : undefined}
      regenerator={loaded ? regenerator : undefined}
      extraMeta={profile ? t("ui.chat.mariimagelightbox.styleProfile", { name: profile }) : undefined}
      onClose={onClose}
    />
  );
}

/** Makes the pictures in one of Mari's replies open the lightbox. */
export function MariImageOpener({
  chatId,
  messageId,
  onImageReplaced,
  children,
}: {
  chatId: string;
  messageId: string;
  onImageReplaced?: (message: MariReplacedMessage) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<{ src: string; alt: string } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onOpen = useCallback(({ trigger, ...image }: { src: string; alt: string; trigger: HTMLElement }) => {
    triggerRef.current = trigger;
    setOpen(image);
  }, []);
  // Back to the picture that opened it: with focus left on the page, her window takes the next Escape as "go back".
  const onClose = useCallback(() => {
    setOpen(null);
    requestAnimationFrame(() => {
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    });
  }, []);
  return (
    <MessageImageOpenContext.Provider value={onOpen}>
      {children}
      {open && (
        <MariImageLightbox
          src={open.src}
          alt={open.alt}
          chatId={chatId}
          messageId={messageId}
          onImageReplaced={onImageReplaced}
          onClose={onClose}
        />
      )}
    </MessageImageOpenContext.Provider>
  );
}
