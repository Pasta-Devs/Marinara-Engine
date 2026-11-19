import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { DATA_DIR } from "../../utils/data-dir.js";
import { resolveInside } from "../../utils/security.js";

const CHAT_GALLERY_ROOT = join(DATA_DIR, "gallery");

export function resolveGalleryImagePath(image: { chatId: string; filePath: string }): string | null {
  const normalizedPath = image.filePath.replace(/\\/g, "/");
  const filename = basename(normalizedPath);
  const candidates = new Set([normalizedPath, `${image.chatId}/${filename}`]);
  for (const candidate of candidates) {
    if (!candidate || candidate.includes("..") || candidate.includes("\0")) continue;
    try {
      const resolved = resolveInside(CHAT_GALLERY_ROOT, candidate);
      if (existsSync(resolved)) return resolved;
    } catch {
      // Try the legacy chat-relative path before treating the image as missing.
    }
  }
  return null;
}
