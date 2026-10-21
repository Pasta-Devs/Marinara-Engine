import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MariRuntime, MariWorkspaceStatus } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { professorMariWorkspaceStatusKeys } from "../../../hooks/use-professor-mari-workspace-status";
import { api } from "../../../lib/api-client";
import { enqueueMariPermissionsModeWrite } from "../../../lib/mari-permissions-write-chain";

/** Switching changes the next run only. Never automatically resend a request that may have saved changes. */
export function MariRuntimeRecovery({
  status,
  busy,
  refreshStatus,
}: {
  status: MariWorkspaceStatus | null;
  busy: boolean;
  refreshStatus: () => Promise<MariWorkspaceStatus>;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const change = useMutation({
    mutationFn: (runtime: MariRuntime) =>
      enqueueMariPermissionsModeWrite(() => api.put("/professor-mari/workspace/runtime", { runtime })),
    onSuccess: async () => {
      await Promise.allSettled([
        refreshStatus(),
        qc.invalidateQueries({ queryKey: professorMariWorkspaceStatusKeys.all }),
      ]);
    },
    onError: () => toast.error(t("omnibar.settings.mariRuntime.couldNotChange")),
  });
  if (!status) return null;
  const classic = status.runtimeSelected === "classic";
  if (!classic && (status.runtimeActive !== "pi" || (status.piConsecutiveFailures ?? 0) < 3)) return null;
  return (
    <div className="mb-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
      <p className="min-w-0 flex-1" role="status">
        {t(classic ? "mari.runtimeRecovery.classicActive" : "mari.runtimeRecovery.piFailed")}
      </p>
      <button
        type="button"
        className="mari-btn shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
        disabled={busy || status.active || change.isPending}
        onClick={() => change.mutate(classic ? "pi" : "classic")}
      >
        {t(
          change.isPending
            ? "mari.runtimeRecovery.switching"
            : classic
              ? "mari.runtimeRecovery.tryPiAgain"
              : "mari.runtimeRecovery.switchToClassic",
        )}
      </button>
    </div>
  );
}
