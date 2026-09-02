import { useEffect, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  isInstalledCapabilityReady,
  replaceBuiltInAgentDefinitions,
  type CapabilityCatalog,
  type CapabilityPackageUpdate,
  type CapabilityPackageVersionNote,
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
  releaseNotes: (id: string) => [...capabilityPackageKeys.all, "release-notes", id] as const,
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

/** Published release notes for one package, newest first. Empty when the catalog
 *  publishes no notes sidecar, which is the normal state for a custom catalog. */
export function useCapabilityPackageReleaseNotes(packageId: string | null, enabled = true) {
  return useQuery({
    queryKey: capabilityPackageKeys.releaseNotes(packageId ?? ""),
    queryFn: () => api.get<CapabilityPackageVersionNote[]>(`/capability-packages/${packageId}/release-notes`),
    enabled: enabled && !!packageId,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useCapabilityAgentRegistry(enabled = true) {
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
    enabled,
  });
  return query;
}

/** Select visible tracker manifests from the React Query registry result. */
export function selectVisibleTrackerCapabilityAgents(
  agents: BuiltInAgentManifest[] | undefined,
): BuiltInAgentManifest[] {
  return (agents ?? []).filter((agent) => agent.category === "tracker" && !agent.libraryHidden);
}

/** Keep special tracker packages at their canonical edges in every tracker surface. */
export function partitionTrackerCapabilityPackages(packages: readonly InstalledCapabilityPackage[]) {
  const memoryNag: InstalledCapabilityPackage[] = [];
  const beholder: InstalledCapabilityPackage[] = [];
  const other: InstalledCapabilityPackage[] = [];
  for (const item of packages) {
    if (item.id === "memory-nag") memoryNag.push(item);
    else if (item.id === "beholder") beholder.push(item);
    else other.push(item);
  }
  return { memoryNag, beholder, other };
}

/**
 * Installed packages that can provide a game's EXPERIENCE: runtime-ready, declaring the `game-surface`
 * slot, and carrying the client entrypoint that renders it. Shared so the setup chooser can only ever
 * offer what `GameSurface` would actually mount.
 *
 * The manifest schema rejects a game-surface package with no client entrypoint, so this is a second line
 * for anything installed before that rule existed — the module loader skips such a package, and offering
 * it would let a player start a game whose surface renders nothing.
 */
export function selectGameExperiencePackages(
  installed: InstalledCapabilityPackage[] | undefined,
): InstalledCapabilityPackage[] {
  return (installed ?? []).filter(
    (pkg) =>
      isInstalledCapabilityReady(pkg) &&
      pkg.manifest.contributions?.slots?.includes("game-surface") &&
      Boolean(pkg.manifest.entrypoints.client?.trim()),
  );
}

/** A restart-required update keeps exposing the manifest paired with the runtime
 * and client module that remain active until the process restarts. */
export function resolveCapabilityPackageAvailableUntilRestart(
  installed: InstalledCapabilityPackage,
): InstalledCapabilityPackage | null {
  if (installed.status !== "restart-required" || !installed.previousVersion || !installed.previousManifest) return null;
  return { ...installed, version: installed.previousVersion, manifest: installed.previousManifest };
}

export function isCapabilityPackageAvailableUntilRestart(installed: InstalledCapabilityPackage): boolean {
  return Boolean(resolveCapabilityPackageAvailableUntilRestart(installed));
}

/** Installed destinations that Home can safely expose as browser tabs. */
export function selectHomeBrowserPackages(
  installed: InstalledCapabilityPackage[] | undefined,
): InstalledCapabilityPackage[] {
  return (installed ?? [])
    .map((pkg) => (isInstalledCapabilityReady(pkg) ? pkg : resolveCapabilityPackageAvailableUntilRestart(pkg)))
    .filter(
      (pkg): pkg is InstalledCapabilityPackage =>
        pkg !== null &&
        Boolean(pkg.manifest.contributions?.slots?.includes("home-browser-tab")) &&
        Boolean(pkg.manifest.entrypoints.client?.trim()) &&
        Boolean(pkg.manifest.contributions?.homeBrowserTab),
    );
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
    for (const installedItem of installed.data ?? []) {
      const item = isInstalledCapabilityReady(installedItem)
        ? installedItem
        : resolveCapabilityPackageAvailableUntilRestart(installedItem);
      if (!item?.manifest.entrypoints.client) continue;
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
    mutationFn: (variables: { id: string; expectedVersion: string; expectedArtifactSha256: string }) => {
      const { id, expectedVersion, expectedArtifactSha256 } = variables;
      return api.post<InstalledCapabilityPackage>(`/capability-packages/${encodeURIComponent(id)}/install`, {
        expectedVersion,
        expectedArtifactSha256,
      });
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
    mutationFn: ({
      packages,
      onProgress,
    }: Omit<BulkCapabilityPackageVariables, "ids"> & { packages: CapabilityCatalog["packages"] }) =>
      runCapabilityPackageQueue(
        packages.map((entry) => entry.manifest.id),
        async (id) => {
          const entry = packages.find((candidate) => candidate.manifest.id === id)!;
          const result = await api.post<InstalledCapabilityPackage>(
            `/capability-packages/${encodeURIComponent(id)}/install`,
            {
              expectedVersion: entry.manifest.version,
              expectedArtifactSha256: entry.artifact.sha256,
            },
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
