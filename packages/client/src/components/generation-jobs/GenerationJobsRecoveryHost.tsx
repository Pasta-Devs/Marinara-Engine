// Headless host for generation job tracking (feature switch
// generationJobTracking): reconnect recovery. After a reload, a network drop
// or a hidden tab it re-reads the job records and announces results that
// finished while the user was away. Renders nothing and requests nothing
// while the switch is off.
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { partitionFinishedJobs, type AwayWindow } from "../../lib/generation-job-tracking";
import {
  generationJobKeys,
  markGenerationJobsSeen,
  useGenerationJobsEnabled,
  useTrackedGenerationJobs,
} from "../../hooks/use-generation-jobs";
import { useUIStore } from "../../stores/ui.store";

const MAX_AWAY_WINDOWS = 20;

function userIsPresent(): boolean {
  return document.visibilityState === "visible" && navigator.onLine;
}

export function GenerationJobsRecoveryHost() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const enabled = useGenerationJobsEnabled();
  const jobs = useTrackedGenerationJobs(enabled);
  const pageLoadedAt = useRef(Date.now());
  const away = useRef<AwayWindow[]>([]);
  const handled = useRef(new Set<string>());

  // Record when the user could not see this tab, and re-read the records as soon as they are back.
  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const open = away.current.at(-1);
      if (!userIsPresent()) {
        if (!open || open.to !== null) away.current.push({ from: Date.now(), to: null });
        if (away.current.length > MAX_AWAY_WINDOWS) away.current.splice(0, away.current.length - MAX_AWAY_WINDOWS);
      } else if (open && open.to === null) {
        open.to = Date.now();
        void queryClient.invalidateQueries({ queryKey: generationJobKeys.records() });
      }
    };
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [enabled, queryClient]);

  useEffect(() => {
    if (!enabled || !jobs.data || !userIsPresent()) return;
    const fresh = jobs.data.filter((job) => !handled.current.has(job.id));
    const { announce, quiet } = partitionFinishedJobs(fresh, {
      pageLoadedAt: pageLoadedAt.current,
      away: away.current,
    });
    for (const job of [...announce, ...quiet]) handled.current.add(job.id);
    // The user watched these finish; stamp them so a later reload does not announce them.
    void markGenerationJobsSeen(
      quiet.map((job) => job.id),
      false,
    ).catch(() => undefined);
    if (announce.length === 0) return;
    const failed = announce.filter((job) => job.status !== "completed").length;
    toast(t("generationJobs.tracking.finishedAway", { count: announce.length }), {
      description: failed > 0 ? t("generationJobs.tracking.finishedAwayFailed", { count: failed }) : undefined,
      action: {
        label: t("generationJobs.tracking.view"),
        onClick: () => useUIStore.getState().openModal("generation-jobs"),
      },
    });
    void markGenerationJobsSeen(
      announce.map((job) => job.id),
      true,
    )
      .then(() => queryClient.invalidateQueries({ queryKey: generationJobKeys.records() }))
      .catch(() => undefined);
  }, [enabled, jobs.data, queryClient, t]);

  return null;
}
