import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, getPrivilegedActionErrorMessage, requestTimeoutSignal } from "../lib/api-client";
import { dismissAppUpdatePrompt } from "../lib/app-update-prompt";
import type { RestartProbe } from "../lib/server-restart";
import { useUIStore } from "../stores/ui.store";

/** One /api/health probe for the restart sheet; a frozen server counts as down after 5 s. */
export async function probeServerHealth(): Promise<RestartProbe> {
  try {
    const health = await api.get<{ bootId?: string }>("/health", { signal: requestTimeoutSignal(5_000) });
    return { ok: true, bootId: health?.bootId ?? null };
  } catch {
    return { ok: false };
  }
}

const RESTART_CHANNEL = "marinara-server-restart";

function openRestartSheet(beforeBootId?: string) {
  // Its Refresh would hit the down server; the sheet reloads into the new build anyway.
  dismissAppUpdatePrompt();
  useUIStore.getState().openModal("server-restart", { beforeBootId });
}

/** Shows the restart sheet when another tab of this browser restarts the server. */
export function useRestartSheetFromOtherTabs() {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(RESTART_CHANNEL);
    channel.onmessage = (event: MessageEvent<string>) => openRestartSheet(event.data);
    return () => channel.close();
  }, []);
}

/** False only when the server reports that nothing would start it again; unknown counts as available. */
export function useCanRestartServer(enabled = true): boolean {
  const { data } = useQuery({
    enabled,
    queryKey: ["health"],
    queryFn: ({ signal }) =>
      api.get<{ canRestart?: boolean }>("/health", { signal: requestTimeoutSignal(10_000, signal) }),
    staleTime: 60_000,
  });
  return data?.canRestart !== false;
}

/** Restarts the server and opens the sheet that waits for it and reloads the page. */
export function useRestartServer() {
  const { t } = useTranslation();
  // Hook-level callbacks still run when the caller unmounts first (the agent update dialog does).
  return useMutation({
    mutationFn: async () => {
      // The logo comes from the server that is about to stop.
      const logo = new Image();
      logo.src = "/logo.png";
      await logo.decode().catch(() => {});
      const { bootId } = await api.post<{ status: "restarting"; bootId: string }>("/admin/restart", { confirm: true });
      return bootId;
    },
    // Open at the click, with its backdrop at full strength: the dialog before it closes in the same frame,
    // so the app never shows undimmed. The sheet waits for the bootId before it probes.
    onMutate: () => openRestartSheet(),
    onSuccess: (beforeBootId) => {
      openRestartSheet(beforeBootId);
      // Other tabs of this browser lose the server too; they show the same sheet.
      if (typeof BroadcastChannel === "undefined") return;
      const channel = new BroadcastChannel(RESTART_CHANNEL);
      channel.postMessage(beforeBootId);
      channel.close();
    },
    onError: (error) => {
      useUIStore.getState().closeModal();
      toast.error(getPrivilegedActionErrorMessage(error, t("settings.serverRestart.error")));
    },
  });
}
