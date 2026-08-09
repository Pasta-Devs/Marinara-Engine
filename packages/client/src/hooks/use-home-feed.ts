import { useQuery } from "@tanstack/react-query";
import type { HomeFeedSnapshot } from "@marinara-engine/shared";
import { api } from "../lib/api-client";

export const homeFeedKeys = {
  all: ["home-feed"] as const,
  snapshot: () => [...homeFeedKeys.all, "snapshot"] as const,
};

export function useHomeFeed() {
  return useQuery({
    queryKey: homeFeedKeys.snapshot(),
    queryFn: () => api.get<HomeFeedSnapshot>("/chats/home-feed"),
    staleTime: 30_000,
  });
}
