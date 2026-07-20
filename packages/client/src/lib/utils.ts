import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CSSProperties } from "react";
import type { LegacyPersonaAvatarCrop, PersonaAvatarCrop } from "@marinara-engine/shared";

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
      // Fall through to legacy approach
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

/** Client-facing name for the shared current avatar crop contract. */
export type AvatarCrop = PersonaAvatarCrop;

/** Client-facing name for the shared legacy avatar crop contract. */
export type LegacyAvatarCrop = LegacyPersonaAvatarCrop;

/** Union alias for either crop shape — handy when threading a value through
 *  type-narrow interfaces that just need "a crop, either format". */
export type AvatarCropValue = AvatarCrop | LegacyAvatarCrop;

/** Discriminator: legacy crops have `zoom`, current crops have `srcWidth`. */
export function isLegacyAvatarCrop(c: AvatarCrop | LegacyAvatarCrop): c is LegacyAvatarCrop {
  return typeof (c as LegacyAvatarCrop).zoom === "number" && typeof (c as AvatarCrop).srcWidth !== "number";
}

/** Parses a JSON-encoded avatarCrop string (as stored on persona rows and as
 *  emitted from extensions on character rows when serialized) with defensive
 *  shape validation. Accepts either the current source-relative shape
 *  (srcX/Y/W/H) or the legacy zoom+offset shape, so a malformed cell never
 *  breaks rendering — returns null and the caller falls back to the uncropped
 *  render. */
export function parseAvatarCropJson(raw: string | undefined | null): AvatarCrop | LegacyAvatarCrop | null {
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
    if (Number.isFinite(obj.zoom) && Number.isFinite(obj.offsetX) && Number.isFinite(obj.offsetY) && obj.zoom > 0) {
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
 *  Three modes:
 *  - No crop: returns `{}` so the consumer's `<img>` (typically with
 *    `object-cover` Tailwind class) renders exactly as before.
 *  - Legacy crop: returns the historical CSS transform — preserves the old visual
 *    so already-shipped data isn't disturbed by the data-model change.
 *  - Current crop: positions the `<img>` so the crop rectangle maps onto the
 *    container's full area. Works for any source aspect ratio without distorting
 *    the image, because a square-in-source-pixels crop makes the `<img>` element
 *    box take the source's aspect ratio, and `object-fit: fill` then fills that
 *    box undistorted. */
export function getAvatarCropStyle(crop?: AvatarCrop | LegacyAvatarCrop | null): CSSProperties {
  if (!crop) return {};

  if (isLegacyAvatarCrop(crop)) {
    if (crop.fullImage) {
      return {
        objectFit: "contain",
        transform: `scale(${crop.zoom}) translate(${crop.offsetX}%, ${crop.offsetY}%)`,
      };
    }
    if (crop.zoom <= 1) return {};
    return {
      transform: `scale(${crop.zoom}) translate(${crop.offsetX}%, ${crop.offsetY}%)`,
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
