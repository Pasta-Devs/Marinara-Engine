import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CapabilityPackageUpdate } from "@marinara-engine/shared";
import {
  useDeclineCapabilityPackageUpdates,
  useInstallCapabilityPackage,
  usePendingCapabilityPackageUpdates,
} from "../../hooks/use-capability-packages";
import { api, getPrivilegedActionErrorMessage } from "../../lib/api-client";
import { useUIStore } from "../../stores/ui.store";
import { AgentUpdateDialog, type AgentUpdatePhase, type AgentUpdateResult } from "./AgentUpdateDialog";
import { useTranslation as useUiTranslation } from "react-i18next";

export function AgentUpdatePrompter({
  presentationAllowed,
  onOpenChange,
  onResolved,
}: {
  presentationAllowed: boolean;
  onOpenChange?: (open: boolean) => void;
  onResolved?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { data: pendingUpdateData, isFetched, refetch: refetchPendingUpdates } = usePendingCapabilityPackageUpdates();
  const install = useInstallCapabilityPackage();
  const decline = useDeclineCapabilityPackageUpdates();
  const openAgentCatalog = useUIStore((state) => state.openAgentCatalog);
  // Kept as a ref, not state: a dismissed update must not re-prompt this session,
  // and marking it must not schedule another render of the queue effect.
  const handledUpdates = useRef(new Set<string>());
  const [prompted, setPrompted] = useState<CapabilityPackageUpdate[] | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [phase, setPhase] = useState<AgentUpdatePhase>("ask");
  const [results, setResults] = useState<Record<string, AgentUpdateResult>>({});

  useEffect(() => {
    onOpenChange?.(prompted !== null);
  }, [onOpenChange, prompted]);

  useEffect(() => {
    if (!isFetched) return;
    const updates = (pendingUpdateData ?? []).filter(
      (update) => !handledUpdates.current.has(`${update.id}@${update.version}`),
    );
    if (updates.length === 0) {
      onResolved?.();
      return;
    }
    if (!presentationAllowed || prompted) return;
    setSelected(new Set(updates.map((update) => update.id)));
    setPhase("ask");
    setResults({});
    setPrompted(updates);
  }, [isFetched, onResolved, pendingUpdateData, presentationAllowed, prompted]);

  const finish = useCallback(
    async (updates: CapabilityPackageUpdate[]) => {
      updates.forEach((update) => handledUpdates.current.add(`${update.id}@${update.version}`));
      setPrompted(null);
      await refetchPendingUpdates();
    },
    [refetchPendingUpdates],
  );

  /** Installs one by one so each row can show its own result; returns whether all passed without a restart. */
  const run = useCallback(
    async (updates: CapabilityPackageUpdate[]) => {
      setPhase("running");
      let clean = true;
      for (const update of updates) {
        setResults((current) => ({ ...current, [update.id]: { status: "running" } }));
        try {
          const installed = await install.mutateAsync({
            id: update.id,
            expectedVersion: update.version,
            expectedArtifactSha256: update.artifactSha256,
          });
          const restartRequired = installed.status === "restart-required";
          clean &&= !restartRequired;
          setResults((current) => ({ ...current, [update.id]: { status: "updated", restartRequired } }));
        } catch (error) {
          clean = false;
          const message = getPrivilegedActionErrorMessage(
            error,
            localizeUi("ui.agents.agentupdateprompter.someUpdatesCouldNotBeApplied"),
          );
          setResults((current) => ({ ...current, [update.id]: { status: "failed", error: message } }));
        }
      }
      setPhase("done");
      return clean;
    },
    [install, localizeUi],
  );

  const handleUpdate = useCallback(async () => {
    if (!prompted || phase !== "ask") return;
    setPhase("running");
    const chosen = prompted.filter((update) => selected.has(update.id));
    const skipped = prompted.filter((update) => !selected.has(update.id));
    if (skipped.length > 0) {
      try {
        await decline.mutateAsync(skipped);
      } catch (error) {
        toast.error(
          getPrivilegedActionErrorMessage(
            error,
            localizeUi("ui.agents.agentupdateprompter.someUpdateNoticesCouldNotBeDismissed"),
          ),
        );
      }
    }
    if (await run(chosen)) {
      toast.success(localizeUi("ui.agents.agentupdateprompter.updatesAppliedReadyToUse"));
      await finish(prompted);
    }
  }, [decline, finish, localizeUi, phase, prompted, run, selected]);

  const handleNotNow = useCallback(async () => {
    if (!prompted || phase !== "ask") return;
    // Close first, then decline them all in one request: a reload right after "Not now"
    // must not bring back updates a one-by-one loop had not reached yet. A failed
    // decline only means the notice can return next session (this one already treats them as handled).
    const updates = prompted;
    const closed = finish(updates);
    try {
      await decline.mutateAsync(updates);
    } catch (error) {
      toast.error(
        getPrivilegedActionErrorMessage(
          error,
          localizeUi("ui.agents.agentupdateprompter.someUpdateNoticesCouldNotBeDismissed"),
        ),
      );
    }
    await closed;
  }, [decline, finish, localizeUi, phase, prompted]);

  const restartNeeded = Object.values(results).some((result) => result.status === "updated" && result.restartRequired);

  // Leaving after a run that needs a restart keeps the old reminder toast.
  const leave = (updates: CapabilityPackageUpdate[]) => {
    if (restartNeeded) toast.info(localizeUi("ui.agents.agentupdateprompter.updatesAppliedRestartRequired"));
    void finish(updates);
  };

  if (!prompted) return null;

  return (
    <AgentUpdateDialog
      open
      updates={prompted}
      selected={selected}
      phase={phase}
      results={results}
      onToggle={(id) =>
        setSelected((current) => {
          const next = new Set(current);
          if (!next.delete(id)) next.add(id);
          return next;
        })
      }
      onUpdate={() => void handleUpdate()}
      onNotNow={() => void handleNotNow()}
      onRetry={(id) => {
        const update = prompted.find((item) => item.id === id);
        if (update && phase === "done") void run([update]);
      }}
      onClose={() => leave(prompted)}
      onRestart={
        restartNeeded
          ? () => {
              void finish(prompted);
              api
                .post<{ status: "restarting" }>("/admin/restart", { confirm: true })
                .then(() => toast.success(localizeUi("settings.serverRestart.success")))
                .catch((error) =>
                  toast.error(getPrivilegedActionErrorMessage(error, localizeUi("settings.serverRestart.error"))),
                );
            }
          : undefined
      }
      onShowInOrganizer={(id) => {
        leave(prompted);
        openAgentCatalog(id);
      }}
    />
  );
}
