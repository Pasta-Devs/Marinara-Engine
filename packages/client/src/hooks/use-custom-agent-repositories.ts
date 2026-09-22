import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CustomAgentRepositoryApplyResult,
  CustomAgentRepositoryPreview,
  CustomAgentRepositoryState,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { capabilityPackageKeys } from "./use-capability-packages";

const customAgentRepositoryKeys = {
  all: ["custom-agent-repositories"] as const,
  state: ["custom-agent-repositories", "state"] as const,
};

export function useCustomAgentRepositories() {
  return useQuery({
    queryKey: customAgentRepositoryKeys.state,
    queryFn: () => api.get<CustomAgentRepositoryState>("/custom-agent-repositories"),
    staleTime: 30_000,
  });
}

function useInvalidateCustomAgentRepositories() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: customAgentRepositoryKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["agents"] }),
      // A repository may also carry Game Mode rulesets, which the wizard and the Agents panel read
      // from the installed-rulesets query.
      queryClient.invalidateQueries({ queryKey: capabilityPackageKeys.all }),
    ]);
  };
}

export function usePreviewCustomAgentRepository() {
  return useMutation({
    mutationFn: ({ url, repositoryId }: { url?: string; repositoryId?: string }) => {
      if (repositoryId) {
        return api.post<CustomAgentRepositoryPreview>(
          `/custom-agent-repositories/${encodeURIComponent(repositoryId)}/preview`,
        );
      }
      return api.post<CustomAgentRepositoryPreview>("/custom-agent-repositories/preview", { url });
    },
  });
}

export function useAddCustomAgentRepository() {
  const invalidate = useInvalidateCustomAgentRepositories();
  return useMutation({
    mutationFn: ({ url, digest, confirmed }: { url: string; digest: string; confirmed: boolean }) =>
      api.post<CustomAgentRepositoryApplyResult>("/custom-agent-repositories", { url, digest, confirmed }),
    onSuccess: invalidate,
  });
}

export function useSyncCustomAgentRepository() {
  const invalidate = useInvalidateCustomAgentRepositories();
  return useMutation({
    mutationFn: ({ repositoryId, digest, confirmed }: { repositoryId: string; digest: string; confirmed: boolean }) =>
      api.post<CustomAgentRepositoryApplyResult>(
        `/custom-agent-repositories/${encodeURIComponent(repositoryId)}/sync`,
        {
          digest,
          confirmed,
        },
      ),
    onSuccess: invalidate,
  });
}

export function useRemoveCustomAgentRepository() {
  const invalidate = useInvalidateCustomAgentRepositories();
  return useMutation({
    mutationFn: (repositoryId: string) =>
      api.delete<void>(`/custom-agent-repositories/${encodeURIComponent(repositoryId)}`),
    onSuccess: invalidate,
  });
}
