// ──────────────────────────────────────────────
// Engine-wide Image reading prompt, request and limits (server app setting)
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IMAGE_READING_SETTINGS_KEY, type ImageReadingSettings } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { translate } from "../localization/i18n";

const PATH = `/app-settings/${IMAGE_READING_SETTINGS_KEY}`;
const KEY = ["app-settings", IMAGE_READING_SETTINGS_KEY] as const;

export function useImageReadingSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<ImageReadingSettings>(PATH),
    staleTime: 30_000,
  });
}

/** Sends only the changed fields; null puts a field back to the built-in value. */
export function useSetImageReadingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ImageReadingSettings>) => api.put<ImageReadingSettings>(PATH, input),
    onSuccess: (saved) => {
      qc.setQueryData(KEY, saved);
      // Refetch too, so a read that started before the save can't put the old values back.
      return qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : translate("connections.defaults.saveFailed")),
  });
}
