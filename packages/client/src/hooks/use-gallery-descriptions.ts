// ──────────────────────────────────────────────
// Hook: save a gallery picture's description, then refresh the gallery.
// ──────────────────────────────────────────────
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { saveGalleryDescription, type GalleryDescriptionTarget } from "../lib/gallery-descriptions";

export function useSaveGalleryDescription(target: GalleryDescriptionTarget, queryKey: QueryKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      imageId,
      description,
      ownerId,
    }: {
      imageId: string;
      description: string | null;
      /** The picture's own owner, when the gallery shows pictures of more than one (Game mode's chat gallery). */
      ownerId?: string;
    }) => saveGalleryDescription(ownerId ? { ...target, ownerId } : target, imageId, description),
    onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });
}
