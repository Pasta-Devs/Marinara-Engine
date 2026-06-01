import { forwardRef, useEffect, useMemo, useState, type CSSProperties } from "react";
import { avatarFileUrlFromPath, resolveAvatarFileUrl } from "../../../../../shared/api/local-file-api";

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

export const ResolvedAvatarImage = forwardRef<
  HTMLImageElement,
  {
    src?: string | null;
    avatarFilePath?: string | null;
    avatarFilename?: string | null;
    alt: string;
    loading?: "eager" | "lazy";
    decoding?: "sync" | "async" | "auto";
    draggable?: boolean;
    "aria-hidden"?: boolean | "true" | "false";
    className?: string;
    style?: CSSProperties;
    onResolvedSrc?: (src: string | null) => void;
  }
>(function ResolvedAvatarImage(
  {
    src,
    avatarFilePath,
    avatarFilename,
    alt,
    loading = "lazy",
    decoding = "async",
    draggable,
    "aria-hidden": ariaHidden,
    className,
    style,
    onResolvedSrc,
  },
  ref,
) {
  const hasManagedAvatar = hasText(avatarFilename) || hasText(avatarFilePath);
  const fallbackSrc = useMemo(() => {
    if (!src) return null;
    return hasManagedAvatar && isLikelyFilesystemPath(src) ? null : src;
  }, [hasManagedAvatar, src]);
  const immediateSrc = useMemo(() => {
    if (!hasManagedAvatar) return fallbackSrc;
    const syncUrl = avatarFileUrlFromPath(avatarFilename, avatarFilePath);
    if (!syncUrl || isLikelyFilesystemPath(syncUrl)) return fallbackSrc;
    return syncUrl;
  }, [avatarFilePath, avatarFilename, fallbackSrc, hasManagedAvatar]);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(immediateSrc);

  useEffect(() => {
    let cancelled = false;
    if (!hasManagedAvatar) {
      setResolvedSrc(fallbackSrc);
      onResolvedSrc?.(fallbackSrc);
      return () => {
        cancelled = true;
      };
    }

    setResolvedSrc(immediateSrc);
    if (immediateSrc) onResolvedSrc?.(immediateSrc);
    resolveAvatarFileUrl(avatarFilename, avatarFilePath)
      .then((url) => {
        if (cancelled) return;
        const next = url ?? fallbackSrc;
        setResolvedSrc(next);
        onResolvedSrc?.(next);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedSrc(fallbackSrc);
        onResolvedSrc?.(fallbackSrc);
      });

    return () => {
      cancelled = true;
    };
  }, [avatarFilePath, avatarFilename, fallbackSrc, hasManagedAvatar, immediateSrc, onResolvedSrc]);

  const imageSrc = resolvedSrc ?? immediateSrc;
  if (!imageSrc) return null;

  return (
    <img
      ref={ref}
      src={imageSrc}
      alt={alt}
      loading={loading}
      decoding={decoding}
      draggable={draggable}
      aria-hidden={ariaHidden}
      className={className}
      style={style}
    />
  );
});
