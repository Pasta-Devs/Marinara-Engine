// ──────────────────────────────────────────────
// React Query: Noodle hooks
// ──────────────────────────────────────────────
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { api } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";
import type {
  NoodleAccount,
  NoodleAmbientProfileRerollInput,
  NoodleAmbientProfileRerollOutcome,
  NoodleAccountFollowUpdateInput,
  NoodleAccountKind,
  NoodleAccountProfileUpdateInput,
  NoodleAccountSettingsPatchInput,
  NoodleBootstrap,
  NoodleBulkNoodlerAccountCreateInput,
  NoodleCreateInteractionInput,
  NoodleCreatePostInput,
  NoodleInteraction,
  NoodleInteractionUpdateInput,
  NoodlePost,
  NoodlePostImageCrop,
  NoodlePostUpdateInput,
  NoodlerPostCreateInput,
  NoodlerPostUpdateInput,
  NoodleRemoveInteractionInput,
  NoodleRescheduleRefreshInput,
  NoodleRefreshSchedulerStatus,
  NoodleSettings,
  NoodleSettingsUpdateInput,
  NoodleStageProfileInput,
  NoodlerGenerationRequest,
  NoodleStageProfileDraftRequest,
  NoodlerManagedPost,
  NoodlerRefreshNowOutcome,
  NoodlerStageProfile,
  NoodlerManagedStageProfile,
  NoodlerSubscriber,
  NoodlerViewerScope,
  NoodlerCreateInteractionInput,
  NoodlerCreatorReplyResult,
  NoodlerReserveStatus,
  NoodlerRemoveInteractionInput,
} from "@marinara-engine/shared";
import { countNoodlePostsSince, countNoodlerPostsSince, mergeNoodlePollVoteInteractions } from "@marinara-engine/shared";
import type { ImagePromptOverride, ImagePromptReviewItem } from "../components/ui/ImagePromptReviewModal";

export type NoodleRefreshResult = {
  bootstrap: NoodleBootstrap;
  imagePromptReviewItems: ImagePromptReviewItem[];
};

export const noodleKeys = {
  all: ["noodle"] as const,
  bootstrap: () => [...noodleKeys.all, "bootstrap"] as const,
  noodlerRoot: () => [...noodleKeys.all, "noodler"] as const,
  noodlerAccounts: () => [...noodleKeys.noodlerRoot(), "accounts"] as const,
  noodlerEligibleAccountsRoot: () => [...noodleKeys.noodlerRoot(), "eligible"] as const,
  noodlerEligibleAccounts: (search: string, kind: string) =>
    [...noodleKeys.noodlerEligibleAccountsRoot(), search, kind] as const,
  noodlerPosts: (accountId: string) => [...noodleKeys.noodlerRoot(), "posts", accountId] as const,
  noodlerSubscribers: (accountId: string) => [...noodleKeys.noodlerRoot(), "subscribers", accountId] as const,
  noodlerViewers: () => [...noodleKeys.noodlerRoot(), "viewers"] as const,
  viewer: (personaId: string) => [...noodleKeys.noodlerViewers(), personaId] as const,
  noodlerReserveStatus: () => [...noodleKeys.noodlerRoot(), "reserve-status"] as const,
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

export function useRerollAmbientNoodleProfiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoodleAmbientProfileRerollInput) =>
      api.post<{
        accounts: NoodleAccount[];
        outcomes: NoodleAmbientProfileRerollOutcome[];
      }>("/noodle/ambient-profiles/reroll", input),
    onSuccess: ({ accounts }) => {
      qc.setQueryData<NoodleBootstrap | undefined>(noodleKeys.bootstrap(), (current) => {
        if (!current) return current;
        const updatedById = new Map(accounts.map((account) => [account.id, account]));
        return {
          ...current,
          accounts: current.accounts.map((account) => updatedById.get(account.id) ?? account),
        };
      });
      return qc.invalidateQueries({ queryKey: noodleKeys.bootstrap() });
    },
  });
}

export function useNoodlerAccounts(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerAccounts(),
    queryFn: () => api.get<NoodlerManagedStageProfile[]>("/noodle/noodler/accounts"),
    enabled,
    staleTime: 10_000,
    // Autonomous reserve work changes operator state without a client mutation.
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useNoodlerEligibleAccounts(search: string, kind: "all" | "character" | "persona", enabled = true) {
  const normalizedSearch = search.trim();
  return useInfiniteQuery({
    queryKey: noodleKeys.noodlerEligibleAccounts(normalizedSearch, kind),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get<{ items: NoodleAccount[]; limit: number; offset: number; hasMore: boolean }>(
        `/noodle/noodler/eligible-accounts?limit=100&offset=${pageParam}&search=${encodeURIComponent(normalizedSearch)}${kind === "all" ? "" : `&kind=${kind}`}`,
      ),
    getNextPageParam: (page) => (page.hasMore ? page.offset + page.items.length : undefined),
    enabled,
    staleTime: 10_000,
  });
}

export function useNoodlerPosts(accountId: string | null) {
  return useQuery({
    queryKey: noodleKeys.noodlerPosts(accountId ?? "none"),
    queryFn: () => api.get<NoodlerManagedPost[]>(`/noodle/noodler/accounts/${encodeURIComponent(accountId!)}/posts`),
    enabled: Boolean(accountId),
    staleTime: 10_000,
    // Automatic posts are written server-side without a client mutation; poll while visible.
    refetchInterval: accountId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useNoodlerSubscribers(accountId: string | null) {
  return useQuery({
    queryKey: noodleKeys.noodlerSubscribers(accountId ?? "none"),
    queryFn: () =>
      api.get<NoodlerSubscriber[]>(`/noodle/noodler/accounts/${encodeURIComponent(accountId!)}/subscribers`),
    enabled: Boolean(accountId),
    staleTime: 10_000,
  });
}

export function useCreateNoodlerStageProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      noodleAccountId,
      stageProfile,
    }: {
      noodleAccountId: string;
      stageProfile: NoodleStageProfileInput;
    }) =>
      api.post<NoodlerStageProfile>(`/noodle/accounts/${encodeURIComponent(noodleAccountId)}/noodler`, {
        stageProfile,
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerEligibleAccountsRoot() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useBulkCreateNoodlerStageProfiles() {
  const qc = useQueryClient();
  const { t: localizeUi } = useUiTranslation();
  return useMutation({
    mutationFn: (input: NoodleBulkNoodlerAccountCreateInput) =>
      api.post<{ created: NoodlerManagedStageProfile[]; skipped: string[]; failed?: string[] }>(
        "/noodle/noodler/accounts/bulk",
        input,
      ),
    onSuccess: (result) => {
      const failed = result.failed?.length ?? 0;
      const counts = { value1: result.created.length, value2: result.skipped.length, value3: failed };
      if (failed) {
        toast.error(localizeUi("ui.noodle.noodlerbulkcreatepanel.createdValue1SkippedValue2FailedValue3", counts));
      } else {
        toast.success(localizeUi("ui.noodle.noodlerbulkcreatepanel.createdValue1SkippedValue2", counts));
      }
      return Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerEligibleAccountsRoot() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]);
    },
  });
}

export function useUpdateNoodlerStageProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, ...input }: { accountId: string } & NoodleStageProfileInput) =>
      api.put<NoodlerStageProfile>(`/noodle/noodler/accounts/${encodeURIComponent(accountId)}/stage-profile`, input),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useDeleteNoodlerStageProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.delete<NoodleAccount>(`/noodle/noodler/accounts/${encodeURIComponent(accountId)}`),
    onSuccess: (_account, accountId) => {
      qc.removeQueries({ queryKey: noodleKeys.noodlerPosts(accountId) });
      return Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerEligibleAccountsRoot() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]);
    },
  });
}

export function useGenerateNoodlerStageProfileDraft() {
  return useMutation({
    mutationFn: (input: NoodleStageProfileDraftRequest) => {
      const controller = new AbortController();
      // ponytail: fixed 60s ceiling, no per-provider tuning — raise if real drafts routinely take longer
      const timer = setTimeout(() => controller.abort(), 60_000);
      return api
        .post<NoodleStageProfileInput>("/noodle/noodler/stage-profile-draft", input, {
          signal: controller.signal,
        })
        .finally(() => clearTimeout(timer));
    },
  });
}

export type GeneratedNoodlerNoodlePost = NoodlerManagedPost & {
  imagePromptReview?: ImagePromptReviewItem;
};

export type NoodlerPostDraftImage = {
  source: File | string;
  crop: NoodlePostImageCrop | null;
};

type NoodlerCreatePostRequest = Omit<NoodlerPostCreateInput, "uploadedImageUrl" | "imageCrop"> & {
  image?: NoodlerPostDraftImage | null;
};

type NoodlerGeneratePostRequest = Omit<NoodlerGenerationRequest, "uploadedImageUrl" | "imageCrop"> & {
  image?: NoodlerPostDraftImage | null;
};

function postNoodlerRequestWithImage<T>(
  path: string,
  input: Record<string, unknown>,
  image?: NoodlerPostDraftImage | null,
): Promise<T> {
  if (!image) return api.post<T>(path, input);
  const payload = { ...input, ...(image.crop ? { imageCrop: image.crop } : {}) };
  if (image.source instanceof File) {
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("file", image.source);
    return api.upload<T>(path, form);
  }
  return api.post<T>(path, { ...payload, uploadedImageUrl: image.source });
}

export function useGenerateNoodlerNoodlePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ image, ...input }: NoodlerGeneratePostRequest) =>
      postNoodlerRequestWithImage<GeneratedNoodlerNoodlePost>(
        "/noodle/refresh",
        {
          ...input,
          debugMode: useUIStore.getState().debugMode,
          reviewImagePromptsBeforeSend: useUIStore.getState().reviewImagePromptsBeforeSend,
        },
        image,
      ),
    onSuccess: (_post, input) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(input.targetAccountId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useConfirmNoodlerImagePrompts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { targetAccountId: string; prompts: ImagePromptOverride[] }) =>
      api.post<{ finalized: number }>("/noodle/noodler/refresh/images", {
        prompts: input.prompts,
        debugMode: useUIStore.getState().debugMode,
      }),
    onSuccess: (_result, input) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(input.targetAccountId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useCreateNoodlerPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ image, ...input }: NoodlerCreatePostRequest) =>
      postNoodlerRequestWithImage<NoodlerManagedPost>("/noodle/noodler/posts", input, image),
    onSuccess: (_post, input) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(input.targetAccountId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

function imageFileExtension(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "image/avif") return "avif";
  return "jpg";
}

export function useLoadNoodlerPostImage() {
  return useMutation({
    mutationFn: async ({ imageUrl }: { imageUrl: string }) => {
      const url = new URL(imageUrl, window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
        throw new Error("This post image is not stored by Marinara.");
      }
      const response = await api.raw(`${url.pathname.slice(4)}${url.search}`);
      if (!response.ok) throw new Error("Could not load this post image for editing.");
      const blob = await response.blob();
      const extension = imageFileExtension(blob.type);
      return new File([blob], `noodler-post.${extension}`, { type: blob.type, lastModified: Date.now() });
    },
  });
}

export function useNoodlerViewer(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: noodleKeys.viewer(personaId ?? "none"),
    queryFn: () => api.get<NoodlerViewerScope>(`/noodle/noodler/viewer?personaId=${encodeURIComponent(personaId!)}`),
    enabled: enabled && Boolean(personaId),
    staleTime: 10_000,
    // Automatic posts change subscriber-visible projections server-side; poll while visible.
    refetchInterval: enabled && personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

/**
 * Unseen-post count for the public Noodle entry point. Reads the bootstrap query both Noodle
 * surfaces already hold, so the badge is the same number whether it is rendered from Noodle or
 * from NoodleR.
 */
export function useNoodleUnseenCount(personaAccount: NoodleAccount | null, enabled = true) {
  const { data } = useNoodle(enabled);
  return countNoodlePostsSince(
    data?.posts ?? [],
    data?.interactions ?? [],
    personaAccount?.id ?? null,
    personaAccount?.settings.social.noodleFeedSeenAt,
  );
}

/** Unseen-post count for the NoodleR entry point; reuses the viewer-scope query already cached. */
export function useNoodlerUnseenCount(personaId: string | null, enabled = true) {
  const { data } = useNoodlerViewer(personaId, enabled);
  return countNoodlerPostsSince(data, data?.viewer.settings.social.noodlerFeedSeenAt);
}

export function useToggleNoodlerSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      personaId,
      subscribed,
    }: {
      creatorAccountId: string;
      personaId: string;
      subscribed: boolean;
    }) =>
      subscribed
        ? api.delete<NoodlerViewerScope>(
            `/noodle/noodler/accounts/${encodeURIComponent(creatorAccountId)}/subscribe?personaId=${encodeURIComponent(personaId)}`,
          )
        : api.post<NoodlerViewerScope>(`/noodle/noodler/accounts/${encodeURIComponent(creatorAccountId)}/subscribe`, {
            personaId,
          }),
    // Patch the viewer cache with the returned scope instead of refetching the whole feed,
    // so revealed/re-locked posts flip in place without a reload-and-jump.
    onSuccess: async (scope, input) => {
      // Cancel any in-flight viewer poll first, or it can land after us and restore the stale scope.
      await qc.cancelQueries({ queryKey: noodleKeys.viewer(input.personaId) });
      qc.setQueryData(noodleKeys.viewer(input.personaId), scope);
      return qc.invalidateQueries({ queryKey: noodleKeys.noodlerSubscribers(input.creatorAccountId) });
    },
  });
}

export function useToggleNoodlerFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      personaId,
      followed,
    }: {
      creatorAccountId: string;
      personaId: string;
      followed: boolean;
    }) =>
      api.patch<NoodlerViewerScope>(`/noodle/noodler/accounts/${encodeURIComponent(creatorAccountId)}/follow`, {
        personaId,
        followed,
      }),
    onSuccess: async (scope, input) => {
      await qc.cancelQueries({ queryKey: noodleKeys.viewer(input.personaId) });
      qc.setQueryData(noodleKeys.viewer(input.personaId), scope);
    },
  });
}

export function useUnlockNoodlerPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, personaId }: { postId: string; personaId: string }) =>
      api.post<NoodlerViewerScope>(`/noodle/noodler/posts/${encodeURIComponent(postId)}/unlock`, { personaId }),
    onSuccess: async (scope, input) => {
      // Cancel any in-flight viewer poll first, or it can land after us and restore the locked scope.
      await qc.cancelQueries({ queryKey: noodleKeys.viewer(input.personaId) });
      qc.setQueryData(noodleKeys.viewer(input.personaId), scope);
    },
  });
}

export function useCreateNoodlerInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, ...input }: { postId: string } & NoodlerCreateInteractionInput) =>
      api.post<NoodleInteraction>(`/noodle/noodler/posts/${encodeURIComponent(postId)}/interactions`, input),
    onSuccess: (_result, input) => qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
  });
}

export function useTriggerNoodlerCreatorReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, interactionId, personaId }: { postId: string; interactionId: string; personaId: string }) =>
      api.post<NoodlerCreatorReplyResult>(
        `/noodle/noodler/posts/${encodeURIComponent(postId)}/interactions/${encodeURIComponent(interactionId)}/creator-reply`,
        { personaId, debugMode: useUIStore.getState().debugMode },
      ),
    onSettled: (_result, _error, input) => qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
  });
}

export function useRemoveNoodlerInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, ...input }: { postId: string } & NoodlerRemoveInteractionInput) => {
      const params = new URLSearchParams({ personaId: input.personaId, type: input.type });
      if (input.parentInteractionId) params.set("parentInteractionId", input.parentInteractionId);
      return api.delete<NoodleInteraction>(
        `/noodle/noodler/posts/${encodeURIComponent(postId)}/interactions?${params}`,
      );
    },
    onSuccess: (_result, input) => qc.invalidateQueries({ queryKey: noodleKeys.viewer(input.personaId) }),
  });
}

export function useUpdateNoodlerPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId: _accountId, ...input }: { id: string; accountId: string } & NoodlerPostUpdateInput) =>
      api.patch<NoodlerManagedPost>(`/noodle/noodler/posts/${encodeURIComponent(id)}`, input),
    onSuccess: (_post, input) => {
      return Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(input.accountId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]);
    },
  });
}

export function useReplaceNoodlerPostImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      accountId: _accountId,
      file,
      crop,
      ...input
    }: {
      id: string;
      accountId: string;
      file: File;
      crop: NoodlePostImageCrop;
    } & Omit<NoodlerPostUpdateInput, "imageCrop" | "removeImage">) => {
      const form = new FormData();
      form.append("payload", JSON.stringify({ ...input, imageCrop: crop }));
      form.append("file", file);
      return api.upload<NoodlerManagedPost>(`/noodle/noodler/posts/${encodeURIComponent(id)}/media`, form);
    },
    onSuccess: (_post, input) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(input.accountId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useDeleteNoodlerPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; accountId: string }) =>
      api.delete<NoodlerManagedPost>(`/noodle/noodler/posts/${encodeURIComponent(id)}`),
    onSuccess: (_post, input) => {
      return Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(input.accountId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]);
    },
  });
}

export function useUpdateNoodlerAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, ...access }: { accountId: string; hiddenFromAccountIds: string[] }) =>
      api.patch<NoodleAccount>(`/noodle/accounts/${encodeURIComponent(accountId)}/settings`, {
        subtree: "privacy",
        patch: { access },
      } satisfies NoodleAccountSettingsPatchInput),
    onSuccess: () => {
      return Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]);
    },
  });
}

export function useUpdateNoodlerAutoPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, ...autoPosting }: { accountId: string; enabled?: boolean; imagesEnabled?: boolean }) =>
      api.patch<NoodleAccount>(`/noodle/accounts/${encodeURIComponent(accountId)}/settings`, {
        subtree: "scheduler",
        patch: { autoPosting },
      } satisfies NoodleAccountSettingsPatchInput),
    // Auto-post state lives only under noodlerAccounts(); the /noodle bootstrap has none of it.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerReserveStatus() }),
      ]),
  });
}

export function useNoodlerReserveStatus(enabled = true) {
  return useQuery({
    queryKey: noodleKeys.noodlerReserveStatus(),
    queryFn: () => api.get<NoodlerReserveStatus>("/noodle/noodler/auto-post/status"),
    enabled,
    // The scheduler prepares posts on its own timer, so nothing here invalidates this key when
    // the counts change. Same 30s cadence the creator list already uses.
    refetchInterval: 30_000,
  });
}

export function useRunNoodlerAutoPostNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<NoodlerManagedPost>(`/noodle/noodler/accounts/${encodeURIComponent(accountId)}/auto-post/run-now`),
    onSuccess: (_post, accountId) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerPosts(accountId) }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useRefreshAllNoodlerCreatorsNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ outcomes: NoodlerRefreshNowOutcome[] }>("/noodle/noodler/auto-post/refresh-now"),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "posts"] }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
  });
}

export function useRefreshTargetedNoodlerCreatorsNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountIds: string[]; executionId?: string }) =>
      api.post<{ outcomes: NoodlerRefreshNowOutcome[] }>("/noodle/noodler/auto-post/refresh-targeted", {
        ...input,
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "posts"] }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() }),
      ]),
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
    mutationFn: ({
      id,
      targetAccountId,
      ...input
    }: { id: string; targetAccountId: string } & NoodleAccountFollowUpdateInput) =>
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
        mode: "public",
        ...input,
        timeZone: useUIStore.getState().conversationTimeZone,
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
