// ──────────────────────────────────────────────
// Hooks: avatar models of the 2D and 3D avatar agents (React Query)
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AVATAR_API_PREFIXES,
  avatarModelPath,
  type AvatarConfig,
  type AvatarConfigUpdate,
  type AvatarImportResult,
  type AvatarKind,
  type AvatarOwnerRef,
  type AvatarOwnerSummary,
} from "@marinara-engine/shared";
import { avatarModelKeys } from "../features/avatars/contract";
import { ApiError, api } from "../lib/api-client";

/** Who has an avatar (without the per-kind data). */
export function useAvatarModelList(enabled = true) {
  return useQuery({
    queryKey: avatarModelKeys.list(),
    queryFn: () => api.get<AvatarOwnerSummary[]>(AVATAR_API_PREFIXES.models),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** One owner's avatar.json, or null when the owner has none. The server answers null for an owner without an
 *  avatar and 404 only for an owner that no longer exists, which has no avatar either. */
export function fetchAvatarModel(owner: AvatarOwnerRef): Promise<AvatarConfig | null> {
  return api.get<AvatarConfig | null>(avatarModelPath(owner)).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
}

/** One owner's avatar.json, or null when the owner has none (see fetchAvatarModel). */
export function useAvatarModel(owner: AvatarOwnerRef | null) {
  return useQuery({
    queryKey: owner ? avatarModelKeys.detail(owner) : [...avatarModelKeys.all, "none"],
    queryFn: () => fetchAvatarModel(owner!),
    enabled: owner !== null,
    staleTime: 5 * 60_000,
  });
}

/** After any change to an owner's avatar (a save, import, removal or kept generation result): shows the
 *  returned avatar.json at once, then refreshes every avatar query. */
export function useAvatarModelChanged(owner: AvatarOwnerRef, onChanged?: () => void) {
  const qc = useQueryClient();
  return (config: AvatarConfig | null) => {
    qc.setQueryData(avatarModelKeys.detail(owner), config);
    onChanged?.();
    return qc.invalidateQueries({ queryKey: avatarModelKeys.all });
  };
}

interface AvatarModelActionFeedback<TResult, TVariables> {
  onSuccess?: (result: TResult, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
}

/** Saving, importing and removing an owner's avatar, for the owner-wide settings and every kind's panel.
 *  `feedback` runs even when the panel closes before the request ends (callbacks given to mutate() do not). */
export function useAvatarModelActions(
  owner: AvatarOwnerRef,
  onChanged?: () => void,
  feedback: {
    save?: AvatarModelActionFeedback<AvatarConfig, AvatarConfigUpdate>;
    importFile?: AvatarModelActionFeedback<AvatarImportResult, { kind: AvatarKind; file: File }>;
    remove?: AvatarModelActionFeedback<AvatarConfig | null, AvatarKind>;
  } = {},
) {
  const changed = useAvatarModelChanged(owner, onChanged);
  const save = useMutation({
    mutationFn: (update: AvatarConfigUpdate) => api.put<AvatarConfig>(avatarModelPath(owner), update),
    onSuccess: (config, update) => {
      void changed(config);
      feedback.save?.onSuccess?.(config, update);
    },
    onError: (error, update) => feedback.save?.onError?.(error, update),
  });
  const importFile = useMutation({
    mutationFn: ({ kind, file }: { kind: AvatarKind; file: File }) => {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file, file.name);
      return api.upload<AvatarImportResult>(`${avatarModelPath(owner)}/import`, form);
    },
    onSuccess: (result, request) => {
      void changed(result.config);
      feedback.importFile?.onSuccess?.(result, request);
    },
    onError: (error, request) => feedback.importFile?.onError?.(error, request),
  });
  const remove = useMutation({
    mutationFn: (kind: AvatarKind) => api.delete<AvatarConfig | null>(`${avatarModelPath(owner)}/kinds/${kind}`),
    onSuccess: (config, kind) => {
      void changed(config);
      feedback.remove?.onSuccess?.(config, kind);
    },
    onError: (error, kind) => feedback.remove?.onError?.(error, kind),
  });
  return { save, importFile, remove };
}
