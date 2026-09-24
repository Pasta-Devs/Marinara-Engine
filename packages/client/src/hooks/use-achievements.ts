import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AchievementEvent, AchievementStatusResponse, AchievementTrackResponse } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { markAchievementUnlocksSeen, showAchievementUnlockToasts } from "../lib/achievement-toast";
import { useUIStore } from "../stores/ui.store";

export const achievementKeys = {
  all: ["achievements"] as const,
  status: () => [...achievementKeys.all, "status"] as const,
};

// Page-lifetime, like the announced ids it seeds. A per-hook flag would let a remounted Home treat
// an unlock that happened while it was away as the silent baseline and never announce it.
let packageUnlocksSeeded = false;

export function useAchievements(enabled = true) {
  const query = useQuery({
    queryKey: achievementKeys.status(),
    queryFn: () => api.get<AchievementStatusResponse>("/achievements"),
    enabled,
    staleTime: 30_000,
  });

  // Package badges unlock inside the server, so this refresh is the only place the client can
  // notice them. Engine badges are left alone: they announce themselves from `/achievements/track`,
  // and their catch-up unlocks are documented as silent.
  const data = query.data;
  useEffect(() => {
    if (!data) return;
    const packageIds = new Set(data.definitions.flatMap((definition) => (definition.source ? [definition.id] : [])));
    const unlocked = data.progress.filter((item) => item.unlocked && packageIds.has(item.id));
    if (!packageUnlocksSeeded) {
      packageUnlocksSeeded = true;
      markAchievementUnlocksSeen(unlocked);
      return;
    }
    if (useUIStore.getState().achievementsEnabled) showAchievementUnlockToasts(unlocked, data.definitions);
    else markAchievementUnlocksSeen(unlocked);
  }, [data]);

  return query;
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
