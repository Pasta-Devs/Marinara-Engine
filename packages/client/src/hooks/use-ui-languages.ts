import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

const UI_LANGUAGES_KEY = ["ui-languages"] as const;

export function useUILanguages() {
  return useQuery({
    queryKey: UI_LANGUAGES_KEY,
    queryFn: () => api.get<{ installed: string[] }>("/ui-languages"),
    staleTime: 30_000,
  });
}

export function useDownloadUILanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (language: string) => api.post(`/ui-languages/${encodeURIComponent(language)}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: UI_LANGUAGES_KEY }),
  });
}
