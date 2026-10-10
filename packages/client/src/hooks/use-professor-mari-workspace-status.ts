import { useQuery } from "@tanstack/react-query";
import type { MariWorkspaceStatus } from "@marinara-engine/shared";
import { api, ApiError } from "../lib/api-client";

export const professorMariWorkspaceStatusKeys = {
  all: ["professor-mari", "workspace", "status"] as const,
};

export const PROFESSOR_MARI_STATUS_DIALOG_INTERVAL_MS = 5_000;

/**
 * The omnibar dialog polls quickly while it is open. The always-mounted host
 * keeps a slow heartbeat on the same query key so work that finishes after a
 * close is still noticed — React Query shares one query between both, and the
 * shorter interval wins whenever the dialog is up.
 */
export function useProfessorMariWorkspaceStatus(options?: { intervalMs?: number }) {
  const intervalMs = options?.intervalMs ?? PROFESSOR_MARI_STATUS_DIALOG_INTERVAL_MS;
  return useQuery({
    queryKey: professorMariWorkspaceStatusKeys.all,
    queryFn: () => api.get<MariWorkspaceStatus>("/professor-mari/workspace/status"),
    staleTime: 2_000,
    // Stop for a disabled workspace or a client that cannot access the route.
    // Transient network/server failures must keep the heartbeat alive or a
    // background run can finish without the UI ever noticing.
    refetchInterval: (query) => {
      if (query.state.data?.enabled === false) return false;
      const error = query.state.error;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
      // Slice 73: while she works the slow heartbeat speeds up, so the top-bar pill sees her finish promptly.
      return query.state.data?.active ? Math.min(intervalMs, PROFESSOR_MARI_STATUS_DIALOG_INTERVAL_MS) : intervalMs;
    },
    retry: false,
  });
}
