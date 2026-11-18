// ──────────────────────────────────────────────
// React Query: the avatar agents' local emotion model (lane: director)
// ──────────────────────────────────────────────
// The server downloads the model when a Roleplay chat with 2D or 3D Avatars on opens, or when Download is pressed on
// the Built-in model (emotions) page; the agents' pages follow it.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AVATAR_API_PREFIXES } from "@marinara-engine/shared";
import { api } from "../lib/api-client";

/** GET /api/avatar-classify/model (services/avatars/emotion-classifier.ts avatarEmotionModelStatus). */
export interface AvatarEmotionModelStatus {
  /** Why this server keeps the word list (Lite, no ONNX runtime, too little memory), or null. */
  unsupported: "lite" | "no-runtime" | "low-memory" | null;
  state: "not-downloaded" | "downloading" | "loading" | "downloaded" | "failed";
  downloadedBytes: number;
  totalBytes: number;
}

export const avatarEmotionModelKeys = {
  status: ["avatar-emotion-model", "status"] as const,
};

/** Polls every 2 s while the model downloads or loads, and every 30 s otherwise (a chat may start the download). */
export function useAvatarEmotionModelStatus() {
  return useQuery({
    queryKey: avatarEmotionModelKeys.status,
    queryFn: () => api.get<AvatarEmotionModelStatus>(`${AVATAR_API_PREFIXES.classify}/model`),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "downloading" || state === "loading" ? 2_000 : 30_000;
    },
    staleTime: 2_000,
  });
}

/** The Built-in model (emotions) page's Download and Remove files (privileged on the server). */
function useEmotionModelAction(path: "download" | "remove") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<AvatarEmotionModelStatus>(`${AVATAR_API_PREFIXES.classify}/model/${path}`, {}),
    onSuccess: (status) => qc.setQueryData(avatarEmotionModelKeys.status, status),
    onSettled: () => void qc.invalidateQueries({ queryKey: avatarEmotionModelKeys.status }),
  });
}
export const useDownloadAvatarEmotionModel = () => useEmotionModelAction("download");
export const useRemoveAvatarEmotionModel = () => useEmotionModelAction("remove");
