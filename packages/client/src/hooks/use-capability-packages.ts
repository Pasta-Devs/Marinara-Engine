import { useEffect, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  isInstalledCapabilityReady,
  replaceBuiltInAgentDefinitions,
  type CapabilityCatalog,
  type CapabilityPackageUpdate,
  type BuiltInAgentManifest,
  type InstalledCapabilityPackage,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import {
  beginCapabilityClientImport,
  capabilityClientNeedsRefresh,
  finishCapabilityClientImport,
  getCapabilityClientImport,
} from "../lib/capability-client-version";

export const capabilityPackageKeys = {
  all: ["capability-packages"] as const,
  catalog: () => [...capabilityPackageKeys.all, "catalog"] as const,
  installed: () => [...capabilityPackageKeys.all, "installed"] as const,
  pendingUpdates: () => [...capabilityPackageKeys.all, "pending-updates"] as const,
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

export function usePendingCapabilityPackageUpdates(enabled = true) {
  return useQuery({
    queryKey: capabilityPackageKeys.pendingUpdates(),
    queryFn: () => api.get<CapabilityPackageUpdate[]>("/capability-packages/updates/pending"),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

const loadedClientModules = new Map<string, string>();
const capabilityClientModuleStates = new Map<string, CapabilityClientModuleState>();
const capabilityClientModuleIdleStates = new Map<string, CapabilityClientModuleState>();
const capabilityClientModuleListeners = new Set<() => void>();
let capabilityClientModuleRevision = 0;

export type CapabilityClientModuleStatus = "idle" | "loading" | "ready" | "error" | "refresh-required";

export interface CapabilityClientModuleState {
  packageId: string;
  name: string | null;
  version: string | null;
  status: CapabilityClientModuleStatus;
  error: string | null;
  attempt: number;
}

function subscribeCapabilityClientModules(listener: () => void): () => void {
  capabilityClientModuleListeners.add(listener);
  return () => capabilityClientModuleListeners.delete(listener);
}

function getCapabilityClientModuleRevision(): number {
  return capabilityClientModuleRevision;
}

function getCapabilityClientModuleState(packageId: string): CapabilityClientModuleState {
  const existing = capabilityClientModuleStates.get(packageId);
  if (existing) return existing;
  const idle = capabilityClientModuleIdleStates.get(packageId) ?? {
    packageId,
    name: null,
    version: null,
    status: "idle" as const,
    error: null,
    attempt: 0,
  };
  capabilityClientModuleIdleStates.set(packageId, idle);
  return idle;
}

function publishCapabilityClientModuleState(next: CapabilityClientModuleState): void {
  const current = capabilityClientModuleStates.get(next.packageId);
  if (
    current?.version === next.version &&
    current.name === next.name &&
    current.status === next.status &&
    current.error === next.error &&
    current.attempt === next.attempt
  ) {
    return;
  }
  capabilityClientModuleStates.set(next.packageId, next);
  capabilityClientModuleRevision += 1;
  for (const listener of capabilityClientModuleListeners) listener();
}

function removeCapabilityClientModuleState(packageId: string): void {
  if (!capabilityClientModuleStates.delete(packageId)) return;
  // Imported code and its custom-element constructor remain in this document
  // even while a restart-required package is temporarily ineligible. Keep the
  // loaded version so the next ready version can require a truthful refresh.
  capabilityClientModuleRevision += 1;
  for (const listener of capabilityClientModuleListeners) listener();
}

function capabilityClientErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "The downloaded interface could not be loaded.";
}

export function retryCapabilityClientModule(packageId: string): void {
  const current = getCapabilityClientModuleState(packageId);
  if (current.status !== "error") return;
  publishCapabilityClientModuleState({
    ...current,
    status: "idle",
    error: null,
    attempt: current.attempt + 1,
  });
}

export function useCapabilityClientModuleState(packageId: string): CapabilityClientModuleState {
  return useSyncExternalStore(
    subscribeCapabilityClientModules,
    () => getCapabilityClientModuleState(packageId),
    () => getCapabilityClientModuleState(packageId),
  );
}

export function useCapabilityClientModules() {
  const installed = useInstalledCapabilityPackages();
  const clientModuleRevision = useSyncExternalStore(
    subscribeCapabilityClientModules,
    getCapabilityClientModuleRevision,
    getCapabilityClientModuleRevision,
  );
  useEffect(() => {
    const eligiblePackageIds = new Set<string>();
    for (const item of installed.data ?? []) {
      if (!isInstalledCapabilityReady(item) || !item.manifest.entrypoints.client) continue;
      eligiblePackageIds.add(item.id);
      const current = getCapabilityClientModuleState(item.id);
      const attempt = current.version === item.version ? current.attempt : 0;
      const loadedVersion = loadedClientModules.get(item.id);
      const tag = `marinara-capability-${item.id}`;
      if (
        capabilityClientNeedsRefresh(
          loadedVersion,
          item.version,
          typeof customElements !== "undefined" && Boolean(customElements.get(tag)),
        )
      ) {
        publishCapabilityClientModuleState({
          packageId: item.id,
          name: item.manifest.name,
          version: item.version,
          status: "refresh-required",
          error: null,
          attempt,
        });
        continue;
      }
      if (loadedVersion === item.version) {
        publishCapabilityClientModuleState({
          packageId: item.id,
          name: item.manifest.name,
          version: item.version,
          status: "ready",
          error: null,
          attempt,
        });
        continue;
      }
      const inFlight = getCapabilityClientImport(item.id);
      if (inFlight) {
        if (current.version !== item.version || current.status !== "loading") {
          publishCapabilityClientModuleState({
            packageId: item.id,
            name: item.manifest.name,
            version: item.version,
            status: "loading",
            error: null,
            attempt,
          });
        }
        continue;
      }
      if (
        current.version === item.version &&
        (current.status === "loading" || current.status === "error" || current.status === "refresh-required")
      ) {
        continue;
      }
      publishCapabilityClientModuleState({
        packageId: item.id,
        name: item.manifest.name,
        version: item.version,
        status: "loading",
        error: null,
        attempt,
      });
      const source = `/api/capability-packages/${encodeURIComponent(item.id)}/client?v=${encodeURIComponent(item.version)}${attempt > 0 ? `&retry=${attempt}` : ""}`;
      if (!beginCapabilityClientImport(item.id, { version: item.version, attempt })) continue;
      void import(/* @vite-ignore */ source)
        .then(() => {
          if (!customElements.get(tag)) {
            throw new Error(`Client module did not register ${tag}`);
          }
          loadedClientModules.set(item.id, item.version);
          finishCapabilityClientImport(item.id, { version: item.version, attempt });
          const latest = getCapabilityClientModuleState(item.id);
          if (latest.version !== item.version || latest.attempt !== attempt) {
            if (latest.version && customElements.get(tag)) {
              publishCapabilityClientModuleState({
                ...latest,
                status: "refresh-required",
                error: null,
              });
            }
            return;
          }
          publishCapabilityClientModuleState({
            packageId: item.id,
            name: item.manifest.name,
            version: item.version,
            status: "ready",
            error: null,
            attempt,
          });
        })
        .catch((error) => {
          finishCapabilityClientImport(item.id, { version: item.version, attempt });
          const latest = getCapabilityClientModuleState(item.id);
          if (latest.version !== item.version || latest.attempt !== attempt) {
            if (latest.version && customElements.get(tag)) {
              loadedClientModules.set(item.id, item.version);
              publishCapabilityClientModuleState({
                ...latest,
                status: "refresh-required",
                error: null,
              });
            } else if (latest.version) {
              publishCapabilityClientModuleState({
                ...latest,
                status: "idle",
                error: null,
              });
            }
            return;
          }
          publishCapabilityClientModuleState({
            packageId: item.id,
            name: item.manifest.name,
            version: item.version,
            status: "error",
            error: capabilityClientErrorMessage(error),
            attempt,
          });
          console.error(`Could not load client capability ${item.id}`, error);
        });
    }
    for (const packageId of capabilityClientModuleStates.keys()) {
      if (!eligiblePackageIds.has(packageId)) removeCapabilityClientModuleState(packageId);
    }
  }, [clientModuleRevision, installed.data]);
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
    mutationFn: (variables: string | { id: string; expectedVersion: string }) => {
      const { id, expectedVersion } =
        typeof variables === "string" ? { id: variables, expectedVersion: undefined } : variables;
      return api.post<InstalledCapabilityPackage>(
        `/capability-packages/${encodeURIComponent(id)}/install`,
        expectedVersion ? { expectedVersion } : undefined,
      );
    },
    onSettled: invalidate,
  });
}

export function useDeclineCapabilityPackageUpdate() {
  const invalidate = useInvalidateCapabilityState();
  return useMutation({
    mutationFn: ({ id, version }: Pick<CapabilityPackageUpdate, "id" | "version">) =>
      api.post<{ declined: true }>(
        `/capability-packages/${encodeURIComponent(id)}/updates/${encodeURIComponent(version)}/decline`,
      ),
    onSuccess: invalidate,
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
