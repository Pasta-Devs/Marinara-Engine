import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AchievementEvent, AchievementStatusResponse, AchievementTrackResponse } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { showAchievementUnlockToasts } from "../lib/achievement-toast";
import { useUIStore } from "../stores/ui.store";

export const achievementKeys = {
  all: ["achievements"] as const,
  status: () => [...achievementKeys.all, "status"] as const,
};

export function useAchievements(enabled = true) {
  return useQuery({
    queryKey: achievementKeys.status(),
    queryFn: () => api.get<AchievementStatusResponse>("/achievements"),
    enabled,
    staleTime: 30_000,
  });
}

interface TrackAchievementOptions {
  keepalive?: boolean;
}

export async function trackAchievementEvent(event: AchievementEvent, options: TrackAchievementOptions = {}) {
  const result = await api.post<AchievementTrackResponse>(
    "/achievements/track",
    { event },
    options.keepalive ? { keepalive: true } : undefined,
  );
  if (useUIStore.getState().achievementsEnabled) {
    showAchievementUnlockToasts(result.newlyUnlocked);
  }
  return result;
}

export function useTrackAchievement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (event: AchievementEvent) => trackAchievementEvent(event),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: achievementKeys.all });
    },
  });
}
