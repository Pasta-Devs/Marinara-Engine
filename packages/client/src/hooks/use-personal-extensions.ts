import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreatePersonalExtensionInput,
  PersonalClientExtensionRuntime,
  PersonalExtension,
  PersonalExtensionPolicy,
  UpdatePersonalExtensionInput,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";

export const personalExtensionKeys = {
  all: ["personal-extensions"] as const,
  list: () => [...personalExtensionKeys.all, "list"] as const,
  runtime: () => [...personalExtensionKeys.all, "runtime"] as const,
  policy: () => [...personalExtensionKeys.all, "policy"] as const,
};

export function usePersonalExtensions() {
  return useQuery({
    queryKey: personalExtensionKeys.list(),
    queryFn: () => api.get<PersonalExtension[]>("/personal-extensions"),
    staleTime: 30_000,
  });
}

export function usePersonalExtensionRuntime() {
  return useQuery({
    queryKey: personalExtensionKeys.runtime(),
    queryFn: () => api.get<PersonalClientExtensionRuntime[]>("/personal-extensions/runtime/client"),
    staleTime: 30_000,
  });
}

export function usePersonalExtensionPolicy() {
  return useQuery({
    queryKey: personalExtensionKeys.policy(),
    queryFn: () => api.get<PersonalExtensionPolicy>("/personal-extensions/policy"),
    staleTime: 30_000,
  });
}

export function useSetExternalExtensionsEnabled() {
  const invalidate = useInvalidatePersonalExtensions();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch<PersonalExtensionPolicy>("/personal-extensions/policy/external", { enabled }),
    onSuccess: invalidate,
  });
}

function useInvalidatePersonalExtensions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: personalExtensionKeys.all });
}

export function useCreatePersonalExtension() {
  const invalidate = useInvalidatePersonalExtensions();
  return useMutation({
    mutationFn: (input: CreatePersonalExtensionInput) =>
      api.post<PersonalExtension>("/personal-extensions", input),
    onSuccess: invalidate,
  });
}

export function useUpdatePersonalExtension() {
  const invalidate = useInvalidatePersonalExtensions();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdatePersonalExtensionInput) =>
      api.patch<PersonalExtension>(`/personal-extensions/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useApprovePersonalExtension() {
  const invalidate = useInvalidatePersonalExtensions();
  return useMutation({
    mutationFn: ({
      id,
      contentHash,
      acknowledgeFullPageAccess,
    }: {
      id: string;
      contentHash: string;
      acknowledgeFullPageAccess?: boolean;
    }) =>
      api.post<PersonalExtension>(`/personal-extensions/${id}/approve`, {
        contentHash,
        acknowledgeSandboxedCode: true,
        ...(acknowledgeFullPageAccess ? { acknowledgeFullPageAccess: true } : {}),
      }),
    onSuccess: invalidate,
  });
}

export function useRollbackPersonalExtension() {
  const invalidate = useInvalidatePersonalExtensions();
  return useMutation({
    mutationFn: ({ id, contentHash }: { id: string; contentHash: string }) =>
      api.post<PersonalExtension>(`/personal-extensions/${id}/rollback`, { contentHash }),
    onSuccess: invalidate,
  });
}

export function useDeletePersonalExtension() {
  const invalidate = useInvalidatePersonalExtensions();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/personal-extensions/${id}`),
    onSuccess: invalidate,
  });
}
