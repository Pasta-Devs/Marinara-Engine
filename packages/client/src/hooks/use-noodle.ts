// ──────────────────────────────────────────────
// React Query: Noodle hooks
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";
import type {
  NoodleAccount,
  NoodleAccountFollowUpdateInput,
  NoodleAccountKind,
  NoodleAccountProfileUpdateInput,
  NoodleAccountSettingsPatchInput,
  NoodleAccountUpdateInput,
  NoodleBootstrap,
  NoodleCreateInteractionInput,
  NoodleCreatePostInput,
  NoodleInteraction,
  NoodleInteractionUpdateInput,
  NoodlePost,
  NoodlePostUpdateInput,
  NoodleRemoveInteractionInput,
  NoodleRescheduleRefreshInput,
  NoodleRefreshSchedulerStatus,
  NoodleSettings,
  NoodleSettingsUpdateInput,
} from "@marinara-engine/shared";
import { mergeNoodlePollVoteInteractions } from "@marinara-engine/shared";
import type { ImagePromptOverride, ImagePromptReviewItem } from "../components/ui/ImagePromptReviewModal";

export type NoodleRefreshResult = {
  bootstrap: NoodleBootstrap;
  imagePromptReviewItems: ImagePromptReviewItem[];
};

export const noodleKeys = {
  all: ["noodle"] as const,
  bootstrap: () => [...noodleKeys.all, "bootstrap"] as const,
};

function preservePollVotes(current: NoodleBootstrap | undefined, next: NoodleBootstrap): NoodleBootstrap {
  if (!current) return next;
  const interactions = mergeNoodlePollVoteInteractions(current.interactions, next.posts, next.interactions);
  return interactions === next.interactions ? next : { ...next, interactions };
}

export function useNoodle(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.bootstrap(),
    queryFn: () => api.get<NoodleBootstrap>("/noodle"),
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
    structuralSharing: (current, next) =>
      preservePollVotes(current as NoodleBootstrap | undefined, next as NoodleBootstrap),
  });
}

export function useUpdateNoodleSettings() {
  const qc = useQueryClient();
  return useMutation({
    scope: { id: "noodle-settings" },
    mutationFn: (settings: NoodleSettingsUpdateInput) => api.put<NoodleSettings>("/noodle/settings", settings),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: noodleKeys.bootstrap() });
      const previous = qc.getQueryData<NoodleBootstrap>(noodleKeys.bootstrap());
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current
          ? {
              ...current,
              settings: { ...current.settings, ...patch } as NoodleSettings,
            }
          : current,
      );
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) qc.setQueryData(noodleKeys.bootstrap(), context.previous);
    },
    onSuccess: (settings) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current ? { ...current, settings } : current,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() }),
  });
}

export function useRescheduleNoodleRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoodleRescheduleRefreshInput) =>
      api.put<NoodleRefreshSchedulerStatus>("/noodle/refresh-schedule", input),
    onSuccess: (scheduler) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current ? { ...current, scheduler } : current,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() }),
  });
}

export function useUpdateNoodleAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & NoodleAccountUpdateInput) =>
      api.put<NoodleAccount>(`/noodle/accounts/${id}`, patch),
    onSuccess: (account) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current
          ? {
              ...current,
              accounts: current.accounts.map((item) => (item.id === account.id ? account : item)),
            }
          : current,
      );
      qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() });
    },
  });
}

export function useUpdateNoodleAccountProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & NoodleAccountProfileUpdateInput) =>
      api.put<NoodleAccount>(`/noodle/accounts/${id}/profile`, input),
    onSuccess: (account) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current
          ? { ...current, accounts: current.accounts.map((item) => (item.id === account.id ? account : item)) }
          : current,
      );
      qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() });
    },
  });
}

export function usePatchNoodleAccountSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & NoodleAccountSettingsPatchInput) =>
      api.patch<NoodleAccount>(`/noodle/accounts/${id}/settings`, input),
    onSuccess: (account) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current
          ? {
              ...current,
              accounts: current.accounts.map((item) => (item.id === account.id ? account : item)),
            }
          : current,
      );
      qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() });
    },
  });
}

export function useUpdateNoodleAccountFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetAccountId, ...input }: { id: string; targetAccountId: string } & NoodleAccountFollowUpdateInput) =>
      api.patch<NoodleAccount>(`/noodle/accounts/${id}/follows/${targetAccountId}`, input),
    onSuccess: (account) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current
          ? { ...current, accounts: current.accounts.map((item) => (item.id === account.id ? account : item)) }
          : current,
      );
      qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() });
    },
  });
}

export function useInviteNoodleCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (characterId: string) => api.post<NoodleAccount>("/noodle/invites", { characterId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() }),
  });
}

export function useInviteNoodleCharacters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (characterIds: string[]) => api.post<NoodleAccount[]>("/noodle/invites/bulk", { characterIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() }),
  });
}

export function useRemoveNoodleCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (characterId: string) =>
      api.delete<NoodleAccount>(`/noodle/invites/${encodeURIComponent(characterId)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() }),
  });
}

/** Clear every Noodle invitation source and refresh the bootstrap cache. */
export function useClearNoodleInvites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<NoodleBootstrap>("/noodle/invites"),
    onSuccess: (bootstrap) => {
      qc.setQueryData<NoodleBootstrap>(noodleKeys.bootstrap(), bootstrap);
      qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() });
    },
  });
}

export function useCreateNoodlePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoodleCreatePostInput) => api.post<NoodlePost>("/noodle/posts", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() }),
  });
}

export function useUpdateNoodlePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & NoodlePostUpdateInput) =>
      api.patch<NoodlePost>(`/noodle/posts/${encodeURIComponent(id)}`, input),
    onSuccess: (post) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current
          ? {
              ...current,
              posts: current.posts.map((item) => (item.id === post.id ? post : item)),
            }
          : current,
      );
      qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() });
    },
  });
}

export function useDeleteNoodlePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<NoodlePost>(`/noodle/posts/${encodeURIComponent(id)}`),
    onSuccess: (post) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current
          ? {
              ...current,
              posts: current.posts.filter((item) => item.id !== post.id),
              interactions: current.interactions.filter((interaction) => interaction.postId !== post.id),
              digests: current.digests.filter((digest) => digest.sourcePostId !== post.id),
            }
          : current,
      );
      qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() });
    },
  });
}

export function useResetNoodleTimeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<NoodleBootstrap>("/noodle/timeline"),
    onSuccess: (bootstrap) => qc.setQueryData(noodleKeys.bootstrap(), bootstrap),
    onSettled: () => qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() }),
  });
}

export function useCreateNoodleInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      ...input
    }: NoodleCreateInteractionInput & {
      postId: string;
      actorKind: NoodleAccountKind;
      actorEntityId: string;
    }) => api.post<NoodleInteraction>(`/noodle/posts/${postId}/interactions`, input),
    onSuccess: (interaction) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current
          ? {
              ...current,
              interactions: current.interactions.some((item) => item.id === interaction.id)
                ? current.interactions.map((item) => (item.id === interaction.id ? interaction : item))
                : [...current.interactions, interaction],
            }
          : current,
      );
    },
  });
}

export function useRemoveNoodleInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      ...input
    }: NoodleRemoveInteractionInput & {
      postId: string;
      actorKind: NoodleAccountKind;
      actorEntityId: string;
    }) => {
      const params = new URLSearchParams({
        actorKind: input.actorKind,
        actorEntityId: input.actorEntityId,
        type: input.type,
      });
      if (input.parentInteractionId) params.set("parentInteractionId", input.parentInteractionId);
      return api.delete<NoodleInteraction>(`/noodle/posts/${encodeURIComponent(postId)}/interactions?${params}`);
    },
    onSuccess: (interaction) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current
          ? {
              ...current,
              interactions: current.interactions.filter((item) => item.id !== interaction.id),
            }
          : current,
      );
    },
  });
}

export function useUpdateNoodleInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      interactionId,
      ...input
    }: NoodleInteractionUpdateInput & { postId: string; interactionId: string }) =>
      api.patch<NoodleInteraction>(
        `/noodle/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}`,
        input,
      ),
    onSuccess: (interaction) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current
          ? {
              ...current,
              interactions: current.interactions.map((item) => (item.id === interaction.id ? interaction : item)),
            }
          : current,
      );
    },
  });
}

export function useDeleteNoodleInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, interactionId, personaId }: { postId: string; interactionId: string; personaId: string }) =>
      api.delete<NoodleInteraction[]>(
        `/noodle/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}?personaId=${encodeURIComponent(personaId)}`,
      ),
    onSuccess: (interactions) => {
      const deletedIds = new Set(interactions.map((interaction) => interaction.id));
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        current
          ? {
              ...current,
              interactions: current.interactions.filter((item) => !deletedIds.has(item.id)),
            }
          : current,
      );
    },
  });
}

export function useRefreshNoodle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId?: string; connectionId?: string }) =>
      api.post<NoodleRefreshResult>("/noodle/refresh", {
        ...input,
        debugMode: useUIStore.getState().debugMode,
        reviewImagePromptsBeforeSend: useUIStore.getState().reviewImagePromptsBeforeSend,
      }),
    onSuccess: (result) =>
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        preservePollVotes(current, result.bootstrap),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() }),
  });
}

export function useConfirmNoodleImagePrompts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prompts: ImagePromptOverride[]) =>
      api.post<NoodleBootstrap>("/noodle/refresh/images", {
        prompts,
        debugMode: useUIStore.getState().debugMode,
      }),
    onSuccess: (bootstrap) =>
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) =>
        preservePollVotes(current, bootstrap),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() }),
  });
}
