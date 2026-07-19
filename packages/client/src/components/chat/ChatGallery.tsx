// ──────────────────────────────────────────────
// Chat Gallery — Image grid for per-chat generated images
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  Image,
  ImagePlus,
  Paintbrush,
  Trash2,
  X,
  Download,
  Sparkles,
  Pin,
  Loader2,
  Images,
  Search,
  Film,
  PanelsTopLeft,
  Copy,
  Check,
} from "lucide-react";
import {
  useChatAssetBrowser,
  useGalleryImages,
  useSceneVideos,
  useUploadGalleryImage,
  useDeleteGalleryImage,
  type ChatAssetBrowserItem,
  type ChatImage,
} from "../../hooks/use-gallery";
import type { GeneratedSceneVideo } from "@marinara-engine/shared";
import { useGalleryStore } from "../../stores/gallery.store";
import { toast } from "sonner";
import { ImageUploadDropzone } from "../ui/ImageUploadDropzone";
import { buildCardAssetMarkdown, dispatchCardAssetInsert } from "../../lib/card-asset-links";
import { cn, copyToClipboard } from "../../lib/utils";
import {
  ChatImageLightbox,
  ChatVideoLightbox,
  getChatImageDownloadName,
  getSceneVideoDownloadName,
} from "./ChatImageLightbox";

interface ChatGalleryProps {
  chatId: string;
  mode?: string;
  /** Manually trigger the Illustrator agent */
  onIllustrate?: () => void | Promise<void>;
  /** Generate an on-demand Conversation selfie. */
  onGenerateSelfie?: (characterId?: string) => void | Promise<void>;
  selfieCharacters?: Array<{ id: string; name: string }>;
  /** Run Illustrator in its background prompt mode. */
  onGenerateBackground?: () => void | Promise<void>;
  /** Generate a storyboard for the latest completed Game Mode GM turn. */
  onGenerateStoryboard?: () => void | Promise<void>;
  /** Show the latest Game Mode storyboard viewer. */
  onViewStoryboard?: () => void;
  /** Generate a scene video from the latest illustration. */
  onGenerateVideo?: () => void | Promise<void>;
  /** Generate a scene video from a specific gallery illustration. */
  onAnimateImage?: (image: ChatImage) => void | Promise<void>;
}

const EMPTY_SCENE_VIDEOS: GeneratedSceneVideo[] = [];
type GalleryTab = "images" | "videos";

function formatAssetKind(asset: ChatAssetBrowserItem) {
  if (asset.kind === "chat-gallery") return "Chat gallery";
  if (asset.kind === "character-gallery") return "Character gallery";
  if (asset.kind === "persona-gallery") return "Persona gallery";
  return "Sprite";
}

function getAssetMeta(asset: ChatAssetBrowserItem) {
  const details = [asset.ownerName, formatAssetKind(asset)];
  if (asset.width && asset.height) details.push(`${asset.width} x ${asset.height}`);
  return details.join(" | ");
}

export function ChatGallery({
  chatId,
  mode,
  onIllustrate,
  onGenerateSelfie,
  selfieCharacters = [],
  onGenerateBackground,
  onGenerateStoryboard,
  onViewStoryboard,
  onGenerateVideo,
  onAnimateImage,
}: ChatGalleryProps) {
  const { data: images, isLoading } = useGalleryImages(chatId);
  const sceneVideosEnabled = mode === "game" || mode === "roleplay" || mode === "visual_novel";
  const sceneVideosQuery = useSceneVideos(chatId, sceneVideosEnabled);
  const sceneVideos = sceneVideosQuery.data ?? EMPTY_SCENE_VIDEOS;
  const upload = useUploadGalleryImage(chatId);
  const remove = useDeleteGalleryImage(chatId);
  const [lightbox, setLightbox] = useState<ChatImage | null>(null);
  const [videoLightbox, setVideoLightbox] = useState<GeneratedSceneVideo | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [copiedPromptImageId, setCopiedPromptImageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GalleryTab>("images");
  const [selectedSelfieCharacterId, setSelectedSelfieCharacterId] = useState("");
  const copyResetTimerRef = useRef<number | null>(null);
  const isIllustrating = useGalleryStore((s) => s.illustratingChatIds.has(chatId));
  const isGeneratingSelfie = useGalleryStore((s) => s.selfieGeneratingChatIds.has(chatId));
  const isGeneratingVideo = useGalleryStore((s) => s.videoGeneratingChatIds.has(chatId));
  const isGeneratingBackground = useGalleryStore((s) => s.backgroundGeneratingChatIds.has(chatId));
  const isGeneratingStoryboard = useGalleryStore((s) => s.storyboardGeneratingChatIds.has(chatId));
  const pinImage = useGalleryStore((s) => s.pinImage);
  const pinVideo = useGalleryStore((s) => s.pinVideo);
  const unpinImage = useGalleryStore((s) => s.unpinImage);
  const setChatIllustrating = useGalleryStore((s) => s.setChatIllustrating);
  const setChatGeneratingSelfie = useGalleryStore((s) => s.setChatGeneratingSelfie);
  const setChatGeneratingVideo = useGalleryStore((s) => s.setChatGeneratingVideo);
  const setChatGeneratingBackground = useGalleryStore((s) => s.setChatGeneratingBackground);
  const setChatGeneratingStoryboard = useGalleryStore((s) => s.setChatGeneratingStoryboard);
  const canBrowseAssets = mode === "roleplay";
  const assetSearchActive = canBrowseAssets && assetSearch.trim().length > 0;
  const { data: assetItems, isLoading: assetsLoading } = useChatAssetBrowser(chatId, assetSearchActive);
  const portalRoot = typeof document !== "undefined" ? document.body : null;
  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    const items = assetItems ?? [];
    if (!query) return [];
    return items.filter((asset) =>
      [asset.name, asset.ownerName, asset.prompt, formatAssetKind(asset)].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [assetItems, assetSearch]);
  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selfieCharacters.length === 0) {
      if (selectedSelfieCharacterId) setSelectedSelfieCharacterId("");
      return;
    }
    if (
      !selectedSelfieCharacterId ||
      !selfieCharacters.some((character) => character.id === selectedSelfieCharacterId)
    ) {
      setSelectedSelfieCharacterId(selfieCharacters[0]!.id);
    }
  }, [selectedSelfieCharacterId, selfieCharacters]);

  const handleUpload = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      upload.mutate(files);
    },
    [upload],
  );

  const handleDelete = (id: string) => {
    const image = images?.find((item) => item.id === id) ?? null;
    const wasPinned = useGalleryStore.getState().pinnedImages.some((item) => item.id === id);
    unpinImage(id);
    setConfirmDeleteId(null);
    if (lightbox?.id === id) setLightbox(null);
    remove.mutate(id, {
      onSuccess: () => {
        toast.success("Image deleted.");
      },
      onError: (error) => {
        if (wasPinned && image) pinImage({ ...image, chatId });
        toast.error(error instanceof Error ? error.message : "Failed to delete image.");
      },
    });
  };

  const handleIllustrate = async () => {
    if (!onIllustrate || useGalleryStore.getState().illustratingChatIds.has(chatId)) return;

    setChatIllustrating(chatId, true);
    try {
      await onIllustrate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image generation failed.");
    } finally {
      setChatIllustrating(chatId, false);
    }
  };

  const handleGenerateSelfie = async () => {
    if (!onGenerateSelfie || useGalleryStore.getState().selfieGeneratingChatIds.has(chatId)) return;

    const characterId = selfieCharacters.length > 1 ? selectedSelfieCharacterId : selfieCharacters[0]?.id;
    setChatGeneratingSelfie(chatId, true);
    try {
      await onGenerateSelfie(characterId);
      toast.success("Selfie generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Selfie generation failed.");
    } finally {
      setChatGeneratingSelfie(chatId, false);
    }
  };

  const handleGenerateBackground = async () => {
    if (!onGenerateBackground || useGalleryStore.getState().backgroundGeneratingChatIds.has(chatId)) return;

    setChatGeneratingBackground(chatId, true);
    try {
      await onGenerateBackground();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Background generation failed.");
    } finally {
      setChatGeneratingBackground(chatId, false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!onGenerateVideo || useGalleryStore.getState().videoGeneratingChatIds.has(chatId)) return;

    setChatGeneratingVideo(chatId, true);
    try {
      await onGenerateVideo();
      await sceneVideosQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Video generation failed.");
    } finally {
      setChatGeneratingVideo(chatId, false);
    }
  };

  const handleGenerateStoryboard = async () => {
    if (!onGenerateStoryboard || useGalleryStore.getState().storyboardGeneratingChatIds.has(chatId)) return;

    setChatGeneratingStoryboard(chatId, true);
    try {
      await onGenerateStoryboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Storyboard generation failed.");
    } finally {
      setChatGeneratingStoryboard(chatId, false);
    }
  };

  const handleAnimateImage = async (image: ChatImage) => {
    if (!onAnimateImage || useGalleryStore.getState().videoGeneratingChatIds.has(chatId)) return;

    setChatGeneratingVideo(chatId, true);
    try {
      await onAnimateImage(image);
      await sceneVideosQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Video generation failed.");
    } finally {
      setChatGeneratingVideo(chatId, false);
    }
  };

  const handlePinImage = useCallback(
    (image: ChatImage) => {
      pinImage({ ...image, chatId });
    },
    [chatId, pinImage],
  );

  const handleCopyPrompt = useCallback(async (image: ChatImage) => {
    const prompt = image.prompt.trim();
    if (!prompt) return;

    const ok = await copyToClipboard(prompt);
    if (!ok) {
      toast.error("Could not copy prompt.");
      return;
    }

    setCopiedPromptImageId(image.id);
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopiedPromptImageId(null);
      copyResetTimerRef.current = null;
    }, 1400);
    toast.success("Prompt copied.");
  }, []);

  const handlePinVideo = useCallback(
    (video: GeneratedSceneVideo) => {
      pinVideo({ ...video, chatId });
    },
    [chatId, pinVideo],
  );

  const handleInsertAsset = useCallback(
    (asset: ChatAssetBrowserItem) => {
      const label = asset.prompt.trim() || asset.name;
      dispatchCardAssetInsert(buildCardAssetMarkdown(label, asset.cardUrl), chatId);
      toast.success("Image link inserted.");
      setAssetSearch("");
    },
    [chatId],
  );

  const actionCount = [
    onIllustrate,
    onGenerateSelfie,
    onGenerateStoryboard,
    onGenerateVideo,
    onGenerateBackground,
  ].filter(Boolean).length;
  const actionGridClass =
    actionCount >= 4
      ? "grid grid-cols-2 gap-2"
      : actionCount === 3
        ? "grid grid-cols-3 gap-2"
        : actionCount === 2
          ? "grid grid-cols-2 gap-2"
          : "grid gap-2";
  const hasImages = !!images && images.length > 0;
  const hasVideos = sceneVideos.length > 0;
  const imageCount = images?.length ?? 0;
  const videoCount = sceneVideos.length;

  useEffect(() => {
    if (!sceneVideosEnabled && activeTab === "videos") setActiveTab("images");
  }, [activeTab, sceneVideosEnabled]);

  return (
    <>
      <div className="flex flex-col gap-3 p-4">
        {(onIllustrate || onGenerateSelfie || onGenerateStoryboard || onGenerateVideo || onGenerateBackground) && (
          <div className={actionGridClass}>
            {onIllustrate && (
              <button
                type="button"
                onClick={() => void handleIllustrate()}
                disabled={isIllustrating}
                aria-busy={isIllustrating}
                className="flex min-w-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)]/15 px-3 py-3 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25 disabled:cursor-wait disabled:opacity-75"
              >
                {isIllustrating ? (
                  <Loader2 size="1rem" className="shrink-0 animate-spin" />
                ) : (
                  <Paintbrush size="1rem" className="shrink-0" />
                )}
                <span className="min-w-0 truncate">{isIllustrating ? "Generating..." : "Illustrate"}</span>
              </button>
            )}
            {onGenerateSelfie && (
              <div className="flex min-w-0 flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleGenerateSelfie()}
                  disabled={isGeneratingSelfie}
                  aria-busy={isGeneratingSelfie}
                  className="flex min-w-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)]/15 px-3 py-3 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25 disabled:cursor-wait disabled:opacity-75"
                >
                  {isGeneratingSelfie ? (
                    <Loader2 size="1rem" className="shrink-0 animate-spin" />
                  ) : (
                    <Camera size="1rem" className="shrink-0" />
                  )}
                  <span className="min-w-0 truncate">{isGeneratingSelfie ? "Generating..." : "Selfie"}</span>
                </button>
                {selfieCharacters.length > 1 && (
                  <select
                    value={selectedSelfieCharacterId}
                    onChange={(event) => setSelectedSelfieCharacterId(event.target.value)}
                    disabled={isGeneratingSelfie}
                    className="min-w-0 rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] disabled:cursor-wait disabled:opacity-70"
                    aria-label="Selfie character"
                  >
                    {selfieCharacters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {onGenerateStoryboard && (
              <button
                type="button"
                onClick={() => void handleGenerateStoryboard()}
                disabled={isGeneratingStoryboard}
                aria-busy={isGeneratingStoryboard}
                className="flex min-w-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)]/15 px-3 py-3 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25 disabled:cursor-wait disabled:opacity-75"
              >
                {isGeneratingStoryboard ? (
                  <Loader2 size="1rem" className="shrink-0 animate-spin" />
                ) : (
                  <PanelsTopLeft size="1rem" className="shrink-0" />
                )}
                <span className="min-w-0 truncate">{isGeneratingStoryboard ? "Creating..." : "Create storyboard"}</span>
              </button>
            )}
            {onGenerateVideo && (
              <button
                type="button"
                onClick={() => void handleGenerateVideo()}
                disabled={isGeneratingVideo}
                aria-busy={isGeneratingVideo}
                className="flex min-w-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)]/15 px-3 py-3 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25 disabled:cursor-wait disabled:opacity-75"
              >
                {isGeneratingVideo ? (
                  <Loader2 size="1rem" className="shrink-0 animate-spin" />
                ) : (
                  <Film size="1rem" className="shrink-0" />
                )}
                <span className="min-w-0 truncate">{isGeneratingVideo ? "Generating..." : "Video"}</span>
              </button>
            )}
            {onGenerateBackground && (
              <button
                type="button"
                onClick={() => void handleGenerateBackground()}
                disabled={isGeneratingBackground}
                aria-busy={isGeneratingBackground}
                className="flex min-w-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)]/15 px-3 py-3 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25 disabled:cursor-wait disabled:opacity-75"
              >
                {isGeneratingBackground ? (
                  <Loader2 size="1rem" className="shrink-0 animate-spin" />
                ) : (
                  <Image size="1rem" className="shrink-0" />
                )}
                <span className="min-w-0 truncate">{isGeneratingBackground ? "Generating..." : "Background"}</span>
              </button>
            )}
          </div>
        )}

        {canBrowseAssets && (
          <div className="relative">
            <Search
              size="0.875rem"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              type="search"
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.target.value)}
              placeholder="Search chat, character, persona, and sprite images"
              aria-label="Search gallery images"
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] pl-9 pr-10 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            />
            {assetSearch && (
              <button
                type="button"
                onClick={() => setAssetSearch("")}
                aria-label="Clear gallery search"
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <X size="0.875rem" />
              </button>
            )}
          </div>
        )}

        {onViewStoryboard && (
          <button
            type="button"
            onClick={onViewStoryboard}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--secondary)] px-4 py-3 text-xs font-medium text-[var(--foreground)] transition-all hover:bg-[var(--accent)]"
          >
            <PanelsTopLeft size="1rem" />
            View storyboard
          </button>
        )}

        {(isIllustrating || isGeneratingVideo || isGeneratingBackground || isGeneratingStoryboard) && (
          <div
            className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-2 text-xs text-[var(--primary)]"
            role="status"
            aria-live="polite"
          >
            {isGeneratingVideo
              ? "AI video generation is running. The new video will appear here when it finishes."
              : isGeneratingStoryboard
                ? "Storyboard generation is running. Keyframes will appear in the game storyboard viewer when ready."
                : isGeneratingBackground
                  ? "Illustrator is generating a background image for this scene."
                  : "AI image generation is running. The new image will appear here when it finishes."}
          </div>
        )}

        {assetSearchActive && (
          <section className="space-y-2" aria-label="Gallery image search results">
            <div className="flex items-center justify-between gap-3 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              <span className="flex min-w-0 items-center gap-2">
                <Images size="0.75rem" className="shrink-0" />
                <span className="truncate">Image search results</span>
              </span>
              {!assetsLoading && <span className="shrink-0">{filteredAssets.length}</span>}
            </div>

            {assetsLoading && (
              <div
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] py-10 text-xs text-[var(--muted-foreground)]"
                role="status"
              >
                <Loader2 size="1rem" className="animate-spin" />
                Searching images...
              </div>
            )}

            {!assetsLoading && filteredAssets.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted-foreground)]">
                <Search size="1.5rem" className="opacity-45" />
                <p className="text-xs">No matching images</p>
                <p className="max-w-[34rem] px-4 text-center text-[0.625rem] opacity-70">
                  Try a character name, prompt detail, or image source.
                </p>
              </div>
            )}

            {!assetsLoading && filteredAssets.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handleInsertAsset(asset)}
                    className="group overflow-hidden rounded-lg bg-[var(--secondary)] text-left ring-1 ring-[var(--border)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:ring-[var(--primary)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    aria-label={`Insert ${asset.name}`}
                  >
                    <img
                      src={asset.url}
                      alt={asset.prompt || asset.name}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full object-cover"
                    />
                    <span className="block space-y-1 p-2">
                      <span className="block truncate text-xs font-medium text-[var(--foreground)]">
                        {asset.prompt || asset.name}
                      </span>
                      <span className="block truncate text-[0.6875rem] text-[var(--muted-foreground)]">
                        {getAssetMeta(asset)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <div
          className={cn(
            "grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 p-1",
            assetSearchActive && "hidden",
          )}
          role="tablist"
          aria-label="Gallery media type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "images"}
            onClick={() => setActiveTab("images")}
            className={cn(
              "flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              activeTab === "images"
                ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <Image size="0.875rem" className="shrink-0" />
            <span className="truncate">Images</span>
            <span className="rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
              {imageCount}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "videos"}
            onClick={() => setActiveTab("videos")}
            disabled={!sceneVideosEnabled}
            className={cn(
              "flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              !sceneVideosEnabled
                ? "cursor-not-allowed text-[var(--muted-foreground)] opacity-50"
                : activeTab === "videos"
                  ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <Film size="0.875rem" className="shrink-0" />
            <span className="truncate">Videos</span>
            <span className="rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
              {videoCount}
            </span>
          </button>
        </div>

        {!assetSearchActive && activeTab === "images" && (
          <>
            <ImageUploadDropzone
              label="Upload Images"
              pending={upload.isPending}
              pendingLabel="Uploading…"
              dragLabel="Drop images to upload"
              onFilesSelected={handleUpload}
              icon={<ImagePlus size="1rem" />}
            />

            {/* Loading state */}
            {isLoading && <p className="text-center text-xs text-[var(--muted-foreground)]">Loading gallery…</p>}

            {/* Empty state */}
            {!isLoading && !hasImages && (
              <div className="flex flex-col items-center gap-2 py-8 text-[var(--muted-foreground)]">
                <Sparkles size="1.5rem" className="opacity-40" />
                <p className="text-xs">No images yet</p>
                <p className="text-[0.625rem] opacity-60">
                  {onIllustrate
                    ? "Upload images or generate illustrations to build your gallery"
                    : "Upload images to build your gallery"}
                </p>
              </div>
            )}

            {/* Image grid */}
            {hasImages && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                {images!.map((img) => (
                  <div
                    key={img.id}
                    className="group relative overflow-hidden rounded-lg bg-[var(--secondary)] ring-1 ring-transparent transition-all hover:ring-[var(--primary)]/40 hover:shadow-lg focus-within:ring-2 focus-within:ring-[var(--primary)]"
                  >
                    <button
                      type="button"
                      onClick={() => setLightbox(img)}
                      className="block w-full"
                      aria-label="Open gallery image"
                    >
                      <img
                        src={img.url}
                        alt={img.prompt || "Gallery image"}
                        loading="lazy"
                        decoding="async"
                        className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </button>
                    {/* Overlay */}
                    <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
                      <div className="flex w-full items-center justify-between p-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handlePinImage(img)}
                            aria-label="Pin image to chat"
                            className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                            title="Pin to chat"
                          >
                            <Pin size="0.75rem" />
                          </button>
                          <a
                            href={img.url}
                            download={getChatImageDownloadName(img)}
                            aria-label="Download gallery image"
                            className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                            title="Download image"
                          >
                            <Download size="0.75rem" />
                          </a>
                          {onAnimateImage && (
                            <button
                              type="button"
                              onClick={() => void handleAnimateImage(img)}
                              disabled={isGeneratingVideo}
                              aria-label="Animate gallery illustration"
                              className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30 disabled:cursor-wait disabled:opacity-60"
                              title="Animate illustration"
                            >
                              {isGeneratingVideo ? (
                                <Loader2 size="0.75rem" className="animate-spin" />
                              ) : (
                                <Film size="0.75rem" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void handleCopyPrompt(img);
                            }}
                            disabled={!img.prompt.trim()}
                            aria-label="Copy image prompt"
                            className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-45"
                            title={img.prompt.trim() ? "Copy prompt" : "No prompt saved"}
                          >
                            {copiedPromptImageId === img.id ? <Check size="0.75rem" /> : <Copy size="0.75rem" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(img.id)}
                          aria-label="Delete gallery image"
                          className="pointer-events-auto rounded-md bg-red-500/40 p-1.5 text-white transition-colors hover:bg-red-500/60"
                        >
                          <Trash2 size="0.75rem" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!assetSearchActive && activeTab === "videos" && (
          <>
            {sceneVideosQuery.isLoading && sceneVideosEnabled && (
              <p className="text-center text-xs text-[var(--muted-foreground)]">Loading scene videos...</p>
            )}

            {!sceneVideosQuery.isLoading && !hasVideos && (
              <div className="flex flex-col items-center gap-2 py-8 text-[var(--muted-foreground)]">
                <Film size="1.5rem" className="opacity-40" />
                <p className="text-xs">No videos yet</p>
                <p className="text-[0.625rem] opacity-60">
                  {onGenerateVideo || onAnimateImage
                    ? "Generate or animate scene videos to fill this tab"
                    : "Generated scene videos will appear here"}
                </p>
              </div>
            )}

            {hasVideos && (
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase text-[var(--muted-foreground)]">
                  <Film size="0.75rem" />
                  Scene videos
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {sceneVideos.map((video) => (
                    <div
                      key={video.id}
                      className="group relative overflow-hidden rounded-lg bg-[var(--secondary)] ring-1 ring-transparent transition-all hover:ring-[var(--primary)]/40 hover:shadow-lg focus-within:ring-2 focus-within:ring-[var(--primary)]"
                    >
                      <button
                        type="button"
                        onClick={() => setVideoLightbox(video)}
                        className="block w-full"
                        aria-label="Open scene video"
                      >
                        <video
                          src={video.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="aspect-video w-full bg-black object-contain"
                        />
                      </button>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
                        <div className="flex w-full items-center justify-between gap-2 p-2">
                          <div className="min-w-0 text-white">
                            <div className="truncate text-[0.6875rem] font-medium">
                              {video.durationSeconds}s scene video
                            </div>
                            <div className="truncate text-[0.625rem] text-white/70">{video.model}</div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => handlePinVideo(video)}
                              aria-label="Pin video to chat"
                              className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                              title="Pin to chat"
                            >
                              <Pin size="0.75rem" />
                            </button>
                            <a
                              href={video.url}
                              download={getSceneVideoDownloadName(video)}
                              aria-label="Download scene video"
                              className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                              title="Download video"
                            >
                              <Download size="0.75rem" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {portalRoot &&
        confirmDeleteId &&
        createPortal(
          <div
            data-chat-floating-panel
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm max-md:pt-[env(safe-area-inset-top)]"
          >
            <div className="mx-4 rounded-xl bg-[var(--background)] p-5 shadow-2xl ring-1 ring-[var(--border)]">
              <p className="mb-4 text-sm font-medium">Delete this image?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 rounded-lg bg-[var(--secondary)] px-4 py-2 text-xs transition-colors hover:bg-[var(--accent)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/30"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          portalRoot,
        )}

      {/* Lightbox */}
      {lightbox && <ChatImageLightbox image={lightbox} onPin={handlePinImage} onClose={() => setLightbox(null)} />}
      {videoLightbox && (
        <ChatVideoLightbox video={videoLightbox} onPin={handlePinVideo} onClose={() => setVideoLightbox(null)} />
      )}
    </>
  );
}
