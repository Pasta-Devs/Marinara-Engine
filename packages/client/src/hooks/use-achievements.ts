import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AchievementEvent, AchievementStatusResponse, AchievementTrackResponse } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { markAchievementUnlocksSeen, showAchievementUnlockToasts } from "../lib/achievement-toast";
import { useUIStore } from "../stores/ui.store";

export const achievementKeys = {
  all: ["achievements"] as const,
  status: () => [...achievementKeys.all, "status"] as const,
};

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
  const seeded = useRef(false);
  useEffect(() => {
    if (!data) return;
    const packageIds = new Set(data.definitions.flatMap((definition) => (definition.source ? [definition.id] : [])));
    const unlocked = data.progress.filter((item) => item.unlocked && packageIds.has(item.id));
    if (!seeded.current) {
      seeded.current = true;
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
