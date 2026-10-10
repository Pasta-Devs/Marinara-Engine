import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  professorMariSeenRunSettingsKey,
  type AppSettingsResponse,
  type MariWorkspaceLatestRun,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { resolveMariEdgeGlow, type MariEdgeGlow } from "../lib/mari-presence-seen";
import { countBlockingReviews } from "../lib/professor-mari-presentation";
import { useChatStore } from "../stores/chat.store";
import { useUIStore } from "../stores/ui.store";
import { useProfessorMariWorkspaceStatus } from "./use-professor-mari-workspace-status";

/**
 * Heartbeat for Professor Mari's presence outside the omnibar dialog.
 *
 * Her state used to live inside the dialog, which is unmounted on close, so a
 * task that finished while the omnibar was shut was simply lost. This reads the
 * server status instead, at a slow cadence, from a component that is always
 * mounted.
 */
const PRESENCE_INTERVAL_MS = 30_000;

export interface MariPresence {
  /** She is running something right now. */
  working: boolean;
  pendingCount: number;
  /** The newest run and how it ended (server clock). */
  latestRun: MariWorkspaceLatestRun | null;
  /** A failure before the server saw the run. */
  clientRunFailed: boolean;
}

export function useMariPresence(): MariPresence {
  const status = useProfessorMariWorkspaceStatus({ intervalMs: PRESENCE_INTERVAL_MS });
  // F10: a failure before the server ever saw the run (404/network) has no server-side error to read.
  const clientRunFailed = useChatStore((state) => state.mariClientRunFailed);
  return {
    working: status.data?.active === true,
    pendingCount: countBlockingReviews(status.data?.pendingApprovals ?? []),
    latestRun: status.data?.latestRun ?? null,
    clientRunFailed,
  };
}

/** The id of the newest run the user has seen in her window on this thread; undefined while it loads. */
export function useMariRunSeenId(chatId: string | null | undefined): string | null | undefined {
  const query = useQuery({
    queryKey: ["app-settings", professorMariSeenRunSettingsKey(chatId ?? "")],
    queryFn: async () =>
      (await api.get<AppSettingsResponse>(`/app-settings/${professorMariSeenRunSettingsKey(chatId ?? "")}`)).value,
    enabled: !!chatId,
    staleTime: 60_000,
  });
  return chatId ? query.data : null;
}

/**
 * Her window shows a finished run on this thread: store that run's id as seen, so the top-bar pill
 * clears (Done, Failed) and stays cleared after a reload and on other devices.
 */
export function useMarkMariRunSeen(chatId: string | null, latestRun: MariWorkspaceLatestRun | null, working: boolean) {
  const queryClient = useQueryClient();
  const seenRunId = useMariRunSeenId(chatId);
  // Her chat stays mounted behind the search list (Mari, then Search); only her pane on screen counts as seen.
  const viewing = useUIStore((state) => state.mariPaneVisible);
  const markSeen = useMutation({
    mutationFn: (runId: string) =>
      api.put(`/app-settings/${professorMariSeenRunSettingsKey(chatId ?? "")}`, { value: runId }),
    onSuccess: (_result, runId) => {
      queryClient.setQueryData(["app-settings", professorMariSeenRunSettingsKey(chatId ?? "")], runId);
    },
  });
  const runId =
    viewing && latestRun && latestRun.chatId === chatId && latestRun.outcome !== "running" && !working
      ? latestRun.id
      : null;
  useEffect(() => {
    if (runId && seenRunId !== undefined && seenRunId !== runId) markSeen.mutate(runId);
    // markSeen is stable enough per render; the effect is keyed on the run and the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, seenRunId]);
}

/** Her state for the top-bar edge line and pill, once the user has seen the result in her pane. */
export function useMariEdgeGlow(): MariEdgeGlow {
  const presence = useMariPresence();
  const mariEnabled = useUIStore((state) => state.commandCenterMariEnabled);
  const seenRunId = useMariRunSeenId(presence.latestRun?.chatId ?? null);
  if (!mariEnabled) return null;
  return resolveMariEdgeGlow({
    working: presence.working,
    pendingApprovals: presence.pendingCount,
    latestRun: presence.latestRun,
    seenRunId,
    clientRunFailed: presence.clientRunFailed,
  });
}
