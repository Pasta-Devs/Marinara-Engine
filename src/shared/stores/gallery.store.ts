import { create } from "zustand";
import type { ChatImage } from "../types/gallery";

interface GalleryStore {
  pinnedImages: ChatImage[];
  illustratingChatIds: string[];
  pinImage: (image: ChatImage) => void;
  unpinImage: (imageId: string) => void;
  startIllustrating: (chatId: string) => boolean;
  finishIllustrating: (chatId: string) => void;
}

export const useGalleryStore = create<GalleryStore>((set) => ({
  pinnedImages: [],
  illustratingChatIds: [],
  pinImage: (image) =>
    set((state) => ({
      pinnedImages: state.pinnedImages.some((item) => item.id === image.id)
        ? state.pinnedImages
        : [...state.pinnedImages, image],
    })),
  unpinImage: (imageId) =>
    set((state) => ({
      pinnedImages: state.pinnedImages.filter((item) => item.id !== imageId),
    })),
  startIllustrating: (chatId) => {
    const id = chatId.trim();
    if (!id) return false;
    let started = false;
    set((state) => {
      if (state.illustratingChatIds.includes(id)) return state;
      started = true;
      return { illustratingChatIds: [...state.illustratingChatIds, id] };
    });
    return started;
  },
  finishIllustrating: (chatId) => {
    const id = chatId.trim();
    if (!id) return;
    set((state) => ({
      illustratingChatIds: state.illustratingChatIds.filter((item) => item !== id),
    }));
  },
}));
