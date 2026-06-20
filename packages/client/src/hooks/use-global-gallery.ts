// ──────────────────────────────────────────────
// React Query: Global Gallery images + flat folders
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { CustomKind, CustomTagPatch } from "../lib/custom-emoji";

export interface GlobalGalleryImage {
  id: string;
  folderId: string | null;
  filePath: string;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  customKind: CustomKind | null;
  customName: string | null;
  createdAt: string;
  url: string;
}

export interface GalleryFolder {
  id: string;
  name: string;
  createdAt: string;
}

export const globalGalleryKeys = {
  all: ["global-gallery"] as const,
  images: ["global-gallery", "images"] as const,
  folders: ["global-gallery", "folders"] as const,
};

// ── Images ──

export function useGlobalGalleryImages() {
  return useQuery({
    queryKey: globalGalleryKeys.images,
    queryFn: () => api.get<GlobalGalleryImage[]>("/global-gallery"),
    staleTime: 5 * 60_000,
  });
}

export function useUploadGlobalGalleryImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ files, folderId }: { files: File[]; folderId?: string | null }) => {
      const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
      const uploads = await Promise.allSettled(
        files.map((file) => {
          const formData = new FormData();
          formData.append("file", file);
          return api.upload<GlobalGalleryImage>(`/global-gallery/upload${query}`, formData);
        }),
      );

      const successful = uploads.filter(
        (result): result is PromiseFulfilledResult<GlobalGalleryImage> => result.status === "fulfilled",
      );

      if (successful.length !== uploads.length) {
        const failedCount = uploads.length - successful.length;
        throw new Error(
          failedCount === 1 ? "One gallery image failed to upload." : `${failedCount} gallery images failed to upload.`,
        );
      }

      return successful.map((result) => result.value);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: globalGalleryKeys.images });
    },
  });
}

export function useDeleteGlobalGalleryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => api.delete(`/global-gallery/${imageId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: globalGalleryKeys.images });
    },
  });
}

export function useMoveGlobalGalleryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      api.patch<GlobalGalleryImage>(`/global-gallery/${id}`, { folderId }),
    // Optimistic: reflect the move immediately, roll back on error.
    onMutate: async ({ id, folderId }) => {
      await qc.cancelQueries({ queryKey: globalGalleryKeys.images });
      const previous = qc.getQueryData<GlobalGalleryImage[]>(globalGalleryKeys.images);
      qc.setQueryData<GlobalGalleryImage[]>(globalGalleryKeys.images, (old) =>
        old?.map((img) => (img.id === id ? { ...img, folderId } : img)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(globalGalleryKeys.images, context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: globalGalleryKeys.images });
    },
  });
}

export function useTagGlobalGalleryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imageId, patch }: { imageId: string; patch: CustomTagPatch }) =>
      api.patch<GlobalGalleryImage>(`/global-gallery/${imageId}/tag`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: globalGalleryKeys.images });
    },
  });
}

// ── Folders (flat) ──

export function useGalleryFolders() {
  return useQuery({
    queryKey: globalGalleryKeys.folders,
    queryFn: () => api.get<GalleryFolder[]>("/global-gallery/folders"),
    staleTime: 5 * 60_000,
  });
}

export function useCreateGalleryFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<GalleryFolder>("/global-gallery/folders", { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: globalGalleryKeys.folders });
    },
  });
}

export function useRenameGalleryFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<GalleryFolder>(`/global-gallery/folders/${id}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: globalGalleryKeys.folders });
    },
  });
}

export function useDeleteGalleryFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/global-gallery/folders/${id}`),
    onSuccess: () => {
      // Folder delete re-files its images to root, so refresh both.
      qc.invalidateQueries({ queryKey: globalGalleryKeys.folders });
      qc.invalidateQueries({ queryKey: globalGalleryKeys.images });
    },
  });
}
