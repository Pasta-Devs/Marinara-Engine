import { groupChatImageVariants, type ChatImageVersion } from "@marinara-engine/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useCardGallerySelection<Image extends Omit<ChatImageVersion, "chatId">>(
  images: readonly Image[] | undefined,
) {
  const stacks = useMemo(() => groupChatImageVariants((images ?? []).map((row) => ({ ...row, chatId: "" }))), [images]);
  const displayedImages = useMemo(() => stacks.map((stack) => stack.selected), [stacks]);
  const versionCounts = useMemo(
    () => new Map(stacks.map((stack) => [stack.selected.id, stack.versions.length])),
    [stacks],
  );
  const [lightbox, setLightbox] = useState<Image | null>(null);
  const [selectingImages, setSelectingImages] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(() => new Set());
  const selectedImages = useMemo(
    () => displayedImages.filter((image) => selectedImageIds.has(image.id)),
    [displayedImages, selectedImageIds],
  );

  useEffect(() => {
    const availableIds = new Set(displayedImages.map((image) => image.id));
    setSelectedImageIds((current) => {
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [displayedImages]);

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

  return {
    displayedImages,
    versionCounts,
    lightbox,
    setLightbox,
    selectingImages,
    setSelectingImages,
    selectedImageIds,
    setSelectedImageIds,
    selectedImages,
    leaveImageSelection,
    toggleImageSelection,
  };
}
