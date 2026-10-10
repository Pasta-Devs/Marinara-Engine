import { useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { getValidatedCommandCenterAccent } from "./command-center-visuals";

export type CommandCenterMediaSize = "row" | "preview" | "grid";
export type CommandCenterMediaRole = "row" | "preview" | "browse";
export type CommandCenterMediaKind = "image" | "thumbnail" | "avatar" | "artwork";

export interface CommandCenterMediaProps {
  size: CommandCenterMediaSize;
  role?: CommandCenterMediaRole;
  icon: LucideIcon;
  src?: string | null;
  alt?: string;
  kind?: CommandCenterMediaKind;
  avatarCropStyle?: CSSProperties;
  groupClassName?: string;
  accent?: string | null;
  className?: string;
}

const iconClasses: Record<CommandCenterMediaSize, string> = {
  row: "size-4",
  preview: "size-6",
  grid: "size-8",
};

const roleClasses: Record<CommandCenterMediaRole, string> = {
  row: "size-9",
  preview: "size-24 sm:size-28",
  browse: "size-24",
};

function resolveMediaSrc(src: string | null | undefined, kind: CommandCenterMediaKind): string | undefined {
  if (!src) return undefined;
  if (kind !== "avatar") return src;

  const trimmed = src.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/api/") || /^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;

  // Older Windows imports can retain a local path. Serve its filename through
  // the app endpoint instead of letting the browser resolve it as file://.
  if (/^(file:)?[a-z]:[\\/]/i.test(trimmed) || trimmed.toLowerCase().startsWith("file://")) {
    const filename = trimmed.split(/[\\/]/u).filter(Boolean).pop();
    return filename ? `/api/avatars/file/${encodeURIComponent(filename)}` : undefined;
  }

  return trimmed;
}

export function CommandCenterMedia({
  size,
  role = size === "grid" ? "browse" : size,
  icon: Icon,
  src,
  alt = "",
  kind = "image",
  avatarCropStyle,
  groupClassName,
  accent,
  className,
}: CommandCenterMediaProps) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const resolvedSrc = resolveMediaSrc(src, kind);
  const hasImage = Boolean(resolvedSrc && resolvedSrc !== failedSrc);
  const validAccent = getValidatedCommandCenterAccent(accent);

  return (
    <span
      aria-hidden={role === "row" ? true : undefined}
      data-command-center-media={role}
      data-media-kind={kind}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--mari-panel-gradient-start,var(--border))_24%,var(--border))] bg-[color-mix(in_srgb,var(--mari-panel-gradient-start,var(--muted))_8%,var(--muted))] text-[color-mix(in_srgb,var(--mari-panel-gradient-start,var(--muted-foreground))_30%,var(--foreground))]",
        role === "preview" ? roleClasses.preview : role === "browse" ? roleClasses.browse : "size-9",
        kind === "avatar" && "rounded-full",
        role === "browse" && kind === "avatar" && "aspect-square h-auto w-full",
        role === "preview" && kind !== "avatar" && kind !== "artwork" && "aspect-[4/5] h-auto w-24 sm:w-28",
        role === "preview" && kind === "artwork" && "aspect-video h-auto w-32 sm:w-40",
        groupClassName,
        className,
      )}
    >
      {hasImage ? (
        <img
          key={resolvedSrc}
          // A cached image can complete before React attaches onLoad, which used
          // to leave it stuck at opacity-0. Read the state on mount instead.
          // The inline callback is a new function every render, so React
          // reattaches the ref on every commit; without the equality guard a
          // cached image would set state on each reattach and never settle.
          ref={(node) => {
            if (node?.complete && node.naturalWidth > 0 && loadedSrc !== resolvedSrc) setLoadedSrc(resolvedSrc);
          }}
          src={resolvedSrc}
          alt={role === "row" ? "" : alt}
          // Only the open preview is above the fold for sure; a long row list (40 "Add X" rows) loads as it scrolls.
          loading={size === "preview" ? "eager" : "lazy"}
          decoding={size === "preview" ? "auto" : "async"}
          onLoad={() => setLoadedSrc(resolvedSrc)}
          onError={() => setFailedSrc(resolvedSrc)}
          style={kind === "avatar" ? avatarCropStyle : undefined}
          className={cn(
            "size-full object-cover transition-opacity duration-200 motion-reduce:transition-none",
            loadedSrc === resolvedSrc ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <Icon className={iconClasses[size]} strokeWidth={1.8} />
      )}
      {hasImage && loadedSrc !== resolvedSrc && !failedSrc ? (
        <span className="absolute inset-0 animate-pulse bg-[color-mix(in_srgb,var(--foreground)_5%,var(--background))] motion-reduce:animate-none" />
      ) : null}
      {validAccent ? (
        <span
          className="absolute bottom-1 right-1 size-2.5 rounded-full border border-[var(--card)]"
          style={{ backgroundColor: validAccent }}
        />
      ) : null}
    </span>
  );
}
