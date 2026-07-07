// ──────────────────────────────────────────────
// Zustand Store: Pinned Gallery Media
// ──────────────────────────────────────────────
import { create } from "zustand";
import type { ChatImage } from "../hooks/use-gallery";
import type { GeneratedSceneVideo } from "@marinara-engine/shared";

const PINNED_GALLERY_IMAGES_STORAGE_KEY = "marinara-pinned-gallery-images";

export type PinnedGalleryImage = ChatImage & { kind: "image" };
export type PinnedGalleryVideo = GeneratedSceneVideo & { kind: "video" };
export type PinnedGalleryMedia = PinnedGalleryImage | PinnedGalleryVideo;

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

function isStoredSceneVideo(value: unknown): value is GeneratedSceneVideo {
  if (!value || typeof value !== "object") return false;
  const video = value as Partial<GeneratedSceneVideo>;
  return (
    typeof video.id === "string" &&
    typeof video.chatId === "string" &&
    typeof video.filePath === "string" &&
    typeof video.url === "string" &&
    typeof video.prompt === "string" &&
    typeof video.provider === "string" &&
    typeof video.model === "string" &&
    typeof video.durationSeconds === "number" &&
    (video.aspectRatio === "16:9" || video.aspectRatio === "9:16") &&
    typeof video.createdAt === "string"
  );
}

function normalizeStoredMedia(value: unknown): PinnedGalleryMedia | null {
  if (!value || typeof value !== "object") return null;
  const maybeMedia = value as Partial<PinnedGalleryMedia>;
  if (maybeMedia.kind === "video" && isStoredSceneVideo(value)) return { ...value, kind: "video" };
  if ((maybeMedia.kind === "image" || maybeMedia.kind === undefined) && isStoredChatImage(value)) {
    return { ...value, kind: "image" };
  }
  return null;
}

function loadPinnedImages(): PinnedGalleryMedia[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINNED_GALLERY_IMAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(normalizeStoredMedia).filter((item): item is PinnedGalleryMedia => !!item)
      : [];
  } catch {
    return [];
  }
}

function savePinnedImages(images: PinnedGalleryMedia[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PINNED_GALLERY_IMAGES_STORAGE_KEY, JSON.stringify(images));
  } catch {
    // Pinned images are a convenience overlay; storage failures should not break chat rendering.
  }
}

interface GalleryState {
  /** Images and videos pinned to the chat area as floating overlays. */
  pinnedImages: PinnedGalleryMedia[];
  /** One-shot media viewer shown on the chat surface without persisting as a pin. */
  viewerMedia: PinnedGalleryMedia | null;
  /** Chat whose latest gallery item should stay visible in the one-shot viewer. */
  latestViewerChatId: string | null;
  /** Chat IDs with an in-flight manual gallery illustration request. */
  illustratingChatIds: Set<string>;
  /** Chat IDs with an in-flight manual selfie generation request. */
  selfieGeneratingChatIds: Set<string>;
  /** Chat IDs with an in-flight manual scene video request. */
  videoGeneratingChatIds: Set<string>;
  /** Chat IDs with an in-flight manual scene background request. */
  backgroundGeneratingChatIds: Set<string>;
  /** Chat IDs with an in-flight manual game storyboard request. */
  storyboardGeneratingChatIds: Set<string>;
  pinImage: (image: ChatImage) => void;
  pinVideo: (video: GeneratedSceneVideo) => void;
  viewImage: (image: ChatImage) => void;
  viewVideo: (video: GeneratedSceneVideo) => void;
  startLatestViewer: (chatId: string, media: PinnedGalleryMedia | null) => void;
  syncLatestViewer: (media: PinnedGalleryMedia) => void;
  clearViewerMedia: () => void;
  unpinImage: (mediaId: string) => void;
  clearPinned: () => void;
  setChatIllustrating: (chatId: string, illustrating: boolean) => void;
  setChatGeneratingSelfie: (chatId: string, generating: boolean) => void;
  setChatGeneratingVideo: (chatId: string, generating: boolean) => void;
  setChatGeneratingBackground: (chatId: string, generating: boolean) => void;
  setChatGeneratingStoryboard: (chatId: string, generating: boolean) => void;
}

export const useGalleryStore = create<GalleryState>((set) => ({
  pinnedImages: loadPinnedImages(),
  viewerMedia: null,
  latestViewerChatId: null,
  illustratingChatIds: new Set(),
  selfieGeneratingChatIds: new Set(),
  videoGeneratingChatIds: new Set(),
  backgroundGeneratingChatIds: new Set(),
  storyboardGeneratingChatIds: new Set(),

  pinImage: (image) =>
    set((s) => {
      if (s.pinnedImages.some((p) => p.id === image.id)) return s;
      const pinnedImages = [...s.pinnedImages, { ...image, kind: "image" as const }];
      savePinnedImages(pinnedImages);
      return { pinnedImages };
    }),

  pinVideo: (video) =>
    set((s) => {
      if (s.pinnedImages.some((p) => p.id === video.id)) return s;
      const pinnedImages = [...s.pinnedImages, { ...video, kind: "video" as const }];
      savePinnedImages(pinnedImages);
      return { pinnedImages };
    }),

  viewImage: (image) => set({ viewerMedia: { ...image, kind: "image" as const }, latestViewerChatId: null }),

  viewVideo: (video) => set({ viewerMedia: { ...video, kind: "video" as const }, latestViewerChatId: null }),

  startLatestViewer: (chatId, media) => set({ latestViewerChatId: chatId, viewerMedia: media }),

  syncLatestViewer: (media) =>
    set((s) => {
      if (s.latestViewerChatId !== media.chatId) return s;
      return { viewerMedia: media };
    }),

  clearViewerMedia: () => set({ viewerMedia: null, latestViewerChatId: null }),

  unpinImage: (mediaId) =>
    set((s) => {
      const pinnedImages = s.pinnedImages.filter((p) => p.id !== mediaId);
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

  setChatGeneratingSelfie: (chatId, generating) =>
    set((s) => {
      const next = new Set(s.selfieGeneratingChatIds);
      if (generating) next.add(chatId);
      else next.delete(chatId);
      return { selfieGeneratingChatIds: next };
    }),

  setChatGeneratingVideo: (chatId, generating) =>
    set((s) => {
      const next = new Set(s.videoGeneratingChatIds);
      if (generating) next.add(chatId);
      else next.delete(chatId);
      return { videoGeneratingChatIds: next };
    }),

  setChatGeneratingBackground: (chatId, generating) =>
    set((s) => {
      const next = new Set(s.backgroundGeneratingChatIds);
      if (generating) next.add(chatId);
      else next.delete(chatId);
      return { backgroundGeneratingChatIds: next };
    }),

  setChatGeneratingStoryboard: (chatId, generating) =>
    set((s) => {
      const next = new Set(s.storyboardGeneratingChatIds);
      if (generating) next.add(chatId);
      else next.delete(chatId);
      return { storyboardGeneratingChatIds: next };
    }),
}));
