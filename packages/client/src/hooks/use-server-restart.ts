import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, getPrivilegedActionErrorMessage, requestTimeoutSignal } from "../lib/api-client";
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

/** Restarts the server and opens the sheet that waits for it and reloads the page. */
export function useRestartServer() {
  const { t } = useTranslation();
  // Hook-level callbacks still run when the caller unmounts first (the agent update dialog does).
  return useMutation({
    mutationFn: async () => {
      // Load the sheet's chunk and logo while the server still answers; it goes down right after the POST.
      const logo = new Image();
      logo.src = "/logo.png";
      await Promise.all([import("../components/layout/ModalRenderer"), logo.decode().catch(() => {})]);
      const before = await probeServerHealth();
      await api.post<{ status: "restarting" }>("/admin/restart", { confirm: true });
      return before.ok ? (before.bootId ?? null) : null;
    },
    onSuccess: (beforeBootId) => useUIStore.getState().openModal("server-restart", { beforeBootId }),
    onError: (error) => toast.error(getPrivilegedActionErrorMessage(error, t("settings.serverRestart.error"))),
  });
}
