// ──────────────────────────────────────────────
// Zustand Store: Pinned Gallery Images
// ──────────────────────────────────────────────
import { create } from "zustand";
import type { ChatImage } from "../hooks/use-gallery";

const PINNED_GALLERY_IMAGES_STORAGE_KEY = "marinara-pinned-gallery-images";

function isStoredChatImage(value: unknown): value is ChatImage {
  if (!value || typeof value !== "object") return false;
  const image = value as Partial<ChatImage>;
  return (
    typeof image.id === "string" &&
    typeof image.chatId === "string" &&
    typeof image.filePath === "string" &&
    typeof image.prompt === "string" &&
    typeof image.provider === "string" &&
    typeof image.model === "string" &&
    typeof image.createdAt === "string" &&
    typeof image.url === "string" &&
    (typeof image.width === "number" || image.width === null) &&
    (typeof image.height === "number" || image.height === null)
  );
}

function loadPinnedImages(): ChatImage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINNED_GALLERY_IMAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredChatImage) : [];
  } catch {
    return [];
  }
}

function savePinnedImages(images: ChatImage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PINNED_GALLERY_IMAGES_STORAGE_KEY, JSON.stringify(images));
  } catch {
    // Pinned images are a convenience overlay; storage failures should not break chat rendering.
  }
}

interface GalleryState {
  /** Images pinned to the chat area as floating overlays */
  pinnedImages: ChatImage[];
  /** Chat IDs with an in-flight manual gallery illustration request. */
  illustratingChatIds: Set<string>;
  pinImage: (image: ChatImage) => void;
  unpinImage: (imageId: string) => void;
  clearPinned: () => void;
  setChatIllustrating: (chatId: string, illustrating: boolean) => void;
}

export const useGalleryStore = create<GalleryState>((set) => ({
  pinnedImages: loadPinnedImages(),
  illustratingChatIds: new Set(),

  pinImage: (image) =>
    set((s) => {
      if (s.pinnedImages.some((p) => p.id === image.id)) return s;
      const pinnedImages = [...s.pinnedImages, image];
      savePinnedImages(pinnedImages);
      return { pinnedImages };
    }),

  unpinImage: (imageId) =>
    set((s) => {
      const pinnedImages = s.pinnedImages.filter((p) => p.id !== imageId);
      savePinnedImages(pinnedImages);
      return { pinnedImages };
    }),

  clearPinned: () => {
    savePinnedImages([]);
    set({ pinnedImages: [] });
  },

  setChatIllustrating: (chatId, illustrating) =>
    set((s) => {
      const next = new Set(s.illustratingChatIds);
      if (illustrating) next.add(chatId);
      else next.delete(chatId);
      return { illustratingChatIds: next };
    }),
}));
