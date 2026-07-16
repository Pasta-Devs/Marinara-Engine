import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  isInstalledCapabilityReady,
  replaceBuiltInAgentDefinitions,
  type CapabilityCatalog,
  type BuiltInAgentManifest,
  type InstalledCapabilityPackage,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";

export const capabilityPackageKeys = {
  all: ["capability-packages"] as const,
  catalog: () => [...capabilityPackageKeys.all, "catalog"] as const,
  installed: () => [...capabilityPackageKeys.all, "installed"] as const,
  agents: () => [...capabilityPackageKeys.all, "agents"] as const,
};

export function useCapabilityCatalog(enabled = true) {
  return useQuery({
    queryKey: capabilityPackageKeys.catalog(),
    queryFn: () => api.get<CapabilityCatalog>("/capability-packages/catalog"),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useCapabilityAgentRegistry() {
  const query = useQuery({
    queryKey: capabilityPackageKeys.agents(),
    queryFn: async () => {
      const agents = await api.get<BuiltInAgentManifest[]>("/capability-packages/agents");
      // Keep the shared registry current before React Query publishes the new
      // result. Updating it in an effect leaves mounted consumers one render
      // behind because the registry itself is mutable, non-React state.
      replaceBuiltInAgentDefinitions(agents);
      return agents;
    },
  });
  return query;
}

export function useInstalledCapabilityPackages(enabled = true) {
  return useQuery({
    queryKey: capabilityPackageKeys.installed(),
    queryFn: () => api.get<InstalledCapabilityPackage[]>("/capability-packages/installed"),
    enabled,
  });
}

const loadedClientModules = new Map<string, string>();

export function useCapabilityClientModules() {
  const installed = useInstalledCapabilityPackages();
  useEffect(() => {
    for (const item of installed.data ?? []) {
      if (!isInstalledCapabilityReady(item) || !item.manifest.entrypoints.client) continue;
      if (loadedClientModules.get(item.id) === item.version) continue;
      const source = `/api/capability-packages/${encodeURIComponent(item.id)}/client?v=${encodeURIComponent(item.version)}`;
      void import(/* @vite-ignore */ source)
        .then(() => loadedClientModules.set(item.id, item.version))
        .catch((error) => console.error(`Could not load client capability ${item.id}`, error));
    }
  }, [installed.data]);
  return installed;
}

function useInvalidateCapabilityState() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: capabilityPackageKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["agents"] }),
      queryClient.invalidateQueries({ queryKey: ["chats"] }),
    ]);
  };
}

interface BulkCapabilityPackageVariables {
  ids: string[];
  onProgress?: (completed: number, total: number) => void;
}

interface BulkCapabilityPackageFailure {
  id: string;
  error: unknown;
}

interface BulkCapabilityPackageResult {
  succeeded: string[];
  failures: BulkCapabilityPackageFailure[];
  restartRequired: boolean;
}

async function runCapabilityPackageQueue(
  ids: string[],
  operation: (id: string) => Promise<{ restartRequired: boolean }>,
  onProgress?: BulkCapabilityPackageVariables["onProgress"],
): Promise<BulkCapabilityPackageResult> {
  const succeeded: string[] = [];
  const failures: BulkCapabilityPackageFailure[] = [];
  let restartRequired = false;

  for (const [index, id] of ids.entries()) {
    try {
      const result = await operation(id);
      succeeded.push(id);
      restartRequired ||= result.restartRequired;
    } catch (error) {
      failures.push({ id, error });
    } finally {
      onProgress?.(index + 1, ids.length);
    }
  }

  return { succeeded, failures, restartRequired };
}

export function useInstallCapabilityPackage() {
  const invalidate = useInvalidateCapabilityState();
  return useMutation({
    mutationFn: (id: string) => api.post<InstalledCapabilityPackage>(`/capability-packages/${id}/install`),
    onSettled: invalidate,
  });
}

export function useUninstallCapabilityPackage() {
  const invalidate = useInvalidateCapabilityState();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ restartRequired: boolean }>(`/capability-packages/${id}`),
    onSuccess: invalidate,
  });
}

export function useInstallAllCapabilityPackages() {
  const invalidate = useInvalidateCapabilityState();
  return useMutation({
    mutationFn: ({ ids, onProgress }: BulkCapabilityPackageVariables) =>
      runCapabilityPackageQueue(
        ids,
        async (id) => {
          const result = await api.post<InstalledCapabilityPackage>(
            `/capability-packages/${encodeURIComponent(id)}/install`,
          );
          return { restartRequired: result.status === "restart-required" };
        },
        onProgress,
      ),
    onSuccess: invalidate,
  });
}

export function useUninstallAllCapabilityPackages() {
  const invalidate = useInvalidateCapabilityState();
  return useMutation({
    mutationFn: ({ ids, onProgress }: BulkCapabilityPackageVariables) =>
      runCapabilityPackageQueue(
        ids,
        (id) => api.delete<{ restartRequired: boolean }>(`/capability-packages/${encodeURIComponent(id)}`),
        onProgress,
      ),
    onSuccess: invalidate,
  });
}
