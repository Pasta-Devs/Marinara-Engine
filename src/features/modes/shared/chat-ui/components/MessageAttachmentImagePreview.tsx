import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import type { MessageAttachment } from "../../../../../engine/contracts/types/chat";
import { resolveGalleryFileUrl } from "../../../../../shared/api/local-file-api";
import { messageAttachmentImageAlt, messageAttachmentImageSource } from "../lib/message-attachments";

const RESOLVED_ATTACHMENT_SRC_CACHE_LIMIT = 128;
const resolvedAttachmentSrcCache = new Map<string, string>();

function readCachedResolvedAttachmentSrc(key: string): string | null {
  return resolvedAttachmentSrcCache.get(key) ?? null;
}

function rememberResolvedAttachmentSrc(key: string, src: string | null): void {
  resolvedAttachmentSrcCache.delete(key);
  if (!src) return;
  resolvedAttachmentSrcCache.set(key, src);
  while (resolvedAttachmentSrcCache.size > RESOLVED_ATTACHMENT_SRC_CACHE_LIMIT) {
    const oldestKey = resolvedAttachmentSrcCache.keys().next().value;
    if (!oldestKey) break;
    resolvedAttachmentSrcCache.delete(oldestKey);
  }
}

function hasText(value: string | null | undefined): boolean {
  return !!value?.trim();
}

function isLikelyFilesystemPath(value: string): boolean {
  const normalized = value.replace(/\\/g, "/");
  return (
    /^[a-z]:\//i.test(normalized) ||
    normalized.startsWith("//") ||
    /^\/(Users|home|var|data|tmp|opt|private)\//i.test(normalized)
  );
}

function useResolvedMessageAttachmentImageSource(attachment: MessageAttachment): string | null {
  const directSrc = messageAttachmentImageSource(attachment);
  const filename = attachment.filename ?? attachment.name ?? null;
  const filePath = attachment.filePath ?? null;
  const hasManagedGallery = hasText(filename) || hasText(filePath);
  const fallbackSrc = useMemo(() => {
    if (!directSrc) return null;
    return hasManagedGallery && isLikelyFilesystemPath(directSrc) ? null : directSrc;
  }, [directSrc, hasManagedGallery]);
  const resolutionKey = JSON.stringify([directSrc ?? "", filename ?? "", filePath ?? ""]);
  const cachedResolvedSrc = hasManagedGallery ? readCachedResolvedAttachmentSrc(resolutionKey) : null;
  const [resolvedState, setResolvedState] = useState<{ key: string; src: string | null }>({
    key: resolutionKey,
    src: cachedResolvedSrc ?? fallbackSrc,
  });

  useEffect(() => {
    let cancelled = false;
    if (!hasManagedGallery) {
      setResolvedState({ key: resolutionKey, src: fallbackSrc });
      return () => {
        cancelled = true;
      };
    }

    const cachedSrc = readCachedResolvedAttachmentSrc(resolutionKey);
    const nextInitialSrc = cachedSrc ?? fallbackSrc;
    setResolvedState({ key: resolutionKey, src: nextInitialSrc });
    if (cachedSrc) {
      return () => {
        cancelled = true;
      };
    }

    resolveGalleryFileUrl(filename, filePath)
      .then((url) => {
        if (cancelled) return;
        const next = url ?? fallbackSrc;
        rememberResolvedAttachmentSrc(resolutionKey, next);
        setResolvedState({ key: resolutionKey, src: next });
      })
      .catch(() => {
        if (cancelled) return;
        rememberResolvedAttachmentSrc(resolutionKey, null);
        setResolvedState({ key: resolutionKey, src: fallbackSrc });
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackSrc, filePath, filename, hasManagedGallery, resolutionKey]);

  return resolvedState.key === resolutionKey ? (resolvedState.src ?? cachedResolvedSrc ?? fallbackSrc) : cachedResolvedSrc;
}

export function MessageAttachmentImagePreview({
  attachment,
  className,
  buttonClassName,
  imageClassName,
  title = "Open image",
  ariaLabel,
  loading = "lazy",
  decoding = "async",
  onOpen,
  children,
}: {
  attachment: MessageAttachment;
  className?: string;
  buttonClassName?: string;
  imageClassName?: string;
  title?: string;
  ariaLabel?: string;
  loading?: "eager" | "lazy";
  decoding?: "sync" | "async" | "auto";
  onOpen: (src: string, event: MouseEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
}) {
  const imageSrc = useResolvedMessageAttachmentImageSource(attachment);
  if (!imageSrc) return null;
  const alt = messageAttachmentImageAlt(attachment);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={(event) => onOpen(imageSrc, event)}
        className={buttonClassName}
        title={title}
        aria-label={ariaLabel ?? `Open ${alt}`}
      >
        <img src={imageSrc} alt={alt} className={imageClassName} loading={loading} decoding={decoding} />
      </button>
      {children}
    </div>
  );
}
