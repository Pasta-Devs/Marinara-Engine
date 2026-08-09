// ──────────────────────────────────────────────
// Hook: One-time post-migration storage notice (#4756)
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  STORAGE_MIGRATION_NOTICE_SETTINGS_KEY,
  storageMigrationNoticeSchema,
  type AppSettingsResponse,
  type StorageMigrationNotice,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";

export const storageMigrationNoticeKeys = {
  notice: ["app-settings", STORAGE_MIGRATION_NOTICE_SETTINGS_KEY] as const,
};

function parseNoticeValue(value: string | null): StorageMigrationNotice | null {
  if (!value) return null;
  try {
    const parsed = storageMigrationNoticeSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The pending post-migration notice, or null when none is waiting. */
export function useStorageMigrationNotice() {
  return useQuery({
    queryKey: storageMigrationNoticeKeys.notice,
    queryFn: async () => {
      const result = await api.get<AppSettingsResponse>(`/app-settings/${STORAGE_MIGRATION_NOTICE_SETTINGS_KEY}`);
      return parseNoticeValue(result.value);
    },
    staleTime: Infinity,
    retry: 1,
  });
}

/** Clears the notice so it never shows again (until a future format bump). */
export function useAcknowledgeStorageMigrationNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.put(`/app-settings/${STORAGE_MIGRATION_NOTICE_SETTINGS_KEY}`, { value: "" });
    },
    // Dismissal must be authoritative CLIENT-side (the WhatsNew rule): clear
    // the cache before the request, or the modal's auto-open effect re-fires
    // while the PUT is in flight — and forever if it fails. The server
    // acknowledge is best-effort; on failure the durable marker simply
    // re-shows the notice on the next launch.
    onMutate: () => {
      qc.setQueryData(storageMigrationNoticeKeys.notice, null);
    },
    onError: (error) => {
      console.warn("Failed to acknowledge the storage migration notice; it will reappear next launch.", error);
    },
  });
}
