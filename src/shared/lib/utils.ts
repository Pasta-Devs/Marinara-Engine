import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CSSProperties } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generate a unique ID, with fallback for insecure contexts (non-HTTPS). */
export function generateClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Copy text to clipboard with fallback for insecure contexts (HTTP / Tailscale). */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea fallback.
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Avatar crop — current format. A rectangular region of the source image,
 *  expressed in coordinates normalized to the source's intrinsic dimensions. The
 *  editor enforces a square crop in source pixels (`srcWidth * sourceW ===
 *  srcHeight * sourceH`); the data shape itself is generic enough to allow
 *  freeform rectangles in the future without a migration. */
export interface AvatarCrop {
  /** Crop top-left X, normalized to source width. Range [0, 1 - srcWidth]. */
  srcX: number;
  /** Crop top-left Y, normalized to source height. Range [0, 1 - srcHeight]. */
  srcY: number;
  /** Crop width, normalized to source width. Range (0, 1]. */
  srcWidth: number;
  /** Crop height, normalized to source height. Range (0, 1]. */
  srcHeight: number;
}

/** Avatar crop -- legacy zoom/offset format used by older persona rows. */
export interface LegacyAvatarCrop {
  zoom: number;
  offsetX: number;
  offsetY: number;
  /** Legacy full-image mode rendered the portrait contained instead of covered. */
  fullImage?: boolean;
}

export type AvatarCropValue = AvatarCrop | LegacyAvatarCrop;

export function isLegacyAvatarCrop(crop: AvatarCropValue): crop is LegacyAvatarCrop {
  return "zoom" in crop;
}

/** Parses a JSON-encoded avatarCrop string (as stored on persona rows and as
 *  emitted from extensions on character rows when serialized) with defensive
 *  shape validation. Malformed data returns null and the caller falls back to
 *  the uncropped render. */
export function parseAvatarCropJson(raw: string | undefined | null): AvatarCropValue | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    if (
      Number.isFinite(obj.srcX) &&
      Number.isFinite(obj.srcY) &&
      Number.isFinite(obj.srcWidth) &&
      Number.isFinite(obj.srcHeight) &&
      obj.srcWidth > 0 &&
      obj.srcHeight > 0 &&
      obj.srcX >= 0 &&
      obj.srcY >= 0 &&
      obj.srcX + obj.srcWidth <= 1.001 &&
      obj.srcY + obj.srcHeight <= 1.001
    ) {
      return {
        srcX: obj.srcX,
        srcY: obj.srcY,
        srcWidth: obj.srcWidth,
        srcHeight: obj.srcHeight,
      };
    }
    if (
      Number.isFinite(obj.zoom) &&
      Number.isFinite(obj.offsetX) &&
      Number.isFinite(obj.offsetY) &&
      obj.zoom > 0 &&
      (obj.fullImage === undefined || typeof obj.fullImage === "boolean")
    ) {
      return {
        zoom: obj.zoom,
        offsetX: obj.offsetX,
        offsetY: obj.offsetY,
        ...(obj.fullImage ? { fullImage: true } : {}),
      };
    }
  } catch {
    /* fall through to null */
  }
  return null;
}

/** Returns inline styles for a cropped avatar image. Container must have
 *  `overflow: hidden`; for current-format crops it must also have
 *  `position: relative` (the `<img>` is rendered absolutely-positioned and sized
 *  larger than the container so it can be panned to expose any source region).
 *
 *  Two modes:
 *  - No crop: returns `{}` so the consumer's `<img>` (typically with
 *    `object-cover` Tailwind class) renders exactly as before.
 *  - Crop: positions the `<img>` so the crop rectangle maps onto the
 *    container's full area. Works for any source aspect ratio without distorting
 *    the image, because a square-in-source-pixels crop makes the `<img>` element
 *    box take the source's aspect ratio, and `object-fit: fill` then fills that
 *    box undistorted. */
export function getAvatarCropStyle(crop?: AvatarCropValue | null): CSSProperties {
  if (!crop) return {};

  if (isLegacyAvatarCrop(crop)) {
    const isIdentityCrop = crop.zoom === 1 && crop.offsetX === 0 && crop.offsetY === 0;
    const transform = `scale(${crop.zoom}) translate(${crop.offsetX}px, ${crop.offsetY}px)`;

    if (crop.fullImage) {
      return {
        objectFit: "contain",
        ...(isIdentityCrop ? {} : { transform }),
      };
    }
    if (isIdentityCrop) return {};
    return {
      transform,
    };
  }

  const { srcX, srcY, srcWidth, srcHeight } = crop;
  if (srcWidth <= 0 || srcHeight <= 0) return {};
  return {
    position: "absolute",
    width: `${100 / srcWidth}%`,
    height: `${100 / srcHeight}%`,
    left: `${(-srcX / srcWidth) * 100}%`,
    top: `${(-srcY / srcHeight) * 100}%`,
    maxWidth: "none",
    maxHeight: "none",
    objectFit: "fill",
  };
}
