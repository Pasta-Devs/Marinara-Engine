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
  Bot,
  ChevronDown,
} from "lucide-react";
import {
  useChatAssetBrowser,
  useDeleteSceneVideo,
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
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn, copyToClipboard } from "../../lib/utils";
import { downloadUrlToDevice } from "../../lib/file-download";
import {
  ChatImageLightbox,
  ChatVideoLightbox,
  getChatImageDownloadName,
  getSceneVideoDownloadName,
} from "./ChatImageLightbox";
import { useTranslation as useUiTranslation } from "react-i18next";

interface ChatGalleryProps {
  chatId: string;
  mode?: string;
  /** Manually trigger the Illustrator agent */
  onIllustrate?: () => void | Promise<void>;
  illustrateAgents?: Array<{ id: string; name: string }>;
  onIllustrateWithAgent?: (agentType: string) => void | Promise<void>;
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

function getChatGalleryImageId(asset: ChatAssetBrowserItem, chatId: string) {
  if (asset.kind !== "chat-gallery" || asset.ownerId !== chatId) return null;
  return asset.id.startsWith("chat-gallery:") ? asset.id.slice("chat-gallery:".length) : asset.id;
}

export function ChatGallery({
  chatId,
  mode,
  onIllustrate,
  illustrateAgents = [],
  onIllustrateWithAgent,
  onGenerateSelfie,
  selfieCharacters = [],
  onGenerateBackground,
  onGenerateStoryboard,
  onViewStoryboard,
  onGenerateVideo,
  onAnimateImage,
}: ChatGalleryProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: images, isLoading } = useGalleryImages(chatId);
  const sceneVideosEnabled = mode === "game" || mode === "roleplay";
  const sceneVideosQuery = useSceneVideos(chatId, sceneVideosEnabled);
  const sceneVideos = sceneVideosEnabled ? (sceneVideosQuery.data ?? EMPTY_SCENE_VIDEOS) : EMPTY_SCENE_VIDEOS;
  const upload = useUploadGalleryImage(chatId);
  const remove = useDeleteGalleryImage(chatId);
  const deleteVideo = useDeleteSceneVideo(chatId);
  const [lightbox, setLightbox] = useState<ChatImage | null>(null);
  const [videoLightbox, setVideoLightbox] = useState<GeneratedSceneVideo | null>(null);
  const [selectingImages, setSelectingImages] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(() => new Set());
  const [batchOperationPending, setBatchOperationPending] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [copiedPromptImageId, setCopiedPromptImageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GalleryTab>("images");
  const [selectedSelfieCharacterId, setSelectedSelfieCharacterId] = useState("");
  const [illustrateMenuOpen, setIllustrateMenuOpen] = useState(false);
  const illustrateMenuRef = useRef<HTMLDivElement | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const batchOperationPendingRef = useRef(false);
  const previousAssetSearchRef = useRef(assetSearch);
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
  const assetSearchActive = assetSearch.trim().length > 0;
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
  const selectedImages = useMemo(
    () => images?.filter((image) => selectedImageIds.has(image.id)) ?? [],
    [images, selectedImageIds],
  );
  const selectableImageIds = useMemo(() => {
    if (!assetSearchActive) return images?.map((image) => image.id) ?? [];
    const availableIds = new Set(images?.map((image) => image.id) ?? []);
    return filteredAssets.flatMap((asset) => {
      const imageId = getChatGalleryImageId(asset, chatId);
      return imageId && availableIds.has(imageId) ? [imageId] : [];
    });
  }, [assetSearchActive, chatId, filteredAssets, images]);
  const displayedAssets = useMemo(
    () =>
      selectingImages
        ? filteredAssets.filter((asset) => getChatGalleryImageId(asset, chatId) !== null)
        : filteredAssets,
    [chatId, filteredAssets, selectingImages],
  );

  const leaveImageSelection = useCallback(() => {
    setSelectingImages(false);
    setSelectedImageIds(new Set());
  }, []);

  const toggleImageSelection = useCallback((imageId: string) => {
    setSelectedImageIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }, []);

  useEffect(() => {
    setSelectingImages(false);
    setSelectedImageIds(new Set());
    setAssetSearch("");
  }, [chatId]);

  useEffect(() => {
    const availableIds = new Set(images?.map((image) => image.id) ?? []);
    setSelectedImageIds((current) => {
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [images]);

  useEffect(() => {
    if (previousAssetSearchRef.current === assetSearch) return;
    previousAssetSearchRef.current = assetSearch;
    if (selectingImages) setSelectedImageIds(new Set());
  }, [assetSearch, selectingImages]);
  useEffect(() => {
    if (!illustrateMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && illustrateMenuRef.current?.contains(target)) return;
      setIllustrateMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [illustrateMenuOpen]);

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
        toast.success(localizeUi("ui.chat.chatgallery.imageDeleted"));
      },
      onError: (error) => {
        if (wasPinned && image) pinImage({ ...image, chatId });
        toast.error(error instanceof Error ? error.message : localizeUi("ui.chat.chatgallery.failedToDeleteImage"));
      },
    });
  };

  const handleBatchDownload = useCallback(async () => {
    if (selectedImages.length === 0 || batchOperationPendingRef.current) return;
    batchOperationPendingRef.current = true;
    setBatchOperationPending(true);
    try {
      if (
        !(await showConfirmDialog({
          title: localizeUi("ui.gallery.batch.downloadTitle"),
          message: localizeUi("ui.gallery.batch.downloadMessage", { count: selectedImages.length }),
          confirmLabel: localizeUi("ui.gallery.batch.download"),
        }))
      ) {
        return;
      }

      let failedDownloads = 0;
      for (const image of selectedImages) {
        try {
          await downloadUrlToDevice(image.url, getChatImageDownloadName(image));
        } catch {
          failedDownloads += 1;
        }
      }

      if (failedDownloads > 0) {
        toast.error(
          localizeUi("ui.gallery.batch.downloadPartial", {
            completed: selectedImages.length - failedDownloads,
            count: selectedImages.length,
            failed: failedDownloads,
          }),
        );
      } else {
        toast.success(localizeUi("ui.gallery.batch.downloadStarted", { count: selectedImages.length }));
      }
      leaveImageSelection();
    } finally {
      batchOperationPendingRef.current = false;
      setBatchOperationPending(false);
    }
  }, [leaveImageSelection, localizeUi, selectedImages]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedImages.length === 0 || batchOperationPendingRef.current) return;
    batchOperationPendingRef.current = true;
    setBatchOperationPending(true);
    try {
      if (
        !(await showConfirmDialog({
          title: localizeUi("ui.gallery.batch.deleteTitle"),
          message: localizeUi("ui.gallery.batch.deleteMessage", { count: selectedImages.length }),
          confirmLabel: localizeUi("ui.gallery.batch.delete"),
          tone: "destructive",
        }))
      ) {
        return;
      }

      let failedDeletes = 0;
      for (const image of selectedImages) {
        const wasPinned = useGalleryStore.getState().pinnedImages.some((item) => item.id === image.id);
        unpinImage(image.id);
        try {
          await remove.mutateAsync(image.id);
        } catch {
          failedDeletes += 1;
          if (wasPinned) pinImage({ ...image, chatId });
        }
      }

      if (lightbox && selectedImageIds.has(lightbox.id)) setLightbox(null);
      if (failedDeletes > 0) {
        toast.error(
          localizeUi("ui.gallery.batch.deletePartial", {
            completed: selectedImages.length - failedDeletes,
            count: selectedImages.length,
            failed: failedDeletes,
          }),
        );
      } else {
        toast.success(localizeUi("ui.gallery.batch.deleted", { count: selectedImages.length }));
      }
      leaveImageSelection();
    } finally {
      batchOperationPendingRef.current = false;
      setBatchOperationPending(false);
    }
  }, [
    chatId,
    leaveImageSelection,
    lightbox,
    localizeUi,
    pinImage,
    remove,
    selectedImageIds,
    selectedImages,
    unpinImage,
  ]);

  const handleIllustrate = async (agentType?: string) => {
    const illustrate = agentType ? () => onIllustrateWithAgent?.(agentType) : onIllustrate;
    if (!illustrate || useGalleryStore.getState().illustratingChatIds.has(chatId)) return;

    setIllustrateMenuOpen(false);
    setChatIllustrating(chatId, true);
    try {
      await illustrate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.chat.chatgallery.imageGenerationFailed"));
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
      toast.success(localizeUi("ui.chat.chatgallery.selfieGenerated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.chat.chatgallery.selfieGenerationFailed"));
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
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.chat.chatgallery.backgroundGenerationFailed"),
      );
    } finally {
      setChatGeneratingBackground(chatId, false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!sceneVideosEnabled || !onGenerateVideo || useGalleryStore.getState().videoGeneratingChatIds.has(chatId)) {
      return;
    }

    setChatGeneratingVideo(chatId, true);
    try {
      await onGenerateVideo();
      await sceneVideosQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.chat.chatgallery.videoGenerationFailed"));
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
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.chat.chatgallery.storyboardGenerationFailed"),
      );
    } finally {
      setChatGeneratingStoryboard(chatId, false);
    }
  };

  const handleAnimateImage = async (image: ChatImage) => {
    if (!sceneVideosEnabled || !onAnimateImage || useGalleryStore.getState().videoGeneratingChatIds.has(chatId)) {
      return;
    }

    setChatGeneratingVideo(chatId, true);
    try {
      await onAnimateImage(image);
      await sceneVideosQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.chat.chatgallery.videoGenerationFailed"));
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

  const handleCopyPrompt = useCallback(
    async (image: ChatImage) => {
      const prompt = image.prompt.trim();
      if (!prompt) return;

      const ok = await copyToClipboard(prompt);
      if (!ok) {
        toast.error(localizeUi("ui.chat.chatgallery.couldNotCopyPrompt"));
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
      toast.success(localizeUi("ui.chat.chatgallery.promptCopied"));
    },
    [localizeUi],
  );

  const handlePinVideo = useCallback(
    (video: GeneratedSceneVideo) => {
      if (!sceneVideosEnabled) return;
      pinVideo({ ...video, chatId });
    },
    [chatId, pinVideo, sceneVideosEnabled],
  );

  const handleDeleteVideo = useCallback(
    async (video: GeneratedSceneVideo) => {
      if (!sceneVideosEnabled) return;
      if (
        !(await showConfirmDialog({
          title: localizeUi("ui.chat.chatgallery.deleteSceneVideo"),
          message: localizeUi("ui.chat.chatgallery.deleteThisVideo"),
          confirmLabel: localizeUi("lorebook.editor.batch.delete"),
          tone: "destructive",
        }))
      ) {
        return;
      }

      const wasPinned = useGalleryStore.getState().pinnedImages.some((item) => item.id === video.id);
      unpinImage(video.id);
      if (videoLightbox?.id === video.id) setVideoLightbox(null);
      setDeletingVideoId(video.id);
      try {
        await deleteVideo.mutateAsync(video.id);
        toast.success(localizeUi("ui.chat.chatgallery.videoDeleted"));
      } catch (error) {
        if (wasPinned) pinVideo({ ...video, chatId });
        toast.error(error instanceof Error ? error.message : localizeUi("ui.chat.chatgallery.failedToDeleteVideo"));
      } finally {
        setDeletingVideoId(null);
      }
    },
    [chatId, deleteVideo, localizeUi, pinVideo, sceneVideosEnabled, unpinImage, videoLightbox?.id],
  );

  const handleInsertAsset = useCallback(
    (asset: ChatAssetBrowserItem) => {
      const label = asset.prompt.trim() || asset.name;
      dispatchCardAssetInsert(buildCardAssetMarkdown(label, asset.cardUrl), chatId);
      toast.success(localizeUi("ui.chat.chatgallery.imageLinkInserted"));
      setAssetSearch("");
    },
    [chatId, localizeUi],
  );

  const canIllustrate = Boolean(onIllustrate || (onIllustrateWithAgent && illustrateAgents.length > 0));
  const actionCount = [
    canIllustrate,
    onGenerateSelfie,
    onGenerateStoryboard,
    sceneVideosEnabled && onGenerateVideo,
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
    if (!sceneVideosEnabled) {
      if (activeTab === "videos") setActiveTab("images");
      if (videoLightbox) setVideoLightbox(null);
    }
  }, [activeTab, sceneVideosEnabled, videoLightbox]);

  return (
    <>
      <div className="flex flex-col gap-3 p-4">
        {(canIllustrate ||
          onGenerateSelfie ||
          onGenerateStoryboard ||
          (sceneVideosEnabled && onGenerateVideo) ||
          onGenerateBackground) && (
          <div className={actionGridClass}>
            {canIllustrate && (
              <div ref={illustrateMenuRef} className="relative min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    if (illustrateAgents.length > 0) setIllustrateMenuOpen((current) => !current);
                    else void handleIllustrate();
                  }}
                  disabled={isIllustrating}
                  aria-busy={isIllustrating}
                  aria-haspopup={illustrateAgents.length > 0 ? "menu" : undefined}
                  aria-expanded={illustrateAgents.length > 0 ? illustrateMenuOpen : undefined}
                  className="flex w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)]/15 px-3 py-3 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25 disabled:cursor-wait disabled:opacity-75"
                >
                  {isIllustrating ? (
                    <Loader2 size="1rem" className="shrink-0 animate-spin" />
                  ) : (
                    <Paintbrush size="1rem" className="shrink-0" />
                  )}
                  <span className="min-w-0 truncate">
                    {isIllustrating
                      ? localizeUi("ui.chat.summarypopover.generating")
                      : localizeUi("ui.chat.chatgallery.illustrate")}
                  </span>
                  {illustrateAgents.length > 0 && !isIllustrating ? (
                    <ChevronDown size="0.875rem" className="shrink-0" />
                  ) : null}
                </button>
                {illustrateMenuOpen && (
                  <div
                    role="menu"
                    aria-label={localizeUi("ui.chat.chatgallery.chooseImageAgent")}
                    className="absolute left-0 top-full z-30 mt-1.5 w-full min-w-52 overflow-hidden rounded-xl bg-[var(--popover)] p-1.5 text-[var(--popover-foreground)] shadow-xl ring-1 ring-[var(--border)]"
                  >
                    {onIllustrate ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void handleIllustrate()}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]"
                      >
                        <Paintbrush size="0.875rem" className="shrink-0 text-[var(--primary)]" />
                        <span className="truncate">{localizeUi("ui.chat.chatgallery.baseIllustrator")}</span>
                      </button>
                    ) : null}
                    {illustrateAgents.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        role="menuitem"
                        onClick={() => void handleIllustrate(agent.id)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]"
                      >
                        <Bot size="0.875rem" className="shrink-0 text-[var(--primary)]" />
                        <span className="truncate">{agent.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                  <span className="min-w-0 truncate">
                    {isGeneratingSelfie
                      ? localizeUi("ui.chat.summarypopover.generating")
                      : localizeUi("ui.chat.chatgallery.selfie")}
                  </span>
                </button>
                {selfieCharacters.length > 1 && (
                  <select
                    value={selectedSelfieCharacterId}
                    onChange={(event) => setSelectedSelfieCharacterId(event.target.value)}
                    disabled={isGeneratingSelfie}
                    className="min-w-0 rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] disabled:cursor-wait disabled:opacity-70"
                    aria-label={localizeUi("ui.chat.chatgallery.selfieCharacter")}
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
                <span className="min-w-0 truncate">
                  {isGeneratingStoryboard
                    ? localizeUi("ui.chat.chatgallery.creating")
                    : localizeUi("ui.chat.chatgallery.createStoryboard")}
                </span>
              </button>
            )}
            {sceneVideosEnabled && onGenerateVideo && (
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
                <span className="min-w-0 truncate">
                  {isGeneratingVideo
                    ? localizeUi("ui.chat.summarypopover.generating")
                    : localizeUi("ui.chat.chatgallery.video")}
                </span>
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
                <span className="min-w-0 truncate">
                  {isGeneratingBackground
                    ? localizeUi("ui.chat.summarypopover.generating")
                    : localizeUi("ui.chat.chatgallery.background")}
                </span>
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size="0.875rem"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              type="search"
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.target.value)}
              placeholder={localizeUi("ui.chat.chatgallery.searchChatCharacterPersonaAndSpriteImages")}
              aria-label={localizeUi("ui.chat.chatgallery.searchGalleryImages")}
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] pl-9 pr-10 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            />
            {assetSearch && (
              <button
                type="button"
                onClick={() => setAssetSearch("")}
                aria-label={localizeUi("ui.chat.chatgallery.clearGallerySearch")}
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <X size="0.875rem" />
              </button>
            )}
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              disabled={!images?.length}
              onClick={() => {
                if (selectingImages) leaveImageSelection();
                else {
                  setConfirmDeleteId(null);
                  setActiveTab("images");
                  setSelectingImages(true);
                }
              }}
              className="mari-editor-action inline-flex h-10 min-w-28 justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectingImages ? <X size="0.875rem" /> : <Check size="0.875rem" />}
              {localizeUi(selectingImages ? "ui.gallery.batch.cancel" : "settings.common.select")}
            </button>
            <button
              type="button"
              disabled={selectableImageIds.length === 0}
              onClick={() => {
                setConfirmDeleteId(null);
                setActiveTab("images");
                setSelectingImages(true);
                setSelectedImageIds(new Set(selectableImageIds));
              }}
              className="mari-editor-action inline-flex h-10 min-w-28 justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size="0.875rem" />
              {localizeUi("ui.gallery.batch.selectAll")}
            </button>
          </div>
        </div>

        {selectingImages && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 p-2">
            <span className="px-1 text-xs font-semibold text-[var(--muted-foreground)]">
              {localizeUi("ui.gallery.batch.selected", { count: selectedImages.length })}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={selectedImages.length === 0 || batchOperationPending}
                onClick={() => void handleBatchDownload()}
                className="mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size="0.875rem" />
                {localizeUi("ui.gallery.batch.download")}
              </button>
              <button
                type="button"
                disabled={selectedImages.length === 0 || batchOperationPending}
                onClick={() => void handleBatchDelete()}
                className="mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size="0.875rem" />
                {localizeUi("ui.gallery.batch.delete")}
              </button>
            </div>
          </div>
        )}

        {onViewStoryboard && (
          <button
            type="button"
            onClick={onViewStoryboard}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--secondary)] px-4 py-3 text-xs font-medium text-[var(--foreground)] transition-all hover:bg-[var(--accent)]"
          >
            <PanelsTopLeft size="1rem" />
            {localizeUi("ui.chat.chatgallery.viewStoryboard")}
          </button>
        )}

        {(isIllustrating || isGeneratingVideo || isGeneratingBackground || isGeneratingStoryboard) && (
          <div
            className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-2 text-xs text-[var(--primary)]"
            role="status"
            aria-live="polite"
          >
            {isGeneratingVideo
              ? localizeUi("ui.chat.chatgallery.aiVideoGenerationIsRunningTheNewVideoWill")
              : isGeneratingStoryboard
                ? localizeUi("ui.chat.chatgallery.storyboardGenerationIsRunningKeyframesWillAppearInThe")
                : isGeneratingBackground
                  ? localizeUi("ui.chat.chatgallery.illustratorIsGeneratingABackgroundImageForThisScene")
                  : localizeUi("ui.chat.chatgallery.aiImageGenerationIsRunningTheNewImageWill")}
          </div>
        )}

        {assetSearchActive && (
          <section className="space-y-2" aria-label={localizeUi("ui.chat.chatgallery.galleryImageSearchResults")}>
            <div className="flex items-center justify-between gap-3 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              <span className="flex min-w-0 items-center gap-2">
                <Images size="0.75rem" className="shrink-0" />
                <span className="truncate">{localizeUi("ui.chat.chatgallery.imageSearchResults")}</span>
              </span>
              {!assetsLoading && <span className="shrink-0">{displayedAssets.length}</span>}
            </div>

            {assetsLoading && (
              <div
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] py-10 text-xs text-[var(--muted-foreground)]"
                role="status"
              >
                <Loader2 size="1rem" className="animate-spin" />
                {localizeUi("ui.chat.chatgallery.searchingImages")}
              </div>
            )}

            {!assetsLoading && displayedAssets.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-10 text-[var(--muted-foreground)]">
                <Search size="1.5rem" className="opacity-45" />
                <p className="text-xs">{localizeUi("ui.chat.chatgallery.noMatchingImages")}</p>
                <p className="max-w-[34rem] px-4 text-center text-[0.625rem] opacity-70">
                  {localizeUi("ui.chat.chatgallery.tryACharacterNamePromptDetailOrImageSource")}
                </p>
              </div>
            )}

            {!assetsLoading && displayedAssets.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {displayedAssets.map((asset) => {
                  const imageId = getChatGalleryImageId(asset, chatId);
                  const selected = imageId ? selectedImageIds.has(imageId) : false;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        if (selectingImages && imageId) toggleImageSelection(imageId);
                        else handleInsertAsset(asset);
                      }}
                      aria-pressed={selectingImages && imageId ? selected : undefined}
                      className={cn(
                        "group relative overflow-hidden rounded-lg bg-[var(--secondary)] text-left ring-1 transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:ring-[var(--primary)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                        selected ? "ring-2 ring-[var(--primary)]" : "ring-[var(--border)]",
                      )}
                      aria-label={
                        selectingImages
                          ? localizeUi("ui.gallery.batch.toggleImageNamed", {
                              name: asset.prompt || asset.name,
                            })
                          : localizeUi("ui.chat.chatgallery.insertValue1", { value1: asset.name })
                      }
                    >
                      {selectingImages && imageId ? (
                        <span
                          className={cn(
                            "absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border shadow-lg transition-colors",
                            selected
                              ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "border-white/65 bg-black/55 text-transparent",
                          )}
                        >
                          <Check size="0.9rem" />
                        </span>
                      ) : null}
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
                  );
                })}
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
          aria-label={localizeUi("ui.chat.chatgallery.galleryMediaType")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "images"}
            onClick={() => setActiveTab("images")}
            className={cn(
              "flex min-w-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
              activeTab === "images"
                ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <Image size="0.875rem" className="shrink-0" />
            <span className="truncate">{localizeUi("ui.panels.connectiondefaultssection.images")}</span>
            <span className="rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
              {imageCount}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "videos"}
            onClick={() => {
              leaveImageSelection();
              setActiveTab("videos");
            }}
            disabled={!sceneVideosEnabled}
            className={cn(
              "flex min-w-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
              !sceneVideosEnabled
                ? "cursor-not-allowed text-[var(--muted-foreground)] opacity-50"
                : activeTab === "videos"
                  ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <Film size="0.875rem" className="shrink-0" />
            <span className="truncate">{localizeUi("ui.panels.connectiondefaultssection.videos")}</span>
            <span className="rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
              {videoCount}
            </span>
          </button>
        </div>

        {!assetSearchActive && activeTab === "images" && (
          <>
            <ImageUploadDropzone
              label={localizeUi("ui.chat.chatgallery.uploadImages")}
              pending={upload.isPending}
              pendingLabel="Uploading…"
              dragLabel="Drop images to upload"
              onFilesSelected={handleUpload}
              icon={<ImagePlus size="1rem" />}
            />

            {/* Loading state */}
            {isLoading && (
              <p className="text-center text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.chatgallery.loadingGallery")}
              </p>
            )}

            {/* Empty state */}
            {!isLoading && !hasImages && (
              <div className="flex flex-col items-center gap-2 py-8 text-[var(--muted-foreground)]">
                <Sparkles size="1.5rem" className="opacity-40" />
                <p className="text-xs">{localizeUi("ui.chat.chatgallery.noImagesYet")}</p>
                <p className="text-[0.625rem] opacity-60">
                  {canIllustrate
                    ? localizeUi("ui.chat.chatgallery.uploadImagesOrGenerateIllustrationsToBuildYourGallery")
                    : localizeUi("ui.chat.chatgallery.uploadImagesToBuildYourGallery")}
                </p>
              </div>
            )}

            {/* Image grid */}
            {hasImages && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                {images!.map((img) => (
                  <div
                    key={img.id}
                    className={cn(
                      "mari-gallery-card group relative overflow-hidden rounded-lg bg-[var(--secondary)] transition-all hover:ring-[var(--primary)]/40 hover:shadow-lg focus-within:ring-2 focus-within:ring-[var(--primary)]",
                      selectedImageIds.has(img.id) ? "ring-2 ring-[var(--primary)]" : "ring-1 ring-transparent",
                    )}
                  >
                    {selectingImages ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border shadow-lg transition-colors",
                          selectedImageIds.has(img.id)
                            ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : "border-white/65 bg-black/55 text-transparent hover:bg-black/75",
                        )}
                      >
                        <Check size="0.9rem" />
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => (selectingImages ? toggleImageSelection(img.id) : setLightbox(img))}
                      className="block w-full"
                      aria-pressed={selectingImages ? selectedImageIds.has(img.id) : undefined}
                      aria-label={
                        selectingImages
                          ? localizeUi("ui.gallery.batch.toggleImageNamed", {
                              name: img.prompt || localizeUi("ui.chat.pinnedmediaviewer.galleryImage"),
                            })
                          : localizeUi("ui.chat.chatgallery.openGalleryImage")
                      }
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
                    {!selectingImages && (
                      <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
                        <div className="flex w-full items-center justify-between p-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handlePinImage(img)}
                              aria-label={localizeUi("ui.chat.chatgallery.pinImageToChat")}
                              className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                              title={localizeUi("ui.chat.chatgallery.pinToChat")}
                            >
                              <Pin size="0.75rem" />
                            </button>
                            <a
                              href={img.url}
                              download={getChatImageDownloadName(img)}
                              aria-label={localizeUi("ui.chat.chatgallery.downloadGalleryImage")}
                              className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                              title={localizeUi("ui.chat.chatgallery.downloadImage")}
                            >
                              <Download size="0.75rem" />
                            </a>
                            {sceneVideosEnabled && onAnimateImage && (
                              <button
                                type="button"
                                onClick={() => void handleAnimateImage(img)}
                                disabled={isGeneratingVideo}
                                aria-label={localizeUi("ui.chat.chatgallery.animateGalleryIllustration")}
                                className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30 disabled:cursor-wait disabled:opacity-60"
                                title={localizeUi("ui.chat.chatgallery.animateIllustration")}
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
                              aria-label={localizeUi("ui.chat.chatgallery.copyImagePrompt")}
                              className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-45"
                              title={
                                img.prompt.trim()
                                  ? localizeUi("ui.chat.chatgallery.copyPrompt")
                                  : localizeUi("ui.chat.chatgallery.noPromptSaved")
                              }
                            >
                              {copiedPromptImageId === img.id ? <Check size="0.75rem" /> : <Copy size="0.75rem" />}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(img.id)}
                            aria-label={localizeUi("ui.chat.chatgallery.deleteGalleryImage")}
                            className="mari-chrome-accent-surface mari-accent-animated pointer-events-auto rounded-md border p-1.5 transition-colors"
                          >
                            <Trash2 size="0.75rem" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!assetSearchActive && sceneVideosEnabled && activeTab === "videos" && (
          <>
            {sceneVideosQuery.isLoading && sceneVideosEnabled && (
              <p className="text-center text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.chatgallery.loadingSceneVideos")}
              </p>
            )}

            {!sceneVideosQuery.isLoading && !hasVideos && (
              <div className="flex flex-col items-center gap-2 py-8 text-[var(--muted-foreground)]">
                <Film size="1.5rem" className="opacity-40" />
                <p className="text-xs">{localizeUi("ui.chat.chatgallery.noVideosYet")}</p>
                <p className="text-[0.625rem] opacity-60">
                  {onGenerateVideo || onAnimateImage
                    ? localizeUi("ui.chat.chatgallery.generateOrAnimateSceneVideosToFillThisTab")
                    : localizeUi("ui.chat.chatgallery.generatedSceneVideosWillAppearHere")}
                </p>
              </div>
            )}

            {hasVideos && (
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase text-[var(--muted-foreground)]">
                  <Film size="0.75rem" />
                  {localizeUi("ui.chat.chatgallery.sceneVideos")}
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
                        aria-label={localizeUi("ui.chat.chatgallery.openSceneVideo")}
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
                              {video.durationSeconds}
                              {localizeUi("ui.chat.chatgallery.sSceneVideo")}
                            </div>
                            <div className="truncate text-[0.625rem] text-white/70">{video.model}</div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => handlePinVideo(video)}
                              aria-label={localizeUi("ui.chat.chatgallery.pinVideoToChat")}
                              className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                              title={localizeUi("ui.chat.chatgallery.pinToChat")}
                            >
                              <Pin size="0.75rem" />
                            </button>
                            <a
                              href={video.url}
                              download={getSceneVideoDownloadName(video)}
                              aria-label={localizeUi("ui.chat.chatgallery.downloadSceneVideo")}
                              className="pointer-events-auto rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                              title={localizeUi("ui.chat.chatgallery.downloadVideo")}
                            >
                              <Download size="0.75rem" />
                            </a>
                            <button
                              type="button"
                              onClick={() => void handleDeleteVideo(video)}
                              disabled={deleteVideo.isPending}
                              aria-label={localizeUi("ui.chat.chatgallery.deleteSceneVideo")}
                              className="mari-chrome-accent-surface mari-accent-animated pointer-events-auto rounded-md border p-1.5 transition-colors disabled:cursor-wait disabled:opacity-60"
                              title={localizeUi("ui.chat.chatgallery.deleteSceneVideo")}
                            >
                              {deletingVideoId === video.id ? (
                                <Loader2 size="0.75rem" className="animate-spin" />
                              ) : (
                                <Trash2 size="0.75rem" />
                              )}
                            </button>
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
              <p className="mb-4 text-sm font-medium">{localizeUi("ui.chat.chatgallery.deleteThisImage")}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 rounded-lg bg-[var(--secondary)] px-4 py-2 text-xs transition-colors hover:bg-[var(--accent)]"
                >
                  {localizeUi("chat.delete.dialog.cancel")}
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  className="mari-chrome-accent-surface mari-accent-animated flex-1 rounded-lg border px-4 py-2 text-xs transition-colors"
                >
                  {localizeUi("lorebook.editor.batch.delete")}
                </button>
              </div>
            </div>
          </div>,
          portalRoot,
        )}

      {/* Lightbox */}
      {lightbox && <ChatImageLightbox image={lightbox} onPin={handlePinImage} onClose={() => setLightbox(null)} />}
      {sceneVideosEnabled && videoLightbox && (
        <ChatVideoLightbox video={videoLightbox} onPin={handlePinVideo} onClose={() => setVideoLightbox(null)} />
      )}
    </>
  );
}
