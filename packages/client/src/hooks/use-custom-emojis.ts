// ──────────────────────────────────────────────
// Hooks: Custom Emojis (global pool, managed in the emoji picker)
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export interface CustomEmoji {
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

const customEmojiKeys = {
  all: ["custom-emojis"] as const,
};

export function useCustomEmojis() {
  return useQuery({
    queryKey: customEmojiKeys.all,
    queryFn: () => api.get<CustomEmoji[]>("/custom-emojis"),
    staleTime: 5 * 60_000,
  });
}

export function useUploadCustomEmoji() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, name, width, height }: { file: File; name: string; width?: number; height?: number }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      if (width != null) formData.append("width", String(width));
      if (height != null) formData.append("height", String(height));
      return api.upload<CustomEmoji>("/custom-emojis/upload", formData);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.all }),
  });
}

export function useRenameCustomEmoji() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<CustomEmoji>(`/custom-emojis/${id}`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.all }),
  });
}

export function useDeleteCustomEmoji() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/custom-emojis/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.all }),
  });
}

export function useImportCustomEmojis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bundle: unknown) =>
      api.post<{ imported: number; skipped: number }>("/custom-emojis/import", bundle),
    onSuccess: () => qc.invalidateQueries({ queryKey: customEmojiKeys.all }),
  });
}
