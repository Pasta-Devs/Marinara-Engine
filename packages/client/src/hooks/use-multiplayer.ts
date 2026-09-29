import { useEffect } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  multiplayerErrorCodeSchema,
  type MultiplayerErrorCode,
  type MultiplayerStatus,
  type MultiplayerHostState,
  type MultiplayerGuestSession,
  type MultiplayerAction,
} from "@marinara-engine/shared";
import { api, ApiError } from "../lib/api-client";
import { chatKeys } from "./use-chats";

export const multiplayerKeys = {
  all: ["multiplayer"] as const,
  status: ["multiplayer", "status"] as const,
  host: ["multiplayer", "host"] as const,
  guest: ["multiplayer", "guest"] as const,
};
const DISABLED_STORAGE_KEY = "marinara-multiplayer-disabled";
const multiplayerStatusQuery = queryOptions({
  queryKey: multiplayerKeys.status,
  queryFn: ({ signal }) => api.get<MultiplayerStatus>("/multiplayer/status", { signal }),
  // Unrelated app invalidations must not wake an optional feature. Only explicit controls refresh it.
  staleTime: "static",
  gcTime: Infinity,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retryOnMount: false,
  retry: false,
});

async function stopMultiplayerQueries(queryClient: QueryClient, notifyOtherTabs = false) {
  await queryClient.cancelQueries({ queryKey: multiplayerKeys.all });
  queryClient.setQueryData<MultiplayerStatus>(multiplayerKeys.status, (status) =>
    status && (status.enabled || status.hosting || status.joined)
      ? { ...status, enabled: false, hosting: false, joined: false }
      : status,
  );
  if (notifyOtherTabs) {
    try {
      window.localStorage.setItem(DISABLED_STORAGE_KEY, String(Date.now()));
    } catch {
      // Storage can be unavailable. An active tab also stops on its next disabled response.
    }
  }
  queryClient.setQueryData(multiplayerKeys.host, null);
  queryClient.setQueryData(multiplayerKeys.guest, null);
}

/** Only fixed protocol codes may cross into the guest presentation. */
export function multiplayerActionError(error: unknown): MultiplayerErrorCode | null {
  const payload = error instanceof ApiError ? error.payload : null;
  if (!payload || typeof payload !== "object" || !("error" in payload)) return null;
  const result = multiplayerErrorCodeSchema.safeParse(payload.error);
  return result.success ? result.data : null;
}

export function useMultiplayerStatus() {
  const queryClient = useQueryClient();
  const query = useQuery(multiplayerStatusQuery);
  const available = query.data?.available;
  const enabled = query.data?.enabled;
  useEffect(() => {
    if (available === undefined || enabled === undefined) return;
    if (!available || !enabled) {
      void stopMultiplayerQueries(queryClient);
      return;
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === DISABLED_STORAGE_KEY && event.newValue) void stopMultiplayerQueries(queryClient);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [available, enabled, queryClient]);
  return query;
}

function useMultiplayerSession<T>(role: "host" | "guest", enabled: boolean) {
  const queryClient = useQueryClient();
  const status = useMultiplayerStatus();
  const activeKey = role === "host" ? "hosting" : "joined";
  const active = enabled && status.data?.available === true && status.data.enabled && status.data[activeKey];
  return useQuery({
    queryKey: multiplayerKeys[role],
    queryFn: async ({ signal }) => {
      const current = queryClient.getQueryData<MultiplayerStatus>(multiplayerKeys.status);
      if (!current?.available || !current.enabled || !current[activeKey]) return null;
      try {
        const session = await api.get<T | null>(`/multiplayer/${role}`, { signal });
        if (!session) {
          queryClient.setQueryData<MultiplayerStatus>(multiplayerKeys.status, (value) =>
            value ? { ...value, [activeKey]: false } : value,
          );
        }
        return session;
      } catch (error) {
        if ((error instanceof ApiError && error.status === 404) || multiplayerActionError(error) === "disabled") {
          await stopMultiplayerQueries(queryClient, true);
          return null;
        }
        throw error;
      }
    },
    enabled: active,
    refetchInterval: (query) =>
      active && (role !== "guest" || (query.state.data as MultiplayerGuestSession | null)?.state.phase !== "ended")
        ? 2_000
        : false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

export function useMultiplayerHost(enabled = true) {
  return useMultiplayerSession<MultiplayerHostState>("host", enabled);
}

export function useMultiplayerGuest(enabled = true) {
  return useMultiplayerSession<MultiplayerGuestSession>("guest", enabled);
}

/** Local authenticated controls only; peer actions never choose an API path. */
export function useMultiplayerMutation<TData, TVariables>(path: string, method: "post" | "put" | "delete" = "post") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TVariables) => (method === "delete" ? api.delete<TData>(path) : api[method]<TData>(path, data)),
    onSuccess: async (result, data) => {
      if (path === "/multiplayer/settings" && data && typeof data === "object" && "enabled" in data && !data.enabled) {
        await stopMultiplayerQueries(queryClient, true);
        await queryClient.invalidateQueries({ queryKey: chatKeys.all });
        return;
      }
      if (path === "/multiplayer/host" || path === "/multiplayer/join") {
        const current = queryClient.getQueryData<MultiplayerStatus>(multiplayerKeys.status);
        if (!current?.available || !current.enabled) {
          await queryClient.invalidateQueries({ queryKey: chatKeys.all });
          return;
        }
        if (result) {
          const host = path === "/multiplayer/host";
          queryClient.setQueryData(host ? multiplayerKeys.host : multiplayerKeys.guest, result);
          queryClient.setQueryData(multiplayerKeys.status, { ...current, [host ? "hosting" : "joined"]: true });
        }
      }
      await Promise.all([
        // Preserve the successful write if its follow-up status read fails, as invalidation does.
        queryClient.fetchQuery({ ...multiplayerStatusQuery, staleTime: 0 }).catch(() => undefined),
        queryClient.invalidateQueries({ queryKey: multiplayerKeys.all }),
        queryClient.invalidateQueries({ queryKey: chatKeys.all }),
      ]);
    },
    onError: async (error) => {
      if ((error instanceof ApiError && error.status === 404) || multiplayerActionError(error) === "disabled") {
        await stopMultiplayerQueries(queryClient, true);
      } else if (multiplayerActionError(error) === "stale-action") {
        await queryClient.invalidateQueries({ queryKey: multiplayerKeys.all });
      }
    },
  });
}

export function useMultiplayerParticipantAction(host: boolean) {
  return useMultiplayerMutation<unknown, MultiplayerAction>(`/multiplayer/${host ? "host/action" : "guest/action"}`);
}
