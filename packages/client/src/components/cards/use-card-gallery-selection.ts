import { useCallback, useEffect, useMemo, useState } from "react";

export function useCardGallerySelection<Image extends { id: string }>(images: readonly Image[] | undefined) {
  const [lightbox, setLightbox] = useState<Image | null>(null);
  const [selectingImages, setSelectingImages] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(() => new Set());
  const selectedImages = useMemo(
    () => images?.filter((image) => selectedImageIds.has(image.id)) ?? [],
    [images, selectedImageIds],
  );

  useEffect(() => {
    const availableIds = new Set(images?.map((image) => image.id) ?? []);
    setSelectedImageIds((current) => {
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [images]);

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
