// ──────────────────────────────────────────────
// Hooks: Custom Stickers (global pool, managed in the sticker selector)
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export interface CustomSticker {
  id: string;
  name: string;
  filePath: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
  /** Served image URL (computed by the route). */
  url: string;
}

const customStickerKeys = {
  all: ["custom-stickers"] as const,
};

export function useCustomStickers() {
  return useQuery({
    queryKey: customStickerKeys.all,
    queryFn: () => api.get<CustomSticker[]>("/custom-stickers"),
    staleTime: 5 * 60_000,
  });
}

export function useUploadCustomSticker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, name, width, height }: { file: File; name: string; width?: number; height?: number }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      if (width != null) formData.append("width", String(width));
      if (height != null) formData.append("height", String(height));
      return api.upload<CustomSticker>("/custom-stickers/upload", formData);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customStickerKeys.all }),
  });
}

export function useRenameCustomSticker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<CustomSticker>(`/custom-stickers/${id}`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: customStickerKeys.all }),
  });
}

export function useDeleteCustomSticker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/custom-stickers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: customStickerKeys.all }),
  });
}

export function useImportCustomStickers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bundle: unknown) =>
      api.post<{ imported: number; skipped: number }>("/custom-stickers/import", bundle),
    onSuccess: () => qc.invalidateQueries({ queryKey: customStickerKeys.all }),
  });
}
