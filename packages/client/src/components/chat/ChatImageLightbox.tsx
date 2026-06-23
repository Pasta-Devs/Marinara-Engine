import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, Pin, X } from "lucide-react";
import type { ChatImage } from "../../hooks/use-gallery";
import { useGalleryStore } from "../../stores/gallery.store";
import { ImagePromptPanel } from "./ImagePromptPanel";

export function formatChatImageMeta(image: Pick<ChatImage, "model" | "provider" | "width" | "height">) {
  const details: string[] = [];
  if (image.model) details.push(image.model);
  if (image.provider) details.push(image.provider.replace(/_/g, " "));
  if (image.width && image.height) details.push(`${image.width} x ${image.height}`);
  return details.join(" | ");
}

export function getChatImageDownloadName(image: Pick<ChatImage, "filePath" | "url" | "id">) {
  const fromPath = image.filePath.split(/[\\/]/).pop();
  if (fromPath) return fromPath;
  const fromUrl = image.url.split("?")[0]?.split("/").pop();
  return fromUrl || `gallery-${image.id}.png`;
}

interface ChatImageLightboxProps {
  image: ChatImage;
  alt?: string;
  pinEnabled?: boolean;
  downloadEnabled?: boolean;
  onPin?: (image: ChatImage) => void;
  onClose: () => void;
}

export function ChatImageLightbox({
  image,
  alt,
  pinEnabled = true,
  downloadEnabled = true,
  onPin,
  onClose,
}: ChatImageLightboxProps) {
  const pinImage = useGalleryStore((s) => s.pinImage);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const portalRoot = typeof document !== "undefined" ? document.body : null;
  const prompt = image.prompt.trim();
  const meta = formatChatImageMeta(image);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  if (!portalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 max-md:pt-[env(safe-area-inset-top)]"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      tabIndex={-1}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="flex max-h-[90vh] w-[min(90vw,64rem)] max-w-[90vw] flex-col items-center gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex min-h-0 max-w-full justify-center">
          <img
            src={image.url}
            alt={alt || image.prompt || "Gallery image"}
            decoding="async"
            className={
              prompt || meta
                ? "max-h-[calc(90vh-10rem)] max-w-full rounded-lg object-contain shadow-2xl"
                : "max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
            }
          />
          <div className="absolute right-2 top-2 flex gap-2">
            {pinEnabled && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (onPin) onPin(image);
                  else pinImage(image);
                  onClose();
                }}
                aria-label="Pin image to chat"
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                title="Pin to chat"
              >
                <Pin size="0.875rem" />
              </button>
            )}
            {downloadEnabled && (
              <a
                href={image.url}
                download={getChatImageDownloadName(image)}
                aria-label="Download image"
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
              >
                <Download size="0.875rem" />
              </a>
            )}
            <button
              type="button"
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close image"
              className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
            >
              <X size="0.875rem" />
            </button>
          </div>
        </div>
        <ImagePromptPanel prompt={prompt} meta={meta} className="w-full max-w-3xl" />
      </div>
    </div>,
    portalRoot,
  );
}
