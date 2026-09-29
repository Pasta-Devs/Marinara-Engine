import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** Only fixed protocol codes may cross into the guest presentation. */
export function multiplayerActionError(error: unknown): MultiplayerErrorCode | null {
  const payload = error instanceof ApiError ? error.payload : null;
  if (!payload || typeof payload !== "object" || !("error" in payload)) return null;
  const result = multiplayerErrorCodeSchema.safeParse(payload.error);
  return result.success ? result.data : null;
}

export function useMultiplayerStatus() {
  return useQuery({
    queryKey: multiplayerKeys.status,
    queryFn: () => api.get<MultiplayerStatus>("/multiplayer/status"),
    staleTime: 10_000,
    retry: false,
  });
}

export function useMultiplayerHost(enabled = true) {
  return useQuery({
    queryKey: multiplayerKeys.host,
    queryFn: () => api.get<MultiplayerHostState | null>("/multiplayer/host"),
    enabled,
    refetchInterval: enabled ? 2_000 : false,
    retry: false,
  });
}

export function useMultiplayerGuest(enabled = true) {
  return useQuery({
    queryKey: multiplayerKeys.guest,
    queryFn: () => api.get<MultiplayerGuestSession | null>("/multiplayer/guest"),
    enabled,
    refetchInterval: enabled ? 2_000 : false,
    retry: false,
  });
}

/** Local authenticated controls only; peer actions never choose an API path. */
export function useMultiplayerMutation<TData, TVariables>(path: string, method: "post" | "put" | "delete" = "post") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TVariables) => (method === "delete" ? api.delete<TData>(path) : api[method]<TData>(path, data)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: multiplayerKeys.all }),
        queryClient.invalidateQueries({ queryKey: chatKeys.all }),
      ]);
    },
    onError: async (error) => {
      if (multiplayerActionError(error) === "stale-action") {
        await queryClient.invalidateQueries({ queryKey: multiplayerKeys.all });
      }
    },
  });
}

export function useMultiplayerParticipantAction(host: boolean) {
  return useMultiplayerMutation<unknown, MultiplayerAction>(`/multiplayer/${host ? "host/action" : "guest/action"}`);
}
